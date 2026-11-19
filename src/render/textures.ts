import Phaser from 'phaser';
import { COLORS, TILE_H, TILE_TALL, TILE_W } from '../config';
import { DIR, type City } from '../sim/city';
import { createRng } from '../sim/rng';

type G = Phaser.GameObjects.Graphics;
type Draw = (g: G, cy: number) => void;
type Icon = (g: G, x: number, y: number, detail: number) => void;

const PAD = 2;
const TEX_W = TILE_W + PAD * 2;
const CX = TEX_W / 2;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
/** Ground is drawn this much bigger than a tile, so neighbours overlap and no hairline gaps show. */
const GROW = 1.5;
/** Half-widths of a road and its kerb, in tile units. */
const ROAD = 0.25;
const KERB = 0.31;
/** Width of a sandy bank, in tile units. */
const BANK = 0.13;

const origins = new Map<string, number>();

/** The vertical origin that lines a texture's diamond up with its tile's position. */
export function textureOriginY(key: string): number {
  return origins.get(key) ?? 0.5;
}

/** The texture to show for tile (x, y), picked from what's there and what's next to it. */
export function tileTexture(city: City, x: number, y: number): string {
  const kind = city.get(x, y);
  switch (kind) {
    case undefined:
      return 'grass-0';
    case 'grass':
      return `grass-${variant(x, y, 3)}`;
    case 'trees':
      return `trees-${variant(x, y, 3)}`;
    case 'rock':
      return `rock-${variant(x, y, 2)}`;
    case 'road':
      return `road-${city.neighbourMask(x, y, (k) => k === 'road')}`;
    case 'water':
      return `water-${city.neighbourMask(x, y, (k) => k !== 'water')}`;
    default:
      return kind;
  }
}

/** Draws every picture the game uses, once, at start-up. No image files needed. */
export function createTextures(scene: Phaser.Scene): void {
  for (let i = 0; i < 3; i++) {
    flat(scene, `grass-${i}`, (g, cy) => drawGrass(g, cy, i));
    tall(scene, `trees-${i}`, (g, cy) => drawTrees(g, cy, i));
  }
  tall(scene, 'rock-0', (g, cy) => drawRocks(g, cy, 1));
  tall(scene, 'rock-1', (g, cy) => drawRocks(g, cy, -1));
  for (let mask = 0; mask < 16; mask++) {
    flat(scene, `road-${mask}`, (g, cy) => drawRoad(g, cy, mask));
    flat(scene, `water-${mask}`, (g, cy) => drawWater(g, cy, mask));
  }
  flat(scene, 'homes', (g, cy) => drawZone(g, cy, COLORS.homes, drawHouse));
  flat(scene, 'shops', (g, cy) => drawZone(g, cy, COLORS.shops, drawShop));
  flat(scene, 'offices', (g, cy) => drawZone(g, cy, COLORS.offices, drawOffice));
  flat(scene, 'cursor', (g, cy) => drawCursor(g, cy, 0xffffff));
  flat(scene, 'cursor-bad', (g, cy) => drawCursor(g, cy, 0xff6b6b));
  bake(scene, 'spark', 32, 32, drawSpark);
  bake(scene, 'puff', 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 15);
  });
  bake(scene, 'cloud', 240, 120, drawCloud);
}

// ---- baking ----

/** A tile picture that lies flat on the ground. */
function flat(scene: Phaser.Scene, key: string, draw: Draw): void {
  const height = TILE_H + PAD * 2;
  const cy = PAD + HALF_H;
  origins.set(key, cy / height);
  bake(scene, key, TEX_W, height, (g) => draw(g, cy));
}

/** A tile picture with room above the ground for things that stick up. */
function tall(scene: Phaser.Scene, key: string, draw: Draw): void {
  const height = TILE_TALL + TILE_H + PAD * 2;
  const cy = PAD + TILE_TALL + HALF_H;
  origins.set(key, cy / height);
  bake(scene, key, TEX_W, height, (g) => draw(g, cy));
}

function bake(scene: Phaser.Scene, key: string, width: number, height: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

// ---- helpers ----

/**
 * A point on a tile, in tile units: u runs towards the east neighbour and v towards the south one,
 * each from -0.5 to 0.5, with (0, 0) in the middle. `grow` pushes the point outwards by about that many pixels.
 */
function at(cy: number, u: number, v: number, grow = 0): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2(CX + (u - v) * (HALF_W + grow), cy + (u + v) * (HALF_H + grow / 2));
}

/** Fills the part of the tile between u0..u1 and v0..v1. */
function patch(g: G, cy: number, u0: number, u1: number, v0: number, v1: number, color: number, alpha = 1, grow = 0): void {
  g.fillStyle(color, alpha);
  g.fillPoints([at(cy, u0, v0, grow), at(cy, u1, v0, grow), at(cy, u1, v1, grow), at(cy, u0, v1, grow)], true);
}

function ground(g: G, cy: number, color: number): void {
  patch(g, cy, -0.5, 0.5, -0.5, 0.5, color, 1, GROW);
}

function line(g: G, cy: number, u0: number, v0: number, u1: number, v1: number): void {
  const a = at(cy, u0, v0);
  const b = at(cy, u1, v1);
  g.lineBetween(a.x, a.y, b.x, b.y);
}

/** Picks one of `count` looks for a tile, so a field of grass doesn't look copy-pasted. */
function variant(x: number, y: number, count: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % count;
}

/** Darkens (factor < 1) or lightens (factor > 1) a colour. */
function shade(color: number, factor: number): number {
  const channel = (shift: number) => Math.min(255, Math.round(((color >> shift) & 0xff) * factor));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// ---- nature ----

function drawGrass(g: G, cy: number, look: number): void {
  ground(g, cy, COLORS.grass[look]);
  const rng = createRng(11 + look);
  g.lineStyle(3, COLORS.grassDark, 0.9);
  for (let i = 0; i < 4; i++) {
    const p = at(cy, rng() * 0.6 - 0.3, rng() * 0.6 - 0.3);
    g.lineBetween(p.x - 5, p.y, p.x - 7, p.y - 7);
    g.lineBetween(p.x, p.y, p.x, p.y - 9);
    g.lineBetween(p.x + 5, p.y, p.x + 7, p.y - 7);
  }
  if (look === 0) return;
  // Little flowers: white daisies on some tiles, pink ones on others.
  const petals = look === 1 ? 0xffffff : 0xffb8cc;
  for (let i = 0; i < 3; i++) {
    const p = at(cy, rng() * 0.6 - 0.3, rng() * 0.6 - 0.3);
    g.fillStyle(petals, 1);
    for (let k = 0; k < 4; k++) {
      g.fillCircle(p.x + Math.cos((k * Math.PI) / 2) * 3, p.y + Math.sin((k * Math.PI) / 2) * 3, 2.6);
    }
    g.fillStyle(0xffd447, 1);
    g.fillCircle(p.x, p.y, 2);
  }
}

function drawTrees(g: G, cy: number, look: number): void {
  ground(g, cy, COLORS.grass[look]);
  const rng = createRng(31 + look);
  const spots = [
    [-0.2, -0.15],
    [0.18, -0.05],
    [-0.05, 0.2],
  ].slice(0, 2 + (look % 2));
  const trees = spots.map(([u, v]) => ({
    p: at(cy, u + (rng() - 0.5) * 0.1, v + (rng() - 0.5) * 0.1),
    size: 13 + rng() * 5,
    leaf: COLORS.treeLeaf[Math.floor(rng() * 3)],
  }));
  trees.sort((a, b) => a.p.y - b.p.y); // farther trees first, so nearer ones overlap them
  for (const tree of trees) drawTree(g, tree.p.x, tree.p.y, tree.size, tree.leaf);
}

/** A round, fluffy tree standing at (x, y). */
function drawTree(g: G, x: number, y: number, size: number, leaf: number): void {
  g.fillStyle(0x2f5b2a, 0.18);
  g.fillEllipse(x + 2, y + 2, size * 1.9, size * 0.8);
  g.fillStyle(COLORS.trunk, 1);
  g.fillRoundedRect(x - size * 0.14, y - size, size * 0.28, size, 3);
  g.fillStyle(shade(leaf, 0.85), 1);
  g.fillCircle(x - size * 0.5, y - size * 1.2, size * 0.6);
  g.fillCircle(x + size * 0.5, y - size * 1.2, size * 0.6);
  g.fillStyle(leaf, 1);
  g.fillCircle(x, y - size * 1.6, size * 0.8);
  g.fillCircle(x - size * 0.42, y - size * 1.35, size * 0.55);
  g.fillCircle(x + size * 0.42, y - size * 1.35, size * 0.55);
  g.fillStyle(0xffffff, 0.3);
  g.fillCircle(x - size * 0.25, y - size * 1.85, size * 0.22);
}

/** A pile of rounded Deccan boulders, with one balanced on top. `side` mirrors the pile. */
function drawRocks(g: G, cy: number, side: number): void {
  ground(g, cy, COLORS.grass[0]);
  g.fillStyle(0x2f5b2a, 0.18);
  g.fillEllipse(CX, cy + 4, 92, 34);
  boulder(g, CX - 20 * side, cy - 4, 54, 40);
  boulder(g, CX + 22 * side, cy + 2, 42, 32);
  boulder(g, CX + 2 * side, cy - 32, 40, 32);
}

function boulder(g: G, x: number, y: number, width: number, height: number): void {
  g.fillStyle(COLORS.rockDark, 1);
  g.fillEllipse(x, y + height * 0.08, width, height);
  g.fillStyle(COLORS.rock, 1);
  g.fillEllipse(x - width * 0.05, y - height * 0.04, width * 0.9, height * 0.86);
  g.fillStyle(COLORS.rockLight, 1);
  g.fillEllipse(x - width * 0.2, y - height * 0.22, width * 0.32, height * 0.22);
}

/** Water, with a sandy bank and a line of foam on each side that touches dry land. */
function drawWater(g: G, cy: number, shore: number): void {
  ground(g, cy, COLORS.water);
  g.lineStyle(3, COLORS.waterLight, 0.9);
  g.lineBetween(CX - 20, cy - 5, CX - 6, cy - 5);
  g.lineBetween(CX + 4, cy + 6, CX + 18, cy + 6);

  if (shore & DIR.N) patch(g, cy, -0.5, 0.5, -0.5, -0.5 + BANK, COLORS.sand, 1, GROW);
  if (shore & DIR.E) patch(g, cy, 0.5 - BANK, 0.5, -0.5, 0.5, COLORS.sand, 1, GROW);
  if (shore & DIR.S) patch(g, cy, -0.5, 0.5, 0.5 - BANK, 0.5, COLORS.sand, 1, GROW);
  if (shore & DIR.W) patch(g, cy, -0.5, -0.5 + BANK, -0.5, 0.5, COLORS.sand, 1, GROW);

  const foam = 0.5 - BANK;
  g.lineStyle(3, 0xffffff, 0.85);
  if (shore & DIR.N) line(g, cy, -0.5, -foam, 0.5, -foam);
  if (shore & DIR.E) line(g, cy, foam, -0.5, foam, 0.5);
  if (shore & DIR.S) line(g, cy, -0.5, foam, 0.5, foam);
  if (shore & DIR.W) line(g, cy, -foam, -0.5, -foam, 0.5);
}

// ---- things players build ----

/** A road that joins up with the roads next to it (`mask` says which sides, see DIR). */
function drawRoad(g: G, cy: number, mask: number): void {
  ground(g, cy, COLORS.grass[0]);
  const arms = mask === 0 ? DIR.E | DIR.W : mask; // a lone road tile looks like a short straight piece
  const layers: [number, number][] = [
    [KERB, COLORS.roadEdge],
    [ROAD, COLORS.road],
  ];
  for (const [w, color] of layers) {
    patch(g, cy, -w, w, -w, w, color);
    if (arms & DIR.N) patch(g, cy, -w, w, -0.5, 0, color, 1, GROW);
    if (arms & DIR.E) patch(g, cy, 0, 0.5, -w, w, color, 1, GROW);
    if (arms & DIR.S) patch(g, cy, -w, w, 0, 0.5, color, 1, GROW);
    if (arms & DIR.W) patch(g, cy, -0.5, 0, -w, w, color, 1, GROW);
  }
  g.lineStyle(3, COLORS.roadLine, 0.9);
  if (arms & DIR.N) line(g, cy, 0, -0.12, 0, -0.36);
  if (arms & DIR.E) line(g, cy, 0.12, 0, 0.36, 0);
  if (arms & DIR.S) line(g, cy, 0, 0.12, 0, 0.36);
  if (arms & DIR.W) line(g, cy, -0.12, 0, -0.36, 0);
}

/** Zoned land: a pastel plot with a little sign saying what it's for. */
function drawZone(g: G, cy: number, color: number, icon: Icon): void {
  ground(g, cy, COLORS.grass[0]);
  const s = 0.4;
  patch(g, cy, -s, s, -s, s, color, 0.9);
  g.lineStyle(3, shade(color, 0.82), 1);
  g.strokePoints([at(cy, -s, -s), at(cy, s, -s), at(cy, s, s), at(cy, -s, s)], true, true);
  icon(g, CX, cy, shade(color, 0.72));
}

function drawHouse(g: G, x: number, y: number, detail: number): void {
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(x - 10, y - 5, 20, 14, 3);
  g.fillTriangle(x - 14, y - 4, x, y - 16, x + 14, y - 4);
  g.fillStyle(detail, 1);
  g.fillRoundedRect(x - 3, y + 1, 6, 8, 2);
}

function drawShop(g: G, x: number, y: number, detail: number): void {
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(x - 11, y - 4, 22, 13, 3);
  for (let i = 0; i < 4; i++) {
    g.fillStyle(i % 2 === 0 ? detail : 0xffffff, 1);
    g.fillRoundedRect(x - 13 + i * 6.5, y - 11, 6.5, 7, 2);
  }
  g.fillStyle(detail, 1);
  g.fillRect(x - 7, y + 1, 6, 5);
}

function drawOffice(g: G, x: number, y: number, detail: number): void {
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(x - 8, y - 16, 16, 25, 3);
  g.fillStyle(detail, 1);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) g.fillRect(x - 5 + col * 6, y - 12 + row * 6, 4, 3);
  }
}

// ---- effects ----

function drawCursor(g: G, cy: number, color: number): void {
  const s = 0.47;
  const corners = [at(cy, -s, -s), at(cy, s, -s), at(cy, s, s), at(cy, -s, s)];
  g.fillStyle(color, 0.3);
  g.fillPoints(corners, true);
  g.lineStyle(4, color, 1);
  g.strokePoints(corners, true, true);
}

function drawSpark(g: G): void {
  g.fillStyle(0xffffff, 0.35);
  g.fillCircle(16, 16, 9);
  g.fillStyle(0xffffff, 1);
  const star = [
    [16, 1],
    [19.5, 12.5],
    [31, 16],
    [19.5, 19.5],
    [16, 31],
    [12.5, 19.5],
    [1, 16],
    [12.5, 12.5],
  ];
  g.fillPoints(
    star.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
    true,
  );
}

function drawCloud(g: G): void {
  g.fillStyle(0xffffff, 1);
  g.fillCircle(70, 70, 42);
  g.fillCircle(120, 55, 52);
  g.fillCircle(170, 72, 40);
  g.fillCircle(205, 85, 28);
  g.fillCircle(40, 90, 26);
  g.fillRoundedRect(30, 70, 190, 44, 22);
}
