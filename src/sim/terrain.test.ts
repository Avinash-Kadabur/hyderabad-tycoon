import { describe, expect, it } from 'vitest';
import { generateTerrain } from './terrain';

describe('generateTerrain', () => {
  const size = 64;
  const tiles = generateTerrain(size, 1591);
  const at = (x: number, y: number) => tiles[y * size + x];
  const count = (kind: string) => tiles.filter((tile) => tile === kind).length;

  it('makes the same land every time for the same seed', () => {
    expect(generateTerrain(size, 1591)).toEqual(tiles);
    expect(generateTerrain(size, 7)).not.toEqual(tiles);
  });

  it('runs the river from the west edge to the east edge', () => {
    const column = (x: number) => Array.from({ length: size }, (_, y) => at(x, y));
    expect(column(0)).toContain('water');
    expect(column(size - 1)).toContain('water');
  });

  it('leaves most of the land free to build on', () => {
    expect(count('grass') + count('trees')).toBeGreaterThan(tiles.length * 0.7);
    expect(count('water')).toBeGreaterThan(100);
    expect(count('rock')).toBeGreaterThan(10);
    expect(count('trees')).toBeGreaterThan(20);
  });

  it('keeps boulders away from where the camera starts', () => {
    const middle = size / 2;
    for (let y = middle - 4; y <= middle + 4; y++) {
      for (let x = middle - 4; x <= middle + 4; x++) expect(at(x, y)).not.toBe('rock');
    }
  });
});
