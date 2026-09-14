import type { HomeBoxEntity } from './homebox.types.js';

/**
 * Lo que un modelo necesita de un objeto. Las entidades crudas de HomeBox
 * traen ~14 campos, y `parent` y `entityType` vienen anidados enteros: el 59%
 * de cada objeto son UUIDs, timestamps y campos de seguro o compra que aqui no
 * significan nada. Con 300 objetos, listarlos crudos se come el contexto.
 */
export interface ItemSummary {
  id: string;
  name: string;
  description?: string;
  quantity?: number;
  type?: string;
  location?: string;
}

export function summarizeItem(entity: HomeBoxEntity): ItemSummary {
  const resumen: ItemSummary = {
    id: entity.id,
    name: entity.name,
  };

  if (entity.description) {
    resumen.description = entity.description;
  }
  // 1 es el valor por defecto: decirlo no aporta nada.
  if (typeof entity.quantity === 'number' && entity.quantity !== 1) {
    resumen.quantity = entity.quantity;
  }

  const tipo = (entity.entityType as { name?: string } | undefined)?.name;
  if (tipo) {
    resumen.type = tipo;
  }

  const padre = (entity.parent as { name?: string } | undefined)?.name;
  if (padre) {
    resumen.location = padre;
  }

  return resumen;
}

export function summarizeItems(entities: HomeBoxEntity[]): ItemSummary[] {
  return entities.map(summarizeItem);
}
