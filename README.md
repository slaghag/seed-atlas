# Valheim Seed Atlas

A browser-based tool for finding Valheim world seeds with specific properties, entirely client-side — no server, no build step, no dependencies.

**Live:** https://slaghag.github.io/seed-atlas/

## What it does

Click a spot on the map, generate random seed strings, and keep the ones that match what you're looking for. Everything runs instantly in your browser using an offline reimplementation of Valheim's own world-generation math (validated against real seed data) — no need to actually launch the game or scan seeds one at a time.

Two search modes:

- **Spawn Search** — keeps seeds whose spawn point lands within a chosen radius of your click. This is the original, fully working mode.
- **Maypole Search** *(experimental)* — keeps seeds where the clicked point isn't ruled out by the known placement rules for `WoodFarm1` (the village type that can spawn a Maypole): right biome, right distance band, right altitude, right forest cover, flat enough ground. **A match here means "worth checking further," not "confirmed."** Real placement is a random process this check can't fully simulate — it's a fast pre-filter meant to narrow thousands of seeds down to a shortlist, which then needs a real Unity-based scan (in progress, separate tool) to confirm.

Favorite seeds you like, with a note explaining why — that list is stored locally in your browser and is the closest thing this tool has to an "atlas."

## Files

| File | What it is |
|---|---|
| `index.html` | The tool itself — UI, map rendering, seed generation, everything. |
| `biome_port.js` | Offline JS port of Valheim's biome/height/terrain generation, loaded by `index.html`. Used by Maypole Search mode. |
| `map.webp` | Master map image (landmass shape is the same for every seed — only the offset shifts). |
| `pin.svg` | Spawn-point marker icon. |

## Status

- Spawn Search: done, stable.
- Maypole Search: functional pre-filter, not yet confirmed against real game data. Two pieces of it (forest-factor and terrain-flatness math) are built from standard textbook formulas rather than confirmed decompiled game code — flagged in `biome_port.js`'s comments. A separate Unity-based batch scanner (not part of this repo yet) is what actually confirms a candidate.
- Candidate export (for handing a shortlist to the Unity scanner) is basic — a plain seed list. The exact format the scanner's driver script expects hasn't been independently confirmed against this tool this session, so treat it as a starting point, not a guaranteed match.

## Credits

- World-generation math: reverse-engineered from Valheim's own game files, cross-checked against [BjarkeCK/ValheimSeedFinder](https://github.com/BjarkeCK/ValheimSeedFinder) (MIT licensed) and [crazicrafter1/Avledet](https://github.com/crazicrafter1/Avledet).
- "Inspect on Valheim World Generator" links out to the excellent [valheim-map.world](https://valheim-map.world/) by wd40bomber7.
- **Master World Map**: [u/Wethospu_](https://www.reddit.com/user/Wethospu_/) — [Original Reddit Post](https://www.reddit.com/r/valheim/comments/qere7a/the_world_map/)
* **Mountain Peak Locations & Heights**: [u/RandomLizard67](https://www.reddit.com/user/RandomLizard67/) — [Original Reddit Post](https://www.reddit.com/r/valheim/comments/1antqx9/valheim_master_map/#lightbox)
