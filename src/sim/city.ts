import { MAP_SEED, MAP_SIZE, START_MONEY } from '../config';
import { formatRupees } from './format';
import { generateTerrain } from './terrain';

export type Zone = 'homes' | 'shops' | 'offices';
export type TileKind = 'grass' | 'trees' | 'water' | 'rock' | 'road' | Zone;
export type BuildTool = 'road' | Zone | 'bulldoze';
export type Tool = 'pan' | BuildTool;

/** What each action costs, in rupees. */
export const COSTS = {
  road: 2_000,
  zone: 500,
  bulldoze: 200,
  clearRocks: 5_000,
} as const;

export const OUT_OF_MONEY = 'Out of rupees! 💸';

/** Neighbour directions, as bits: N is the tile at y - 1, E at x + 1, S at y + 1, W at x - 1. */
export const DIR = { N: 1, E: 2, S: 4, W: 8 } as const;

/** The result of trying a tool on a tile. A `null` reason means "nothing to do here", which is ignored quietly. */
export type Attempt = { ok: true; cost: number; result: TileKind } | { ok: false; reason: string | null };

const NOTHING_TO_DO: Attempt = { ok: false, reason: null };

export class City {
  readonly size: number;
  private readonly tiles: TileKind[];
  private cash: number;
  private readonly listeners = new Set<(x: number, y: number) => void>();

  constructor(size: number, tiles: TileKind[], money: number) {
    if (tiles.length !== size * size) {
      throw new Error(`A ${size}×${size} city needs ${size * size} tiles, got ${tiles.length}`);
    }
    this.size = size;
    this.tiles = tiles;
    this.cash = money;
  }

  /** A brand-new city on freshly generated land. */
  static create(size = MAP_SIZE, seed = MAP_SEED, money = START_MONEY): City {
    return new City(size, generateTerrain(size, seed), money);
  }

  get money(): number {
    return this.cash;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  /** The tile at (x, y), or undefined off the edge of the map. */
  get(x: number, y: number): TileKind | undefined {
    return this.inBounds(x, y) ? this.tiles[y * this.size + x] : undefined;
  }

  /** Bit mask (see DIR) of the four neighbours that pass `test`. Off-map neighbours never pass. */
  neighbourMask(x: number, y: number, test: (kind: TileKind) => boolean): number {
    let mask = 0;
    const check = (nx: number, ny: number, bit: number) => {
      const kind = this.get(nx, ny);
      if (kind !== undefined && test(kind)) mask |= bit;
    };
    check(x, y - 1, DIR.N);
    check(x + 1, y, DIR.E);
    check(x, y + 1, DIR.S);
    check(x - 1, y, DIR.W);
    return mask;
  }

  /** What using `tool` on (x, y) would do and cost, without doing it. */
  check(tool: BuildTool, x: number, y: number): Attempt {
    const kind = this.get(x, y);
    if (kind === undefined) return NOTHING_TO_DO;

    if (tool === 'bulldoze') {
      if (kind === 'grass') return NOTHING_TO_DO;
      if (kind === 'water') return { ok: false, reason: "You can't bulldoze water! 🌊" };
      return { ok: true, cost: kind === 'rock' ? COSTS.clearRocks : COSTS.bulldoze, result: 'grass' };
    }

    if (kind === tool) return NOTHING_TO_DO;
    if (kind === 'water') return { ok: false, reason: "That's water! 🌊 Bridges come later." };
    if (kind === 'rock') {
      return { ok: false, reason: `Big Deccan rocks! 🪨 Bulldoze them first (${formatRupees(COSTS.clearRocks)}).` };
    }
    if (tool === 'road') {
      if (kind !== 'grass' && kind !== 'trees') return { ok: false, reason: 'Bulldoze this zone first to lay a road.' };
      return { ok: true, cost: COSTS.road, result: 'road' };
    }
    if (kind === 'road') return { ok: false, reason: "That's a road! Zone the land next to it." };
    return { ok: true, cost: COSTS.zone, result: tool };
  }

  /** Uses `tool` on (x, y) if it's allowed and affordable. */
  apply(tool: BuildTool, x: number, y: number): Attempt {
    const attempt = this.check(tool, x, y);
    if (!attempt.ok) return attempt;
    if (attempt.cost > this.cash) return { ok: false, reason: OUT_OF_MONEY };
    this.cash -= attempt.cost;
    this.tiles[y * this.size + x] = attempt.result;
    for (const listener of this.listeners) listener(x, y);
    return attempt;
  }

  /** Calls `listener(x, y)` after a tile (and the money) changes. Returns a function that stops listening. */
  onChange(listener: (x: number, y: number) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
