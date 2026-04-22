# Wall textures

Drop `.png` files into this folder to override the procedurally-generated
wall textures the first-person raycaster uses. Each texture is loaded once
at game start; any file that's missing or fails to decode falls back to
the procedural version in `lib/game/rendering/textures.dart`.

Recommended texture resolution: **64×64**, power-of-two square, with
tiling-friendly edges (top pixel matches bottom, left pixel matches right).
The raycaster samples one pixel column per rendered wall column, so higher
resolutions don't help unless you're also increasing the renderer's
`_pixelStep` density.

## Expected filenames

| File | Where it appears |
|------|------------------|
| `wall.png` | Outer perimeter walls |
| `counter.png` | Checkout counters |
| `produceBin.png` | Wooden produce crates along the north wall |
| `fridge.png` | Glass fridge doors on the right wall |
| `shelf_produce.png` | Produce aisle shelving backboards |
| `shelf_bakery.png` | Bakery aisle |
| `shelf_deli.png` | Deli aisle |
| `shelf_dairy.png` | Dairy aisle |
| `shelf_frozen.png` | Frozen aisle |
| `shelf_snacks.png` | Snacks & drinks aisle |
| `shelf_household.png` | Household aisle |

## Asset licence reminder

Only drop in textures you have the right to ship. The procedural fallbacks
are original to this project and carry no licence obligations.
