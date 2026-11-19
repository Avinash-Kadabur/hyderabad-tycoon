import { describe, expect, it } from 'vitest';
import { TILE_H, TILE_W } from '../config';
import { mapCorners, tileLine, tileToWorld, worldToTile } from './iso';

describe('isometric maths', () => {
  it('finds a tile again from its centre', () => {
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const p = tileToWorld(x, y);
        expect(worldToTile(p.x, p.y)).toEqual({ x, y });
      }
    }
  });

  it('picks the right tile near the corners of a diamond', () => {
    const c = tileToWorld(5, 5);
    expect(worldToTile(c.x, c.y - TILE_H / 2 + 2)).toEqual({ x: 5, y: 5 }); // just below the top corner
    expect(worldToTile(c.x + TILE_W / 2 - 4, c.y)).toEqual({ x: 5, y: 5 }); // just inside the right corner
    expect(worldToTile(c.x, c.y - TILE_H / 2 - 2)).toEqual({ x: 4, y: 4 }); // just above: the tile behind
  });

  it('draws joined-up lines between tiles', () => {
    const line = tileLine(0, 0, 4, 2);
    expect(line[0]).toEqual({ x: 0, y: 0 });
    expect(line[line.length - 1]).toEqual({ x: 4, y: 2 });
    expect(line).toHaveLength(7);
    for (let i = 1; i < line.length; i++) {
      const step = Math.abs(line[i].x - line[i - 1].x) + Math.abs(line[i].y - line[i - 1].y);
      expect(step).toBe(1);
    }
    expect(tileLine(3, 3, 3, 3)).toEqual([{ x: 3, y: 3 }]);
    expect(tileLine(2, 5, 2, 1)).toHaveLength(5);
  });

  it('puts the map corners on the outside corners of the corner tiles', () => {
    const corners = mapCorners(64);
    expect(corners.top).toEqual({ x: 0, y: tileToWorld(0, 0).y - TILE_H / 2 });
    expect(corners.bottom).toEqual({ x: 0, y: tileToWorld(63, 63).y + TILE_H / 2 });
    expect(corners.left.x).toBe(tileToWorld(0, 63).x - TILE_W / 2);
    expect(corners.right.x).toBe(tileToWorld(63, 0).x + TILE_W / 2);
  });
});
