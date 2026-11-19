import { TILE_H, TILE_W } from '../config';

export interface Point {
  x: number;
  y: number;
}

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

/** World-pixel centre of tile (tx, ty). Tile (0, 0) is the top corner of the map. */
export function tileToWorld(tx: number, ty: number): Point {
  return { x: (tx - ty) * HALF_W, y: (tx + ty) * HALF_H };
}

/** The tile under a world-pixel position (may be off the map). */
export function worldToTile(wx: number, wy: number): Point {
  const a = wx / HALF_W;
  const b = wy / HALF_H;
  return { x: Math.floor((a + b) / 2 + 0.5), y: Math.floor((b - a) / 2 + 0.5) };
}

/** The four corners of the whole map, in world pixels. */
export function mapCorners(size: number): { top: Point; right: Point; bottom: Point; left: Point } {
  return {
    top: { x: 0, y: -HALF_H },
    right: { x: size * HALF_W, y: (size - 1) * HALF_H },
    bottom: { x: 0, y: (2 * size - 1) * HALF_H },
    left: { x: -size * HALF_W, y: (size - 1) * HALF_H },
  };
}

/**
 * Tiles from (x0, y0) to (x1, y1), inclusive, stepping one side at a time (never diagonally),
 * so a road dragged at any angle still comes out joined up.
 */
export function tileLine(x0: number, y0: number, x1: number, y1: number): Point[] {
  const nx = Math.abs(x1 - x0);
  const ny = Math.abs(y1 - y0);
  const sx = Math.sign(x1 - x0);
  const sy = Math.sign(y1 - y0);
  const points: Point[] = [{ x: x0, y: y0 }];
  let x = x0;
  let y = y0;
  for (let ix = 0, iy = 0; ix < nx || iy < ny; ) {
    if ((1 + 2 * ix) * ny <= (1 + 2 * iy) * nx) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    points.push({ x, y });
  }
  return points;
}
