# Lotes de carga

Un fichero JSON por contenedor (un cajón, una caja, una división). Se importan con:

```bash
npx tsx scripts/import-lote.ts lotes/cajon-1.json --dry-run   # simula
npx tsx scripts/import-lote.ts lotes/cajon-1.json             # escribe
```

El importador **valida el lote entero antes de tocar nada**: si una ubicación, un tipo o una
foto no existen, aborta sin escribir. Y es idempotente: empareja por nombre normalizado dentro
de la ubicación destino, así que se puede corregir el JSON y reejecutar sin duplicar.

Los tipos válidos salen de HomeBox. Para objetos: `Gadgets`, `Herramienta`, `Cable`,
`Componente`, `Consumible`, `Accesorio`.

Estos ficheros quedan versionados: son el registro de qué se cargó y cuándo.
