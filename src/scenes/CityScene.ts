import Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { ART_SCALE, COLORS, MAX_ZOOM, MIN_ZOOM } from '../config';
import { mapCorners, tileLine, tileToWorld, worldToTile, type Point } from '../render/iso';
import { createTextures, textureOriginY, tileTexture } from '../render/textures';
import type { City, Tool } from '../sim/city';
import { formatRupees } from '../sim/format';
import type { Hud } from '../ui/hud';

/** How far (in CSS pixels) a finger has to move before a tap turns into a drag. */
const DRAG_THRESHOLD = 10;

/** Drawing order. Tiles use x + y (0 to 126); everything else sits below or above them. */
const DEPTH = { island: -10, cloudShadows: 5_000, clouds: 9_000, effects: 9_200, cursor: 9_500 };

interface PaintStroke {
  kind: 'paint';
  startX: number;
  startY: number;
  /** The tile the drag last reached, or null while it's still just a tap. */
  last: Point | null;
  lastBuilt: Point | null;
  spent: number;
  built: number;
  /** Only one "you can't do that" message per stroke. */
  warned: boolean;
}

type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; lastX: number; lastY: number }
  | PaintStroke
  | { kind: 'pinch'; startDistance: number; startZoom: number; lastMid: Point }
  | { kind: 'wait' }; // after a pinch, ignore fingers until they've all lifted

interface Cloud {
  cloud: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  speed: number;
}

export class CityScene extends Phaser.Scene {
  private readonly city: City;
  private readonly hud: Hud;
  private tool: Tool = 'pan';
  private gesture: Gesture = { kind: 'none' };
  private readonly tiles: Phaser.GameObjects.Image[] = [];
  private readonly waterTiles: Point[] = [];
  private readonly clouds: Cloud[] = [];
  private cursor!: Phaser.GameObjects.Image;
  /** The zoom the player chose; the camera's real zoom also allows for screen sharpness. */
  private userZoom = 1;
  private bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  private lastSoundAt = 0;

  constructor(city: City, hud: Hud) {
    super('city');
    this.city = city;
    this.hud = hud;
  }

  create(): void {
    createTextures(this);
    this.drawIsland();
    this.createTiles();
    this.createClouds();

    this.cursor = this.add.image(0, 0, 'cursor').setDepth(DEPTH.cursor).setVisible(false);
    this.tweens.add({ targets: this.cursor, alpha: 0.55, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 200, loop: true, callback: () => this.twinkleWater() });

    this.setUpCamera();
    this.setUpInput();

    this.city.onChange((x, y) => this.onTileChanged(x, y));
    this.hud.onToolChange = (tool) => this.setTool(tool);
    this.hud.setMoney(this.city.money);

    if (new URLSearchParams(window.location.search).has('demo')) this.buildDemo();
  }

  update(_time: number, delta: number): void {
    // Clouds drift slowly east, and fade away when you zoom in close.
    const fade = Phaser.Math.Clamp((1.4 - this.userZoom) / 0.6, 0, 1);
    for (const c of this.clouds) {
      c.cloud.x += (c.speed * delta) / 1000;
      if (c.cloud.x > this.bounds.right + 300) c.cloud.x = this.bounds.left - 300;
      c.shadow.setPosition(c.cloud.x + 60, c.cloud.y + 220);
      c.cloud.setAlpha(0.8 * fade);
    }
  }

  private setTool(tool: Tool): void {
    this.tool = tool;
    this.cursor.setVisible(false);
  }

  // ---- the map ----

  /** The map sits on a little slab of earth, like a toy diorama. */
  private drawIsland(): void {
    const c = mapCorners(this.city.size);
    const v = (p: Point, drop = 0) => new Phaser.Math.Vector2(p.x, p.y + drop);
    const thickness = 56;
    const g = this.add.graphics().setDepth(DEPTH.island);
    g.fillStyle(0x6b4a2b, 0.1);
    g.fillEllipse(0, (c.top.y + c.bottom.y) / 2 + 120, (c.right.x - c.left.x) * 1.04, (c.bottom.y - c.top.y) * 1.04);
    g.fillStyle(COLORS.islandLight, 1);
    g.fillPoints([v(c.left), v(c.bottom), v(c.bottom, thickness), v(c.left, thickness)], true);
    g.fillStyle(COLORS.islandDark, 1);
    g.fillPoints([v(c.bottom), v(c.right), v(c.right, thickness), v(c.bottom, thickness)], true);
    g.fillStyle(COLORS.grassDark, 1);
    g.fillPoints([v(c.left), v(c.bottom), v(c.bottom, 10), v(c.left, 10)], true);
    g.fillPoints([v(c.bottom), v(c.right), v(c.right, 10), v(c.bottom, 10)], true);
  }

  private createTiles(): void {
    const { size } = this.city;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = tileToWorld(x, y);
        const key = tileTexture(this.city, x, y);
        this.tiles.push(this.add.image(p.x, p.y, key).setOrigin(0.5, textureOriginY(key)).setDepth(x + y));
        if (this.city.get(x, y) === 'water') this.waterTiles.push({ x, y });
      }
    }
  }

  /** Picks tile (x, y)'s picture again after it, or a neighbour, changed. */
  private repaint(x: number, y: number): void {
    if (!this.city.inBounds(x, y)) return;
    const key = tileTexture(this.city, x, y);
    this.tiles[y * this.city.size + x].setTexture(key).setOrigin(0.5, textureOriginY(key));
  }

  private onTileChanged(x: number, y: number): void {
    this.repaint(x, y);
    // Neighbours may need a new road joint or shoreline.
    this.repaint(x, y - 1);
    this.repaint(x + 1, y);
    this.repaint(x, y + 1);
    this.repaint(x - 1, y);
    this.hud.setMoney(this.city.money);
  }

  private createClouds(): void {
    const c = mapCorners(this.city.size);
    for (let i = 0; i < 6; i++) {
      const x = between(c.left.x, c.right.x);
      const y = between(c.top.y, c.bottom.y);
      const scale = between(1.2, 2.2);
      const shadow = this.add
        .image(x + 60, y + 220, 'cloud')
        .setScale(scale)
        .setTint(0x2c4a3a)
        .setAlpha(0.1)
        .setDepth(DEPTH.cloudShadows);
      const cloud = this.add.image(x, y, 'cloud').setScale(scale).setAlpha(0.8).setDepth(DEPTH.clouds);
      this.clouds.push({ cloud, shadow, speed: between(10, 24) });
    }
  }

  private twinkleWater(): void {
    if (this.waterTiles.length === 0) return;
    const tile = this.waterTiles[Math.floor(Math.random() * this.waterTiles.length)];
    const p = tileToWorld(tile.x, tile.y);
    const spark = this.add
      .image(p.x + between(-30, 30), p.y + between(-10, 10), 'spark')
      .setScale(0)
      .setDepth(tile.x + tile.y + 0.5);
    this.tweens.add({
      targets: spark,
      scale: 0.6,
      duration: 450,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onComplete: () => spark.destroy(),
    });
  }

  // ---- camera ----

  private setUpCamera(): void {
    const c = mapCorners(this.city.size);
    this.bounds = { left: c.left.x, right: c.right.x, top: c.top.y, bottom: c.bottom.y };
    const shortSide = Math.min(this.scale.width, this.scale.height) * this.scale.zoom; // in CSS pixels
    this.userZoom = Phaser.Math.Clamp(shortSide / 800, 0.45, 1.1);
    this.applyZoom();
    const middle = tileToWorld(this.city.size / 2, this.city.size / 2);
    this.cameras.main.centerOn(middle.x, middle.y);
    this.scale.on('resize', () => {
      this.applyZoom();
      this.clampCamera();
    });
  }

  /** Camera zoom = the player's zoom × screen sharpness ÷ the size the art is drawn at. */
  private applyZoom(): void {
    const pixelRatio = 1 / this.scale.zoom;
    this.cameras.main.setZoom((this.userZoom * pixelRatio) / ART_SCALE);
  }

  /** Zooms so the world point under screen point `from` ends up under `to` (pass the same point to zoom in place). */
  private zoomAt(from: Point, to: Point, userZoom: number): void {
    const anchor = this.screenToWorld(from.x, from.y);
    this.userZoom = Phaser.Math.Clamp(userZoom, MIN_ZOOM, MAX_ZOOM);
    this.applyZoom();
    const cam = this.cameras.main;
    cam.scrollX = anchor.x - cam.width / 2 - (to.x - cam.width / 2) / cam.zoom;
    cam.scrollY = anchor.y - cam.height / 2 - (to.y - cam.height / 2) / cam.zoom;
    this.clampCamera();
  }

  /** Keeps the middle of the screen over the map, so you can't get lost in the sky. */
  private clampCamera(): void {
    const cam = this.cameras.main;
    const x = Phaser.Math.Clamp(cam.scrollX + cam.width / 2, this.bounds.left, this.bounds.right);
    const y = Phaser.Math.Clamp(cam.scrollY + cam.height / 2, this.bounds.top, this.bounds.bottom);
    cam.scrollX = x - cam.width / 2;
    cam.scrollY = y - cam.height / 2;
  }

  private screenToWorld(sx: number, sy: number): Point {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom,
    };
  }

  private tileAt(sx: number, sy: number): Point {
    const world = this.screenToWorld(sx, sy);
    return worldToTile(world.x, world.y);
  }

  // ---- touch and mouse ----

  private setUpInput(): void {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.on('wheel', this.onWheel, this);
    this.input.on('gameout', () => this.cursor.setVisible(false));
  }

  private pressedPointers(): Phaser.Input.Pointer[] {
    return this.input.manager.pointers.filter((pointer) => pointer.isDown);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const pressed = this.pressedPointers();
    if (pressed.length >= 2) {
      // A second finger turns whatever was happening into a pinch.
      if (this.gesture.kind === 'paint') this.finishStroke(this.gesture);
      const [a, b] = pressed;
      this.gesture = { kind: 'pinch', startDistance: distance(a, b), startZoom: this.userZoom, lastMid: midpoint(a, b) };
      return;
    }
    if (this.tool === 'pan' || pointer.rightButtonDown() || pointer.middleButtonDown()) {
      this.gesture = { kind: 'pan', lastX: pointer.x, lastY: pointer.y };
    } else {
      this.gesture = {
        kind: 'paint',
        startX: pointer.x,
        startY: pointer.y,
        last: null,
        lastBuilt: null,
        spent: 0,
        built: 0,
        warned: false,
      };
    }
    this.cursor.setVisible(false);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    switch (gesture.kind) {
      case 'pinch': {
        const pressed = this.pressedPointers();
        if (pressed.length < 2 || gesture.startDistance === 0) return;
        const [a, b] = pressed;
        const mid = midpoint(a, b);
        this.zoomAt(gesture.lastMid, mid, gesture.startZoom * (distance(a, b) / gesture.startDistance));
        gesture.lastMid = mid;
        return;
      }
      case 'pan': {
        if (!pointer.isDown) return;
        const cam = this.cameras.main;
        cam.scrollX -= (pointer.x - gesture.lastX) / cam.zoom;
        cam.scrollY -= (pointer.y - gesture.lastY) / cam.zoom;
        gesture.lastX = pointer.x;
        gesture.lastY = pointer.y;
        this.clampCamera();
        return;
      }
      case 'paint': {
        if (!pointer.isDown) return;
        if (gesture.last === null) {
          const moved = Math.hypot(pointer.x - gesture.startX, pointer.y - gesture.startY) * this.scale.zoom;
          if (moved < DRAG_THRESHOLD) return;
          gesture.last = this.tileAt(gesture.startX, gesture.startY);
          this.build(gesture, gesture.last);
        }
        const here = this.tileAt(pointer.x, pointer.y);
        if (here.x !== gesture.last.x || here.y !== gesture.last.y) {
          for (const tile of tileLine(gesture.last.x, gesture.last.y, here.x, here.y).slice(1)) this.build(gesture, tile);
          gesture.last = here;
        }
        this.showCursor(here, false);
        return;
      }
      case 'none':
        this.hover(pointer);
        return;
      case 'wait':
        return;
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const gesture = this.gesture;
    if (gesture.kind === 'paint') {
      if (gesture.last === null) this.build(gesture, this.tileAt(gesture.startX, gesture.startY)); // it was a tap
      this.finishStroke(gesture);
    }
    if (pointer.wasTouch) this.cursor.setVisible(false);
    this.gesture = this.pressedPointers().length > 0 ? { kind: 'wait' } : { kind: 'none' };
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _deltaX: number, deltaY: number): void {
    const at = { x: pointer.x, y: pointer.y };
    this.zoomAt(at, at, this.userZoom * Math.exp(-deltaY * 0.0015));
  }

  /** With a mouse, show which tile you're pointing at, and tint it red if the tool can't go there. */
  private hover(pointer: Phaser.Input.Pointer): void {
    const tool = this.tool;
    const tile = this.tileAt(pointer.x, pointer.y);
    if (tool === 'pan' || pointer.wasTouch || !this.city.inBounds(tile.x, tile.y)) {
      this.cursor.setVisible(false);
      return;
    }
    const attempt = this.city.check(tool, tile.x, tile.y);
    this.showCursor(tile, !attempt.ok && attempt.reason !== null);
  }

  private showCursor(tile: Point, bad: boolean): void {
    if (!this.city.inBounds(tile.x, tile.y)) {
      this.cursor.setVisible(false);
      return;
    }
    const p = tileToWorld(tile.x, tile.y);
    this.cursor.setTexture(bad ? 'cursor-bad' : 'cursor').setPosition(p.x, p.y).setVisible(true);
  }

  // ---- building, with a little celebration (or a gentle "no") ----

  private build(stroke: PaintStroke, tile: Point): void {
    const tool = this.tool;
    if (tool === 'pan') return;
    const attempt = this.city.apply(tool, tile.x, tile.y);
    if (attempt.ok) {
      stroke.spent += attempt.cost;
      stroke.built += 1;
      stroke.lastBuilt = tile;
      if (tool === 'bulldoze') this.puff(tile);
      else this.sparkle(tile, stroke.built);
      return;
    }
    if (attempt.reason === null || stroke.warned) return;
    stroke.warned = true;
    this.hud.toast(attempt.reason, 'error');
    this.flash(tile, 'cursor-bad');
    sfx.bonk();
  }

  private finishStroke(stroke: PaintStroke): void {
    if (!stroke.lastBuilt || stroke.spent === 0) return;
    this.floatText(stroke.lastBuilt, `-${formatRupees(stroke.spent)}`);
    sfx.coin();
  }

  private sparkle(tile: Point, step: number): void {
    const p = tileToWorld(tile.x, tile.y);
    this.flash(tile, 'cursor');
    for (let i = 0; i < 4; i++) {
      const star = this.add
        .image(p.x + between(-34, 34), p.y + between(-14, 10), 'spark')
        .setDepth(DEPTH.effects)
        .setScale(between(0.5, 0.9))
        .setTint(i % 2 === 0 ? 0xffffff : 0xfff2a8);
      this.tweens.add({
        targets: star,
        y: star.y - between(40, 80),
        scale: 0,
        duration: between(450, 750),
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
    this.playThrottled(() => sfx.pop(step - 1));
  }

  private puff(tile: Point): void {
    const p = tileToWorld(tile.x, tile.y);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const dust = this.add.image(p.x, p.y - 10, 'puff').setDepth(DEPTH.effects).setScale(0.6).setTint(0xf3e4cc);
      this.tweens.add({
        targets: dust,
        x: p.x + Math.cos(angle) * 56,
        y: p.y - 22 + Math.sin(angle) * 26,
        scale: 1.6,
        alpha: 0,
        duration: 560,
        ease: 'Cubic.easeOut',
        onComplete: () => dust.destroy(),
      });
    }
    this.playThrottled(() => sfx.poof());
  }

  private flash(tile: Point, key: 'cursor' | 'cursor-bad'): void {
    const p = tileToWorld(tile.x, tile.y);
    const flash = this.add.image(p.x, p.y, key).setDepth(DEPTH.effects).setAlpha(0.9);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.15,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private floatText(tile: Point, text: string): void {
    const p = tileToWorld(tile.x, tile.y);
    const label = this.add
      .text(p.x, p.y - 40, text, {
        fontFamily: '"Baloo 2", system-ui, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#e0862f',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.effects);
    this.tweens.add({
      targets: label,
      y: label.y - 90,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** Plays a sound unless one just played, so fast drags don't turn into noise. */
  private playThrottled(play: () => void): void {
    if (this.time.now - this.lastSoundAt < 45) return;
    this.lastSoundAt = this.time.now;
    play();
  }

  /** `?demo` in the address starts with a small neighbourhood already built. Handy for screenshots. */
  private buildDemo(): void {
    const c = Math.floor(this.city.size / 2) - 5;
    for (let i = 0; i < 11; i++) this.city.apply('road', c + i, c + 2);
    for (let i = 0; i < 9; i++) this.city.apply('road', c + 5, c - 2 + i);
    for (let i = 0; i < 5; i++) {
      this.city.apply('homes', c + i, c + 1);
      this.city.apply('shops', c + 6 + i, c + 1);
      this.city.apply('offices', c + i, c + 3);
      this.city.apply('homes', c + 6 + i, c + 3);
    }
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
