import { describe, it, expect } from 'vitest';
import {
  buildLocationPaths,
  normalizeString,
  matchScore,
} from '../src/modules/resolvers/location-path.builder.js';
import type { LocationTreeNode } from '../src/modules/resolvers/resolver.types.js';

const tree: LocationTreeNode[] = [
  {
    id: 'homie',
    name: 'Homie',
    children: [
      {
        id: 'oficina',
        name: 'Cuarto Oficina',
        children: [
          {
            id: 'cajones',
            name: 'Cajones Escritorio',
            children: [{ id: 'cajon1', name: 'Cajon 1', children: [] }],
          },
        ],
      },
    ],
  },
  { id: 'ventanilla', name: 'Casa Ventanilla', children: [] },
];

describe('buildLocationPaths', () => {
  it('aplana el arbol conservando la ruta completa de cada nodo', () => {
    const paths = buildLocationPaths(tree);

    expect(paths.map((p) => p.path)).toEqual([
      'Homie',
      'Homie > Cuarto Oficina',
      'Homie > Cuarto Oficina > Cajones Escritorio',
      'Homie > Cuarto Oficina > Cajones Escritorio > Cajon 1',
      'Casa Ventanilla',
    ]);
  });

  it('normaliza la ruta para poder compararla sin acentos ni mayusculas', () => {
    const cajon = buildLocationPaths(tree).find((p) => p.id === 'cajon1');
    expect(cajon?.normalizedPath).toBe('homie > cuarto oficina > cajones escritorio > cajon 1');
  });
});

describe('normalizeString', () => {
  it.each([
    ['  Cámara IP  ', 'camara ip'],
    ['Cajón-1', 'cajon 1'],
    ['MALETA_AZUL', 'maleta azul'],
    ['Baño   Grande', 'bano grande'],
  ])('normaliza %j a %j', (input, expected) => {
    expect(normalizeString(input)).toBe(expected);
  });
});

describe('matchScore', () => {
  it('puntua el match exacto por encima del prefijo y del substring', () => {
    expect(matchScore('cajon 1', 'cajon 1')).toBeGreaterThan(matchScore('cajon', 'cajon 1'));
    expect(matchScore('cajon', 'cajon 1')).toBeGreaterThan(matchScore('1', 'cajon 1'));
  });

  it('devuelve 0 cuando no hay ninguna coincidencia', () => {
    expect(matchScore('taladro', 'cajon 1')).toBe(0);
  });

  it('no explota con caracteres especiales de regex', () => {
    expect(() => matchScore('rtx (3060)', 'rtx 3060')).not.toThrow();
  });
});
