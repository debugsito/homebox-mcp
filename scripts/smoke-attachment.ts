/**
 * Prueba de humo de los adjuntos contra la instancia real: sube una imagen a
 * un objeto, comprueba que quedo registrada y la borra.
 *
 *   npx tsx scripts/smoke-attachment.ts <itemId>
 */
import { HomeBoxClient } from '../src/modules/homebox/homebox.client.js';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  const itemId = process.argv[2];
  if (!itemId) {
    throw new Error('Falta el itemId');
  }

  const client = new HomeBoxClient();

  const antes = await client.getEntityById(itemId);
  console.log(`objeto: ${antes.name}`);
  console.log(`adjuntos antes: ${(antes.attachments ?? []).length}`);

  const subida = await client.uploadAttachment(itemId, {
    file: new Uint8Array(PNG_1x1),
    filename: 'prueba-adjunto.png',
    mimeType: 'image/png',
    type: 'photo',
    primary: false,
    title: 'prueba-adjunto',
  });
  console.log(`subido: id=${subida.id} tipo=${subida.type} primary=${subida.primary}`);

  const despues = await client.getEntityById(itemId);
  const adjuntos = despues.attachments ?? [];
  console.log(`adjuntos despues: ${adjuntos.length}`);

  const encontrado = adjuntos.find((a: { id: string }) => a.id === subida.id);
  console.log(encontrado ? 'OK: aparece en la ficha' : 'FALLO: no aparece en la ficha');

  await client.deleteAttachment(itemId, subida.id);
  const limpio = await client.getEntityById(itemId);
  console.log(`adjuntos tras borrar: ${(limpio.attachments ?? []).length}`);
}

main().catch((err) => {
  console.error('smoke falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
