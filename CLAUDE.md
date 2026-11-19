# Hyderabad Tycoon

A cute, cozy city-builder set in Hyderabad. The design and roadmap are in [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Commands

- `npm install`, then `npm run dev`: play locally at the printed address. Add `?demo` to start with a small neighbourhood built.
- `npm test`: tests for the game rules (Vitest)
- `npm run typecheck`: TypeScript checks
- `npm run build`: production build into `dist/`

GitHub Actions runs the typecheck, tests and build on every push and pull request, and publishes `main` to
GitHub Pages: https://avinash-kadabur.github.io/hyderabad-tycoon/

## Code layout

- `src/sim/`: game rules in plain TypeScript, with no Phaser. Everything here has unit tests.
- `src/render/`: isometric maths and the art, which is drawn in code at start-up (no image files yet).
- `src/scenes/`: the Phaser scene. It draws the city and handles touch, mouse, zoom and effects.
- `src/ui/`: the HTML toolbar, money pill, messages and welcome card.
- `src/audio/`: small sound effects made with the Web Audio API (no audio files).

## Working rules

- Cute and fun first: use the pastel palette in `src/config.ts`, keep shapes rounded, and give every action a little animation and sound.
- Touch-first: every feature must work with one finger, and pinch-zoom must keep working.
- Keep it free: ask before adding any paid service or asset.
- Dependency versions are pinned exactly in `package.json`. There is no lockfile yet.
- Avinash is new to game development. Explain things simply, start with the plain picture, and give at most two decisions at a time, each with a recommended default.
