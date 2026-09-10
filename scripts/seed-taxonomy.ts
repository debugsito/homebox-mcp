/**
 * Siembra los tipos de entidad y el arbol de ubicaciones.
 *
 *   npx tsx scripts/seed-taxonomy.ts --dry-run
 *   npx tsx scripts/seed-taxonomy.ts
 *
 * Es idempotente: busca por nombre dentro del mismo padre y solo crea lo que
 * falta, asi que se puede reejecutar tras retocar el arbol.
 */
import { HomeBoxClient } from '../src/modules/homebox/homebox.client.js';
import type { EntityType } from '../src/modules/homebox/homebox.client.js';
import type { HomeBoxTreeItem } from '../src/modules/homebox/homebox.types.js';
import { normalizeString } from '../src/modules/resolvers/location-path.builder.js';

const DRY_RUN = process.argv.includes('--dry-run');

// --- Tipos -----------------------------------------------------------------

const LOCATION_TYPES = ['Sede', 'Cuarto', 'Mueble', 'Cajón', 'División', 'Caja', 'Maleta'];
const ITEM_TYPES = ['Herramienta', 'Cable', 'Componente', 'Consumible', 'Accesorio'];

// --- Arbol -----------------------------------------------------------------

interface Node {
  name: string;
  type: string;
  description?: string;
  children?: Node[];
  items?: { name: string; type?: string; description?: string }[];
}

const CAJA = (name: string, description: string): Node => ({ name, type: 'Caja', description });

const TREE: Node[] = [
  {
    name: 'Homie',
    type: 'Sede',
    description: 'Departamento',
    children: [
      { name: 'Baño', type: 'Cuarto' },
      { name: 'Cuarto Sebas', type: 'Cuarto' },
      {
        name: 'Cuarto Oficina',
        type: 'Cuarto',
        children: [
          {
            name: 'Escritorio',
            type: 'Mueble',
            children: [
              {
                name: 'Cajón 1',
                type: 'Cajón',
                description: 'Dos cajas y cosas sueltas, pendiente de detallar',
                children: [
                  CAJA('Caja 1A', 'Contenido por inventariar'),
                  CAJA('Caja 1B', 'Contenido por inventariar'),
                ],
              },
              {
                name: 'Cajón 2',
                type: 'Cajón',
                items: [
                  { name: 'Balanza', type: 'Accesorio' },
                  { name: 'Llaveros', type: 'Accesorio', description: 'Varios, por separar' },
                  { name: 'Lentes', type: 'Accesorio', description: 'Varios, por separar' },
                  { name: 'Cereales', type: 'Consumible' },
                  { name: 'Consola retro', type: 'Gadgets' },
                  { name: 'Cases de celular', type: 'Accesorio', description: 'Varios, por separar' },
                ],
              },
              {
                name: 'Cajón 3',
                type: 'Cajón',
                description: 'Dos cajas y cosas sueltas, pendiente de detallar',
                children: [
                  CAJA('Caja 3A', 'Contenido por inventariar'),
                  CAJA('Caja 3B', 'Contenido por inventariar'),
                ],
              },
            ],
          },
          {
            name: 'Estante Grande',
            type: 'Mueble',
            description: 'Cuatro vitrinas con puertas arriba y cuatro nichos abiertos abajo',
            children: [
              {
                name: 'Vitrina 1',
                type: 'División',
                description: 'Con puertas, dos niveles internos',
                children: [
                  {
                    name: 'Maleta Herramientas',
                    type: 'Maleta',
                    description: 'Contenido por inventariar. Confirmar en qué vitrina está',
                  },
                ],
              },
              { name: 'Vitrina 2', type: 'División', description: 'Con puertas, dos niveles internos. Por ordenar' },
              { name: 'Vitrina 3', type: 'División', description: 'Con puertas, dos niveles internos. Por ordenar' },
              { name: 'Vitrina 4', type: 'División', description: 'Con puertas, dos niveles internos. Por ordenar' },
              {
                name: 'Nicho 1',
                type: 'División',
                description: 'Abierto, bajo las vitrinas',
                items: [
                  { name: 'Calefactor de aire pequeño', type: 'Gadgets' },
                  { name: 'Mousepad', type: 'Accesorio' },
                ],
                children: [
                  CAJA('Caja Cables', 'Caja de plástico con divisiones: cargadores, HDMI, adaptadores'),
                  CAJA('Caja Electrónica', 'Caja de plástico: resistencias y componentes sueltos'),
                  CAJA('Organizador Tornillos', 'Caja de muchas divisiones pequeñas: tornillos y fijaciones'),
                ],
              },
              { name: 'Nicho 2', type: 'División', description: 'Abierto, bajo las vitrinas. Por ordenar' },
              { name: 'Nicho 3', type: 'División', description: 'Abierto, bajo las vitrinas. Por ordenar' },
              { name: 'Nicho 4', type: 'División', description: 'Abierto, bajo las vitrinas. Por ordenar' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Casa Ventanilla',
    type: 'Sede',
    description: 'Casa de los padres. Separaciones internas pendientes',
    children: [
      { name: 'Cochera', type: 'Cuarto' },
      { name: 'Cuarto primer piso', type: 'Cuarto' },
    ],
  },
];

// --- Ejecución -------------------------------------------------------------

const client = new HomeBoxClient();
const created: string[] = [];
const reused: string[] = [];
const renamed: string[] = [];

async function ensureTypes(): Promise<Map<string, EntityType>> {
  const existing = await client.listEntityTypes();
  const byName = new Map(existing.map((t) => [normalizeString(t.name), t]));

  for (const [names, isLocation] of [
    [LOCATION_TYPES, true],
    [ITEM_TYPES, false],
  ] as const) {
    for (const name of names) {
      if (byName.has(normalizeString(name))) {
        reused.push(`tipo ${name}`);
        continue;
      }
      created.push(`tipo ${name}${isLocation ? ' (ubicación)' : ''}`);
      if (!DRY_RUN) {
        byName.set(normalizeString(name), await client.createEntityType({ name, isLocation }));
      }
    }
  }

  return byName;
}

interface Existing {
  id: string;
  name: string;
}

/**
 * Indexa por nombre normalizado (sin tildes ni mayusculas) para que "Cajon 1"
 * ya existente empareje con el "Cajón 1" canonico en vez de duplicarlo.
 */
function indexTree(nodes: HomeBoxTreeItem[], parentId: string | null, into: Map<string, Existing>) {
  for (const node of nodes) {
    into.set(`${parentId ?? 'root'}::${normalizeString(node.name)}`, { id: node.id, name: node.name });
    if (node.children?.length) {
      indexTree(node.children, node.id, into);
    }
  }
  return into;
}

async function ensureNode(
  node: Node,
  parentId: string | null,
  index: Map<string, Existing>,
  types: Map<string, EntityType>,
  path: string[]
): Promise<void> {
  const fullPath = [...path, node.name].join(' > ');
  const key = `${parentId ?? 'root'}::${normalizeString(node.name)}`;
  const found = index.get(key);
  let id = found?.id;

  if (found) {
    if (found.name === node.name) {
      reused.push(fullPath);
    } else {
      renamed.push(`${found.name} -> ${node.name}`);
      if (!DRY_RUN) {
        await client.updateEntity(found.id, { name: node.name });
      }
    }
  } else {
    created.push(fullPath);
    if (!DRY_RUN) {
      const entity = await client.createEntity({
        name: node.name,
        description: node.description,
        parentId: parentId ?? undefined,
        entityTypeId: types.get(normalizeString(node.type))?.id,
      });
      id = entity.id;
      index.set(key, { id, name: node.name });
    }
  }

  if (DRY_RUN && !id) {
    id = `dry-${fullPath}`;
  }

  for (const item of node.items ?? []) {
    const itemKey = `${id}::${normalizeString(item.name)}`;
    if (index.has(itemKey)) {
      reused.push(`${fullPath} > ${item.name}`);
      continue;
    }
    created.push(`${fullPath} > ${item.name}  [objeto]`);
    if (!DRY_RUN) {
      await client.createEntity({
        name: item.name,
        description: item.description,
        parentId: id,
        entityTypeId: types.get(normalizeString(item.type ?? 'Accesorio'))?.id,
      });
    }
  }

  for (const child of node.children ?? []) {
    await ensureNode(child, id ?? null, index, types, [...path, node.name]);
  }
}

async function main() {
  console.log(DRY_RUN ? '== SIMULACIÓN, no se escribe nada ==\n' : '== Sembrando ==\n');

  const types = await ensureTypes();
  const tree = await client.listLocations(true);
  const index = indexTree(tree as HomeBoxTreeItem[], null, new Map());

  for (const root of TREE) {
    await ensureNode(root, null, index, types, []);
  }

  console.log(`Ya existía (${reused.length}):`);
  reused.forEach((r) => console.log(`   = ${r}`));
  if (renamed.length) {
    console.log(`\nRenombrado (${renamed.length}):`);
    renamed.forEach((r) => console.log(`   ~ ${r}`));
  }
  console.log(`\nCreado (${created.length}):`);
  created.forEach((c) => console.log(`   + ${c}`));
}

main().catch((err) => {
  console.error('Falló la siembra:', err instanceof Error ? err.message : err);
  process.exit(1);
});
