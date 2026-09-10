/**
 * Importa un lote de objetos declarado en JSON.
 *
 *   npx tsx scripts/import-lote.ts lotes/cajon-1.json --dry-run
 *   npx tsx scripts/import-lote.ts lotes/cajon-1.json
 *
 * Es idempotente: empareja por nombre normalizado dentro de la ubicacion
 * destino, asi que reejecutarlo tras corregir el fichero no duplica nada.
 * Actualiza lo que cambio y crea solo lo que falta.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { HomeBoxClient } from '../src/modules/homebox/homebox.client.js';
import { buildLocationPaths, normalizeString } from '../src/modules/resolvers/location-path.builder.js';
import type { LocationTreeNode } from '../src/modules/resolvers/resolver.types.js';
import type { HomeBoxEntity } from '../src/modules/homebox/homebox.types.js';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

interface ObjetoLote {
  nombre: string;
  descripcion?: string;
  tipo?: string;
  cantidad?: number;
  /** Si falta, se usa `ubicacionBase` del lote. */
  ubicacion?: string;
  /** Ruta relativa al propio fichero de lote. */
  foto?: string;
}

interface Lote {
  ubicacionBase: string;
  objetos: ObjetoLote[];
}

const DRY_RUN = process.argv.includes('--dry-run');
const creados: string[] = [];
const actualizados: string[] = [];
const sinCambios: string[] = [];
const fotos: string[] = [];

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    throw new Error('Uso: npx tsx scripts/import-lote.ts <lote.json> [--dry-run]');
  }

  const lote = JSON.parse(readFileSync(ruta, 'utf8')) as Lote;
  const baseDir = dirname(resolve(ruta));
  const client = new HomeBoxClient();

  console.log(DRY_RUN ? '== SIMULACIÓN, no se escribe nada ==\n' : '== Importando ==\n');

  const ubicaciones = new Map(
    buildLocationPaths((await client.listLocations(false)) as LocationTreeNode[]).map((l) => [
      l.path,
      l.id,
    ])
  );
  const tipos = new Map(
    (await client.listEntityTypes()).map((t) => [normalizeString(t.name), t.id])
  );

  // Todo se valida antes de tocar nada: mejor abortar entero que dejar el
  // lote a medias.
  const errores: string[] = [];
  for (const [i, objeto] of lote.objetos.entries()) {
    const destino = objeto.ubicacion ?? lote.ubicacionBase;
    if (!ubicaciones.has(destino)) {
      errores.push(`[${i}] "${objeto.nombre}": la ubicación "${destino}" no existe`);
    }
    if (objeto.tipo && !tipos.has(normalizeString(objeto.tipo))) {
      errores.push(`[${i}] "${objeto.nombre}": el tipo "${objeto.tipo}" no existe`);
    }
    if (objeto.foto && !existsSync(resolve(baseDir, objeto.foto))) {
      errores.push(`[${i}] "${objeto.nombre}": no encuentro la foto "${objeto.foto}"`);
    }
    if (objeto.foto && !MIME[extname(objeto.foto).toLowerCase()]) {
      errores.push(`[${i}] "${objeto.nombre}": formato de foto no soportado`);
    }
  }

  if (errores.length > 0) {
    console.error(`Se aborta, ${errores.length} problema(s):\n`);
    errores.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }

  // Indice de lo que ya hay, por ubicacion y nombre normalizado.
  const existentes = new Map<string, HomeBoxEntity>();
  for (const entidad of await client.listAllEntities()) {
    const padre = (entidad.parent as { id?: string } | undefined)?.id;
    if (padre) {
      existentes.set(`${padre}::${normalizeString(entidad.name)}`, entidad);
    }
  }

  for (const objeto of lote.objetos) {
    const destino = objeto.ubicacion ?? lote.ubicacionBase;
    const parentId = ubicaciones.get(destino)!;
    const previo = existentes.get(`${parentId}::${normalizeString(objeto.nombre)}`);

    const entityTypeId = objeto.tipo ? tipos.get(normalizeString(objeto.tipo)) : undefined;

    let id: string;
    if (previo) {
      const cambios = diferencias(previo, objeto);
      id = previo.id;
      if (cambios.length === 0) {
        sinCambios.push(objeto.nombre);
      } else {
        actualizados.push(`${objeto.nombre}  (${cambios.join(', ')})`);
        if (!DRY_RUN) {
          await client.updateEntity(previo.id, {
            name: objeto.nombre,
            description: objeto.descripcion,
            quantity: objeto.cantidad,
            entityTypeId,
          });
        }
      }
    } else {
      creados.push(`${destino} > ${objeto.nombre}`);
      id = 'dry';
      if (!DRY_RUN) {
        const entidad = await client.createEntity({
          name: objeto.nombre,
          description: objeto.descripcion,
          parentId,
          quantity: objeto.cantidad,
          entityTypeId,
        });
        id = entidad.id;
      }
    }

    if (objeto.foto) {
      const yaTiene = (previo?.attachments ?? []).length > 0;
      if (yaTiene) {
        continue;
      }
      fotos.push(`${objeto.nombre} <- ${objeto.foto}`);
      if (!DRY_RUN) {
        const archivo = resolve(baseDir, objeto.foto);
        await client.uploadAttachment(id, {
          file: new Uint8Array(readFileSync(archivo)),
          filename: objeto.foto.split('/').pop()!,
          mimeType: MIME[extname(objeto.foto).toLowerCase()],
          type: 'photo',
          primary: true,
          title: objeto.nombre,
        });
      }
    }
  }

  resumen();
}

function diferencias(previo: HomeBoxEntity, objeto: ObjetoLote): string[] {
  const cambios: string[] = [];
  if (previo.name !== objeto.nombre) cambios.push('nombre');
  if (objeto.descripcion !== undefined && previo.description !== objeto.descripcion) {
    cambios.push('descripción');
  }
  if (objeto.cantidad !== undefined && previo.quantity !== objeto.cantidad) {
    cambios.push('cantidad');
  }
  return cambios;
}

function resumen() {
  const bloque = (titulo: string, lista: string[], marca: string) => {
    if (lista.length === 0) return;
    console.log(`${titulo} (${lista.length}):`);
    lista.forEach((l) => console.log(`   ${marca} ${l}`));
    console.log();
  };

  bloque('Sin cambios', sinCambios, '=');
  bloque('Actualizado', actualizados, '~');
  bloque('Creado', creados, '+');
  bloque('Fotos adjuntadas', fotos, '@');

  const total = creados.length + actualizados.length + sinCambios.length;
  console.log(`Total procesado: ${total} objeto(s).`);
}

main().catch((err) => {
  console.error('La importación falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
