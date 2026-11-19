import type { TileKind } from './city';
import { createRng } from './rng';

/**
 * The starting land: the Musi river winding across, two lakes, clumps of trees and the famous
 * Deccan boulders. The same seed always gives the same map.
 */
export function generateTerrain(size: number, seed: number): TileKind[] {
  const rng = createRng(seed);
  const tiles = new Array<TileKind>(size * size).fill('grass');
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size && y < size;
  const set = (x: number, y: number, kind: TileKind) => {
    if (inside(x, y)) tiles[y * size + x] = kind;
  };

  // The Musi: wanders from the west edge to the east edge, two tiles wide.
  let riverY = size * 0.6;
  let drift = 0;
  let previousRow = Math.round(riverY);
  for (let x = 0; x < size; x++) {
    drift = clamp(drift + (rng() - 0.5) * 0.35, -0.6, 0.6);
    riverY += drift;
    if (riverY < size * 0.48 || riverY > size * 0.72) {
      riverY = clamp(riverY, size * 0.48, size * 0.72);
      drift = -drift;
    }
    const row = Math.round(riverY);
    // Fill every row between this column and the last one so the water stays joined up.
    for (let y = Math.min(row, previousRow); y <= Math.max(row, previousRow) + 1; y++) set(x, y, 'water');
    previousRow = row;
  }

  // Lakes: a big one north of the river (our Hussain Sagar) and a small one to the west.
  const lake = (cx: number, cy: number, radius: number) => {
    const phase1 = rng() * Math.PI * 2;
    const phase2 = rng() * Math.PI * 2;
    const reach = Math.ceil(radius * 1.4);
    for (let y = Math.floor(cy) - reach; y <= Math.ceil(cy) + reach; y++) {
      for (let x = Math.floor(cx) - reach; x <= Math.ceil(cx) + reach; x++) {
        const angle = Math.atan2(y - cy, x - cx);
        const edge = radius * (1 + 0.18 * Math.sin(3 * angle + phase1) + 0.1 * Math.sin(5 * angle + phase2));
        if (Math.hypot(x - cx, y - cy) <= edge) set(x, y, 'water');
      }
    }
  };
  lake(size * 0.45, size * 0.28, 5.5);
  lake(size * 0.18, size * 0.36, 3);

  // Clumps of trees and boulders, only on open grass.
  const clump = (kind: TileKind, cx: number, cy: number, radius: number, density: number) => {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (!inside(x, y) || tiles[y * size + x] !== 'grass') continue;
        if (Math.hypot(x - cx, y - cy) <= radius && rng() < density) set(x, y, kind);
      }
    }
  };
  for (let i = 0; i < 16; i++) clump('trees', rng() * size, rng() * size, 1.5 + rng() * 2.5, 0.65);

  // Boulders everywhere except the middle of the map, where the camera starts.
  const middle = size / 2;
  for (let i = 0; i < 10; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const radius = 1 + rng() * 2;
    if (Math.hypot(cx - middle, cy - middle) < 9) continue;
    clump('rock', cx, cy, radius, 0.7);
  }
  return tiles;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
