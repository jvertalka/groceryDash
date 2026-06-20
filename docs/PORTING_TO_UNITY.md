# Grocery Dash → Unity 6 Porting Bible

## 1. Overview

This document is the authoritative porting specification for migrating **Grocery Dash** from its Flutter/Flame (Dart) implementation to **Unity 6 (C#)**. It exists so that the Unity rebuild is a **mechanical transcription**, not a re-derivation: every playtested number, enum value, and string of content is captured here verbatim so it transfers unchanged.

### What survives (port these exactly)
- **All game logic** — state machines, tick pipelines, collision/slide math, target selection, scoring formulas, timers, and trigger conditions.
- **All design/tuning data** — item/section/cart/obstacle tables, speeds, radii, probabilities, timings, knockback tiers.
- **All player-facing content** — PA announcements, banners, NPC dialogue pools, identity labels, HUD prompts (including exact Unicode glyphs).
- **The store floor plan** — exact fixture geometry, zones, spawn point, entrance gap.

### What is discarded (do NOT port)
- **The raycaster renderer** and all three Flutter renderers (FirstPersonRenderer/head-bob, TopDownRenderer, FollowCamRenderer). Rendering is rebuilt natively in Unity with real 3D cameras/prefabs.
- **The hand-rolled circle-vs-AABB `slide()` collision solver** — replaced by `CharacterController` + colliders (the *behavior* it produces is the spec; the implementation is thrown away). Where bit-identical motion matters you may replicate it, but it is not the target.
- **Flutter UI** (`ValueNotifier`/`ChangeNotifier`/widgets/HUD canvas) — rebuilt as Unity UI Toolkit / uGUI driven by C# events.
- **Procedural audio** — the SFX *triggers and intensities* are noted inline as design intent, but the synthesis is rebuilt with Unity AudioSources/clips.

### Porting philosophy

> **Re-type the logic, paste the data, rebuild the rendering.**

Treat the Dart source as a precise pseudocode reference. Transcribe each subsystem's state machine and per-frame pipeline into C# MonoBehaviours; load every table below as ScriptableObject assets; replace only the rendering, input plumbing, collision solver, and audio with idiomatic Unity equivalents. Resist "improving" tuning during the port — these numbers were playtested. Improvements come after parity.

---

## 2. Porting conventions

Quick reference for the Dart→C#/Unity translation. Apply consistently across every subsystem.

| Dart / Flame concept | Unity 6 / C# equivalent | Notes |
|---|---|---|
| `Offset(x, y)` / `Vector2` | `Vector3` (XZ-ground plane) or `Vector2` | World is 2D-on-a-plane; pick XZ (X=east, Z=north) so the floor is the ground. See coordinate note below. |
| `Rect.fromLTWH` / `Rect.fromCenter` | `Bounds` / `BoxCollider` | Solid fixtures → static `BoxCollider`; zones → non-colliding trigger volumes. |
| `Size` (store bounds) | play-area bounds / perimeter colliders | Used for clamping movement. |
| Flame `Component` / `FlameGame` | `MonoBehaviour` / top-level GameManager `MonoBehaviour` | The game class becomes the run-owning GameManager. |
| Data classes (`ItemDef`, `SectionDef`, …) | `ScriptableObject` subclasses (one asset per row) | Loaded into a central catalog/registry at boot; keyed by `id`. |
| Hand-rolled `slide()` / `blockingAt()` | `CharacterController.Move()` + `BoxCollider`s | Native wall-sliding. Point queries → `Physics.CheckSphere`/`OverlapSphere`. |
| `randomWalkablePoint` rejection sampling | `Physics.CheckSphere` rejection **or** NavMesh `SamplePosition` | Keep 40-attempt cap + fallback to spawn point. |
| `ChangeNotifier` / `ValueNotifier<T>` | C# `event` / `UnityEvent` / `Action<T>` | HUD subscribes to events instead of listenables. |
| `update(double dt)` game loop | `Update()` (per-frame) / `FixedUpdate()` (physics) | Custom velocity integration belongs in a single consistent loop; see per-subsystem notes. |
| `math.Random()` / seeded `Random(seed)` | `System.Random` / `Unity.Mathematics.Random` | **Cross-language RNG will NOT reproduce identical sequences** — only distributions transfer. Do not hash-compare seeded worlds across engines. |
| Dart `radians`, `0=east`, CW (because +y down) | Keep relationships, convert axis sign once | `forward = (cos h, sin h)`, "behind" = subtract forward. Convert the +y-down handedness exactly once, globally. |
| Color `0xAARRGGBB` (always `0xFF` alpha) | `ColorUtility.TryParseHtmlString("#RRGGBB", …)` or `Color32` | All source colors are fully opaque. |

**Pixels → world units:** the source is in pixels. Adopt **one** global scale (recommended **100 px = 1 world unit**, so the store is 24×16 units) and divide every constant by it once. All px values below are unconverted source values.

> **⚠ Known Flutter bug — do NOT reproduce:** the existing Flutter build had a *"setState during build"* HUD defect (UI state mutated during the widget build phase). Unity's UI rebuild sidesteps this entirely — drive HUD from events fired *after* logic updates, never mutate UI mid-layout. Don't port the listener pattern that caused it.

---

## 3. Subsystem Specifications

### 3.1 Data & Content (ScriptableObject tables)

Every table below is verbatim source-of-truth tuning data from the playtested Flutter build. **Each table becomes a Unity ScriptableObject asset type** (one `ScriptableObject` subclass per table, one asset instance per row), loaded into a central content registry/catalog at boot. IDs are the stable lookup keys — preserve them exactly. Colors are given as ARGB hex (`0xAARRGGBB`); in Flutter every value here is fully opaque (`0xFF` alpha). In Unity, convert the lower 6 hex digits (RRGGBB) via `ColorUtility.TryParseHtmlString("#RRGGBB", out color)` or store as a `Color32`.

#### Enums (port verbatim)

These four enums are referenced by the tables. Port as C# `enum` types; the renderer-related ones (`ItemShape`, `ShelfStyle`) drive sprite/prefab selection.

**`ItemRarity`** — order preserved: `common, rare, fragile, utility`
(Note: `utility` is declared but unused by any of the 30 items below; keep it in the enum for completeness/future content.)

**`ItemShape`** — visual silhouette category (drives how the item draws / which prefab/sprite variant to use):

| Value | Source comment (intent for the Unity artist) |
|---|---|
| `bottle` | tall, domed cap + label band |
| `carton` | milk/oj carton with slanted top |
| `can` | short cylinder with rim |
| `box` | chunky rectangle with big label |
| `bag` | rounded squashy shape with zig-zag top |
| `tray` | flat meat/deli tray |
| `produce` | fruit/veg — emoji-first, soft round shape |
| `round` | cake/pizza — circle from side |
| `bouquet` | flowers — triangle of colour |
| `wedge` | cheese — triangle block |

**`ShelfStyle`** — visual + behavioural style for a shelf row within a section (drives shelf prefab selection):

| Value | Source comment |
|---|---|
| `woodenCrates` | produce |
| `bakeryShelf` | bakery — warm brown with bread |
| `deliCounter` | deli — glass front with meats/cheeses |
| `coolerFridge` | dairy — white fridge |
| `freezerCase` | frozen — white/blue with frost |
| `snackRack` | snacks & drinks — colourful rack |
| `warehouseShelf` | household — tall grey shelving |

**`GameMode`** — order preserved: `endless, shoppingList`
**`CameraMode`** — order preserved: `firstPerson, sideScroll, topDown`

---

#### Items (`ItemDef` → `ItemSO`)

30 items spanning the MVP pool. Fields: `id, name, emoji, color, score, coin, rarity, shape`. Lookup helper `itemById(id)` returns the first item whose `id` matches → in Unity, a `Dictionary<string, ItemSO>` keyed by `id` (built once; assume IDs unique).

> Source grouping comments are kept in the "Group" column for the artist's reference; they are NOT a data field and have no runtime meaning.

| id | name | emoji | color (0xAARRGGBB) | score | coin | rarity | shape | Group |
|---|---|---|---|---|---|---|---|---|
| `milk` | Milk | 🥛 | `0xFFF2F2F2` | 5 | 1 | common | carton | Dairy/cold |
| `oj` | Orange Juice | 🍊 | `0xFFE89B3C` | 6 | 1 | common | carton | Dairy/cold |
| `eggs` | Eggs | 🥚 | `0xFFF5ECD7` | 8 | 2 | fragile | carton | Dairy/cold |
| `cereal` | Cereal | 🥣 | `0xFFE0B040` | 5 | 1 | common | box | Boxes |
| `candy` | Candy | 🍬 | `0xFFE86A92` | 5 | 1 | common | box | Boxes |
| `tissues` | Tissues | 🧻 | `0xFFF5F5F5` | 5 | 1 | common | box | Boxes |
| `pizza` | Frozen Pizza | 🍕 | `0xFFD2690E` | 7 | 1 | common | box | Boxes |
| `batteries` | Batteries | 🔋 | `0xFF5D7B8C` | 6 | 1 | common | box | Boxes |
| `bread` | Bread | 🍞 | `0xFFD9A066` | 5 | 1 | common | bag | Bags |
| `chips` | Chips | 🍟 | `0xFFE5C07B` | 5 | 1 | common | bag | Bags |
| `popcorn` | Popcorn | 🍿 | `0xFFF4E1A1` | 5 | 1 | common | bag | Bags |
| `charcoal` | Charcoal | ⬛ | `0xFF2E2E2E` | 6 | 1 | common | bag | Bags |
| `tp` | Toilet Paper | 🧻 | `0xFFEFEFEF` | 5 | 1 | common | bag | Bags |
| `tortilla` | Tortillas | 🌮 | `0xFFDFBB7A` | 5 | 1 | common | bag | Bags |
| `soda` | Soda | 🥤 | `0xFF8B3A3A` | 5 | 1 | common | bottle | Bottles/cans |
| `water` | Water | 💧 | `0xFF6BB3E8` | 5 | 1 | common | bottle | Bottles/cans |
| `mustard` | Mustard | 🟡 | `0xFFE8B104` | 5 | 1 | common | bottle | Bottles/cans |
| `soup` | Soup Can | 🥫 | `0xFFB03A48` | 5 | 1 | common | can | Bottles/cans |
| `energy` | Energy Drink | ⚡ | `0xFF4FB477` | 7 | 1 | common | can | Bottles/cans |
| `salsa` | Salsa | 🌶️ | `0xFFC0392B` | 6 | 1 | common | can | Bottles/cans |
| `ramen` | Ramen | 🍜 | `0xFFDFA95A` | 6 | 1 | common | can | Bottles/cans |
| `apple` | Apple | 🍎 | `0xFFD64545` | 5 | 1 | common | produce | Produce |
| `banana` | Banana | 🍌 | `0xFFE8C547` | 5 | 1 | common | produce | Produce |
| `beef` | Ground Beef | 🥩 | `0xFFA83A3A` | 7 | 1 | common | tray | Trays/deli |
| `hotdog` | Hot Dogs | 🌭 | `0xFFC47650` | 6 | 1 | common | tray | Trays/deli |
| `icecream` | Ice Cream | 🍦 | `0xFFF8D6CE` | 7 | 1 | common | tray | Trays/deli |
| `cheese` | Cheese | 🧀 | `0xFFE8B64C` | 6 | 1 | common | wedge | Specialties |
| `flowers` | Flowers | 💐 | `0xFFE86A92` | 8 | 2 | fragile | bouquet | Specialties |
| `cake` | Birthday Cake | 🎂 | `0xFFF6B5CC` | 20 | 5 | rare | round | Specialties |
| `lobster` | Lobster | 🦞 | `0xFFD64545` | 25 | 6 | rare | tray | Specialties |

Notes for porting:
- **Fragile** items (`eggs`, `flowers`) and **rare** items (`cake`, `lobster`) are the only non-`common` rarities present; rarity likely gates spawn rate / collision-break / scoring multipliers elsewhere — confirm against the spawn/scoring subsystems (note: §3.3 scoring computes `fragilesBroken = 0` always, so fragility is currently inert in this mode).
- Two ids share the 🧻 emoji (`tissues` box, `tp` bag) but differ by `shape` and `color`. Two ids share color `0xFFD64545` (`apple`, `lobster`) and two share `0xFFE86A92` (`candy`, `flowers`). These are intentional — do not dedupe.

---

#### Sections (`SectionDef` → `SectionSO`)

Seven themed regions stacked horizontally in world space. Fields: `id, name, emoji, shelfStyle, floorTintA, floorTintB, wallColor, accentColor, itemIdsPrimary, itemIdsSecondary`. `itemIdsSecondary` defaults to empty list when omitted. Lookup helper `sectionById(id)` → `Dictionary<string, SectionSO>`.

**World layout constant (load-bearing):** `kSectionWidth = 1600` (double, world px). The seven sections are laid out left-to-right, each 1600 px wide. `sectionIndexFor(worldX) = floor(worldX / 1600)` clamped to `[0, sections.length-1]` (i.e. `[0,6]`). **Unity mapping:** this is the world-space partitioning of the level; sections become 1600-unit-wide zones along the X axis (the rendering is being replaced, but this spatial chunking and the clamp must survive — it drives which section's palette/pool is active and indexes the array, so the array order below is itself data).

Section order is significant (index 0–6): produce, bakery, deli, dairy, frozen, snacks, household.

| idx | id | name | emoji | shelfStyle | floorTintA | floorTintB | wallColor | accentColor |
|---|---|---|---|---|---|---|---|---|
| 0 | `produce` | Produce | 🥬 | woodenCrates | `0xFFEDE3C6` | `0xFFD8CC9E` | `0xFFB7D8A3` | `0xFF4AA35A` |
| 1 | `bakery` | Bakery | 🥖 | bakeryShelf | `0xFFF4E9CE` | `0xFFDEC692` | `0xFFD9A066` | `0xFF8C5A2B` |
| 2 | `deli` | Deli | 🧀 | deliCounter | `0xFFEEE5D2` | `0xFFD4C8A8` | `0xFFE8C06D` | `0xFFB03A48` |
| 3 | `dairy` | Dairy | 🥛 | coolerFridge | `0xFFE7EEF3` | `0xFFC9D7E0` | `0xFFCBE3EF` | `0xFF3D8AB0` |
| 4 | `frozen` | Frozen | 🧊 | freezerCase | `0xFFDEECF2` | `0xFFB4CFDB` | `0xFF9BC4DA` | `0xFF2F6D8A` |
| 5 | `snacks` | Snacks & Drinks | 🍿 | snackRack | `0xFFF3E7D2` | `0xFFDDCBA4` | `0xFFE5B04A` | `0xFFD64545` |
| 6 | `household` | Household | 🧻 | warehouseShelf | `0xFFE8E4D9` | `0xFFCAC3B0` | `0xFFB0ABA0` | `0xFF5D7B8C` |

Item pools per section (ordered lists of item ids; secondary = biased/rarer fill, empty where omitted):

| id | itemIdsPrimary | itemIdsSecondary |
|---|---|---|
| `produce` | `apple, banana, oj` | `flowers` |
| `bakery` | `bread, cake` | `popcorn, candy` |
| `deli` | `cheese, beef, hotdog, lobster` | *(empty)* |
| `dairy` | `milk, eggs, cheese` | *(empty)* |
| `frozen` | `icecream, pizza` | `ramen` |
| `snacks` | `chips, soda, candy, popcorn` | `energy, cereal` |
| `household` | `batteries, tp, tissues, water` | `mustard, salsa` |

Notes: `floorTintA`/`floorTintB` are a two-tone floor tile pair (checker/gradient). `cheese` appears in both `deli` and `dairy` primary pools; `candy` and `popcorn` appear in multiple sections — these are reference ids into the items table, store as id strings (or asset references resolved at load), not copies.

---

#### Carts (`CartDef` → `CartSO`)

Player-selectable cart skins / vehicles. Fields: `id, name, emoji, color, unlockCost, tagline`. `unlockCost == 0` means unlocked by default. Default selected cart constant: `kDefaultCartId = 'rusty'`. (Coins to unlock come from the `coin` field on items.)

| id | name | emoji | color | unlockCost | tagline |
|---|---|---|---|---|---|
| `rusty` | Rusty Cart | 🛒 | `0xFFB0B0B0` | 0 | Squeaks ominously. |
| `race` | Kid Race Cart | 🏎️ | `0xFFE05B3F` | 50 | Built for speed. And tantrums. |

**Unity mapping:** `CartSO` assets plus a player-prefs/profile field holding the selected cart id and the set of unlocked ids; `unlockCost` is spent against the coin currency. Only 2 carts exist in the MVP; `race` is the sole purchasable.

---

#### Obstacles (`ObstacleDef` → `ObstacleSO`)

10 obstacle types. Fields: `id, name, emoji, color, widthLanes`. `widthLanes` defaults to `1` and is documented as "how many lanes it occupies (1 or 2)" — **all 10 entries use the default 1** (none override it). Keep the field (2-lane obstacles are anticipated content).

| id | name | emoji | color | widthLanes |
|---|---|---|---|---|
| `beans` | Bean Pyramid | 🥫 | `0xFFB04A2E` | 1 |
| `display` | Cardboard Display | 📦 | `0xFFC68642` | 1 |
| `watermelon` | Watermelon Bin | 🍉 | `0xFF4CAF50` | 1 |
| `spill` | Wet Floor | 💦 | `0xFF7EC8E3` | 1 |
| `cart` | Runaway Cart | 🛒 | `0xFF9E9E9E` | 1 |
| `shopper` | Slow Shopper | 🧓 | `0xFF8E7CC3` | 1 |
| `kid` | Running Kid | 🧒 | `0xFFEB8A50` | 1 |
| `mop` | Mop Bucket | 🪣 | `0xFF4A6FA5` | 1 |
| `stocker` | Stock Clerk | 👷 | `0xFFE0A638` | 1 |
| `grapes` | Spilled Grapes | 🍇 | `0xFF7B2E8A` | 1 |

**Unity mapping:** `ObstacleSO` assets; obstacle behavior (does it block? slow? move?) is NOT defined in this data file — `widthLanes` is the only behavioral parameter here. Behavior (e.g. `spill`/`grapes`/`mop` likely being slip/slow hazards vs. `beans`/`display` being solid blockers vs. `cart`/`kid`/`shopper`/`stocker` being moving agents → NavMeshAgent candidates) comes from the NPC/AI subsystem (§3.4), not this table. In practice the spawn pool only uses `shopper`/`stocker`/`kid`/`cart`; `spill`/`grapes` are inert hazards (see §3.4).

---

#### Game Modes & Camera Modes (`GameMode` / `CameraMode` → enums + UI strings)

These are enums with display strings supplied by Dart extensions, not class tables. There are **no numeric tuning parameters** in this file (no timers, no spawn rates) — `shoppingList`'s "before the timer runs out" implies a timer that lives in the mode/run subsystem, not here. **Unity mapping:** the enums become C# enums; the label/tagline/emoji strings become a small static lookup (or per-mode `ScriptableObject` with these string fields) feeding the menu UI. Strings verbatim:

**GameMode**

| enum value | label | emoji | tagline |
|---|---|---|---|
| `endless` | Endless Dash | 💥 | Survive the aisles. Collect chaos. Combo for glory. |
| `shoppingList` | Shopping List | 📝 | Grab every item on your list before the timer runs out. |

**CameraMode** (no tagline field for cameras)

| enum value | label | emoji |
|---|---|---|
| `firstPerson` | First Person | 🛒 |
| `sideScroll` | Follow Cam | 👁 |
| `topDown` | Store Map | 🗺️ |

Note: `CameraMode` enum names (`firstPerson`/`sideScroll`/`topDown`) do not match their player-facing labels (`First Person`/`Follow Cam`/`Store Map`) — keep both; the enum name is the code identifier, the label is UI. Since the raycaster rendering is being discarded, the three camera modes are now a Unity camera-rig selection (3 virtual-camera setups); the enum, default selection logic, and these labels/emojis still drive the menu. **Load-bearing control dependency:** only `firstPerson` uses tank/turn controls and the icy-friction path; `sideScroll`/`topDown` use analog controls (see §3.3).

---

### 3.2 Store Floor Plan (greybox spec)

#### Overview & units

The store geometry is built once at level start by `StoreLayout.standard()` and aggregated into a `StoreLayout` object (store `Size` + flat `List<SolidRect>` + `List<SectionZone>`). All coordinates are in **pixels**, with the origin **(0,0) at the top-left (north-west) corner**, **+X = east (right)**, **+Y = south (down)**. Rectangles use `Rect.fromLTWH(left, top, width, height)` or `Rect.fromCenter(center, width, height)`.

**Store size:** `2400 (w) × 1600 (h)` pixels.

**Suggested pixels → Unity world-units convention:** use **100 px = 1 world unit** (so the store is `24 × 16` world units, a comfortable greybox footprint). Map the Dart top-left/+Y-down space to Unity's XZ ground plane with **X_unity = px_x / 100** and **Z_unity = (h - px_y) / 100** (flip Y so +Y-down becomes +Z-north-up) — OR keep the simpler **X_unity = px_x / 100, Z_unity = px_y / 100** and just accept that +Z points south; pick one and apply it to every fixture below consistently. All sizes below are given in px; divide by 100 for world units. Wall thickness 40 px = 0.4 wu, aisle width 80 px = 0.8 wu, etc.

> Unity mapping (whole subsystem): `StoreLayout.standard()` becomes a single greybox scene (or a `ScriptableObject` "StoreLayoutDefinition" consumed by a builder). Each `SolidRect` becomes a box collider (static geometry). `SectionZone` becomes a non-colliding trigger volume / floor-tint region. The store `Size` defines the play-area bounds used for clamping.

#### Constants (verbatim)

| Name | Value | Meaning |
|---|---|---|
| `w` | `2400` | store width (px) |
| `h` | `1600` | store height (px) |
| `wall` | `40.0` | perimeter wall thickness (px) |
| `aisleHalfW` | `40.0` | half shelf width → shelf width = `80` |
| `produceY` | `120.0` | center-Y of produce & bakery bins |
| `aisleY` | `360.0` | top edge of aisle band |
| `aisleH` | `880.0` | aisle shelf height |

#### Solid fixtures (verbatim geometry)

All `SolidRect` entries below are solid/blocking. `kind` is one of `SolidKind.{shelf, wall, produceBin, counter, fridge}`. Order matches build order (collision iterates this list in order; first overlap wins for `blockingAt`).

##### 1. Perimeter walls (`kind: wall`, sectionId `'household'`)

Note: the south wall is **split into two segments with a gap** (the entrance). North/east/west are full-length.

| Wall | Rect (L, T, W, H) |
|---|---|
| North (full top) | `(0, 0, 2400, 40)` |
| South-left segment | `(0, 1560, 600, 40)` |
| South-right segment | `(1000, 1560, 1400, 40)` — `w-1000 = 1400` wide |
| West (full left) | `(0, 0, 40, 1600)` |
| East (full right) | `(2360, 0, 40, 1600)` — `w-wall = 2360` |

The **entrance gap** in the south wall spans `x = 600 .. 1000` (width 400 px) at `y = 1560..1600`.

##### 2. Produce bins (`kind: produceBin`, sectionId `'produce'`)

4 wooden crates, each `120w × 80h`, centered at `produceY = 120`, spaced 180 px apart starting at cx = 200. `cx = 200 + i*180` for i = 0..3.

| i | center | rect (L, T, W, H) |
|---|---|---|
| 0 | (200, 120) | (140, 80, 120, 80) |
| 1 | (380, 120) | (320, 80, 120, 80) |
| 2 | (560, 120) | (500, 80, 120, 80) |
| 3 | (740, 120) | (680, 80, 120, 80) |

##### 3. Bakery bins (`kind: produceBin`, sectionId `'bakery'`)

3 crates, each `120w × 80h`, centered at `produceY = 120`. `cx = 1000 + i*180` for i = 0..2.

| i | center | rect (L, T, W, H) |
|---|---|---|
| 0 | (1000, 120) | (940, 80, 120, 80) |
| 1 | (1180, 120) | (1120, 80, 120, 80) |
| 2 | (1360, 120) | (1300, 80, 120, 80) |

##### 4. Deli counter (`kind: counter`, sectionId `'deli'`)

Single counter: rect `(1700, 120, 500, 80)` → spans x `1700..2200`, y `120..200`.

##### 5. Center aisles — 5 shelves (`kind: shelf`)

Running N–S. Each `80w × 880h` (`width = aisleHalfW*2`, `height = aisleH`), top edge at `aisleY = 360`, so vertical span y `360..1240`. Centered vertically at `aisleY + aisleH/2 = 800`. Horizontal centers `cx = 360 + i*360` for i = 0..4. Section pattern alternates: `['snacks', 'household', 'snacks', 'household', 'snacks']`.

| i | sectionId | center | rect (L, T, W, H) |
|---|---|---|---|
| 0 | snacks | (360, 800) | (320, 360, 80, 880) |
| 1 | household | (720, 800) | (680, 360, 80, 880) |
| 2 | snacks | (1080, 800) | (1040, 360, 80, 880) |
| 3 | household | (1440, 800) | (1400, 360, 80, 880) |
| 4 | snacks | (1800, 800) | (1760, 360, 80, 880) |

> Note: the build comment in the file states aisle centers at `x=360,640,920,...` but the actual code uses stride `360` (`360 + i*360`), yielding centers `360, 720, 1080, 1440, 1800`. **Trust the code values above**, not the comment.

##### 6. Wall fridges (`kind: fridge`) — right wall, two stacked

| Section | rect (L, T, W, H) | span |
|---|---|---|
| dairy | (2060, 280, 260, 400) | x 2060..2320, y 280..680 |
| frozen | (2060, 720, 260, 400) | x 2060..2320, y 720..1120 |

##### 7. Checkout counters (`kind: counter`, sectionId `'household'`)

3 counters, each `180w × 50h`, centered at y `1340`. `cx = 240 + i*240` for i = 0..2.

| i | center | rect (L, T, W, H) |
|---|---|---|
| 0 | (240, 1340) | (150, 1315, 180, 50) |
| 1 | (480, 1340) | (390, 1315, 180, 50) |
| 2 | (720, 1340) | (630, 1315, 180, 50) |

Checkout interact points are derived in `populate()` for counters with `rect.top ≥ height-300` (i.e. `≥1300`): `interactPoint = (center.x, top - 40)`.

#### Section zones (non-solid floor regions)

`SectionZone` = `{rect, sectionId}`. Used to (a) tint the floor by section, and (b) bias item/obstacle choice. **They are NOT collision** — they overlap the aisles/fixtures; only the `SolidRect` inside is solid. `sectionAtPoint(x,y)` returns the first zone whose rect contains the point; if none match it falls back to `kSections.first.id`.

| sectionId | rect (L, T, W, H) | span |
|---|---|---|
| produce | (0, 0, 900, 240) | x 0..900, y 0..240 |
| bakery | (900, 0, 700, 240) | x 900..1600, y 0..240 |
| deli | (1600, 0, 800, 240) | x 1600..2400, y 0..240 (`w-1600 = 800`) |
| snacks (aisle 0) | (180, 240, 360, 920) | `cx-180, 240, 360, aisleH+40` |
| household (aisle 1) | (540, 240, 360, 920) | |
| snacks (aisle 2) | (900, 240, 360, 920) | |
| household (aisle 3) | (1260, 240, 360, 920) | |
| snacks (aisle 4) | (1620, 240, 360, 920) | |
| dairy | (1920, 240, 480, 900) | x 1920..2400, y 240..1140 (`w-1920 = 480`) |
| frozen | (1920, 1140, 480, 400) | x 1920..2400, y 1140..1540 |
| household (checkout) | (0, 1280, 900, 320) | x 0..900, y 1280..1600 |

Aisle-zone formula: `Rect.fromLTWH(cx - 180, 240, 360, aisleH + 40)` with `aisleH+40 = 920`, evaluated for each aisle center `cx` above.

> Zone-evaluation order matters: zones are added in this order (produce, bakery, deli, then the 5 aisle zones interleaved during the aisle loop, then dairy, frozen, checkout-household). `sectionAtPoint` returns the **first** containing zone, so earlier zones win on overlap. Several `household`/`snacks` ids repeat across multiple zones — section identity is by string id, not by zone instance. **The `frozen` zone is the load-bearing one for §3.3's icy-friction path** (`sectionAtPoint(cart) == 'frozen'`).

#### Spawn point & entrance

- **Spawn point** (`spawnPoint`): `Offset(size.width/2 + 60, size.height - 100)` = **(1260, 1500)**. This is the walkable cart start, just inside the south entrance, offset 60 px east of center.
- **Entrance opening** (`entranceRect`, a convenience rect): `(600, 1540, 400, 60)` → x `600..1000`, y `1540..1600`. This aligns with the south-wall gap (x 600..1000). Note its top (y=1540) sits 20 px above the wall band top (y=1560).

> Unity mapping: spawn point → a spawn `Transform` / empty GameObject. Entrance gap → simply the absence of wall collider between x 600..1000 on the south edge; optionally a trigger volume for "player entered store".

#### Bounds / "inside" test

`isInside(x, y, radius)` is true when the circle of `radius` is fully within the store rectangle AND not overlapping any solid:
`x-radius >= 0 && y-radius >= 0 && x+radius <= w && y+radius <= h && blockingAt(x,y,radius) == null`.

`randomWalkablePoint(rng, radius=18)` rejection-samples up to **40 attempts** for a uniformly random point passing `isInside`; on failure returns `spawnPoint`. Default sampling radius **18 px**.

#### Collision model (circle-vs-rect slide solver) — Unity replaces this

The Dart game models the cart/NPCs as a **circle** and all fixtures as axis-aligned rectangles. Two routines:

- **`_circleRectOverlap(cx, cy, r, rect)`**: clamps the circle center to the rect (`closestX = cx.clamp(left,right)`, `closestY = cy.clamp(top,bottom)`), then tests `dx*dx + dy*dy < r*r`. Strict `<` (touching exactly = not blocking).
- **`blockingAt(x, y, r)`**: linear scan over `solids`, returns the **first** overlapping `SolidRect` (or null). O(n) per query.
- **`slide(fromX, fromY, toX, toY, radius)`**: **independent axis-sweep** wall-slide. Procedure:
  1. Start at `(fromX, fromY)`.
  2. Try the **full X move first**: if `blockingAt(toX, fromY, r) == null` AND `toX-r >= 0` AND `toX+r <= w`, accept `x = toX`; else keep `fromX`.
  3. Then try the **Y move** using the (possibly updated) `x`: if `blockingAt(x, toY, r) == null` AND `toY-r >= 0` AND `toY+r <= h`, accept `y = toY`; else keep current `y`.
  4. Return `Offset(x, y)`.
  This gives "slide along walls" behavior for mostly axis-aligned shelves; it is all-or-nothing per axis (no partial penetration resolution), and bounds-clamping to the store rect is baked into the same check.

> Unity mapping: **discard this solver entirely.** Replace with standard Unity collision: each `SolidRect` → a static `BoxCollider`; the cart/NPC → a `CharacterController` (capsule) or `Rigidbody`+`CapsuleCollider`. `CharacterController.Move()` provides the slide-along-walls behavior natively (and handles corners better than the independent axis-sweep). Store bounds (the `x±r within [0,w]`, `y±r within [0,h]` clamps) → either four perimeter wall colliders (already present as `wall` SolidRects, except the south gap) plus invisible bounding colliders, or a clamp in the movement script. `blockingAt`/`isInside` point queries → `Physics.CheckSphere`/`Physics.OverlapSphere` against the fixture layer. `randomWalkablePoint` → sample + `Physics.CheckSphere` rejection (or use NavMesh `SamplePosition` if NPCs use a NavMeshAgent). **If you need bit-identical motion (e.g. for replay parity), replicate the axis-independent sweep verbatim instead.**

#### Source

File: `C:\Users\joshu\LucidSpaces\Apps\groceryDash\lib\game\world\store_layout.dart` (lines 96–236 contain the full floor plan factory, spawn point, and entrance rect; lines 49–71 and 242–270 contain the collision/slide solver).

---

### 3.3 Player, Cart, Interaction & Scoring

This subsystem covers the player character, the shopping cart, shelf-slot interaction (grab/contest), checkout scanning, NPC bumps/theft, scoring, and the run-end flow. The Flutter game class is `GroceryDashGame extends FlameGame`; in Unity this maps to a top-level **GameManager MonoBehaviour** that owns the run, with Player and Cart as separate `GameObject`s (they can be at different world positions). All distances/positions are in **pixels** in the source world; pick a consistent pixels-to-units scale in Unity (e.g. 1px = 0.01m) and divide every constant below by that scale once, globally.

> Coordinate convention (verbatim from source): angles are in **radians**, `0 = east`, and increase clockwise in screen space (because `+y` is downward). `facing = math.pi / 2` points "south"/down; spawn sets facing `-math.pi/2` ("north"/up, into the store). When porting to Unity's left-handed/up-is-+Y or 3D coordinates, keep the *relationships* (forward = `(cos h, sin h)`, "behind" = subtract that vector) and convert the axis sign once.

#### 1. State machines

##### PlayerMode (enum, verbatim)
| Value | Meaning |
|-------|---------|
| `pushing` | Pushing the cart; joystick steers the **cart**. |
| `onFoot` | Walking without a cart; joystick steers the **person**. |
| `reaching` | Frozen at a shelf slot, reach animation running. |
| `checkout` | At the checkout, scan animation running. |

Derived predicates (verbatim):
- `isReaching` = `mode == reaching`
- `isAtCheckout` = `mode == checkout`
- `canSteer` = `mode == pushing || mode == onFoot`

**Transitions:**
- `pushing → onFoot`: park the cart (`toggleCartAttached`, cart attached → parked).
- `onFoot → pushing`: take the cart back (`toggleCartAttached`, only if player within **60px** of cart).
- `pushing|onFoot → reaching`: press interact while a non-empty focused slot exists (`onInteractPressed`).
- `reaching → pushing|onFoot`: reach completes or is cancelled; returns to `pushing` if cart attached, else `onFoot`.
- `pushing|onFoot → checkout`: press interact while `list.allComplete` and within **80px** of a checkout interact point.
- `checkout → (run end)`: scan completes → `_endRun(cleared: true)`.

While `reaching` or `checkout`, `toggleCartAttached` and `onInteractPressed` are no-ops (guarded).

##### CartState (enum, verbatim)
| Value | Meaning |
|-------|---------|
| `attached` | Moves with the player. |
| `parked` | Abandoned in the aisle; stays where it was left. |

**Transitions** (via `toggleCartAttached`, no-op if `!_worldReady`, `_runOver`, or player is `reaching`/`checkout`):
- `attached → parked`: sets `cart.vx=cart.vy=0`, `player.mode=onFoot`, `cartParkedNotifier=true`, plays park clunk, banner `"Cart parked. Mind the aisle — and your stuff."`
- `parked → attached`: only if `dist(player, cart) <= 60`. If `> 60`: banner `"Walk back to your cart to take it."` and abort. On success: `player.mode=pushing`, reset `cart.unattendedTimer=0`, `cartParkedNotifier=false`, `unattendedNotifier=0`, clear banner.

**Unity mapping:** model both enums as plain C# enums. The two state machines are tightly coupled — drive them from the GameManager `Update()`. Player = `CharacterController` (kinematic, custom velocity). Cart = a separate object that, while `attached`, is positioned procedurally behind the cart heading (see §3); while `parked`, it is static.

#### 2. Movement / physics constants (VERBATIM — these are playtested tuning, transfer unchanged)

| Constant | Value | Meaning |
|----------|-------|---------|
| `_playerWalkSpeed` | `260` | px/s, on foot |
| `_cartMaxSpeed` | `220` | px/s, when pushing cart (hard clamp on cart speed) |
| `_cartAccel` | `900` | px/s² |
| `_cartFriction` | `5.0` | velocity decay rate when idle |
| `_cartBrakeFriction` | `14.0` | extra decay when braking |
| `_icyFrictionMult` | `0.35` | friction multiplier in the `frozen` aisle (slippery) |
| `_playerRadius` | `14` | px |
| `_cartRadius` | `22` | px |

Player entity fields: `x, y, vx=0, vy=0, facing=pi/2, mode=pushing`. Cart entity fields: `x, y, vx=0, vy=0, heading=pi/2, state=attached, basket=[]`, `unattendedTimer=0`.

Friction is applied as **exponential-ish per-frame decay**, not a constant deceleration: `v -= v * min(1.0, frictionRate * frictionMult * dt)`. Velocity snaps to 0 when `|v| < 1`. **Preserve the `min(1.0, …)` clamp** — it prevents friction from overshooting and reversing velocity at large `dt`.

Joystick deadzone: movement only applies when `joystick.distance > 0.08`. Stick magnitude is clamped to `[0,1]`.

**Unity mapping:** because friction is custom exponential decay and there is a hard speed clamp + custom wall-sliding, do **not** use a physics-driven `Rigidbody` with PhysicMaterial friction. Implement the cart as a kinematic body with manual velocity integration in `FixedUpdate`/`Update`, exactly as below. The "icy" multiplier is a floor-region property — query it from a trigger volume tagged `frozen` (see §3 control modes).

#### 3. Control modes (two input schemes, selected by camera mode)

There are two distinct control schemes for both pushing and on-foot, switched on `cameraMode == firstPerson`:

**A. First-person (tank) controls — pushing cart** (`_updatePushingCart`, firstPerson branch):
- `turnRate = 2.6` rad/s at full stick. `cart.heading += joystick.dx * 2.6 * dt`; `player.facing = cart.heading`.
- `forwardAmount = -joystick.dy` (stick up = forward).
- Brake detection: `_isBraking = vSpeed > 20 && forwardAmount < -0.2 && (cart.v · forwardUnit) > 0`.
- Icy check: `icy = layout.sectionAtPoint(cart.x,cart.y) == 'frozen'`; `frictionMult = icy ? 0.35 : 1.0`.
- If `mag > 0.08`: accelerate along heading: `cart.v += forwardUnit * forwardAmount * 900 * dt`. If braking, additionally apply brake decay (`_cartBrakeFriction * frictionMult`). Play wheel squeak.
- Else: apply idle friction (`_cartFriction * frictionMult`), snap to 0 below 1.

**B. Analog top-down controls — pushing cart** (else branch, follow-cam / map):
- If `mag > 0.08`: `cart.v += joystick * 900 * dt`; `targetHeading = atan2(joystick.dy, joystick.dx)`; `cart.heading = lerpAngle(cart.heading, targetHeading, dt*5)`.
- Else: idle friction (`_cartFriction`, no icy mult in this branch), snap to 0 below 1.

After either branch: clamp speed to `_cartMaxSpeed=220`. Then **wall-slide movement**: compute `nx,ny = pos + v*dt`, run through `layout.slide(...)` then `slideAroundPallets(...)` (both external collision helpers). If a slide axis returned the original coordinate (i.e. blocked), zero that velocity component. Commit `cart.x/y`.

**Cart-pushing player attachment (verbatim):** the player is snapped to a fixed point **28px behind** the cart along its heading every frame:
```
player.x = cart.x - cos(cart.heading) * 28
player.y = cart.y - sin(cart.heading) * 28
player.facing = cart.heading
```

**On-foot controls** (`_updateOnFoot`):
- First-person: `turnRate = 2.8`; `player.facing += joystick.dx * 2.8 * dt`; `forward = -joystick.dy`; if `mag>0.08`, `player.v = forwardUnit * 260 * forward`, else v=0. (No inertia — velocity is set directly, not accumulated.)
- Top-down: if `mag>0.08`, `player.v = joystick * 260 * mag`; `player.facing = atan2(joystick.dy, joystick.dx)`; else v=0.
- Move with the same `slide` + `slideAroundPallets` against `_playerRadius=14`. (On foot does **not** zero velocity on blocked axes — it just stops at the slid position.)

> Note: on-foot has **no friction/inertia** — velocity is set or zeroed directly each frame. Only the cart has inertia.

**Unity mapping:** the two control schemes correspond to two camera rigs. Keep a `CameraMode`-driven branch in the movement controller. `layout.slide` / `slideAroundPallets` are grid/AABB collision-and-slide; in Unity use `CharacterController.Move` (which slides natively) or a manual cast-and-deflect. The `frozen` floor region becomes a trigger volume; set `frictionMult` while the cart's collider is inside it.

#### 4. Reach-to-grab mechanic + timing

**Focus targeting** (`_updateInteraction`, every frame): the focused slot is `shelfIndex.nearest(player.x, player.y, within: 60)` — the closest **non-empty** slot within **60px** of the player. (Note: `ShelfIndex.nearest` default `within` is `46`, but the game overrides it to `60`.) When the focused slot identity changes, bump `shelfFaceTickNotifier` (HUD only).

**Reach timing (VERBATIM):**
- `reachTotal = 0.9` seconds (normal grab).
- `reachTotal = 1.7` seconds (contested grab — see §5).
- `Player.checkoutTotal = 2.5` (static const, used for checkout, see §6).

**Begin reach** (`onInteractPressed`, after checkout check fails): requires a non-empty `_focusedSlot`. Sets `mode=reaching`, `reachingForItem=slot.item`, `reachTimer=0`, picks `reachTotal` (0.9 or 1.7), resets `joystick=zero`.

**During reach** (`_updateReaching`):
- `reachTimer += dt`; `reachProgress = clamp(reachTimer/reachTotal, 0, 1)`.
- **Cancel condition:** if `joystick.distance > 0.5`, cancel the reach immediately. (There is an outer guard `joystick.distance > 0.3 || !interactHeld` but the actual cancel only fires at `> 0.5`; releasing interact alone does **not** cancel.)
- When `reachTimer >= reachTotal`: complete reach.

**Complete reach** (`_completeReach`): if focused slot still non-empty AND `slot.item == reachingForItem`: `slot.stock--`, `cart.addItem(slot.item)`, `list.recount(cart)`, play pickup chime. If `list.allComplete` now: push PA announcement `"List complete. Please proceed to checkout."` (tone `sale`) and banner `"List complete. Head to checkout."`. If this was a won contest, kick the NPC off (see §5). Then clears contest flag and calls `_cancelReach()` to restore mode.

**Cancel reach** (`_cancelReach`): if cancelled mid-contest, the NPC wins the slot (see §5). Restores `mode = attached ? pushing : onFoot`, resets `reachTimer=0`, `reachingForItem=null`, `reachTotal=0.9`, `reachProgress=0`, clears `_contestOpponent`.

**Unity mapping:** reach is a **coroutine timer** (or a timed state in the movement state machine) gated on the focus query. The 60px focus search → a small **trigger volume / OverlapSphere** on the player against shelf-slot colliders, picking the nearest non-empty one. Each `ShelfSlot` is a small anchor transform in front of the shelf face.

#### 5. Item-contest mechanic + timing

**Contest detection** (`_updateInteraction`, after focus is set): `_contestOpponent` = the first NPC whose `occupyingSlot` is identical to the focused slot AND whose `state` is `browsing` or `reaching`. Else null.

**On grab into a contested slot** (`onInteractPressed`): `reachTotal = 1.7` (extended to give the NPC a fair chance), `contestNotifier=true`, play contest-open sound, NPC says a line from `kContestLines` for **2.0s**, banner `"Contested! Hold to grab it first."`

`kContestLines` (VERBATIM):
- `"Hey, I was here first!"`
- `"That's mine!"`  *(source uses unicode `\u2019` apostrophe)*
- `"Not so fast."`

**Player wins** (reach completes during contest, `_completeReach`): NPC `occupyingSlot=null`, `state=crossing`, `target=null`; NPC says one of `['Hmph.', 'Fine.', 'Unbelievable.']` for **1.8s**.

**Player loses** (cancel mid-contest by moving stick `>0.5`, `_cancelReach`): if opponent and slot still valid and non-empty: `slot.stock--` (NPC consumes the stock), NPC `occupyingSlot=null`, `state=crossing`, `target=null`; NPC says one of `['Thanks for the hesitation.', 'Told you.']` for **2.0s**; banner `"They grabbed the {item.name}."`. Clears contest flag.

**Unity mapping:** a contest is purely a flag + extended timer; no extra physics. The "NPC occupying slot" is owned by the NPC subsystem — expose `occupyingSlot` / `state` on the NPC component and query it during the focus update.

#### 6. Checkout scan + timing

**Eligibility** (`onInteractPressed`): only when `list.allComplete` and player within **80px** (`d < 80`) of any `checkout.interactPoint`. Calls `_beginCheckout`.

**Begin checkout** (`_beginCheckout`): `mode=checkout`, `checkoutTimer=0`, `checkoutProgress=0`, `atCheckoutNotifier=false`, banner `"Scanning…"`.

**During scan** (`_updateCheckoutScan`):
- `checkoutTimer += dt`; `checkoutProgress = clamp(checkoutTimer / 2.5, 0, 1)`.
- **Scanner beep cadence:** one beep every `0.4s` — fires when `floor(checkoutTimer/0.4) > floor(prevTimer/0.4)`.
- When `checkoutTimer >= 2.5` (`Player.checkoutTotal`): `_endRun(cleared: true)`.

Checkout cannot be cancelled (no stick-cancel path). The scan total is **2.5s** verbatim.

**Checkout-ready HUD gating** (`_resolveCheckoutReady`, each tick): `atCheckoutNotifier=true` iff `list.allComplete` AND within **80px** of a checkout; else false.

**Unity mapping:** checkout = a **coroutine timer** of 2.5s with an interval beep (use a modulo-tracking accumulator, not `WaitForSeconds`, to match the exact `floor` cadence). The checkout interact point is a trigger volume of ~80px radius near each lane.

#### 7. ShelfSlot model + stock depletion

`ShelfSlot` fields (verbatim):
| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `item` | `ItemDef` | — | the product in this slot |
| `position` | world point | — | pickup anchor, in front of the shelf face |
| `facing` | `int` | — | `-1` = west face, `1` = east face, `0` = top (bins/fridges, single accessible face) |
| `stock` | `int` | `5` | units available |
| `empty` (getter) | bool | — | `stock <= 0` |

**Depletion:** every successful grab does `slot.stock--`. A losing contest also decrements stock (NPC takes one). Empty slots are skipped by `nearest()` (and by `shelfFaceSlots()` / compass).

`ShelfIndex`: flat list of all slots. `nearest(x,y, within=46)` returns the closest non-empty slot whose squared distance `< within²`, else null. (Game calls it with `within: 60`.)

`shelfFaceSlots()` (HUD grouping; logic-relevant for shelf panel): all non-empty slots with the same `facing` sign as the focus, grouped by tight axial distance: for vertical faces (`facing != 0`) `|dx| < 60 && |dy| < 240`; for top faces (`facing == 0`) `|dy| < 60 && |dx| < 180`.

**Unity mapping:** `ItemDef` → **ScriptableObject** (id, name, score, coin — referenced in §10). Each `ShelfSlot` → a component on an anchor transform with a serialized `stock` (default 5) and `facing`. `ShelfIndex` → a registry/list maintained by the store world; or skip it and rely on physics `OverlapSphere` for `nearest`. Keep `stock` as authored data so the playtested default of 5 transfers. *(Slot population geometry — slots-per-face, face offsets, item rotation — is specified in §3.4 §5 since the NPC subsystem builds it.)*

#### 8. NPC bumps — impact / knockback tiers (VERBATIM)

Collision resolution runs every movement frame (`_resolveNpcBumps`, called from both pushing and on-foot updates).

- Collision radius: `pushing ? _cartRadius+18 (=40) : _playerRadius+18 (=32)`.
- Impact origin = cart pos (pushing) or player pos (on foot).
- `impactSpeed` = magnitude of cart velocity (pushing) or player velocity (on foot).
- Skip NPCs that are `consumed` or `isStunned`.
- Collision when squared distance `< radius²`. Normal `(nx,ny)` = direction from impact origin to NPC.

**Tier thresholds (verbatim):**
| Tier | Condition | Knockback dist | Stun duration | Screen shake | Dialogue pool | Dialogue dur |
|------|-----------|----------------|---------------|--------------|---------------|--------------|
| 0 (light) | `impactSpeed <= 90` | `8.0` px | `0.4`s | `0.0` | `kBumpLinesByPersonality` | `1.4`s |
| 1 (medium) | `90 < impactSpeed <= 170` | `22.0` px | `1.0`s | `0.18` | `kBumpLinesByPersonality` | `1.4`s |
| 2 (heavy) | `impactSpeed > 170` | `46.0` px | `2.2`s | `0.45` | `_painLinesByPersonality` | `2.2`s |

(Source comment lists intended stuns as 0.6/2.2 but the actual `switch` is **0.4 / 1.0 / 2.2** — use the code values.)

- NPC is pushed `normal * knockDist`. If NPC was `browsing` or `crossing`, set `state=stunned`, `stateTimer=` the tier stun.
- `_shake = max(_shake, tierShake)`.
- NPC speaks from the tier's persona pool.

**Velocity response after a bump:**
- Decompose impact velocity onto the normal: `vNorm = v·n`. If `vNorm > 0`, subtract `0.7 * vNorm * n` (cancel 70% of the inbound normal component).
- Then scale total velocity: **cart × 0.75**, **player × 0.5**.
- Play thud (cart intensity scales with resulting speed/maxspeed clamped `[0.3,1.0]`; player thud fixed intensity `0.5`).

**Screen shake decay** (`update`): `_shake = max(0, _shake - dt*2.5)`; offset magnitude `m = _shake*16`, random `[-m,m]` on X and Y each frame; zero when `_shake==0`. Applied as a render-canvas translate.

**Bump dialogue pools (VERBATIM):**

`kBumpLinesByPersonality`:
- `browser`: `['Excuse me!', 'Watch it!', 'Oof.', 'Rude.']`
- `couponer`: `['I had a coupon for that!', 'Excuse me, dearie.', 'Wait your turn.', 'Hmph.']`
- `parent`: `["Careful, my kid's right there!", 'Oh my god.', 'Sorry, sorry!', 'Hey, slow down.']`
- `rusher`: `['MOVE!', 'Coming through!', 'Behind you!', 'Out of my way!']`
- `worker`: `["Aisle's busy, friend.", 'Let me work.', 'Careful of the pallet.', 'Coming through with stock!']`

`_painLinesByPersonality` (tier-2 / run-over):
- `browser`: `['OW!', 'What the—?!', 'Hey watch where—', 'Ugh.']`
- `couponer`: `['Well I never!', 'My HIP!', 'Someone call the manager!']`
- `parent`: `["Oh no, you okay buddy?", 'Seriously?!', "We're leaving."]`
- `rusher`: `['OOF!', 'FORGET THIS.', '#@!*']`
- `worker`: `['You OK pal?', "I'll report this.", 'Dude.']`

Persona pools fall back to the `browser` pool if a persona key is missing. *(Full string detail with glyph notes is also in §3.5.)*

**Unity mapping:** bump detection → `OverlapSphere` (radius 40/32) or trigger volume on cart/player against NPC colliders, resolved manually (NPCs are not rigidbodies here). Screen shake → a camera-shake component reading a decaying scalar. Dialogue pools → a `ScriptableObject` per personality holding `bumpLines` and `painLines` string arrays. NPC `state`/`stateTimer`/`occupyingSlot`/`stolenItem`/`consumed`/`isStunned`/`isThieving` live on the NPC component (NPC subsystem, §3.4).

#### 9. Cart theft (parked cart) + recovery

**Unattended timer** (`_updateCartUnattended`): while `parked`, `cart.unattendedTimer += dt` and mirror to `unattendedNotifier`. While `attached`, both reset to 0. The world tick is given the parked cart position (`unattendedCart`) so the NPC subsystem can route a thief.

**Theft resolution** (`_resolveNpcThefts`, only while `parked`): for each NPC where `isThieving && stolenItem != null`:
- The world marks a pending theft by setting `stolenItem == kItems.first` (a placeholder sentinel) when the thief first touches the cart.
- Guard: `stateTimer > 0 && basket not empty && stolenItem == kItems.first && rng() < 0.9` → steal: remove a **random** basket item, set `n.stolenItem = thatItem`, `list.recount`, `_itemsStolenByNpcs++`, play thief warning, NPC says a `kThiefLines` line for **2.4s**, push PA announcement `"They took your {item.name}. Catch them to get it back!"` (warning) + banner `"Someone took your {item.name}!"`.

`kThiefLines` (VERBATIM): `['Finders keepers.', 'Pardon me.', 'Mine now.', 'Oops. Taking this.']`

**Recovery** (inside `_resolveNpcBumps`): if the bumped NPC is `fleeing` and `stolenItem != null`: add the item back to the cart, recount, `_itemsStolenByNpcs = max(0, _itemsStolenByNpcs-1)`, clear `stolenItem`, `n.consumed=true` (thief leaves the map), play pickup chime, PA `"Got your {item.name} back."` (sale) + banner `"Recovered your {item.name}!"`.

> Note on RNG: `_rng()` returns a **fresh `math.Random()` each call** (time-seeded). In Unity use `UnityEngine.Random` or a single shared `System.Random`; behavior is statistically equivalent. The `0.9` steal probability and "remove a random basket item" must be preserved.

**Unity mapping:** the theft state lives on the NPC; the GameManager only resolves consequences on the basket and counters. Keep `_itemsStolenByNpcs` as a run-level int (drives the scoring penalty, §10).

#### 10. Scoring + penalties + coins (run end) — VERBATIM

Computed once in `_endRun`. `cleared` is true only via successful checkout (the only call site passes `cleared: true`).

```
score = sum(item.score for item in cart.basket)
      + (cleared ? 300 : 0)            // clear bonus
      - _itemsStolenByNpcs * 20         // per-stolen-item penalty

coins = sum(item.coin for item in cart.basket)
      + (cleared ? 20 : 0)             // clear coin bonus
```

- **Clear bonus:** `+300` score, `+20` coins.
- **Per-stolen-item penalty:** `-20` score each (net of recovered items — `_itemsStolenByNpcs` is decremented on recovery).
- Final `score` and `coins` are clamped to `[0, 2^30]` (`1 << 30`).
- Per-item `score` and `coin` come from `ItemDef` (the item data subsystem, §3.1).

**Basket identity string** (verbatim):
- `cleared && list.allComplete` → `"List Crusher"`
- `cleared && !list.allComplete` → `"Light Shopper"`  *(checkout requires `allComplete`, so this branch is effectively unreachable in normal play)*
- `!cleared` → `"Walked Out"`

**RunResult payload** (verbatim fields): `score` (clamped), `coinsEarned` (clamped), `duration = Duration(ms = round(_elapsed*1000))`, `basket` (immutable copy), `completedCombos = []`, `crashCause = null`, `basketIdentity`, `isNewHighScore = score > previousHighScore`, `fragilesBroken = 0`. (combos/crashCause/fragilesBroken are vestigial — always empty/0/null in this mode.)

**Unity mapping:** `RunResult` → a plain serializable struct/class returned via an event/callback (`onRunEnded`). Compute once; clamp; do not award passive score elsewhere — there is **no passive score, no combos, no powerups** (per the class doc).

#### 11. Run-end flow

`_endRun({cleared})`:
1. If already `_runOver`, return (idempotent).
2. Set `_runOver = true`, `paused = true` (freezes all `update` logic — the first guard in `update` is `if (!_worldReady || _runOver || paused) return`).
3. Compute score/coins/identity (§10).
4. Fire `onRunEnded(RunResult(...))`.

The **only** path to run end in this subsystem is checkout completion (`_updateCheckoutScan` → `_endRun(cleared:true)`). There is no timer, no crash, no fail state in this mode — `cleared` is always true here, but keep the `_endRun(cleared:false)` path (identity `"Walked Out"`, no bonus) for the API since it's wired.

**Unity mapping:** `_endRun` → a `EndRun(bool cleared)` method that sets a `runOver` flag (gate `Update`), raises a `RunEnded` UnityEvent/C# event with the result struct, and transitions to a results scene/screen.

#### 12. Camera modes (the `CameraMode` list — referenced, defined in `data/modes.dart`)

Three modes are switched on in `render` and gate the control scheme (§3):
- `topDown` → TopDownRenderer, **analog** controls.
- `firstPerson` → FirstPersonRenderer (with head-bob), **tank** controls.
- `sideScroll` → FollowCamRenderer, treated like top-down for control (the firstPerson branch is the only tank branch; sideScroll/topDown both use analog).

(Camera mode is held in a `ValueNotifier<CameraMode>`; the enum itself lives in `data/modes.dart` — see §3.1 for its exact members. The control-scheme dependency is the load-bearing fact here: **only `firstPerson` uses tank/turn controls and the icy-friction path.**)

**Unity mapping:** three Cinemachine virtual cameras (or camera rigs) selected by a `CameraMode` enum; the active mode also selects which input-handling branch runs. Head-bob is FPV-only and is a render concern (out of scope for logic, but the `_fpv.updateHeadBob(dt, speed)` call is driven by velocity magnitude — cart speed when pushing, player speed otherwise).

#### Misc logic constants worth carrying over (referenced above, collected)
- Re-attach cart proximity: **60px**. Checkout proximity: **80px**. Focus search radius: **60px** (override of the 46px default).
- Player-behind-cart offset: **28px**.
- Tank turn rates: cart **2.6** rad/s, on-foot **2.8** rad/s. Top-down heading lerp rates: cart heading→target `dt*5`; FPV display-heading lag `dt*7`; cart pitch lerp `dt*8` (display heading & pitch are visual-polish only).
- Brake detection threshold: `vSpeed > 20`, `forwardAmount < -0.2`.
- Joystick deadzone: `0.08`. Reach cancel stick threshold: `0.5`.
- Footstep audio (on-foot) fires above `bobSpeed > 60`, intensity `(bobSpeed/260).clamp(0.2,1.0)` — audio only.

**Source files:** `C:\Users\joshu\LucidSpaces\Apps\groceryDash\lib\game\entities.dart`, `C:\Users\joshu\LucidSpaces\Apps\groceryDash\lib\game\world\shelf.dart`, `C:\Users\joshu\LucidSpaces\Apps\groceryDash\lib\game\grocery_dash_game.dart`.

---

### 3.4 NPC & Thief AI

This subsystem lives entirely in `lib/game/world/store_world.dart` (with supporting types in `shelf.dart` and `store_layout.dart`). It is engine-agnostic CPU logic that updates a flat `List<Npc>` once per frame via `StoreWorld.tick(dt, ...)`. Movement is via direct vector integration plus an axis-independent "slide" collision against static rectangles — **there is no pathfinding**. The Unity port can either replicate the slide logic verbatim or swap to a `NavMeshAgent`; both mappings are noted below.

> **Coordinate system:** world space is pixels, `+x` = right (east), `+y` = down (south). Store is `2400 × 1600`. All distances/speeds below are in these pixel units (speeds are px/sec). Many distance checks are done as **squared** distances (`_d2`) to avoid `sqrt`; the spec lists both the squared constant and its linear radius.

#### 1. NPC State Machine

**Unity mapping:** `enum NpcState` → a plain C# enum on the NPC MonoBehaviour. The whole `_tickNpc` body becomes the agent's per-frame `Update` (or a manager that iterates all agents). `target` becomes either a `Vector3` destination set on a `NavMeshAgent.SetDestination`, or a manual steer target.

##### States (`enum NpcState`) — verbatim

| State | Meaning |
|---|---|
| `browsing` | Walking to a target point or reading a shelf (default initial state). |
| `reaching` | Standing in front of a shelf slot, occupying it (stationary). |
| `crossing` | Walking across open floor to another section. |
| `stunned` | Briefly knocked off path after a collision. |
| `thieving` | Walking to an unattended cart to nick an item. |
| `fleeing` | Thief escaping with a stolen item. |
| `chasing` | NPC pursuing the player (**reserved; unused** — present in enum + speed table only). |

Initial state of every NPC at spawn: `browsing`, `stateTimer = 0`, `target = null`.

##### Per-NPC mutable fields (`class Npc`)

| Field | Init | Purpose |
|---|---|---|
| `x, y` | spawn point | world position |
| `vx, vy` | 0 | velocity, recomputed each move as `(newPos - oldPos)/dt` |
| `wobble` | 0 | accumulates `+= dt` every tick unconditionally (render-only bob; keep for visual fidelity) |
| `consumed` | false | mark-for-removal flag (despawn) |
| `state` | `browsing` | current state |
| `stateTimer` | 0 | countdown seconds; drives state-exit transitions |
| `target` | null | `Offset?` destination point |
| `occupyingSlot` | null | `ShelfSlot?` currently reserved/blocked |
| `stolenItem` | null | `ItemDef?` item nicked from a cart |
| `dialogue` | null | current speech-bubble string (render-only) |
| `dialogueTimer` | 0 | counts down; clears `dialogue` at ≤0 |
| `personality` | `browser` | archetype (set at spawn) |
| `preferredSectionId` | null | only set for couponers |

Derived getters: `isStunned = state==stunned`, `isReaching = state==reaching`, `isThieving = state==thieving`.

##### Tick order (per NPC, per frame) — exact sequence

`StoreWorld.tick(dt, {playerX, playerY, unattendedCart})` iterates all `npcs`. For each NPC:

1. **Skip if `consumed`.**
2. `wobble += dt`.
3. If `dialogueTimer > 0`: `dialogueTimer -= dt`; if it hits ≤0, set `dialogue = null`.
4. **Skip the rest if `def.id == 'spill'` or `def.id == 'grapes'`** — these are inert hazard props that share the NPC list but never move or think.
5. Call `_tickNpc(...)`.

`_tickNpc` then runs this exact pipeline:

**Phase A — stateTimer expiry transitions.** If `stateTimer > 0`, decrement by `dt`; if it crosses ≤0, run the exit handler for the **current** state:

| Expiring state | Action on expiry |
|---|---|
| `stunned` | → `browsing`; `target = null`. |
| `reaching` | If `occupyingSlot != null && !slot.empty` then **`slot.stock--`** (the NPC "took" one unit). Set `occupyingSlot = null`. → `browsing`; `target = null`. **Remove any pallet whose `owner` is this NPC** (`pallets.removeWhere(identical owner)`). |
| `thieving` | → `fleeing`; `target = _farCorner(playerX, playerY)`; **`stateTimer = 12.0`**. |
| `fleeing` | **Timed out, not caught:** `consumed = true` (despawn); `target = null`. Stolen item is lost permanently. |
| `chasing` | → `browsing`; `target = null`. |
| `browsing` / `crossing` | no-op (these states are not driven by the timer). |

**Phase B — thief trigger.** (Detailed in §4.) Tested only when `state == browsing`.

**Phase C — target acquisition / jitter.** Compute `jittered = rng.nextDouble() < personality.jitterChance`. Then, **only if** `state ∈ {browsing, crossing}` AND (`target == null` OR within arrival radius of target OR `jittered`), call `_pickNewTarget(n)`.
- Arrival test here: `_d2(x, y, target.x, target.y) < 24*24` (i.e. within **24 px**).

**Phase D — early-out for stationary states.** `if (isStunned || isReaching) return;` — stunned and reaching NPCs do not move.

**Phase E — movement.** (Detailed in §3.) Steer toward `target`, integrate, collide via `layout.slide`.

**Phase F — arrival resolution.** After moving:
- **Shelf arrival:** if `state == browsing` AND `_d2(pos, target) < 24*24` AND `occupyingSlot != null` → enter `reaching`. Set `stateTimer = lo + rng()*(hi-lo)` from `personality.lingerRange`. If `personality == worker`, **drop a pallet** (see §6). `return`.
- **Cart arrival (thief):** if `isThieving` AND `unattendedCart != null` AND `_d2(pos, cart) < 30*30` (within **30 px**) → set `stateTimer = 0.6`; set `stolenItem ??= kItems.first` (placeholder; the game class overwrites with the real item on the frame the thieving timer expires). State stays `thieving` until the 0.6 s timer expires (then Phase A flips it to `fleeing`).

> **Unity note:** the `??= kItems.first` placeholder is a handshake with an external "game class" not in this file: the world sets a non-null `stolenItem` flag, the game layer reads it and substitutes the actual stolen item. Port this as an event/callback (`OnThiefGrabbedCart(npc)`) so the gameplay layer can decide *which* of the player's items is stolen.

#### 2. NpcPersonality types & tuning (VERBATIM)

**Unity mapping:** ideal as a `ScriptableObject` per personality (a `PersonalityProfile` asset) holding the four tunables below; the enum-switch becomes an asset reference on the NPC.

##### `enum NpcPersonality` — verbatim

`browser`, `couponer`, `parent`, `rusher`, `worker`.

Descriptions (from source comments): browser = default, takes their time, no section preference; couponer = slow, lingers a long time, hoards one section; parent = jittery, changes direction often, short linger; rusher = in a hurry, fast, rude; worker = stocker, stays at shelves longer, moderate speed.

##### `speedMult` — exact

| Personality | speedMult |
|---|---|
| browser | **1.0** |
| couponer | **0.55** |
| parent | **1.1** |
| rusher | **1.55** |
| worker | **0.75** |

##### `lingerRange` — exact `(min, max)` seconds at a shelf slot

| Personality | min | max |
|---|---|---|
| browser | **2.0** | **4.0** |
| couponer | **4.0** | **7.0** |
| parent | **0.9** | **1.8** |
| rusher | **0.6** | **1.4** |
| worker | **3.0** | **5.0** |

Linger applied at `reaching` entry as `stateTimer = min + rng.nextDouble() * (max - min)`.

##### `jitterChance` — exact (per-frame probability of re-picking target mid-path)

| Personality | jitterChance |
|---|---|
| parent | **0.003** |
| rusher | **0.001** |
| all others (browser, couponer, worker) | **0.0** |

> **Unity note:** `jitterChance` is evaluated **per frame**, so its effective rate is framerate-dependent in the original. To preserve playtested feel at a fixed-ish framerate, keep it per-frame; if you want frame-rate independence, convert to per-second probability `p_sec` and test `rng < 1 - pow(1 - p_sec, dt)`. Flag this as a behavior-equivalence decision, not a free change.

##### `_pickNewTarget` per-personality "picks shelf" threshold — exact

Probability that a new target is a **shelf slot** (vs. a random walkable floor point / crossing):

| Personality | picksShelfThreshold |
|---|---|
| rusher | **0.25** |
| couponer | **0.9** |
| worker | **0.85** |
| browser / parent (default) | **0.7** |

#### 3. Movement & collision (Phase E detail)

Given a non-null `target` and not stunned/reaching:

1. `dx = target.x - x`, `dy = target.y - y`, `d = sqrt(dx²+dy²)`. **If `d < 1`, return** (arrived; don't move).
2. **Base speed by obstacle def id** (px/s):

   | `def.id` | baseSpeed |
   |---|---|
   | `cart` | **110.0** |
   | `kid` | **90.0** |
   | `stocker` | **50.0** |
   | anything else (e.g. `shopper`) | **60.0** |

3. **State speed multiplier:** `fleeing` → **1.8**, `chasing` → **1.5**, otherwise **1.0**.
4. `speed = baseSpeed * personality.speedMult * stateMult`.
5. Proposed position: `nx = x + (dx/d)*speed*dt`, `ny = y + (dy/d)*speed*dt`.
6. `slid = layout.slide(x, y, nx, ny, 18)` — collide with **radius 18**.
7. `vx = (slid.x - x)/dt; vy = (slid.y - y)/dt; x = slid.x; y = slid.y`.

**`layout.slide(fromX, fromY, toX, toY, radius)` algorithm (axis-independent sweep):**
- Start `x=fromX, y=fromY`.
- If `blockingAt(toX, y, radius) == null` AND `toX-radius ≥ 0` AND `toX+radius ≤ width`, accept `x = toX`.
- Then if `blockingAt(x, toY, radius) == null` AND `toY-radius ≥ 0` AND `toY+radius ≤ height`, accept `y = toY`.
- Return `(x, y)`. (X resolved first, then Y using the possibly-updated X.)

**`blockingAt(x, y, radius)`** returns the first `SolidRect` whose rectangle overlaps a circle of `radius` at `(x,y)`, using closest-point clamp: `closest = clamp(c, rect)`, overlap if `(c-closest)² < r²`. Solids include perimeter walls, shelves, produce bins, counters, and fridges (see §7 geometry / §3.2).

> **NPC collision does NOT consult pallets.** `slide` only checks static `solids`. Pallets (`blockedByPallet`/`slideAroundPallets`) exist for the **player cart**, not NPCs. NPCs (including the stocker who placed the pallet) walk through pallets freely. Preserve this asymmetry unless you intend a behavior change.

> **Unity mapping:** Option A — replicate `slide` exactly with axis-swept circle-vs-AABB for bit-identical motion (recommended for fidelity). Option B — `NavMeshAgent` with `speed = baseSpeed*speedMult*stateMult`, `radius ≈ 18`, walls/shelves/bins/fridges baked as carving obstacles. With NavMesh, the "arrived within 24 px" / "within 30 px" tests map to `agent.remainingDistance`. Note Option B changes pathing (agents will route *around* shelves instead of sliding along them).

#### 4. Thief mechanic (end-to-end)

The single most important behavior. Driven entirely by the `unattendedCart` argument to `tick` (an `Offset?` the gameplay layer passes when the player's cart is abandoned; pass `null` when the cart is attended).

**Lifecycle:**

1. **Trigger (Phase B).** For an NPC in `browsing` state, every frame, become a thief iff ALL hold:
   - `unattendedCart != null`
   - `state == browsing` and `!isThieving`
   - `_d2(x, y, cart.x, cart.y) < 240*240` → within **240 px** of the cart
   - `rng.nextDouble() < dt / 8` → roughly a **1-in-8-per-second** Poisson-ish chance (per-frame `dt/8`).
   - On trigger: `state = thieving`; `target = unattendedCart`; `stateTimer = 0`.

2. **Approach.** As a `thieving` NPC, it is **not** in `{browsing, crossing}`, so Phase C never re-picks its target — it walks straight at the cart position using normal §3 movement (no state speed bonus while thieving: stateMult = 1.0).

3. **Grab (Phase F cart arrival).** When `isThieving` AND `unattendedCart != null` AND `_d2(pos, cart) < 30*30` (**30 px**): set `stateTimer = 0.6` (grab animation window) and `stolenItem ??= kItems.first` (placeholder flag; gameplay layer assigns the real item). State remains `thieving`.

4. **Flee (Phase A, thieving timer expiry).** When the 0.6 s timer expires: `state = fleeing`; `target = _farCorner(playerX, playerY)`; `stateTimer = 12.0`. While fleeing, movement uses **stateMult 1.8** (fast). The stolen item is rendered above the thief's head.
   - `_farCorner(x, y)` picks, among these four candidates, the one with max squared distance from `(x,y)`:
     `(120, 300)`, `(w-120, 300)`, `(120, h-260)`, `(w-120, h-260)` — i.e. `(120,300)`, `(2280,300)`, `(120,1340)`, `(2280,1340)` for the standard `2400×1600` store.

5. **Despawn if not caught (Phase A, fleeing timer expiry).** If the 12.0 s flee timer runs out: `consumed = true`, `target = null` → NPC removed; **stolen item lost for good**.

6. **Catch / recover.** **Not implemented in this file.** There is no catch test here — `chasing` state and any catch/recover logic are external (the gameplay layer is expected to detect player–thief contact during `fleeing`, recover `stolenItem`, and presumably set `consumed`/reset state). *(See §3.3 §9 — recovery happens in `_resolveNpcBumps`: bumping a `fleeing` NPC with a `stolenItem` refunds the item and sets `consumed=true`.)*

> **Unity mapping:** thief perception = a 240-px-radius trigger sphere (or distance check) around the cart, enabled only while the cart is unattended. Grab = 30-px proximity. Flee target = farthest of four hardcoded corner points → `NavMeshAgent.SetDestination`. Despawn = 12 s timer. Implement catch as a separate collision/trigger between player and a fleeing thief that fires `OnThiefCaught(npc, stolenItem)` so the gameplay layer can refund the item and despawn — and build the `chasing` branch only if you add player-pursuit.

> **Subtle ordering note for fidelity:** a thief is created from a `browsing` NPC, so on the *same* frame Phase B promotes it, Phase C is skipped (state is now `thieving`, not in `{browsing,crossing}`) and Phase D does not early-out — it moves toward the cart immediately. Preserve this so thieves don't lose a frame.

#### 5. Shelf index & nearest-slot query

**`ShelfSlot`** (in `shelf.dart`):
- `item: ItemDef`, `position: Offset` (pickup anchor in front of the face), `facing: int` (**-1 = west face, 1 = east face, 0 = top** for bins/fridges), `stock: int` (default **5**).
- `empty` getter: `stock <= 0`.

**`ShelfIndex`** = flat `List<ShelfSlot> slots` built once in `populate()`.
- **`nearest(x, y, {within = 46})`**: linear scan of all slots; skips `empty` slots; returns the non-empty slot with smallest squared distance whose squared distance `< within*within` (default radius **46 px**), else `null`. (Used by the player to pick from shelves; NPCs don't call `nearest` — they random-sample, see §9.)

**Slot population** (`populate()` walks `layout.solids` by kind):
- **Shelf** (`_populateShelfFaces`): item id pool = `section.itemIdsPrimary + section.itemIdsSecondary`; skip if empty. **6 slots per face**, both west and east faces (12 total per shelf).
  - For slot `i` (0..5): `t = (i+0.5)/6`, `y = rect.top + rect.height*t`.
  - West: `position = (rect.left - 28, y)`, `facing = -1`, item = pool[`i % len`].
  - East: `position = (rect.right + 28, y)`, `facing = 1`, item = pool[`(i+3) % len`] (rotated by 3 so faces differ).
- **Produce bin** (`_populateBin`): pool = `itemIdsPrimary` (or `[kItems.first.id]` if empty). **2 slots on top**: `position = (center.x ∓ 24, top - 18)` (i=0 → -24, i=1 → +24), `facing = 0`, item = pool[`i % len`].
- **Fridge** (`_populateFridgeFace`): pool = `itemIdsPrimary` (or `[kItems.first.id]`). **5 slots, west face only**: `t = (i+0.5)/5`, `y = top + height*t`, `position = (rect.left - 28, y)`, `facing = -1`, item = pool[`i % len`].
- **Counter / wall:** no slots.

> **Unity mapping:** `ShelfSlot` → a small data class or a marker MonoBehaviour at the anchor transform; `ShelfIndex` → a manager holding the list (or a spatial hash if profiling demands — the original is brute-force linear and fine for this scale). `nearest` → distance query; with few hundred slots, keep it linear.

#### 6. Stocker / pallet / restock logic

- **Stocker NPCs** are obstacle id `'stocker'` and are **always** assigned personality `worker` (see §8 roll). baseSpeed 50, speedMult 0.75 → effective 37.5 px/s; high shelf-pick threshold (0.85) and long linger (3–5 s).
- **Pallet drop:** when a `worker` enters `reaching` (Phase F shelf arrival), it spawns a `Pallet`:
  - `palletX = n.x + (slot.facing == -1 ? +40 : -40)` (offset toward the open-floor side opposite the shelf face), `y = n.y`, `owner = n`, `life = 10.0` (default; note: `life` is **never decremented** in this file — removal is owner-driven, see below).
  - `Pallet` fields: `x, y, owner (Npc), life=10.0, consumed=false`.
- **Pallet removal:** when the owner stocker leaves `reaching` (Phase A reaching expiry), `pallets.removeWhere((p) => identical(p.owner, n))` — the pallet vanishes with its stocker's departure. (So a pallet's effective lifetime == the stocker's linger time, 3–5 s, not the `life=10` value.)
- **Pallet collision (player cart only):**
  - `blockedByPallet(x, y, radius)`: pallets are axis-aligned squares with **half-extent 24** (≈44–48 px square; comment says "~44-unit"). Closest-point clamp to `[p.x±24, p.y±24]`; blocked if `(c-closest)² < radius²`. Skips `consumed` pallets.
  - `slideAroundPallets(fromX, fromY, toX, toY, radius)`: same axis-independent sweep as `layout.slide` but against pallets — accept X if `!blockedByPallet(toX, y, r)`, then accept Y if `!blockedByPallet(x, toY, r)`.

> **Unity mapping:** Pallet → a prefab with a ~48×48 box collider/trigger that obstructs only the player cart (e.g. on a "PlayerBlocker" layer the NPCs ignore). Lifecycle is bound to its owner stocker's reaching state — destroy the pallet prefab when the stocker exits `reaching`, not on a timer. `life=10` is effectively dead data; preserve the field if you want a fallback timeout, but the real driver is owner departure.

#### 7. Store geometry referenced by AI (from `StoreLayout.standard()`)

Needed because the AI samples `randomWalkablePoint`, tests zone membership, and uses absolute corner coords. *(Full geometry is in §3.2; the AI-relevant subset is collected here.)*

- **Store size:** `2400 × 1600`. Wall thickness 40.
- **`randomWalkablePoint(rng, radius=18)`:** up to **40 attempts** of uniform random `(x,y)` in `[0,width)×[0,height)`; returns first point where `isInside(x, y, 18)` (inside bounds AND not blocking any solid). Fallback after 40 fails: `spawnPoint = (width/2 + 60, height - 100) = (1260, 1500)`.
- **`spawnPoint`** (cart): `(1260, 1500)`. **`entranceRect`:** `(600, 1540, 400, 60)`.
- **Solids** (all `SolidRect`, used by `blockingAt`/`slide`):
  - 5 perimeter wall pieces (note south wall is split to leave the entrance gap): N `(0,0,2400,40)`; S-left `(0,1560,600,40)`; S-right `(1000,1560,1400,40)`; W `(0,0,40,1600)`; E `(2360,0,40,1600)`.
  - **Produce bins** (4): centers `(200+i*180, 120)` for i=0..3, each `120×80`.
  - **Bakery bins** (3): centers `(1000+i*180, 120)`, `120×80`.
  - **Deli counter:** `(1700,120,500,80)`.
  - **5 center aisles** (N–S shelves), sections `['snacks','household','snacks','household','snacks']`: each center `(360+i*360, 360+880/2=800)`, size `80×880`.
  - **Fridges:** dairy `(2060,280,260,400)`, frozen `(2060,720,260,400)`.
  - **Checkout counters** (3): centers `(240+i*240, 1340)`, `180×50`. Checkout lanes are derived in `populate()` for counters with `rect.top ≥ height-300` (i.e. `≥1300`): `interactPoint = (center.x, top - 40)`.
- **Zones** (`SectionZone`, used for couponer section filtering and aisle signs): produce `(0,0,900,240)`; bakery `(900,0,700,240)`; deli `(1600,0,800,240)`; per-aisle `(cx-180, 240, 360, 920)`; dairy `(1920,240,480,900)`; frozen `(1920,1140,480,400)`; household `(0,1280,900,320)`.
- **Aisle signs:** one per unique `sectionId`, placed at the **center of the first zone** with that id (dedup via a set, in zone iteration order).

#### 8. NPC spawning & weighted personality distribution

**Spawn count:** `populate()` calls `_spawnNpcs(12)` → **12 NPCs**.

**Obstacle-def spawn pool (uniform pick, with weighting by repetition):**
```
['shopper', 'shopper', 'shopper', 'stocker', 'kid', 'cart']
```
6 entries → `rng.nextInt(6)`. Effective spawn weights: **shopper 3/6 (50%)**, stocker 1/6, kid 1/6, cart 1/6. Each spawns at a `randomWalkablePoint`. The def is looked up in `kObstacles` by id (fallback `kObstacles.first` = `beans`, which would not normally occur given the pool).

**Relevant obstacle defs** (from `obstacles.dart`, see §3.1): `shopper` "Slow Shopper" 🧓; `stocker` "Stock Clerk" 👷; `kid` "Running Kid" 🧒; `cart` "Runaway Cart" 🛒. (`spill`/`grapes` are inert hazards skipped in tick — not in the spawn pool but handled defensively.)

**Personality roll `_rollPersonality(defId)` — verbatim:**
- `defId == 'stocker'` → **always `worker`**.
- `defId == 'cart'` → **always `rusher`**.
- `defId == 'kid'` → `rng.nextDouble() < 0.5` ? **`parent`** : **`browser`** (50/50; kids are never couponers).
- **Regular shoppers** — weighted by `r = rng.nextDouble()`:
  - `r < 0.40` → `browser` (**40%**)
  - `r < 0.65` → `couponer` (**25%**)
  - `r < 0.85` → `parent` (**20%**)
  - else → `rusher` (**15%**)

**Couponer post-roll:** if the assigned personality is `couponer`, set `preferredSectionId = kSections[rng.nextInt(7)].id` (random of the 7 sections: produce, bakery, deli, dairy, frozen, snacks, household). Couponers then strongly bias `_pickNewTarget` toward slots in that section.

> **Unity mapping:** spawn as a weighted prefab table (a `WeightedSpawnTable` ScriptableObject mirroring the 6-entry pool). Personality roll → a method on the spawner that branches on the prefab/def id exactly as above. Seed the RNG (`StoreWorld(seed:)`) for deterministic spawns if reproducibility matters — the constructor takes an optional `seed` and uses Dart `Random(seed)`; mirror with `System.Random` or `Unity.Mathematics.Random` (note: cross-language RNG sequences will NOT match bit-for-bit, so don't expect identical worlds across engines — only identical *distributions*).

#### 9. `_pickNewTarget` (target selection) — full algorithm

Called from Phase C for `browsing`/`crossing` NPCs needing a destination.

1. `picksShelfThreshold` per personality (table in §2). `picksShelf = rng.nextDouble() < threshold`.
2. **If `picksShelf` AND `shelfIndex.slots` non-empty:**
   - Build `candidates`:
     - If personality is `couponer` AND `preferredSectionId != null`: filter `slots` to those whose `position` falls inside a zone with `sectionId == preferredSectionId` (zone lookup via `zones.firstWhere(rect.contains(pos), orElse: zones.first)`).
     - Else: `candidates = all slots`.
   - If `candidates` non-empty, attempt up to **20 times**:
     - Pick random `s = candidates[rng.nextInt(len)]`.
     - **Skip if `s.empty`.**
     - **Skip if already taken** (any other NPC has `occupyingSlot == s`).
     - On success: `state = browsing`; `target = s.position`; `occupyingSlot = s`; return.
3. **Fallback (no shelf chosen / all attempts failed):** `state = crossing`; `target = layout.randomWalkablePoint(rng)`.

> Slot reservation is cooperative: an NPC sets `occupyingSlot` as soon as it *targets* a slot (not on arrival), and others check that field to avoid double-booking. The reservation is cleared on `reaching` expiry (after decrementing stock) or implicitly when a new target is chosen. **Unity mapping:** a `HashSet<ShelfSlot>` of reserved slots, or a `reservedBy` field on the slot; replicate the "reserve on target, release on reaching-exit" timing.

#### 10. Shopping-list generation

**`generateShoppingList(targetCount)`** — produces the player's list (not NPC behavior, but lives here and was requested):
1. Loop until a `Set<String> ids` reaches `targetCount` unique ids:
   - Pick a random section `kSections[rng.nextInt(7)]`.
   - If `section.itemIdsPrimary` is empty, `continue` (retry).
   - Add `itemIdsPrimary[rng.nextInt(len)]` to the set.
2. Return each id mapped to a **quantity of `1 + rng.nextInt(2)`** → i.e. **1 or 2** of each item.

**Primary item pools by section** (verbatim, for list generation — only *primary* pools are drawn):
- produce: `apple, banana, oj`
- bakery: `bread, cake`
- deli: `cheese, beef, hotdog, lobster`
- dairy: `milk, eggs, cheese`
- frozen: `icecream, pizza`
- snacks: `chips, soda, candy, popcorn`
- household: `batteries, tp, tissues, water`

(`cheese` appears in both deli and dairy primaries — duplicate ids dedup naturally via the set.)

> **Unity mapping:** straightforward — a method returning `List<KeyValuePair<string,int>>` (or a `ShoppingListEntry` struct list). Section/item pools belong on the `SectionDef` ScriptableObjects.

#### 11. Constants quick-reference (all VERBATIM)

| Constant | Value | Where |
|---|---|---|
| NPC spawn count | **12** | `_spawnNpcs(12)` |
| Spawn pool weights | shopper×3, stocker, kid, cart | `_spawnNpcs` |
| Thief detect radius | **240** px (`240*240`) | Phase B |
| Thief trigger chance/frame | **`dt/8`** | Phase B |
| Thief grab radius | **30** px (`30*30`) | Phase F |
| Grab animation time | **0.6** s | Phase F |
| Flee timeout (despawn) | **12.0** s | thieving→fleeing |
| Flee speed mult | **1.8** | §3 |
| Chase speed mult (reserved) | **1.5** | §3 |
| Target-arrival radius | **24** px (`24*24`) | Phase C & F |
| NPC collision radius | **18** | `slide(...,18)` |
| `randomWalkablePoint` radius / attempts | **18** / **40** | layout |
| `_pickNewTarget` retry attempts | **20** | §9 |
| `nearest` default `within` | **46** px | `ShelfIndex` |
| Slot default stock | **5** | `ShelfSlot` |
| Slots per shelf face | **6** (×2 faces) | populate |
| East-face item rotation | **+3** | populate |
| Slots per bin | **2** | populate |
| Slots per fridge | **5** (west only) | populate |
| Slot face offset | **±28** (shelf/fridge), **±24** / **−18** (bin) | populate |
| Pallet half-extent | **24** (≈48 sq) | `blockedByPallet` |
| Pallet offset from stocker | **±40** | Phase F |
| Pallet `life` (unused timer) | **10.0** | `Pallet` |
| baseSpeed cart/kid/stocker/other | **110/90/50/60** | §3 |
| Flee corners | `(120,300)`,`(2280,300)`,`(120,1340)`,`(2280,1340)` | `_farCorner` |
| Shopping-list per-item qty | **1 + rng.nextInt(2)** → 1–2 | §10 |
| Inert (skipped) ids | `spill`, `grapes` | tick |

#### 12. Porting gotchas / behavior-equivalence flags

1. **No pathfinding.** Original uses straight-line steering + axis slide. A `NavMeshAgent` will visibly change routing. Decide per-NPC whether fidelity (replicate slide) or polish (NavMesh) wins. Recommended: replicate slide for the playtested feel; it's cheap.
2. **`jitterChance` is per-frame** → framerate-dependent. See §2 note.
3. **Thief chance `dt/8` is per-frame** but scaled by `dt`, so it *is* roughly framerate-independent (≈0.125/sec). Keep as `dt/8`.
4. **NPCs ignore pallets**; only the player cart is blocked. Don't put pallets on a layer NPCs collide with.
5. **Pallet life is owner-bound, not timer-bound** — `life=10` never ticks down here.
6. **`stolenItem` placeholder handshake** with an external game class — port as an event so the gameplay layer picks the real stolen item and handles catch/recover (neither is in this file).
7. **`chasing` state is unused** — wire it only if adding player pursuit; the speed mult (1.5) and the trivial `chasing→browsing` expiry are the only existing references.
8. **Cross-language RNG** won't reproduce identical worlds; only distributions transfer. Don't hash-compare seeded layouts across engines.
9. **`wobble += dt` runs even for inert props** (it's before the spill/grapes skip) — keep if the renderer uses it for hazard bob.

**Source files:** logic — `C:\Users\joshu\LucidSpaces\Apps\groceryDash\lib\game\world\store_world.dart`; slot/index types — `...\lib\game\world\shelf.dart`; geometry — `...\lib\game\world\store_layout.dart`; defs — `...\lib\game\data\obstacles.dart`, `...\lib\game\data\sections.dart`.

---

### 3.5 Flavor & Announcement Strings

All player-facing string content extracted verbatim from `announcements.dart`, `store_world.dart`, and `grocery_dash_game.dart`. Numbers in parentheses (e.g. duration, tone) are the runtime parameters tied to each string and must transfer with it.

**Unity mapping (overall):** Build these as a single localization string table (e.g. Unity Localization `String Table`, or a `ScriptableObject` of `string[]` pools keyed by category/personality). Randomized pools map to a helper `RandomLine(poolKey)`. The dialogue/announcement "tone" and "duration" values belong alongside each entry as table metadata or as fields on a `LineDef` struct.

#### 1. PA Ambient Announcements (rotating pool)

Source: `announcements.dart` → `_ambientLines`. Picked at random when the announcement queue is idle. Default tone = `info`. Each line holds on screen for `4.0s`; ambient cooldown between lines = `4 + random(0..4)s` (initial cooldown `6.0s`).

| # | String |
|---|--------|
| 1 | `Attention shoppers — our deli is serving fresh today.` |
| 2 | `Reminder: please return carts to the corral.` |
| 3 | `Thank you for shopping with us.` |
| 4 | `Our floral department has spring arrangements available.` |
| 5 | `Price check on aisle three, please.` |
| 6 | `The store will be closing in… some amount of time.` |
| 7 | `Receipts are required for all exchanges.` |
| 8 | `Customer service is located near the front entrance.` |

**Unity mapping:** `AnnouncementTone` enum (`info`, `sale`, `warning`) → a C# enum. The `AnnouncementQueue` becomes a MonoBehaviour/service holding a queue + current line; HUD subscribes (replaces Flutter `ValueListenable`).

#### 2. PA Event Announcements (pushed by gameplay)

Source: `grocery_dash_game.dart`. These are template strings with interpolated values; placeholders shown as `{section}` / `{item}`. Pushed to the front of the announcement queue. Each shows for `4.0s`.

| Trigger | Tone | String (template) |
|---------|------|-------------------|
| New restocking pallet placed in a section | `warning` | `Caution: restocking in {section}.` |
| Shopping list fully completed (on item pickup) | `sale` | `List complete. Please proceed to checkout.` |
| NPC steals an item from parked cart | `warning` | `They took your {item}. Catch them to get it back!` |
| Player recovers a stolen item by catching the thief | `sale` | `Got your {item} back.` |

`{section}` resolves to `sectionById(...).name`; `{item}` resolves to `item.name`. (Section/item display names live in §3.1.)

#### 3. Banner / Toast Strings (bottom-of-screen one-shot banner)

Source: `grocery_dash_game.dart` → `_setBanner(...)`. Single transient banner (`bannerNotifier`). Passing `null` clears the banner. `{item}` = `item.name`.

| Trigger | String |
|---------|--------|
| Parked the cart (Park/Take button) | `Cart parked. Mind the aisle — and your stuff.` |
| Tried to take cart while too far from it (>60px) | `Walk back to your cart to take it.` |
| Began a contested grab | `Contested! Hold to grab it first.` |
| Began checkout scan | `Scanning…` |
| Lost a contest (player bailed; NPC took it) | `They grabbed the {item}.` |
| NPC stole an item from parked cart | `Someone took your {item}!` |
| Recovered a stolen item | `Recovered your {item}!` |
| Completed list (on final item pickup) | `List complete. Head to checkout.` |
| Re-attaching to cart successfully | *(cleared — `null`)* |

**Unity mapping:** single banner field/event; `Scanning…` and the ellipsis in line #6 use the real Unicode ellipsis `…` (U+2026), preserve verbatim.

#### 4. NPC Bump Lines — Tier 0/1 (light/medium collision), by personality

Source: `grocery_dash_game.dart` → `kBumpLinesByPersonality`. One picked at random on a non-heavy bump. Displayed as speech bubble for `1.4s`. Fallback pool if a personality is missing = `browser`.

**browser**: `Excuse me!` | `Watch it!` | `Oof.` | `Rude.`
**couponer**: `I had a coupon for that!` | `Excuse me, dearie.` | `Wait your turn.` | `Hmph.`
**parent**: `Careful, my kid's right there!` | `Oh my god.` | `Sorry, sorry!` | `Hey, slow down.`
**rusher**: `MOVE!` | `Coming through!` | `Behind you!` | `Out of my way!`
**worker**: `Aisle's busy, friend.` | `Let me work.` | `Careful of the pallet.` | `Coming through with stock!`

Note: in `parent` line 1 and `worker` line 1, the apostrophes are escaped in Dart (`kid\'s`, `Aisle\'s`); the actual characters are plain apostrophes `'`.

#### 5. NPC Pain Lines — Tier 2 (run over / heavy collision), by personality

Source: `grocery_dash_game.dart` → `_painLinesByPersonality`. Picked at random when impact speed > 170 px/s. Displayed for `2.2s`. Fallback pool = `browser`.

**browser**: `OW!` | `What the—?!` | `Hey watch where—` | `Ugh.`
**couponer**: `Well I never!` | `My HIP!` | `Someone call the manager!`
**parent**: `Oh no, you okay buddy?` | `Seriously?!` | `We're leaving.`
**rusher**: `OOF!` | `FORGET THIS.` | `#@!*`
**worker**: `You OK pal?` | `I'll report this.` | `Dude.`

Note: `What the—?!` and `Hey watch where—` use an em dash `—` (U+2014). `We're` / `I'll` use plain apostrophes. Preserve all verbatim.

#### 6. Thief Lines (NPC just stole from cart)

Source: `grocery_dash_game.dart` → `kThiefLines`. One picked at random when a thieving NPC nicks an item. Displayed for `2.4s`.

`Finders keepers.` | `Pardon me.` | `Mine now.` | `Oops. Taking this.`

#### 7. Contest Lines (NPC reacts to player contesting a shelf slot)

Source: `grocery_dash_game.dart` → `kContestLines`. One picked at random when a contest opens. Displayed for `2.0s`.

`Hey, I was here first!` | `That's mine!` | `Not so fast.`

Note: `That's mine!` uses a Unicode right single quote `'` (U+2019) in source (`That\u2019s mine!`), unlike the other lines which use ASCII `'`. Preserve U+2019 verbatim.

#### 8. Contest Outcome Lines (inline pools, NPC reaction)

Source: `grocery_dash_game.dart`, defined inline at the call sites.

**Player bailed the contest — NPC wins (smug)** — displayed for `2.0s`:
`Thanks for the hesitation.` | `Told you.`

**Player won the contest — NPC annoyed** — displayed for `1.8s`:
`Hmph.` | `Fine.` | `Unbelievable.`

#### 9. HUD Interact Prompts

Source: `grocery_dash_game.dart` → `InteractPrompt` factory constructors. `{item}` = `item.name`.

| Context | label | subLabel |
|---------|-------|----------|
| Near a non-empty shelf slot | `GRAB` | `{item}` |
| Near checkout with list complete | `SCAN` | `Checkout` |

#### 10. Compass Hint Label

Source: `grocery_dash_game.dart` → `_updateCompass`. The compass chip's `label`:
- When list complete: literal string `Checkout`.
- Otherwise: the nearest needed item's display name (`best.item.name` — from item data).

#### 11. Run-End Identity Labels (results/receipt screen)

Source: `grocery_dash_game.dart` → `_endRun`. `basketIdentity` string assigned at run end:

| Condition | String |
|-----------|--------|
| Cleared run AND list fully complete | `List Crusher` |
| Cleared run but list NOT fully complete | `Light Shopper` |
| Did not clear (walked out) | `Walked Out` |

#### Cross-references (not strings, but referenced by the templates above)
- `{section}` placeholders resolve via `sectionById(id).name` — section display names live in §3.1 (`lib/game/data/sections.dart`).
- `{item}` placeholders resolve via `ItemDef.name` — item display names live in §3.1 (`lib/game/data/items.dart`).

#### Glyph preservation checklist (critical for verbatim transfer)
- `…` U+2026 (horizontal ellipsis): ambient line #6, banner `Scanning…`.
- `—` U+2014 (em dash): event/banner copy ("Mind the aisle — and your stuff.", "Cart parked. Mind the aisle…", ambient lines #1 & #6, pain lines `What the—?!`, `Hey watch where—`).
- `'` U+2019 (right single quote): contest line `That's mine!` only.
- All other apostrophes are ASCII `'` (U+0027), including Dart-escaped ones (`kid\'s`, `Aisle\'s`, `We\'re`, `I\'ll`).

---

## 4. Recommended port order (smallest playable slice first)

A phased checklist for a solo dev. Each phase ends with something you can run and feel. Do not move on until the current phase is playable. Tuning numbers come from §3 — paste, don't invent.

### Phase 0 — Project skeleton
- [ ] New Unity 6 project (URP or built-in, your call — rendering is greybox first).
- [ ] Adopt the global pixels→units scale (**100 px = 1 wu** recommended). Write one `const float PX = 0.01f` and divide every source constant by it once.
- [ ] Decide the coordinate mapping (XZ ground plane; pick the Y-flip convention from §3.2 and apply everywhere).
- [ ] Stub the `GameManager` MonoBehaviour that will own the run; a `CameraMode` enum field switching three (empty for now) camera rigs.

### Phase 1 — First-person walk + pushable cart (the core feel)
- [ ] Greybox floor plane + four perimeter walls as `BoxCollider`s (from §3.2 wall rects, minus the south gap).
- [ ] Player as a `CharacterController`. Cart as a separate kinematic object.
- [ ] Implement `PlayerMode` (pushing/onFoot) and `CartState` (attached/parked) state machines (§3.3 §1).
- [ ] Movement constants verbatim (§3.3 §2): walk 260, cart max 220, accel 900, friction 5.0/14.0, radii 14/22. Custom exponential friction with the `min(1.0, …)` clamp — **not** Rigidbody friction.
- [ ] First-person tank controls (turn 2.6 cart / 2.8 foot, stick-up = forward, deadzone 0.08). Player snapped 28px behind cart heading (§3.3 §3).
- [ ] Park/take cart with the 60px proximity rule.
- [ ] Wall-slide via `CharacterController.Move` (replaces `slide()`).
- [ ] **Milestone:** you can drive a cart around an empty room, park it, walk on foot, and pick it back up.

### Phase 2 — One shelf + reach-to-grab + depletion (the verb)
- [ ] Add one shelf `BoxCollider` (use aisle 0 geometry from §3.2). Place `ShelfSlot` anchor transforms with `facing` and `stock=5` (§3.4 §5 population rules: 6 per face, ±28 offset, +3 east rotation).
- [ ] Build `ShelfIndex.nearest` (override `within=60`) as an `OverlapSphere` or list scan (§3.3 §4, §3.4 §5).
- [ ] Reach state + timer: `reachTotal=0.9`, progress clamp, cancel at stick `>0.5`, complete → `stock--` + add to basket (§3.3 §4).
- [ ] HUD interact prompt `GRAB / {item}` (§3.5 §9).
- [ ] **Milestone:** walk/push to a shelf, hold to grab, watch stock deplete, item enters the basket.

### Phase 3 — NPCs + thief (the chaos)
- [ ] NPC MonoBehaviour with `NpcState` + the §3.4 §1 field set. Decide: replicate `slide` (fidelity) or `NavMeshAgent` (polish) — bake the NavMesh if the latter.
- [ ] `PersonalityProfile` ScriptableObjects (speedMult, lingerRange, jitterChance, picksShelfThreshold — §3.4 §2).
- [ ] Spawn 12 NPCs via the weighted pool (shopper×3, stocker, kid, cart) + `_rollPersonality` (§3.4 §8).
- [ ] Full `_tickNpc` pipeline Phases A–F, `_pickNewTarget` with cooperative slot reservation (§3.4 §1, §9).
- [ ] Stocker pallets (owner-bound lifetime, player-cart-only collision — §3.4 §6).
- [ ] **Thief lifecycle** end-to-end (§3.4 §4): 240px detect, `dt/8` trigger, 30px grab, 0.6s grab, flee to far corner at 1.8× for 12s, despawn on timeout. Wire the `OnThiefGrabbedCart` event so the gameplay layer assigns the real stolen item.
- [ ] NPC bumps + knockback tiers (§3.3 §8): radii 40/32, thresholds 90/170, knock 8/22/46, stun 0.4/1.0/2.2, shake 0/0.18/0.45, velocity response (70% normal cancel, ×0.75 cart / ×0.5 player), screen shake decay `dt*2.5`.
- [ ] Theft + recovery (§3.3 §9): 0.9 steal chance on parked cart, recover by bumping a fleeing thief.
- [ ] **Milestone:** a living store — shoppers browse, stockers drop pallets, a thief can rob your parked cart and you can chase them down to recover the item.

### Phase 4 — Scoring + modes + run end (the loop)
- [ ] Checkout: 80px eligibility (requires `list.allComplete`), 2.5s scan with 0.4s beep cadence, `_endRun(cleared:true)` (§3.3 §6, §11).
- [ ] Scoring formula verbatim (§3.3 §10): item scores + 300 clear / −20 per stolen; coins + 20 clear; clamp `[0, 2^30]`; `basketIdentity` labels; `RunResult` struct via `onRunEnded` event.
- [ ] `GameMode` / `CameraMode` enums + UI strings (§3.1). Wire the three camera rigs and their control-scheme branch (only firstPerson = tank + icy path).
- [ ] Shopping-list generation (§3.4 §10): unique ids from primary pools, qty 1–2 each.
- [ ] Frozen-aisle icy friction (0.35) via a `frozen` trigger volume (§3.3 §3).
- [ ] **Milestone:** a full run from spawn to receipt with a real score and identity label, in all three camera modes.

### Phase 5 — Build the full store from the greybox spec
- [ ] Lay in every fixture from §3.2: all produce/bakery bins, deli counter, 5 aisles with alternating sections, 2 fridges, 3 checkouts, the split south wall + entrance gap.
- [ ] Populate every shelf/bin/fridge with slots per §3.4 §5.
- [ ] Section zones as trigger volumes (§3.2) for floor tint + couponer filtering + aisle signs.
- [ ] Spawn point (1260,1500) + entrance trigger.
- [ ] **Milestone:** the real store layout, navigable end-to-end.

### Phase 6 — Data tables + flavor (the texture)
- [ ] Author all ScriptableObject assets: 30 items, 7 sections, 2 carts, 10 obstacles (§3.1). Colors via `#RRGGBB`.
- [ ] Wire item scores/coins into scoring; section pools into shelf population & list generation; cart unlock economy.
- [ ] Import every string pool (§3.5) into a string table with tone/duration metadata. **Verify the glyph checklist** (U+2026, U+2014, U+2019) survives the import encoding.
- [ ] PA announcement queue (4.0s hold, 4+rand(0..4)s cooldown, 6.0s initial) + banner system + per-personality dialogue pools with `browser` fallback.
- [ ] **Milestone:** the world talks — PA chatter, NPC barks, banners, the compass, run-end identities.

### Phase 7 — Polish (after parity)
- [ ] Real art/prefabs per `ItemShape` / `ShelfStyle`; real cameras (Cinemachine), head-bob (FPV only).
- [ ] Audio: rebuild the SFX triggers noted inline (wheel squeak, park clunk, pickup chime, thud scaled by speed, scanner beep, footsteps above bobSpeed 60).
- [ ] Screen-shake camera component reading the decaying scalar.
- [ ] Cart skins, unlock UI, high-score persistence.
- [ ] Only now consider tuning changes — and only against the playtested baseline above.

> **Throughout:** drive ALL HUD updates from C# events fired *after* logic ticks. Never mutate UI mid-build (the Flutter `setState`-during-build bug — see §2). And remember cross-engine RNG only matches *distributions*, not sequences — don't chase bit-identical worlds.

---

*End of porting bible. Every numeric constant, enum value, and string above is transcribed verbatim from the playtested Flutter/Flame build and must transfer to Unity unchanged. Source files are cited at the end of each subsystem section under `C:\Users\joshu\LucidSpaces\Apps\groceryDash\lib\game\`.*
