import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the same build works on GitHub Pages (served from /hyderabad-tycoon/)
  // and later inside the Android and iPhone apps.
  base: './',
  build: {
    // Phaser on its own is over 1 MB; that's expected for a game.
    chunkSizeWarningLimit: 2000,
  },
});
