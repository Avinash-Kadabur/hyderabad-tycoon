/** The map is MAP_SIZE × MAP_SIZE tiles. */
export const MAP_SIZE = 64;
/** Seed for the starting land: 1591, the year Charminar was built. */
export const MAP_SEED = 1591;

/**
 * All art and world positions are drawn at 2x so they stay sharp on phone screens;
 * the camera scales the world back down by this much.
 */
export const ART_SCALE = 2;

/** Tiles are 2:1 diamonds, in world pixels. */
export const TILE_W = 128;
export const TILE_H = 64;
/** Room above a tile's diamond for things that stick up: trees, boulders and, later, buildings. */
export const TILE_TALL = 64;

/** ₹10 lakh to start. */
export const START_MONEY = 10_00_000;

/** How far players can zoom out and in (at 1, a tile is 64 screen pixels wide). */
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 2;

/** The pastel palette, shared by the map art and the toolbar. */
export const COLORS = {
  grass: [0xa8d86e, 0xb2dd78, 0x9dd165],
  grassDark: 0x7fb84f,
  treeLeaf: [0x6cc06a, 0x82cc66, 0x5bb562],
  trunk: 0xa8774f,
  water: 0x8dd4f5,
  waterLight: 0xd2f1fd,
  sand: 0xf7e6b8,
  rock: 0xddd0bf,
  rockLight: 0xf3ebe0,
  rockDark: 0xb6a593,
  road: 0x9ba1b8,
  roadEdge: 0xe2dfea,
  roadLine: 0xffffff,
  homes: 0xffb38a,
  shops: 0x8cc8ff,
  offices: 0xc5a8ff,
  islandLight: 0xd3a676,
  islandDark: 0xb7895b,
} as const;
