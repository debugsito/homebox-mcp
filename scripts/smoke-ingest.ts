/**
 * Prueba de humo de la ingesta por fotos contra Gemini y HomeBox reales.
 * Solo analiza: no escribe nada en el inventario.
 *
 *   npx tsx scripts/smoke-ingest.ts <ruta-imagen> [pista]
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { PhotoIngestService } from '../src/modules/ingest/photo-ingest.service.js';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function main() {
  const ruta = process.argv[2];
  if (!ruta) {
    throw new Error('Uso: npx tsx scripts/smoke-ingest.ts <ruta-imagen> [pista]');
  }

  const mimeType = MIME[extname(ruta).toLowerCase()];
  if (!mimeType) {
    throw new Error(`Extensión no soportada: ${extname(ruta)}`);
  }

  const data = readFileSync(ruta).toString('base64');
  console.log(`imagen: ${ruta} (${Math.round(data.length / 1365)} KB aprox)\n`);

  const propuesta = await new PhotoIngestService().analizar([{ data, mimeType }], process.argv[3]);

  console.log(`objetos propuestos: ${propuesta.objetos.length}\n`);
  for (const o of propuesta.objetos) {
    console.log(`  ${o.nombre}  (${o.tipo}, cantidad ${o.cantidad}, confianza ${o.confianza})`);
    console.log(`    ${o.descripcion}`);
    console.log(`    -> ${o.ubicacionSugerida || '(sin ubicación válida)'}`);
    console.log(`       ${o.motivoUbicacion}`);
    console.log();
  }

  if (propuesta.notas) {
    console.log(`notas: ${propuesta.notas}`);
  }
}

main().catch((err) => {
  console.error('smoke falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
