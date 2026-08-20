# Seed Atlas

Interactive map showing where Valheim seeds land on the game's shared world layout.

**Live tool:** https://slaghag.github.io/seed-atlas/

## Attribution

Seed rendering/preview powered by [valheim-map.world](https://valheim-map.world/) (by wd40bomber7) — this project links out to it but is otherwise unaffiliated.

## Using the atlas

- **Scroll wheel** to zoom, anchored on your cursor
- **Click and drag** to pan
- **Click a pin** to see its seed, copy it, or jump to a rendered preview
- **★ Favorite** a seed with a note — persists in your browser, exportable/importable
- Viewed pins turn grey
- **★ Show favorites** filters to starred seeds only
- 50+ seeds auto-paginate (Prev/Next or Show all)

## Data generation

- Dedicated Valheim server (BepInEx + Expand World Size/Data + Server Devcommands + RCON)
- Automated loop: set seed → regenerate → query real in-game offset via RCON → record → repeat
- Offset converted to master-map pixel position via a calibration model built from precisely-measured reference points

**Accuracy:** ~±17px on a ~1900px-wide world (~1%), based on a small validated set of precision reference points.

## Data format

`results.csv`:

```
Seed,OffsetX,OffsetY,Height,Meadows,BlackForest,Swamp,Plains,Mistlands
```

`OffsetX`/`OffsetY` = real in-game world-center coordinates (meters). Remaining columns are per-biome data, not currently used by the atlas.

## Status

Several hundred seeds tracked, growing as new batches are scanned.
