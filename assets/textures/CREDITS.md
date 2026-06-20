# Texture credits & licensing

These wall textures are real photographic source art dropped into the
raycaster's texture-override pipeline (see `README.md` and
`lib/game/rendering/textures.dart`). Any slot without a file here falls back
to the procedural builder.

| File | Source asset | Provider | License |
|------|--------------|----------|---------|
| `wall.png` | Tiles107 | [ambientCG](https://ambientcg.com/view?id=Tiles107) | CC0 1.0 (public domain) |
| `produceBin.png` | WoodFloor040 | [ambientCG](https://ambientcg.com/view?id=WoodFloor040) | CC0 1.0 (public domain) |
| `counter.png` | Metal032 | [ambientCG](https://ambientcg.com/view?id=Metal032) | CC0 1.0 (public domain) |
| `floor.png` | Tiles040 | [ambientCG](https://ambientcg.com/view?id=Tiles040) | CC0 1.0 (public domain) |

`floor.png` is sampled by the first-person floor-caster (`_drawFloor` in
`lib/game/rendering/first_person_renderer.dart`), tiled across the store floor.

All source textures are licensed **CC0 1.0 Universal** — public domain, free
for commercial use, no attribution required. This file documents provenance
as a courtesy and for due-diligence, not as a license obligation.

Processing: the `*_Color` map from each pack's 1K-JPG download was resized to
256×256 and re-encoded as PNG. Other maps (normal/roughness/AO/displacement)
were discarded — the raycaster samples colour only.
