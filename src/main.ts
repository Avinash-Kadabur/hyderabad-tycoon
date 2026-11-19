import Phaser from 'phaser';
import { CityScene } from './scenes/CityScene';
import { City } from './sim/city';
import { Hud } from './ui/hud';

/** Draw at the screen's real pixel density so the art stays crisp, capped at 2x so older phones stay smooth. */
function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

const city = City.create();
const hud = new Hud();
if (new URLSearchParams(window.location.search).has('demo')) hud.hideWelcome();

const ratio = pixelRatio();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  transparent: true,
  disableContextMenu: true,
  input: { activePointers: 2 }, // two fingers, for pinch-zoom
  scale: {
    mode: Phaser.Scale.ScaleModes.NONE,
    width: Math.round(window.innerWidth * ratio),
    height: Math.round(window.innerHeight * ratio),
    zoom: 1 / ratio,
  },
  scene: new CityScene(city, hud),
});

function fitToWindow(): void {
  const r = pixelRatio();
  game.scale.setZoom(1 / r);
  game.scale.resize(Math.round(window.innerWidth * r), Math.round(window.innerHeight * r));
}
window.addEventListener('resize', fitToWindow);

// Stop iPhone Safari from zooming the whole page when you pinch the map.
document.addEventListener('gesturestart', (event) => event.preventDefault());
