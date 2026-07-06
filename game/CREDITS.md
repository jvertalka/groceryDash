# Asset credits

All bundled assets are free for commercial use. Re-download any time with
`npm run fetch-assets` (see `scripts/fetch-assets.mjs` for exact URLs).

## Textures & HDRI — Poly Haven (CC0 / public domain)
- `empty_warehouse_01` (HDRI) — https://polyhaven.com/a/empty_warehouse_01
- `floor_tiles_06` (PBR texture) — https://polyhaven.com/a/floor_tiles_06
- `beige_wall_001` (PBR texture) — https://polyhaven.com/a/beige_wall_001

CC0 means no attribution is legally required; listed here as courtesy.

## Models
- **Microsoft Rocketbox avatars** (MIT) — `models/people/*` — realistic everyday
  civilians from https://github.com/microsoft/Microsoft-Rocketbox
  (Female_Adult_01/08/12, Male_Adult_01/04/08). Source 2K TGA textures were
  resized to 1024 JPG/PNG for the web; FBX rigs used as-is. © Microsoft, MIT.
- `models/anims.glb` — three.js `Soldier.glb` (MIT), used ONLY as an animation
  donor: its mixamorig Idle/Walk clips are retargeted onto the Rocketbox Biped
  rigs at runtime. The soldier is never rendered.
- `models/shopper.glb` — Khronos `CesiumMan` (CC-BY 4.0 / Cesium), legacy fallback.

## Packaging art
Product labels are generated procedurally in `src/products.js` (fictional brands).
