# Marlin Cove — GTA 6 (make.fun gta6-01)

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/dandelionz3/gta6-01-r5/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/dandelionz3/gta6-01-r5/reward.svg)](https://make.fun/bounty/gta6-01)

**Marlin Cove** is an original open-world crime game built from scratch for the
make.fun "Make GTA 6" bounty (gta6-01). A sun-soaked coastal city at dusk:
four districts (Harbour Point, Neon Row, Coral Strand, Palma Heights), a beach
and an ocean, palm trees, neon streets — all original fiction, no Rockstar
names, characters, map, art or music.

## Play it

Open `game/index.html` in desktop Chrome (works from `file://`, zero network
requests), or run `node serve.ts` and open http://localhost:8080.

- **WASD / Arrows** — walk and drive
- **Mouse** — look (click the canvas to lock the pointer)
- **Left click** — shoot / punch
- **E** — enter or exit a car (steal it — the driver objects)
- **F** — punch, pull a driver out
- **1–7** — weapons (fists, pistol, SMG, shotgun, carbine, launcher, molotov)
- **R** — reload &nbsp; **Q** — radio station &nbsp; **M** — full map &nbsp; **P** — pause

## What is in the game

- **Open world**: seeded grid city with a shared road graph, ~20 traffic cars
  that follow lanes and brake, ~30 pedestrians who flee gunfire, stealable
  cars with third-person chase camera.
- **Wanted 1–5 stars**: foot police, pursuit cars, roadblocks, a police
  helicopter with a spotlight, Busted / Wasted screens, and a paint shop
  that clears your stars.
- **Story**: 7 data-driven jobs from Mara Voss, Juno Reef and Sable Ortiz —
  meet-ups, car theft, deliveries, eliminations and a five-star escape —
  with dialogue, phone-style mission text and a closing mission.
- **HUD**: mission banner with stage progress, MCPD dispatch panel with named
  units, wanted stars, money, clock, weapon slots with ammo and locks,
  minimap with blips, health / armour / respect bars, speed + car name +
  condition, dialogue box with portrait, radio line and district label.
- **Systems**: localStorage save with autosave, text export / import,
  weapon shop (Carbine $500), hidden Golden Shell collectibles, safehouse
  healing, day/dusk cycle, fog, smoking then exploding cars, camera shake.
- **Audio**: everything synthesised with WebAudio — engine hum, sirens,
  gunshots, a synthwave radio bed. No audio files.
- **Tech**: three.js (vendored `game/three.min.js`, UMD build) + plain
  JavaScript, no bundler, no build step, no network at runtime. Deterministic
  `?shot=` modes stage reproducible action frames for the screenshots.

## Layout

- `game/` — the game (`index.html`, `data.js`, `world.js`, `audio.js`,
  `hud.js`, `game.js`, vendored `three.min.js`)
- `screenshots/` — 4 renders of the game itself (see `shots.json`)
- `main.ts` — entry program: copies `game/` + `screenshots/` to the output
  dir and writes `dossier.json` via `vendor/makefun-game.ts`
- `serve.ts` — tiny static server for local play-testing
- `shots.json` — the four reproducible `?shot=` captures
- `vendor/makefun-game.ts` — kit-provided dossier library (unchanged)

## License

MIT — see [LICENSE](LICENSE).
