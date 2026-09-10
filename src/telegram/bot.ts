import { Bot, InlineKeyboard, type Context } from 'grammy';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AIService } from '../modules/ai/ai.service.js';
import { PhotoIngestService } from '../modules/ingest/photo-ingest.service.js';
import { homeBoxService } from '../modules/homebox/homebox.service.js';
import { buildLocationPaths } from '../modules/resolvers/location-path.builder.js';
import type { LocationTreeNode } from '../modules/resolvers/resolver.types.js';
import { PendingStore } from './pending.store.js';
import type { AIMessage } from '../modules/ai/providers/index.js';

const MAX_HISTORIAL = 12;

export interface Dependencias {
  ai?: AIService;
  ingest?: PhotoIngestService;
  pendientes?: PendingStore;
}

export function buildBot(token: string, deps: Dependencias = {}): Bot {
  const bot = new Bot(token);
  const ai = deps.ai ?? new AIService();
  const ingest = deps.ingest ?? new PhotoIngestService();
  const pendientes = deps.pendientes ?? new PendingStore();
  const historial = new Map<number, AIMessage[]>();

  // Allowlist antes que nada: sin ella, cualquiera que encuentre el bot
  // podria consultar y mover el inventario.
  bot.use(async (ctx, next) => {
    const chatId = String(ctx.chat?.id ?? '');
    if (!config.TELEGRAM_ALLOWED_CHAT_IDS.includes(chatId)) {
      logger.warn({ chatId, from: ctx.from?.username }, 'Telegram: chat no autorizado');
      await ctx.reply('No estás autorizado para usar este bot.');
      return;
    }
    await next();
  });

  bot.command('start', (ctx) =>
    ctx.reply(
      'Soy tu inventario de casa.\n\n' +
        'Pregúntame dónde está algo, o mándame una foto y te propongo qué registrar y dónde.\n\n' +
        '/ubicaciones — el árbol completo\n' +
        '/olvidar — reinicia el hilo de la conversación\n' +
        '/ayuda — esto mismo'
    )
  );

  bot.command('ayuda', (ctx) =>
    ctx.reply(
      'Ejemplos:\n' +
        '· «¿dónde están mis llaves?»\n' +
        '· «guarda el taladro en el Nicho 2»\n' +
        '· «mueve la RTX al Cajón 3»\n\n' +
        'Con una foto: te propongo nombre, descripción y ubicación, y tú confirmas.'
    )
  );

  bot.command('olvidar', (ctx) => {
    historial.delete(ctx.chat.id);
    return ctx.reply('Listo, empezamos de cero.');
  });

  bot.command('ubicaciones', async (ctx) => {
    const tree = await homeBoxService.listLocations(false);
    const rutas = buildLocationPaths(tree as LocationTreeNode[]).map((l) => l.path);
    await ctx.reply(rutas.join('\n') || 'Todavía no hay ubicaciones.');
  });

  bot.on('message:photo', async (ctx) => {
    await ctx.replyWithChatAction('typing');

    try {
      const imagen = await descargarFoto(ctx);
      const pista = ctx.message.caption;
      const propuesta = await ingest.analizar([imagen], pista);

      if (propuesta.objetos.length === 0) {
        await ctx.reply(
          `No identifiqué nada que registrar.\n\n${propuesta.notas || 'Prueba con más luz o más cerca.'}`
        );
        return;
      }

      const id = pendientes.guardar({ propuesta, imagen });
      await ctx.reply(formatearPropuesta(propuesta), {
        reply_markup: new InlineKeyboard()
          .text('Guardar todo', `ok:${id}`)
          .text('Descartar', `no:${id}`),
      });
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      logger.error({ error: mensaje }, 'Telegram: fallo al procesar la foto');
      await ctx.reply(`No pude procesar la foto: ${mensaje}`);
    }
  });

  bot.callbackQuery(/^no:(.+)$/, async (ctx) => {
    pendientes.borrar(ctx.match[1]);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText('Descartado, no guardé nada.');
  });

  bot.callbackQuery(/^ok:(.+)$/, async (ctx) => {
    const pendiente = pendientes.obtener(ctx.match[1]);

    if (!pendiente) {
      await ctx.answerCallbackQuery({ text: 'Esa propuesta ya caducó' });
      await ctx.editMessageText('Esta propuesta caducó. Manda la foto otra vez.');
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Guardando...' });

    const listos = pendiente.propuesta.objetos.filter((o) => o.ubicacionSugerida);
    const sinUbicar = pendiente.propuesta.objetos.filter((o) => !o.ubicacionSugerida);

    if (listos.length === 0) {
      await ctx.editMessageText(
        'Ninguno tenía una ubicación válida, así que no guardé nada. Dime dónde va cada cosa.'
      );
      return;
    }

    try {
      const creados = await ingest.confirmar(
        listos.map((o, i) => ({
          nombre: o.nombre,
          descripcion: o.descripcion,
          cantidad: o.cantidad,
          ubicacionPath: o.ubicacionSugerida,
          // La foto se adjunta solo al primero: es la misma imagen para todos
          // y duplicarla engordaría el volumen sin aportar nada.
          imagen: i === 0 ? pendiente.imagen : undefined,
        }))
      );

      pendientes.borrar(ctx.match[1]);

      const lineas = creados.map((c) => `· ${c.nombre}`);
      if (sinUbicar.length > 0) {
        lineas.push('', `Sin guardar por falta de ubicación: ${sinUbicar.map((o) => o.nombre).join(', ')}`);
      }
      await ctx.editMessageText(`Guardado:\n${lineas.join('\n')}`);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      logger.error({ error: mensaje }, 'Telegram: fallo al guardar');
      await ctx.editMessageText(`No pude guardar: ${mensaje}`);
    }
  });

  bot.on('message:text', async (ctx) => {
    await ctx.replyWithChatAction('typing');

    const previo = historial.get(ctx.chat.id) ?? [];
    try {
      const respuesta = await ai.chat(ctx.message.text, previo);

      historial.set(
        ctx.chat.id,
        [
          ...previo,
          { role: 'user' as const, content: ctx.message.text },
          { role: 'assistant' as const, content: respuesta.response },
        ].slice(-MAX_HISTORIAL)
      );

      await ctx.reply(respuesta.response);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      logger.error({ error: mensaje }, 'Telegram: fallo en el chat');
      await ctx.reply('Se me atragantó esa consulta. Prueba de nuevo o reformúlala.');
    }
  });

  bot.catch((err) => {
    logger.error({ error: err.message }, 'Telegram: error no capturado');
  });

  return bot;
}

/** Telegram ofrece varios tamaños; el ultimo es el mayor. */
async function descargarFoto(ctx: Context): Promise<{ data: string; mimeType: string }> {
  const fotos = ctx.message?.photo ?? [];
  const mayor = fotos[fotos.length - 1];
  if (!mayor) {
    throw new Error('El mensaje no traía ninguna foto');
  }

  const file = await ctx.api.getFile(mayor.file_id);
  if (!file.file_path) {
    throw new Error('Telegram no devolvió la ruta del fichero');
  }

  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No pude descargar la foto (${respuesta.status})`);
  }

  const buffer = Buffer.from(await respuesta.arrayBuffer());
  return { data: buffer.toString('base64'), mimeType: 'image/jpeg' };
}

export function formatearPropuesta(propuesta: {
  objetos: {
    nombre: string;
    descripcion: string;
    cantidad: number;
    ubicacionSugerida: string;
    motivoUbicacion: string;
    confianza: string;
  }[];
  notas: string;
}): string {
  const marca = { alta: '✓', media: '~', baja: '?' } as Record<string, string>;

  const bloques = propuesta.objetos.map((o) => {
    const cantidad = o.cantidad > 1 ? ` ×${o.cantidad}` : '';
    const destino = o.ubicacionSugerida
      ? `→ ${o.ubicacionSugerida}\n   ${o.motivoUbicacion}`
      : `→ sin ubicación clara\n   ${o.motivoUbicacion}`;
    return `${marca[o.confianza] ?? '?'} ${o.nombre}${cantidad}\n   ${o.descripcion}\n   ${destino}`;
  });

  const notas = propuesta.notas ? `\n\nNotas: ${propuesta.notas}` : '';
  return `${bloques.join('\n\n')}${notas}`;
}
