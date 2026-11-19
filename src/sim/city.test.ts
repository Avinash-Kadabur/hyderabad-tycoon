import { describe, expect, it } from 'vitest';
import { City, COSTS, DIR, OUT_OF_MONEY, type TileKind } from './city';

const KINDS: Record<string, TileKind> = {
  '.': 'grass',
  t: 'trees',
  '~': 'water',
  '^': 'rock',
  '#': 'road',
  h: 'homes',
  s: 'shops',
  o: 'offices',
};

/** Builds a small city from a picture, one string per row. */
function cityFrom(rows: string[], money = 100_000): City {
  const tiles = rows.flatMap((row) =>
    [...row].map((char) => {
      const kind = KINDS[char];
      if (!kind) throw new Error(`Unknown tile '${char}'`);
      return kind;
    }),
  );
  return new City(rows.length, tiles, money);
}

describe('City', () => {
  it('lays a road on grass and charges for it', () => {
    const city = cityFrom(['...', '...', '...']);
    expect(city.apply('road', 1, 1)).toEqual({ ok: true, cost: COSTS.road, result: 'road' });
    expect(city.get(1, 1)).toBe('road');
    expect(city.money).toBe(100_000 - COSTS.road);
  });

  it('clears trees when building on them', () => {
    const city = cityFrom(['t.', '..']);
    expect(city.apply('homes', 0, 0).ok).toBe(true);
    expect(city.get(0, 0)).toBe('homes');
  });

  it('refuses water and rocks with a friendly reason', () => {
    const city = cityFrom(['~^', '..']);
    const water = city.apply('road', 0, 0);
    const rocks = city.apply('shops', 1, 0);
    expect(water).toMatchObject({ ok: false, reason: expect.stringMatching(/water/i) });
    expect(rocks).toMatchObject({ ok: false, reason: expect.stringMatching(/rocks/i) });
    expect(city.money).toBe(100_000);
  });

  it('bulldozes boulders for a higher price', () => {
    const city = cityFrom(['^.', '..']);
    expect(city.apply('bulldoze', 0, 0)).toEqual({ ok: true, cost: COSTS.clearRocks, result: 'grass' });
    expect(city.apply('road', 0, 0).ok).toBe(true);
  });

  it('quietly ignores actions that would change nothing', () => {
    const city = cityFrom(['#h', '..']);
    expect(city.apply('road', 0, 0)).toEqual({ ok: false, reason: null });
    expect(city.apply('homes', 1, 0)).toEqual({ ok: false, reason: null });
    expect(city.apply('bulldoze', 0, 1)).toEqual({ ok: false, reason: null });
    expect(city.apply('road', 5, 5)).toEqual({ ok: false, reason: null });
    expect(city.money).toBe(100_000);
  });

  it('lets you rezone, but not lay roads over zones', () => {
    const city = cityFrom(['h.', '..']);
    expect(city.apply('shops', 0, 0).ok).toBe(true);
    expect(city.get(0, 0)).toBe('shops');
    expect(city.apply('road', 0, 0).ok).toBe(false);
  });

  it('stops when the money runs out', () => {
    const city = cityFrom(['..', '..'], COSTS.road + 100);
    expect(city.apply('road', 0, 0).ok).toBe(true);
    expect(city.apply('road', 1, 0)).toEqual({ ok: false, reason: OUT_OF_MONEY });
    expect(city.get(1, 0)).toBe('grass');
    expect(city.money).toBe(100);
  });

  it('knows which neighbours are roads', () => {
    const city = cityFrom(['.#.', '###', '...']);
    const isRoad = (kind: TileKind) => kind === 'road';
    expect(city.neighbourMask(1, 1, isRoad)).toBe(DIR.N | DIR.E | DIR.W);
    expect(city.neighbourMask(0, 0, isRoad)).toBe(DIR.E | DIR.S);
  });

  it('tells listeners which tile changed', () => {
    const city = cityFrom(['..', '..']);
    const changes: string[] = [];
    const stop = city.onChange((x, y) => changes.push(`${x},${y}`));
    city.apply('road', 1, 0);
    stop();
    city.apply('road', 0, 1);
    expect(changes).toEqual(['1,0']);
  });

  it('starts a new game with ₹10 lakh on generated land', () => {
    const city = City.create();
    expect(city.money).toBe(10_00_000);
    expect(city.size).toBe(64);
  });
});
