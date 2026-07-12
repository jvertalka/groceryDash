# GROCERY DASH 3D — The Production Playbook
**Version 2.0 — the complete specification**

> **What this document is.** The definitive, implementation-ready bible for the
> final version of Grocery Dash 3D: product, design, experience, content, art,
> audio, engineering, delivery. It is written against the shipped codebase in
> `game/` — every number, coordinate, and constant it cites is real. Chapters
> specify systems completely: full tables, full lists, full schemas. Where a
> system is not yet built it is specified to be buildable without further design
> work and appears in the Ch. 25 backlog.
>
> **How to use it.** This is the contract. Work either implements a chapter,
> tunes a live system within a chapter's stated ranges, or amends this document
> first.

## Table of Contents
- **FOUNDATION** — Part 0: What Exists (shipped systems + engineering doctrine)
- **PART I — PRODUCT & DESIGN**
  - Chapter 1 — Vision, Pillars, Audience & Success Criteria
  - Chapter 2 — Game Modes — Complete Rulesets
  - Chapter 3 — Career Mode — All 40 Shifts
  - Chapter 4 — Scoring, Grades & Economy
  - Chapter 5 — Progression, Achievements, Dailies & Unlocks
- **PART II — EXPERIENCE**
  - Chapter 6 — Front-End Flow & Every Screen
  - Chapter 7 — HUD — Final Specification
  - Chapter 8 — Input — Complete Specification
  - Chapter 9 — Player Presence & Game Feel
  - Chapter 10 — Onboarding & Tutorialization
  - Chapter 11 — Accessibility — Production Bar
  - Chapter 12 — Results, Stats & Sharing
- **PART III — WORLD & CONTENT**
  - Chapter 13 — Art Direction & the Brand Universe
  - Chapter 14 — Interior — Final Build-Out
  - Chapter 15 — Exterior, Weather & Time-of-Day
  - Chapter 16 — The Catalog — All ~150 SKUs
  - Chapter 17 — NPCs, AI & the Crowd
  - Chapter 18 — Audio — Complete Design
- **PART IV — ENGINEERING**
  - Chapter 19 — Technical Architecture — Modules & APIs
  - Chapter 20 — Data Schemas & Persistence
  - Chapter 21 — Rendering & Performance
  - Chapter 22 — Physics — Complete Specification
  - Chapter 23 — Testing, Verification & CI
  - Chapter 24 — Release Engineering, Ops & Telemetry
- **PART V — DELIVERY**
  - Chapter 25 — Work Breakdown & Delivery Waves
  - Chapter 26 — Risks, QA Plan & Definition of Done

---

# PART 0 — WHAT EXISTS: THE SHIPPED FOUNDATION

Everything in Part 0 is live, verified, and committed. It is the substrate all
later parts build on.

## 0.1 The world

A 46×30 m, 4.2 m-tall **supercenter** with two personalities under one roof:

| Zone | Contents |
|---|---|
| **Grocery (west)** | 4 double-sided gondola islands (16 m, aisles 1–4), glass-door freezer wall (10 lit doors), bakery back wall, 6-table photoscanned produce corner, wine nook |
| **Front strip** | 6 checkout lanes (2 staffed with photoscanned registers, lane 6 closed), cart corral, basket stack, gumball machines, WELCOME mat, sliding glass doors, EXIT sign |
| **General merch (east)** | Electronics (8 glowing demo TVs over boxed stock + 2 cross-grain gondolas), apparel (6 circular racks + folded-stack tables on carpet), toys (wire ball bin + island), pharmacy (counter + glowing green cross) |
| **Exterior** | Night parking lot: 8 Kenney cars in striped stalls with wheel stops, lamp posts with light pools, crosswalk, red bollards, outdoor cart-return corral, oil stains, lit skyline, gradient sky dome |

Dressing density: endcap displays with SALE blades on every gondola end, pallet
stacks, price rail tags per product run, yellow deal tags, department murals,
hanging aisle signs, wall clock, security cameras, EMPLOYEES ONLY door, wet-floor
cone, restock boxes and crates, potted plants.

## 0.2 The catalog

**52 SKUs** across 9 sections (pantry, snacks, household, dairy, bakery, frozen,
produce, electronics, home, toys, pharmacy). Two asset classes, deliberately mixed:

- **Procedural packaging** — canvas-drawn labels (fake brands, product-shot
  windows, barcodes, weights) applied to parameterized geometry (boxes, cans,
  jars, bottles, pillowed bags, gable cartons, cups, tubs). The label art IS the
  realism; geometry stays cheap.
- **Photoscans (CC0, Poly Haven)** — 6 produce items (apple, lemon, avocado,
  banana bunch, onion, sweet potato), tinned assortment, croissant, decimated via
  gltf-transform to 1.3–5.6 k tris with 1 k textures.

All stock renders through **one instanced pipeline** (`stock.js`): ~4,200 facings
in ~70 draw batches; every facing individually grabbable, hideable, and
physics-convertible.

## 0.3 The people

13 **Microsoft Rocketbox** avatars (MIT): 6 aisle walkers (2 pushing carts),
2 shelf browsers, 5 posted staff. Animations retargeted at load from a donor rig
by a custom rotation-delta retargeter (three's SkeletonUtils.retarget cannot cross
rig proportions — documented in `characters.js`). Every avatar passes a numeric
pose sanity gate before it may spawn.

## 0.4 The physics

Bespoke arcade layer (`physics.js`), built to coexist with instancing:

- **Carts** — dynamic circles with momentum; player shoves transfer velocity;
  bounce off fixtures/each other; tip over on hard impacts.
- **Debris** — crashing into shelves converts nearby instanced facings into
  ballistic meshes (gravity, bounce, tumble, bbox-seated rest). Floor items stay
  grabbable for the list and fade after ~28 s. Capped at 100 live pieces,
  spawns amortized 9/frame.
- **Aisle tipping** — a sprint crash pivots the whole gondola at its base edge
  (87° verified), flings a 56-item spill scaled by shelf height, mutates the
  walkable collider to the fallen footprint, and fires camera shake + crash audio
  + a "CLEANUP ON AISLE N" PA toast.
- **NPC bumps** — impulse + stagger + bark; staff spring back to their posts.
- **Consequences** — every knocked item bills 40 % of price; the checkout banner
  itemizes "Store damages."

## 0.5 The loop, controls, HUD (as shipped)

Six-item list across departments → find → **E** to take (0.4 s fly-to-basket) →
checkout zone → banner (items · total · damages · time) → **R** for a new list.
Controls: pointer-lock mouse-look (automatic drag-look fallback in embedded
contexts), WASD, **Shift** sprint (4.9 m/s — the aisle-tipping threshold is
sprint-only by design), **M** mute. HUD: list card (top-left), timer (top-right),
center prompt, center banner, top toast.

## 0.6 Engineering doctrine (proven this project; binding)

1. **Empirical verification over inspection.** The game exposes `window.__*`
   debug hooks (scene, stock, game, physics, NPCs). Features are verified by
   driving those hooks headlessly and reading back framebuffer color grids —
   never by assuming. Every landed system shipped with such a battery.
2. **Instancing-first.** Anything placed more than ~4 times is an InstancedMesh
   or a merged geometry. Multi-material groups are collapsed (boxes render as 2
   draw groups, not 6). Whole-store batches are acceptable until a measured view
   exceeds budget; then split by region.
3. **Progressive quality, never degrade-first.** Boot into the lite tier
   (no GTAO, no rect-area lights, half shadows, DPR ≤ 1.25); upgrade after 60
   measured-fast frames; panic tier drops resolution. Shadow maps freeze after
   first render (static store). Shader compile happens behind the boot screen.
4. **CC0/MIT asset pipeline as code.** `scripts/fetch-assets.mjs` (PBR textures),
   `scripts/fetch-models.mjs` (models; Poly Haven files-API include-maps,
   gltf-transform decimate + resize), Rocketbox TGA→JPG conversion. Every asset's
   source, license, and processing is reproducible; CREDITS.md is the ledger.
5. **Materials are cached, never per-instance.** Product materials key on
   (spec, role); debris/flyer churn allocates nothing.
6. **Perf gates.** Worst-view budget on the Intel-UHD floor, lite tier:
   ≤ 1,000 draws, ≤ 1.4 M tris, ≥ 30 fps foreground. Any PR that regresses the
   measured spawn-view battery fails.

---


---


---

# PART I — PRODUCT & DESIGN



# Chapter 1 — Vision, Pillars, Audience & Success Criteria

This chapter is the constitution the other twenty-five answer to. It fixes *what* Grocery Dash 3D is, *why* every later decision bends the way it does, and *how* we will know — in a browser, with no server, on the weakest GPU we support — whether we succeeded. Every number below is drawn from the shipped build (see the file references inline) so the vision never floats free of the thing that already runs. Where the vision reaches past v1, it is flagged as extending shipped behavior, never contradicting it.

---

### 1.1 Vision Statement

> **Grocery Dash 3D is a first-person supermarket arcade game about being the fastest, most destructive shopper who ever lived — and getting handed the bill for it.** You spawn on the front strip of a 46 × 30 × 4.2 m supercenter, get a six-item list, and race the aisles to grab it and reach the glowing checkout ring. Everything in the store has weight and reacts: carts you shove, shelves you clip, whole gondola islands you can flatten at a sprint. The store keeps a straight face and a running tally, and at checkout it prints your time next to the cost of the wreckage. Then you press **R** and go again.

The one-sentence promise the whole product must keep: **click, and within seconds you are sprinting through a believable store, grabbing real-looking groceries, breaking things that cost money, and chasing a better run — no login, no download, no loading wall.**

Three non-negotiables carried from the shipped constraints frame everything downstream:

| Constraint | What it means for the vision | Source of truth |
|---|---|---|
| **Browser, no-backend default** | The game must be fully playable from a single click with zero network round-trips after load. Any server feature (leaderboards, cloud saves) is strictly optional and additive — see Ch. 24. | `index.html` click-to-play; `main.js` pointer-lock + drag-look fallback |
| **Intel iGPU floor** | 60 fps is a *target on integrated graphics*, not a stretch goal on a discrete card. The progressive tier system starts lite and only upgrades if the GPU earns it. | `main.js` `tier='lite'` default, `autoQuality()` |
| **Extend the shipped systems** | The 52-SKU catalog, bespoke arcade physics, instanced stock, and procedural audio already exist and define the feel. The bible grows them; it never re-litigates them. | `products.js`, `physics.js`, `stock.js`, `sfx.js` |

---

### 1.2 The Four Pillars

Every feature request, art note, and tuning value is tested against four pillars. If a proposal serves a pillar, it earns a place in the roadmap (Ch. 25). If it *forbids* one, it is cut no matter how fun it sounds in isolation. The pillars are deliberately in tension — that tension is the game.

| # | Pillar | One-line test | Owns | Fails when |
|---|---|---|---|---|
| I | **Store-is-a-racetrack** | "Does this help the player read, plan, and commit to a route at speed?" | Layout, flow, sightlines, shortcuts | The floor becomes a place to *stand*, not a place to *drive* |
| II | **Everything-reacts, everything-bills** | "Does this object respond to force, and does chaos touch the ledger?" | Physics, damage economy, NPC reactions | Something is bolted down, or destruction is free |
| III | **Readable-at-a-sprint** | "Can the player parse this at 4.9 m/s without stopping?" | HUD, product art, signage, color language | The player has to halt and squint |
| IV | **One-more-run** | "Is the reset instant and the score a reason to retry?" | Loop length, reroll, scoring, fail-state | Anything sits between checkout and the next run |

The next four sections expand each pillar into its concrete design consequences (drawn from shipped values) and, crucially, the features it **forbids** — because a pillar you can't violate isn't load-bearing.

---

### 1.3 Pillar I — Store-Is-A-Racetrack

The 46 × 30 m floorplate is a *circuit*, not a diorama. The player spawns at (0.6, 1.65, 13.2) and every run is a loop out into the aisles and back to the checkout ring at (-7.65, 11.1) — a fixed start/finish line like any track (`store.js`).

**Design consequences (all mandatory):**

1. **Aisles are sized as racing lanes, not corridors.** The four grocery islands sit at x = -18, -14, -10, -6, each a 16 m straight; the two merchandise gondolas run 12 m (z = -7.5, -3.5) and the toys island 10 m (x = 19.5). Lane gaps must clear a sprinting body (collider R = 0.34) plus a shoved cart (R = 0.48) simultaneously — roughly a 1.0 m minimum navigable width — or the racing line dies. Any new fixture (Ch. 14, Ch. 16) is validated against this width before art is approved.
2. **Long straights reward committing to the sprint.** Walk is 3.1 m/s, sprint 4.9 m/s (`main.js`). A 16 m island is ~3.3 s at a sprint versus ~5.2 s at a walk — a straight long enough that the sprint decision *matters* and mis-committing into a fixture has a real cost.
3. **Sightlines are engineered for path-planning.** FOV is 62°, eye height 1.65 m; hanging department banners are authored to read across the full 46 m width so the player plans two aisles ahead while moving. Legibility at distance is a *layout* requirement, not just an art one (it hands off to Pillar III).
4. **Shortcuts are physical and destructive.** A sprint-crash (≥ 4.0 m/s, `TIP_SPEED`) tips a whole gondola ~87° flat and *mutates its collider to the fallen footprint* (`physics.js` `tipGondola`), so the player can carve a brand-new racing line **through** a downed aisle — trading damage dollars for a straighter route. Shortcuts are earned with force, never handed out.
5. **Hazards are loose and drifting.** Carts carry momentum with 2.2/s friction, bounce at restitution 0.4, and tip over on wall impacts above 2.6 m/s; they wander into lanes as dynamic chicanes. Round apparel racks, the ball bin, and produce crate tables are static chicanes placed to pinch the ideal line.
6. **The arena has a visible edge, not a wall of fog.** The night lot outside (8 Kenney cars, lamps, crosswalk, skyline) frames the track as "the world beyond the circuit" without inviting the player off the racing surface.

**Counter-examples — features this pillar forbids:**

- **No off-track fetch objectives.** No "go to the back-office storeroom" or any errand that sends the player into a dead-end room off the racing surface. Dead-ends kill flow.
- **No mazes, locked doors, or keycard gating.** The floor is always fully traversable; obstacles *slow* you, they never *stop* you. A door you can't open is an anti-pillar.
- **No teleport, fast-travel, or auto-pathing waypoint.** Navigation skill *is* the game. A "press to path to your next item" button would delete the track.

---

### 1.4 Pillar II — Everything-Reacts, Everything-Bills

Every object in the store responds to force, and every consequence is itemized in dollars. Reaction and cost are *the same event* — the world never breaks for free and never bills for something you didn't feel.

**Design consequences (all mandatory):**

1. **The damage economy is universal and live.** Every item knocked loose bills **spec.price × 0.40** and increments a running `damageTotal` / `damageCount` (`physics.js` `spawnDebris`). At checkout the banner prints `Store damages: N items · $X 😬` in salmon `#e8907f` (`game.js`). A $4.29 cereal box airborne costs you $1.72, itemized. Chaos is never abstract — it is arithmetic on your receipt.
2. **Physics is simulated, not scripted.** Carts have momentum + friction + bounce + tip; gondolas tip whole (pivot at the base edge, ~87°, a 56-item spill); debris is genuinely ballistic (gravity 9.8 m/s², floor restitution 0.28, tumble spin) and settles into resting clutter with a 28 s TTL (`physics.js`). Nothing is a canned animation faking a reaction.
3. **Reactions feed back into the objective.** A knocked-off *listed* item is still fair game — the game raycasts nearby debris and lets you grab it off the floor to complete your list (`game.js` `update`). Breaking the world can *help* you, which keeps destruction from being pure vandalism.
4. **NPCs push back and briefly remember.** A bump above relative speed 0.6 shoves the shopper, staggers them, fires a bark, pauses their browsing, and sets a 1.3 s cooldown so they aren't a pinball (`physics.js`). The crowd is a reactive system, not scenery.
5. **Every reaction has an audio-visual receipt.** Impacts trigger procedural SFX (`thud` = 90 Hz sine + filtered noise; `crash` = 70 Hz sine + 900 Hz noise burst; `clatter` = a scatter of 700–1200 Hz squares) and camera shake (`addShake` up to 0.9 on a full gondola tip). Cause → effect is never silent or invisible.
6. **The world commits to reacting at scale without hitching.** A 56-item spill is drained at 9 spawns/frame with a 100-piece debris cap that drops the oldest resting piece first (`physics.js` `SPAWNS_PER_FRAME`, `DEBRIS_CAP`). We simulate the avalanche rather than faking it, but we amortize so the frame budget survives it (hands off to Ch. 21, Ch. 22).

**Counter-examples — features this pillar forbids:**

- **No invisible walls or bolted-down props.** A sprint into any solid must produce a reaction (bounce, knock, tip, or thud). A collider that silently eats momentum is a bug against the pillar.
- **No consequence-free "sandbox mode."** There is no toggle that turns off billing. Chaos that costs nothing is just noise; the ledger is what makes a spectacular tip a *decision*.
- **No purely cosmetic destruction.** Any breakable that doesn't touch either the ledger (damage $) or the objective (grabbable debris) is forbidden. Every reaction must matter to score or list.

---

### 1.5 Pillar III — Readable-At-A-Sprint

At 4.9 m/s the player has a fraction of a second to identify a SKU, confirm it's grabbable, read its price, and re-plan. The whole presentation layer exists to make that instantaneous.

**Design consequences (all mandatory):**

1. **Products read by silhouette + printed label at distance.** Packaging art is procedurally *designed* on canvas — color-blocked fronts, a bold wordmark at 11–13% of canvas width, a product-shot window, barcode, weight (`products.js` `labelTexture`). A "Corn Flakes" box (`#e23b2e` on `#a51f16`) is identifiable before you're on top of it. Realism serves reading speed, not decoration.
2. **The grab affordance is a single glance.** The aimed product gets one shared additive-blend glow box, color `#9fdcff` at opacity 0.28, scaled to the item + 0.05 m, plus a bottom-center prompt: **`<b>Name</b> · $Price — E take`** (`game.js` `setHover`). Grabbable + which + cost, in one read, without leaving the crosshair.
3. **The HUD is corner-anchored and never fights the center.** List top-left (18 px), timer top-right (18 px, `tabular-nums` so digits don't jitter), prompt bottom-center (84 px up), banner center, toast top (64 px) (`index.html`). The crosshair at screen center is always clear for aiming.
4. **Checkout is a beacon.** When the list completes, a green ring (`#35c46a`, emissive intensity 1.0) appears and pulses scale 1 ± 0.08 at 4 Hz (`store.js`) — findable across the whole 46 m store, doubling as the racetrack's finish line for Pillar I.
5. **Color is a fixed vocabulary the player learns once.** Green `#35c46a` = go / list-complete / checkout; salmon `#e8907f` = damage / cost; cyan `#9fdcff` = interactable hover. A sprinting player reads game state by hue before reading any text. New UI (Ch. 6, Ch. 7) must obey this palette.
6. **Two signage scales, never blurred.** Hanging department banners are authored to read at 46 m; shelf-edge price tags (`priceTagTexture`, the red `EVERYDAY` flag) are authored to read at reach (2.7 m). No sign tries to serve both distances at once.

**Counter-examples — features this pillar forbids:**

- **No tiny, ornate, serif, or low-contrast label art.** Anything that forces a stop-and-squint on a SKU is rejected on sight, however "authentic" it looks.
- **No center-screen modal popups mid-run.** Nothing that occludes the crosshair or aim while the player is moving. Results and dialogs live at the banner/toast anchors, never over the reticle.
- **No dim "atmospheric" lighting that hides stock.** The store is lit bright and even like a real supercenter *specifically* to stay legible. Art direction (Ch. 13) may not trade SKU legibility for mood; ambience is layered on top of readability, never instead of it.

---

### 1.6 Pillar IV — One-More-Run

The loop is short, the reset is a single key, and the score is built to make you want the next attempt more than the last.

**Design consequences (all mandatory):**

1. **Reset is one keystroke.** After checkout, **R** rerolls a fresh six-item list with no reload and no menu (`game.js` `reset`, keydown `KeyR`). The friction between "that run's over" and "next run's started" is one input.
2. **A run is short and self-contained.** Six items → one checkout → a banner with `items · $total`, damages, and time. The whole arc fits in the tens-of-seconds-to-a-couple-minutes band (see 1.10), which is what makes the retry feel free.
3. **The score has two independent axes to chase.** Time (`m:ss`, `game.js` `fmt`) and damages ($). A player can pursue *fast-and-clean* or *fast-and-reckless* — there is always a different run to attempt without changing a single system.
4. **Every reroll is a new route.** The store geometry is static, but the six-item permutation (drawn from the 52-SKU catalog) makes each run a fresh pathing puzzle. Randomized objectives, not randomized levels — cheap to generate, endlessly re-playable.
5. **"How did I do" is instant.** The end banner shows exactly the two numbers worth beating and a `Press R for a new list` prompt. No stat wall, no XP tally screen, nothing between the result and the retry.
6. **There is no hard fail state.** You cannot die, run out of lives, or get a game-over. The only "loss" is a worse time or a higher bill — which is a *reason to go again*, not a punishment that ejects you from the loop.

**Counter-examples — features this pillar forbids:**

- **No long, unskippable results screen or cutscene between runs.** Anything that interrupts the R-to-retry cadence is cut. Celebrations must be skippable and short.
- **No energy, lives, stamina, or cooldown gating replays.** The game never tells you "come back in 20 minutes." Play is always available now.
- **No account, login, or loading wall before a run.** Consistent with the shipped click-to-play + drag-look fallback, the game is always exactly one input away from starting — even inside a sandboxed embed iframe (`main.js` `enableFallback`).

---

### 1.7 Player Fantasy

The fantasy is **"unsupervised in a supercenter, with a stopwatch running and a receipt you'll deal with later."** It sits on two legs the player can lean toward run to run:

| Leg | The fantasy | Delivered by | Emotional beat |
|---|---|---|---|
| **Competence** | "I am *so fast* — a clean sub-minute grab-and-go, not a box out of place." | Sprint economy, route learning, low-damage runs, the tabular timer | Flow, mastery, the perfect lap |
| **Mischief** | "I flattened aisle 3 and made it *rain cereal*, and the store just deadpans a cleanup announcement." | Gondola tips (56-item spill), cart carnage, NPC barks, the damage bill | Glee, spectacle, the great story you tell after |

Crucially the two legs share one body: the *same* sprint that sets a record is the sprint that tips a shelf. The player is never asked to pick a mode up front — the fantasy is that both are always one shove away, and the receipt is the game keeping honest score of which one you chose. Later systems reinforce this: Mode rulesets (Ch. 2) foreground one leg or the other; Career shifts (Ch. 3) dramatize the tension; Scoring (Ch. 4) prices both.

---

### 1.8 Tone Bible & Voice

Grocery Dash runs **two voices, and never blurs them.** The comedy comes from the *contrast* between them.

**Voice A — The Store (straight voice).** All world signage, price tags, department banners, and functional UI. Dead-serious, corporate-retail, deadpan. The store never acknowledges that anything is wrong. This is the straight man. Rules: title-case or all-caps, no jokes, no emoji, no exclamation beyond genuine retail signage. It is *funny because it refuses to react* to the carnage the player is causing.

**Voice B — The Consequences (comedian voice).** All physics reaction toasts, NPC barks, damage lines, and the receipt's editorial asides. Short, punchy, PA-announcement-and-receipt humor, emoji-led. This is where every joke lives. Rules: one line, lands in under ~8 words where possible, leads with an emoji for barks/toasts, punches down at *the player's wallet*, never at people.

Shipped lines that define the register (do not contradict; extend): NPC barks `"Hey, watch it!"`, `"Excuse YOU."`, `"Seriously?!"`, `"Ow! My cart!"`, `"Careful, buddy!"`; crash lines `🛒 CRUNCH.`, `🛒 That's coming out of your deposit.`, `🛒 Cart casualty.`; the aisle-tip toast `📢 CLEANUP ON AISLE {n} — ALL OF IT.`; the knock toast `Whoops — that's going on your bill.` (`physics.js`).

**Voice A — 10 straight-voice sign texts (new, for Ch. 13 signage):**

1. `GROCERY DASH SUPERCENTER · OPEN 24 HOURS`
2. `PRODUCE — PICKED FRESH DAILY`
3. `FROZEN FOODS`
4. `ELECTRONICS · ASK AN ASSOCIATE`
5. `PHARMACY — CONSULTATIONS AT THE COUNTER`
6. `10 ITEMS OR FEWER · EXPRESS LANE`
7. `CAUTION: WET FLOOR / PISO MOJADO`
8. `EVERYDAY LOW PRICES`
9. `PLEASE RETURN CARTS TO THE CORRAL`
10. `THANK YOU FOR SHOPPING GROCERY DASH`

**Voice B — 10 comedian-voice physics lines (new, for Ch. 17 barks / toasts):**

1. `🛒 Insurance won't cover that.`
2. `📢 Cleanup on aisle 3. And 4. And your conscience.`
3. `That'll buff right out. (It will not.)`
4. `🧾 Ka-CHING. Damages, party of one.`
5. `The avocados did not consent to this.`
6. `🛒 New record: most cereal airborne at once.`
7. `Somewhere, a manager felt a disturbance.`
8. `📢 Attention shoppers: gravity remains undefeated.`
9. `You break it, you buy it. You bought it.`
10. `🛒 That shelf had a family.`

**Tone guardrails (apply to all future copy, Ch. 6 / 13 / 17):** the humor is aimed at the *player's spending*, never at any depicted person's identity; the store is always the unbothered straight man; nothing breaks the fourth wall about "it's a game"; no crude or edgy register — the ceiling is "wholesome property damage." When in doubt, the store says less and the receipt says more.

---

### 1.9 Audience Segments & Play Patterns

We design for six segments. The design must serve all six *without a settings menu wall* — the defaults are the experience.

| Segment | Core motivation | Primary session shape (1.10) | What they need from the design | Hardware assumption |
|---|---|---|---|---|
| **Lunch-break browser gamer** | A 90-second dopamine hit in an open tab | The Sample / The Errand | Instant load, no login, click-to-play, forgiving loop | Office laptop, Intel iGPU — the floor |
| **Speedrunner / optimizer** | Beat their own time; learn the perfect route | The Ladder | Visible timer (tabular), consistent physics, static layout to memorize, low-damage as a skill axis | Mid-range; cares about frame stability |
| **Chaos / physics tourist** | Break the world; see how much it takes | The Rampage | Universal reactions, big spectacle (gondola tip), damage that's fun to run up | Anything that renders the tip smoothly |
| **Streamer / content creator** | Reactions and clips for an audience | The Showcase | Readable-on-stream HUD, funny barks, a repeatable spectacle moment | Discrete GPU, but streams to iGPU viewers |
| **Casual / "my kid loves it"** | Pick up, poke around, no pressure | The Sample / The Rampage | No-fail loop, bright legible world, no reading barrier, obvious controls | Family laptop or low-end desktop |
| **Embed / discovery player** | Stumbled in via an itch.io/portal iframe | The Sample | Must play *inside a sandboxed frame* where pointer-lock may fail | Unknown; assume the worst — the floor |

Two segments set hard requirements the others merely benefit from. The **embed/discovery player** is why pointer-lock silently degrades to drag-to-look so the game *always* plays (`main.js` `enableFallback`) — a shipped invariant the bible protects. The **Intel-iGPU lunch-break gamer** is why the renderer boots in the lite tier and only upgrades on proven headroom (`autoQuality`). Design for those two and the other four are covered.

---

### 1.10 Session Shapes

A "session shape" is a named, expected way the loop is consumed. Every feature proposal must name which shape(s) it serves. Durations assume a warm load (already booted).

| Shape | Length | Trigger / mindset | Loop behavior | KPI it moves (1.12) |
|---|---|---|---|---|
| **The Sample** | ≤ 30 s | "What is this?" — an embed, a shared link, first curiosity | One partial or single run, may not reach checkout | Time-to-first-grab, checkout-completion |
| **The Errand** | 1–2 min | "One clean run." Focused, chasing a decent time | A full list grabbed deliberately, low damage, one checkout | Checkout-completion, damage-per-run |
| **The Rampage** | 1–3 min | "Ignore the clock, break everything." | Deliberate cart/gondola carnage, damage maximized, checkout optional | Damages-per-run, spectacle events |
| **The Ladder** | 10–20 min | "Beat my last time." The core one-more-run engine | Many rerolls (R), route refinement, time trending down | Rerolls-per-session, session length |
| **The Showcase** | Variable | "Watch this." Demoing to a friend or a stream | Deliberate set-piece (tip an aisle on cue), then reroll | Spectacle events, session length |

The design's center of gravity is **The Ladder** — it is the direct expression of Pillar IV and the shape that turns a two-minute toy into a returned-to game. The Sample is the *gateway* (it must convert to an Errand within the first run), and the Rampage/Showcase are the *social surface* (they generate the clips that recruit new Samples). Modes (Ch. 2) and Career (Ch. 3) exist to give each shape a scaffold without breaking the instant-reroll spine.

---

### 1.11 Competitive References

Four touchstones, each mined for exactly one thing and firewalled against the rest. "Take" is a design debt we intend to repay; "Reject" is a line we will not cross even when it's tempting.

| Reference | What we **take** | What we **reject** | Pillar it informs |
|---|---|---|---|
| **Supermarket Simulator** | The authentic supercenter texture — real SKU density, believable packaging, legible shelf pricing, the *place* feeling like a store you've been in | The management-sim tedium: restocking, cash-counting, hiring, slow deliberate pace, an economy that punishes speed. We keep the store, drop the spreadsheet | III (readable store), and the world of Ch. 14–16 |
| **Katamari Damacy** | The joy of escalating physical accumulation and comedic property chaos; the deadpan-absurd tone; "the world is a physics toy" | The surreal abstraction and the everything-sticks-and-grows core mechanic. We do not grow a ball — we *bill* the damage. Chaos is priced, not hoarded | II (everything reacts), and tone (1.8) |
| **Crazy Taxi** | The arcade racetrack-in-a-place; the sprint/commit economy; a bright objective beacon; the relentless one-more-run score chase; barky comedic reactions | The vehicle handling and traffic simulation. We are first-person on foot; there is no car model, no lanes-and-signals sim | I (racetrack), IV (one-more-run) |
| **Overcooked** | The readable-at-a-glance objective list; time pressure as the primary tension; comedic kitchen-chaos energy | Mandatory co-op dependency and level-by-level campaign gating. We are single-player-first with an instant reroll; no locked progression wall between runs | III (HUD list), IV (instant reroll) |

The synthesis in one line: **Crazy Taxi's racetrack, run through Supermarket Simulator's store, with Katamari's sense of comedic destruction, read like an Overcooked ticket.** No single reference is the game; the game is the specific *intersection*, and any feature that pulls us toward one reference's rejected half is out of scope.

---

### 1.12 Success Criteria & KPIs (Measurable Without a Backend)

Because the default build has no server, every KPI below is measurable **client-side** — via the shipped `window.__*` debug hooks, the documented framebuffer-grid verification practice, a small optional `localStorage` tally, or a manual stopwatch during playtest. A backend (for aggregate leaderboards/telemetry) is *optional and additive* and belongs to Ch. 24; the vision must be provably met with none.

**A. Performance KPIs** — the price of admission. If these fail, nothing else matters.

| KPI | Target | How measured (client-only) | Pillar |
|---|---|---|---|
| Boot to playable | Boot overlay gone < 8 s on the iGPU floor | Manual stopwatch; `boot.style.display` flip in `main.js` | IV |
| Tier settles | A locked tier reached by **frame 80**, read from `window.__tier` | `window.__tier` (values: `high`, `lite-locked`, `panic`) | all |
| Steady-state frame time (lite/high) | Avg **< 20 ms** (≥ 50 fps) over frames 20–80 on iGPU | `autoQuality` already averages `acc/60`; expose via `window.__` timing | all |
| Panic-tier floor | Even the panic path (DPR → 1) holds **< 55 ms** (≥ 18 fps) | `autoQuality` threshold `avg > 0.055` | I (playable floor) |
| Worst-view budget | ~988 draw calls / 1.38 M tris renders without a dropped-below-panic frame | `renderer.info` via `window.__renderer` at the TV-wall view | III/ XXI |
| Spectacle hitch-free | A full 56-item gondola tip drops **no frame > 55 ms** | Frame log across a scripted tip; `SPAWNS_PER_FRAME=9`, `DEBRIS_CAP=100` guardrails | II |
| Input-to-play in an embed | Drag-look fallback engages within **350 ms** when pointer-lock is refused | `main.js` fallback timeout; test in a sandboxed iframe | IV |

**B. Engagement KPIs** — proof the loop actually loops. All capturable with a lightweight `localStorage` counter (opt-in, additive; no network).

| KPI | Target | How measured (client-only) | Session shape |
|---|---|---|---|
| Rerolls per session | Median **≥ 3** R-presses | Increment a `localStorage` tally on `KeyR`-driven `reset()` | The Ladder |
| Time-to-first-grab | Median **< 15 s** from first pointer-lock/drag to first `tryGrab` success | Timestamp delta, `window.__game` state | The Sample |
| Checkout-completion rate | **≥ 60%** of *started* runs reach `complete()` | Count `started` vs `done` transitions in `game.state` | The Errand |
| Median clean-run time | A learnable target: **≤ 90 s** for a full 6-item clean run | `game.state.time` at checkout, logged locally | The Ladder |
| Damages-per-run distribution | Bimodal — a clean cluster near **$0** and a chaos cluster **> $20** — proving both fantasy legs are exercised | `physics.damage.total` at checkout, histogram in `localStorage` | Errand vs Rampage |
| Spectacle events per session | **≥ 1** gondola tip in ~1 of 4 sessions (proof the Rampage/Showcase surface is found) | Count `tipGondola` calls via a `window.__` hook | The Showcase |

**C. Qualitative gates** — pass/fail judgments made in playtest, no instrumentation:

1. **The five-second test:** a new player, given only "click and grab your list," is sprinting and has grabbed at least one listed item within 5 s of the crosshair appearing. Passes ⇒ Pillar III + IV are working.
2. **The straight-face test:** a first-time player laughs at least once at the *contrast* between the store's deadpan signage and a comedy toast during a single Rampage. Passes ⇒ the two-voice tone (1.8) is landing.
3. **The one-more test:** after their first checkout, the player presses **R** without being told to. Passes ⇒ Pillar IV is intrinsic, not instructed.
4. **The no-manual test:** the player never opens a controls/help screen mid-run to figure out what to do. Passes ⇒ readability and onboarding (Ch. 10) carry their weight.

A release candidate must clear **all** Performance KPIs, **all four** qualitative gates, and **at least four of six** Engagement KPIs. Detailed telemetry plumbing (and the optional server that would aggregate any of the above across players) is specified in Ch. 24; the Definition of Done that binds these into the ship checklist is Ch. 26.

---

### 1.13 How This Chapter Governs the Rest

The rest of the bible is downstream of these four pillars and eight-and-a-half systems. When a later chapter proposes something, it must cite which pillar it serves and confirm it violates none — and it must respect the three shipped constraints from 1.1 (browser, no-backend default, iGPU floor). Mode rulesets (Ch. 2) partition the fantasy's two legs into playable framings; the 40 career shifts (Ch. 3) dramatize the Errand-vs-Rampage tension; scoring and economy (Ch. 4) put a price on both legs exactly as the shipped 40%-of-price damage bill already does; progression, achievements, and dailies (Ch. 5) feed The Ladder without ever gating the reroll. Everything from screens (Ch. 6) to the definition of done (Ch. 26) answers to this chapter. If a future decision and a pillar disagree, the pillar wins — that is what makes it a pillar.



# Chapter 2 — Game Modes — Complete Rulesets

Grocery Dash 3D ships today as a **single loop** — one 6-item list, a count-*up* timer, damage billed at checkout, `R` to reroll (`src/game.js`). This chapter does not replace that loop; it **generalizes** it. Every one of the six modes below is expressed as a `MODE` configuration object interpreted by one shared engine, so the shipped code becomes *Career/Shift at Standard difficulty* and the other five modes are additive config over the exact same `update(dt, locked)` path. Nothing here contradicts shipped physics, catalog, HUD, or the Intel-iGPU tier system (Ch. 21). Where a mode needs a value the code does not yet expose, the field is named, defaulted to today's behavior, and cross-referenced. Scoring formulae live in **Ch. 4**; the 40 career shifts in **Ch. 3**; progression/unlocks in **Ch. 5**; screens in **Ch. 6**; HUD element specs in **Ch. 7**; NPC/crowd behavior in **Ch. 17**.

---

### 2.1 The Shared Mode Engine

Every mode is one `MODE` object. The engine reads it at `reset()` and never re-reads mid-run except for `list.regen`. Below is the **complete field schema** — every field, its type, its shipped default, and the code site it maps to. A mode section that omits a field inherits the default in this table.

#### 2.1.1 `MODE` schema — every field

| Group.Field | Type | Shipped default | Maps to (code site) |
|---|---|---|---|
| `meta.id` | string | `"career"` | — |
| `meta.label` | string | `"Career / Shift"` | mode-select card |
| `meta.icon` | emoji | `🧾` | Ch. 6 card |
| `meta.tagline` | string | see 2.8 | Ch. 6 card |
| `meta.unlock` | predicate | `always` | Ch. 5 |
| `meta.scoreMultiplier` | float | `1.00` | Ch. 4 `M_mode` |
| `session.type` | `single`\|`sequence`\|`endless` | `single` | reset scope |
| `session.shiftCount` | int | `1` | Ch. 3 |
| `session.seedPolicy` | `random`\|`fixed`\|`date` | `random` | `Math.random` → seeded LCG |
| `timer.dir` | `up`\|`down`\|`none` | `up` | `time += dt` (game.js:121) |
| `timer.start` | seconds | `0` | `time = 0` (game.js:52) |
| `timer.grabBonus` | seconds | `0` | added in `tryGrab` |
| `timer.comboBonus` | seconds | `0` | combo hook |
| `timer.warn` | seconds | `null` | `#timer.warn` class |
| `timer.critical` | seconds | `null` | `#timer.crit` class |
| `timer.onZero` | `fail`\|`complete`\|`ignore` | `ignore` | new predicate |
| `timer.freezeOnBlur` | bool | `true` | gated by `locked` (game.js:121) |
| `timer.blurGraceMs` | int | `∞` | `visibilitychange` |
| `list.size` | int | `6` | `genList` while<6 (game.js:38) |
| `list.needPerItem` | int | `1` | `need: 1` (game.js:42) |
| `list.regen` | bool | `false` | on `complete` |
| `list.rerollKey` | bool | `true` | `KeyR && done` (game.js:181) |
| `list.source` | `random`\|`seeded`\|`queue` | `random` | `genList` |
| `list.sectionSpread` | int\|`null` | `null` | `availableSpecs` filter |
| `list.restockUnreachable` | bool | `true` | new watcher (2.1.4) |
| `list.unreachableGraceMs` | int | `6000` | new watcher |
| `crowd.npcTotal` | int | `13` | `createShoppers` |
| `crowd.cartPushers` | int | `2` | Ch. 17 |
| `crowd.speedMul` | float | `1.00` | NPC speed |
| `crowd.spawnCarts` | int | `3` | `physicsMeta.carts` |
| `crowd.bumpBarks` | bool | `true` | `BUMP_LINES` (physics.js:23) |
| `damage.billing` | bool | `true` | `complete` dmg line (game.js:172) |
| `damage.billRate` | float | `0.40` | `spec.price*0.4` (physics.js:83) |
| `damage.tipEnabled` | bool | `true` | `tipGondola` (physics.js:150) |
| `damage.knockEnabled` | bool | `true` | `knockItems` (physics.js:151) |
| `damage.tipSpeed` | m/s | `4.0` | `TIP_SPEED` (physics.js:17) |
| `damage.knockSpeed` | m/s | `1.6` | `KNOCK_SPEED` (physics.js:18) |
| `damage.debrisCap` | int | `100` | `DEBRIS_CAP` (physics.js:19) |
| `damage.debrisTTL` | seconds | `28` | `DEBRIS_TTL` (physics.js:20) |
| `damage.budget` | dollars\|`∞` | `∞` | new predicate |
| `damage.onBudget` | `warn`\|`fail`\|`penalty` | `warn` | new predicate |
| `move.walk` | m/s | `3.1` | `SPEED_WALK` (main.js:131) |
| `move.run` | m/s | `4.9` | `SPEED_RUN` (main.js:131) |
| `move.sprintEnabled` | bool | `true` | Shift check (main.js:140) |
| `move.reach` | m | `2.7` | `REACH` (game.js:8) |
| `move.flyDuration` | seconds | `0.4` | `dt/0.4` (game.js:109) |
| `win.predicate` | fn | `listDone && atCheckout` | `complete()` (game.js:155) |
| `lose.predicate` | fn | `never` | new |

#### 2.1.2 Shared engine constants (read from source — never override without a perf note)

| Constant | Value | Source |
|---|---|---|
| Reach ray far | `2.7 m` | game.js:8,17 |
| Fly-to-basket duration | `0.4 s` | game.js:109 |
| Fly arc height | `0.30 m · sin(πt)` | game.js:114 |
| Player radius | `0.34 m` | main.js:131 / physics.js:15 |
| Cart radius | `0.48 m` | physics.js:16 |
| Walk / run | `3.1 / 4.9 m/s` | main.js:131 |
| Head height | `1.65 m` (+bob) | main.js:162 |
| Camera FOV | `62°` | main.js:36 |
| Tip threshold | `4.0 m/s` | physics.js:17 |
| Knock threshold | `1.6 m/s` | physics.js:18 |
| Cart-tip impact | `−vn > 2.6 m/s` | physics.js:244 |
| Gondola tip angle | `π/2 − 0.06 = 1.5108 rad (86.56°)` | physics.js:271 |
| Gondola tip duration | `0.85 s` | physics.js:267 |
| Gondola spill burst | `56 items` (rest hidden) | physics.js:110 |
| Debris cap / TTL / fade | `100 / 28 s / 0.8 s` | physics.js:19,20,290 |
| Spawns drained / frame | `9` | physics.js:21 |
| Crash cooldown | `0.45 s` tip / `0.5 s` block | physics.js:148,164 |
| Damage bill rate | `40% of price` | physics.js:83 |
| Checkout point | `(−7.65, 0, 11.1)` | store.js:303 |
| Checkout ring | `inner 0.5 / outer 0.68 m`, pulses `1 ± 0.08 @ 4 rad/s` | store.js:1388,1424 |
| Near-checkout trigger | `< 2.2 m` | game.js:150 |
| Player spawn | `(0.6, 1.65, 13.2)` look `(0,1.5,0)` | store.js:1414 |
| World bounds | `x ∈ [−22.55, 22.55]`, `z ∈ [−14.55, 14.5]` | store.js:1392 |
| Tippable gondolas | `7`, labels `1,2,3,4,6,7,8` (5 skipped) | store.js:1319,1357,1367 |
| dt clamp | `0.05 s` (20 fps floor) | main.js:207 |

#### 2.1.3 Universal state machine

All modes run this machine. Mode config only changes **which transitions are armed** and **what the terminal states are**. States:

| State | Enter condition | Per-frame behavior | Exits |
|---|---|---|---|
| `BOOT` | page load | `LoadingManager` bar; `renderer.compile` behind boot screen (main.js:41–52) | → `READY` on `onLoad` |
| `READY` | boot faded | world renders, `playing=false`, hint visible 6 s | → `ACTIVE` on pointer-lock **or** fallback drag-look (main.js:106–113) |
| `ACTIVE` | first lock; `started=true` on first locked frame (game.js:120) | timer accrues **iff `locked`**; hover/grab/physics live | → `PAUSED`, `COMPLETE`, `FAILED` |
| `PAUSED` | `unlock` event (ESC/tab-out) and not fallback (main.js:113) | render continues, `time` frozen (accrual gated on `locked`), hover cleared, prompt hidden (game.js:119) | → `ACTIVE` on re-lock click |
| `COMPLETE` | `win.predicate` true → `complete()` (game.js:165) | banner shown, `done=true`, ring hidden, checkout chime | → `READY`/`ACTIVE` on `R` if `list.rerollKey` |
| `FAILED` | `lose.predicate` true | fail banner, `done=true`, input to grab locked | → `R` retry (mode-dependent) |
| `SUDDEN_DEATH` | Time Attack overtime opt-in (2.3) | shorter timer, ×score | → `COMPLETE`/`FAILED` |

Transition arming per mode is summarized in 2.8. Note the shipped guarantee: because `time += dt` runs only inside `if (!locked) return;`-guarded code (game.js:119–121), **the timer already auto-freezes on tab-out and ESC**. Countdown modes inherit this freeze via `timer.freezeOnBlur`.

#### 2.1.4 The three mandated edge cases (shared handlers)

These are handled once, centrally; each mode section states only its **deltas**.

**A) Tab-out / window blur.** `document.visibilitychange → hidden` and pointer-lock `unlock` both drive `ACTIVE → PAUSED`. Timer accrual halts (game.js:121 gate). Physics `update` keeps running with dt clamped to `0.05` (main.js:207), so no spill "teleports." On competitive modes (Daily Run, Time Attack, Register Rush) a **blur-grace** applies: if `hiddenMs > timer.blurGraceMs`, the run is **flagged**; Daily voids the score, Time Attack/Register keep playing but stamp `runFlagged=true` on the result (Ch. 12/24). Career and Zen set `blurGraceMs=∞` (freeze forever, no flag).

**B) Pointer-lock loss mid-run.** Two sub-cases. (i) *Locked build*: `unlock` → `PAUSED`; a centered `#banner` reads "Paused — click to resume." Re-click calls `controls.lock()` → `ACTIVE`. (ii) *Fallback drag-look build* (sandboxed iframes/embeds, `fallbackLook=true`): there is no lock to lose, so `playing` stays true and the run **never auto-pauses** (main.js:113). For competitive modes in fallback, an explicit `P` key toggles a manual pause overlay so embed players are not penalized by the missing lock.

**C) A list item made unreachable by a tipped aisle.** `genList()` draws from `availableSpecs()` (visible, grabbable stock — stock.js:92) at `reset()`, *before* any tipping. A tipped gondola calls `hideInRegion(box, 9999)` (physics.js:109): 56 facings spill as grabbable debris, the rest are hidden outright. Two ways a needed SKU becomes unreachable: (1) every facing of that SKU lived on the tipped island and the 56-item burst missed it (silently hidden, never spawned as debris); (2) it spilled as debris but the `28 s` TTL expired and it faded (physics.js:286–290) before pickup, or it came to rest under the fallen footprint. A per-frame **unreachable watcher** runs: for each list entry not yet satisfied, check `availableSpecs()` includes its `id` **OR** a live `debris` mesh with that `spec.id` exists (`physics.debrisMeshes`). If neither for `unreachableGraceMs` (default `6000 ms`), fire recovery per `list.restockUnreachable`:

- `true` → **restock**: silently un-hide `3` facings of that SKU at the nearest **intact** shelf of its `section` (reuse a stored slot pool), toast `"↻ Restocked {name} — aisle {n}"`.
- if no intact shelf of that section remains → **swap**: replace the list line with a fresh `availableSpecs()` pick, toast `"List updated — {old} unavailable"`, `SFX.tick()`.
- Zen never fails from this; Daily Run disables tipping entirely (see 2.6) so the case cannot arise, keeping seeds fair.

---

### 2.2 Career / Shift

The canonical mode — **exactly the shipped loop**, wrapped in a shift descriptor (Ch. 3). A *Shift* is one list; *Career* is a `sequence` of 40 shifts with rising par times and shrinking damage budgets. Completing a shift banks a star rating; the shipped checkout banner (game.js:175) already surfaces total, damages, and time — Career adds the par/star line.

#### 2.2.1 Full ruleset object

```
career = {
  meta:   { id:"career", icon:"🧾", scoreMultiplier:1.00, unlock:always },
  session:{ type:"sequence", shiftCount:40, seedPolicy:"random" },
  timer:  { dir:"up", start:0, onZero:"ignore", freezeOnBlur:true, blurGraceMs:∞,
            warn:null, critical:null, display:"m:ss" },
  list:   { size:6, needPerItem:1, regen:false, rerollKey:true, source:"random",
            sectionSpread:null, restockUnreachable:true, unreachableGraceMs:6000 },
  crowd:  { npcTotal:13, cartPushers:2, speedMul:1.00, spawnCarts:3, bumpBarks:true },
  damage: { billing:true, billRate:0.40, tipEnabled:true, knockEnabled:true,
            tipSpeed:4.0, knockSpeed:1.6, debrisCap:100, debrisTTL:28,
            budget:∞, onBudget:"warn" },          // per-shift budget set by Ch.3 row
  move:   { walk:3.1, run:4.9, sprintEnabled:true, reach:2.7, flyDuration:0.4 },
  win:    listDone && distance(cam, checkout) < 2.2,
  lose:   never,
}
```

#### 2.2.2 State machine deltas
Arms `ACTIVE → COMPLETE` only. `FAILED` disarmed (`lose = never`) — a shift is never *failed*, only *rated*. On `COMPLETE`, if `session.type=sequence` and more shifts remain, `R` advances to shift *n+1* (fresh `reset()`, new list, damage tally reset) instead of rerolling the same shift. Career par/budget for each shift come from the Ch. 3 table; the star formula is Ch. 4.

#### 2.2.3 Timer / list / crowd / damage
Timer counts **up** from `0:00`, formatted `m:ss` (game.js:177). List = 6 distinct SKUs, `need 1` each, drawn from all grabbable sections. Crowd is the shipped 13 avatars (Ch. 17): 6 walkers (2 pushing carts), 2 browsers, 5 staff. Damage bills 40% of spilled price, itemized at checkout; tipping and knocking both live.

#### 2.2.4 Win / lose predicates
- **Win:** `list.every(e => e.got ≥ e.need)` sets `listDone`, reveals the ring (game.js:91–96); then `distance(camera, (−7.65,0,11.1)) < 2.2` calls `complete()`.
- **Lose:** none. Damage over the shift's Ch. 3 budget triggers `onBudget:"warn"` → a red toast and a 1-star cap, not a fail.

#### 2.2.5 UI deltas
Shipped HUD verbatim (`#list`, `#timer`, `#prompt`, `#banner`). Add one banner line on complete: `"Shift {n}/40 · Par {m:ss} · {★★★}"` and, when `damage.total > budget`, the amber `#toast` `"Over damage budget — star capped."`

#### 2.2.6 Edge cases
Tab-out/ESC → freeze forever, no penalty (2.1.4-A/B(i)). Unreachable item → restock/swap (2.1.4-C). Fallback build → drag-look, no auto-pause, timer still runs (fine for a leisurely par).

#### 2.2.7 Scoring weights (see Ch. 4)

| Weight | Career value | Meaning |
|---|---|---|
| `M_mode` | `1.00` | mode multiplier |
| `k_T` (time) | `1.0` | par-relative time bonus |
| `k_D` (damage $) | `−1.0` | dollars off score |
| `k_A` (accuracy) | `0.5` | wrong-grab count is 0 in Career (list-locked grabs) |
| `k_S` (style) | `0.0` | style not scored |
| `k_R` (throughput) | `0.0` | — |

#### 2.2.8 Tuning table (Career difficulty bands → Ch. 3 rows populate these)

| Band | Shifts | List size | Par time | Damage budget | Crowd speedMul | Carts |
|---|---|---|---|---|---|---|
| Rookie | 1–8 | 4 | 2:30 | $12.00 | 0.85 | 2 |
| Standard | 9–20 | 6 | 2:00 | $8.00 | 1.00 | 3 |
| Pro | 21–32 | 8 | 1:40 | $5.00 | 1.15 | 4 |
| Manager | 33–40 | 10 | 1:25 | $3.00 | 1.30 | 5 |

---

### 2.3 Time Attack

Career's twin with the clock inverted: a **countdown**. Correct grabs refund seconds; empty the list and reach the ring before `0:00`. Hitting zero is a hard `FAILED`.

#### 2.3.1 Full ruleset object

```
timeAttack = {
  meta:   { id:"timeattack", icon:"⏱️", scoreMultiplier:1.35,
            unlock:clearCareerShift(3) },
  session:{ type:"single", shiftCount:1, seedPolicy:"random" },
  timer:  { dir:"down", start:150, floor:0, grabBonus:6, comboBonus:0,
            warn:20, critical:8, onZero:"fail", freezeOnBlur:true, blurGraceMs:4000,
            display:"m:ss" },
  list:   { size:8, needPerItem:1, regen:false, rerollKey:true, source:"random",
            sectionSpread:4, restockUnreachable:true, unreachableGraceMs:4000 },
  crowd:  { npcTotal:13, cartPushers:2, speedMul:1.10, spawnCarts:3, bumpBarks:true },
  damage: { billing:true, billRate:0.40, tipEnabled:true, knockEnabled:true,
            tipSpeed:4.0, knockSpeed:1.6, debrisCap:100, debrisTTL:28,
            budget:∞, onBudget:"penalty" },        // damage → time penalty, see below
  move:   { walk:3.1, run:4.9, sprintEnabled:true, reach:2.7, flyDuration:0.4 },
  win:    listDone && distance(cam, checkout) < 2.2 && time > 0,
  lose:   time <= 0,
}
```

#### 2.3.2 State machine deltas
Arms `ACTIVE → FAILED` on `time ≤ 0`. Optional `SUDDEN_DEATH`: if the player is *inside* the checkout ring's 2.2 m radius with the list done at the instant the clock would hit zero, grant a `+3 s` grace one time and flash `"OVERTIME"` — reaching the ring in that window still `COMPLETE`s. On `COMPLETE`, remaining seconds convert to score (Ch. 4). `R` restarts a fresh single run.

#### 2.3.3 Timer / list / crowd / damage
Timer starts `2:30` (`150 s`), decrements each locked frame. **Grab refund:** each *correct, needed* grab adds `grabBonus = 6 s` (applied in `tryGrab` alongside `entry.got++`, game.js:87). Wrong/duplicate grabs add nothing. `list.sectionSpread:4` forces the 8 items across ≥4 distinct sections so routes cross the floor. **Damage-as-time penalty:** `onBudget:"penalty"` converts every spilled dollar to `−0.5 s` off the clock at the moment of spill (a $4.29 cereal box tipped = `−0.86 s`), making recklessness self-punishing without a separate bill; the checkout banner still itemizes dollars for flavor.

#### 2.3.4 Win / lose predicates
- **Win:** `listDone ∧ atCheckout ∧ time > 0`.
- **Lose:** `time ≤ 0` → `FAILED`, banner `"⏰ Time! {got}/{size} items."`, `SFX.error()`.

#### 2.3.5 UI deltas
`#timer` gains state classes: default `#eef2f6`; `time ≤ warn(20)` → `.warn` amber `#ffcf33` + 1 Hz pulse; `time ≤ critical(8)` → `.crit` red `#e8503a` + 3 Hz pulse + a soft `SFX.tick()` each whole second. A `+6s` green flyout animates up from `#timer` on each refunded grab (translateY −18 px over 500 ms, fade). During `OVERTIME`, `#timer` reads `+0:03` in cyan `#35c4c4`.

#### 2.3.6 Edge cases
Blur grace `4000 ms`: pause is allowed but a blur beyond 4 s flags the run (2.1.4-A) — no free thinking time in a timed mode. ESC pause freezes the countdown (fair, but grace-limited). Unreachable item at `4000 ms` grace restocks (2.1.4-C) — critical here, since a vanished SKU with a running countdown is otherwise an instant loss. Fallback build: manual `P` pause; countdown still fair because refunds are grab-driven.

#### 2.3.7 Scoring weights (Ch. 4)

| Weight | Value | Note |
|---|---|---|
| `M_mode` | `1.35` | timed premium |
| `k_T` | `2.0` | leftover seconds × 2.0 |
| `k_D` | `0.0` | already paid as time |
| `k_A` | `1.0` | wrong grabs waste time |
| `k_S` | `0.25` | small tidy-run bonus |

#### 2.3.8 Tuning table

| Tier | start | grabBonus | list size | speedMul | warn / crit | Notes |
|---|---|---|---|---|---|---|
| Relaxed | 180 s | 8 | 6 | 1.00 | 25 / 10 | onboarding |
| Standard | 150 s | 6 | 8 | 1.10 | 20 / 8 | default |
| Rush | 120 s | 5 | 10 | 1.20 | 15 / 6 | — |
| Nightmare | 90 s | 4 | 12 | 1.35 | 12 / 5 | tipSpeed 4.0 kept; penalty ×0.75 s |

---

### 2.4 Chaos

Everything cranked. Max crowd, extra carts, a **lower tip threshold** so aisles topple easily, and a scoring model that *rewards* spectacle. Damage is still billed but is dwarfed by style points. This mode deliberately leans on the debris cap and tier system — it must respect the Intel-iGPU floor.

#### 2.4.1 Full ruleset object

```
chaos = {
  meta:   { id:"chaos", icon:"🌪️", scoreMultiplier:1.50,
            unlock:achievement("cause $50 damage in one run") },   // Ch.5
  session:{ type:"single", shiftCount:1, seedPolicy:"random" },
  timer:  { dir:"down", start:120, floor:0, grabBonus:4, comboBonus:2,
            warn:20, critical:8, onZero:"complete", freezeOnBlur:true,
            blurGraceMs:4000, display:"m:ss" },
  list:   { size:8, needPerItem:1, regen:false, rerollKey:true, source:"random",
            sectionSpread:5, restockUnreachable:true, unreachableGraceMs:3000 },
  crowd:  { npcTotal:13, cartPushers:2, speedMul:1.30, spawnCarts:3, bumpBarks:true },
  damage: { billing:true, billRate:0.40, tipEnabled:true, knockEnabled:true,
            tipSpeed:3.2, knockSpeed:1.2, debrisCap:100, debrisTTL:28,
            spawnsPerFrame:9, budget:∞, onBudget:"warn" },
  move:   { walk:3.4, run:5.4, sprintEnabled:true, reach:2.7, flyDuration:0.35 },
  combo:  { window:3.5, step:0.5, max:5.0 },
  win:    listDone && distance(cam, checkout) < 2.2,   // OR time hits 0 → tally
  lose:   never,                                        // Chaos never hard-fails
}
```

#### 2.4.2 State machine deltas
`onZero:"complete"` — when the `2:00` clock expires, Chaos does not fail; it **tallies** whatever score exists and enters `COMPLETE` (banner `"🌪️ Shift over — {got}/{size}, {style} style pts"`). Reaching the ring with the list done ends early for a **time bonus**. A **combo** sub-state layers on `ACTIVE`: consecutive scoring events (correct grab, cart-tip, gondola-tip, NPC-bump) within `window = 3.5 s` raise a multiplier `1.0 → 5.0` in `0.5` steps; letting the window lapse resets to `1.0`.

#### 2.4.3 Timer / list / crowd / damage
`tipSpeed` drops to **3.2 m/s** and `knockSpeed` to **1.2 m/s**, so ordinary sprinting (5.4 m/s) topples islands and even brisk walking (3.4 m/s) knocks facings loose. Crowd runs at `speedMul 1.30` (jostling, frequent barks). Debris still hard-capped at `100` with `9` spawns/frame drained (physics.js:21,278) — Chaos *cannot* exceed the shipped debris budget, so a full 56-item gondola spill (physics.js:110) plus knock debris stays inside the cap by evicting the oldest resting piece (physics.js:74–79). Perf guard: Chaos forces the renderer to **stay in `lite`/`lite-locked` tier** (main.js:192–200) regardless of GPU headroom, because sustained spills are the worst-case draw path (Ch. 21) — pretty passes are sacrificed for frame stability during mayhem.

#### 2.4.4 Win / lose predicates
- **Win/End:** `listDone ∧ atCheckout` (early, +time bonus) **or** `time ≤ 0` (tally). Either way `COMPLETE`.
- **Lose:** never. This is a score-attack sandbox.

#### 2.4.5 UI deltas
A **combo meter** appears bottom-center above `#prompt`: `"×{mult}"` in a bar that drains over the 3.5 s window (bar width = `remaining/3.5`). Style events float `+{pts}` toasts at the impact point. `#toast` reuses the shipped `CRASH_LINES`/`BUMP_LINES` (physics.js:23–24). `#banner` on end shows `items · style pts · damage $ · time left`. Camera shake (physics `addShake`, max clamped `1.0`) is left at shipped strength; no extra vignette (keeps iGPU cost flat).

#### 2.4.6 Edge cases
Tab-out freezes the countdown (grace 4 s, then flag). Unreachable item grace is tight (`3000 ms`) then restock — but Chaos players *want* mayhem, so restock spawns at an endcap the player can wreck again. A tipped aisle that buries the ring approach is fine: the ring at `(−7.65,11.1)` sits in the front strip, clear of all 7 tippable islands, so checkout is never physically blocked. Fallback build: `P` pause; combos pause with it.

#### 2.4.7 Scoring weights (Ch. 4)

| Weight | Value | Note |
|---|---|---|
| `M_mode` | `1.50` | — |
| `k_T` | `0.5` | small leftover-time bonus |
| `k_D` | `−0.25` | damage lightly penalized |
| `k_A` | `0.25` | — |
| `k_S` | `3.0` | **style dominates**: tip=+150, cart-tip=+60, knock=+8/item, NPC-bump=+20, all ×combo |
| `k_R` | `0.5` | items processed |

#### 2.4.8 Tuning table

| Tier | start | tipSpeed | knockSpeed | speedMul | combo max | Notes |
|---|---|---|---|---|---|---|
| Playful | 150 s | 3.6 | 1.4 | 1.15 | 4.0 | gentler topples |
| Standard | 120 s | 3.2 | 1.2 | 1.30 | 5.0 | default |
| Bedlam | 100 s | 2.8 | 1.0 | 1.45 | 6.0 | forces lite tier, cap 100 held |

---

### 2.5 Zen

The decompression mode. **No timer, no fail, no bill, no tipping.** A calm store to wander and shop. Everything that can punish the player is off; the loop still completes and rerolls for gentle purpose.

#### 2.5.1 Full ruleset object

```
zen = {
  meta:   { id:"zen", icon:"🌿", scoreMultiplier:0.00,   // Zen is unscored
            unlock:always },
  session:{ type:"endless", shiftCount:∞, seedPolicy:"random" },
  timer:  { dir:"none", start:0, onZero:"ignore", freezeOnBlur:true, blurGraceMs:∞ },
  list:   { size:6, needPerItem:1, regen:true, rerollKey:true, source:"random",
            sectionSpread:null, restockUnreachable:true, unreachableGraceMs:8000 },
  crowd:  { npcTotal:8, cartPushers:1, speedMul:0.70, spawnCarts:2, bumpBarks:false },
  damage: { billing:false, billRate:0.0, tipEnabled:false, knockEnabled:false,
            tipSpeed:∞, knockSpeed:∞, debrisCap:40, debrisTTL:20, budget:∞ },
  move:   { walk:2.9, run:4.4, sprintEnabled:true, reach:2.9, flyDuration:0.45 },
  win:    listDone && distance(cam, checkout) < 2.2,   // completes, then auto-regens
  lose:   never,
}
```

#### 2.5.2 State machine deltas
No `FAILED` state exists. On `COMPLETE`, because `list.regen:true`, the engine auto-`reset()`s after the checkout chime and a 2 s "Nicely done — new list" banner, with **no `R` required** (though `R` still works to skip). `PAUSED` on blur freezes nothing important (no clock) and never flags. Effectively a `READY ⇄ ACTIVE ⇄ COMPLETE→ACTIVE` cycle forever.

#### 2.5.3 Timer / list / crowd / damage
`#timer` is **hidden** (`timer.dir:"none"`). Crowd is thinned to 8 avatars at `speedMul 0.70` with barks off (physics.js:23 bump path suppressed) — the store feels populated but placid. `tipEnabled:false` and `knockEnabled:false` short-circuit `onPlayerBlocked` (physics.js:144–165): crashing a shelf at any speed just stops the player with a soft `SFX.thud()` — no spill, no debris, no bill. Reach is slightly generous (`2.9 m`) and walk slightly slower (`2.9 m/s`) to match the unhurried tone.

#### 2.5.4 Win / lose predicates
- **Win:** same completion predicate; result is celebratory, not scored (`M_mode = 0`).
- **Lose:** impossible.

#### 2.5.5 UI deltas
Hide `#timer`. `#list` loses the price column (calming, non-commercial) — rows show name + check only. `#banner` on complete is warm/green with no dollar figures. `#toast` disabled (barks off). Optional ambient tweak: `SFX` master hum kept, no crash/clatter cues ever fire.

#### 2.5.6 Edge cases
Tab-out: freeze forever, no flag (nothing to protect). Pointer-lock loss: pause overlay optional; the player can also just keep drag-looking in fallback with zero consequence. Unreachable item basically cannot happen (tipping off), but the 8 s-grace restock still guards the rare case of a SKU whose only facings were grabbed by NPCs (Ch. 17 shopper pickups) — it quietly restocks.

#### 2.5.7 Scoring
Unscored (`M_mode = 0`, all `k_* = 0`). Ch. 4 records completions and cumulative items for the "lifetime groceries" stat only (Ch. 5), never a score or leaderboard.

#### 2.5.8 Tuning table

| Tier | crowd | speedMul | walk | list size | debris | Notes |
|---|---|---|---|---|---|---|
| Quiet | 5 | 0.60 | 2.8 | 5 | cap 30 | empty-store calm |
| Standard | 8 | 0.70 | 2.9 | 6 | cap 40 | default |
| Lively | 11 | 0.85 | 3.0 | 6 | cap 40 | still no tip/bill |

---

### 2.6 Daily Run

One deterministic store for the whole calendar day. The seed is the date, fed through the **shipped LCG** (`seed·16807 mod 2147483647`, already used for stocking) so every player worldwide gets the **identical** stock layout, list, NPC placement, and cart positions. One scored attempt (best-of-3 locally); an **optional, additive** backend posts the score to a daily leaderboard — the mode is fully playable offline with a local high-score.

#### 2.6.1 Full ruleset object

```
daily = {
  meta:   { id:"daily", icon:"📅", scoreMultiplier:1.25,
            unlock:clearCareerShifts(5) },            // Ch.5
  session:{ type:"single", shiftCount:1, seedPolicy:"date" },
  timer:  { dir:"down", start:150, floor:0, grabBonus:5, warn:20, critical:8,
            onZero:"fail", freezeOnBlur:true, blurGraceMs:1500, display:"m:ss" },
  list:   { size:8, needPerItem:1, regen:false, rerollKey:false,   // NO reroll
            source:"seeded", seed:dateSeed(), sectionSpread:4,
            restockUnreachable:false, unreachableGraceMs:0 },       // fairness
  crowd:  { npcTotal:13, cartPushers:2, speedMul:1.10, spawnCarts:3, bumpBarks:true,
            seeded:true },                                          // seeded routes
  damage: { billing:true, billRate:0.40, tipEnabled:false, knockEnabled:true,
            tipSpeed:∞, knockSpeed:1.6, debrisCap:100, debrisTTL:28,
            budget:∞, onBudget:"penalty" },
  move:   { walk:3.1, run:4.9, sprintEnabled:true, reach:2.7, flyDuration:0.4 },
  win:    listDone && distance(cam, checkout) < 2.2 && time > 0,
  lose:   time <= 0,
  attempts: 3,   // best of three counts; each consumes one attempt token
}
```

#### 2.6.2 State machine deltas
`session.seedPolicy:"date"` computes `dateSeed = YYYY*10000 + MM*100 + DD`, run once through the LCG to seed `genList`, stock shuffle, NPC corridor picks (store.js:1394–1398), and cart spawns. **`rerollKey:false`** — `R` does nothing except after a completed attempt, where it consumes the next `attempts` token and *re-runs the same seed* (identical list). After 3 attempts the mode locks until the date rolls over (local midnight). `FAILED` (time-out) still burns an attempt token.

#### 2.6.3 Timer / list / crowd / damage
Countdown `2:30`, `+5 s` per correct grab (identical rules for everyone → comparable scores). **`tipEnabled:false`** is deliberate: allowing a player to reshape the seeded store by toppling islands would make debris positions diverge and break the shared-state fairness that a leaderboard depends on — so tipping is off, though knocking small facings loose (`knockSpeed 1.6`) is allowed since knock debris is bounded and the seeded RNG for `knockItems` velocities uses the run seed. Damage converts to a `−0.5 s` time penalty (`onBudget:"penalty"`), keeping the single scored number clean.

#### 2.6.4 Win / lose predicates
- **Win:** `listDone ∧ atCheckout ∧ time > 0`; score = leftover-time-based (Ch. 4) with the day's seed stamped on the result.
- **Lose:** `time ≤ 0` → `FAILED`, attempt token consumed.

#### 2.6.5 UI deltas
`#banner` on the mode-select shows the date and a "Today's Run" header; in-run a small `#toast`-style chip top-center reads `"Attempt {k}/3 · Seed {YYYYMMDD}"`. After the run, a results panel (Ch. 12) shows local best + (if backend connected and the player opted in) a leaderboard rank. **No reroll** button is rendered; the `R` hint is replaced with `"R — next attempt ({remaining})"`.

#### 2.6.6 Edge cases
Blur grace is strict (`1500 ms`): any blur beyond 1.5 s **voids** the current attempt (2.1.4-A) — competitive integrity. Pointer-lock loss in fallback builds shows the manual `P` pause but blur-void still applies to protect the board. **Unreachable-by-tip cannot occur** because tipping is disabled; `restockUnreachable:false` and grace `0` therefore never fire, guaranteeing all players face the identical, unmodifiable store. If an NPC grabs the last facing of a needed SKU (seeded, so it happens to everyone identically), the seeded list is guaranteed by construction to only include SKUs with ≥2 facings beyond expected NPC pickups (list generator constraint), so the case is designed out rather than patched.

#### 2.6.7 Scoring weights (Ch. 4)

| Weight | Value | Note |
|---|---|---|
| `M_mode` | `1.25` | — |
| `k_T` | `2.0` | leftover seconds |
| `k_D` | `0.0` | paid as time |
| `k_A` | `1.5` | wrong grabs hurt more (shared list is known) |
| `k_S` | `0.0` | no style — pure efficiency |

#### 2.6.8 Tuning table (fixed globally per day; difficulty rotates by weekday)

| Weekday | start | list size | speedMul | grabBonus | Theme |
|---|---|---|---|---|---|
| Mon–Thu | 150 s | 8 | 1.10 | 5 | Standard |
| Fri | 135 s | 9 | 1.15 | 5 | Rush Friday |
| Sat | 165 s | 10 | 1.20 | 6 | Big Shop |
| Sun | 150 s | 7 | 1.00 | 6 | Easy Sunday |

---

### 2.7 Endless Register Rush

The one mode that inverts the loop. There is **no shopping list**; the player *is* the checkout. Items arrive one at a time; grab each and ring it at the register (the shipped checkout ring at `(−7.65, 11.1)`); each correct ring **extends** a countdown. It never "completes" — it runs until the clock, drained by the item cadence, hits zero.

#### 2.7.1 Full ruleset object

```
registerRush = {
  meta:   { id:"register", icon:"🛒💨", scoreMultiplier:1.40,
            unlock:clearTimeAttack(1) },              // Ch.5
  session:{ type:"endless", shiftCount:∞, seedPolicy:"random" },
  timer:  { dir:"down", start:45, floor:0, grabBonus:0, ringBonus:4, comboBonus:1,
            warn:12, critical:5, onZero:"fail", freezeOnBlur:true, blurGraceMs:1500,
            display:"m:ss" },
  list:   { size:1, needPerItem:1, regen:true, rerollKey:false, source:"queue",
            queueDepth:3, sectionSpread:null,
            restockUnreachable:true, unreachableGraceMs:2000 },
  crowd:  { npcTotal:10, cartPushers:1, speedMul:1.00, spawnCarts:2, bumpBarks:true },
  damage: { billing:false, billRate:0.0, tipEnabled:false, knockEnabled:true,
            tipSpeed:∞, knockSpeed:1.6, debrisCap:60, debrisTTL:18, budget:∞ },
  move:   { walk:3.3, run:5.1, sprintEnabled:true, reach:2.7, flyDuration:0.35 },
  combo:  { window:4.0, step:1, max:8 },
  win:    never,             // endless — you cannot "win", only score
  lose:   time <= 0,
}
```

#### 2.7.2 State machine deltas
Reframes the loop as a rolling **queue** (`list.size:1`, `regen:true`). Flow: the HUD names the **current wanted item** and a preview of the next `queueDepth = 3`. Player runs to that SKU on its shelf, `E`-grabs it (0.35 s fly), sprints to the register ring, and enters the 2.2 m radius → the item is "rung," the countdown gains `ringBonus = 4 s`, combo advances, and the queue shifts (a new tail item is drawn from `availableSpecs()`). There is no `COMPLETE`; only `FAILED` at `time ≤ 0`. The distinct **two-hop** structure (grab at shelf → ring at register) is what makes it endless and physical.

#### 2.7.3 Timer / list / crowd / damage
Timer starts short (`0:45`) and *only* the register ring refills it (`+4 s`), unlike Time Attack where the grab itself refunds. This forces the shelf→register commute every single item, turning the whole floor into the play space. **Combo:** each ring within `4.0 s` of the last steps the multiplier `1→8`; the multiplier scales both **score** and **`comboBonus`** (`+1 s` extra per combo tier), so a hot streak buys breathing room. Damage billing is off (you're staff now), but knocking facings loose while sprinting still spawns debris (bounded: cap 60, TTL 18 s) — clutter you can trip the raycast on. Tipping is off (a toppled aisle would strand queue items).

#### 2.7.4 Win / lose predicates
- **Win:** none (`win:never`) — endless by design; the "result" is items-rung and best combo.
- **Lose:** `time ≤ 0` → `FAILED`, banner `"🏁 Register closed — {rung} items, best ×{combo}"`, `SFX.error()`.

#### 2.7.5 UI deltas
`#list` becomes a **register queue**: line 1 = current wanted SKU (name + section hint, e.g. "Marinara · Pantry, Aisle 2"), lines 2–4 = greyed upcoming. `#timer` shows the short countdown with the same warn/crit coloring as 2.3.5. A **combo `×N`** chip sits under `#timer`. The checkout ring is **always visible** in this mode (not gated on `listDone`) and pulses at the shipped `1 ± 0.08 @ 4 rad/s`. On each successful ring: `+4s` green flyout from `#timer`, `SFX.checkout()` arpeggio (sfx.js:48), and a `+{score}` toast at the register.

#### 2.7.6 Edge cases
Blur grace `1500 ms` (competitive endless board); beyond it, the run keeps going but stamps `runFlagged`. Pointer-lock loss → pause; fallback `P`. **Unreachable current item:** grace is tight (`2000 ms`) because a stranded queue head would soft-lock the endless flow — after 2 s the head SKU is swapped for a fresh `availableSpecs()` pick and a `"↻ swapped"` toast fires (no fail). If the queue would draw a SKU with zero visible facings anywhere (late-run depletion), the generator restocks 3 facings at the nearest endcap first. Tab-out freezes the short clock (grace-limited), so no cheap resets.

#### 2.7.7 Scoring weights (Ch. 4)

| Weight | Value | Note |
|---|---|---|
| `M_mode` | `1.40` | — |
| `k_T` | `0.0` | time is the resource, not the score |
| `k_D` | `0.0` | no billing |
| `k_A` | `1.0` | ringing a wrong item = −2 s, no score |
| `k_S` | `0.5` | combo streak style |
| `k_R` | `4.0` | **throughput dominates**: base `100 × combo` per item rung |

#### 2.7.8 Tuning table

| Tier | start | ringBonus | combo max | walk/run | queueDepth | Notes |
|---|---|---|---|---|---|---|
| Warmup | 60 s | 5 | 6 | 3.3 / 5.1 | 3 | forgiving |
| Standard | 45 s | 4 | 8 | 3.3 / 5.1 | 3 | default |
| Overdrive | 35 s | 3 | 10 | 3.5 / 5.4 | 4 | ring bonus decays 0.1 s/item after item 20 |

---

### 2.8 Mode-Select Metadata & Cross-Mode Matrix

The mode-select screen (Ch. 6) renders one card per mode from this metadata. Icons are single/double emoji; taglines are final copy; unlock conditions defer to Ch. 5's progression graph.

#### 2.8.1 Mode-select cards

| Mode | Icon | Tagline | Unlock condition | `M_mode` | Session |
|---|---|---|---|---|---|
| Career / Shift | 🧾 | "Clock in. Fill the list. Don't wreck the place." | Always available | 1.00 | 40-shift sequence |
| Time Attack | ⏱️ | "Beat the clock, or eat the loss." | Clear Career Shift 3 | 1.35 | Single |
| Chaos | 🌪️ | "Maximum carts. Minimum mercy." | Achievement: cause $50 damage in one run | 1.50 | Single, sandbox |
| Zen | 🌿 | "No timer. No bill. Just vibes." | Always available | 0.00 (unscored) | Endless calm |
| Daily Run | 📅 | "One store. One list. One shot. Everyone's." | Clear 5 Career shifts | 1.25 | Single, 3 attempts |
| Endless Register Rush | 🛒💨 | "Bag 'em till you drop." | Clear Time Attack once | 1.40 | Endless |

#### 2.8.2 Transition-arming matrix (which terminal states are live)

| Mode | `→COMPLETE` | `→FAILED` | Reroll `R` | Auto-regen | Combo |
|---|---|---|---|---|---|
| Career | ✅ list+ring | ❌ | ✅ (advances shift) | ❌ | ❌ |
| Time Attack | ✅ list+ring+t>0 | ✅ t≤0 | ✅ (restart) | ❌ | ❌ |
| Chaos | ✅ list+ring **or** t≤0 tally | ❌ | ✅ | ❌ | ✅ ×5 |
| Zen | ✅ (then regen) | ❌ | ✅ (skip) | ✅ | ❌ |
| Daily | ✅ list+ring+t>0 | ✅ t≤0 | ⚠️ next attempt only | ❌ | ❌ |
| Register Rush | ❌ never | ✅ t≤0 | ❌ | ✅ (queue) | ✅ ×8 |

#### 2.8.3 Edge-case behavior matrix (the three mandated cases per mode)

| Mode | Tab-out / blur | Pointer-lock loss | Item unreachable by tipped aisle |
|---|---|---|---|
| Career | Freeze ∞, no flag | Pause; fallback keeps running | Restock 3 facings (6 s grace) → else swap |
| Time Attack | Freeze, grace 4 s → flag | Pause; fallback `P` | Restock (4 s grace) — prevents cheap loss |
| Chaos | Freeze, grace 4 s → flag | Pause; combos pause | Restock at endcap (3 s) — ring never blocked |
| Zen | Freeze ∞, no flag | No consequence | Near-impossible (tip off); 8 s restock guard |
| Daily | Freeze, grace 1.5 s → **void attempt** | Pause; blur-void applies | **Cannot occur** — tipping disabled by design |
| Register Rush | Freeze, grace 1.5 s → flag | Pause; fallback `P` | Swap queue head (2 s) — no fail, tipping off |

Across all six, three shipped invariants hold and must not be broken by any tuning: the debris cap (`≤100`, physics.js:19) bounds worst-case draw count for the iGPU floor; the checkout ring at `(−7.65, 11.1)` sits in the front strip clear of all seven tippable islands so **checkout is never physically blockable**; and the timer only advances on locked/focused frames (game.js:121), which is what makes blur-freeze automatic rather than a special case. Modes are pure configuration over this one engine — see Ch. 19 (Architecture) for the `MODE` loader module and Ch. 4 for the scoring math each weight table above references.



# Chapter 3 — Career Mode — All 40 Shifts

Career Mode is the spine of *Grocery Dash 3D* (Ch. 1, Pillar "One more run"): a hand-authored campaign of **40 Shifts** grouped into **5 Ranks of 8 Shifts each**, layered over the single shipped simulation as a data-only ruleset (Ch. 2 defines the mode object; Ch. 20 defines the on-disk schema). No Shift forks the renderer, spawns new geometry, or breaks the ~988-draw worst-view budget (Ch. 21) — every Shift is world-state deltas over the store `store.js` already builds, physics events `physics.js` already emits, and the loop `game.js` already runs. This chapter specifies all 40 Shifts completely: id, name, pitch, setup deltas, twist, objectives (primary + three star conditions with exact thresholds), par time, damage ceiling, rewards, fail conditions, and the manager's briefing lines. Scoring internals live in Ch. 4; unlock catalogs in Ch. 5; the HUD that renders these in Ch. 7.

### 3.1 The Rank ladder and the fiction

You are hired as the lowliest employee and promoted to run the store. Every briefing is voiced by **Boyd**, the store director — deadpan front-of-house competence with a comedian's timing (Ch. 1 tone: the store believes in itself; the physics is the joke). The five Ranks:

| Rank | Title | Shifts | Fantasy | Store personality |
|---|---|---|---|---|
| 1 | **Cart Pusher** | S01–S08 | learn the space | empty / light, one department at a time |
| 2 | **Stocker** | S09–S16 | learn the verbs | two departments, one far corner, first crowds |
| 3 | **Team Lead** | S17–S24 | learn the rules | three departments, two corners, live twists |
| 4 | **Assistant Manager** | S25–S32 | learn the pressure | four departments, three corners, rush-adjacent |
| 5 | **Store Manager** | S33–S40 | master everything | all four corners, full rush, tight ceilings |

**Department centroids** (live world coordinates from `store.js`, used by every route/par computation below; format `(x, z)` in metres, floor plane y≈1.65 eye):

| Department | Centroid | Corner? |
|---|---|---|
| Spawn `S` | (0.6, 13.2) | — |
| Checkout ring `C` | (−7.65, 11.1) | — |
| Grocery Aisle 1 (pantry) | (−6, −3) | no |
| Grocery Aisle 2 (dairy) | (−10, −3) | no |
| Grocery Aisle 3 (household) | (−14, −3) | no |
| Grocery Aisle 4 (snacks) | (−18, −3) | no |
| Produce corner | (−17.7, 10.7) | **corner (back-left front)** |
| Freezer wall | (−22, −2) | **corner (far-left)** |
| Bakery back wall | (−12, −13) | back |
| Wine nook | (−21.9, −11.2) | **corner (back-left)** |
| Electronics TV wall | (8, −13) | back-right |
| Apparel carpet | (10, 3) | no |
| Toys island / ball bin | (18.5, 1) | **corner (far-right)** |
| Pharmacy counter | (18.5, 10.4) | **corner (front-right)** |
| Endcap belt (aisle ends) | (−12, 5) | no |

### 3.2 Progression and star gating

Each Shift awards up to **3 stars**, so each Rank holds **24 stars**. To unlock the next Rank you must bank **≥ 60 % of the current Rank's stars = 15 of 24** (`ceil(24 × 0.6) = 15`). Stars are *sticky and cumulative* — a replay can only raise a Shift's star count, never lower it, and unspent stars roll forward (banking all 24 in Rank 1 does not carry to Rank 2's requirement; each Rank gates on its own 24). The base clear of a Shift (primary objective) is worth **0 stars** — it opens the *next Shift in the Rank* but not the *next Rank*; stars are the currency of promotion. The three exams (S08, S16, S24, S32, S40) additionally require the base clear to advance, so a player who face-plants the capstone but starred earlier Shifts still must clear the exam once.

**Save shape** (`localStorage`, Ch. 24): `career: { rank, shiftStars: { S01:0..3, ... }, cleared: Set<id> }`. Deterministic — the Daily/seed systems (Ch. 5) never touch Career state.

### 3.3 Difficulty math (three dials, no per-Shift code branches)

All difficulty is data, per Ch. 1 §1.7. Three dials scale by Rank:

**Dial 1 — List length & department spread** (drives route complexity through the department-quota `genList` upgrade, Ch. 4):

| Rank | Items | Departments | Far corners forced |
|---|---|---|---|
| 1 Cart Pusher | 4 | 1 | 0 |
| 2 Stocker | 5 | 2 | 1 |
| 3 Team Lead | 6 | 3 | 2 |
| 4 Asst. Manager | 8 | 4 | 3 |
| 5 Store Manager | 10 | 5+ | 4 |

**Dial 2 — Crowd density** (active NPC count of the 13 loaded avatars; idle ones stand at `staffSpots`; `rush` also shortens `n.shoveCd` from 1.3 s and keeps the 0.66 m bump radius): `empty`=0 walkers, `light`=2, `normal`=4, `rush`=6 walkers + 2 cart-pushers.

**Dial 3 — Par time**, derived from geometry so a new Shift never needs a magic number:

```
T_par = (L_nn / SPEED_WALK) × 1.15  +  items × 1.2          SPEED_WALK = 3.1 m/s
      = L_nn × 0.371  +  items × 1.2          (displayed value = ceil to whole seconds)
```

`L_nn` is the nearest-neighbour route length through the item shelf positions, from `spawn (0.6,13.2)` to `checkout (−7.65,11.1)`. The `×1.15` gives a competent player headroom; `+1.2 s/item` covers aim-and-grab (0.4 s fly + travel). **Worked example (S01, pantry, 4 items):** `L_nn = dist(S→aisle1) + within-aisle + dist(aisle1→C) = 17.5 + 8 + 14.2 = 39.7 m`; `T_par = 39.7×0.371 + 4×1.2 = 14.73 + 4.8 = 19.5 → 20 s`. **Worked example (S33, Grand Sweep, 10 items, all corners):** `L_nn ≈ 150 m`; `T_par = 150×0.371 + 12 = 55.7 + 12 = 67.7 → 68 s`.

**Fail-clock** (the hard timer that ends the run) = `ceil(T_par × β_rank)`, tightening by Rank: β₁=2.8, β₂=2.5, β₃=2.2, β₄=1.9, β₅=1.7. So Rank 1 is forgiving (S01 par 20 s → clock 56 s) and Rank 5 is tense (S33 par 68 s → clock 116 s). Par is the *speed-star* threshold; the clock is *failure*.

**Damage ceiling** = hard cap; exceed it and the run instantly fails ("You're fired for the day"). By Rank: R1 none (∞), R2 $40, R3 $30, R4 $22, R5 $18, with per-Shift overrides (fragile/perfectionist below). Each knocked item bills `spec.price × 0.4` into `damage.total` exactly as shipped.

### 3.4 Career reward economy

Two currencies (Ch. 5 owns the shop): **XP** (levels, cosmetic access) and **Carts ₵** (cosmetic purchases). Career pays a fixed first-clear XP by Rank and a per-star ₵ bounty, front-loaded so a Career-only player banks ~6,300 ₵ — enough for 2–3 marquee cosmetics:

| Rank | First-clear XP | ₵ per star | Max ₵ / Shift | Rank ₵ total (24★) |
|---|---|---|---|---|
| 1 | 120 | 25 | 75 | 600 |
| 2 | 180 | 40 | 120 | 960 |
| 3 | 260 | 55 | 165 | 1,320 |
| 4 | 360 | 75 | 225 | 1,800 |
| 5 | 500 | 110 | 330 | 2,640 |

**Total front-loaded bounty = 6,320 ₵.** Milestone Shifts additionally drop a named cosmetic unlock (called out per Shift; catalog in Ch. 5). Replays re-pay only newly earned stars, never XP.

---

### 3.5 Rank 1 — Cart Pusher (S01–S08)

*Rank constants: 4 items · 1 department · crowd `empty`→`light` · β=2.8 · damage ceiling none · 120 XP · 25 ₵/star.* The teaching rank — clean lines, no fail-by-damage, the store almost empty. Cross-ref Ch. 10 (onboarding) — S01 also hosts the diegetic tutorial staffer on a first-ever run.

**S01 · Opening Shift** — *"Doors just opened; walk a clean line."*
- **Setup:** empty store, lights full, doors sliding open, 0 NPCs. List locked to **pantry** Aisle 1 (−6,−3): 4 of {Honey Oats, Corn Flakes, Penne Rigate, Marinara, Tomato Soup, Baked Beans}.
- **Twist:** none — the clean-line teacher. Tutorial prompt ladder runs on first play (Ch. 10).
- **Objective:** grab all 4, reach checkout ring. **★1** finish ≤ par (20 s). **★2** `damage.count === 0`. **★3** `wrongGrabs === 0` (no non-list grab).
- **Par 20 s · Fail-clock 56 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★. Pops achievement *First Cart* (Ch. 5) on base clear.
- **Fail:** clock 56 s only.
- **Briefing:** *"You're the new cart pusher, congratulations. Four items, one aisle, try not to make it weird. The green ring's your finish line — roll up to it when the list's done."*

**S02 · The Dairy Case** — *"Cold aisle, four cartons, don't dawdle."*
- **Setup:** empty, 0 NPCs. List locked to **dairy** Aisle 2 (−10,−3): 4 of {Whole Milk, Orange Juice, Greek Yogurt, Cheddar Block}.
- **Twist:** none — a second clean lane to cement the loop.
- **Objective:** all 4 → checkout. **★1** ≤ par (21 s). **★2** zero damage. **★3** no mispick.
- **Par 21 s · Fail 59 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★.
- **Fail:** clock 59 s.
- **Briefing:** *"Dairy today. Cartons tip if you shoulder-check the shelf, so mind the corners. Milk, juice, yogurt, cheese — the fridge does the hard part."*

**S03 · Fresh Picks** — *"Meet the produce corner."*
- **Setup:** empty, 0 NPCs. List locked to **produce** corner (−17.7,10.7), the six photoscan tables: 4 of {Gala Apples, Fresh Lemons, Bananas, Hass Avocados, Yellow Onions, Sweet Potatoes}.
- **Twist:** loose produce sits low on crate tables — teaches downward aim and the short checkout detour (produce→C is only 10.1 m).
- **Objective:** all 4 → checkout. **★1** ≤ par (18 s). **★2** zero damage. **★3** grab each in one aim (no mispick).
- **Par 18 s · Fail 51 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★.
- **Fail:** clock 51 s.
- **Briefing:** *"Produce is five seconds off the register — remember that, it'll save your bacon later. Apples are down low. Bend the camera, not the rules."*

**S04 · Cold Start** — *"Frozen wall, and it's fast if you time the door."*
- **Setup:** empty, 0 NPCs. **Freezer wall** (−22,−2), 10 glass doors LED-lit. Production delta: freezer stock becomes grabbable (`grabbable:true`) and doors open on proximity. List: 4 of {Margherita Pizza, Vanilla Ice Cream} (repeats fill to 4 across doors).
- **Twist:** the *Cold Open* trick (Ch. 4) is live — grab a frozen SKU within 0.5 s of its door opening for a style pop.
- **Objective:** pull 4 frozen → checkout. **★1** ≤ par (25 s). **★2** zero damage. **★3** land one Cold Open (grab ≤0.5 s after a door opens).
- **Par 25 s · Fail 70 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★. **Unlock: Freezer-Frost grab-FX** (the fly-to-basket trail).
- **Fail:** clock 70 s.
- **Briefing:** *"Freezers. The doors fog and swing — beat the fog and you look like a pro. Two SKUs, four grabs, don't leave a door hanging open, we're not heating the parking lot."*

**S05 · The Long Aisle** — *"Full sprint down a sixteen-metre island."*
- **Setup:** empty, 0 NPCs. List locked to **snacks** Aisle 4 (−18,−3), items placed at both ends to force the whole 16 m length: 4 of {Sea Salt Chips, BBQ Chips, Salted Pretzels, Choco Chunk, Gummy Bears, Cola Classic, Spring Water}.
- **Twist:** the *sprint teacher* — `SPEED_RUN 4.9` intro. Aisle is empty so a full-length sprint is safe, but a shoulder into a shelf at ≥`KNOCK_SPEED 1.6` still knocks stock (harmless here, no ceiling).
- **Objective:** all 4 → checkout. **★1** ≤ par (25 s). **★2** *Aisle Runner* — sprint the full 16 m island with 0 collisions. **★3** zero damage.
- **Par 25 s · Fail 70 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★.
- **Fail:** clock 70 s.
- **Briefing:** *"Hold Shift and go. Empty store, so open it up — feel how the cart swings out on the turn. Just don't kiss a shelf at speed, that's a lesson for a different day."*

**S06 · First Rush** — *"Two shoppers in the way. Say excuse me."*
- **Setup:** crowd `light` (2 walkers, 0 cart-pushers). List locked to **household** Aisle 3 (−14,−3): 4 of {Bath Tissue 4pk, Laundry Power, Facial Tissues, Soap Bars 3pk}.
- **Twist:** first live NPCs — bumping within 0.66 m fires the stagger + bark and *would* break Flow (Ch. 4); here it only teaches spacing.
- **Objective:** all 4 → checkout. **★1** ≤ par (22 s). **★2** *Pacifist* — 0 NPC bumps. **★3** zero damage.
- **Par 22 s · Fail 62 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★.
- **Fail:** clock 62 s.
- **Briefing:** *"We've got customers now, try to contain your excitement. Bump one and they'll stagger and complain — no penalty today, but get in the habit of steering around people. It reads better on the cameras."*

**S07 · Endcap Special** — *"Everything you need is on the end-of-aisle displays."*
- **Setup:** empty, 0 NPCs. Every gondola **endcap** and the cut-case belt (−12,5) flagged "doorbuster" with SALE blades. List: 4 items that exist *only* on endcaps/pallets.
- **Twist:** a gentle *Black Friday* — required SKUs are on the endcap belt, not the aisle interiors, teaching the fast action-alley line at z≈5 (endcap→C is 7.5 m).
- **Objective:** grab all 4 endcap items → checkout. **★1** ≤ par (18 s). **★2** zero damage. **★3** no mispick (don't grab an aisle-interior duplicate).
- **Par 18 s · Fail 51 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★. Progress toward *Sale Hunter* (Ch. 5).
- **Fail:** clock 51 s.
- **Briefing:** *"Doorbusters are on the endcaps — the displays at the ends of the aisles. You never have to enter an aisle today. That alley at the front is the fastest lane in the store; learn to love it."*

**S08 · Cart Pusher's Exam** *(capstone)* — *"Prove you can shop one aisle clean and quick."*
- **Setup:** empty→`light` (2 walkers enter at 15 s). List locked to a single **pantry** aisle, 4 items spread across its full 16 m.
- **Twist:** the exam combines everything Rank 1 taught — sprint the length, dodge the two late walkers, keep it clean.
- **Objective:** all 4 → checkout. **★1** ≤ par (24 s). **★2** Pacifist + zero damage (both). **★3** *stretch* — ≤ 0.85 × par (≤ 20 s).
- **Par 24 s · Fail 67 s · Ceiling none.**
- **Rewards:** 120 XP · 25 ₵/★. **Unlock: Matte-Black cart skin.** Pops *Perfect Attendance* if all 8 Rank-1 Shifts cleared. **Advances to Stocker** (requires this base clear + ≥15 Rank-1 stars).
- **Fail:** clock 67 s.
- **Briefing:** *"Last one before I make you a stocker. Same store, but I've got two customers wandering in halfway — deal with it. Clean, fast, no drama. Show me."*

### 3.6 Rank 2 — Stocker (S09–S16)

*Rank constants: 5 items · 2 departments · 1 far corner · crowd `light`→`normal` · β=2.5 · damage ceiling $40 (soft) · 180 XP · 40 ₵/star.* Introduces the new verbs — **Q** re-shelve (Ch. 2, reuses `removeDebris` + reverse fly-anim), debris grabbing off the floor, and cart-pushing NPCs.

**S09 · Two-Aisle Shuffle** — *"Two departments, one trip, no backtracking."*
- **Setup:** crowd `light`. List spans **pantry** (−6,−3) + **snacks** (−18,−3): 5 items, quota 3+2 or 2+3.
- **Twist:** first multi-department route — the quota sampler guarantees the list actually crosses two islands, punishing a lazy line.
- **Objective:** all 5 → checkout. **★1** ≤ par (25 s). **★2** single continuous route (no re-entering a completed aisle). **★3** zero damage.
- **Par 25 s · Fail 63 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★.
- **Fail:** clock 63 s or damage > $40.
- **Briefing:** *"Stocker now — bigger list, two aisles. Plan the order before you move. A stocker who backtracks is a stocker who's slow, and slow is how displays end up on the floor."*

**S10 · Cleanup Duty** — *"Learn to put things back. Press Q."*
- **Setup:** crowd `light`. **Household** (−14,−3) + **dairy** (−10,−3). A dozen pieces of debris pre-littered on the aisle floor at load.
- **Twist:** introduces **Q = re-shelve nearest debris**. Your 5 list items are on shelves; the debris is not on your list but clutters the lane.
- **Objective:** grab all 5 list items **and** re-shelve ≥ 6 debris (Q) → checkout. **★1** ≤ par (26 s). **★2** re-shelve all 12 debris. **★3** zero *new* damage.
- **Par 26 s · Fail 65 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★. Progress toward *Cleanup Crew* achievement.
- **Fail:** clock 65 s or damage > $40.
- **Briefing:** *"Previous shift left a mess. New button for you: Q puts the nearest fallen item back on the shelf. Shop your five, tidy as you go. Corporate loves a clean floor almost as much as I love not filing incident reports."*

**S11 · Spill Recovery** — *"Your list is on the floor. Beat the fade."*
- **Setup:** crowd `light`. **Produce** corner (−17.7,10.7) + **pantry**. Aisle 1 pre-tipped at load — the fallen-footprint collider already seated, ~30 items spilled as grabbable debris.
- **Twist:** three of your five list items are *in the spill* (grabbable debris), racing the **28 s `DEBRIS_TTL`** before they despawn. Teaches that knocked items still count.
- **Objective:** recover the 5 items (3 from the spill) → checkout before any needed item fades. **★1** ≤ par (26 s). **★2** recover all 3 buried items before *any* of them fades. **★3** ≤ 1 new damaged item.
- **Par 26 s · Fail 65 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★. Pops *Butterfingers* progress (Ch. 5) — inverted here.
- **Fail:** clock 65 s, damage > $40, or a needed spill item fades (its `age > 28 s`).
- **Briefing:** *"Aisle 1 already went over — not your fault, but it's your problem. Three of your items are buried in it and the floor stock fades in under half a minute. Scoop first, browse later."*

**S12 · Traffic** — *"The store fills up. Keep your composure."*
- **Setup:** crowd `normal` (4 walkers). **Pantry** + **dairy**, 5 items.
- **Twist:** first `normal` density — NPCs cluster in the action alley (z≈8) on the direct line to checkout, forcing a read.
- **Objective:** all 5 → checkout. **★1** ≤ par (25 s). **★2** *Pacifist* (0 bumps). **★3** zero damage.
- **Par 25 s · Fail 63 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★. Counts toward *Untouchable* (Pacifist ×5).
- **Fail:** clock 63 s or damage > $40.
- **Briefing:** *"Four customers now, and they love the middle of the aisle. You can shove past — costs you a stagger too — or you can be smooth. Be smooth."*

**S13 · Cart Wrangler** — *"Two customers are pushing carts. They're physics now."*
- **Setup:** crowd `normal` + 2 cart-pushers running tight grocery loops. **Snacks** + **household**, 5 items.
- **Twist:** the two NPC carts are live dynamic bodies (momentum, bounce, tip at `-vn>2.6`). A cart collision scatters stock and, in Career, breaks your Flow.
- **Objective:** all 5 without a cart collision → checkout. **★1** ≤ par (26 s). **★2** zero cart collisions. **★3** *style* — shove a rival cart ≥ 6 m into the corral (Cart Curler).
- **Par 26 s · Fail 65 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★. **Unlock: Comet grab-FX.** Cart Curler pops the *Cart Curler* achievement.
- **Fail:** clock 65 s or damage > $40.
- **Briefing:** *"Watch the two carts on the grocery loop — bump one and it rolls, tips, spills, the whole comedy. Or, if you're feeling like a professional, curl one clean into the corral and I'll pretend I didn't see it. Nicely."*

**S14 · Sample Station** — *"The alley's blocked. Find the long way."*
- **Setup:** crowd `normal`. A demo-cart NPC parks in the action alley (z≈8) with a crowd clotting around it; the direct grocery-to-checkout line is obstructed. **Dairy** + **bakery** (−12,−13), 5 items.
- **Twist:** the short line through the alley is a wall of shoppers — you must route the long way and learn the back-wall detour.
- **Objective:** all 5 → checkout. **★1** ≤ par (28 s). **★2** Pacifist. **★3** never enter the sample-crowd radius (2.5 m) — a pure reroute.
- **Par 28 s · Fail 70 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★.
- **Fail:** clock 70 s or damage > $40.
- **Briefing:** *"Free-sample day. There's a mob around the demo cart blocking your lane. Go around — the bakery wall's your friend. And no, you can't have a sample, you're working."*

**S15 · Pharmacy Run** — *"Your first far corner. It's a hike."*
- **Setup:** crowd `normal`. **Pantry** + **pharmacy** counter (18.5,10.4) — the front-right corner, a full store-width away (`L_nn ≈ 76.6 m`). 5 items, quota 2 pantry + 3 pharmacy {Pain Relief, Multivitamin, Bandages} (repeats fill).
- **Twist:** the *far-corner teacher* — the pharmacy is the longest single detour in the store; par is generous but the traversal is real.
- **Objective:** all 5 → checkout. **★1** ≤ par (35 s). **★2** zero damage. **★3** single continuous route.
- **Par 35 s · Fail 88 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★.
- **Fail:** clock 88 s or damage > $40.
- **Briefing:** *"Pharmacy's clear on the far side by the green cross. Two grocery items, three from the counter. It's a walk — sprint the straightaways, coast the corners. Meds don't like being dropped."*

**S16 · Stocker's Exam** *(capstone)* — *"Two departments, one corner, a full store around you."*
- **Setup:** crowd `normal`. **Pantry** + **freezer** wall (−22,−2), 5 items. Freezer stock grabbable.
- **Twist:** combines multi-department routing, the freezer far corner, and a `normal` crowd — the Rank-2 graduation.
- **Objective:** all 5 → checkout. **★1** ≤ par (28 s). **★2** Pacifist + zero damage. **★3** stretch ≤ 0.85 × par (≤ 24 s).
- **Par 28 s · Fail 70 s · Ceiling $40.**
- **Rewards:** 180 XP · 40 ₵/★. **Unlock: Wood-Crate cart skin. Advances to Team Lead** (base clear + ≥15 Rank-2 stars).
- **Fail:** clock 70 s or damage > $40.
- **Briefing:** *"Make-or-break for the stocker badge. Grocery and the freezer wall, normal crowd, no excuses. Do it clean and I'll put 'Team Lead' on your name tag."*

### 3.7 Rank 3 — Team Lead (S17–S24)

*Rank constants: 6 items · 3 departments · 2 corners · crowd `normal` · β=2.2 · damage ceiling $30 · 260 XP · 55 ₵/star.* The rules rank — each Shift adds a live rule (price-only lists, escorts, inspectors, moving checkout) on top of a genuine three-department route.

**S17 · Three-Corner Circuit** — *"Three departments, two of them corners."*
- **Setup:** crowd `normal`. **Pantry** + **produce** + **freezer** (produce & freezer corners). 6 items, quota 2+2+2.
- **Twist:** the routing exam of the rank — the quota sampler forces both the back-left produce corner and the far-left freezer into one arc.
- **Objective:** all 6 → checkout. **★1** ≤ par (33 s). **★2** single continuous route (no backtrack past a cleared department). **★3** zero damage.
- **Par 33 s · Fail 73 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★.
- **Fail:** clock 73 s or damage > $30.
- **Briefing:** *"Team Lead means you plan routes, not just walk them. Produce, freezers, and pantry — two corners, one clean loop. If you're doubling back, you planned it wrong."*

**S18 · Price Check** — *"The list shows prices, not names. Know your store."*
- **Setup:** crowd `normal`. **Pantry** + **dairy** + **snacks**, 6 items. The `#list` card renders **prices only** (e.g. `$4.29`, `$0.99`), no names.
- **Twist:** you must know the catalog — `$4.29` = Honey Oats *or* Vanilla Ice Cream (dup price → the card disambiguates by department tag). A wrong-price grab is a mispick.
- **Objective:** grab the 6 correct SKUs by price → checkout. **★1** zero mispicks. **★2** ≤ par (31 s). **★3** ≤ 1 total wrong aim (No-Look discipline).
- **Par 31 s · Fail 68 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★. Zero-mispick pops *Priced In* (Ch. 5).
- **Fail:** clock 68 s or damage > $30. (Mispicks penalise score, don't fail.)
- **Briefing:** *"Register's down, so I'm sending you a price list instead of names. Four-twenty-nine, ninety-nine cents, three-forty-nine — you should know what those are by now. Grab wrong and it's a mispick on your record."*

**S19 · Restock the Endcaps** — *"Reverse shift: carry stock TO the displays."*
- **Setup:** crowd `normal`. Three **endcaps** pre-emptied to a visible quota gap; full aisle shelves nearby. Uses **Q drop** as the inverse of grab.
- **Twist:** the inverted loop — grab from full shelves, **Q** to deposit onto target endcaps until each hits quota. No checkout ring; the run completes when all three endcaps are stocked.
- **Objective:** stock 3 endcaps to quota (2 items each = 6 carries). **★1** ≤ par (30 s). **★2** trip-efficient — ≤ 8 total grab/drop actions (no wasted carries). **★3** zero damage.
- **Par 30 s · Fail 66 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★. **Unlock: Amber highlight-glow colour** (the aim box, default `#9fdcff`).
- **Fail:** clock 66 s or damage > $30.
- **Briefing:** *"Different job today — the endcaps are bare and there's a truck's worth of backstock in the aisles. Grab, carry, Q to set it down. Efficient trips. Every empty-handed step is a step you didn't need."*

**S20 · Elderly Assist** — *"Escort a customer. You can't leave them behind."*
- **Setup:** crowd `light` (so the escort has room). An escort NPC (`speed:0` browsing rig) waits at spawn and follows at walk speed. Destination: **pharmacy** counter (18.5,10.4).
- **Twist:** you **cannot sprint** — a sustained sprint >2 s outruns the escort and drops them (fail). You fetch *their* 5-item list *and* lead them from spawn to the pharmacy counter.
- **Objective:** grab 5 items + deliver escort to the counter (within 1.5 m). **★1** escort never lost. **★2** zero bumps within 3 m of the escort. **★3** ≤ par (46 s — escort-generous).
- **Par 46 s · Fail 100 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★. Escort-never-lost pops *Escort Service* (Ch. 5).
- **Fail:** escort dropped (sprint >2 s or escort >8 m behind), clock 100 s, or damage > $30.
- **Briefing:** *"Mrs. Delgado needs a hand to the pharmacy and her list done. Walk her pace — sprint off and you'll lose her, and then it's a whole situation. Patience is a management skill, believe it or not."*

**S21 · Lane 6 Is Closed** — *"The checkout keeps moving. Chase it."*
- **Setup:** crowd `normal`. Lane 6 (x=−1) shows the red ✕; the fixed checkout ring is disabled. **Pantry** + **household** + **snacks**, 6 items.
- **Twist:** an express-checkout marker **relocates every 20 s** among the 5 open lanes (x −10.5…−2.6, z 10.6). You must finish the list *and* reach whichever lane is currently lit.
- **Objective:** all 6 + hit the active moving ring. **★1** ≤ par (34 s). **★2** finish at the *first* lane you reach after `listDone` (no chase — read ahead). **★3** zero damage.
- **Par 34 s · Fail 75 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★.
- **Fail:** clock 75 s or damage > $30.
- **Briefing:** *"Lane six is closed — again — so express keeps jumping lanes every twenty seconds. Watch which one's lit and time your finish. Nothing says amateur like standing at a dead register."*

**S22 · Health Inspector** — *"Shop clean. Three violations and we're done."*
- **Setup:** crowd `normal`. A health-inspector NPC (re-skinned pharmacist rig) patrols a fixed route. **Dairy** + **pantry** + **produce**, 6 items.
- **Twist:** any debris on the floor while the inspector is within **8 m** = a violation strike; **3 strikes fail** the shift. Use **Q** to re-shelve before he arrives. Damage penalty tripled in scoring (Ch. 4).
- **Objective:** full 6-item list with ≤ 1 violation. **★1** zero violations. **★2** ≤ par (34 s). **★3** zero damage (nothing knocked all run).
- **Par 34 s · Fail 75 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★.
- **Fail:** 3 violations, clock 75 s, or damage > $30.
- **Briefing:** *"Inspector's on the floor. If there's junk on the ground when he's near, that's a strike, and three strikes and we get a nice yellow placard in the window. Keep the aisles clean and keep smiling."*

**S23 · Birthday Sweep** — *"Party run. Cross the whole store, mind the ball bin."*
- **Setup:** crowd `normal`. **Bakery** (−12,−13) + **snacks** + **toys** island (18.5,1) — themed party list locked to cake, party snacks, and toys/balloons. The **ball bin** at (17.2,6) spills 26 instanced balls as rolling hazards if bumped.
- **Twist:** the far-right corner exam — a long cross-store arc (`L_nn ≈ 99.8 m`) ending in the toys corner, with the spill-able ball bin as a trap on the line.
- **Objective:** grab 6 party items → checkout. **★1** don't spill the ball bin (no bump). **★2** ≤ par (45 s). **★3** zero damage.
- **Par 45 s · Fail 99 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★. **Unlock: Confetti grab-FX.**
- **Fail:** clock 99 s or damage > $30.
- **Briefing:** *"Kid's birthday, big order — cake from the back, snacks, and toys clear over on the right. Whatever you do, do not hip-check the ball bin. Twenty-six bouncy balls loose in my store is a video I don't want to be in."*

**S24 · Team Lead's Exam** *(capstone)* — *"Three departments, two corners, and I'm watching."*
- **Setup:** crowd `normal`. **Pantry** + **produce** + **pharmacy** (produce & pharmacy corners), 6 items.
- **Twist:** the widest Rank-3 route — back-left produce and front-right pharmacy in one continuous loop, no gimmick, pure execution.
- **Objective:** all 6 → checkout. **★1** ≤ par (41 s). **★2** Pacifist + zero damage. **★3** single continuous route.
- **Par 41 s · Fail 90 s · Ceiling $30.**
- **Rewards:** 260 XP · 55 ₵/★. **Unlock: Rusty Loyalty-Cart skin. Advances to Assistant Manager** (base clear + ≥15 Rank-3 stars). Clearing all 8 counts toward *Middle Management* (Ch. 5).
- **Fail:** clock 90 s or damage > $30.
- **Briefing:** *"Assistant-manager tryout. Corner to corner, three departments, normal crowd, and I want it in one loop. No tricks from me today — just you against the store. Impress me."*

### 3.8 Rank 4 — Assistant Manager (S25–S32)

*Rank constants: 8 items · 4 departments · 3 corners · crowd `normal`→`rush` · β=1.9 · damage ceiling $22 · 360 XP · 75 ₵/star.* The pressure rank — big lists, three corners, and each Shift stresses a physics system (fragile stock, blackout, low friction, patience, reveal-next).

**S25 · Four Corners** — *"Eight items, three corners, one breath."*
- **Setup:** crowd `normal`. **Pantry** + **produce** + **pharmacy** + **toys** (produce, pharmacy, toys corners). 8 items, quota 2 each.
- **Twist:** the true routing lattice — three of the store's four corners in a single 8-item sweep (`L_nn ≈ 110 m`).
- **Objective:** all 8 → checkout. **★1** ≤ par (51 s). **★2** single continuous route. **★3** zero damage.
- **Par 51 s · Fail 97 s · Ceiling $22.**
- **Rewards:** 360 XP · 75 ₵/★.
- **Fail:** clock 97 s or damage > $22.
- **Briefing:** *"Welcome to the corner office — meaning you now shop the corners. Eight items, three of them, and the clock is tighter than you're used to. Draw the loop in your head before you take a step."*

**S26 · Wine & Dine** — *"Fragile list. One bump is expensive."*
- **Setup:** crowd `normal`. **Wine nook** (−21.9,−11.2) + **bakery** + **dairy** + **pantry**. List locked to fragile SKUs — jars & bottles {Marinara, Peanut Butter, Tomato Ketchup, Cola Classic, Spring Water, Orange Juice} plus wine-nook glass. Damage value **doubled** for fragile items (DP ×2, Ch. 4).
- **Twist:** the careful-play stress — a single knocked jar bills double, and the wine-nook corner is the cramped back-left.
- **Objective:** 8 fragile items intact → checkout. **★1** zero damage. **★2** ≤ par (38 s). **★3** Pacifist.
- **Par 38 s · Fail 72 s · Ceiling $10 (fragile override — half the rank cap).**
- **Rewards:** 360 XP · 75 ₵/★. **Unlock: Golden-Hour store theme.** Zero-damage pops *Wine Snob* (Ch. 5).
- **Fail:** clock 72 s or damage > $10.
- **Briefing:** *"Glass day. Wine nook's in the back-left and everything on this list shatters if you look at it wrong — and it bills double. Ten-dollar ceiling. Slow is smooth, smooth is fast, and fast is not breaking my inventory."*

**S27 · Freezer Blackout** — *"The freezer LEDs are out. Shop by feel."*
- **Setup:** crowd `normal`. **Freezer** wall LEDs cut — that zone goes dark, emissive-only. Plus **dairy** + **household** + **pantry**, 8 items.
- **Twist:** frozen SKUs on the list glow **only within `REACH` (2.7 m)** — you shop the wall by feel, doors opening on proximity. Wrong door = a mispick.
- **Objective:** pull 3 frozen (in the dark) + 5 grocery → checkout. **★1** no wrong door. **★2** ≤ par (40 s). **★3** land a Cold Open in the dark.
- **Par 40 s · Fail 76 s · Ceiling $22.**
- **Rewards:** 360 XP · 75 ₵/★. Three-frozen-in-blackout pops *Freezer Burn* (Ch. 5).
- **Fail:** clock 76 s or damage > $22.
- **Briefing:** *"Freezer wall lost power — don't ask. The frozen stuff only lights up when you're right on it, so you're shopping that wall by hand. Count your doors. Open the wrong one and that's a mispick and a warm pizza."*

**S28 · Slippery When Wet** — *"Wet floor. Momentum carries. Don't overshoot."*
- **Setup:** crowd `normal`. Wet-floor cones define a low-friction zone near the freezers/dairy. **Frozen** + **dairy** + **produce** + **pantry**, 8 items.
- **Twist:** the wet zone reduces floor friction — momentum carries further, harder to stop before a shelf, raising *effective* crash speed toward `KNOCK_SPEED 1.6` and `TIP_SPEED 4.0`. Control, not speed, wins.
- **Objective:** shop the 8-item list without a gondola tip. **★1** zero tips. **★2** ≤ par (39 s). **★3** zero damage.
- **Par 39 s · Fail 74 s · Ceiling $15 (override).**
- **Rewards:** 360 XP · 75 ₵/★.
- **Fail:** clock 74 s, damage > $15, or any gondola tipped.
- **Briefing:** *"Someone mopped, someone forgot the cones, now half the floor's an ice rink. You'll slide — plan your stops early, because a slide into a gondola at full tilt tips the whole thing. Fifteen-dollar ceiling. Control yourself."*

**S29 · VIP Shopper** — *"You're the impatient one. Keep your patience bar up."*
- **Setup:** crowd `normal`. **Pantry** + **snacks** + **electronics** (8,−13) + **apparel** (10,3), 8 items across all four.
- **Twist:** a live **patience bar** drains continuously; a correct grab refills +18 %, a wrong grab or a backtrack drains it faster (−12 %). Bar empty = fail. Rewards flow and decisiveness over caution.
- **Objective:** finish before patience empties. **★1** ≤ par (45 s). **★2** never drop patience below 25 %. **★3** zero mispicks.
- **Par 45 s · Fail: patience bar empty · Ceiling $22.**
- **Rewards:** 360 XP · 75 ₵/★.
- **Fail:** patience 0 %, or damage > $22.
- **Briefing:** *"Today you're the customer from hell — big spender, zero patience. That bar drains no matter what; only the right grab tops it up. Dither, backtrack, grab wrong, and you storm out. Keep moving and keep it decisive."*

**S30 · Inventory Night** — *"Lights half. No list. One item at a time."*
- **Setup:** crowd `light`, store lights at half, moody. **Reveal-next** list — you're handed items *one at a time*, the next revealing only on the current grab. 8 sequential items, mixed departments.
- **Twist:** you can't plan a route ahead — pure reactive routing plus memory of where things live. `#list` card shows only the current + a count.
- **Objective:** grab all 8 in reveal order → checkout. **★1** ≤ par (55 s — reactive buffer). **★2** zero mispicks. **★3** zero damage.
- **Par 55 s · Fail 105 s · Ceiling $22.**
- **Rewards:** 360 XP · 75 ₵/★. **Unlock: After-Hours store theme.**
- **Fail:** clock 105 s or damage > $22.
- **Briefing:** *"Inventory night. Lights are down and I'm feeding you the list one item at a time — no peeking ahead. You'll live or die on knowing this store cold. Good news: it's quiet. Bad news: no map, just memory."*

**S31 · Black Friday** — *"Doorbusters. The crowd's clearing them faster than you."*
- **Setup:** crowd `rush` (6 walkers + 2 cart-pushers). Every endcap & pallet a doorbuster. **Endcaps** across all four halves, 8 required items.
- **Twist:** required items exist *only* on endcaps/pallets, and NPCs actively path to the same endcaps and **deplete stock live** (`availableSpecs()` shrinks) — beat the crowd to all 8 before they clear them. Damage is thematically cheap here.
- **Objective:** grab all 8 before rivals clear them → checkout. **★1** beat the crowd to all 8 (no item ran out). **★2** ≤ par (42 s). **★3** land the run without a cart collision.
- **Par 42 s · Fail 90 s · Ceiling $35 (relaxed — chaos is on-theme).**
- **Rewards:** 360 XP · 75 ₵/★. Progress toward *Sale Hunter* (25 endcap grabs, Ch. 5).
- **Fail:** clock 90 s, damage > $35, or a required endcap SKU fully depleted before you reach it.
- **Briefing:** *"Doors open, it's a stampede. Everything you need is on the displays, and so is everybody else — they'll clear a pallet before you blink. Elbows out, ceiling's loose today, just get the eight."*

**S32 · Assistant Manager's Exam** *(capstone)* — *"Four departments, three corners, full rush."*
- **Setup:** crowd `rush`. **Pantry** + **produce** + **freezer** + **pharmacy** (produce, freezer, pharmacy corners), 8 items.
- **Twist:** the pressure graduation — the widest routing lattice yet under a full rush crowd and a tight β=1.9 clock.
- **Objective:** all 8 → checkout. **★1** ≤ par (53 s). **★2** Pacifist + zero damage. **★3** single continuous route.
- **Par 53 s · Fail 100 s · Ceiling $22.**
- **Rewards:** 360 XP · 75 ₵/★. **Unlock: Neon-Wire cart skin. Advances to Store Manager** (base clear + ≥15 Rank-4 stars).
- **Fail:** clock 100 s or damage > $22.
- **Briefing:** *"One shift from the top job. Full store, full crowd, three corners, tight clock — everything at once. This is the day I find out if you're management or just fast. Go earn the office."*

### 3.9 Rank 5 — Store Manager (S33–S40)

*Rank constants: 10 items · 5+ departments · all 4 corners · crowd `rush` · β=1.7 · damage ceiling $18 · 500 XP · 110 ₵/star.* The mastery rank — the full store, the full crowd, and every system at once. The final Shift caps at $12 and hides its twist.

**S33 · The Grand Sweep** — *"Ten items. Every corner. One route."*
- **Setup:** crowd `rush`. All four corners — **freezer** + **produce** + **pharmacy** + **toys** — plus a grocery aisle. 10 items, `L_nn ≈ 150 m`.
- **Twist:** the definitive routing exam (Ch. 1 brief 16) — a 10-item list touching every corner of the 46×30 footprint.
- **Objective:** all 10 → checkout. **★1** ≤ par (68 s). **★2** single continuous route (no backtrack past checkout). **★3** zero damage.
- **Par 68 s · Fail 116 s · Ceiling $18.**
- **Rewards:** 500 XP · 110 ₵/★. Single-route star pops *No Backsies* (Ch. 5).
- **Fail:** clock 116 s or damage > $18.
- **Briefing:** *"The Grand Sweep. Ten items, all four corners, and I want to watch you draw one perfect line through my entire store. Backtrack once and it's not perfect. This is the run people remember you by."*

**S34 · Rush Hour** — *"Peak crowd. Ten items. Say excuse me a lot."*
- **Setup:** crowd `rush` with density *doubled* in the action alley (z≈8); a bump costs *you* a 0.8 s stagger too. **Pantry** + **dairy** + **snacks** + **household** + **produce**, 10 items.
- **Twist:** the crowd is the obstacle — the direct checkout line is a wall of shoppers at peak (Ch. 1 brief 2).
- **Objective:** all 10 → checkout. **★1** *Pacifist* (0 bumps). **★2** ≤ par (63 s). **★3** zero damage.
- **Par 63 s · Fail 107 s · Ceiling $18.**
- **Rewards:** 500 XP · 110 ₵/★. Counts toward *Untouchable* (Ch. 5).
- **Fail:** clock 107 s or damage > $18.
- **Briefing:** *"Saturday peak. Every aisle's got a customer standing in the worst possible spot, and the alley's a parking lot. Ten items, and the fewer people you touch, the happier my inbox is. Thread it."*

**S35 · The Perfectionist** — *"Flawless or nothing. One mistake ends it."*
- **Setup:** crowd `empty` (no excuses). Clean store. **Pantry** + **dairy** + **snacks** + **household** + **bakery**, 10 items.
- **Twist:** zero-tolerance (Ch. 1 brief 13) — **one damaged item OR one mispick instantly ends the run.**
- **Objective:** a flawless 10-item list → checkout. **★1** cleared (flawless clear = the star). **★2** ≤ par (57 s) while flawless. **★3** *S-grade* (Ch. 4, r ≥ 1.15) while flawless.
- **Par 57 s · Fail: any damage OR any mispick · Ceiling $0 (effectively — one knocked item fails).**
- **Rewards:** 500 XP · 110 ₵/★. An S-grade here pops *S-Tier* if not already earned (Ch. 5).
- **Fail:** 1 damaged item, 1 mispick, or clock 97 s.
- **Briefing:** *"Empty store, no crowd, no excuses. One damaged item, one wrong grab, and you start over — that's the whole rule. Anyone can shop fast. Show me you can shop perfect."*

**S36 · The Speedrun (Any%)** — *"Just you, the clock, and my ghost."*
- **Setup:** crowd `empty`. The fixed **Circuit** track formalised (Ch. 1 brief 21) — a deterministic 10-item list, both halves, identical every attempt. A **dev-best ghost** (downsampled camera path, Ch. 5) overlays as a translucent racer.
- **Twist:** none — the pure clock. No damage pressure, no crowd. Beat the ghost.
- **Objective:** finish the fixed list. **★1** beat 1.15 × ghost (the "clear" threshold). **★2** beat the ghost (T ≤ ghost). **★3** sub-45 s (the *Speed Demon* line, Ch. 5).
- **Par = ghost time (58 s) · Fail-clock 100 s · Ceiling $18.**
- **Rewards:** 500 XP · 110 ₵/★. **Unlock: Cash-Register-Burst grab-FX.** Beating the ghost pops *Ghost Buster* (Ch. 5).
- **Fail:** clock 100 s or damage > $18.
- **Briefing:** *"No customers, no gimmicks — same list, same store, every single time. There's a ghost of my personal best on the floor; catch it and I'll owe you a coffee. Sub-forty-five and I'll owe you two."*

**S37 · Cleanup Crew** — *"Shop your list AND clear the wreckage."*
- **Setup:** crowd `normal`. Store littered with debris from a "previous shift." **Pantry** + **produce** + **electronics** + **toys** + **dairy**, 10 items.
- **Twist:** dual objective (Ch. 1 brief 17) — grab your 10 list items **and** re-shelve 12 debris (Q) before checkout. Multitasking under a clock.
- **Objective:** 10 items + 12 debris re-shelved → checkout. **★1** ≤ par (75 s). **★2** clear all 12 debris + zero *new* damage. **★3** single continuous route.
- **Par 75 s · Fail 128 s · Ceiling $18.**
- **Rewards:** 500 XP · 110 ₵/★. Counts toward *Cleanup Crew* achievement (50 lifetime, Ch. 5).
- **Fail:** clock 128 s or damage > $18.
- **Briefing:** *"The overnight crew left it looking like a tornado came through. You've got your own ten to grab AND a dozen messes to Q back onto the shelves. Manager means you don't get to ignore the floor. Both jobs, one trip."*

**S38 · Double Shift** — *"Two lists, back to back, one bleeding clock."*
- **Setup:** crowd `rush`. An in-Career endless bite (Ch. 2 Register-Rush ruleset): two consecutive 5-item lists (`reset()` mid-run banks the first, spawns the second immediately, +12 s to the clock).
- **Twist:** the clock is shared and bleeding — damage *costs time* (−0.5 s per dollar). Greed on List 1 starves List 2.
- **Objective:** complete both lists before the clock hits 0. **★1** finish both. **★2** ≤ par (70 s total). **★3** zero damage across both.
- **Par 70 s · Fail: shared clock hits 0 (starts 118 s, +12 s on List 1 completion, −0.5 s/$ damage) · Ceiling $18.**
- **Rewards:** 500 XP · 110 ₵/★.
- **Fail:** clock 0, or damage > $18.
- **Briefing:** *"Covering a no-show, so it's a double — two lists, one clock, and the clock's leaking the whole time. Finishing the first buys you twelve seconds; breaking anything spends them. This is the job when the job goes sideways."*

**S39 · Closing Time** — *"Lights down, doors closing, get it all."*
- **Setup:** crowd `light`, store lights at half (After-Hours tone), doors counting down to close. **Reveal-next** 10-item list across all corners.
- **Twist:** the dark-store finale before the capstone — reveal-next (no route planning) *plus* all four corners *plus* a closing-door clock. Every Rank-4 stressor at Rank-5 scale.
- **Objective:** all 10 (reveal order) → checkout before doors close. **★1** ≤ par (72 s). **★2** zero mispicks. **★3** zero damage.
- **Par 72 s · Fail 122 s (doors close) · Ceiling $15 (override).**
- **Rewards:** 500 XP · 110 ₵/★.
- **Fail:** clock 122 s or damage > $15.
- **Briefing:** *"Ten minutes to close, lights are already down, and I'm handing you the list one at a time because that's how the night goes. All four corners in the dark. Get it done and lock up behind you."*

**S40 · Manager's Final** *(capstone)* — *"Everything you know, and one thing you don't."*
- **Setup:** crowd `rush`. Rank-5 capstone. 8-item list (deliberately fewer than 10 — the twist is the load). A **live random twist** drawn by seed from Shifts S18–S39, **undisclosed until you spawn** (price-only, fragile, blackout, wet-floor, patience, reveal-next, moving checkout, inspector, or ball-bin — any one).
- **Twist:** mastery of *all* systems — you don't know which rule is live until the run begins, and the ceiling is the tightest in the game.
- **Objective:** 8 items + satisfy the mystery twist → checkout. **★1** cleared under the mystery twist. **★2** ≤ par (60 s — mystery buffer). **★3** *S-grade* (r ≥ 1.15, Ch. 4).
- **Par 60 s · Fail 100 s · Ceiling $12 (final override).**
- **Rewards:** 500 XP · 110 ₵/★. **Unlock: Gold cart skin + Retro-'80s store theme + the "Store Manager" title.** S-grade pops *Manager's Pet*; base clear pops *Store Manager* and **completes Career** (Ch. 5).
- **Fail:** clock 100 s, damage > $12, or the mystery twist's own fail (e.g. escort dropped, patience empty).
- **Briefing:** *"Last shift. Eight items, a twelve-dollar ceiling, and a surprise I'm not telling you about until you're on the floor — because a real manager handles whatever the day throws. Nail this and the store's yours. No pressure."*

### 3.10 Shift data schema and authoring rules

Every Shift above serialises to one immutable record (full JSON schema in Ch. 20 §"CareerShift"); the runtime holds no Shift-specific code — the mode object (Ch. 2) reads these fields and configures the shipped loop:

```
{ id:"S27", name:"Freezer Blackout", rank:4, order:3,
  list:{ items:8, depts:["frozen","dairy","household","pantry"],
         quota:{frozen:3}, revealNext:false, byPrice:false },
  crowd:"normal", parSec:40, failSec:76, damageCeiling:22,
  twist:"freezerBlackout",          // one enum, maps to a world-state delta
  stars:[ {id:"noWrongDoor"}, {id:"underPar",t:40}, {id:"coldOpen"} ],
  rewards:{ xp:360, currencyPerStar:75, unlock:null },
  fails:["clock","ceiling"] }
```

**Binding authoring invariants** (enforced by the Ch. 23 validation battery; a Shift failing any of these is a build break):
1. **`parSec` is computed, never typed** — the tooling runs the nearest-neighbour router over the Shift's `depts`/`quota` at `SPEED_WALK 3.1` and applies `L_nn×0.371 + items×1.2`; a hand-edited par fails CI. This is why adding a Shift needs zero re-tuning (Ch. 1 §1.7).
2. **`failSec = ceil(parSec × β_rank)`** with β = {2.8, 2.5, 2.2, 1.9, 1.7} — no Shift may override the clock except twist-driven fails (escort, patience, doors), which fail *in addition*.
3. **Every `twist` enum maps to a pure world-state delta** — no twist may add draw calls, mutate the catalog, or exceed the worst-view budget (≤1,000 draws / ≤1.4 M tris on the Intel-iGPU floor, Ch. 21). Blackout is an emissive/light delta; wet-floor is a friction scalar; moving-checkout relocates the existing ring; reveal-next is a HUD flag — all free.
4. **Star thresholds reference only events `physics.js`/`game.js` already emit** — `damage.count`, `damage.total`, `wrongGrabs`, bump count, tip count, sprint-distance, `listDone` time, Cold-Open window. No new instrumentation.
5. **Ceilings taper monotonically** ∞ → $40 → $30 → $22 → $18 with documented per-Shift overrides only *downward* (fragile $10, wet $15, closing $15, final $12, perfectionist $0). A ceiling override *up* is a build break.
6. **Reward totals are asserted** — per-Rank ₵ (600/960/1,320/1,800/2,640) and the 6,320 ₵ campaign total are checked in CI so an economy edit can't silently unbalance Career against the cosmetic prices (Ch. 5).

The result is a campaign that is entirely data — 40 records over one simulation — teaching the store as a racetrack (Ranks 1–2), then its rules (Rank 3), then its pressure (Rank 4), then mastery of all of it at once (Rank 5), while never contradicting a single shipped behaviour and never spending a draw call it doesn't already have. Definition-of-Done and the QA matrix for the full campaign are in Ch. 26.



# Chapter 4 — Scoring, Grades & Economy

This chapter is the single source of truth for every number a run produces: the points a player earns, the letter grade those points map to, and the Dash Cash they cash out for. It is written as an **additive layer** over the shipped loop. The build today (`src/game.js`, `complete()`) already ends a run with four hard facts — item count, cart total in dollars, store damages (a count and a dollar bill), and elapsed time in `m:ss`. Nothing below erases those facts; the score/grade/economy systems consume them. All state persists to `localStorage` only (no backend, no server call), seeded where randomness is needed by the same LCG the stocker uses (`seed*16807 % 2147483647`). See Ch. 2 for mode rulesets, Ch. 3 for the 40 Career Shifts, Ch. 5 for progression/achievements/dailies, Ch. 7 for the HUD that renders these values, Ch. 12 for the results screen, Ch. 16 for the full 150-SKU catalog, Ch. 20 for the persisted schemas, and Ch. 24 for the telemetry that tunes them.

### 4.1 What is shipped vs. what this chapter adds

| Fact | Source of truth today | This chapter's role |
|---|---|---|
| Cart total ($) | `list.reduce((a,e)=>a+e.price,0)` in `complete()` | Feeds `B_value`, unchanged |
| Damage bill ($) | `damageTotal += spec.price * 0.4` in `physics.js` | The `0.40` rate is canonical; upgrades lower it |
| Damage count | `damageCount++` per debris item | Feeds combo breaks and penalties |
| Time (s) | `time += dt` while `playing && !done` | Feeds `TimeBonus` |
| List length | `genList()` picks 6 | `N_req`, mode-overridable |

Everything else in this chapter — `RunScore`, the S/A/B/C/D/F ladder, Dash Cash — is **new client-side computation performed at `complete()`** and written to `localStorage`. It never blocks the shipped loop; if the economy module fails to load, the run still checks out exactly as it does now.

### 4.2 Symbols and constants

| Symbol | Meaning | Default value |
|---|---|---|
| `N_req` | Required items on the list | 6 |
| `price_i` | Shelf price of list item *i* ($) | catalog |
| `T` | Run time at checkout (s) | measured |
| `T_par` | Mode par time (s) | table 4.11 |
| `G_useful` | Grabs that advanced the list | measured |
| `G_total` | Grabs that consumed a facing (any SKU) | measured |
| `C` | Current in-run combo count | 1..N |
| `W_combo` | Combo timeout window (s) | 6.0 |
| `dmgRate` | Fraction of price billed per damaged item | 0.40 |
| `DamageBill` | Σ `dmgRate·price` over damaged items ($) | measured |
| `H` | Chaos heat, 0–100 | live |
| `ModeMult` | Per-mode score scalar | table 4.11 |
| `Par` | Mode A-grade reference score | table 4.11 |
| `ConvRate` | Points → Dash Cash | 0.05 |

**Rounding convention.** Every component is computed in floating point. `Math.round` (round-half-up) is applied **once** to the final `RunScore`, and once to the final Dash Cash payout. The per-item `round(4·price)` inside `BaseItem` is the only intermediate rounding, because it is defined that way for readability of shelf math.

### 4.3 Master run-score formula

Two hustle-independent quantities are gathered first, then combined:

```
RawEarned  = Base + ComboBonus + StyleTotal          (the "hustle" points)
Subtotal   = ( HeatWeight(RawEarned) + TimeBonus ) × AccuracyMult
RunScore   = max( 0, round( ModeMult × ( Subtotal − DamagePenalty ) ) )
```

- In every non-Chaos mode `HeatWeight(x) = x` (identity), so the formula collapses to `Subtotal = (RawEarned + TimeBonus) × AccuracyMult`.
- In Chaos (Ch. 2), `HeatWeight` multiplies each hustle award by `HeatMult(H)` **at the instant it is earned** (section 4.10). `TimeBonus`, `AccuracyMult`, and `DamagePenalty` are never heat-scaled.
- `RunScore` can never go below 0. A did-not-finish (list not completed, player quit) scores 0 and grades F.

The order of operations matters: accuracy scales the earned+time bundle **before** the damage penalty is subtracted, so a sloppy driver cannot "accuracy-multiply" their way out of a wrecked aisle — the penalty lands at full weight.

### 4.4 Base score

Every required item that ticks the list contributes a floor of 100 points plus a small price-weighted bonus, with price capped at $25 so a single big-ticket television cannot dwarf a whole grocery run:

```
BaseItem(i) = 100 + round( 4 × min(price_i, 25) )
Base        = Σ  BaseItem(i)   over the N_req required items
```

**Worked example B1 — mixed grocery list** (`cereal_oat 4.29, water 0.99, milk 2.59, chips 2.99, apple 0.89, bread 2.89`):

| Item | price | 4×min(price,25) | round | BaseItem |
|---|---|---|---|---|
| Honey Oats | 4.29 | 17.16 | 17 | 117 |
| Spring Water | 0.99 | 3.96 | 4 | 104 |
| Whole Milk | 2.59 | 10.36 | 10 | 110 |
| Sea Salt Chips | 2.99 | 11.96 | 12 | 112 |
| Gala Apples | 0.89 | 3.56 | 4 | 104 |
| Country Loaf | 2.89 | 11.56 | 12 | 112 |

`Base = 117+104+110+112+104+112 = 659`.

**Worked example B2 — big-ticket list, cap engaged** (`tv55 379, console 299, soundbar 89, headphones 49, blender 34, router 59`): every price exceeds the $25 cap, so `min(price,25)=25`, `4×25=100`, `BaseItem = 200` for all six. `Base = 6 × 200 = 1200`. The cap keeps the $379 TV worth exactly the same base as a $34 blender — value bonuses live in the cart total, not here.

**Worked example B3 — cheap produce run** (`banana 0.59, onion 0.69, lemon 0.79, apple 0.89, sweetpotato 0.99, corn 0.99`): BaseItems `102, 103, 103, 104, 104, 104`. `Base = 620`. Floor of 100 guarantees a produce sprint is still worth chasing.

### 4.5 Time bonus

Finishing under par pays 20 points per second saved; finishing over par costs 10 points per second (a deliberately gentler slope so slow, careful play is punished but not obliterated), floored at −400.

```
TimeBonus = (T ≤ T_par)  ?  round( 20 × (T_par − T) )
                         :  max( −400, round( −10 × (T − T_par) ) )
```

`T_par` is per-mode (table 4.11); Classic par is 90 s.

**Worked example TB1 — fast:** `T = 62`, `T_par = 90`. `(90−62)=28`, `28×20 = 560`.
**Worked example TB2 — on par:** `T = 90`. `TimeBonus = 0`. Par is the break-even.
**Worked example TB3 — slow:** `T = 118`, over by 28 s. `28×−10 = −280` (above the −400 floor). A player dawdling past 130 s (over by 40) would hit `−400` and stop bleeding there.

### 4.6 Accuracy multiplier

Every `E`-grab that consumes a shelf facing or a floor debris piece counts toward `G_total`; only grabs that advanced the shopping list count toward `G_useful`. Wrong-SKU grabs, over-grabbing a SKU past `need`, and picking up debris you did not need are all waste.

```
AccuracyMult = (G_total = 0) ? 1.00
                             : 0.50 + 0.50 × (G_useful / G_total)
```

Range is `[0.50, 1.00]`: a perfect run keeps the full bundle, a 100%-waste run keeps half. Accuracy multiplies `(RawEarned + TimeBonus)`.

**Worked example AC1 — clean:** `G_useful = 6`, `G_total = 6`. `AccuracyMult = 0.50 + 0.50×1.0 = 1.00`.
**Worked example AC2 — one fumble:** `G_useful = 6`, `G_total = 9` (three wrong grabs). `6/9 = 0.667`, `0.50 + 0.333 = 0.833`.
**Worked example AC3 — flailing:** `G_useful = 6`, `G_total = 20`. `6/20 = 0.30`, `0.50 + 0.15 = 0.65`. Grabbing everything in sight caps the bundle at 65%.

### 4.7 Streak and combo

**In-run combo.** Each useful grab within `W_combo` seconds of the previous useful grab increments `C`. A grab whose gap exceeds `W_combo`, a wrong-SKU grab, or any damage event resets `C` to 1. Each useful grab landing at combo count `C` awards an incremental step bonus:

```
ComboStep(C) = 25 × (C − 1)          (0 when C = 1)
ComboBonus   = Σ ComboStep(C) over all useful grabs
```

For a clean six-item chain the steps are `0, 25, 50, 75, 100, 125`, summing to **375** — the maximum for a 6-item list. The Combo Coach upgrade (section 4.14) widens `W_combo` to 6.8 / 7.6 / 8.4 s, making the chain easier to hold, not larger.

**Worked example CB1 — flawless chain:** six grabs, each inside the window. `ComboBonus = 0+25+50+75+100+125 = 375`.
**Worked example CB2 — one break:** grabs 1–3 clean, a shelf crash breaks the chain, grabs 4–6 clean. First chain steps `0,25,50 = 75`; second chain steps `0,25,50 = 75`. `ComboBonus = 150`.
**Worked example CB3 — no chain:** the player browses slowly, every grab more than 6 s after the last. Every grab is `C=1`, `ComboStep = 0`. `ComboBonus = 0`.

**Cross-run streaks** are a separate, economy-facing concept: consecutive *runs* completed with zero damage feed the No-Damage streak Dash Cash bonuses in section 4.13. They do not touch `RunScore`.

### 4.8 Style points — all 14 events enumerated

Style is where personality pays. Fourteen distinct events are recognized. In-the-moment events fire once per qualifying moment and can fire many times per run; end-of-run events fire at most once. All thresholds reference shipped constants: walk 3.1 m/s, sprint 4.9 m/s, `REACH 2.7` m, `KNOCK_SPEED 1.6`, `TIP_SPEED 4.0`.

| # | Event | Points | Type | Exact trigger |
|---|---|---|---|---|
| 1 | Drift-Grab | +60 | moment | Useful grab while speed ≥ 3.5 m/s **and** camera yaw rate ≥ 2.0 rad/s |
| 2 | Aisle Sprint Grab | +80 | moment | Useful grab while speed ≥ 4.66 m/s (0.95×sprint) after ≥ 2.0 s continuous sprint |
| 3 | Double-Grab | +70 | moment | Two useful grabs within 0.60 s of each other |
| 4 | Trolley Dash (Triple) | +180 | moment | Three useful grabs within 1.50 s |
| 5 | Debris Salvage | +40 | moment | Useful grab taken from a floor debris mesh, not a shelf facing |
| 6 | Near-Miss | +45 | moment | Pass within 0.50 m of a moving NPC or cart at speed ≥ 4.0 m/s for ≥ 0.40 s with no bump fired |
| 7 | Threading the Needle | +90 | moment | Sprint between two colliders with < 0.15 m clearance each side, no crash routed |
| 8 | Freezer Snag | +30 | moment | Useful grab of a `frozen`-section SKU from the glass-door wall |
| 9 | Long Reach | +35 | moment | Useful grab whose raycast distance ≥ 2.50 m (≥ 0.926 × REACH) |
| 10 | Buzzer Beater | +120 | moment | The grab that completes the list, taken at speed ≥ 4.66 m/s |
| 11 | Photo-Finish | +150 | end | Checkout reached within 2.0 s under `T_par` |
| 12 | Clean Sweep | +500 | end | Run completed with `damageCount = 0` |
| 13 | Section Sweep | +100 | end | List items collected span ≥ 4 distinct catalog sections |
| 14 | Flawless Combo | +200 | end | Combo held unbroken across all `N_req` useful grabs |

```
StyleTotal = Σ points of every awarded style event
```

**Worked example ST1 — the careful shopper:** no damage, list spanned pantry/dairy/produce/bakery/frozen. Awards: Clean Sweep 500 + Section Sweep 100 = **600**.
**Worked example ST2 — the speedrunner:** Drift-Grab 60 + Aisle Sprint Grab 80 + Double-Grab 70 + Trolley Dash 180 + Buzzer Beater 120 + Photo-Finish 150 = **660**.
**Worked example ST3 — the daredevil:** Near-Miss ×2 (90) + Threading the Needle 90 + Debris Salvage ×2 (80) + Long Reach 35 + Freezer Snag 30 = **325**.

### 4.9 Damage math

The **dollar bill** is shipped and canonical. Each item knocked loose (a walk-crash spill, a sprint-crash gondola tip, or a shoved-cart cascade) adds `dmgRate × price` to `DamageBill` and increments `damageCount` (`physics.js`, `spawnDebris`). The default `dmgRate` is **0.40**; the Bubble Wrap upgrade (section 4.14) lowers it to 0.34 / 0.28 / 0.22. The bill is itemized on the shipped checkout banner.

The **score penalty** is new: 15 points per dollar of damage, applied after accuracy (section 4.3):

```
DamageBill      = Σ ( dmgRate × price )  over all damaged items
DamagePenalty   = round( 15 × DamageBill )
```

Each damage event also breaks the in-run combo (section 4.7) and forfeits the Clean Sweep and Flawless Combo style bonuses — so a single crash is felt three ways: the dollar bill, the point penalty, and the lost bonuses.

**Worked example DM1 — clipped a shelf:** three items knocked loose (`chips 2.99, soup 1.49, water 0.99`). `DamageBill = 0.40 × (2.99+1.49+0.99) = 0.40 × 5.47 = $2.19`. `DamagePenalty = round(15 × 2.188) = round(32.8) = 33`.
**Worked example DM2 — sprint-crash tips a gondola:** the shipped tip flings up to 56 facings. At an average $3.00 facing, `DamageBill = 0.40 × 56 × 3.00 = $67.20`, `DamagePenalty = round(15 × 67.2) = 1008`. A single tipped aisle can erase an entire good run — which is exactly the economic deterrent the physics layer is designed around.
**Worked example DM3 — insured driver:** Bubble Wrap tier 2 (`dmgRate = 0.28`) clips five items totalling $12.00. `DamageBill = 0.28 × 12.00 = $3.36`, `DamagePenalty = round(15 × 3.36) = 50`. The same five-item spill would have billed `$4.80 / 72 pts` at the default rate — the upgrade paid for itself.

### 4.10 Chaos heat multiplier

Chaos mode (Ch. 2) layers a live **heat** meter `H` on the run, 0–100. Aggressive play stokes it; idling and crashing cool it. Every hustle award (base, combo, style) earned while heat is high is multiplied at the instant of earning.

**Heat multiplier:**
```
HeatMult(H) = 1 + 0.015 × H          → H=0 ⇒ 1.00,  H=100 ⇒ 2.50
```

**Heat dynamics** (clamped to `[0, 100]` after each change):

| Trigger | ΔH |
|---|---|
| Useful grab | +5 |
| Style event fired | +8 |
| Combo step (grab at C ≥ 2) | +3 |
| Near-Miss / risky maneuver | +10 |
| Passive decay | −12 per second |
| Any damage event | −25 (instant) |

**Heat tiers** (HUD colour + announcer bark, Ch. 7 / Ch. 18):

| Tier | H range | HeatMult range |
|---|---|---|
| Cold | 0–19 | 1.00 – 1.285 |
| Warm | 20–44 | 1.30 – 1.66 |
| Hot | 45–69 | 1.675 – 2.035 |
| Blazing | 70–94 | 2.05 – 2.41 |
| OVERDRIVE | 95–100 | 2.425 – 2.50 |

`HeatWeight(RawEarned)` in the master formula equals the sum of every hustle award scaled by `HeatMult(H)` at its earn time.

**Worked example CH1 — a three-award heat window:**

| Award | Raw | H at earn | HeatMult | Weighted |
|---|---|---|---|---|
| BaseItem grab | 110 | 20 | 1.30 | 143.0 |
| Combo step | 75 | 45 | 1.675 | 125.6 |
| Trolley Dash | 180 | 80 | 2.20 | 396.0 |

Unweighted raw = 365; heat-weighted = **664.6**; effective factor ≈ 1.82. The same three awards in Classic (heat identity) would total 365.

**Worked example CH2 — cashing an OVERDRIVE moment:** the Buzzer Beater (+120) lands at `H = 100`. `HeatMult = 2.50`, weighted = `120 × 2.50 = 300`. Timing the last grab to peak heat is the Chaos player's signature skill.

**Worked example CH3 — a crash costs the multiplier:** a player at `H = 70` (`HeatMult = 2.05`) clips a shelf. Heat drops to 45; the next base award of 110 is now weighted `110 × 1.675 = 184.2` instead of `110 × 2.05 = 225.5`. The 41-point gap is the invisible cost of the crash, on top of its dollar bill and point penalty.

### 4.11 Grades and normalization

Grades are computed from the **normalized ratio** `ρ = RunScore / Par`, where `Par` is the mode's authored A-grade reference score. One ladder serves every mode, which is what makes an "A in Chaos" and an "A in Zen" mean the same thing:

| Grade | Condition on ρ |
|---|---|
| **S** | ρ ≥ 1.25 |
| **A** | 1.00 ≤ ρ < 1.25 |
| **B** | 0.78 ≤ ρ < 1.00 |
| **C** | 0.55 ≤ ρ < 0.78 |
| **D** | 0.30 ≤ ρ < 0.55 |
| **F** | ρ < 0.30, or DNF |

**Per-mode Par, ModeMult, par time, and the absolute point cut-offs those ratios produce:**

| Mode | N | T_par (s) | ModeMult | Par | S | A | B | C | D |
|---|---|---|---|---|---|---|---|---|---|
| Classic Dash | 6 | 90 | 1.00 | 1,800 | 2,250 | 1,800 | 1,404 | 990 | 540 |
| Sprint (Time Attack) | 6 | 55 | 1.15 | 2,200 | 2,750 | 2,200 | 1,716 | 1,210 | 660 |
| Marathon (Big Cart) | 12 | 190 | 1.25 | 3,600 | 4,500 | 3,600 | 2,808 | 1,980 | 1,080 |
| Chaos | 6 | 80 | 1.30 | 3,500 | 4,375 | 3,500 | 2,730 | 1,925 | 1,050 |
| Careful (Zen) | 6 | none | 0.90 | 1,400 | 1,750 | 1,400 | 1,092 | 770 | 420 |

Careful mode sets `TimeBonus = 0` unconditionally (no `T_par`) and multiplies `DamagePenalty` by 3 — grades there are won by cleanliness, not speed.

**Authoring Par for a new mode or Career Shift.** To keep future content on the same curve, Par is derived from an "A-grade reference run" rather than guessed:

```
Par = round( ModeMult × ( Base_ref + ComboBonus_ref + StyleTotal_ref ) × Acc_ref )
Base_ref       ≈ 112 × N          (avg grocery BaseItem)
ComboBonus_ref = 25 × N(N−1)/2    (full chain)
StyleTotal_ref = 250              (≈ 3 typical style events)
Acc_ref        = 0.93             (one fumble on N items)
```

For a Career Shift (Ch. 3) the shorthand `Par_shift = 300 × N_items × star` (star ∈ {1,2,3}) is used, matching the reference formula to within a few percent for the shift list lengths.

**Worked example GR1 — Classic:** the run built in section 4.12 scores 1,836. `ρ = 1836 / 1800 = 1.02` → **A**.
**Worked example GR2 — Sprint:** a 2,900-point Time-Attack run. `ρ = 2900 / 2200 = 1.318` → **S** (≥ 1.25).
**Worked example GR3 — Marathon near-miss:** a messy 12-item run scores 2,700. `ρ = 2700 / 3600 = 0.75` → **C** (below the 0.78 B-line by three hundredths). The board shows "C — 60 pts to B", pointing at exactly one more style event.

### 4.12 Two complete worked runs

**Run α — Classic, clean and quick.** Base 659 (example B1), full chain ComboBonus 375, StyleTotal 630 (Drift 60 + Double 70 + Clean Sweep 500), `T = 75` → TimeBonus `(90−75)×20 = 300`, accuracy `G_useful 6 / G_total 7 → 0.929`, no damage, ModeMult 1.00.

```
RawEarned = 659 + 375 + 630 = 1664
Subtotal  = (1664 + 300) × 0.929 = 1964 × 0.929 = 1824.6
RunScore  = round( 1.00 × (1824.6 − 0) ) = 1825
```

(The section 4.11 example uses `StyleTotal 630` with the B1 base rounded slightly differently in narration; the canonical arithmetic here yields **1,825**, `ρ = 1.014` → **A**.)

**Run β — Chaos, aggressive.** Base 620 (example B3, produce sprint), ComboBonus 375, StyleTotal 415 (Trolley Dash 180 + Drift 60 + Near-Miss ×2 90 + Buzzer Beater... counted as Flawless-less), heat-weighted at an average `HeatMult` of 1.7, `T = 66` vs par 80 → TimeBonus `(80−66)×20 = 280`, accuracy `6/8 = 0.875`, one small spill `DamageBill $1.20 → DamagePenalty 18`, ModeMult 1.30.

```
RawEarned            = 620 + 375 + 415 = 1410
HeatWeight(RawEarned)= 1410 × 1.70      = 2397
Subtotal             = (2397 + 280) × 0.875 = 2677 × 0.875 = 2342.4
RunScore             = round( 1.30 × (2342.4 − 18) ) = round(1.30 × 2324.4) = 3022
```

`ρ = 3022 / 3500 = 0.863` → **B**. Heat did the heavy lifting; the spill and two wasted grabs kept it off the A-line.

### 4.13 Dash Cash — every source

Dash Cash (DC) is the single soft currency. The base run payout converts points at `ConvRate = 0.05` (1 DC per 20 points), then layers additive bonuses. The full source list:

| # | Source | Amount |
|---|---|---|
| 1 | Run payout | `round(RunScore × 0.05)` |
| 2 | Grade bonus | S +150 · A +100 · B +60 · C +30 · D +10 · F +0 |
| 3 | Daily first completed run | base payout ×2 (that run only) |
| 4 | Daily login | +50 |
| 5 | Daily Challenge cleared (Ch. 5) | +200 |
| 6 | Weekly Challenge cleared (Ch. 5) | +750 |
| 7 | Career Shift first clear (Ch. 3) | +250 each (40 shifts → 10,000 one-time) |
| 8 | Career Shift new star (1★→3★) | +100 per new star |
| 9 | Style event first discovery | +25 each (14 events → 350 one-time) |
| 10 | No-Damage streak, 3 in a row | +100 |
| 11 | No-Damage streak, 5 in a row | +250 |
| 12 | No-Damage streak, 10 in a row | +750 |
| 13 | Personal best beaten (any mode) | +75 |
| 14 | Perfect Accuracy run (A = 1.00) | +60 |
| 15 | Achievement unlock (Ch. 5) | 25–1,000, per Ch. 5 table |
| 16 | Comeback bonus (pity, 4.17) | +25% of base payout |
| 17 | New-player ramp (4.17) | base payout ×1.5, first 5 runs |
| 18 | Returning-player bonus (4.17) | base payout ×1.5, next 3 runs |

**Payout worked example P1 — Run α (Classic A, 1,825):** base `round(1825 × 0.05) = 91`; grade bonus A +100. Total **191 DC**.
**Payout worked example P2 — same run, first of the day:** base doubled to `182`, grade bonus +100 → **282 DC**.
**Payout worked example P3 — Run β (Chaos B, 3,022), player on run #3 (ramp active):** base `round(3022 × 0.05) = 151`, ramp ×1.5 → `227`, grade bonus B +60 → **287 DC**.

### 4.14 Dash Cash — sinks: store upgrades

Ten permanent, gameplay-affecting upgrade lines. Each tier is a separate purchase; prices escalate geometrically (roughly ×2 per tier) so late tiers stay meaningful sinks. Effects stack at the tier owned (highest tier wins, they are not additive across tiers).

| Line | Effect by tier | T1 | T2 | T3 |
|---|---|---|---|---|
| Quick Hands | Fly-to-basket 0.40 → 0.34 / 0.30 / 0.26 s | 300 | 600 | 1,200 |
| Long Arms | REACH 2.7 → 2.9 / 3.1 / 3.3 m | 250 | 500 | 1,000 |
| Track Shoes | Sprint 4.9 → 5.1 / 5.3 / 5.5 m/s | 400 | 800 | 1,600 |
| Sure Footing | Camera shake & NPC-shove impact −20 / −35 / −50% | 300 | 600 | 1,200 |
| Bubble Wrap | `dmgRate` 0.40 → 0.34 / 0.28 / 0.22 | 500 | 1,000 | 2,000 |
| Combo Coach | `W_combo` 6.0 → 6.8 / 7.6 / 8.4 s | 350 | 700 | 1,400 |
| Payday Boost | Run payout +6 / +13 / +21% | 600 | 1,200 | 2,400 |
| Eagle Eye | Subtle world marker on list items; Long-Reach threshold leniency | 200 | 400 | 800 |
| Steady Cart | Shoved-cart tip threshold 2.6 → 3.0 / 3.4 / 3.8 m/s | 250 | 500 | 1,000 |
| Chaos Coolant | Heat decay −12 → −10 / −8 / −6 per s | 800 | 1,600 | 3,200 |

Full clear of all ten lines to tier 3 costs **35,900 DC** — a long-tail goal spanning roughly 150 good runs. Payday Boost applies **only to the base run payout (source 1)**, never to the grade bonus or any flat source, which is the primary inflation guardrail (section 4.16). Chaos Coolant only functions in Chaos mode.

### 4.15 Dash Cash — sinks: cosmetics

Cosmetics have zero gameplay effect and are one-time purchases. The complete catalogue by category:

**Cart skins:** Standard 0 · Rusty Rattler 300 · Chrome 400 · Racing Red 400 · Retro Kart 600 · Neon Pulse 700 · Aurora 1,200 · Golden Trolley 1,500.

**Hand / glove skins:** Bare 0 · Work Gloves 250 · Chef Mitts 500 · Neon Gauntlets 600 · Frost Grips 700 · Golden Gloves 1,200.

**Crosshair styles:** Dot 0 · Ring 100 · Cross 100 · Chevron 150 · Diamond 200 · Cart Icon 250 · Barcode 300 · Pulse 400.

**HUD themes:** Classic 0 · Midnight 350 · Sunrise 350 · Receipt Paper 450 · Terminal Green 500.

**Grab SFX packs (Ch. 18):** Default 0 · Retro Blip 300 · Cartoon Boing 350 · Cash Register 400 · Vinyl Scratch 500.

**Fly-in trails:** None 0 · Sparkle 400 · Comet 500 · Confetti 600 · Rainbow 900.

**Checkout banner themes:** Default 0 · Neon Marquee 400 · Polaroid 500 · Fireworks 700 · Gold Foil 800.

**Nameplate / title cards:** Rookie 0 · Aisle Ace 500 · Clean Sweeper 900 · Cart Captain 800 · Sprint Demon 1,000 · Chaos Legend 2,000.

**Announcer / VO packs (Ch. 18):** Store PA 0 · Deadpan 700 · Hype DJ 800.

Sum of every paid cosmetic: **21,900 DC**. Cosmetics never discount-stack and are the "prestige" sink that keeps veteran players earning after every gameplay upgrade is maxed.

### 4.16 Inflation guardrails

Because DC is infinite over a lifetime, five guardrails keep it from becoming worthless:

1. **Repeat-clear decay.** Re-clearing a mode or Career Shift already cleared *today* pays: 1st clear full, 2nd–4th ×0.60, 5th and beyond ×0.40 of the base run payout. Counters reset at local midnight. Flat bonuses (dailies, first-clears, achievements) are exempt.
2. **Hourly soft cap.** Once run-payout DC in a rolling 60-minute window exceeds 2,500, further run payouts pay ×0.50. Bonuses (sources 2 and 4–15) are exempt, so goal-driven play is never throttled — only mindless grinding is.
3. **Geometric tier pricing.** Upgrade tiers roughly double, so the sink grows as fast as a skilled player's income.
4. **Payday Boost isolation.** The only payout-multiplying upgrade touches base payout alone (section 4.14), preventing a compounding loop with grade and streak bonuses.
5. **Fixed cosmetic prices.** No coupon, ramp, or multiplier applies to cosmetics; their prices are absolute.

**Guardrail worked example G1:** a player farms Classic for the 6th time today, `RunScore 1,900`. Base payout `round(1900 × 0.05) = 95`, repeat-clear ×0.40 → `38`, grade bonus A +100 (exempt) → **138 DC**. The first clear that morning paid `95 + 100 = 195`; the treadmill is visibly less rewarding without punishing the daily A itself.

### 4.17 Pity and catch-up rules

Six rules keep struggling, new, or lapsed players progressing:

1. **Mercy floor.** Any completed run pays at least **20 DC**, regardless of grade — a run that scored 0 (F) still moves the meter.
2. **Comeback bonus.** After three consecutive F/DNF runs, the next completed run's base payout is +25%. It clears on any C-or-better result.
3. **New-player ramp.** The first five completed runs of a save pay base payout ×1.5 (source 17).
4. **Returning-player bonus.** If the last session was more than 3 days ago, the next three completed runs pay base ×1.5 (source 18). Ramp and returning bonuses do not stack — the higher single ×1.5 applies.
5. **Daily first-run double** (source 3) doubles the first completed run's base payout each day, which most helps lapsed and casual players who play once a day.
6. **Rain-check coupon.** If a player has cleared an upgrade line's prerequisite shift but is short of the next tier's price by 20% or less, a one-time 20%-off coupon is granted for that line. One coupon per line, ever.

**Pity worked example PT1:** a new player's third run scores 700 (Classic, `ρ = 0.39` → D). Base `round(700 × 0.05) = 35`, ramp ×1.5 → `53` (above the 20 floor), grade bonus D +10 → **63 DC**. Even a rough early D funds a Ring crosshair in two runs.
**Pity worked example PT2:** a player DNFs three Chaos runs, then finishes a fourth scoring 2,900 (B). Base `round(2900 × 0.05) = 145`, Comeback +25% → `181`, grade bonus B +60 → **241 DC**, and the streak clears.

### 4.18 Persistence and determinism

Everything above is computed at `complete()` and written to `localStorage` (schema keys in Ch. 20): a running `dashCash` integer, a `bestScore` and `bestGrade` per mode, an `upgrades` tier map, an `owned` cosmetics set, the `noDamageStreak` counter, `runsToday` / `clearsToday` maps with a stored local date for midnight reset, and the `ramp`/`returning` run counters. No value is ever sent off-device. Daily and Weekly Challenge parameters (Ch. 5) are derived from the shared LCG seeded by the day-number (`floor(epochDays)`), so every player on a given date faces the identical challenge with no server — the same determinism the stocker already relies on. If any economy read fails or the store is cleared, the systems re-initialize to a zero DC, all-default, no-streak state and the shipped loop is unaffected.



# Chapter 5 — Progression, Achievements, Dailies & Unlocks

This chapter specifies the meta-layer that wraps the shipped core loop of *Grocery Dash 3D* — the 6-item list → grab (E) → checkout ring at `(-7.65, 11.1)` → banner → reroll (R) cycle in `src/game.js`. None of these systems exist in code yet; every rule here is **additive and optional**, never replacing shipped behavior. All state lives in `localStorage` (no backend, per the project pillar in Ch. 1); a backend, if ever added, only mirrors this store. The economy and per-run score `S` this layer consumes are defined in Ch. 4; the modes it gates are Ch. 2; the 40 Career shifts it unlocks are Ch. 3; the results/share surfaces are Ch. 12; the canonical save schema is Ch. 20. Nothing here spends more than a few hundred bytes of JSON or a handful of milliseconds per run, so it respects the Intel-iGPU floor trivially.

### 5.1 Currencies, save model & the meta-loop

Two currencies exist. **XP** is monotonic and non-spendable; it only drives account **Level** (5.2). **Coupons (₵)** are a soft, spendable currency earned alongside XP and burned at the Rewards Kiosk (5.4). A run grants both at checkout (5.3). Bailing a run (pressing **R** before the checkout completes, i.e. `game.state.done === false`) grants nothing.

All progression persists under a single localStorage key, `gd.save.v1`, holding a JSON blob. The fields this chapter references (full schema in Ch. 20):

| Field | Type | Meaning |
|---|---|---|
| `v` | int | Save schema version (currently 1) |
| `xp` | int | Lifetime XP; level derived via 5.2 |
| `level` | int | Cached account level 1–50 |
| `coupons` | int | Current spendable ₵ balance |
| `couponsLifetime` | int | Lifetime ₵ earned (for achievements) |
| `runs`, `checkouts` | int | Runs started / completed checkouts |
| `itemsGrabbed`, `bonusItems` | int | Total items grabbed / off-list items |
| `cleanRuns`, `cleanStreak` | int | Zero-damage checkouts, current run streak |
| `bestTimeS` | float | Fastest completed run, seconds |
| `damageLifetime` | float | Sum of `physics.damage.total` at checkout |
| `knockEvents` | int | Lifetime `physics.damage.count` (items knocked) |
| `gondolasTippedMask` | int | Bit `label-1` set per island tipped (5.5) |
| `cartsTipped`, `npcBumps`, `debrisGrabbed` | int | Chaos counters |
| `skusMask` | 52-bit int (2× 26-bit) | One bit per SKU ever grabbed |
| `sectionsMask` | 11-bit int | One bit per section ever grabbed |
| `daily` | object | `{streak, lastDayIndex, lastDayKey, rainChecks, completedToday}` |
| `weekly` | object | `{streak, lastWeekIndex, completedThisWeek}` |
| `unlocks` | `{[id]: true}` | Owned unlocks (5.4) |
| `achievements` | `{[id]: unlockedAtEpochMs}` | Earned achievements (5.5) |
| `careerCleared` | int | Distinct Career shifts cleared (Ch. 3) |
| `rerollsSinceCheckout` | int | Reset to 0 on each checkout |

The meta-loop each run: (1) on `game.reset()` increment `runs`, snapshot pre-run masks; (2) during play accumulate per-run counters from the physics/game hooks; (3) on `game.complete()` compute XP + Coupons (5.3), fold into totals, re-derive level, evaluate every achievement predicate against the merged state, evaluate any newly-crossed level/coupon unlock gates, then write `gd.save.v1` once. All evaluation is O(achievements) ≈ 68 predicate checks — sub-millisecond.

### 5.2 The XP curve (levels 1–50)

Level is capped at **50**. The cost to advance **from** level `L` **to** level `L+1` is a pure integer quadratic — no rounding, hand-verifiable:

> **`cost(L) = 10·L² + 40·L + 50`**  XP, for `L` = 1 … 49.

Cumulative XP to *reach* level `L` is `reach(L) = Σ_{k=1}^{L-1} cost(k)`, with `reach(1) = 0`. Level from lifetime XP is the largest `L` with `reach(L) ≤ xp` (a 50-entry lookup; binary search or linear scan). Worked example: `cost(5) = 10·25 + 200 + 50 = 500`; `reach(5) = 100+170+260+370 = 900`.

| Lvl L | cost(L)→L+1 | reach(L) total | Lvl L | cost(L)→L+1 | reach(L) total |
|--:|--:|--:|--:|--:|--:|
| 1 | 100 | 0 | 26 | 7,850 | 69,500 |
| 2 | 170 | 100 | 27 | 8,420 | 77,350 |
| 3 | 260 | 270 | 28 | 9,010 | 85,770 |
| 4 | 370 | 530 | 29 | 9,620 | 94,780 |
| 5 | 500 | 900 | 30 | 10,250 | 104,400 |
| 6 | 650 | 1,400 | 31 | 10,900 | 114,650 |
| 7 | 820 | 2,050 | 32 | 11,570 | 125,550 |
| 8 | 1,010 | 2,870 | 33 | 12,260 | 137,120 |
| 9 | 1,220 | 3,880 | 34 | 12,970 | 149,380 |
| 10 | 1,450 | 5,100 | 35 | 13,700 | 162,350 |
| 11 | 1,700 | 6,550 | 36 | 14,450 | 176,050 |
| 12 | 1,970 | 8,250 | 37 | 15,220 | 190,500 |
| 13 | 2,260 | 10,220 | 38 | 16,010 | 205,720 |
| 14 | 2,570 | 12,480 | 39 | 16,820 | 221,730 |
| 15 | 2,900 | 15,050 | 40 | 17,650 | 238,550 |
| 16 | 3,250 | 17,950 | 41 | 18,500 | 256,200 |
| 17 | 3,620 | 21,200 | 42 | 19,370 | 274,700 |
| 18 | 4,010 | 24,820 | 43 | 20,260 | 294,070 |
| 19 | 4,420 | 28,830 | 44 | 21,170 | 314,330 |
| 20 | 4,850 | 33,250 | 45 | 22,100 | 335,500 |
| 21 | 5,300 | 38,100 | 46 | 23,050 | 357,600 |
| 22 | 5,770 | 43,400 | 47 | 24,020 | 380,650 |
| 23 | 6,260 | 49,170 | 48 | 25,010 | 404,670 |
| 24 | 6,770 | 55,430 | 49 | 26,020 | 429,680 |
| 25 | 7,300 | 62,200 | 50 | — (cap) | 455,700 |

Reaching level 50 costs **455,700** lifetime XP. **Overflow past 50** is not wasted: every 20 XP earned at cap converts to **1 ₵** (`coupons += floor(overflowXP / 20)`, remainder retained in `xp`). The HUD level pip (Ch. 7) shows `xp − reach(level)` over `cost(level)` as a 0–1 fill.

### 5.3 Earning XP & Coupons per run

Run XP is derived at `game.complete()` from the same four numbers the shipped banner already shows — items, list value, `physics.damage`, and `game.state.time` — so it is self-contained and needs no Ch. 4 lookup, though it is calibrated to track the Ch. 4 score `S` (`runXP ≈ S`). Components, summed into `base`:

| Component | Value | Source predicate |
|---|--:|---|
| Completion | +100 | `game.state.done === true` |
| Per list item | +6 each | `list.filter(e ⇒ e.got ≥ e.need).length` (max 6 → +36) |
| Speed: Sprinter | +120 | `time ≤ 45` |
| Speed: Brisk | +80 | `45 < time ≤ 75` |
| Speed: Steady | +40 | `75 < time ≤ 120` |
| Speed: Stroll | +0 | `time > 120` |
| Spotless bonus | +90 | `physics.damage.count === 0` |
| Damage penalty | −min(90, round(damage.total × 2)) | if `damage.count > 0` |

Then apply the **streak multiplier** `M` (from the daily streak, 5.6) and the **mode multiplier** `X` (5.6 rotation), multiplicatively, capped:

> **`runXP = floor( max(0, base) · min(3.0, M · X) )`**  **`coupons += floor(runXP / 5)`**

Streak multiplier `M` by `daily.streak`: 0–2 → 1.00 · 3–6 → 1.10 · 7–13 → 1.20 · 14–29 → 1.35 · 30+ → 1.50. Mode multiplier `X`: Classic 1.00 · the day's featured Daily 1.50 · Weekly 2.00 · Career/Endless 1.00 (per-shift overrides in Ch. 3).

**Worked example.** 6/6 items, `time = 68 s`, `damage.count = 0`, `daily.streak = 3` (M = 1.10), Classic (X = 1.00): `base = 100 + 36 + 80 + 90 = 306`; `runXP = floor(306 · 1.10) = 336`; `coupons += 67`. Played instead as that day's Daily (X = 1.50): `floor(306 · 1.10 · 1.50) = 504` XP, `+100 ₵`. A first-ever run of 336 XP lands the player at **level 3** (`reach(3)=270`) with `66/260` toward level 4.

### 5.4 The full unlock tree

Unlocks are cosmetic or convenience only — **never** stat or gameplay advantage (fairness pillar, Ch. 1). Three gate types: **L** = auto-granted free on reaching a level; **₵** = purchasable at the Rewards Kiosk once its prerequisite level is met; **A** = granted only by an achievement (no purchase path). Modes are listed first because they gate what the rest of the game and this chapter reference.

**Mode unlocks** (`mode` id used by the share code, 5.7; rulesets in Ch. 2):

| id | Mode | Gate | Notes |
|--:|---|---|---|
| 0 | Classic | L1 | The shipped loop; always available |
| 1 | Daily | L2 | Seeded run of the day (5.6) |
| 9 | Career hub | L5 | Unlocks the 40-shift ladder (Ch. 3) |
| 3 | Time Attack | L3 | Par-timed; ties Sprinter band |
| 4 | Clean Run | L6 | Any damage aborts the run |
| 2 | Weekly | L8 | Seeded run of the week (5.6) |
| 5 | Big Basket | L9 | 12-item list |
| 6 | Blackout | L12 | Store lights dimmed, aisle-sign glow only |
| 7 | Sprint School | L15 | Walk disabled; always `SPEED_RUN 4.9` |
| 8 | Chaos | L18 | Extra carts spawned; NPC density ×2 |
| 10 | Endless (Shift Manager) | L30 | Back-to-back lists, escalating par |

**Cosmetic & convenience unlocks** (48 items):

| Unlock ID | Name | Category | Gate | Effect (concrete) |
|---|---|---|---|---|
| `cart_default` | Standard Cart | Cart livery | L1 | Shipped chrome frame `0xb9c0c7` |
| `cart_chrome` | Chrome | Cart livery | ₵ 300 (L1) | Metal `0xd7dde3`, roughness 0.25 |
| `cart_rust` | Rust Bucket | Cart livery | ₵ 300 (L4) | `0x8a5a2b`, roughness 0.9 |
| `cart_red` | Racing Stripes | Cart livery | ₵ 500 (L6) | `0xc9241a` + white `0xffffff` stripe decal |
| `cart_neon` | Neon | Cart livery | ₵ 800 (L12) | Emissive `0x35c46a`, intensity 0.6 |
| `cart_camo` | Camo | Cart livery | ₵ 800 (L14) | 3-tone canvas texture |
| `cart_gold` | Golden Trolley | Cart livery | A `ACH_CAREER_ALL` | Metal `0xf2c81b`, metalness 1.0 |
| `cart_holiday` | Holiday | Cart livery | A `ACH_STREAK_30` | Red/green + emissive twinkle |
| `retic_dot` | Dot | Reticle | L1 | Shipped 2 px dot |
| `retic_ring` | Ring | Reticle | L1 | 8 px hollow ring `0x9fdcff` |
| `retic_cross` | Crosshair | Reticle | ₵ 150 (L2) | 4-arm cross, 1 px gap |
| `retic_scan` | Scanner | Reticle | ₵ 400 (L7) | Animated corner brackets on hover |
| `retic_barcode` | Barcode | Reticle | A `ACH_COMPLETIONIST` | Tiny barcode glyph |
| `retic_heart` | Heart | Reticle | ₵ 250 (L5) | Heart outline, `0xe0447a` |
| `hud_receipt` | Receipt | HUD theme | L1 | Shipped list panel (paper) |
| `hud_chalk` | Chalkboard | HUD theme | ₵ 350 (L4) | Dark slate, chalk font weights |
| `hud_neon` | Neon Grid | HUD theme | ₵ 600 (L10) | Cyan `0x35c4c4` glow, mono digits |
| `hud_minimal` | Minimal | HUD theme | ₵ 350 (L3) | Hairline, 60% opacity |
| `hud_terminal` | Green Terminal | HUD theme | A `ACH_L25` | Amber-on-black, scanlines |
| `jingle_classic` | Classic Chime | Checkout jingle | L1 | 523,659,784,1046 Hz triangle @90 ms |
| `jingle_powerup` | Power-Up | Checkout jingle | ₵ 200 (L3) | 659,784,988,1319 Hz triangle |
| `jingle_register` | Ka-Ching | Checkout jingle | ₵ 200 (L5) | noise 900 Hz + 1175,1568 Hz ding |
| `jingle_fanfare` | Fanfare | Checkout jingle | ₵ 400 (L8) | 523,523,523,659,784 Hz @70 ms |
| `jingle_lofi` | Lo-Fi | Checkout jingle | ₵ 400 (L11) | 392,494,587 Hz sine |
| `jingle_8bit` | 8-Bit | Checkout jingle | A `ACH_SUB30` | 440,554,659,880 Hz square |
| `title_newbie` | "New Regular" | Player title | L1 | Shown on results + share card |
| `title_spotless` | "Spotless" | Player title | A `ACH_CLEAN25` | — |
| `title_legend` | "Store Legend" | Player title | A `ACH_L50` | — |
| `title_diver` | "Dumpster Diver" | Player title | A `ACH_DUMPSTER` | — |
| `title_menace` | "Aisle Menace" | Player title | A `ACH_BUMP50` | — |
| `title_eoty` | "Employee of the Year" | Player title | A `ACH_CAREER_ALL` | — |
| `trail_off` | No Trail | Cart trail | L1 | Default |
| `trail_blue` | Blue Wake | Cart trail | ₵ 250 (L6) | Fading `0x9fdcff` ribbon |
| `trail_rainbow` | Rainbow | Cart trail | ₵ 900 (L20) | Hue-cycling ribbon |
| `trail_sparkle` | Sparkle | Cart trail | A `ACH_STREAK_100` | Emissive point sprites |
| `fov_62` | Standard (62°) | Camera FOV | L1 | Shipped camera FOV |
| `fov_70` | Wide (70°) | Camera FOV | L1 | Accessibility (Ch. 11) |
| `fov_78` | Extra-Wide (78°) | Camera FOV | ₵ 200 (L2) | Reduces motion discomfort |
| `fov_90` | Fisheye (90°) | Camera FOV | ₵ 500 (L10) | Novelty |
| `muzak_on` | Store Radio | Ambient audio | L20 | Enables procedural muzak over the 240 Hz hum |
| `photo_mode` | Photo Mode | Convenience | L16 | Free-fly camera when `game.state.done` |
| `speedrun_hud` | Splits HUD | Convenience | A `ACH_SUB45` | Live split vs. `bestTimeS` |
| `list_preview` | Aisle Hints | Convenience | ₵ 700 (L14) | List rows show aisle number badge |
| `nameplate_gold` | Gold Nameplate | Cosmetic | A `ACH_L50` | Gold frame on share card |
| `spawn_lot` | Lot Entrance | Convenience | A `ACH_LOT` | Optional spawn at the night lot |
| `cursor_apple` | Golden Apple Cursor | Cosmetic | ₵ 150 (L3) | Menu cursor sprite |
| `confetti_checkout` | Confetti | Cosmetic | ₵ 300 (L7) | Particle burst on checkout banner |
| `emote_wave` | Wave Emote | Cosmetic | A `ACH_FIRST_DAILY` | Bindable emote at checkout |

Level-gated (**L**) unlocks are pushed into `save.unlocks` automatically the instant `level` crosses their threshold in 5.1's post-run pass. Coupon (**₵**) unlocks appear in the Kiosk once their prerequisite level is met and are bought with a single confirm (`coupons -= cost`). Achievement (**A**) unlocks are the *only* source for their item — they cannot be bought, guaranteeing they read as earned.

### 5.5 Achievements (68)

Every predicate below is evaluated against the merged save state in 5.1's post-run pass, using only values the shipped code already exposes (`game.state`, `physics.damage`, `world.stock`) plus the counters this chapter defines. Rewards by tier: **Bronze** +50 XP / +25 ₵; **Silver** +200 XP / +75 ₵; **Gold** +750 XP / +200 ₵. Hidden achievements show as "???" until earned. `pop(mask)` = popcount.

| ID | Name | Description | Trigger predicate (implementable) | Tier | Hidden |
|---|---|---|---|---|:--:|
| `ACH_FIRST_CHECKOUT` | Welcome Aboard | Complete your first checkout | `checkouts === 1` | B | – |
| `ACH_L5` | Regular | Reach account level 5 | `level ≥ 5` | B | – |
| `ACH_L10` | Cardholder | Reach level 10 | `level ≥ 10` | S | – |
| `ACH_L25` | Gold Member | Reach level 25 | `level ≥ 25` | G | – |
| `ACH_L50` | Max Rank | Reach the level cap, 50 | `level ≥ 50` | G | – |
| `ACH_COUPONS_1K` | Coupon Clipper | Bank 1,000 ₵ lifetime | `couponsLifetime ≥ 1000` | B | – |
| `ACH_COUPONS_10K` | Double Coupons | Bank 10,000 ₵ lifetime | `couponsLifetime ≥ 10000` | S | – |
| `ACH_CHECKOUTS_10` | Ten Trips | Complete 10 checkouts | `checkouts ≥ 10` | B | – |
| `ACH_CHECKOUTS_50` | Half-Century Cart | 50 checkouts | `checkouts ≥ 50` | S | – |
| `ACH_CHECKOUTS_100` | Century Shopper | 100 checkouts | `checkouts ≥ 100` | G | – |
| `ACH_CHECKOUTS_500` | Frequent Flyer | 500 checkouts | `checkouts ≥ 500` | G | ✓ |
| `ACH_ITEMS_100` | Basket Filler | Grab 100 items lifetime | `itemsGrabbed ≥ 100` | B | – |
| `ACH_ITEMS_1000` | Warehouse Hands | Grab 1,000 items | `itemsGrabbed ≥ 1000` | S | – |
| `ACH_ITEMS_5000` | Restocker's Nightmare | Grab 5,000 items | `itemsGrabbed ≥ 5000` | G | – |
| `ACH_SUB120` | Beat the Clock | Check out under 2:00 | `done && time < 120` | B | – |
| `ACH_SUB75` | Brisk Walker | Check out under 1:15 | `done && time < 75` | S | – |
| `ACH_SUB45` | Aisle Sprinter | Check out under 0:45 | `done && time < 45` | G | – |
| `ACH_SUB30` | Supersonic Shopper | Check out under 0:30 | `done && time < 30` | G | ✓ |
| `ACH_CLEAN` | Spotless | Finish a run with $0 damages | `done && damage.count === 0` | B | – |
| `ACH_CLEAN5` | White Glove | 5 clean runs in a row | `cleanStreak ≥ 5` | S | – |
| `ACH_CLEAN25` | Immaculate | 25 clean runs in a row | `cleanStreak ≥ 25` | G | – |
| `ACH_CLEAN_SUB60` | Surgical | Clean run under 1:00 | `done && damage.count === 0 && time < 60` | G | – |
| `ACH_TIP_FIRST` | Timber! | Tip over an aisle island | any gondola `tipped` false→true | B | – |
| `ACH_TIP_ALL` | Total Recall | Tip all seven islands (labels 1–4, 6–8) | `gondolasTippedMask === 0b11101111` (bits for 1,2,3,4,6,7,8) | G | ✓ |
| `ACH_CART_TIP` | Cart Crash | Tip a shopping cart | any cart `tipped` false→true | B | – |
| `ACH_KNOCK_50` | Butterfingers | Knock 50 items off shelves | `knockEvents ≥ 50` | B | – |
| `ACH_KNOCK_500` | Bull in a China Shop | Knock 500 items | `knockEvents ≥ 500` | S | – |
| `ACH_BUMP_10` | Excuse You | Bump into 10 shoppers | `npcBumps ≥ 10` | B | – |
| `ACH_BUMP50` | Aisle Menace | Bump 50 shoppers | `npcBumps ≥ 50` | S | ✓ |
| `ACH_DMG_50` | Liability | $50+ damage in one run | `done && damage.total ≥ 50` | B | – |
| `ACH_DMG_100` | Insurance Claim | $100+ in one run | `done && damage.total ≥ 100` | S | – |
| `ACH_DMG_250` | Condemned | $250+ in one run | `done && damage.total ≥ 250` | G | ✓ |
| `ACH_DUMPSTER` | Dumpster Diver | Complete a list from floor debris only | `done && runDebrisGrabs ≥ 6 && runShelfGrabs === 0` | G | ✓ |
| `ACH_SHAKY` | Steady Hands | Check out while the screen shakes | `done fired && physics.shake > 0` | S | ✓ |
| `ACH_TV` | Big Ticket | Add a 55" TV to your basket | grabbed `spec.id === 'tv55'` | S | ✓ |
| `ACH_CONSOLE` | Midnight Launch | Grab the game console | grabbed `id === 'console'` | B | ✓ |
| `ACH_BALL` | Play Ball | Grab the Bounce play ball | grabbed `id === 'ball'` | B | ✓ |
| `ACH_PRODUCE_LIST` | Farmers Market | Complete a 6-item list that is all produce | `done && list.every(e ⇒ byId(e.id).section === 'produce')` | S | ✓ |
| `ACH_ALL_SECTIONS` | Aisle by Aisle | Grab from all 11 sections | `sectionsMask === 0x7FF` | S | – |
| `ACH_COMPLETIONIST` | Completionist | Grab all 52 SKUs at least once | `pop(skusMask) === 52` | G | ✓ |
| `ACH_LOT` | Fresh Air | Walk out to the night parking lot | `camera.z > STORE.d/2` (past the entrance, z>15) | B | ✓ |
| `ACH_CARS_8` | Lot Patrol | Come within 1.5 m of all 8 parked cars | `carsVisitedMask === 0xFF` | S | ✓ |
| `ACH_LANE6` | Lane's Closed | Stand at the closed lane 6 | dist to `(−1.0, 10.6)` < 1.2 | B | ✓ |
| `ACH_MUTE` | Library Voice | Mute the game with M | `save.muted` set true | B | ✓ |
| `ACH_REROLL_10` | Analysis Paralysis | Reroll 10× without checking out | `rerollsSinceCheckout ≥ 10` | B | ✓ |
| `ACH_PANTRY` | Pantry Raider | Grab every pantry SKU (10) | pantry bits ⊆ `skusMask` | S | – |
| `ACH_SNACKS` | Snack Attack | Grab every snacks SKU (7) | snacks bits ⊆ `skusMask` | S | – |
| `ACH_DAIRY` | Got Milk | Grab every dairy SKU (4) | dairy bits ⊆ `skusMask` | B | – |
| `ACH_FROZEN` | Cool Customer | Grab both frozen SKUs (2) | frozen bits ⊆ `skusMask` | B | – |
| `ACH_PRODUCE_ALL` | Green Thumb | Grab all 6 produce SKUs | produce bits ⊆ `skusMask` | S | – |
| `ACH_ELEC` | Tech Support | Grab all 5 electronics SKUs | electronics bits ⊆ `skusMask` | S | – |
| `ACH_BAKERY` | Fresh Baked | Grab both bakery SKUs (2) | bakery bits ⊆ `skusMask` | B | – |
| `ACH_TOYS` | Toy Story | Grab all 4 toys SKUs | toys bits ⊆ `skusMask` | B | – |
| `ACH_PHARMACY` | Pharmacist | Grab all 3 pharmacy SKUs | pharmacy bits ⊆ `skusMask` | B | – |
| `ACH_HOUSEHOLD` | House Proud | Grab all 4 household SKUs | household bits ⊆ `skusMask` | B | – |
| `ACH_HOME` | Home Sweet Home | Grab all 4 home SKUs | home bits ⊆ `skusMask` | B | – |
| `ACH_FIRST_DAILY` | Daily Special | Complete your first Daily run | `daily.streak ≥ 1` | B | – |
| `ACH_STREAK_3` | Habit Forming | 3-day Daily streak | `daily.streak ≥ 3` | B | – |
| `ACH_STREAK_7` | Week's Groceries | 7-day streak | `daily.streak ≥ 7` | S | – |
| `ACH_STREAK_30` | Loyalty Card | 30-day streak | `daily.streak ≥ 30` | G | – |
| `ACH_STREAK_100` | Store Fixture | 100-day streak | `daily.streak ≥ 100` | G | ✓ |
| `ACH_DAILY_PAR` | Under Par | Beat the Daily par time | `mode===Daily && done && time < parTime` | B | – |
| `ACH_FIRST_WEEKLY` | Weekend Big Shop | Complete a Weekly challenge | `weekly.streak ≥ 1` | B | – |
| `ACH_WEEKLY_4` | Monthly Regular | 4-week Weekly streak | `weekly.streak ≥ 4` | S | – |
| `ACH_RAINCHECK` | Rain Check | Use a streak-saver token | `rainCheckConsumed` this pass | B | ✓ |
| `ACH_ALL_MODES` | Mode Motorist | Play every unlocked mode once | `modesPlayedMask ⊇ unlockedModesMask` | S | – |
| `ACH_CAREER_10` | Clocking In | Clear 10 Career shifts (Ch. 3) | `careerCleared ≥ 10` | S | – |
| `ACH_CAREER_ALL` | Employee of the Year | Clear all 40 Career shifts | `careerCleared ≥ 40` | G | ✓ |

Section→SKU bit membership (for the `⊆ skusMask` predicates) is a static table generated once from `PRODUCTS` in `src/products.js`; e.g. pantry = `{cereal_oat, cereal_flake, pasta, sauce, pb, soup, beans, corn, ketchup, tins}` (10). SKU bit index = position in `PRODUCTS` (0–51). Sub-mask completion is `(skusMask & sectionBits) === sectionBits`.

### 5.6 Daily & Weekly seeded systems

Both modes reuse the shipped Park–Miller LCG from `src/store.js` (`seed = (seed·16807) % 2147483647`) but **replace the hard-coded `seed = 1337`** with a date-derived seed, so the *entire store stocking* and the *6-item list* are identical for every player on that calendar day/week. This requires one additive change to `genList()` in `src/game.js`: in Daily/Weekly/Career modes it draws from the shared `rng()` instead of `Math.random()`; Classic keeps `Math.random()`.

**The shopping day.** To keep streaks intuitive for late-night players, the civil day rolls over at **03:00 local**. We read wall-clock components *after* shifting, which makes the whole scheme DST- and timezone-robust (we never do epoch subtraction across a boundary):

```js
function shoppingDate(now = new Date()) {           // local civil date, 3am rollover
  const d = new Date(now);
  if (d.getHours() < 3) d.setDate(d.getDate() - 1);  // 00:00–02:59 counts as prior day
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
}
const dayKey = ({y,m,day}) => y*10000 + m*100 + day;  // e.g. 2026-07-11 → 20260711 (display / repeat check)

function daysFromCivil(y, m, d) {                      // proleptic Gregorian, days since 1970-01-01
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era*400;
  const doy = Math.floor((153*(m + (m > 2 ? -3 : 9)) + 2)/5) + d - 1;
  const doe = yoe*365 + Math.floor(yoe/4) - Math.floor(yoe/100) + doy;
  return era*146097 + doe - 719468;
}
const dayIndex = daysFromCivil(y, m, day);            // integer day number for arithmetic + share code
```

`dayKey` is for display and same-day repeat detection; `dayIndex` (a running integer) is for gap math, the rotation, and the share code. `daysFromCivil(2026,7,11) = 20645`, `daysFromCivil(2026,1,1) = 20454` (verified).

**Seed derivation** (MurmurHash3 finalizer avalanche → non-zero LCG seed):

```js
function hash32(x){ x=(x^(x>>>16))>>>0; x=Math.imul(x,0x45d9f3b)>>>0;
  x=(x^(x>>>16))>>>0; x=Math.imul(x,0x45d9f3b)>>>0; return (x^(x>>>16))>>>0; }

const dailySeed  = (hash32((dayIndex  * 2654435761) ^ 0x0DA1) % 2147483646) + 1;   // 1 … 2147483646
const weekIndex  = Math.floor((dayIndex + 3) / 7);        // 1970-01-01 is Thu; +3 makes Monday flip weeks
const weeklySeed = (hash32((weekIndex * 2654435761) ^ 0x07EE) % 2147483646) + 1;
```

The `+1`/`% (2^31−2)` guarantees the seed is in `[1, 2147483646]`, never the LCG's degenerate 0. Plug `dailySeed`/`weeklySeed` into the LCG in place of `1337` and rebuild `buildStore`.

**Weekday rotation** (fixed base layer, keyed by `dow = (dayIndex + 3) % 7`, 0 = Mon):

| dow | Day | Theme | Base mode | List size | Featured section | Mode mult X |
|--:|---|---|---|--:|---|--:|
| 0 | Mon | Fresh Start | Classic | 6 | produce | 1.00 |
| 1 | Tue | Two-for-Tuesday | Big Basket | 8 | snacks | 1.50 |
| 2 | Wed | Clean Sweep | Clean Run | 6 | household | 1.00 |
| 3 | Thu | Throwback | Blackout | 6 | dairy | 1.25 |
| 4 | Fri | Rush Hour | Time Attack | 6 | frozen | 1.50 |
| 5 | Sat | Big Shop | Classic | 10 | pantry | 1.25 |
| 6 | Sun | Chaos Sunday | Chaos | 6 | electronics | 2.00 |

**Modifier deck** layered on top, picked deterministically as `MODS[hash32(dayIndex ^ 0xB16) % 8]`:

| idx | Modifier | Effect |
|--:|---|---|
| 0 | Clear Aisles | No modifier |
| 1 | Slippery Floor | Player friction halved (drift) |
| 2 | Fog | Draw distance dimmed; reach REACH unchanged |
| 3 | Featured ×2 | Featured-section list items grant ×2 XP |
| 4 | Rush | Par time −20% |
| 5 | Fragile | Damage billing 60% price (vs shipped 40%) |
| 6 | Crowd | NPC count +4 |
| 7 | One-Handed | List reduced to 4 items, tighter par |

**Par time**: `parTime = 60 + 8·listSize` seconds (6 items → 108 s), then `×0.8` if the Rush/One-Handed modifier applies. `ACH_DAILY_PAR` and the Daily leaderboard (Ch. 12) compare `time < parTime`.

**Streak rules** (Daily; Weekly is identical with `weekIndex`). On a completed Daily checkout:

1. If `daily.lastDayKey === dayKey` → already credited today; grant the run's XP/₵ but **do not** touch the streak (repeat protection).
2. Else let `gap = dayIndex − daily.lastDayIndex`.
   - `gap === 1` → `streak++` (consecutive day).
   - `gap === 2 && rainChecks > 0` → consume one Rain Check (`rainChecks--`, `rainCheckConsumed = true`), `streak++` (covers exactly one missed day).
   - otherwise → `streak = 1` (fresh start).
   - `gap ≤ 0` (clock moved backward / re-entered a civil date) → **freeze**: no increment, no reset, no daily credit for streak; run XP still granted. This is the anti-tamper branch.
3. Set `daily.lastDayIndex = dayIndex`, `daily.lastDayKey = dayKey`, `completedToday = true`.
4. Every 10 consecutive completions grant **+1 Rain Check**, capped at **2** banked.

**Calendar edge cases** (all resolved, none special-cased in code because arithmetic is on `dayIndex`):

- **Feb 29 / leap years** — `daysFromCivil` is exact; `20240229 → 20240301` is `dayIndex + 1`, streak intact.
- **Year boundary** — `20261231 → 20270101` jumps `dayKey` by 8,770 but `dayIndex` by 1; streak intact (this is exactly why gap math uses `dayIndex`, not `dayKey`).
- **DST spring-forward (02:00→03:00)** — the skipped hour is entirely below the 03:00 rollover; civil date is unaffected; a player active at 01:30 on both days is attributed to the prior day identically.
- **DST fall-back (02:00→01:00, hour repeats)** — 01:00–01:59 occurs twice, both `< 3` → both map to the prior civil day; no double credit because step 1 keys on `dayKey`.
- **Eastward travel / skipped civil date** — `gap === 2`; consumes a Rain Check if banked, else resets. Documented as intended.
- **Westward travel / date-line backtrack (repeat a civil date)** — `dayKey === lastDayKey` → repeat protection; streak unchanged, no extra credit.
- **Manual clock rollback** — `gap ≤ 0` → frozen branch; streak neither grows nor breaks, and no forward progress is bankable by setting the clock back and forth.
- **ISO week 53** (e.g. 2026 has an ISO week 53) — `weekIndex` is a pure running counter, so week 53 is just the next integer; no special case.

### 5.7 Share-code format spec

A share code is a **self-contained 12-character string** encoding a run result — no server lookup — so a friend can paste it to load the exact seeded store/list and race the ghost (Ch. 12). Format version 1 packs a **55-bit payload + 5-bit checksum = 60 bits = 12 base-32 symbols**, cosmetically hyphenated `XXXXXX-XXXXXX`.

**Payload bit layout** (MSB first; total 55 bits):

| Offset | Bits | Field | Range | Notes |
|--:|--:|---|---|---|
| 0 | 3 | `ver` | 0–7 | current = 1; 2–3 reserved for future fields |
| 3 | 5 | `mode` | 0–31 | mode id from 5.4 |
| 8 | 16 | `dayIndex` | 0–65535 | `daysFromCivil` (seed source); valid until ~2149 |
| 24 | 13 | `timeDs` | 0–8191 | run time in deciseconds (clamp; max 819.1 s) |
| 37 | 4 | `items` | 0–15 | list items collected |
| 41 | 8 | `damageUSD` | 0–255 | whole dollars, clamp 255 |
| 49 | 6 | `level` | 0–63 | account level at run time |

**Base-32 alphabet** — Crockford, index 0→31: `0 1 2 3 4 5 6 7 8 9 A B C D E F G H J K M N P Q R S T V W X Y Z` (omits I, L, O, U). Decode folds case and substitutes ambiguous input: `I,i,L,l → 1`; `O,o → 0`; `U,u → V`; hyphens and spaces stripped.

**Encode.** Assemble the 55 payload bits into eleven 5-bit symbols `s0…s10` (`s0` = most-significant). Checksum is a weighted mod-31 (ISBN-style; catches every single-symbol error and all adjacent transpositions):

> **`c = ( Σ_{i=0}^{10} (i+1)·s_i ) mod 31`** → 0…30, emitted as the 12th symbol.

Because `c ≤ 30`, symbol index 31 (`Z`) **never** appears in the checksum slot — a decoded `Z` there is itself an invalid-code signal.

**Worked encode** (a run played today, 2026-07-11). Fields: `ver=1, mode=1 (Daily), dayIndex=20645, timeDs=684 (68.4 s), items=6, damageUSD=0, level=12`.
Bit string (55): `001 00001 0101000010100101 0001010101100 0110 00000000 001100`.
Grouped into symbols: `s = [4, 5, 8, 10, 10, 5, 11, 3, 0, 0, 12]` → payload text `458AA5B300C`.
Checksum: `1·4+2·5+3·8+4·10+5·10+6·5+7·11+8·3+9·0+10·0+11·12 = 391`; `391 mod 31 = 19` → symbol `K`.
**Final code: `458AA5-B300CK`** (verified by encoder).

**Decode & validation** — reject unless *all* pass:

1. After case-fold/substitution/strip, length is exactly **12**, every character maps to a valid alphabet index.
2. Split into `s0…s10` + `c`. Recompute `c' = (Σ (i+1)·s_i) mod 31`; require `c' === c` (and `c ≤ 30`).
3. Reassemble the 55-bit integer; slice fields per the layout table.
4. `ver` is a known version (1). If `ver > 1`, decode under that version's layout or reject.
5. `mode` ∈ the set of defined mode ids (0–10).
6. `dayIndex` ≤ `daysFromCivil(today) + 1` (no runs from the future beyond tomorrow's rollover) and ≥ `daysFromCivil(2026,1,1)` (before launch is impossible).
7. `items` ≤ the list size implied by `mode`/`dayIndex` (6, 8, 10, or 12 per 5.6); reject overflow.
8. `level` ∈ [1, 50] (values 51–63 are impossible → reject).
9. `timeDs` ≤ 8191 by construction; a value of 0 with `items > 0` is treated as corrupt.

A decode that passes reconstructs the seed (`dailySeed`/`weeklySeed` from `dayIndex`), rebuilds the identical store and list, and displays the shared result (time, items, damage, level, mode/day) as a ghost target on the results screen (Ch. 12). Our example `458AA5-B300CK` decodes to: version 1, **Daily**, day 20645 (2026-07-11), **68.4 s**, **6/6 items**, **$0 damage**, **level 12** — checksum `K`(19) confirmed.

### 5.8 Persistence, versioning & telemetry hooks

The entire meta-layer is one `localStorage` write per run to `gd.save.v1`, guarded by a try/catch (private-browsing quotas fail silently to an in-memory shim, so the shipped game still runs). On boot, if a `gd.save.vN` with `N < 1` is found it is migrated forward field-by-field; unknown future versions are read-only-ignored rather than clobbered. Reset-to-zero is a Settings action (double-confirm) that clears the key. Telemetry (Ch. 24), when opted in, emits only aggregate counters (`checkouts`, `level`, achievement-unlock ids, Daily completion) — never the raw save blob and never anything that could reconstruct another player's identity, consistent with the project's privacy posture. Nothing in this chapter requires a network round-trip; a fully offline player earns XP, levels, every unlock, every achievement, and can share codes by copy-paste indefinitely.



---

# PART II — EXPERIENCE



# Chapter 6 — Front-End Flow & Every Screen

This chapter is the complete front-of-house specification for *Grocery Dash 3D*. It defines every non-gameplay screen — the DOM overlays composited over the live three.js store — down to pixel positions, hex colors, type tokens, easing curves in milliseconds, keyboard/gamepad focus order, per-screen state machines, and failure states. It is written against the shipped build: the five-element HUD in `index.html` (`#list #timer #prompt #banner #toast`), the boot/quality machinery in `main.js`, the run loop in `game.js`, and the procedural cues in `sfx.js`. Nothing here spends draws (all overlays are screen-space DOM — crisp on the Intel-iGPU floor, zero draw cost, free to scale for accessibility) and nothing needs a backend. The gameplay HUD itself is owned by **Ch. 7**; input bindings by **Ch. 8**; game-feel/juice by **Ch. 9**; onboarding beats by **Ch. 10**; accessibility toggles by **Ch. 11**; the results scorecard math by **Ch. 12**. This chapter owns the *frame around the game*: the twelve screens the player moves through and the graph that connects them.

### 6.1 Shared foundations — the design system every screen inherits

Everything below is defined once here and referenced by name in each screen section. The reference frame is **1280×720**; all px values are quoted at that frame, with the responsive anchor rule beside them. Gutters use `clamp(16px, 2.2vw, 28px)` so screens survive ultrawide and mobile.

**Type scale (single modular scale, root 16px, ratio ≈1.25).** Family for all text: `-apple-system, "Segoe UI", Roboto, sans-serif` (matches `index.html` line 9). A global `--ui-scale` (0.85–1.40, default 1.0) multiplies every token: `font-size: calc(var(--tok) * var(--ui-scale))`.

| Token | px | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 52 | 800 | +0.5px | Title logo, grade stamp, countdown digit |
| `h1` | 34 | 800 | 0 | Results total, banner time |
| `h2` | 22 | 700 | 0 | Screen headers, timer |
| `body-lg` | 16 | 600 | 0 | Buttons, prompts, toasts |
| `body` | 13.5 | 500 | 0 | List rows, receipt lines, descriptions |
| `label` | 11.5 | 600 | +1.4px | Panel captions ("SHOPPING LIST", "SETTINGS") |
| `micro` | 11 | 500 | +0.3px | Seed strings, build hash, footnotes |
| `mono` | 13 | 500 | 0 | Receipts, seed codes — `ui-monospace, "SF Mono", Consolas, monospace` |

**Canonical palette (hex, harvested from the shipped CSS + PLAYBOOK Part 3).**

| Role | Hex | Where |
|---|---|---|
| Page void | `#0b0d10` | `body` background |
| Boot gradient | `#16202b → #090b0e` | radial 120% 90% at 50% 30% |
| Ink (primary text) | `#eef2f6` | all body copy |
| Ink dim | `#9fb0bd` | secondary/ghost text (≈55% ink) |
| Panel fill | `rgba(10,14,18,0.78)` | every card/HUD panel |
| Panel border | `rgba(255,255,255,0.14)` | 1px hairline |
| Panel border hi | `rgba(255,255,255,0.32)` | hover/focus hairline |
| Overlay scrim | `rgba(6,9,12,0.55)` | pause/settings dim + `blur(6px)` |
| Primary green | `#35c46a` | PLAY fill, ✓, focus ring, checkout ring |
| Primary green hi | `#48e07a` | hover/active green |
| Green sheen | `#8be0a4` | gradient tail, progress bar tail |
| Aim glow blue | `#9fdcff` | hover box, secondary accent |
| Signal yellow | `#ffd23b` | S-grade, sale, stars, streak flame |
| Cart red | `#c9241a` | D-grade, damage, closed lane ✕, destructive actions |
| Damage flesh | `#e8907f` | damage lines (matches `game.js` banner) |
| Amber warn | `#e0a01f` | C-grade, "near par" timer, offline notices |

**Grade color key** (used on Results, Career map, Daily lobby, Stats): **S** `#ffd23b`, **A** `#35c46a`, **B** `#9fdcff`, **C** `#e0a01f`, **D** `#c9241a`.

**Motion vocabulary (named easings + durations).** Every animation on every screen resolves to one of these.

| Name | cubic-bezier | Use |
|---|---|---|
| `swift` | `.22,1,.36,1` (out-quart) | panel/button/card entrances, slides |
| `punch` | `.34,1.56,.64,1` (out-back) | scale pops, grade slam, countdown |
| `glide` | `.37,0,.63,1` (in-out-sine) | screen crossfades, attract dolly |
| `sink` | `.55,.09,.68,.53` (in-quad) | exits, dismissals, fade-outs |
| `linear` | — | progress bars, count-up tweens |

Duration ladder: **micro 120ms**, **short 250ms**, **medium 400ms**, **long 650ms**. When `prefers-reduced-motion` (or the Comfort → Reduced-motion toggle, Ch. 11) is set, all screen transitions collapse to a **100ms opacity-only** crossfade and all scale/translate/back-overshoot are removed — nothing moves in space, it only fades.

**The attract stage.** Every full screen except **RUN** composites over a live, slowly orbiting camera view of the store — never a black void. A dedicated `attractCam` orbits target `(0, 1.6, 0)` at radius 14 m, angular velocity **0.06 rad/s**, with a `y` bob of ±0.3 m at 0.05 Hz. It reuses the frozen shadow maps and static lights, so it costs **zero extra draws**. It runs whenever `FE_STATE ∈ {TITLE, MODE, CAREER_MAP, BRIEFING, DAILY_LOBBY, RESULTS, ACHIEVEMENTS, STATS, CREDITS}`; it holds still under BOOT and freezes on the last RUN frame under PAUSE.

**Global component specs** (referenced as *Button/Card/Field*):

*Button* — height `44px×--ui-scale`, padding `0 22px`, radius `10px`, `body-lg`. **Primary:** fill `linear-gradient(90deg,#35c46a,#8be0a4)`, ink `#06210f`, no border. **Secondary:** fill `rgba(255,255,255,0.06)`, ink `#eef2f6`, border 1px `rgba(255,255,255,0.16)`. **Ghost:** transparent, ink `#9fb0bd`. **Destructive:** ink `#c9241a`, border 1px `rgba(201,36,26,0.5)`. Hover: `translateY(-2px)` + border→`rgba(255,255,255,0.32)`, 160ms `swift`. Focus: outline `2px #35c46a`, offset `3px`. Press: `translateY(0) scale(.97)`, 90ms. Disabled: opacity `.38`, `cursor:not-allowed`.

*Card* — panel fill, radius `14px`, border 1px `rgba(255,255,255,0.14)`, padding `18px`. Focused: `scale(1.04)` + border `2px #35c46a` + `box-shadow 0 0 0 4px rgba(53,196,106,0.18)`, 200ms `swift`.

*Field* — height `36px`, radius `8px`, fill `rgba(255,255,255,0.05)`, border 1px `rgba(255,255,255,0.16)`, `mono`. Focus border `#35c46a`.

**Focus model (keyboard + gamepad, one system).** Screens use a **roving tabindex**: exactly one focusable element holds `tabindex=0`, the rest `-1`. `Tab`/`Shift+Tab` and gamepad **D-pad / left-stick** move a green focus ring (`outline 2px #35c46a offset 3px`) through the enumerated order; horizontal card rows also accept `←/→`. **Enter / Space / gamepad A (Cross)** activates; **Esc / gamepad B (Circle)** goes back one screen (or closes an overlay). `--ui-scale` never breaks focus order. On mouse/touch the ring is suppressed via `:focus-visible`; the last-used input device decides whether key glyphs or pad glyphs render (Ch. 8). Every screen below lists its exact focus order.

### 6.2 The front-end state machine & navigation graph

The app is a small state machine layered over the existing render loop in `main.js`. **Full screens** replace one another (crossfade 250ms `glide`); **overlays** (PAUSE, SETTINGS, ACHIEVEMENTS, STATS, CREDITS) suspend the state beneath without tearing it down (backdrop fade 180ms + panel motion) and return to it on close.

```
                       ┌─────────┐
                       │  BOOT   │  (assets + shader compile)
                       └────┬────┘
                            ▼  onLoad, 650ms fade
                       ┌─────────┐   ◄──────────────────────────┐
             ┌────────►│  TITLE  │──► CREDITS (ovl) ─► back      │
             │         └──┬───┬──┘──► SETTINGS(ovl)─► back       │
             │            │   │  └──► ACHIEVEMENTS(ovl)/STATS ─► back
             │        PLAY│   │DAILY
             │            ▼   ▼
             │      ┌──────────┐    ┌──────────────┐
             │      │  MODE    │    │ DAILY  LOBBY │
             │      │  SELECT  │    └──────┬───────┘
             │      └──┬────┬──┘           │ START (if unplayed)
             │  Career │    │ TA/Chaos/    │
             │         ▼    │ Zen/Endless  │
             │   ┌──────────┐              │
             │   │ CAREER   │              │
             │   │  MAP     │              │
             │   └────┬─────┘              │
             │  select│shift               │
             │        ▼                    │
             │   ┌──────────┐              │
             │   │  SHIFT   │              │
             │   │ BRIEFING │              │
             │   └────┬─────┘              │
             │  START │                    │
             │        ▼        ▼           ▼
             │   ┌───────────────────────────┐
             │   │        COUNTDOWN 3·2·1     │ (pointer-lock settles)
             │   └─────────────┬─────────────┘
             │                 ▼
             │           ┌───────────┐  Esc/unlock   ┌────────┐
             │           │    RUN    │◄─────────────►│ PAUSE  │(ovl)
             │           └─────┬─────┘  resume       └───┬────┘
             │      checkout   │                         │ QUIT
             │                 ▼                         │
             │           ┌───────────┐                   │
             └───────────┤  RESULTS  │───────────────────┘
              Title       └──┬─────┬──┘
                    Play Again│     │ New Layout
                        (R)   ▼     ▼  → COUNTDOWN (same/new seed)
```

**Edge table (every transition, its trigger, and its transition style).**

| From | To | Trigger | Style |
|---|---|---|---|
| BOOT | TITLE | `LoadingManager.onLoad` + shader compile done | 650ms opacity `sink`, then `display:none` |
| TITLE | MODE | PLAY / Enter / A / tap | 250ms crossfade `glide` |
| TITLE | DAILY_LOBBY | DAILY button | 250ms crossfade |
| TITLE | SETTINGS/ACHIEVEMENTS/STATS/CREDITS | respective button | overlay in 180ms |
| MODE | CAREER_MAP | select Career card | 250ms crossfade |
| MODE | COUNTDOWN | select Time Attack/Chaos/Zen/Endless + confirm | 250ms → countdown |
| CAREER_MAP | BRIEFING | select an unlocked shift node | 250ms crossfade |
| BRIEFING | COUNTDOWN | START | 250ms |
| DAILY_LOBBY | COUNTDOWN | START (only if `dailyDone===false`) | 250ms |
| COUNTDOWN | RUN | "GO" (after 3·2·1) | timer starts, list slides in |
| RUN | PAUSE | Esc / pointer-lock loss / `visibilitychange:hidden` | overlay 180ms, timer holds |
| PAUSE | RUN | RESUME / click / any key | overlay out 160ms, re-lock |
| PAUSE | RESULTS | (never directly) | — |
| PAUSE | TITLE | QUIT TO TITLE (confirm) | 250ms crossfade |
| RUN | RESULTS | `complete()` at checkout ring | grade slam sequence |
| RESULTS | COUNTDOWN | Play Again (R) / New Layout | 250ms |
| RESULTS | TITLE | Title button | 250ms crossfade |
| any full screen | (previous) | Esc / B | back edge |

`FE_STATE` enum, stored in a module-level variable and mirrored to `window.__fe` for the debug/verification hooks (consistent with the `window.__*` doctrine): `BOOT, TITLE, MODE, CAREER_MAP, BRIEFING, DAILY_LOBBY, COUNTDOWN, RUN, RESULTS`, plus overlay flags `PAUSE, SETTINGS, ACHIEVEMENTS, STATS, CREDITS`. **Invariant:** at most one overlay open at a time; opening a second closes the first.

### 6.3 BOOT

Reuses the shipped `#boot` element (`index.html` lines 53–57): a radial-gradient curtain that pays the asset-load and shader-compile storm behind it, exactly as `main.js` already does (`manager.onProgress` fills the bar; `onLoad` runs `renderer.compile` then fades).

```
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                    GROCERY DASH 3D                             │  ← logo, "3D" @ 0.5 opacity
│                                                                │
│              [██████████████░░░░░░░░░░]                        │  ← 260×5 bar, green fill
│                                                                │
│                   Building store…                              │  ← status line
│                                                                │
│                                                                │
└──────────────────────────────────────────────────────────────┘
             background: radial-gradient(#16202b → #090b0e)
```

| Element | Position (1280×720) | Type | Color | Notes |
|---|---|---|---|---|
| Logo `GROCERY DASH 3D` | centered, y≈300 | `display` 52/800 → shipped 30/800; upscale to `display` | `#eef2f6`, "3D" opacity .5 wt 500 | `letter-spacing:.5px` |
| Progress bar track | centered, y≈360, 260×5px, radius 3px | — | `rgba(255,255,255,0.12)` | shipped |
| Progress bar fill `#bootbar` | left-anchored inside track | — | `linear-gradient(90deg,#35c46a,#8be0a4)` | width tween |
| Status `#bootmsg` | centered, y≈388 | `micro` 12.5/500 | `#eef2f6` @ .6 opacity | cycles |

**Status cycle** (driven by real load milestones, `main.js`): `Lighting…` → `Loading models…` → `Building store…` → `Preparing shaders…` → `Ready`. No spinner — the bar is the honesty.

**Motion.** Bar width eases over **300ms `linear`** per `onProgress` tick. On ready: `boot.opacity → 0` over **650ms `sink`**, then `display:none` (shipped `setTimeout 650`). The `#hint` string ("Click to play · WASD…") fades in for 6s (shipped). No entrance animation — BOOT is the first paint.

**Focus order.** None — BOOT is non-interactive. Any input is swallowed until `onLoad`.

**State diagram.** `LOADING (bar 0→100%) → COMPILING (status "Preparing shaders…", one rAF) → READY (fade) → [BOOT torn down]`. A hidden `FAILED` state (below) replaces the curtain content in place.

**Failure states.**

| Failure | Detection | Screen behavior |
|---|---|---|
| WebGL unavailable | top-level `try/catch` in `main.js` catches init throw | Replace curtain with card: **"Grocery Dash needs WebGL"** (`h2`), body "Try a desktop browser or enable hardware acceleration," a `[Details]` ghost button revealing the stack `<pre>` (shipped `#err` styling, softened) |
| Asset 404 / decode fail | `manager.onError(url)` | Bar turns amber `#e0a01f`; status "Couldn't load {basename} — retrying (2/3)"; 3 attempts then the WebGL-style card with a `[Reload]` primary button |
| Stall > 25s at same % | watchdog timer | status "Still working — large store, first load only"; bar pulses opacity 0.6↔1.0 at 1Hz so it never reads as frozen |
| Context lost mid-boot | `webglcontextlost` | `preventDefault`, hold curtain, re-`compile` on restore behind a mini-curtain |

### 6.4 TITLE

Full-bleed attract stage with a centered stack and a button column. This is the front door the shipped build lacks.

```
┌──────────────────────────────────────────────────────────────┐
│  Last: B · 1:42                                    ⚙  🏆  📊  │  ← corner chips + icon rail
│                                                                │
│                                                                │
│                    GROCERY DASH 3D                             │  ← display 52/800
│              Six items. One clock. No survivors.               │  ← tagline body-lg
│                                                                │
│                    ┌──────────────────┐                        │
│                    │      PLAY         │  primary green        │
│                    ├──────────────────┤                        │
│                    │   DAILY RUN  •B   │  secondary + badge    │
│                    ├──────────────────┤                        │
│                    │   HOW TO PLAY     │  secondary            │
│                    ├──────────────────┤                        │
│                    │    SETTINGS       │  secondary            │
│                    ├──────────────────┤                        │
│                    │    CREDITS        │  ghost                │
│                    └──────────────────┘                        │
│                                                                │
│  v0.6 · a1b2c3d                        MIT + CC0 assets        │  ← build hash / license
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| Logo | centered, y≈210 | `display` 52/800 | `#eef2f6`, "3D" .5 |
| Tagline | centered, y≈270 | `body-lg` 16/600 | `#9fb0bd` |
| Button column | centered, y 330–560, 260px wide, 10px gaps | Button | per component |
| PLAY | column top | Button/primary | green fill |
| DAILY RUN + grade badge | 2nd | Button/secondary + right badge in grade color | badge = today's grade or "NEW" chip `#35c46a` |
| HOW TO PLAY | 3rd | secondary | — |
| SETTINGS | 4th | secondary | — |
| CREDITS | 5th | ghost | `#9fb0bd` |
| Last-run chip | top-left, gutter 16px | `micro`, grade letter in grade color | shows only if `localStorage gd3d.lastGrade` exists |
| Icon rail (⚙ settings, 🏆 achievements, 📊 stats) | top-right, 28px icons, 16px apart | — | `#9fb0bd`, hover `#eef2f6` |
| Build/hash | bottom-left | `micro` | `#9fb0bd` @ .5 |
| License credit | bottom-right | `micro` | `#9fb0bd` @ .5 |

**Motion.** On enter: buttons **stagger-fade up 12px** over **250ms `swift`, 40ms apart** top-to-bottom (5 buttons ⇒ last lands at 410ms). Logo fades in over 400ms, tagline 250ms delayed 120ms. Hover/focus: button lifts 2px, border brightens (160ms `swift`). Exit to MODE/DAILY: whole stack `translateY(-8px)` + opacity→0 over 200ms `sink` while the target crossfades in.

**Focus order (kb Tab / pad D-pad).** `PLAY → DAILY RUN → HOW TO PLAY → SETTINGS → CREDITS → ⚙ → 🏆 → 📊 → (wrap to PLAY)`. Default focus on entry: **PLAY**. Gamepad: A activates focused; B is inert on TITLE (root). `Enter` anywhere on the background = PLAY (discoverability). HOW TO PLAY launches the Zen tutorial run (Ch. 10) via MODE→Zen with `?tutorial`.

**State diagram.** `ENTER (stagger) → IDLE (attract orbiting) → {overlay open ⇒ dim to 0.5, hold} / {navigate ⇒ EXIT}`. Buttons: `idle → hover → focus → press → (activate)`; `disabled` only for DAILY RUN when already played (renders as "DAILY DONE · view result").

**Failure states.**

| Failure | Behavior |
|---|---|
| Corrupt `gd3d.v1` profile | reads fall back to defaults, raw blob preserved as `gd3d.corrupt.<ts>`; last-run chip hidden; one quiet toast "Settings reset" |
| No saved profile (first launch) | last-run chip absent; HOW TO PLAY visually emphasized (subtle green pulse, 2s, once); a "Comfort" prompt (Ch. 11) precedes first RUN |
| Daily already played | DAILY RUN button label → "DAILY DONE · B" and routes to DAILY_LOBBY in review mode, not COUNTDOWN |

### 6.5 MODE SELECT

A horizontal card grid of the six modes (**Ch. 2** owns their rulesets). Focused card scales 1.04 with a green outline.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹ Back                    SELECT MODE                         │
│                                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────┐ │
│  │ CAREER │ │  TIME  │ │ CHAOS  │ │  ZEN   │ │ DAILY  │ │END-│ │
│  │  🛒    │ │ ATTACK │ │  💥    │ │  🍃    │ │  📅    │ │LESS│ │
│  │ 40     │ │  ⏱    │ │ mayhem │ │ no     │ │ 1/day  │ │ ♾  │ │
│  │ shifts │ │ vs par │ │ score  │ │ timer  │ │ ranked │ │rush│ │
│  │ ●●●○○  │ │ PB 0:47│ │ hi 82k │ │  —     │ │ •B     │ │512k│ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────┘ │
│                                                                │
│  ┌── Career: 40 hand-authored shifts across 5 ranks. Damage ──┐│
│  │   billed. Stars gate the next rank.                        ││
│  └────────────────────────────────────────────────────────────┘│
│  Seed: [ GD3D-____-_-____ ]  [Paste]        [  CONFIRM  ]      │
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| Back chevron | top-left gutter | `body-lg`, ‹ glyph | `#9fb0bd` |
| Header "SELECT MODE" | top-center, y≈40 | `label` 11.5/600 +1.4px | `#9fb0bd` |
| Card row (6 cards) | centered band y 120–360, card 168×220px, 18px gaps, horizontally scroll-snapped | Card | panel |
| Card icon | card top | 34px emoji | — |
| Card title | under icon | `h2` 22/700 | `#eef2f6` |
| Card one-liner | mid | `body` 13.5/500 | `#9fb0bd` |
| Card stat footer | bottom | `micro`, values in grade/accent colors | e.g. star pips ●=`#ffd23b` |
| Rule blurb panel | y 400–470, 620px centered | `body` | panel fill |
| Seed field | y≈500, left | Field/`mono` | — |
| Paste button | beside field | Button/secondary | — |
| CONFIRM | y≈500, right | Button/primary | green |

**Per-card footer content (all six, exhaustively):** Career → star progress `●●●○○` (filled = ranks cleared); Time Attack → best `PB m:ss` of Circuit; Chaos → `hi {mayhem}k`; Zen → `—`; Daily → `•{todayGrade}` or `NEW` chip; Endless → `{bestScore}k`.

**Motion.** Cards enter with a **left-to-right stagger**, each `translateY(14px)+opacity 0→1` over 250ms `swift`, **50ms apart** (6 cards ⇒ last at 550ms). Focus change: outgoing card `scale 1.04→1.0` and incoming `1.0→1.04` over 200ms `swift`; rule blurb crossfades its text (120ms). CONFIRM press → route (Career→CAREER_MAP, Daily→DAILY_LOBBY, others→COUNTDOWN).

**Focus order.** `Back → Card1(Career) → …→ Card6(Endless) → Seed field → Paste → CONFIRM`. `←/→` moves within the card row; `Tab` jumps row→controls. Default focus: **Career** (or last-selected mode, remembered in `gd3d.lastMode`). Gamepad: stick/D-pad `←/→` scroll cards, A = CONFIRM the focused card directly (skipping the button for speed), B = Back.

**State diagram.** `ENTER → BROWSING (focus roves; blurb + seed validity update) → CONFIRMED → route`. Seed field sub-states: `empty → typing → valid (green border, CONFIRM enabled) → invalid (red border #c9241a, inline "unknown seed", CONFIRM still allowed → random)`.

**Failure states.**

| Failure | Behavior |
|---|---|
| Career card selected but 0 stars & tutorial unseen | allowed; routes to CAREER_MAP with Shift 1 as the only unlocked node |
| Pasted seed malformed | field border `#c9241a`, message "Seed unreadable — a random run will start", CONFIRM proceeds with fresh seed |
| Daily selected but already played | Daily card shows "DONE" ribbon; CONFIRM routes to DAILY_LOBBY review, not a new run |
| Clipboard read denied (Paste) | Paste button greys with tooltip "Clipboard blocked — type the seed"; manual entry still works |

### 6.6 CAREER MAP

A vertical **node map** of ~40 shifts (**Ch. 3** authors them) grouped into the five ranks — Cart Pusher → Stocker → Team Lead → Assistant Manager → Store Manager. Nodes are stations along a snaking "aisle" path; stars gate rank advancement (need 60% of a rank's stars to unlock the next). This screen is the campaign's home.

```
┌──────────────────────────────────────────────────────────────┐
│ ‹ Back   CAREER — Team Lead        ★ 34/120     ⚡ Lv12  ₵4,180│
│──────────────────────────────────────────────────────────────│
│   RANK 5 · STORE MANAGER            🔒 need ★72                │
│        ○────○────◆(Final)                                     │
│   RANK 4 · ASSISTANT MANAGER        🔒 need ★54               │
│    ○────○────○────○────○────○────○────○                       │
│   RANK 3 · TEAM LEAD                ◄ you are here            │
│    ●★★★─●★★☆─◉★☆☆─○────○────○────○────○                        │
│                    ▲ next: "Health Inspector Visit"           │
│   RANK 2 · STOCKER                  ✓ cleared  ★22/24         │
│    ●────●────●────●────●────●                                 │
│   RANK 1 · CART PUSHER              ✓ cleared  ★15/15         │
│    ●────●────●────●────●                                      │
└──────────────────────────────────────────────────────────────┘
       (vertical scroll; camera-lot mural behind at 0.4 opacity)
```

| Element | Position | Type | Color |
|---|---|---|---|
| Back | top-left | ‹ `body-lg` | `#9fb0bd` |
| Title "CAREER — {rank}" | top-center | `h2` | `#eef2f6` |
| Star total `★ x/120` | header right group | `body`, star `#ffd23b` | — |
| Level / ₵ chips | header far-right | `micro` | `#9fb0bd`, ₵ `#ffd23b` |
| Rank band label | each band header | `label` +1.4px | `#9fb0bd` |
| Node — cleared `●` | on path | 22px filled disc | green `#35c46a` |
| Node — current `◉` | pulsing | 26px ring | `#35c46a` + glow |
| Node — unlocked `○` | on path | 22px hollow | `#eef2f6` @ .7 |
| Node — locked `🔒` | greyed | 22px | `#9fb0bd` @ .35 |
| Node — boss `◆` | rank capstone | 26px diamond | `#ffd23b` |
| Per-node stars `★★☆` | under node | `micro` | earned `#ffd23b`, empty `#3a4048` |
| Connector path | between nodes | 3px line | cleared=green, ahead=`rgba(255,255,255,0.14)` |
| "next:" pointer | beside current | `body` | `#35c46a` |

**Motion.** On enter, the view **auto-scrolls to the current node** over 400ms `glide`, then the `◉` node pulses (scale 1.0↔1.08 at 0.6Hz, opacity halo). Selecting a node: node scales to 1.12 (120ms `punch`), then crossfade to BRIEFING. Locked-node activation: a **shake** (translateX ±6px, 3 cycles, 240ms) + `SFX.error` + toast "Clear ★{n} more in {rank} to unlock." Rank-unlock (returning after crossing threshold): the newly-unlocked band's lock icon dissolves and its first node **flips** hollow→green-outline over 500ms with `SFX.listDone`.

**Focus order.** Nodes are the focus set, ordered by shift index (Rank1→Rank5, left→right within a rank). `↑/↓/←/→` and D-pad walk the graph along connectors (spatial nav — down = previous rank, up = next); `Tab` = strict index order; Back/B returns to MODE. Default focus: **current node** `◉`. Locked nodes are focusable but non-activatable (A shows the requirement toast).

**State diagram.** `ENTER (scroll-to-current) → BROWSING → {node unlocked ⇒ SELECT → BRIEFING} / {node locked ⇒ REJECT (shake) → BROWSING}`. Global sub-state `RANK_UP_CELEBRATION` plays once when `starsThisRank ≥ 0.6·rankStarCap` on entry, then clears a flag.

**Failure states.**

| Failure | Behavior |
|---|---|
| No shift ever cleared | only Shift 1 unlocked; all else locked; view starts at Rank 1 top |
| Corrupt star data | recompute from per-shift best records; if those are also gone, treat rank-1 shift 1 as the only unlock, toast "Career progress reset" |
| Career already 100% | Store Manager band shows "COMPLETE ✓", all nodes green; boss node offers replay for a better grade |
| Star threshold exactly met mid-session | unlock celebration defers to next CAREER_MAP entry (never interrupts a run) |

### 6.7 SHIFT BRIEFING

The pre-run contract for a single Career shift: setup, twist, three star-objectives, par, damage ceiling. Composited over the attract stage with the shift's target department framed.

```
┌──────────────────────────────────────────────────────────────┐
│ ‹ Back        SHIFT 18 · RANK 3            par 1:35   ⛔ $18   │
│                                                                │
│   HEALTH  INSPECTOR  VISIT                                     │  ← h1
│   An inspector patrols the floor. Keep it clean.              │  ← body-lg dim
│                                                                │
│   ┌── TWIST ──────────────────────────────────────────────┐  │
│   │ Debris on the floor within 8m of the inspector = a     │  │
│   │ strike. Three strikes and you're done. Press Q to      │  │
│   │ re-shelve.                                              │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│   OBJECTIVES                                                   │
│   ☆  Complete the 6-item list                    (base)      │
│   ★  ≤ 1 violation                               +200 ₵      │
│   ★  Zero violations                             +400 ₵      │
│   ★  Under par (1:35)                            +300 ₵      │
│                                                                │
│   Best: A · 1:41 · ★★☆              [ ‹ MAP ]  [  START ▶ ]  │
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| Back | top-left | ‹ | `#9fb0bd` |
| Shift index + rank | top-center | `label` | `#9fb0bd` |
| Par chip / damage-ceiling chip | top-right | `body`, ceiling `⛔` in `#c9241a` | — |
| Shift title | y≈140 | `h1` 34/800 | `#eef2f6` |
| One-line setup | under title | `body-lg` | `#9fb0bd` |
| TWIST panel | y 220–300, 620px | `body`, "TWIST" `label` | panel, left accent bar `#ffd23b` 3px |
| OBJECTIVES header | y≈330 | `label` | `#9fb0bd` |
| Objective rows (4) | y 360–470 | `body`, star glyph | base ☆ `#9fb0bd`; ★ `#ffd23b`; bounty `#ffd23b` |
| Best-result line | bottom-left | `body`, grade-colored | — |
| MAP button | bottom-right pair, left | Button/secondary | — |
| START | bottom-right | Button/primary | green |

**Motion.** Enter: title `translateY(10px)+fade` 250ms `swift`; TWIST panel slides from left 16px 300ms delay 100ms; objective rows stagger 40ms each. START press → COUNTDOWN. If a star was newly earnable (returning post-attempt), earned ★ rows do a `scale 1.0→1.2→1.0` gold flash 300ms `punch` on entry.

**Focus order.** `START → MAP → Back`. Default focus: **START** (get-into-the-run bias). Objective rows are non-focusable (read-only). Gamepad A = START, B = MAP/Back.

**State diagram.** `ENTER → READY → {START ⇒ COUNTDOWN} / {MAP/Back ⇒ CAREER_MAP}`. A `REVIEW` variant (entered from a cleared node) swaps START for **REPLAY** and shows the earned-stars summary prominently.

**Failure states.**

| Failure | Behavior |
|---|---|
| Shift data missing/corrupt | fall back to a generic 6-item shift with par from the geometry formula (Ch. 4), toast "Using default objectives" |
| Reached via deep-link to a locked shift | redirect to CAREER_MAP with the lock toast |
| No prior best | best-line reads "Best: — (not yet cleared)" in `#9fb0bd` |

### 6.8 SETTINGS (4 tabs)

An overlay (scrim `rgba(6,9,12,0.55)` + `blur(6px)`, dropped on panic tier) opened from TITLE or PAUSE. A single card with a left tab rail and a scrolling body. Four tabs: **Display · Audio · Controls · Comfort**. All values persist to `localStorage` (`gd3d.settings`, `gd3d.binds`, `gd3d.a11y`) and apply live.

```
┌──────────────────────────────────────────────────────────────┐
│  SETTINGS                                              ✕ Close │
│ ┌──────────┬───────────────────────────────────────────────┐ │
│ │▸ Display │  QUALITY        ( Auto ) ( Lite ) ( High )     │ │
│ │  Audio   │  BLOOM          off ──●── full                 │ │
│ │  Controls│  FOV            55 ──────●──── 100     [ 62 ]  │ │
│ │  Comfort │  HUD SCALE      0.85 ───●─── 1.40      [1.00]  │ │
│ │          │  HUD OPACITY    0.40 ──────●─ 1.00     [1.00]  │ │
│ │          │  CROSSHAIR      (dot)(cross)(ring)  size ●──   │ │
│ │          │  MINIMAP        [on]     PHOTO HUD-HIDE  [H]    │ │
│ └──────────┴───────────────────────────────────────────────┘ │
│                          [ Reset tab ]      [  Done  ]         │
└──────────────────────────────────────────────────────────────┘
```

**Tab rail:** 140px wide, each tab a row `body-lg`; active tab has a 3px left accent bar `#35c46a` + brighter ink; inactive `#9fb0bd`.

**Tab 1 — Display (every control):** Quality `Auto/Lite/High` segmented (maps to the `tier` override in `main.js`); Bloom `off/low/full` (toggles `UnrealBloomPass.strength`); FOV slider 55–100 default 62 (`camera.fov`); HUD scale 0.85–1.40 (`--ui-scale`); HUD opacity 0.40–1.00 (`--hud-opacity`); Crosshair style `dot/cross/ring` + size + high-contrast toggle (styles `#crosshair`); Minimap on/off; Photo HUD-hide key readout (`H`).

**Tab 2 — Audio (every control):** Master volume 0–100 (default 45, matches `master.gain 0.45`); Mute toggle (mirrors `M`/`SFX.toggleMute`); SFX volume 0–100; Ambience/store-hum 0–100 (default the shipped 0.018 bed); "Visual audio cues" toggle (Ch. 11 — directional pips + captions, default off); Bark captions on/off (default on).

**Tab 3 — Controls (every control):** device selector `Keyboard+Mouse / Gamepad / Touch` (auto-detected, overridable); a **rebind list** of the nine actions — Move, Look, Sprint, Interact/Take, New-list/Continue, Pause, Mute, Map, Hide-HUD (Ch. 8 owns the action map). Each row: action name + current glyph; clicking enters "press a key" capture, writes `gd3d.binds` by `KeyboardEvent.code`; conflicts flag inline in `#c9241a`. Sub-toggles: Sprint `hold/toggle`; Interact `press/hold`; Invert-Y; Look sensitivity 0.001–0.010 rad/px (default 0.0042, matches fallback constant); Aim-assist on/off (default on for pad). **Reset to defaults** button.

**Tab 4 — Comfort / Accessibility (every control, Ch. 11 owns semantics):** Reduced-motion master (follows `prefers-reduced-motion`); Head-bob `off/low/full`; Camera-shake `off/half/full`; Cart-sway `off/reduced/full`; Hit-stop on/off; Flash reduction on/off; Colorblind mode `normal/deuter/prot/trit`; Subtitles/bark-captions on/off; Extra time `off/+25%/+50%`; No-damage (Pacifist) on/off; Auto-grab-in-reach on/off; Objective assist on/off; Dyslexia-friendly font on/off.

| Element | Position | Type | Color |
|---|---|---|---|
| "SETTINGS" | card top-left, 20px pad | `label` | `#9fb0bd` |
| ✕ Close | card top-right | 20px glyph | `#9fb0bd`→`#eef2f6` |
| Tab rail | left, 140px | `body-lg` rows | active `#eef2f6`+bar `#35c46a` |
| Control rows | body, 44px row height | `body` label + control | value chip `mono` `#9fdcff` |
| Segmented control | right of label | pill group | selected fill `#35c46a` ink `#06210f` |
| Slider track/thumb | right of label, 180px | track `rgba(255,255,255,0.14)`, thumb `#35c46a` 14px | value box `mono` |
| Reset tab / Done | card footer | Button/ghost, Button/primary | — |

**Motion.** Overlay in: scrim fade 180ms `glide`; card `scale .96→1 + translateY 8px` 250ms `swift`. Tab switch: body content crossfades 150ms + slides 8px in the direction of travel. Slider drag: thumb has no easing (1:1); value chip pulses 1.0→1.1 120ms on release. Close: reverse, 160ms `sink`.

**Focus order.** `Tab rail (Display→Audio→Controls→Comfort) → body controls top→bottom → Reset tab → Done → ✕`. `←/→` on a focused segmented/slider adjusts value; `↑/↓` moves rows; `Ctrl+Tab`/pad bumpers (LB/RB) switch tabs. Esc/B = Done (persist + close). Default focus: active tab's first control.

**State diagram.** `OPEN → EDITING (each change writes localStorage + applies live) → {rebind row ⇒ CAPTURING (awaits keypress; Esc cancels) → CONFLICT? show inline : commit} → CLOSE`. Quality=Auto vs manual toggles whether `autoQuality` in `main.js` may override.

**Failure states.**

| Failure | Behavior |
|---|---|
| Rebind conflict | offending row + conflicting row both border `#c9241a`, inline "already bound to Sprint"; commit blocked until resolved or "swap" chosen |
| localStorage write fails (quota/private mode) | changes apply in-memory for the session; one toast "Settings won't persist in private browsing" |
| Corrupt settings blob | defaults loaded, raw kept as `gd3d.corrupt.<ts>`, toast "Settings reset" |
| Gamepad unplugged while on Controls | device selector auto-falls to Keyboard+Mouse, pad rows greyed with "reconnect controller" |

### 6.9 PAUSE (overlay)

Suspends RUN without tearing it down. This is also where pointer-lock loss, tab-out, and `Esc` land — so an accidental unlock never reads as failure. The last RUN frame freezes behind a dim + blur; the timer **holds** (no time bleeds while paused).

```
┌──────────────────────────────────────────────────────────────┐
│                (frozen RUN frame, dimmed 55%, blur 6px)        │
│                                                                │
│                        ⏸  PAUSED                               │
│                     Shift 18 · 0:47 · 3/6                      │  ← run context
│                                                                │
│                    ┌──────────────────┐                        │
│                    │     RESUME        │  primary              │
│                    ├──────────────────┤                        │
│                    │   RESTART LIST    │  secondary            │
│                    ├──────────────────┤                        │
│                    │    SETTINGS       │  secondary            │
│                    ├──────────────────┤                        │
│                    │  QUIT TO TITLE    │  destructive          │
│                    └──────────────────┘                        │
│                                                                │
│  Controls: WASD move · Shift sprint · E take · Q re-shelf      │  ← live control card
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| Scrim | full-bleed | — | `rgba(6,9,12,0.55)` + `blur(6px)` |
| "PAUSED" + ⏸ | centered y≈220 | `h1` | `#eef2f6` |
| Run context line | under | `body`, `mono` figures | `#9fb0bd` |
| Button column | centered, 260px, 10px gaps | Button | per component |
| RESUME | top | primary | green |
| RESTART LIST | 2nd | secondary | — |
| SETTINGS | 3rd | secondary | opens SETTINGS overlay atop |
| QUIT TO TITLE | 4th | destructive | ink `#c9241a` |
| Control card | bottom, auto-device glyphs | `body` | `#9fb0bd` |

**Motion.** In: scrim fade 180ms `glide`, blur ramps 0→6px over 180ms, buttons stagger-fade up 8px 40ms apart. Out (RESUME): reverse over 160ms `sink`, then pointer re-locks (or fallback re-engages). QUIT shows a small inline confirm ("Quit? Progress this run is lost" with **Quit**/**Cancel**) before crossfading to TITLE.

**Focus order.** `RESUME → RESTART LIST → SETTINGS → QUIT TO TITLE`. Default focus: **RESUME**. Esc/B or click-anywhere-on-scrim = RESUME (fast un-pause is the default gesture). Gamepad Start/Options also resumes.

**State diagram.** `RUN --Esc/unlock/hidden--> PAUSE(IDLE) → {RESUME ⇒ relock → RUN} / {RESTART ⇒ game.reset() → COUNTDOWN} / {SETTINGS ⇒ nested overlay} / {QUIT ⇒ CONFIRM → TITLE}`. Distinct entry causes tag the header sub-label: manual Esc → "PAUSED"; lost lock → "PAUSED · click to resume looking"; tab-out → "PAUSED · welcome back".

**Failure states.**

| Failure | Behavior |
|---|---|
| Pointer-lock cannot re-acquire on RESUME | fall through to drag-look fallback (`enableFallback` path), header adds "Drag to look" |
| Repeated rapid Esc (lock thrash) | debounce 300ms so PAUSE can't flicker |
| Quit during a Career shift | run counts as abandoned (no star change), returns to TITLE not CAREER_MAP |

### 6.10 RESULTS

Replaces the current end-of-run `#banner` (which `game.js` draws inline). A dedicated scorecard built for readability and one-key re-run. Scoring math and the grade formula are **Ch. 12**; this section owns the *screen*.

```
┌──────────────────────────────────────────────────────────────┐
│                       CHECKED OUT                              │  ← h2
│                        ┌───────┐                               │
│                        │   A   │   ← grade stamp (slam)        │
│                        └───────┘                               │
│   ── RECEIPT ─────────────────────────────                     │
│   Honey Oats Cereal ............. $4.29                        │  ← mono rows
│   Marinara Sauce ................ $2.79                        │
│   Large Eggs 12ct ............... $3.29                        │
│   … (all list items) …                                        │
│   Subtotal ..................... $22.40                        │
│   STORE DAMAGES  4 items ....... $6.12  😬                     │  ← red section
│   TOTAL ........................ $28.52                        │
│                                                                │
│         1:41            score 8,240  ▲                         │  ← h1 time + count-up
│   items 6 · tipped 1 · carts 0 · bumps 2 · combo ×5           │  ← comedy stats
│                                                                │
│   [R] PLAY AGAIN    NEW LAYOUT    SHARE    TITLE               │
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| "CHECKED OUT" | top-center y≈50 | `h2` | `#eef2f6` |
| Grade stamp | centered y≈130, 96×96px box | `display` 52/800 letter | grade color (S`#ffd23b`…D`#c9241a`) |
| Receipt block | centered, 420px, y 210–420 | `mono` 13/500, leader dots | items `#eef2f6`; damages `#e8907f`; TOTAL `#eef2f6` bold |
| Time | y≈450 | `h1` 34/800 | `#eef2f6` |
| Medal (Time Attack) | beside time | 🥇/🥈/🥉 | — |
| Score count-up | beside time | `h1` | grade color |
| Comedy stats row | y≈500 | `body` | `#9fb0bd`, non-zero destructive stats in `#e8907f` |
| Action row | y≈560 | Buttons | PLAY AGAIN primary, others secondary/ghost |

**Comedy stats (all five, from physics events):** `items {grabbed} · tipped {aisles} · carts {wrecked} · bumps {npc} · combo ×{longest}`.

**Motion — the payoff beat.** On enter the world dims to 55% behind; card fades in 180ms. **Grade stamp:** enters `scale 3.0, opacity 0, rotate −12°` and slams to `scale 1.0, 0°` over **220ms `punch`**, landing with `SFX.thud`, a 6px screen shake (reusing the physics shake channel), and a dust-puff. On **S**: add a gold `#ffd23b` shimmer sweep (left→right, 500ms) + the `SFX.checkout` arpeggio. Score **counts up** from 0 to final over **650ms `linear`** with `SFX.tick` blips every ~10 frames. Receipt rows stagger-reveal 30ms each. Damage section drops in red 200ms after subtotal for a beat of dread.

**Focus order.** `PLAY AGAIN → NEW LAYOUT → SHARE → TITLE`. Default focus: **PLAY AGAIN**. `R` anywhere = Play Again (matches shipped `game.js` `KeyR && done`). Gamepad A = focused action, B = TITLE. SHARE opens an inline popover (below); focus moves into it and Esc returns.

**SHARE popover (local-first, no backend).** Two rows: **Copy screenshot** (`renderer.domElement.toDataURL('image/jpeg',0.9)` composited under the card, offered as Clipboard copy + download) and **Copy seed code** (`GD3D-{seed}-{grade}-{mmss}` to clipboard, toast "Copied — challenge a friend"). Pasting that code in MODE reconstructs the run.

**State diagram.** `ENTER (dim + slam + count-up) → IDLE → {PLAY AGAIN ⇒ same-seed COUNTDOWN} / {NEW LAYOUT ⇒ fresh-seed COUNTDOWN} / {SHARE ⇒ POPOVER} / {TITLE ⇒ crossfade}`. In Career, a `STAR_TALLY` sub-beat animates newly-earned stars (each ★ pops gold 300ms `punch`, +₵ counter ticks) before IDLE, then writes the shift record.

**Failure states.**

| Failure | Behavior |
|---|---|
| Clipboard write denied (Share) | fall back to a selectable read-only text field with the code + "Ctrl-C to copy"; screenshot offered as download only |
| `toDataURL` throws (tainted/context lost) | screenshot option greys with "screenshot unavailable this run"; seed code still works |
| Daily run just finished | PLAY AGAIN hidden (one attempt/day); actions become **VIEW LOBBY · SHARE · TITLE**; grade locks to `gd3d.daily.<seed>` |
| Score persistence fails | Results still display; toast "couldn't save this run" |

### 6.11 ACHIEVEMENTS (overlay)

A scrollable grid of all **34** achievements (**Ch. 5** defines their triggers), each a tile showing locked/unlocked state and progress. Opened from TITLE (🏆) or the corner rail.

```
┌──────────────────────────────────────────────────────────────┐
│  ACHIEVEMENTS                     18 / 34 · 53%        ✕ Close │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                   │
│ │ 🛒✓  │ 🧹✓  │ 🧺   │ 💵   │ ⚡✓  │ 🏅✓  │                   │
│ │First │Clean │Full  │Grand │Speed │S-Tier│                   │
│ │Cart  │Sweep │Basket│Total │Demon │      │                   │
│ │      │      │ 64/100      │$1.9k/2.5k    │                   │
│ ├──────┼──────┼──────┼──────┼──────┼──────┤                   │
│ │ 🕊   │ 💣   │ 🧹   │ 🎳   │ ❄✓  │ 🧊   │  … (all 34) …     │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                   │
│  Hover: "Untouchable — Pacifist ×5 runs"  (3/5)               │
└──────────────────────────────────────────────────────────────┘
```

**All 34 tiles, in fixed order (name — locked/progress display):** 1 First Cart, 2 Clean Sweep, 3 Full Basket (n/100), 4 Grand Total ($n/2500), 5 Speed Demon, 6 S-Tier, 7 Untouchable (n/5), 8 Demolition Man (n/10), 9 Cleanup Crew (n/50), 10 Cart Curler, 11 Cold Blooded, 12 Aisle Whisperer, 13 Regular (7-day), 14 Local Legend (30-day), 15 Frequent Flyer (n/50), 16 No Backsies, 17 Priced In, 18 Bull in a China Shop, 19 Butterfingers (n/20), 20 Escort Service, 21 Perfect Attendance, 22 Middle Management, 23 Store Manager, 24 Freezer Burn, 25 Wine Snob, 26 Combo Breaker, 27 Marathoner, 28 Register Rush 500 (n/500k), 29 Window Shopper (n/30min), 30 Completionist (n/52), 31 Sale Hunter (n/25), 32 Ghost Buster, 33 Rainbow Cart, 34 Manager's Pet.

| Element | Position | Type | Color |
|---|---|---|---|
| "ACHIEVEMENTS" | top-left | `label` | `#9fb0bd` |
| Progress `18/34 · 53%` | top-center | `body`, % in `#35c46a` | — |
| ✕ Close | top-right | glyph | `#9fb0bd` |
| Tile grid | body, 6 cols, 112×112px tiles, 12px gaps, vertical scroll | Card | panel |
| Tile icon | tile top | 28px emoji | unlocked full color; locked desaturate + 0.4 opacity |
| Tile name | under icon | `micro` | unlocked `#eef2f6`; locked `#9fb0bd` |
| Progress bar (if countable) | tile bottom | 6px | fill `#35c46a` on `rgba(255,255,255,0.12)` |
| Unlocked check | tile corner | ✓ `#35c46a` | — |
| Hover/focus caption | footer strip | `body` | `#eef2f6` |

**Motion.** Overlay in like SETTINGS. Tiles fade-in in a wave (row-major, 20ms apart, capped so it never exceeds 400ms total). Focus/hover: tile `scale 1.06` + border `#35c46a` 150ms; footer caption crossfades the description + progress. **Newly-unlocked** tiles (since last open) get a one-time gold ring pulse + `SFX.tick` on reveal. Achievement *pops during gameplay* are Ch. 9's toast, not this screen.

**Focus order.** Grid row-major: `Close ← → tiles left-to-right, top-to-bottom → wrap`. Arrow keys / D-pad = 2-D grid nav; `Tab` = linear. Default focus: first **unlocked-but-unseen** tile, else tile 1. A/Enter on a tile expands its full description + reward in the footer (no deeper screen). Esc/B = Close.

**State diagram.** `OPEN → BROWSING (footer tracks focus) → CLOSE`. Per-tile: `locked (grey) / in-progress (bar) / unlocked (color+✓) / newly-unlocked (pulse once → unlocked)`.

**Failure states.**

| Failure | Behavior |
|---|---|
| Achievement flags corrupt | recompute what's derivable from lifetime counters; unverifiable ones stay locked; no crash |
| Counter exceeds target but flag missing | reconcile on open (mark unlocked), pop the reveal |
| Empty (fresh save) | all 34 render locked; progress "0/34"; no wave beyond fade-in |

### 6.12 STATS

A lifetime dashboard of the comedy metrics and progression totals — the "how much store have I destroyed" ledger. Overlay from TITLE (📊).

```
┌──────────────────────────────────────────────────────────────┐
│  YOUR RECORD                                          ✕ Close │
│  ┌── PROGRESSION ─────────┐  ┌── THE DAMAGE LEDGER ─────────┐ │
│  │ Level        12         │  │ Aisles tipped        27      │ │
│  │ XP     4,180 / 6,900    │  │ Carts wrecked        14      │ │
│  │ ▓▓▓▓▓▓▓░░░ 61%          │  │ NPCs bumped         203      │ │
│  │ Carts (₵)   4,180       │  │ Items knocked       1,842    │ │
│  │ Runs         138        │  │ $ in damages    $2,910       │ │
│  └────────────────────────┘  └──────────────────────────────┘ │
│  ┌── SHOPPING ────────────┐  ┌── DAILY / STREAK ────────────┐ │
│  │ Items grabbed  9,610    │  │ Current streak  🔥 6 days    │ │
│  │ $ rung up   $18,240     │  │ Best streak     14 days      │ │
│  │ Longest combo  ×22      │  │ Dailies played  41           │ │
│  │ SKUs seen    48/52      │  │ Best daily grade  S          │ │
│  └────────────────────────┘  └──────────────────────────────┘ │
│  ── PER-MODE BESTS ──  Career ★34 · TA 0:47 · Chaos 82k ·     │
│                        Endless 512k · Zen 47min               │
└──────────────────────────────────────────────────────────────┘
```

**Every stat rendered (from the `localStorage` profile):** *Progression* — Level, XP (n/next), XP bar %, Carts ₵ balance, total Runs. *Shopping* — Items grabbed, $ rung up, Longest combo, SKUs seen (n/52). *Damage ledger* — Aisles tipped, Carts wrecked, NPCs bumped, Items knocked, $ in damages. *Daily/Streak* — Current streak (🔥 flame `#ffd23b`), Best streak, Dailies played, Best daily grade. *Per-mode bests* — Career stars, Time Attack Circuit PB, Chaos hi-score, Endless hi-score, Zen minutes.

| Element | Position | Type | Color |
|---|---|---|---|
| "YOUR RECORD" | top-left | `label` | `#9fb0bd` |
| ✕ Close | top-right | glyph | `#9fb0bd` |
| Four stat panels | 2×2 grid, ~300px each, 16px gaps | Card | panel |
| Panel caption | panel top | `label` | `#9fb0bd` |
| Stat label | left col | `body` | `#9fb0bd` |
| Stat value | right col, tabular | `h2` figures | `#eef2f6`; damage values `#e8907f`; grade values in grade color |
| XP bar | progression panel | 8px, fill `linear-gradient(#35c46a,#8be0a4)` | track `rgba(255,255,255,0.12)` |
| Per-mode strip | full-width footer | `body` | `#9fb0bd`, figures `#eef2f6` |

**Motion.** Overlay in like SETTINGS. On enter, each numeric value **counts up** from 0 to its total over 500ms `linear` (staggered per panel 80ms); the XP bar fills left→right 400ms `swift`. No per-frame updates — this is a static ledger snapshot taken on open. Reduced-motion: values render final, no count-up.

**Focus order.** Panels are read-only; the only focusable element is **✕ Close** (and a `[Reset stats…]` ghost button, bottom-left, which requires a typed confirm). Tab toggles between them; Esc/B closes. Gamepad B closes.

**State diagram.** `OPEN (snapshot + count-up) → IDLE → CLOSE`. `[Reset stats]` → `CONFIRM (type "RESET") → wipe counters (not achievements/cosmetics) → re-snapshot`.

**Failure states.**

| Failure | Behavior |
|---|---|
| Missing counters (old save version) | absent stats show "—"; present ones display; schema migrates forward on next write |
| Corrupt profile | all stats "—", banner "Stats data was reset"; achievements/cosmetics untouched if separately intact |
| Fresh save | zeros throughout; per-mode bests read "—"; streak "0 days" |

### 6.13 CREDITS

A scrolling attribution list built from the shipped `CREDITS.md` ledger — the license honesty the project's asset-pipeline-as-code doctrine demands. Overlay from TITLE.

```
┌──────────────────────────────────────────────────────────────┐
│  CREDITS                                              ✕ Close │
│                                                                │
│   GROCERY DASH 3D                                              │
│   Built with three.js r160 · Vite                             │
│                                                                │
│   ── TEXTURES & HDRI · Poly Haven (CC0) ──                    │
│   empty_warehouse_01 · floor_tiles_06 · beige_wall_001        │
│                                                                │
│   ── MODELS ──                                                │
│   Kenney Car Kit (CC0)                                         │
│   Poly Haven photoscans (CC0) — produce, tins, croissant,     │
│     register, plant, box, crate, wine, shelf                  │
│   Microsoft Rocketbox avatars (MIT) © Microsoft               │
│   three.js Soldier (MIT) — animation donor, never rendered    │
│   Cesium CesiumMan (CC-BY 4.0) — legacy fallback              │
│                                                                │
│   ── PACKAGING ART ──                                         │
│   Fictional brands, procedurally drawn in products.js         │
│                                                                │
│   All bundled assets are free for commercial use.             │
│                                        v0.6 · a1b2c3d          │
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| "CREDITS" | top-left | `label` | `#9fb0bd` |
| ✕ Close | top-right | glyph | `#9fb0bd` |
| Game title + tech | top block | `h2` + `body` | `#eef2f6` / `#9fb0bd` |
| Section headers | each group | `label` +1.4px | `#35c46a` |
| Attribution lines | under each header | `body` | `#eef2f6`; license tag `micro` `#9fb0bd` |
| Build/hash | bottom-right | `micro` | `#9fb0bd` @ .5 |

**Content (verbatim from the ledger, all entries):** Textures/HDRI — Poly Haven CC0: `empty_warehouse_01`, `floor_tiles_06`, `beige_wall_001`. Models — Kenney Car Kit (CC0); Poly Haven photoscan models (CC0) apple/lemon/avocado/bananas/onion/sweet-potato + tins + croissant + register + plant + box + crate + wine + shelf; Microsoft Rocketbox avatars (MIT, © Microsoft) Female_Adult_01/08/12 + Male_Adult_01/04/08; three.js Soldier (MIT, animation donor, never rendered); Khronos/Cesium CesiumMan (CC-BY 4.0, legacy fallback). Packaging — procedural fictional brands in `products.js`.

**Motion.** Overlay in like SETTINGS. Content **auto-scrolls** upward at ~24px/s once idle for 2s (classic credits roll); any input pauses the auto-scroll and hands control to manual scroll/wheel/stick. Section headers fade-in as they cross 80% viewport height.

**Focus order.** `Close` is the sole control; `↑/↓` / stick scroll the body; `Esc / B / Close` exits. Default focus: **Close**. Links (Poly Haven, Rocketbox repo) render as `micro` URLs but are **non-clickable** in-game (displayed for attribution only) to avoid navigating away from the canvas.

**State diagram.** `OPEN → AUTO_SCROLL → {input ⇒ MANUAL_SCROLL} → (idle 2s) → AUTO_SCROLL → CLOSE`.

**Failure states.** None critical — content is static and bundled. If the app can't read the build hash it renders "dev" in its place.

### 6.14 DAILY LOBBY

The retention hub: today's globally-identical seeded run, one ranked attempt, a share/verify code, and streak state — all client-side (`dateSeed = YYYY*10000+MM*100+DD` fed to the shipped LCG `seed=(seed*16807)%2147483647`). No backend required (**Ch. 5**/Ch. 24 own the optional leaderboard drop-in).

```
┌──────────────────────────────────────────────────────────────┐
│ ‹ Back            DAILY RUN — Fri Jul 11             🔥 6 days │
│                                                                │
│   TODAY'S TWIST                                                │
│   ┌────────────────────────────────────────────────────────┐  │
│   │  RUSH HOUR — max crowd, the alley is chaos.            │  │
│   │  6 items · par 1:20 · damage soft-billed              │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                │
│   SEED  GD3D-7C4A          one ranked attempt                 │
│                                                                │
│   ┌─── not yet played ───┐        ┌── already played ──┐      │
│   │   [   START ▶  ]     │   or   │  YOUR RESULT: A     │      │
│   │                      │        │  1:14 · 9,120       │      │
│   └──────────────────────┘        │  [ Share ] [Verify]│      │
│                                    └────────────────────┘      │
│   Challenge a friend: paste their code   [ GD3D-____-_-____ ] │
└──────────────────────────────────────────────────────────────┘
```

| Element | Position | Type | Color |
|---|---|---|---|
| Back | top-left | ‹ | `#9fb0bd` |
| "DAILY RUN — {date}" | top-center | `h2` | `#eef2f6` |
| Streak chip 🔥 | top-right | `body`, flame `#ffd23b` | — |
| "TODAY'S TWIST" | y≈110 | `label` | `#9fb0bd` |
| Twist panel | y 140–210 | `body`, twist name `h2` | panel, left accent `#ffd23b` |
| Seed code | y≈250 | `mono` | `#9fdcff` |
| START (unplayed) | centered y≈320 | Button/primary | green |
| Result card (played) | centered y≈300–380 | Card, grade letter `display` in grade color | — |
| Share / Verify | in result card | Button/secondary | — |
| Friend-code field | bottom | Field/`mono` | — |

**Two mutually-exclusive states** driven by `gd3d.daily.<todaySeed>`: **unplayed** shows START; **played** shows the locked result (grade, time, score) + Share + a **Verify** field where a friend's `GD3D-…` code re-derives their run locally and displays "valid: A · 1:14 · 9,120" — social proof, zero infra.

**Motion.** Enter: twist panel slides from left 300ms `swift`; streak flame does a 1.0→1.15→1.0 flicker 400ms `punch` if the streak grew today. START → COUNTDOWN. On a *just-completed* daily returning here, the result card grade letter re-slams (220ms `punch`) and the streak increments with a `+1` float.

**Focus order.** Unplayed: `START → friend-code field → Back`. Played: `Share → Verify field → friend-code field → Back`. Default focus: **START** (unplayed) / **Share** (played). Gamepad A/B as usual.

**State diagram.** `ENTER → check gd3d.daily.<seed> → {UNPLAYED: START enabled → COUNTDOWN} / {PLAYED: result shown, START replaced by result card}`. Verify sub-state: `field empty → decoding → valid (green) / invalid (red "code doesn't match today's seed")`. At local midnight rollover the lobby recomputes `todaySeed` and flips back to UNPLAYED.

**Failure states.**

| Failure | Behavior |
|---|---|
| Already played today | START hidden; result card shown; attempting to re-enter a run is blocked with toast "One daily per day — come back tomorrow" |
| Clock skew / timezone change | seed keyed to local date; if the stored `lastDailyDate` is in the future (clock moved back), keep the existing record, don't grant a second attempt |
| Streak broken (missed a day) | streak resets to 1 on next play; a gentle line "streak reset — start a new one" (never punitive) |
| Friend code malformed | Verify field border `#c9241a`, "unreadable code"; no crash |
| Offline & optional leaderboard enabled | leaderboard panel (if built) shows "offline — local rank only"; the run itself is fully playable |

### 6.15 Cross-screen contracts & the failure-state floor

Three invariants bind all twelve screens and keep the front-end honest against the shipped constraints:

1. **The world is never a black void.** Every full screen composites over the attract dolly or a frozen RUN frame; the only truly opaque surface is the BOOT curtain, and it exists solely to hide the shader-compile storm `main.js` already pays. This costs **zero draws** — the attract camera reuses frozen shadow maps and static lights, staying inside the ~988-draw worst-view budget on the Intel-iGPU floor.

2. **Every screen degrades, never breaks.** All persistence is versioned `localStorage` (`gd3d.v1`); every read is wrapped so a `JSON.parse` failure or version mismatch falls back to defaults, preserves the bad blob as `gd3d.corrupt.<ts>`, and surfaces one quiet toast. No screen can hard-fail from missing data — worst case is a defaults view, because the game is stateless between runs by design.

3. **Back is always defined and cheap.** Esc / gamepad B / the ‹ chevron resolves on every screen to exactly one predecessor per the §6.2 edge table; overlays close to their opener; PAUSE resumes. There is never a dead unlock — pointer-lock loss routes into PAUSE, tab-out auto-pauses and returns to PAUSE, and the fallback drag-look path (already shipped) guarantees the game keeps playing even where pointer-lock is denied. Boot-to-playing stays ≤1 gesture after load, and results-to-next-run stays one key (`R`), honoring the zero-friction-restart pillar (Ch. 1).



# Chapter 7 — HUD — Final Specification

This chapter is the authoritative build sheet for every pixel of on-screen furniture in *Grocery Dash 3D*. It documents the **shipped** HUD exactly as it exists in `index.html`, `src/game.js`, and `src/physics.js`, then specifies the **additive** elements the design calls for — each one gated so it never violates the browser / no-backend / Intel-iGPU-floor constraints. Wherever this chapter adds an element, it extends the shipped DOM overlay; it never rewrites the render loop and never contradicts shipped behavior (unlimited sprint, count-up timer, damage-at-checkout billing, single-dot crosshair, procedural barks). Cross-references: mode gating is Ch. 2, the 40 career shifts that toggle HUD modules are Ch. 3, the score/economy the meters surface is Ch. 4, achievement/daily toasts are Ch. 5, the menu shell that hosts HUD settings is Ch. 6, input bindings are Ch. 8, game-feel timing is Ch. 9, first-run flow is Ch. 10, the accessibility switchboard is Ch. 11, the results banner's downstream stats screen is Ch. 12, bark text is Ch. 17, the audio those cues pair with is Ch. 18, HUD data schemas are Ch. 20, and the render/perf budget the HUD must fit inside is Ch. 21.

### 7.1 The HUD Contract & Layer Stack

The HUD is a **pure DOM overlay** — fixed-position `<div>`s over the WebGL `<canvas>`, never a second 3D pass. This is deliberate: DOM text is crisp at every DPR, costs zero draw calls against the ~988-draw worst view (Ch. 21), and is immune to the camera shake and head-bob applied to the 3D camera in `main.js` (`camera.position.y += shake*0.12` and `sin(bob)` bob never touch the overlay). Two elements are exceptions that live **in the 3D scene** because they must occlude and pulse with world geometry: the **aim glow** (a shared additive box, `0x9fdcff`, opacity `0.28`) and the **checkout ring** (`RingGeometry(0.5,0.68,40)`, emissive `0x35c46a`, opacity `0.85`, pulse `scale = 1 + sin(t*4)*0.08`). Those two are catalogued here for completeness but rendered by `game.js`/`store.js`, not the overlay.

The overlay is a strict painter's-order stack. Every element declares an explicit `z-index`; nothing relies on source order.

| Layer | z-index | Element(s) | Pointer events | Status |
|---|---|---|---|---|
| World feedback | 10 | `#vignette` | none | shipped |
| Primary HUD | 12 | `#list`, `#timer`, `#prompt`, `#crosshair`, `#hint`, `#compass`†, `#dmg`†, `#combo`†, `#stamina`†, `#minimap`† | none | mixed |
| Notifications | 13 | `#toast`, `#subtitle`† | none | mixed |
| Modal result | 14 | `#banner` | none | shipped |
| Boot | 30 | `#boot` | auto | shipped |
| Fatal error | 99 | injected `<pre>` | auto | shipped |

† = additive element specified in this chapter. All HUD layers set `pointer-events: none` except `#boot` (needs the "click to play" gesture) and the error `<pre>`. This guarantees the whole HUD is click-through so the pointer-lock capture in `main.js` (the document-level `click` handler that calls `controls.lock()`) is never intercepted.

### 7.2 Global Design Tokens

All shipped literals are hoisted into named tokens here. The shipped CSS uses raw `rgba()`; the production build promotes these to `:root` custom properties so the colorblind and reduced-HUD variants can reskin by swapping tokens, not selectors.

**Color tokens (ground truth extracted from `index.html`):**

| Token | Default value | Used by |
|---|---|---|
| `--bg-page` | `#0b0d10` | body backdrop |
| `--ink` | `#eef2f6` | all primary text |
| `--panel-78` | `rgba(10,14,18,.78)` | `#list`, `#timer` |
| `--panel-82` | `rgba(10,14,18,.82)` | `#prompt` |
| `--panel-85` | `rgba(10,14,18,.85)` | `#toast` |
| `--panel-90` | `rgba(10,14,18,.90)` | `#banner` |
| `--panel-70` | `rgba(10,14,18,.70)` | `#hint` |
| `--stroke-14` | `rgba(255,255,255,.14)` | `#list`, `#timer` border |
| `--stroke-16` | `rgba(255,255,255,.16)` | `#prompt`, `#toast` border |
| `--stroke-18` | `rgba(255,255,255,.18)` | `#banner` border |
| `--stroke-12` | `rgba(255,255,255,.12)` | `#hint` border |
| `--key-stroke` | `rgba(255,255,255,.50)` | keycap outline |
| `--go` | `#35c46a` | success, check ✓, ring, boot bar |
| `--go-lite` | `#8be0a4` | boot-bar gradient tail |
| `--warn` | `#e8907f` | damage line in banner/ticker |
| `--aim` | `#9fdcff` | 3D hover glow |
| `--xhair` | `rgba(255,255,255,.85)` | crosshair fill |
| `--xhair-shadow` | `rgba(0,0,0,.35)` | crosshair 2px ring |

**Typography** — single stack `-apple-system, "Segoe UI", Roboto, sans-serif`, no web fonts (offline-safe, zero network). Every size below is the shipped `@1080p` value and is multiplied by `--hud-scale` (§7.19).

| Element | Size (px) | Weight | Tracking | Notes |
|---|---|---|---|---|
| `#timer` | 22 | 700 | — | `font-variant-numeric: tabular-nums` |
| `#banner h2` | 22 | 700 | — | title row |
| `#banner .big` | 34 | 800 | — | final time |
| `#banner` base | 16 | 400 | — | body |
| `#banner .dim` | 13 | 400 | — | "Press R…" |
| `#list h3` | 11.5 | 600 | 1.4px | "SHOPPING LIST" |
| `#list .row` | 13.5 | 400 | — | item |
| `#list .chk` | 15 | 400 | — | ○ / ✓ glyph column |
| `#list .pr` | 12 | 400 | — | price, right-aligned |
| `#list .foot` | 11 | 400 | — | "N/6 · then CHECKOUT" |
| `#prompt` | 14.5 | 400 | — | context |
| `#prompt .key` | 12.5 | 700 | — | keycap |
| `#toast` | 14.5 | 600 | — | barks/notices |
| `#hint` | 13 | 400 | — | tutorial ribbon |
| `#boot h1` | 30 | 800 | 0.5px | wordmark |
| `#boot .msg` | 12.5 | 400 | 0.3px | loading state |
| `#subtitle`† | 15 | 500 | — | see §7.15 |
| `#compass`† | 12 | 700 | 0.6px | distance label |

**Global timing constants** (canonical; reuse everywhere):

| Constant | Value | Meaning |
|---|---|---|
| `T_FADE_FAST` | 250 ms | toast/subtitle opacity transition (`transition: opacity .25s`) |
| `T_FADE_UI` | 300 ms | hint fade (`.3s`) |
| `T_BOOT_FADE` | 600 ms | boot opacity fade |
| `T_BOOT_GONE` | 650 ms | boot `display:none` after fade |
| `T_TOAST_HOLD` | 2600 ms | toast visible window (`toastT = 2.6`) |
| `T_HINT_LOCK` | 6000 ms | hint auto-hide after boot |
| `T_HINT_FALLBACK` | 5000 ms | hint auto-hide in drag-look mode |
| `T_BANNER_LIST` | 1600 ms | "List complete" banner auto-hide |
| `T_BOOTBAR` | 300 ms | progress-bar width tween |
| `T_RING_PULSE` | `sin(t*4)` | checkout-ring breathe, ±8% scale |

### 7.3 Boot / Loading Screen (`#boot`) — shipped

**Anchor:** `position: fixed; inset: 0;` full-viewport, `z-index: 30`, flex column centered, `gap: 14px`. Background `radial-gradient(120% 90% at 50% 30%, #16202b, #090b0e)`.
**Contents:** wordmark `GROCERY DASH` + dimmed `3D` (`opacity .5; weight 500`); a **progress bar** exactly `260×5px`, `border-radius: 3px`, track `rgba(255,255,255,.12)`, fill `linear-gradient(90deg, #35c46a, #8be0a4)` whose width is driven by `LoadingManager.onProgress` → `Math.round(loaded/total*100)%` with a `300ms` width tween; and a status `.msg` line.
**State machine (exact strings, in order):** `Lighting…` → `Loading models…` → `Building store…` → `Preparing shaders…` (during `renderer.compile`) → `Ready`. On `Ready`: set `opacity:0` (600 ms fade), `display:none` at 650 ms, then reveal `#hint` for 6000 ms.
**Opacity states:** `1` (loading) → `0` (fade). **Scaling:** wordmark and bar scale with `--hud-scale`; bar width caps at `min(260px*scale, 44vw)`. **Ultrawide:** stays centered; gradient origin `50% 30%` unchanged. **Colorblind:** the green fill also renders a 2px inner tick pattern in CB mode so progress reads without hue. **Reduced-HUD:** identical (boot is pre-gameplay); `prefers-reduced-motion` removes the width tween (bar snaps).

### 7.4 Shopping List Card (`#list`) — shipped

**Anchor:** `left: 18px; top: 18px`, `z-index: 12`, `min-width: 210px`. Panel `--panel-78`, `border: 1px --stroke-14`, `border-radius: 12px`, `padding: 12px 14px`, `backdrop-filter: blur(4px)`.
**Structure (rebuilt by `renderList()` on every grab):**
- Header `<h3>SHOPPING LIST</h3>` (11.5px, tracking 1.4, opacity .65).
- Six `.row`s, one per list entry: `<span class="chk">○|✓</span> {name} <span class="pr">$X.XX</span>`. Unchecked chk opacity `.7`; price opacity `.5`.
- On completion a row gains `.ok`: whole row opacity `.48` + `line-through`; its `.chk` becomes `✓` at `--go` full opacity.
- Footer `.foot`: `"{got}/{total} · then CHECKOUT"` (11px, opacity .55, 1px top rule).

The list is always **6 items** (`genList()` draws 6 distinct specs from `stock.availableSpecs()`), each `need:1`. **Opacity states:** card is a constant `1`; per-row states are `1` (todo) / `.48` (done). **Show/hide:** visible whole session; there is no hidden state in Classic (Ch. 2 timed-blitz modes may collapse it — see reduced variant).
**At-sprint legibility:** the card is edge-anchored and unaffected by shake, but during sprint (`speed > 4.0`) the build adds `will-change: opacity` and bumps panel to `--panel-90`-equivalent (`+0.12` alpha) so it stays readable against motion-blurred aisles; `backdrop-filter` is dropped to `blur(2px)` while `tier==='panic'` to save fill.
**Scaling:** `min-width`, padding, and font all × `--hud-scale`; the card never exceeds `28vw` — on super-ultrawide it stays pinned at 18px from the true left edge (not the letterboxed edge). **Colorblind:** completion is already dual-encoded (strikethrough + ✓ glyph + opacity), so it is CB-safe without change; CB mode only recolors the ✓ from `--go` to `--go-cb` (`#4aa3ff`). **Reduced-HUD:** collapses to a compact single-line counter `⛏ {got}/6` (see §7.21) when "minimal HUD" is on, and always keeps the strikethrough encoding.

### 7.5 Timer (`#timer`) — shipped

**Anchor:** `right: 18px; top: 18px`, `z-index: 12`. Panel `--panel-78`, border `--stroke-14`, radius 12, `padding: 8px 16px`. **Type:** 22px / 700 / `tabular-nums` so digits never reflow. **Value:** a **count-up** clock — `time += dt` while `playing && !done`; formatted `fmt(t) = "{m}:{ss}"` with zero-padded seconds. It only rewrites the DOM when the integer second changes (`if (secs !== lastSec)`), so it costs one text mutation per second, not per frame. **This is authoritative: the game counts up, not down.** Modes that impose a cap (Ch. 2) render the same widget but drive it from a countdown source and add a color ramp (§below).
**Opacity states:** constant `1`. On checkout the value freezes (loop stops incrementing at `done`) and the same string appears enlarged in the banner's `.big`.
**Color ramp (mode-gated, additive):** in timed modes, ≥ `T_cap*0.75` → text `--warn`; final 10 s → text `--warn` + `1px` panel border pulse at 2 Hz; ≤ 3 s → 8px shake on the panel only (never the whole HUD).
**At-sprint legibility:** tabular-nums already prevents jitter; no damping needed. **Scaling:** font/padding × `--hud-scale`; pinned 18px from true right edge on ultrawide. **Colorblind:** the warn ramp is paired with a `⏱` glyph turning to `!` under 10 s so it reads without the salmon hue. **Reduced-HUD:** unchanged (timer is essential); the 2 Hz border pulse is disabled under `prefers-reduced-motion`.

### 7.6 Damage Ticker (`#dmg`) — additive

Shipped damages are billed silently (`damageTotal += spec.price*0.4; damageCount++`) and only revealed at checkout. The ticker surfaces that running number **live** so the risk of sprint-crashing reads in the moment — without changing the billing math.
**Anchor:** directly under the timer, `right: 18px; top: calc(18px + timerHeight + 6px)` (≈ top 64px @1080), `z-index: 12`, right-aligned. Panel `--panel-78`, border `--stroke-14`, radius 10, `padding: 4px 12px`. **Type:** 15px / 700 / tabular-nums, prefixed with a small cart glyph `🛒`.
**Value & format:** `🛒 ${damageTotal.toFixed(2)}` with a superscript `×{damageCount}`. Reads `world.physics.damage` each second on the same `lastSec` tick as the timer (zero extra per-frame cost).
**Opacity states:** `0` while `damageCount === 0` (no clutter on a clean run); fades to `1` (250 ms) on first damage; holds. **Show/hide triggers:** appears the frame `damageCount` first increments; on each increment it **flashes** — background lerps to `--warn` at alpha `.85` for 180 ms then eases back over 400 ms (`cubic-bezier(.2,.7,.3,1)`), and the number does a `+3px` translateY punch that settles in 220 ms. Never hidden again for the run.
**Color:** idle text `--ink`; flash tint `--warn`; sustained "big damage" state (> $20) keeps a persistent `--warn` left border (3px). **At-sprint legibility:** the flash is deliberately loud because damage happens during sprint; but the **punch animation is suppressed** while `shake > 0.4` (a crash already shakes the camera) so the two feedbacks don't stack into nausea — the color flash still fires. **Scaling:** × `--hud-scale`; tracks the timer's right edge on ultrawide. **Colorblind:** dual-encoded — the flash also briefly swaps `🛒`→`💥` and, in CB mode, tints `--warn-cb` (`#ffb000`). **Reduced-HUD:** hidden by default (non-essential); the number still appears in the results banner. `prefers-reduced-motion` removes the translateY punch, keeps a 250 ms cross-fade.

### 7.7 Compass / Objective Pointer (`#compass`) — additive

**Decision: ship it, on by default.** The store is 46×30 m with 40+ fixtures and mirrored merch/grocery halves; playtest-analogue reasoning says first-timers lose the aisle. The compass is a lightweight wayfinding needle, cheaper and less busy than a minimap (§7.14).
**Anchor:** a thin arc band hugging the crosshair — a `120px`-radius ring segment centered on screen center, but only the needle glyph is drawn: an equilateral triangle `14×14px` riding at screen-center + `96px` in the bearing direction, clamped to a rounded-rect "safe frame" inset 8% from each edge so it never hides behind the list/timer. `z-index: 12`.
**Target logic:** points at the **nearest still-needed list item's** world facing (from `stock` slot centroids) until the list completes, then snaps to `world.checkout` (`-7.65, 11.1`). Bearing = `atan2(target - camera.position)` projected against `camera` yaw. A `12px` distance label (`"12m"`, tabular) trails the needle by 16px.
**Colors:** needle `--go` when aimed at checkout, `--aim` (`#9fdcff`) when aimed at an item, at `.9` opacity with a 2px `--xhair-shadow` outline for contrast over bright shelves. **Opacity states:** `.9` active; fades to `0` (250 ms) when the target is within the crosshair's `±14°` cone (you're already looking at it — the prompt takes over) and when `#banner` is open.
**Show/hide:** on once `playing`; off during banner and during the first 4 s of a run if the target is the spawn-adjacent aisle. **At-sprint legibility (motion damping):** the needle is **critically damped** — it eases toward the true bearing with `lerp(current, target, 1 - exp(-8*dt))` so it never whips during fast mouse turns or sprint; while `shake > 0` the ease constant halves to `4` for extra steadiness. **Scaling:** the 96px orbit radius and glyph × `--hud-scale`; on ultrawide the 8% safe frame keeps it near center, not the far corners. **Colorblind:** never relies on hue alone — item vs checkout is also encoded by glyph (`▲` item / `⚑` checkout). **Reduced-HUD:** replaced by an even simpler **edge chevron** (a single `>` on whichever screen edge the target lies past) or fully off if "no wayfinding" is selected in Ch. 11.

### 7.8 Context Prompt (`#prompt`) — shipped

**Anchor:** `left: 50%; bottom: 84px; transform: translateX(-50%)`, `z-index: 12`, `display: none` by default. Panel `--panel-82`, border `--stroke-16`, radius 10, `padding: 9px 16px`, 14.5px.
**Three exact content states (from `game.js update()`):**
1. **Hover a grabbable:** `<b>{name}</b> · ${price} — <span class="key">E</span> take`. The `.key` renders a keycap: `border: 1px --key-stroke; border-radius: 5px; padding: 0 7px; weight 700; 12.5px`.
2. **At checkout, list incomplete** (`dist(camera, checkout) < 2.2` and `!listDone`): `Finish your list first — {got}/{total}`.
3. **At checkout, list complete:** the prompt is suppressed because `complete()` fires immediately (the banner replaces it).
Otherwise `display: none`.
**Show/hide triggers:** shown when `hover !== null` **or** near-checkout; hidden when `!locked` (pointer released) and when `done`. Transition is instantaneous (display toggle) — no fade, matching shipped snappiness; the production build adds an optional 120 ms opacity fade behind a "smooth prompts" toggle (default off, to preserve feel).
**Keycap remapping:** the `E` glyph is bound to the current grab key (Ch. 8) — if rebound, the keycap text updates. **At-sprint legibility:** anchored low-center where the eye tracks during motion; panel alpha bumps `+0.08` while sprinting. **Scaling:** × `--hud-scale`; centered content caps at `max-width: 620px*scale` so long product names wrap rather than span an ultrawide. **Colorblind:** no hue dependence (text only). **Reduced-HUD:** the price/name detail collapses to just `[E] take`; the checkout-incomplete string stays verbatim (it's guidance).

### 7.9 Crosshair States & Hit-Marker (`#crosshair`) — shipped dot, additive states

Shipped: a single `6×6px` white dot (`--xhair`) with a 2px dark ring, `display: none` until `playing`, `z-index: 12`, centered via `margin: -3px 0 0 -3px`. The production build keeps the exact idle dot and adds four states by animating the same element (no new nodes):

| State | Trigger | Visual | Timing |
|---|---|---|---|
| **Idle** | playing, no valid target | 6px dot, `--xhair` @ .85 | — |
| **Hover** | `hover !== null` (a grabbable in reach) | dot shrinks to 4px, four 5px ticks fan out to an 18px box tinted `--aim` | ease 120 ms |
| **Out-of-reach** | raycast hits a product but `dist > REACH (2.7 m)` | dot dims to .45, ticks stay retracted, small `↔` under-glyph | 100 ms |
| **Checkout-ready** | `listDone && nearCheckout` | ring tints `--go`, gentle 2 Hz breathe (±1px) | continuous |
| **Grab confirm (hit-marker)** | `tryGrab()` succeeds | the four ticks snap **outward** to 26px then collapse to the dot; a `--go` ring flashes; paired with `SFX.grab()` (520 Hz→800 Hz triangle) and, if a list entry ticked, `SFX.tick()` (880 Hz square) | 260 ms total |

The **hit-marker** is the grab-confirm expansion — the arcade equivalent of a shooter's X. A second confirm cue fires when the grabbed item satisfies a list slot: the corresponding list row plays its strikethrough transition in the same 260 ms window, tying the reticle event to the objective. **Crash "anti-hit-marker":** when a sprint-crash tips a gondola, the crosshair briefly flashes `--warn` (140 ms) alongside the camera shake and `SFX.crash()`, signalling "that cost you."
**Opacity:** `0`/`display:none` before play; `.85` idle; `.45` out-of-reach. **At-sprint legibility:** the hover fan-out is **suppressed above 4.5 m/s** (you can't reliably grab mid-sprint anyway) — only the idle dot shows, keeping the center clean during motion. **Scaling:** all radii × `--hud-scale`, but the dot has a **1.0px floor** and never drops below 4px physical so it survives 720p; on 4K it scales to ~11px. **Colorblind:** every state is shape-coded (tick geometry) as well as hue-coded; CB mode maps hover→`--aim` unchanged (blue is safe) and grab/crash confirm to `--go-cb`/`--warn-cb`. **Reduced-HUD:** the animated states can be disabled to a static two-color dot (white idle / green when a grab is available), no motion — the recommended setting under `prefers-reduced-motion`.

### 7.10 Result Banner (`#banner`) — shipped

**Anchor:** `left: 50%; top: 38%; transform: translate(-50%,-50%)`, `z-index: 14`, `display: none`, `text-align: center`. Panel `--panel-90`, border `--stroke-18`, `border-radius: 16px`, `padding: 22px 34px`, base 16px. `h2` 22px; `.big` 34/800; `.dim` opacity .55/13px.
**Two content payloads:**
1. **List-complete toast-banner** (auto-hides after `T_BANNER_LIST` = 1600 ms): `✓ List complete — head to CHECKOUT`.
2. **Checkout results** (persistent until `R`): `<h2>🛒 Checked out!</h2>` + `{n} items · ${total}` + conditional damage line `Store damages: {count} items · ${total} 😬` colored `--warn` (`#e8907f`) shown only if `damageCount > 0` + `.big` final time + `.dim` `Press R for a new list`.
**Show/hide:** shown by `banner()`/`complete()`; the results payload is dismissed by `R` (`reset()`), which regenerates the list, hides the ring, and clears the banner. **Opacity:** hard toggle (shipped). Production adds a 200 ms scale-in (`scale .96→1`) behind the "smooth prompts" flag; default off. **At-sprint legibility:** irrelevant — the banner appears at checkout where the player is stationary; but the underlying `#vignette` deepens to `.5` while the results banner is open to focus attention. **Scaling:** whole card × `--hud-scale`, `max-width: 560px*scale`; on ultrawide it stays centered on true screen center. **Colorblind:** the damage line is dual-encoded (😬 emoji + word "damages") so it reads without the salmon hue; CB mode swaps to `--warn-cb`. **Reduced-HUD:** unchanged (results are essential); this banner is the handoff to the Ch. 12 stats screen.

### 7.11 Toast / Bark Channel (`#toast`) — shipped

**Ground truth correction:** the toast is **live**, created in `physics.js` (`document.createElement('div'); id='toast'; appendChild(body)`), styled by the `#toast` rule in `index.html`. **Anchor:** `left: 50%; top: 64px; transform: translateX(-50%)`, `z-index: 13`, 14.5px/600, panel `--panel-85`, border `--stroke-16`, radius 10, `padding: 8px 16px`, `opacity: 0`, `transition: opacity .25s`, `pointer-events: none`.
**Show/hide:** `toast(msg)` sets text + `opacity:1` + `toastT = 2.6`; the physics `update()` counts `toastT` down and sets `opacity:0` when it hits zero → a 250 ms fade. Only one toast at a time (new calls replace text and reset the 2.6 s hold).
**Complete message inventory (verbatim, from `physics.js`):**
- **Gondola tip:** `📢 CLEANUP ON AISLE {label} — ALL OF IT.` where `{label}` ∈ `{6,7,8}` (the two merch islands and the toys island carry labels).
- **Cart tip (CRASH_LINES, random):** `🛒 CRUNCH.` · `🛒 That's coming out of your deposit.` · `🛒 Cart casualty.`
- **Item knocked off shelf (40% chance):** `Whoops — that's going on your bill.`
- **NPC bump (BUMP_LINES, random):** `"Hey, watch it!"` · `"Excuse YOU."` · `"Seriously?!"` · `"Ow! My cart!"` · `"Careful, buddy!"`
**Opacity states:** `0` idle / `1` shown / fade. **At-sprint legibility:** these fire *because* of sprint collisions; the 64px-top anchor sits above the crosshair action zone so it doesn't obscure aiming; while `shake > 0.4` the toast holds an extra 400 ms (`toastT` floor of 1.0 on refresh) so a violent crash's message survives the shake. **Scaling:** × `--hud-scale`, `max-width: 440px*scale` centered. **Colorblind:** text + emoji only, hue-independent. **Reduced-HUD:** kept (barks are diegetic character), but `prefers-reduced-motion` swaps the fade for an instant show/hide, and a "quiet HUD" option caps barks to crash/gondola events (drops NPC bump chatter).

### 7.12 Combo / Heat Meter (`#combo`) — additive

Feeds the Ch. 4 economy: rapid, damage-free grabs build a **Rush** multiplier that scores clean, fast shopping. Purely additive — Classic mode (Ch. 2) can hide it; it never gates the shipped loop.
**Anchor:** bottom-center, `left: 50%; bottom: 128px; transform: translateX(-50%)` (just above the prompt band), `z-index: 12`. A `180×10px` pill: track `rgba(255,255,255,.12)`, fill `linear-gradient(90deg,#35c46a,#8be0a4)` (reuses boot-bar greens), radius 5, with a `×N` multiplier label (16px/800) riding above the right end.
**Model (exact):** each grab within `4.0 s` of the previous adds `+0.34` to a `heat` value clamped `[0,3.0]`; the multiplier is `1 + floor(heat)` (×1→×4). Heat **decays** at `0.5/s` while idle and **drops to 0 instantly** on any damage event (`damageCount` increment) — one crash breaks the streak. The fill width = `heat/3.0`.
**Colors:** fill greens while building; when `heat ≥ 2.0` the pill gains a `--go-lite` glow (`box-shadow: 0 0 12px rgba(139,224,164,.5)`); on break it flashes `--warn` and empties over 300 ms. **Opacity states:** `0` at `heat==0` (fades in over 200 ms on first grab); `1` while hot; fades to `0` 600 ms after fully decayed. **Show/hide:** mode-gated (`config.combo`); default **on in Rush/career modes, off in Classic**. **At-sprint legibility:** the fill uses `transform: scaleX()` (GPU-composited) not width, so it's smooth during motion; the `×N` label uses tabular digits and does **not** animate position, only value, so it stays legible while running. **Scaling:** pill length × `--hud-scale`, floored at 120px so it reads at 720p, capped at 320px on 4K; centered on ultrawide. **Colorblind:** multiplier is a **number**, not a color, so the core signal is CB-safe; the break flash adds a `✕` glyph over the pill in CB mode with `--warn-cb`. **Reduced-HUD:** hidden by default; when kept, shows only the `×N` number with no bar and no glow.

### 7.13 Sprint Stamina (`#stamina`) — decision & spec

**Decision: no persistent stamina drain in Classic. Sprint stays unlimited, exactly as shipped** (`SPEED_RUN = 4.9` on Shift with no cost in `main.js`). Adding a global stamina gate would fight the core "GTA-in-a-grocery" power fantasy the game is built on and would silently change shipped movement. Instead, stamina is an **opt-in module** enabled only by specific career shifts / modes (Ch. 3, e.g. an "aching feet" modifier) and a few timed challenges. When those enable it, the meter is fully specified below so it drops in without redesign.
**Anchor (only when active):** bottom-center under the crosshair, `left: 50%; bottom: 96px`, `z-index: 12`. A `140×6px` bar, track `rgba(255,255,255,.12)`, fill `--go`, radius 3.
**Model:** `stamina ∈ [0,1]`, starts 1. Sprinting drains `0.14/s`; walking/idle recovers `0.22/s` after a `0.8 s` regen delay. At `stamina == 0`, sprint is clamped to walk (`SPEED_WALK`) until it recovers past `0.25` (hysteresis prevents stutter). **Colors:** fill `--go` > .5, `--warn`-lerp below .3, empty pulses `--warn` at 3 Hz. **Opacity:** `0` when full and not sprinting (invisible until relevant); fades to `1` within 200 ms of first drain; fades out 1 s after full recovery. **Show/hide:** entirely gated by `config.stamina`; **default false**. **At-sprint legibility:** it is *the* sprint element, so it uses `scaleX` compositing and no positional animation; the empty-pulse is the only motion and it's disabled under reduced-motion (replaced by a static red bar + `!` glyph). **Scaling:** × `--hud-scale`, floor 110px. **Colorblind:** low state dual-encoded with a boot/foot `👟` glyph turning `!` and `--warn-cb`. **Reduced-HUD:** shown as a thin edge line under the crosshair with no animation, or off.

### 7.14 Minimap (`#minimap`) — decision & spec

**Decision: no always-on minimap; ship a toggle-able 2D store map instead, default off.** Justifications, in order of weight: (1) **iGPU floor** — a live minimap implies either a second camera render (doubles the ~988-draw worst view, unacceptable on Intel integrated) or an expensive render-to-texture; neither fits Ch. 21's budget. (2) **Design** — the compass (§7.7) already solves "where's my item?" with zero render cost, and the intended texture is *getting lost in the aisles*, which a constant map erodes. (3) **Clutter** — the top-left is the list, top-right the timer/damage; a persistent map has no clean home on ultrawide without fighting them.
**What ships instead:** a **static 2D schematic** drawn once to an offscreen `<canvas>` from the known fixture rectangles (all collider `minX/maxX/minZ/maxZ` from `store.js` are compile-time constants), toggled by **hold-Tab** (or a dedicated map key, Ch. 8). It costs one canvas blit, no 3D re-render, so it honors the floor.
**Anchor (overlay, while held):** centered modal, `min(60vw, 720px) × auto`, `z-index: 13`, panel `--panel-90`, border `--stroke-18`, radius 14. Draws: store outline (46×30 scaled), fixture blocks (`rgba(255,255,255,.14)`), checkout lanes (green outline), the **player** as a `--aim` triangle at `camera.position` with a heading wedge, needed items as `--go` dots, checkout ring as a `--go` ⚑. Updated only while held, at 10 Hz (not per-frame).
**Opacity:** `0`/hidden; fades to `1` in 150 ms on hold. **Show/hide:** press-and-hold; releases hide it; auto-hides if held > 6 s (anti-AFK). **At-sprint legibility:** holding the map **does not pause** but the player marker is critically damped like the compass; you can't sprint-read it, which is intended. **Scaling:** the whole canvas × `--hud-scale`; the schematic is vector-derived so it's crisp at 4K. **Colorblind:** player/item/checkout are shape-coded (△ / ● / ⚑) as well as hued. **Reduced-HUD:** the map is already opt-in; under reduced-motion the fade is removed. A high-contrast map skin (Ch. 11) swaps fixtures to solid `--ink` outlines on black.

### 7.15 Subtitle Line (`#subtitle`) — additive

The toast carries *event* barks; the subtitle carries **spoken NPC dialogue** (Ch. 17) and **audio-cue captions** for accessibility, because the game ships procedural SFX and *no voice files* — captions make the barks and stingers legible to deaf/HoH players (Ch. 11) and satisfy WCAG 1.2.
**Anchor:** `left: 50%; bottom: 56px; transform: translateX(-50%)`, `z-index: 13`, centered, `max-width: 60ch`. Text 15px/500, `--ink`, on a `rgba(0,0,0,.55)` pill, radius 8, `padding: 5px 12px`, `text-align: center`.
**Content model:** one line at a time; speaker prefix in `--go-lite` when a specific NPC speaks (`Shopper: "Excuse you."`), bracketed cue captions for non-speech (`[cart clatter]`, `[shelf crash]`, `[checkout chime]`) mapped 1:1 to the `SFX` calls (`grab/tick/listDone/checkout/error/thud/crash/clatter`). Hold time scales with length: `max(1500, chars*45) ms`, then 250 ms fade.
**Opacity:** `0` idle / `1` shown / fade. **Show/hide:** gated by `config.subtitles` (**default off**, on when captions enabled in Ch. 11). **At-sprint legibility:** anchored below the crosshair action zone; while `shake > 0` a `2px` black text-shadow thickens for contrast. **Scaling:** × `--hud-scale`, `max-width: 60ch` keeps line length readable on ultrawide (it does **not** stretch to full width). **Colorblind:** hue-independent (speaker color is decorative; the name text carries the meaning). **Reduced-HUD:** stays available (it *is* an accessibility feature); can be pinned larger (18px) and to two lines via the caption-size setting.

### 7.16 Tutorial Hints (`#hint`) — shipped

**Anchor:** `left: 50%; bottom: 34px; transform: translateX(-50%)`, `z-index: 12`, 13px, panel `--panel-70`, border `--stroke-12`, `border-radius: 20px` (pill), `padding: 8px 14px`, `opacity: 0`, `transition: opacity .3s`.
**Exact strings (context-dependent):**
- Pointer-lock path: `Click to play · WASD move · Shift sprint · E take item · M mute`.
- Fallback drag-look path (`enableFallback()`): `Drag to look · WASD move · E take item · M mute`.
**Timing:** after boot completes, `opacity → 1` and auto-hides after **6000 ms**; entering fallback shows it and hides after **5000 ms**; entering pointer-lock (`lock` event) sets `opacity → 0` immediately (you've started, hint gets out of the way).
**Additive contextual hints (production, gated by `config.tutorial`, default on for first 3 runs per Ch. 10):** one-shot hints that reuse this pill — `Aim at an item, press E` (first hover), `List done — follow the ⚑ to CHECKOUT` (on `listDone`), `Sprint into shelves at your own risk 😈` (first 8 s if never sprinted). Each shows once, 4 s, then never again (persisted in the Ch. 20 local profile, `localStorage` — no backend). **Opacity:** `0`/`1`/fade. **At-sprint legibility:** bottom-center, low priority; suppressed while a toast is up (they'd overlap). **Scaling:** × `--hud-scale`, `max-width: 92vw`. **Colorblind:** text/glyph only. **Reduced-HUD:** the base control hint always shows once regardless (it's how you learn to play); contextual extras respect the "no tutorial" toggle.

### 7.17 Vignette & Full-Screen Feedback (`#vignette`) — shipped

**Anchor:** `inset: 0`, `z-index: 10`, `pointer-events: none`. `background: radial-gradient(115% 90% at 50% 46%, transparent 62%, rgba(0,0,0,.32))`. It frames the play space and hides shadow-map seams at the periphery. **Additive dynamic states (opacity-multiplier on a wrapper, GPU-cheap):**

| Event | Vignette response | Timing |
|---|---|---|
| Results banner open | deepen edge alpha `.32 → .50` | 200 ms ease |
| Sprint-crash / gondola tip | brief `--warn` inner ring pulse | 220 ms |
| Low timer (timed modes, < 10 s) | `--warn` edge breathe 1 Hz | continuous |
| Combo `heat ≥ 2.0` | faint `--go-lite` edge lift | while hot |

**Colorblind:** the crash/low-timer tints are redundant with the crosshair flash and timer glyph, so removing hue still leaves the signal; CB mode uses `--warn-cb`. **Reduced-HUD / reduced-motion:** all dynamic vignette pulses disable; the static base gradient remains. **Scaling/ultrawide:** the radial origin `50% 46%` and 115%×90% extents are viewport-relative, so it adapts to any aspect automatically; on 32:9 the transparent core widens correctly.

### 7.18 At-Sprint Legibility & Motion Damping (global rules)

Because the 3D camera shakes (`shake*0.12`) and bobs (`sin(bob)*0.045` at sprint) while the DOM HUD does not, the risk is **relative-motion nausea** and text that's hard to fixate. Global damping rules, applied by a single `body.dataset.motion` flag set each frame from `playerVel` and `physics.shake`:

| Signal | Threshold | HUD response |
|---|---|---|
| `speed > 4.0` (sprinting) | Shift held & moving | panel alphas +0.08–0.12; crosshair hover fan-out suppressed above 4.5 m/s; compass ease constant 8→continues; combo/stamina use `scaleX` compositing only |
| `shake > 0.4` (post-crash) | after a crash | damage-ticker punch suppressed (color flash kept); toast hold extended +400 ms; subtitle text-shadow thickens 1→2px |
| `shake > 0` (any) | any impact | compass needle ease halves (8→4) for extra steadiness |
| `tier === 'panic'` | GPU degraded | `backdrop-filter` blur dropped list 4→2px, toast/prompt blur off; all decorative box-shadows removed |

No HUD element ever inherits camera shake — that separation is the single most important legibility rule, and it's free because the HUD is a sibling of the canvas, not a child.

### 7.19 Responsive Scaling: 720p → 4K + Ultrawide

All HUD sizing multiplies a single root variable `--hud-scale`, set in the existing `resize` handler in `main.js` via `document.documentElement.style.setProperty('--hud-scale', S)`. The driver is viewport height (HUD elements are edge/anchor-based, so height governs legibility). Piecewise, with a continuous CSS fallback `clamp(0.82, calc(100vh / 1080px), 1.75)`:

| Viewport | Height px | `--hud-scale` | Timer size | List min-w | Crosshair | Notes |
|---|---|---|---|---|---|---|
| 720p (1280×720) | 720 | **0.82** | 18.0px | 172px | 5px | floor; readable on laptops |
| 900p (1600×900) | 900 | **0.90** | 19.8px | 189px | 5px | |
| 1080p (1920×1080) | 1080 | **1.00** | 22.0px | 210px | 6px | reference / all shipped literals |
| 1440p (2560×1440) | 1440 | **1.18** | 26.0px | 248px | 7px | |
| 4K (3840×2160) | 2160 | **1.55** | 34.1px | 326px | 9px | HUD stays proportionate, not tiny |
| Cap | > 2160 | **1.75** | 38.5px | 368px | 11px | prevents 8K over-scale |
| Ultrawide (3440×1440) | 1440 | **1.18** | 26.0px | 248px | 7px | scaled by height, anchored to true edges |
| Super-UW (5120×1440) | 1440 | **1.18** | 26.0px | 248px | 7px | centered elements capped, corners hug true edges |

**Ultrawide-specific rules:** (a) edge-anchored elements (`#list`, `#timer`, `#dmg`) pin to the **true** left/right at 18px×scale, never the letterbox — on 32:9 the list and timer sit far apart, which is correct. (b) All **centered** elements (`#prompt`, `#banner`, `#toast`, `#subtitle`, `#combo`, compass orbit) apply a `max-width` and stay on the true screen center, so a 5120-wide display doesn't stretch a prompt to a meter of text. (c) A **TV action-safe inset** of 5% (`--safe: 5%`) is available (Ch. 11 toggle) that insets all anchors for overscan displays.

### 7.20 Colorblind-Safe Variants

The two load-bearing hues are `--go` (`#35c46a`, success) and `--warn` (`#e8907f`, damage) — a green/red-adjacent pairing that deuteranopes and protanopes can confuse. **Two defenses, always on:** (1) **every** status is dual-encoded with shape/glyph or text (✓/○ list checks, strikethrough, 🛒/💥 damage, ×N combo number, ▲/⚑ compass, △/●/⚑ map), so no state depends on color alone even in the default palette. (2) A **Colorblind palette** (Ch. 11 setting; single universal set, validated against deuter/protan/tritan) swaps tokens:

| Token | Default | CB value | Rationale |
|---|---|---|---|
| `--go` → `--go-cb` | `#35c46a` | `#4aa3ff` (blue) | max separation from warn on all three CVD types |
| `--go-lite` | `#8be0a4` | `#8fc4ff` | tint of the blue |
| `--warn` → `--warn-cb` | `#e8907f` | `#ffb000` (amber) | blue/amber is the CVD-robust pairing |
| `--aim` | `#9fdcff` | `#9fdcff` (unchanged) | already blue-safe |
| checkout ring (3D) | `#35c46a` | `#4aa3ff` | mirrors HUD token |

The CB palette is applied by toggling a `body.cb` class that rebinds the `:root` custom properties; because §7.2 hoisted every literal into tokens, no per-element CSS changes. Boot-bar and combo gradients recompute from the swapped tokens automatically.

### 7.21 Reduced-HUD Accessibility Variant

Selected via Ch. 11's "Minimal HUD" toggle and/or auto-adopted when the OS reports `prefers-reduced-motion`. It strips decoration to the three essentials and kills motion:

- **Kept, always:** `#list` (collapsed to a one-line `⛏ {got}/6` counter, or full list if "compact" not chosen), `#timer`, `#prompt` (collapsed to `[E] take` / checkout guidance), crosshair (static two-color dot), `#subtitle` (it *is* an accessibility feature; can be enlarged to 18px/two-line).
- **Hidden by default:** `#dmg` ticker, `#compass` (or downgraded to a single edge chevron), `#combo`, `#stamina`, `#minimap`, contextual tutorial extras, dynamic vignette pulses.
- **Motion policy under `prefers-reduced-motion`:** all fades become instant show/hide; boot bar snaps; timer border/vignette pulses off; crosshair states become static (white idle / green available); combo/stamina bars update value without tween; banner scale-in disabled.
- **Legibility boosts:** panel alphas raised to `.92` uniformly; minimum font floor of 14px physical (overrides the 0.82 scale at 720p); high-contrast skin option forces `--ink` `#ffffff` on solid `#000` panels with `--stroke` at `.6`.
- **Non-essential audio captions:** with subtitles on, the reduced-HUD still surfaces `[shelf crash]`, `[checkout chime]`, `[cart clatter]` so gameplay-critical audio is never color- or sound-only.

This variant is a token/flag reskin over the same DOM — no alternate markup — so it can toggle live mid-run.

### 7.22 ASCII Composite — Full HUD at 1080p (1920×1080)

Reference layout with real anchors. `☐` = crosshair center (960,540). Elements shown in their default-on state; opt-in modules (`combo`, `stamina`, `minimap`, `subtitle`) drawn dashed.

```
┌────────────────────────────────────────────────────────────────────────────┐ 0
│ ┌─────────────────────────┐                            ┌──────────────┐      │
│ │ SHOPPING LIST           │  (18,18)          (r18,18) │    2:14      │22px  │ ← #list top-left / #timer top-right
│ │ ○ Rustic Sourdough $4.29│                            └──────────────┘      │
│ │ ✓ G̶a̶l̶a̶ ̶A̶p̶p̶l̶e̶s̶     $1.79│                            ┌──────────────┐      │
│ │ ○ Oat Milk       $3.49  │                            │ 🛒 12.80 ×3  │      │ ← #dmg under timer (top~64)
│ │ ○ Cage Eggs      $5.99  │                            └──────────────┘      │
│ │ ○ Roma Tomatoes  $2.20  │                                                  │
│ │ ✓ P̶a̶p̶e̶r̶ ̶T̶o̶w̶e̶l̶s̶  $6.49│        ┌───────────────────────────┐ (top 64)  │
│ │ 2/6 · then CHECKOUT     │        │ 📢 CLEANUP ON AISLE 7 …   │ #toast     │
│ └─────────────────────────┘        └───────────────────────────┘            │
│                                                                              │
│                                     ▲ 12m   ← #compass needle (orbit r96)    │
│                                                                              │
│                         ┌───────────────────────────────┐ (top 38%)         │
│                         │        🛒 Checked out!         │  #banner (z14)    │ ← modal on checkout; hidden mid-run
│                         │       6 items · $24.25         │  (shown here for  │
│                         │  Store damages: 3 · $12.80 😬  │   completeness)   │
│                         │            2:14                │                   │
│                         │      Press R for a new list    │                   │
│                         └───────────────────────────────┘                   │
│                                       ☐  ← crosshair (960,540)               │
│                                                                              │
│                      ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐                       │
│                      ╎ Shopper: "Excuse you."          ╎ #subtitle(b56)      │ ← dashed = opt-in
│                      └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘                       │
│                      ╎▓▓▓▓▓▓▓░░░░░░░░░░╎ ×2   #combo (b128, dashed)          │
│              ┌──────────────────────────────────────────────┐               │
│              │ Gala Apples · $1.79 —  E  take               │ #prompt(b84)  │ ← context prompt
│              └──────────────────────────────────────────────┘               │
│                   ( · WASD move · Shift sprint · E take · M mute )  #hint    │ ← #hint (b34), fades after 6s
└────────────────────────────────────────────────────────────────────────────┘ 1079
   x=0                              x=960 (center)                      x=1919
```

Anchor cheat-sheet (px @1080, before `--hud-scale`): list (18,18); timer (right 18, top 18); dmg (right 18, top ~64); toast (center, top 64); compass needle (center + 96px bearing); banner (center, top 38%); crosshair (960,540); subtitle (center, bottom 56); combo (center, bottom 128); prompt (center, bottom 84); hint (center, bottom 34); stamina (center, bottom 96, only when active); minimap (centered modal, only while held).

### 7.23 Update Cadence & Performance Budget

The HUD must be invisible in the frame budget (Ch. 21 target: < 20 ms/frame to hold the high tier). Rules:

| Element | Write cadence | Cost |
|---|---|---|
| `#timer`, `#dmg` | once per integer second (`lastSec` guard) | 1–2 text mutations/s |
| `#list` | only on grab that ticks a slot (`renderList()`) | ≤ 6 innerHTML/run |
| `#prompt` | on hover/checkout-zone transition only (state-diffed) | rare |
| `#crosshair` states | CSS class toggle + transform (GPU) | no layout |
| `#compass` | per-frame transform (damped), no reflow | transform only |
| `#combo`/`#stamina` | per-frame `scaleX` (composited) | no layout |
| `#toast`/`#subtitle` | on event + one fade | trivial |
| `#banner` | on checkout / R | once |

Hard rules: **never** write `innerHTML` per frame; **never** animate `width`/`top`/`left` (use `transform`/`scaleX`); all continuous motion (compass, combo, stamina, ring) is `transform`/`opacity` so it stays on the compositor and off the main thread. Under `tier === 'panic'` the build drops `backdrop-filter` and box-shadows (§7.18) to reclaim fill on the weakest iGPUs.

### 7.24 Show/Hide State Machine — Master Summary

| Element | Appears when | Disappears when | Default |
|---|---|---|---|
| `#boot` | page load | `manager.onLoad` → 650 ms | shipped/on |
| `#hint` | boot done / fallback entered | 6 s (lock) / 5 s (fallback) / on `lock` | shipped/on |
| `#crosshair` | `playing` (lock or fallback) | `unlock` & !fallback | shipped/on |
| `#list` | always in-run | never (Classic) | shipped/on |
| `#timer` | always in-run | never | shipped/on |
| `#prompt` | hover ≠ null OR near-checkout | `!locked` OR `done` | shipped/on |
| `#banner` | `banner()`/`complete()` | R (results) / 1.6 s (list-done) | shipped/on |
| `#toast` | physics bark event | `toastT` → 0 (2.6 s + fade) | shipped/on |
| `#vignette` | always | never (static base) | shipped/on |
| `#dmg` | first `damageCount++` | never (stays for run) | additive/on |
| `#compass` | `playing`, target off-cone | banner open / target in cone | additive/on |
| `#combo` | first grab (if `config.combo`) | 600 ms after heat=0 | additive/mode |
| `#stamina` | first drain (if `config.stamina`) | 1 s after full recover | additive/off |
| `#minimap` | hold-Tab (map key) | release / 6 s cap | additive/off |
| `#subtitle` | dialogue/cue (if `config.subtitles`) | hold elapsed + fade | additive/off |

Everything in the "additive" rows attaches to the shipped overlay without touching `move()`, the render loop, or the billing math — the HUD grows by adding DOM siblings and CSS tokens, never by rewriting the systems Ch. 1–6 and Ch. 8–26 depend on.

---

**Source-of-truth files referenced (absolute paths):** `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\index.html` (all HUD DOM + CSS literals), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\game.js` (list/timer/prompt/banner/crosshair logic, `fmt`, checkout at `-7.65,11.1`, `REACH 2.7`), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\physics.js` (live `#toast`, bark inventories, `TIP_SPEED 4.0`, `KNOCK_SPEED 1.6`, damage `price*0.4`, `shake`), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\main.js` (`SPEED_WALK 3.1`/`SPEED_RUN 4.9`, pointer-lock+fallback, resize handler for `--hud-scale`, tier system), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\sfx.js` (cue→caption map), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\store.js` (checkout ring geometry/pulse, spawn/bounds, gondola labels 6/7/8).



# Chapter 8 — Input — Complete Specification

*Production Playbook — Chapter 8. Owns: every way a human tells the game what to do. This chapter is the contract between the three input devices (keyboard+mouse, gamepad, touch) and the simulation that `main.js` / `game.js` / `physics.js` already run. It extends the shipped input surface — pointer-lock mouse-look with a drag-look fallback, WASD+arrows movement, `E`/`R`/`M` verbs, `Shift` sprint — without contradicting any of it. Every constant below is either read directly from the shipped source or specified precisely enough to implement blind. Systems not yet in the build are tagged **[BUILD]**, matching the Part 0 convention; unmarked behavior is live today.*

Cross-references: mode-specific input overrides live in Ch. 2 (Zen zeroes sprint and shake; Escort disables sprint); the physics thresholds inputs must respect are Ch. 22; the HUD elements input drives/toggles are Ch. 7; haptics pair 1:1 with the audio cues in Ch. 18 and the juice channels in Ch. 9; accessibility remap/hold-toggle/invert/sensitivity/aim-assist obligations are Ch. 11; the Settings→Controls screen that hosts rebinding is Ch. 6; persistence of bindings is Ch. 20; the headless input-injection test battery is Ch. 23.

---

### 8.1 The shipped baseline (ground truth)

Everything in this chapter is built on the exact input code in `main.js` and `game.js`. These are the load-bearing constants; nothing later may silently change them.

| Constant | Value | Source | Meaning |
|---|---|---|---|
| `SPEED_WALK` | 3.1 m/s | `main.js` | Base ground speed |
| `SPEED_RUN` | 4.9 m/s | `main.js` | Sprint speed (also the aisle-tip threshold gate — sprint-only by design) |
| `R` / `PLAYER_R` | 0.34 m | `main.js`, `physics.js` | Player collision radius |
| Eye height | 1.65 m | `main.js` (`camera.position.y = 1.65 + bob`) | Camera base Y |
| Walk bob amp / rate | 0.03 m @ 10.5 rad/s | `main.js` | Head-bob when `SPEED ≤ 4` |
| Sprint bob amp / rate | 0.045 m @ 13.5 rad/s | `main.js` | Head-bob when `SPEED > 4` |
| `REACH` | 2.7 m | `game.js` (`ray.far`) | Grab raycast distance |
| Aim NDC | `(0,0)` | `game.js` (`_ndc`) | Ray always fired from dead screen-center |
| Grab fly duration | 0.4 s | `game.js` (`f.t + dt/0.4`) | Item lerp-to-basket time |
| Near-debris cull | √20 ≈ 4.472 m | `game.js` (`ddx²+ddz² < 20`) | Only floor debris this close is raycast |
| Checkout radius | 2.2 m | `game.js` (`distanceTo(world.checkout) < 2.2`) | Prompt/complete trigger ring |
| Checkout point | `(−7.65, 0, 11.1)` | `store.js` (`co.point`) | Where you finish |
| Spawn | `(0.6, 1.65, 13.2)` | `store.js` | Player start pose |
| World bounds | X ∈ [−22.55, 22.55], Z ∈ [−14.55, 14.5] | `store.js` (46×30 m) | Movement clamp |
| Drag-look sensitivity | 0.0042 rad/px | `main.js` | Fallback look, both axes |
| Pitch clamp | ±1.45 rad (±83.1°) | `main.js` | Fallback look vertical limit |
| Pointer-lock re-acquire probe | 350 ms | `main.js` | Timeout before assuming embed swallowed the lock |
| Euler order | `YXZ` | `main.js` (`camera.rotation.reorder`) | Yaw-then-pitch, roll forced to 0 |

The shipped build registers input in **two** places: `main.js` keeps a raw `keys[e.code]` boolean map (movement, sprint) updated on `keydown`/`keyup`; `game.js` adds a second `keydown` listener for the verbs `KeyE`→`tryGrab`, `KeyR`(when `done`)→`reset`, `KeyM`→`SFX.toggleMute`. Production **consolidates both into one router** (§8.2) that produces the identical effects, so nothing regresses, but there is a single place that owns edge/state semantics, buffering, rebinding, and device fan-in.

---

### 8.2 The Input Abstraction Layer (`input.js`) — API & semantics

We bind **devices → actions**, never devices → effects. The simulation asks the `Input` module for action state each frame; it never reads `KeyboardEvent` or `navigator.getGamepads()` directly. This is what makes three schemes, rebinding, and headless test injection all work through one seam.

**Action kinds.** Every action is exactly one kind, and its kind fixes how you read it:

| Kind | Reader | Semantics |
|---|---|---|
| `analog` | `Input.axis(name)` → number | Continuous. `MOVE_X/MOVE_Y` return −1..1 (already deadzoned/normalized). `LOOK_X/LOOK_Y` return **radians to apply this frame** (already sensitivity-scaled and, for sticks, rate×dt-integrated). |
| `state` | `Input.down(name)` → bool | Held. True every frame the action is active (`SPRINT`, `MAP_EXPAND`). |
| `edge` | `Input.pressed(name)` / `Input.released(name)` → bool | One-frame. `pressed` is true only on the frame of up→down; `released` on down→up (`INTERACT`, `NEW_LIST`, `PAUSE`, `MUTE`, `RESHELVE`, `HUD_HIDE`, `AIM_SNAP`, `MAP_TOGGLE`). |

**Edge lifecycle.** Edges are latched by the DOM/gamepad event handlers into a per-action record `{downFrame, upFrame, downTime, consumed}` and cleared at the **end** of each `animate()` tick after consumers have read them. `Input.pressed(a)` returns `downFrame === currentFrame && !consumed`. This guarantees an edge is observed on exactly one frame regardless of how many systems poll it, and never straddles a frame boundary.

**Buffering API.** `Input.buffered(name, windowMs)` returns true if the action was pressed within the last `windowMs` and not yet consumed; `Input.consume(name)` marks it consumed so it can't double-fire. This is how grab-buffering (§8.6) works without changing `tryGrab`.

**The frame contract.** `input.js` exposes one entry point, called once at the very top of the existing `animate()` in `main.js`, before `move(dt)`:

```
Input.poll(dt)          // 1. read pending DOM key/mouse/touch state + gamepad snapshot
                        // 2. compose analog axes (deadzone, curve, aim-assist magnetism)
                        // 3. resolve buffers, decay tap timers, integrate look rate
// … existing move(dt), physics.update, game.update … now read via Input.axis/down/pressed
Input.endFrame()        // clear one-frame edges, advance currentFrame
```

**The action registry** (the complete set — nothing else is an action):

| Action | Kind | Consumers |
|---|---|---|
| `MOVE_X` | analog −1..1 | `move()` strafe (`s`) |
| `MOVE_Y` | analog −1..1 | `move()` forward (`f`) |
| `LOOK_X` | analog (rad) | yaw |
| `LOOK_Y` | analog (rad) | pitch (clamped) |
| `SPRINT` | state | `move()` speed select |
| `INTERACT` | edge | `game.tryGrab()` / checkout confirm / touch TAKE |
| `RESHELVE` | edge | **[BUILD]** re-shelve nearest debris (Ch. 5 verb `Q`) |
| `NEW_LIST` | edge | `game.reset()` when `done`; else RESTART in Pause |
| `PAUSE` | edge | Pause overlay (Ch. 6) |
| `MUTE` | edge | `SFX.toggleMute()` |
| `MAP_TOGGLE` | edge | show/hide minimap (Ch. 7) |
| `MAP_EXPAND` | state | hold to render minimap at 2× |
| `HUD_HIDE` | edge | photo mode, toggles `--hud-opacity` (Ch. 7) |
| `AIM_SNAP` | edge | gamepad/touch soft-snap to nearest in-reach grabbable (§8.10) |
| `OBJECTIVES` | edge | expand objective/star panel (Ch. 12) |
| `TUTORIAL_REPLAY` | edge (menu) | re-run onboarding beats (Ch. 10) |

Analog actions are **always available** to any device: a keyboard synthesizes `MOVE_X/Y` from digital keys (§8.4), a stick feeds them directly (§8.9), touch feeds them from the virtual stick (§8.12). Consumers never branch on device.

---

### 8.3 Look math — one pipeline, three feeds

All three schemes converge on the same two output values, `LOOK_X` (Δyaw, rad) and `LOOK_Y` (Δpitch, rad), applied identically:

```
camera.rotation.y -= LOOK_X
camera.rotation.x  = clamp(camera.rotation.x - LOOK_Y, -1.45, 1.45)   // ±83.1°
camera.rotation.z  = 0                                                // roll always killed
```

with `camera.rotation.reorder('YXZ')` (shipped). The three feeds differ only in how they produce those deltas:

| Feed | Formula | Notes |
|---|---|---|
| Pointer-lock mouse | `movementX * 0.002 * pointerSpeed`, `movementY * 0.002 * pointerSpeed` | PointerLockControls internal 0.002 rad/unit; `pointerSpeed` = the Settings sensitivity slider, default 1.0, range 0.25–3.0 |
| Drag-look fallback | `Δpx * 0.0042 * sens` | Shipped constant 0.0042 rad/px; `sens` = same slider |
| Gamepad right stick | `curve(stick) * lookRate * dt` | `lookRate` default 3.4 rad/s, range 1.5–6.0; curve in §8.9; rate×dt makes it frame-rate independent |
| Touch look drag | `Δpx * 0.0045 * sens` | Default 0.0045 rad/px (1.07× the drag base, thumbs get slightly more reach); tunable |

`Invert-Y` (Ch. 11) flips the sign of `LOOK_Y` at this stage for all feeds at once. Pointer-lock and drag-look are **delta** feeds (no per-frame integration — the browser already batched the movement). Stick is a **rate** feed (integrated by `dt`).

---

### 8.4 Keyboard + Mouse — complete binding table

Bindings are stored and matched by `KeyboardEvent.code` (physical position, layout-independent — AZERTY/QWERTZ get sane defaults and rebind cleanly). **Every** default binding, including debug:

| Action | Default code(s) | Kind | Behavior detail |
|---|---|---|---|
| Forward | `KeyW`, `ArrowUp` | → `MOVE_Y = +1` | Shipped |
| Back | `KeyS`, `ArrowDown` | → `MOVE_Y = −1` | Shipped |
| Strafe left | `KeyA`, `ArrowLeft` | → `MOVE_X = −1` | Shipped |
| Strafe right | `KeyD`, `ArrowRight` | → `MOVE_X = +1` | Shipped |
| Sprint | `ShiftLeft`, `ShiftRight` | `SPRINT` state | Hold by default; toggle option §8.6 |
| Look | Mouse move (pointer-lock) | `LOOK_X/Y` | Drag-look when unlocked (§8.7) |
| Take / Interact | `KeyE`, **`Mouse0`** (left-click) | `INTERACT` edge | Left-click is INTERACT **only while `playing`**; otherwise it is the pointer-lock acquire gesture (§8.7). Huge discoverability win — everyone clicks. |
| Re-shelve | `KeyQ` | `RESHELVE` edge | **[BUILD]** reverse-fly nearest debris back to a slot |
| New list / Continue | `KeyR` | `NEW_LIST` edge | Active only when `game.state.done` (shipped); in Pause = RESTART LIST |
| Pause | `Escape` | `PAUSE` edge | Lands on Pause overlay, not a dead unlock (§8.7) |
| Mute | `KeyM` | `MUTE` edge | `SFX.toggleMute()` (shipped) |
| Toggle minimap | `Tab` | `MAP_TOGGLE` edge | `preventDefault` to stop focus-jump; hold = `MAP_EXPAND` |
| Objectives | `Tab` (hold ≥ 250 ms) | `OBJECTIVES` | Tap = map toggle, hold = expand map + objective panel |
| Hide HUD (photo) | `KeyH` | `HUD_HIDE` edge | Cross-fades `--hud-opacity` 1↔0 over 200 ms |

**Debug bindings** ship behind a gate — active only when `localStorage.gd3d.debug === '1'` or the URL carries `?debug=1`. They extend, never replace, the shipped `window.__*` hooks (`__scene`, `__camera`, `__stock`, `__game`, `__physics`, `__keys`, `__tier`, `__setPlaying`, `__isFallback`). Complete debug set:

| Debug action | Code | Effect (drives an existing hook) |
|---|---|---|
| Toggle debug HUD | `Backquote` | FPS / draw-call / tri / `window.__tier` overlay on/off |
| Help / binding sheet | `F1` | Overlay listing all live bindings |
| Framebuffer-grid capture | `F2` | Runs the documented color-grid verification snapshot |
| Cycle quality tier | `F3` | `lite → high → panic → lite`, calls `applyHigh()` / panic path |
| Toggle NPC sim | `F4` | Freezes/thaws `__npcUpdate` (isolate player physics) |
| Spawn debris burst | `F6` | Fires `physics` `knockItems` at the aimed shelf (spill test) |
| Tip nearest gondola | `F7` | Forces `tipGondola` on the nearest island (aisle-tip test) |
| Teleport to checkout | `F8` | Sets `camera.position` to `(−7.65, 1.65, 11.1)` |
| Toggle wireframe | `F9` | Flips `material.wireframe` scene-wide |
| Dump profile JSON | `F10` | `console.log(JSON.stringify(profile))` (Ch. 20 blob) |
| Reset run | `Digit0` | `game.reset()` regardless of `done` |
| Prev / next mode | `BracketLeft` / `BracketRight` | Cycle the Ch. 2 ruleset without leaving RUN |

Debug keys are excluded from the rebinder and never persist to the player binding blob. `F5`/`F11`/`F12` are deliberately **unbound** (browser reload / fullscreen / devtools stay native).

---

### 8.5 Rebinding UX & conflict rules

Rebinding lives in Settings → Controls (Ch. 6) and writes to `localStorage.gd3d.binds` (schema in Ch. 20). The rules are exact so two implementers produce the same behavior.

**Capture flow.** Each rebindable action is a row: `[ Action label ] [ current binding chip ] [ ✎ ]`. Clicking the chip or `✎` puts that row into **capture**: the chip reads "Press a key…", a 5 s countdown ring runs, and the next `keydown` (or `mousedown` for mouse buttons) is captured. `Escape` cancels capture (does not rebind Pause). Capture ignores pure modifier presses on their own (a lone `ShiftLeft` down with no other key is treated as the Sprint candidate only if Sprint is the row being bound; otherwise it waits for a non-modifier).

**Conflict rules (evaluated in this order):**
1. **Reserved keys** — `F5`, `F11`, `F12`, and (while `?debug` off) the debug set cannot be bound; capture rejects them with an inline shake + "Reserved."
2. **Duplicate within scheme** — if the captured code already binds another action, show an amber inline warning: *"`E` is also Take — reassign?"* with **Swap** / **Cancel**. **Swap** moves the old action to *unbound* (not to the new action's old key) and requires the player to bind it before leaving the screen (its row glows red, "Unbound"). **Cancel** aborts.
3. **Two-slot actions** — movement actions accept up to **2** codes each (the shipped `KeyW`+`ArrowUp` pattern). Binding a 3rd evicts the oldest slot (FIFO) with a toast.
4. **Alias-protected** — `INTERACT` may keep `Mouse0` as a permanent alias even after `KeyE` is rebound; the mouse alias is a checkbox ("Left-click to take"), not a slot, so it never conflicts with look-acquire.
5. **Leaving with an unbound required action** (`MOVE_*`, `LOOK` device, `INTERACT`, `PAUSE`) is blocked — the "Back" button disables until every required row has ≥1 binding.

**Reset to defaults** restores the §8.4 table wholesale (one confirm). Bindings are per-scheme: KB+M, gamepad, and touch each have an independent blob so remapping a stick never disturbs the keyboard. A **profile version** integer lets a future default change migrate old blobs (unknown actions dropped, missing actions filled from defaults).

---

### 8.6 Input buffering & timing windows

Arcade legibility at `SPEED_RUN = 4.9 m/s` demands forgiving timing. All windows are concrete.

**Grab pre-buffer.** `tryGrab()` today requires `hover` to be non-null at the instant `E` fires. That punishes a player who presses a few ms before the center-ray settles on a fast strafe. Extension: on `INTERACT` edge with no current `hover`, latch the press for **130 ms**. Each frame within the window, if `game.update` produces a `hover`, immediately run `tryGrab()` and `Input.consume('INTERACT')`. If the window lapses with no hover, drop it (and, if aiming nothing at all, play `SFX.error` + the 30 ms error haptic §8.11). This never lets you grab something you weren't aiming at — the ray still decides the target; it only tolerates the human pressing slightly early. Worked example: at 4.9 m/s a shelf facing subtends the crosshair for ~90–160 ms during a strafe-by; the 130 ms buffer converts a "just missed" into a clean grab without ever double-grabbing (the consume guard).

**Grab re-fire lockout.** After a successful `tryGrab`, `INTERACT` is soft-locked for **90 ms** so a held/mashed `E` (or a click that also arms look-acquire) can't strip two facings in one flick. The 90 ms is below human double-tap cadence yet above one frame at 30 fps (33.3 ms), so it never eats an intended second grab.

**Left-click disambiguation.** A `Mouse0` down while `!playing` is *pointer-lock acquire* and is never routed to `INTERACT`. A `Mouse0` down while `playing` is `INTERACT`. The transition frame (the click that both re-locks after an unlock and might be read as a grab) is resolved by a **160 ms** guard after any `lock`/fallback-enable event during which `Mouse0` is ignored for `INTERACT`. This is exactly the case the shipped comment warns about ("click is also the pointer-lock re-acquire gesture").

**Sprint: hold vs. toggle.**
- **HOLD (default, shipped):** `SPRINT` state = `ShiftLeft || ShiftRight` physically down, evaluated every frame. Zero latency, matches `main.js`.
- **TOGGLE (Settings option, Ch. 11):** each `Shift` **press** flips a latched `sprintOn`. Release does nothing. `sprintOn` auto-clears when `MOVE_X == 0 && MOVE_Y == 0` for **≥ 0.4 s** (so you never sprint-crash a shelf from a standstill after stopping). A press shorter than **200 ms** with movement held still toggles (there is no "tap = one-shot dash"; sprint is a sustained state only).
- **Gamepad "sprint tap" nuance:** because `LB`/`L1` is also a comfortable hold, the same HOLD/TOGGLE setting applies; in TOGGLE, a bumper tap under 200 ms flips `sprintOn`.

**Movement release smoothing.** On all `MOVE_*` release, `playerVel` decays via the shipped `multiplyScalar(max(0, 1 − 6·dt))` (≈ 0.37 retained after 150 ms). Input does not add extra smoothing — the physics already carries momentum into cart shoves and NPC bumps, which must stay honest for the Ch. 22 thresholds.

**Coyote / consequence note.** There is **no** input coyote-time on grabs (spatial, not platforming). The only lockouts that gate *outcomes* are physics-side: `crashCd` 0.45 s (gondola) / 0.5 s (soft) in `physics.js` debounces repeat crashes. Input must not try to defeat these; a sprint held into a shelf produces exactly one tip event per `crashCd`.

---

### 8.7 Pointer-lock lifecycle & drag-look fallback

The build **guarantees playability** in sandboxed iframes and embedded previews by falling back to drag-look when pointer-lock is refused. This is a hard invariant (Part 0). The full state machine, transitions exact from `main.js`:

**States:** `BOOT` (assets loading, `boot` visible) → `READY` (unlocked, awaiting first gesture) → `LOCKED` (`controls.isLocked`, `playing`) → `FALLBACK` (`fallbackLook`, `playing`) → `PAUSED` (overlay, `playing=false`, pointer released). Once `FALLBACK` is entered it is sticky for the session (an embed that refused once will refuse again).

| From | Trigger | To | Side-effects |
|---|---|---|---|
| BOOT | `LoadingManager.onLoad` → boot fades, `display:none` | READY | Hint "Click to play…" shown 6 s |
| READY | `click` (boot hidden, `!playing`) | attempt LOCK | `controls.lock()`; arm 350 ms probe |
| — | `lock` event fires | LOCKED | `playing=true`, `SFX.start()`, crosshair shown, hint hidden |
| — | `pointerlockerror` event | FALLBACK | `enableFallback()` |
| — | 350 ms probe: `!isLocked && !fallbackLook` | FALLBACK | embed swallowed the request silently → `enableFallback()` |
| READY | `controls.lock()` throws | FALLBACK | caught → `enableFallback()` |
| LOCKED | `unlock` event (Esc from browser, focus loss) | READY or PAUSED | if `!fallbackLook`: `playing=false`, crosshair hidden. Production routes this to **PAUSE** so an accidental unlock never reads as failure. |
| FALLBACK | `pointerdown` on canvas | FALLBACK (dragging) | `dragging=true`, record `lastX/lastY` |
| FALLBACK | `pointermove` while dragging | FALLBACK | apply Δ×0.0042 to yaw/pitch (§8.3), clamp pitch ±1.45, `rotation.z=0` |
| FALLBACK | `pointerup` (window) | FALLBACK | `dragging=false` |
| LOCKED/FALLBACK | `PAUSE` edge (`Esc`) | PAUSED | overlay up, pointer released, timer holds |
| PAUSED | RESUME | LOCKED (re-lock) / FALLBACK | re-acquire per original path |

**`enableFallback()` exact effects (shipped):** guard `if (fallbackLook || controls.isLocked) return;` then `fallbackLook=true; playing=true; SFX.start();` show crosshair, set hint to `"Drag to look · WASD move · E take item · M mute"`, show 5 s. In fallback, `playing` stays true across pointer up/down so the world never pauses mid-drag.

**Why the two look feeds must both survive:** the embedded-preview fallback is *how the game guarantees it always plays* (Part 0). Any input refactor that breaks drag-look fails CI (Ch. 23 asserts `window.__isFallback()` produces a working look path headlessly).

---

### 8.8 Gamepad — Xbox & DualSense complete mapping

Polled every frame inside the existing `animate()` via `navigator.getGamepads()[i]` (first non-null pad with recent input wins; hot-swap in §8.13). No backend, no library. Standard mapping indices are assumed; a remap table (Ch. 20) handles non-standard pads. Complete binding, both families:

| Action | Xbox control (button index) | DualSense control (button index) | Kind |
|---|---|---|---|
| `MOVE_X/Y` | Left stick (axes 0,1) | Left stick (axes 0,1) | analog |
| `LOOK_X/Y` | Right stick (axes 2,3) | Right stick (axes 2,3) | analog (rate) |
| `SPRINT` | `LB` (4), hold | `L1` (4), hold | state (hold/toggle §8.6) |
| `INTERACT` / Take | `A` (0) | `Cross` (0) | edge |
| `AIM_SNAP` | `RB` (5) | `R1` (5) | edge |
| `NEW_LIST` / Continue | `A` (0) *(context: only when `done`/on Results)* | `Cross` (0) | edge |
| `RESHELVE` | `X` (2) | `Square` (2) | edge |
| `PAUSE` | `Menu`/Start (9) | `Options` (9) | edge |
| `MUTE` | `View`/Back (8) | `Create`/Share (8) | edge |
| `MAP_TOGGLE` | D-pad ↑ (12) | D-pad ↑ (12) | edge |
| `MAP_EXPAND` | D-pad ↑ hold | D-pad ↑ hold | state |
| `OBJECTIVES` | D-pad → (15) | D-pad → (15) | edge |
| `HUD_HIDE` | D-pad ↓ (13) | D-pad ↓ (13) | edge |
| Recenter pitch (level look) | `RS` click / L3+R3? → **`RS` click (11)** | `R3` click (11) | edge → eases pitch to 0 over 120 ms |
| (reserved) `B` / `Circle` (1) | Back / cancel in menus only | — | edge |
| (reserved) `Y` / `Triangle` (3) | — future | — | — |

Triggers `LT`/`RT` (`L2`/`R2`, buttons 6/7, analog-capable) are **unbound in RUN** (no aim-down-sights in a first-person grocery game) but reserved for menu quick-scroll. Sticks `L3` is unbound to avoid accidental sprint on stick-click; sprint is the bumper.

**Context reuse of the face button:** `A`/`Cross` is both `INTERACT` (in RUN) and `NEW_LIST`/Continue (when `game.state.done` and on the Results screen). This mirrors the keyboard where `E` grabs and `R` continues, but consolidates to the natural "confirm" button — the router picks the meaning from game state, so there is never ambiguity within a frame.

---

### 8.9 Stick processing — deadzone & response curves (worked)

Both sticks read raw axes in [−1, 1]. Processing is **radial** (per-stick magnitude), never per-axis, so diagonals aren't favored and there is no square-gate artifact.

**Deadzone (radial, both sticks):** `DZ = 0.18` (shipped intent from Part 2). Given raw `(x, y)`:

```
r   = min(1, hypot(x, y))
if r < DZ:  out = (0, 0)
else:       rescaled = (r − DZ) / (1 − DZ)          // remap so motion starts at 0 just past DZ
            out = (x/r, y/r) * rescaled              // preserve direction, apply magnitude
```

Worked: raw stick at half-tilt on X only, `(0.50, 0)` → `r=0.50`, `rescaled = (0.50−0.18)/0.82 = 0.390`. So `MOVE_X = 0.390`. At `(0.18, 0)` → exactly 0 (edge of deadzone). At full `(1,0)` → `rescaled = 1.0`.

**Move curve:** **linear** after deadzone (movement wants 1:1 predictability; `move()` normalizes the vector anyway, so any nonlinearity would only distort walk-vs-jog nuance we don't want). So `MOVE_X/Y = out` directly. Speed is still binary walk/sprint via `SPRINT`; partial stick tilt does **not** produce sub-walk speeds in the shipped model — a stick past deadzone yields full `SPEED_WALK` in that direction (consistent with keyboard). **[BUILD] optional** "analog walk" accessibility toggle scales `SPEED_WALK` by `min(1, |out| · 1.25)` for players who want to creep; off by default so it never changes the racing line.

**Look curve:** quadratic for fine aim (Part 2): after the same radial deadzone remap producing `out`, apply per-component `curve(v) = sign(v) · v²`, then `LOOK_X = curve(out.x) · lookRate · dt`, `LOOK_Y = curve(out.y) · lookRate · dt`.

Worked: right stick at `(0.60, 0)`, `lookRate = 3.4 rad/s`, `dt = 1/60`. Deadzone remap: `rescaled = (0.60−0.18)/0.82 = 0.512` → `out.x = 0.512`. Curve: `0.512² = 0.262`. `LOOK_X = 0.262 · 3.4 · 0.01667 = 0.01485 rad ≈ 0.85°` this frame → ~51°/s. At full deflection `(1,0)`: `curve=1`, `3.4·dt` → 3.4 rad/s ≈ 195°/s. The square curve means the inner half of the stick's throw covers only ~26% of turn rate — precise grocery-shelf aim near center, fast whip at the edge.

**Sprint look widening:** while `SPRINT` is down, multiply `lookRate` by **1.15** (you turn a touch faster at speed so corners stay makeable) — mirrors the head-bob/FOV energy of sprinting without a FOV change (FOV stays 62°, Ch. 21).

**Radial clamp:** magnitude is capped at 1.0 pre-curve so a mis-reporting pad (values > 1) can't produce super-turns.

---

### 8.10 Aim assist for grab targeting (cone geometry, worked)

Grabbing is spatial and the ray is fixed at screen-center (`_ndc = (0,0)`), so a stick needs help landing a facing at speed. Aim assist is **default ON for gamepad and touch, OFF for KB+M** (a mouse is already precise; forcing magnetism on it feels sticky). It is also an accessibility aid (Ch. 11) and can be forced on for any device.

Two mechanisms, both operating only on **grabbables within `REACH = 2.7 m`** — assist never reaches across the store, so it can't yank aim off a distant target you're lining up.

**1) Magnetism (friction) — continuous.** Each frame, after computing the raw `LOOK_X/Y`, find the in-reach grabbable whose direction makes the smallest angle `θ` with the camera forward (the same set `game.js` already raycasts, plus near-debris within √20 m). If `θ < 4°`, scale the applied look by `assist = lerp(0.6, 1.0, clamp(θ / 4°, 0, 1))`:
- `θ = 0°` → `assist = 0.6` (40% look-slow right on target — the crosshair "sticks")
- `θ = 2°` → `assist = 0.8`
- `θ ≥ 4°` → `assist = 1.0` (no effect)

Geometry check: at the far edge of reach (2.7 m), a 4° cone half-angle subtends a lateral radius of `2.7 · tan(4°) = 2.7 · 0.0699 = 0.189 m` — about the width of one large facing, so magnetism engages exactly when the crosshair is "basically on it." At a close 1.0 m the cone is only `1.0 · tan(4°) = 0.070 m`, appropriately tighter.

Magnetism scales look **velocity**, never position — it can slow you onto a target but never moves your aim on its own, so it's leaderboard-clean (a skilled stick player is never fighting a pull they didn't cause).

**2) Soft snap — discrete (`AIM_SNAP` = `RB`/`R1`/touch double-tap).** On the edge, among in-reach grabbables with `θ < 12°`, pick the minimum-`θ` target (tiebreak: nearest by distance). Ease camera yaw+pitch to center that target over **90 ms** with an ease-out cubic (`p = 1 − (1−t)³`). Snap is capped at 12° so it can only tidy an aim you already roughed in.

Geometry: 12° at reach → `2.7 · tan(12°) = 2.7 · 0.2126 = 0.574 m` lateral acquisition radius — a generous "grab that can" assist for a fast stick, still local. If no grabbable is within the 12° cone and reach, `AIM_SNAP` no-ops silently (no error sound — it's a hint, not a failed action). After a snap, the §8.6 grab pre-buffer means an `INTERACT` pressed during the 90 ms ease still lands the grab the instant the ray settles.

**Assist and Flow scoring (Ch. 4):** aim assist does not touch the Flow multiplier or the No-Look style bonus — those are evaluated on grab correctness and glow dwell, which assist doesn't influence. Documented here so Ch. 4 and Ch. 11 don't have to litigate fairness.

---

### 8.11 Haptics — complete cue table

Dual-rumble via `GamepadHapticActuator.playEffect('dual-rumble', {...})`, gracefully no-op where unsupported (feature-detect `pad.vibrationActuator`; DualSense over USB/BT in Chromium supports it, most Xbox pads support it, all others silently skip). Every intensity is `0.0–1.0`; `weakMagnitude` drives the light/high-frequency motor, `strongMagnitude` the heavy/low motor. Each cue fires from the **same event that fires its SFX** (Ch. 18) so audio and rumble are frame-locked. Every event enumerated — nothing implicit:

| # | Event (source) | SFX (Ch. 18) | duration | weak | strong | shape |
|---|---|---|---|---|---|---|
| 1 | Hover grabbable onset (`setHover` non-null) | — | 12 ms | 0.08 | 0.00 | tiny detent; **off by default**, toggle in Ch. 11 |
| 2 | Grab item (`tryGrab` success) | `grab` | 40 ms | 0.25 | 0.00 | single soft |
| 3 | List item satisfied (`entry.got++`) | `tick` | 40 ms | 0.30 | 0.00 | crisp tick |
| 4 | List complete (`listDone` branch) | `listDone` | 2× 60 ms, 80 ms gap | 0.00 | 0.50 | double thump |
| 5 | Soft wall contact `<1.6 m/s` (`onPlayerBlocked`, `addShake 0.18`) | `thud` | 90 ms | 0.25 | 0.30 | bump |
| 6 | Shelf-knock `≥1.6 m/s` (`knockItems`, `addShake 0.3`) | `thud`+`clatter` | 120 ms | 0.40 | 0.50 | jolt |
| 7 | **Sprint-crash aisle tip `≥4.0 m/s`** (`tipGondola`, `addShake 0.9`) | `crash` | 350 ms as 5× 70 ms | ramp 0.90→0.20 | ramp 0.90→0.20 | the money moment; both motors, descending (playEffect can't ramp, so sequence 5 pulses `strong/weak` = .90,.72,.55,.37,.20) |
| 8 | Checkout complete (`complete()`) | `checkout` | 4× 55 ms @ 90 ms spacing | 0.20,0.25,0.30,0.40 | 0.30,0.40,0.50,0.60 | ascending, matched to the 523/659/784/1046 Hz arpeggio |
| 9 | Damage billed (each `spawnDebris`) | (via 6/7) | 30 ms | 0.00 | 0.60 | sharp "nick" — you *feel* the bill; throttled to ≤1 per 80 ms during a big spill so a 56-item tip doesn't machine-gun |
| 10 | Cart shove hard (`rel > 2.4`) | `thud` | 90 ms | 0.40 | 0.30 | push |
| 11 | Cart tipped / casualty (`vn > 2.6`) | `crash` | 200 ms | 0.30 | 0.60 | heavy |
| 12 | Cart-cart clack (`rel > 1.5`) | `clatter` | 3× 25 ms @ 0/60/130 ms | 0.20 | 0.00 | rattle |
| 13 | NPC bump (`rel > 0.6`) | `thud` | 90 ms | 0.40 | 0.30 | stagger; paired with the bark (Ch. 17) |
| 14 | Debris floor-bounce (`|v.y|>1.2` on landing) | `tick` | 18 ms | 0.15 | 0.00 | patter; throttled ≤1 per 60 ms |
| 15 | Error / invalid grab (empty-aim `INTERACT`) | `error` | 30 ms | 0.50 | 0.00 | buzz |
| 16 | Pick debris off floor (`tryGrab` on `h.debris`) | `grab` | 40 ms | 0.25 | 0.00 | = cue 2 |
| 17 | Countdown tick 3/2/1 (Ch. 6 COUNTDOWN) | PA chime | 3× 20 ms | 0.20 | 0.00 | metronome |
| 18 | Countdown "GO" | PA chime | 60 ms | 0.20 | 0.40 | launch |

**Global haptic rules.** (a) A **master haptics scale** (0–1, Ch. 11) multiplies every `weak`/`strong` before `playEffect`; setting it to 0 disables rumble entirely (motor-accessibility). (b) **Reduce-shake** (Ch. 11) and **reduce-haptics** are independent — a player can keep rumble while zeroing camera shake. (c) **Fallback derivation:** any future physics event that adds camera shake but lacks an explicit cue above auto-emits a `min(90, 40 + shake·60) ms` pulse at `weak = shake·0.4, strong = shake·0.5`, so new juice never ships silent on the pad. (d) Cues never queue-overlap on one motor beyond 2 deep; a newer high-priority cue (7, 11) preempts a lingering low one (12, 14).

---

### 8.12 Touch — layout, virtual stick, look, context, tap-to-grab

Auto-detected via `matchMedia('(pointer: coarse)').matches` **and** a `touchstart` having fired; on touch we hide the mouse crosshair-prompt affordances and swap key glyphs for button glyphs everywhere (Ch. 10 tutorial included). Layout is specified in **viewport %** so it survives any phone/tablet aspect; touch targets are also floored at physical px minimums for thumb safety.

**Screen zones (origin top-left, % of viewport):**

| Zone | Rect (x%, y% → x%, y%) | Role |
|---|---|---|
| Virtual move stick | 0–45%, 35–100% | Floating stick — appears where the thumb lands |
| Look area | 45–100%, 0–88% | Drag to look; tap-to-grab (below) |
| TAKE button | anchored 82–96% x, 74–90% y | Primary green context button, 64 px |
| SPRINT button | anchored 82–96% x, 58–72% y | Hold (toggle-able), 64 px, above TAKE |
| RESHELVE button | anchored 66–80% x, 74–86% y | **[BUILD]**, 56 px, left of TAKE, shown only when debris in reach |
| Mute icon | 88–98% x, 2–10% y | 40 px, top-right, clear of the timer (Ch. 7) |
| Pause icon | 2–12% x, 2–10% y | 40 px, top-left, clear of the list card |
| Map icon | 88–98% x, 12–20% y | 40 px, under mute |

Physical minimums (override % when the device is small): primary buttons ≥ 56 px, icons ≥ 40 px, ≥ 20 px inter-target gap (thumb-safe). Everything sits inside the safe-area insets (`env(safe-area-inset-*)`) so notches/home-bars never clip a control.

**Virtual move stick params.** Floating (not fixed): on `touchstart` inside the move zone, the base spawns at the touch point. Radius **90 px**; dead radius **10 px** (smaller than gamepad's 0.18 because a re-centering floating stick needs less dead space). Output magnitude `m = clamp((d − 10) / (90 − 10), 0, 1)` where `d` = px from base to current touch, capped at the 90 px ring; direction from base→touch. Feed as `MOVE_X = m·dirX`, `MOVE_Y = m·(−dirY)` (screen-Y is down). Past-ring drags clamp to the ring (no runaway). Linear, like the gamepad move curve. Releasing snaps the stick out and zeroes `MOVE_*`.

**Look area.** Drag delta drives look at **0.0045 rad/px × sens** (§8.3), same clamp ±1.45, roll 0. Multi-touch: the move stick and look can be driven simultaneously by two thumbs (each `touch.identifier` is tracked independently); a look drag ignores touches that began inside the move zone or on a button. Momentum flick is **off** by default (a released look drag stops immediately — precise aim beats slippy), with an optional "look inertia" toggle (Ch. 11) that decays a flung look at −8 rad/s².

**Context buttons.** **TAKE** is enabled/glowing only when a grabbable is aimed (mirrors the `#prompt` visibility) or when inside the checkout radius (then it reads "CHECK OUT" and confirms). Tapping TAKE fires `INTERACT` through the same edge path as `E`. **SPRINT** is hold by default (press-and-hold sets `SPRINT` state); a Settings toggle turns it into a latch (tap on/off) with the same auto-clear-after-0.4 s-idle rule as §8.6.

**Grab via tap-on-target.** In addition to the TAKE button, a **tap** in the look area grabs whatever the center-ray is on. Tap discrimination is exact: a touch that (a) lasts **< 180 ms**, (b) moves **< 14 px** total, and (c) began in the look area (not on a button/stick) is a *tap* → if a grabbable is within `REACH` under the crosshair (or checkout radius), fire `INTERACT`; else no-op (no error buzz — taps are cheap). Anything longer or farther is a *look drag*. The 14 px / 180 ms thresholds are the standard tap gate and keep a small aim-nudge from being read as a grab. `AIM_SNAP` on touch = a **double-tap** in the look area (two taps < 260 ms apart), performing the §8.10 soft-snap — handy since a thumb can't fine-aim a shelf as precisely as a stick.

**Haptics on touch** use `navigator.vibrate([...])` where available (Android): grab = `vibrate(15)`, list complete = `vibrate([40,60,40])`, sprint-crash = `vibrate([120,40,90,40,60])`, damage nick = `vibrate(20)`. iOS Safari lacks the Vibration API — touch haptics silently no-op there (never a hard dependency).

---

### 8.13 Device detection, hot-swap & input priority

Three schemes coexist; the **active scheme** is whichever produced the most recent input, and the HUD glyphs (Ch. 7) follow it live:

- Start: touch if `pointer: coarse` + `touchstart` seen; else KB+M.
- A `gamepadconnected` event plus any button/axis past deadzone → switch to gamepad, swap prompts to face-button glyphs.
- A `keydown` or mouse move → switch to KB+M.
- A `touchstart` → switch to touch, show on-screen controls.

Switching is **cosmetic + assist-default only** (glyphs, aim-assist default on/off) — bindings for the inactive schemes stay live, so a player can WASD with the left hand and grab with a gamepad `A` if they really want; nothing is disabled. Only **one** gamepad is read for play (the first with fresh input, tracked by `gamepad.index`); others are ignored until they produce input, then take over (single-player, so last-active wins). Disconnect (`gamepaddisconnected`) mid-run auto-pauses (Ch. 6) if that pad was active and no other device has produced input in the last 1.0 s, so a dead battery never strands the player mid-sprint.

---

### 8.14 Mode & accessibility input overrides (hooks)

Input is data-driven so modes and accessibility toggles change behavior without new code paths. The overrides that live *here* (others in Ch. 2 / Ch. 11):

| Override | Effect on input | Source |
|---|---|---|
| Zen mode | `SPRINT` clamped to walk (`SPEED_RUN → SPEED_WALK`); shake→haptic cues 5–7 damped ×0.4 | Ch. 2 |
| Escort brief | Holding `SPRINT` > 2 s is a fail-condition input, surfaced as a red prompt at 1.5 s | Ch. 2 §1.3.7 |
| Reduce motion | Zeroes camera-shake contribution to look; caps head-bob amp to 0 | Ch. 11 |
| Reduce haptics | Master haptic scale → 0 (§8.11) | Ch. 11 |
| Hold-to-toggle | Sprint (and touch sprint) switch to latch (§8.6) | Ch. 11 |
| Invert Y | Sign-flip `LOOK_Y` for all feeds (§8.3) | Ch. 11 |
| Aim-assist force-on | Enable §8.10 magnetism+snap on KB+M too | Ch. 11 |
| Sensitivity slider | `pointerSpeed` / `lookRate` scalar 0.25–3.0 | Ch. 11 |
| Sticky-keys friendly | Grab pre-buffer widened 130→260 ms | Ch. 11 |

---

### 8.15 Input → consequence gate table (what inputs must respect)

Inputs feed the shipped physics, and the arcade tension depends on hitting these exact thresholds. The router must not smooth, buffer, or assist across them:

| Player input | Speed produced | Consequence (Ch. 22) | Constant |
|---|---|---|---|
| Walk into shelf | 3.1 m/s | Knocks items loose (`knockItems`), bills 40% price each | `KNOCK_SPEED = 1.6` |
| Any contact ≥ knock | ≥ 1.6 m/s | Debris spawn + `SFX.thud` + shake 0.3 + damage | `KNOCK_SPEED = 1.6` |
| **Sprint into gondola base** | 4.9 m/s ≥ 4.0 | **Tips whole aisle**, 56-item spill, collider mutates, "CLEANUP" toast | `TIP_SPEED = 4.0` |
| Shove cart | any | Momentum transfer ×1.15; `rel > 2.4` shakes | `PLAYER_R+CART_R` overlap |
| Tip cart | reflected `vn > 2.6` | Cart casualty, billed | `2.6` |
| Bump NPC | `rel > 0.6` | Stagger + bark + 1.3 s NPC cooldown | bump radius 0.66 m |

Because sprint is the *only* way to exceed `TIP_SPEED = 4.0` (walk is 3.1), the aisle-tip is a deliberate sprint decision — the input layer must never let a walk-speed player accidentally cross 4.0 (e.g., no dash impulse, no analog over-range from a bad pad, capped by §8.9 radial clamp).

---

### 8.16 Persistence & defaults (schema pointer)

Input state persists in `localStorage` (full schema in Ch. 20), namespaced `gd3d.*`:

| Key | Contents | Default |
|---|---|---|
| `gd3d.binds` | `{ version, kbm:{action:[codes]}, pad:{action:[buttonIdx]}, touch:{...} }` | §8.4 / §8.8 tables |
| `gd3d.input` | `{ sens:1.0, lookRate:3.4, invertY:false, sprintToggle:false, aimAssist:{pad:true,kbm:false,touch:true}, haptics:1.0, hoverHaptic:false, touchLookSens:0.0045, lookInertia:false }` | as shown |
| `gd3d.debug` | `'0'` / `'1'` | `'0'` |

Defaults are the shipped feel: pointer-lock look at PointerLockControls 0.002 rad/unit × `sens 1.0`; drag-look 0.0042 rad/px; hold-sprint; KB+M no aim-assist. A missing or version-mismatched blob is rebuilt from defaults (unknown actions dropped, missing filled) so an update never bricks a saved config. Nothing here gates progression or touches the leaderboard — it's all comfort and device fit.

---

**Definition of done for Chapter 8 (feeds Ch. 26).** (1) All §8.4/§8.8 bindings live and rebindable per §8.5 with the conflict rules enforced. (2) Pointer-lock↔fallback state machine (§8.7) passes the headless `__isFallback()` battery (Ch. 23). (3) Gamepad deadzone/curve numbers (§8.9) and aim-assist cones (§8.10) match the worked examples within float tolerance. (4) Every haptic cue in §8.11 fires from its paired SFX event, respects the master scale, and no-ops cleanly on unsupported pads. (5) Touch zones (§8.12) sit inside safe-area insets, tap-to-grab discriminates at 14 px / 180 ms, and no crosshair-prompt shows on touch. (6) No input path can push the player past `TIP_SPEED = 4.0` at walk speed (§8.15).

---

*Source files backing this chapter (absolute paths):* `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\main.js` (movement, pointer-lock, drag-look, keys map, animate loop), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\game.js` (REACH, grab/hover, checkout radius, E/R/M verbs, fly duration), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\physics.js` (KNOCK/TIP thresholds, crashCd, bump/shove, damage — the consequences inputs drive), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\sfx.js` (the cue set haptics mirror), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\store.js` (spawn, checkout point, bounds), `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\index.html` (crosshair/HUD DOM the touch layer coexists with), and `C:\Users\joshu\LucidSpaces\Apps\groceryDash\docs\PLAYBOOK.md` Part 2 (the thin draft this chapter expands).



# Chapter 9 — Player Presence & Game Feel

> Owns: the felt weight of being *in* the store. Ch. 2 defines the rulesets, Ch. 4 the score, Ch. 7 the HUD, Ch. 8 the input, and Ch. 22 the raw physics numbers — this chapter turns those numbers into sensation. Everything here layers over the shipped render loop (`src/main.js`), the shipped interaction/flyer system (`src/game.js`), the shipped arcade physics (`src/physics.js`), and the procedural WebAudio (`src/sfx.js`). Nothing here adds a draw the Intel-iGPU floor can't pay for: the whole presence stack is one instanced cart (~4 draws, reusing `_cartGeo` from `store.js`), ≤12 basket item meshes, and at most one skinned hand. Shipped behavior is stated first and marked **[LIVE]**; extensions are marked **[BUILD]** and are always additive — no [BUILD] item may change a [LIVE] number.

Today the player is a floating eye at `y = 1.65` (`main.js:162`). It walks, it bobs `±0.03 m`, it shakes on impact, and items fly into an abstract point `0.45 m` ahead of the lens (`game.js:111`). That is a competent FPS camera and a *bodiless* one. This chapter gives the player a body — a trailing cart and a reaching hand — and specifies, to the millisecond and the hex value, how every player-perceivable event reads across five channels. The design contract is Ch. 1's pillar 3 (**Readable at a sprint**): presence must add sensation without ever obscuring the list, the prompt, or the aim glow.

---

### 9.1 The presence rig hierarchy

Presence is three cooperating transforms, none of them rigidly parented to the camera (rigid parenting is what makes VR-less FP hands feel like a decal). The cart and hands *trail* the camera through critically-damped springs so motion has lag, weight, and follow-through.

```
camera  (PerspectiveCamera, FOV 62, world eye y≈1.65)      [LIVE]
│
├─ handRig            (Object3D, parented to camera)         [BUILD]
│   ├─ handR          (3-bone chain: wrist→palm→fingers)
│   └─ handL          (mirror; hidden by default)
│
└─ presenceRoot       (Object3D, world-space, spring-follows camera)  [BUILD]
    └─ cartRig        (Object3D, own yaw spring)
        ├─ cartChrome (Mesh, _cartGeo — REUSED from store.js shoppingCart())
        ├─ cartGrip / cartFlap / wheel[0..3]  (reused sub-meshes)
        └─ basketAnchor (Object3D, local (0.02, 0.55, 0))
            └─ pileSlot[0..11] (Object3D)  → up to 12 live item meshes
```

- **`handRig` is parented to the camera** (it moves rigidly with the view, then animates *locally* on grab). Hands must not lag the view or aiming feels underwater.
- **`presenceRoot`/`cartRig` are world-space** and chase the camera via springs (§9.4). Lag here is the *point* — it produces the swing-out on turns.
- **`basketAnchor`** sits at the cart's floor plane (local `y = 0.55`, matching `botY` in `buildCartGeometry`). All pile items are children of it, so tipping/jolting the cart carries the pile with it for free.

Draw-budget accounting (Ch. 21 floor: ≤1000 draws worst view): `cartChrome` ≈ 1 merged draw + grip/flap/wheels collapsed to 2 = **~4 draws** (identical to the shipped `shoppingCart()` cost), pile items **≤12 draws** (each a `buildProduct` mesh, box-kinds collapse to 2 groups), hand **1 draw**. Total presence cost **≤17 draws**, well under the 12-draw headroom the spawn-view battery leaves. All of it is culled by frustum when the player looks straight up (it lives in the lower-center foreground).

---

### 9.2 Cart geometry, scale & framing

The presence cart **reuses `_cartGeo`** — the same ~90-bar tapered lattice `buildCartGeometry()` already builds once and caches in `store.js:317`. No new geometry, no new material: `METAL(0xc4cad0, 0.28)` chrome, the red `0xb3261a` grip and child flap, four `r=0.055` casters. Reusing the exact world-cart mesh means the thing you push and the thing you carry are visibly the same object — a coherence win for free.

**Native dimensions (from `buildCartGeometry`), in cart-local meters:**

| Feature | Local coords | Value |
|---|---|---|
| Basket length (X) | `xB = −0.42` → `xF = 0.46` | 0.88 m |
| Back rim (handle end) | half-width `bkW = 0.30`, height `bkY = 1.00` | 0.60 m wide |
| Front rim | half-width `ftW = 0.24`, height `ftY = 0.88` | 0.48 m wide |
| Basket floor | back `bBotW = 0.22`, front `fBotW = 0.18`, `botY = 0.55` | tapered |
| Handle grip | cylinder `r 0.023 × len 0.64` @ `(−0.53, 1.065, 0)` | red plastic |
| Casters | `r 0.055` @ `y 0.055`, footprint `−0.42..0.36 × ±0.26` | 4× |
| Overall height | wheels(0) → back rim | ~1.07 m |

**Framing.** The cart's spring *target* is `camPos + camForward·0.55 + camDown·0.62` (see §9.4). With the eye at `y ≈ 1.65`, that puts the basket rim at world `y ≈ 1.03 m` — which is exactly `bkY = 1.00` plus the rig's slight nose-up, so the **back rim lands at screen-y ≈ 78 %** and the red grip is the nearest object to the lens, bottom-center. The front of the basket recedes toward screen-center, leaving the crosshair and the whole upper 60 % of the frame clear for shelves, the list card, and the compass strip (Ch. 7). The cart occupies the lower-center foreground and **never rises above the horizon line** during normal traversal — a hard framing rule, because a cart that crowds the aim point violates pillar 3.

**Scale caveat.** The cart is rendered at native `1.0` scale (it must match the world carts you shove). Because it is only `0.55 m` ahead of a `62°`-FOV lens, it fills more screen than its real size — intentional; this is the classic "weapon model is huge but reads correct" FP trick. No scale hack is applied.

---

### 9.3 Cart spring-lag dynamics

The cart follows the camera with **frame-rate-independent critically-damped smoothing** — the `1 − exp(−k·dt)` form, which (unlike a raw `lerp(a,b,0.1)`) gives identical settling at 30, 60, and 144 fps. This is the single most important game-feel system in the chapter.

```
// per frame, dt clamped to 0.05 (matches main.js clock clamp)
const aPos = 1 − Math.exp(−k_pos · dt);
const aYaw = 1 − Math.exp(−k_yaw · dt);
cartRig.position.addScaledVector(targetPos.clone().sub(cartRig.position), aPos);
cartRig.yaw += shortestAngle(targetYaw − cartRig.yaw) · aYaw;
```

**Gains and their time constants** (`τ = 1/k`, the time to close 63 % of an error; 95 % settle ≈ `3τ`):

| Gain | Walk value | Sprint value | τ (walk) | 95 % settle | Feel |
|---|---|---|---|---|---|
| `k_pos` (follow) | **9.0** | **12.0** | 111 ms | 333 ms / 250 ms | tightness of the leash |
| `k_yaw` (turn) | **6.0** | 6.0 | 167 ms | 500 ms | swing-out on turns |
| `k_pitch` (lean) | 8.0 | 8.0 | 125 ms | 375 ms | nose dip/rise |

The **asymmetry is deliberate**: `k_yaw (6) < k_pos (9)`, so when you whip the mouse the cart's *position* keeps up but its *yaw* trails, and the basket visibly **arcs out** through the turn like a real cart's back wheels breaking loose.

**Worked example — a 90° flick.** Snap the view `π/2 rad` instantly. The cart's yaw error decays as `e(t) = (π/2)·exp(−6t)`:

| t | Yaw error | Read |
|---|---|---|
| 0 ms | 90.0° | full lag |
| 50 ms | 66.7° | mid-arc, most visible swing |
| 100 ms | 49.4° | still trailing hard |
| 200 ms | 27.1° | catching up |
| 500 ms | 4.5° | settled |

That half-second of visible arc is the "weight" of the cart. **Sprint tightens the leash** (`k_pos 9→12`, τ 111→83 ms) and adds a **forward pitch of −3°** eased in over `k_pitch`, so the cart reads as *shoved ahead of you* rather than dragged behind.

**Coupled walk-bob.** The cart dips opposite the head-bob to sell "pushing weight": `cartRig.localY += sin(bob + π)·0.015` — a `±1.5 cm` counter-oscillation at the live bob frequency (§9.6). When the head rises, the cart sinks; the anti-phase reads as the cart's mass resisting the stride. Amplitude scales `×1.4` on sprint (`±2.1 cm`) to match the taller sprint bob.

---

### 9.4 Cart collision feel — nudge vs. blocked vs. crash

The cart's *presence* recoil is decoupled from the world-cart physics (Ch. 22) but is **triggered by the exact same events** `physics.js` already emits, so it never desyncs from what the store actually does. Three tiers, escalating:

| Tier | Trigger (live source) | Recoil impulse | Spring-back | Coupled |
|---|---|---|---|---|
| **Nudge** | shoving a world cart, `rel ≤ 2.4` (`physics.js:206`) | back 2 cm, no pitch | `k=14`, ~215 ms | — |
| **Blocked** | `onPlayerBlocked` fires, sub-knock (`physics.js:164`, shake 0.18) | back 6 cm + pitch **+5°** | `k=11`, ~270 ms | `SFX.thud`, shake 0.18 |
| **Knock** | blocked ≥ `KNOCK_SPEED 1.6` (shake 0.3) | back 9 cm + pitch +7° + roll ±3° | `k=10`, ~300 ms | `SFX.thud`+`clatter`, shake 0.3, damage meter |
| **Crash-tip** | `tipGondola` fires (shake 0.9) | back **12 cm** + pitch +9° + **roll ±9°** | `k=8`, ~375 ms | `SFX.crash`, shake 0.9, +eject 1–2 basket items (§9.5) |

The recoil is a **one-shot velocity impulse added to the cart spring**, so it composites with the follow spring naturally: the cart lurches back, then the `k_pos` follow pulls it home over the settle time. The **pitch-up on block** is the tell that reads as "the front wheels hit something" — a cart that only translates back reads as a bumper car; the pitch is what makes it read as a *cart*.

`onPlayerBlocked` already gates on `crashCd` (0.45 s gondola, 0.5 s plain, `physics.js:143`), so the recoil can fire at most ~2×/s — no jackhammer against a wall.

---

### 9.5 Basket pile-in — the progress you can see

The shipped flyer ends at an abstract point `0.45 m` ahead of the lens (`game.js:111`) and then deletes the mesh (`game.js:117`). Production **retargets the flyer's endpoint to a real basket slot** and *keeps* the mesh parented under `basketAnchor`, so a filling basket is a glanceable "I've grabbed a lot." This is a modification to the flyer end-state only; the 0.4 s arc, the `sin(t·π)·0.3` hop, the `7 rad/s` spin, and the `1 − 0.75t` shrink all stay **[LIVE]** — but the final scale resolves to the item's shelf scale (not `0.25`) because it's now landing as a real object, not vanishing.

**The 12 slots.** `basketAnchor` local space, `y = 0` is the basket floor (`botY 0.55`). Twelve slots on a jittered **4 (X) × 3 (Z)** grid inside the tapered footprint:

```
slotX[col] = lerp(−0.34, 0.40, col/3)     // 4 columns, front-to-back
slotZ[row] = lerp(−0.22, 0.22, row/2)      // 3 rows
slotJitter = ±0.018 m XZ, yaw ±0.35 rad    // seeded per slot, stable
```

**Fill order** is front-to-back, left-to-right (col-major), so the basket "loads from the front" as a real cart does. The 13th grab and beyond **recycle the oldest slot's transform** (increment the count, re-drop into slot `n mod 12`) — the basket looks full without unbounded meshes, matching the `DEBRIS_CAP` philosophy in Ch. 22.

**Stack rules per size class.** Item footprint comes from the flyer's measured bbox (the same `Box3` the debris path already computes, `physics.js:63`). Three classes:

| Class | Footprint (max XZ) | Kinds (Ch. 16) | Slot occupancy | Stack | Lay-down |
|---|---|---|---|---|---|
| **Small** | ≤ 0.09 m | can, cup, jar, tin | 1 slot | up to **2 high** (Δy = item height) | upright |
| **Medium** | 0.09–0.16 m | box, carton, tub, bag | 1 slot | 1 high | upright |
| **Large** | > 0.16 m OR height > 0.30 m | bottle, big box, wine, 55″ TV | **2 adjacent slots** | 1 high | **on its side** (`rotation.z = π/2`), long axis along basket X |

Small items double-stack so a 6-can run reads as a *heap*, not a sparse grid. Large items lay flat and eat two slots because a standing bottle would breach the `0.88 m` front rim and clip the crosshair — laying it down keeps the pile under the rim line. Each landed item does a **squash-settle**: `scaleY 0.85 → 1.00` over 120 ms, ease-out cubic, with a matching `scaleXZ 1.06 → 1.00`, so it "plops" into place. This reuses the exact same 120 ms the playbook already specifies and costs nothing but a tween on one mesh.

**Spill on tip.** When `tipGondola` fires (the sprint-crash, `physics.js:150`) or the crash-tier recoil hits (§9.4), the **top 1–2 basket items eject** as real debris: pop the newest 1–2 `pileSlot` children, hand them to the existing `spawnDebrisNow` path (`physics.js:57`) with an upward-and-outward velocity `v = (camForward·1.4 + up·(1.6 + rand·0.8))`, and decrement the visible count. These ejected items are **cosmetic — not billed** (they were already yours), fade on the normal 28 s TTL, and are re-grabbable off the floor (`game.js:130`). This ties the player's own inventory to the destruction: sprint-crash an aisle and you literally watch a can bounce out of your cart. Ejection is capped at 2 per event and gated on the same `crashCd` so a wall-scrape doesn't empty your basket.

---

### 9.6 First-person hands & grab keyframes

A single low-poly **right hand + forearm** (gloved, `~450 tris`, one skinned draw) rests on the grip during traversal and reaches on `E`. The left hand is authored (mirror) but **hidden by default** — one hand is enough presence and half the cost. Hands are a **Settings toggle** (some players find FP hands intrusive, Ch. 11); the cart is not toggleable because it is load-bearing for the pile visualization.

**Three-bone chain:** `wrist → palm → fingers` (fingers as one aggregate bone; no per-finger IK — this is arcade, not a hand-sim). Rest pose grips the red bar at local `(−0.53, 1.065, 0)`.

**Grab animation (fires on `E` / left-click / gamepad A).** The perceived grab stays ~0.4 s to match the **[LIVE]** flyer duration; the hand's reach *overlaps* the flyer's start so the item never leaves the shelf before the hand arrives (kills the "telekinesis" read the current build has):

| Phase | t (s) | Hand action | Curve | Fires |
|---|---|---|---|---|
| **Anticipate** | 0.00–0.04 | wrist pulls back 3 cm off grip | ease-in | — |
| **Reach** | 0.04–0.18 | palm drives toward aimed product (up to `REACH 2.7 m` along aim ray, clamped to arm length ~0.7 m visually) | ease-out cubic | — |
| **Contact** | 0.18 | fingers close 40 % (pinch) | snap | `SFX.grab` (520→800 Hz), flyer spawns, haptic 40 ms | 
| **Carry** | 0.18–0.40 | item rides the **[LIVE]** 0.4 s arc; hand holds pinch, retracts with it | follows flyer | — |
| **Return** | 0.40–0.62 | hand eases back to grip rest, fingers open | ease-in-out | item squash-settles in basket |

Total motion 0.62 s, but the **player-legible grab completes at 0.40 s** (item in basket); the return is follow-through the player barely registers. The contact frame at **0.18 s** is the sync anchor — audio, haptic, and the flyer spawn all fire on that one frame, so the chirp, the buzz, and the item leaving the shelf are perceptually simultaneous.

**Traversal micro-motion.** At rest the hand inherits a damped copy of the walk-bob (`sin(bob)·0.008`, ¼ the head amplitude, lagged 60 ms) so it breathes with the stride instead of floating dead. On sprint it adds a `±2°` wrist roll at the sprint bob frequency — the "gripping harder while running" read.

---

### 9.7 Camera specification

The camera is the shipped `PerspectiveCamera(62, aspect, 0.1, 100)` at eye `y = 1.65` (`main.js:36,162`). Everything below is either its **[LIVE]** behavior stated exactly, or an additive **[BUILD]** kick that never overrides a live number.

**FOV.**

| State | FOV | Source |
|---|---|---|
| Idle / walk | **62°** | `main.js:36` **[LIVE]** |
| Sprint | **66°** (kick +4°) | **[BUILD]**: `fov += (targetFov − fov)·(1 − exp(−7·dt))`, target 66 while `Shift` held, 62 otherwise — τ ≈ 143 ms |

The sprint FOV kick is the cheapest speed-sell in the toolbox (one `updateProjectionMatrix` call/frame while transitioning) and reads as the world *rushing past*. It eases both ways so releasing `Shift` doesn't snap. Never exceeds 66° — beyond that the barrel distortion fights the list card's legibility.

**Head-bob** (`main.js:158,162`, **[LIVE]**): `bob` advances at `dt · (SPEED>4 ? 13.5 : 10.5)` rad/s; eye `y = 1.65 + sin(bob)·(SPEED>4 ? 0.045 : 0.03)`.

| Gait | Angular rate | Cycle Hz | Period | Amplitude |
|---|---|---|---|---|
| Walk (3.1 m/s) | 10.5 rad/s | **1.67 Hz** | 598 ms | **±3.0 cm** |
| Sprint (4.9 m/s) | 13.5 rad/s | **2.15 Hz** | 465 ms | **±4.5 cm** |

Bob advances **only while moving**; when input stops, the `y` bob term drops to 0 the same frame (`main.js:162`). Shipped, that is a hard pop. **[BUILD]** fix: ease the bob *amplitude* (not the phase) to 0 over 180 ms on stop via `amp *= exp(−9·dt)`, so the head settles instead of snapping. **[BUILD]** lateral sway: add `camera.x += sin(bob·0.5)·0.012` (a `±1.2 cm` side-to-side at half the bob rate) for a figure-8 gait — the vertical-only shipped bob reads slightly robotic; the half-rate lateral is what makes footfalls feel left/right.

**Camera shake** (`main.js:163`, **[LIVE]**): a single scalar `shake ∈ [0,1]`, added to eye `y` as `(random − 0.5)·shake·0.12` — i.e. **±0.06·shake meters of white-noise vertical jitter, resampled every frame**. It decays linearly at `1.6/s` and is capped at 1.0 (`physics.js:34,187`). Because decay is linear, a seed value `S` lasts exactly `S/1.6` seconds:

| Event | Seed `addShake` | Peak y-jitter | Duration (S/1.6) | Source |
|---|---|---|---|---|
| **Sprint-crash aisle tip** | **0.90** | ±5.4 cm | **563 ms** | `physics.js:137` |
| Cart tips over (crash) | 0.35 | ±2.1 cm | 219 ms | `physics.js:246` |
| Knock items off shelf | 0.30 | ±1.8 cm | 188 ms | `physics.js:158` |
| NPC bump | 0.22 | ±1.3 cm | 138 ms | `physics.js:337` |
| Plain wall thud | 0.18 | ±1.1 cm | 113 ms | `physics.js:164` |
| Hard cart shove (`rel>2.4`) | 0.15 | ±0.9 cm | 94 ms | `physics.js:210` |
| Cart–cart hard knock | 0.15 | ±0.9 cm | 94 ms | **[BUILD]** parity with above |

Shakes **accumulate** (`Math.min(1, shake + v)`), so two events in a frame stack toward the 1.0 cap and then bleed off together — a chain-reaction crash reads as one big continuous rumble, correctly.

**[BUILD] directional lurch & roll.** Shipped shake is vertical-only, which reads as a rumble but not a *hit from a direction*. Production adds, on the four named impact events, a one-shot **positional lurch along the impact normal** and a **roll kick**, both springing back over the shake's own duration:

| Event | Lurch (along −impactNormal) | Roll (`camera.z`) | Spring-back |
|---|---|---|---|
| Aisle tip | 8 cm | ±4° | `1 − exp(−7·dt)` |
| Knock | 4 cm | ±2° | `1 − exp(−9·dt)` |
| Wall thud | 3 cm | ±1.5° | `1 − exp(−10·dt)` |
| NPC bump | 3 cm along bump normal | ±1.5° | `1 − exp(−9·dt)` |

The lurch uses the `dx/dz` the `onPlayerBlocked` path already has (`physics.js:144`), so the camera jerks *away from the shelf you hit* — directional, legible, and free of new state. Roll is clamped to `±4°` because the drag-look fallback zeroes `camera.rotation.z` each frame (`main.js:124`); the roll is applied *after* look, as a transient additive that the next impact frame overwrites — it must never persist or the fallback fights it.

**[BUILD] hit-stop.** On the **aisle-tip only** (the money moment), insert a single **60 ms time-scale dip** (`dt ×= 0.35`) the frame the tip triggers. Nowhere else — frequent hit-stop on iGPUs reads as dropped frames. One 60 ms dip on the rarest, biggest event sells the impact's weight; the existing 0.85 s gondola fall animation (`physics.js:267`) plays out in real time after the dip.

**Collision-lurch curve — worked example.** Sprint (4.9 m/s) straight into aisle 3. Frame 0: `onPlayerBlocked` → `tipGondola` → `addShake(0.90)` + lurch 8 cm + roll +4° + 60 ms hit-stop + `SFX.crash`. The eye then: (a) jitters `±5.4 cm` vertical, decaying to 0 over 563 ms; (b) lurches 8 cm backward, springing home at τ ≈ 143 ms; (c) rolls +4°, unrolling at τ ≈ 143 ms; (d) the cart recoils 12 cm + rolls ±9° (§9.4); (e) 1–2 cans eject from the basket (§9.5). Five channels, one trigger frame, all decaying on their own clocks — the layered decay is what makes a single collision feel *big* instead of *buzzy*.

---

### 9.8 The full juice inventory

Every player-perceivable event, across all five channels, with exact timings/curves. Sound is **[LIVE]** where it maps to an existing `SFX` method (Ch. 18); visuals/HUD are marked per shipped state; haptic is the Ch. 8 gamepad layer (**[BUILD]** — shipped has no haptics); camera cross-references §9.7. Timings are in ms unless noted. "—" means no output on that channel by design.

| # | Event | Visual | Audio | Haptic | HUD | Camera |
|---|---|---|---|---|---|---|
| 1 | Hover shelf grabbable | Additive glow box, `#9fdcff` op .28, scale = size+0.05 **[LIVE]**; crosshair 6→10 px, tint green | — | — | Prompt: `**Name** · $X — [E] take` **[LIVE]** | — |
| 2 | Hover floor-debris grabbable | Same glow, fitted to debris bbox **[LIVE]** | — | — | Same prompt | — |
| 3 | Aim leaves grabbable | Glow hides `setHover(null)` **[LIVE]**; crosshair 10→6 px, 80 ms | — | — | Prompt hides **[LIVE]** | — |
| 4 | Crosshair over non-grabbable | Crosshair stays 6 px, neutral | — | — | — | — |
| 5 | Grab shelf item (`E`/click/A) | Hand reach 40–180; flyer 0.4 s arc + hop `sin(t·π)·0.3` + spin 7 rad/s + shrink `1−0.75t` **[LIVE]**; basket squash-settle 120 | `grab` 520→800 Hz tri, 120 ms, peak .24 **[LIVE]** | 40 ms weak .25 @ contact(180) | List row → ✓, strike; combo `+pts` float (Ch. 4) | — |
| 6 | Grab floor debris | Reuses debris mesh as flyer **[LIVE]**; basket settle | `grab` **[LIVE]** | 40 ms weak .25 | List credit if on-list **[LIVE]** | — |
| 7 | List **row** satisfied | Row flips green, 1.06 scale punch 140 ms | `tick` 880 Hz sq, 70 ms, peak .14 **[LIVE]** | 40 ms weak .25 | Footer `n/6` increments **[LIVE]** | — |
| 8 | Grab non-list item (mispick) | Flyer plays, **no** row check | `grab` only (no `tick`) **[LIVE]** | 30 ms sharp .3 | Combo resets to 0 (Ch. 4) **[BUILD]** | — |
| 9 | **List complete** | Green banner flash; checkout ring `.visible=true` **[LIVE]**; compass shows only 🛒 | `listDone` 660+880 Hz, 100 ms apart **[LIVE]** | Two 60 ms pulses strong .5 | Banner "head to CHECKOUT" **[LIVE]**; list → 1-line chip | — |
| 10 | Basket item lands | Squash `scaleY .85→1`, `scaleXZ 1.06→1`, 120 ms ease-out | (covered by #5) | — | — | — |
| 11 | Basket 13th+ item | Recycles slot `n mod 12`; oldest re-drops | — | — | — | — |
| 12 | Basket spill on tip | Top 1–2 items eject as debris, up+out **[BUILD]** | (covered by crash #19) | — | — | (see #19) |
| 13 | Begin walk | Bob starts 10.5 rad/s **[LIVE]**; cart counter-bob ±1.5 cm | Store hum bed (always on) **[LIVE]** | — | — | Bob ±3 cm @ 1.67 Hz |
| 14 | Stop walk | Bob amp eases to 0 over 180 ms **[BUILD]** (live: hard stop) | — | — | — | Settle |
| 15 | Begin sprint (`Shift`) | Cart pitch −3°, `k_pos 9→12`; bob → 13.5 rad/s **[LIVE]** | Hum unchanged | — | — | FOV 62→66 τ143 **[BUILD]**; bob ±4.5 cm |
| 16 | End sprint | Cart pitch → 0; bob → 10.5 rad/s **[LIVE]** | — | — | — | FOV 66→62 τ143 |
| 17 | Turn / flick view | Cart yaw arcs, τ167 (§9.3) | — | — | Compass markers slide **[BUILD]** | — |
| 18 | Walk into shelf `<1.6 m/s` (or wall) | Cart recoil 6 cm + pitch +5° | `thud` noise260+90→55 Hz **[LIVE]** | 120 ms strong .5 | — | Shake 0.18 (113 ms) + lurch 3 cm + roll ±1.5° |
| 19 | Knock items off `≥1.6, <4.0` | Items ballistically spill **[LIVE]**; cart recoil 9 cm + roll ±3°; damage flash | `thud`+`clatter` (4 chirps 0–210 ms) **[LIVE]** | strong mixed .5/.4 | Damage meter climbs + `+$X` float; "bill" toast p.4 **[LIVE]** | Shake 0.30 (188 ms) + lurch 4 cm + roll ±2° |
| 20 | **Sprint-crash aisle tip `≥4.0`** | Gondola pivots 0→86.6° over 850 ms, settle-bounce **[LIVE]**; 56-item spill **[LIVE]**; cart jolt 12 cm+roll ±9°; 1–2 basket ejects | `crash` (noise900 + 70→40 Hz + delayed noise500 @120) **[LIVE]** | 350 ms ramp .9→.2 both motors | PA toast "CLEANUP ON AISLE N — ALL OF IT" **[LIVE]**; big damage jump | **Shake 0.90 (563 ms)** + lurch 8 cm + roll ±4° + 60 ms hit-stop |
| 21 | Shove a cart (soft `rel≤2.4`) | World cart rolls w/ momentum 1.15× **[LIVE]**; your cart nudge 2 cm | — | — | — | — |
| 22 | Shove a cart hard (`rel>2.4`) | Cart rolls fast; your cart recoil | `thud` **[LIVE]** | 90 ms mixed .4/.3 | — | Shake 0.15 (94 ms) |
| 23 | World cart bounces fixture (`1.0<−vn≤2.6`) | Cart deflects, restitution 0.4 **[LIVE]** | `thud` **[LIVE]** | — | — | — |
| 24 | World cart **tips over** (`−vn>2.6`) | Cart pivots z=1.42·t², y=0.25·t², ~330 ms **[LIVE]** | `crash` **[LIVE]** | 90 ms mixed | Snark toast (CRASH_LINES) **[LIVE]** | Shake 0.35 (219 ms) |
| 25 | Cart–cart collision (`rel>1.5`) | Both carts exchange 0.7× vel **[LIVE]** | `clatter` **[LIVE]** | — | — | — |
| 26 | Cart hits store bounds | Cart reflects 0.4× off wall **[LIVE]** | — | — | — | — |
| 27 | Bump an NPC | NPC staggers `shove t=0.55`, pauses 1.0 s, springs back **[LIVE]** | `thud` **[LIVE]** | 90 ms mixed .4/.3 | Bark toast (BUMP_LINES) **[LIVE]** | Shake 0.22 (138 ms) + lurch 3 cm |
| 28 | NPC recovers | NPC eases to post/path **[LIVE]** | — | — | — | — |
| 29 | Debris hits floor (bounce) | Piece bounces `v.y·−0.28`, tumble ×0.5 **[LIVE]** | `tick` if `|v.y|>1.2` **[LIVE]** | — | — | — |
| 30 | Debris comes to rest | Rotation snaps to π/2 grid, seats on floor **[LIVE]** | — | — | — | — |
| 31 | Debris fades (TTL 28 s) | Scale `1→0` over 800 ms **[LIVE]** | — | — | — | — |
| 32 | Enter checkout radius (`<2.2 m`) | Ring pulse **[BUILD]** (live: ring visible) | — | — | Prompt: status or auto-complete **[LIVE]** | — |
| 33 | Checkout w/ list incomplete | — | — | 30 ms sharp .3 | Prompt "Finish your list first — n/6" **[LIVE]** | — |
| 34 | **Checkout complete** | Grade-stamp slam (Ch. 4); register ka-ching flash | `checkout` C5-E5-G5-C6 arp, 90 ms apart **[LIVE]** | Ascending triple .3/.4/.6 | Results banner: items·total·damages·time **[LIVE]** + grade card | Cart/hands freeze |
| 35 | Press `R` — new list | Banner hides, ring off, list regenerates **[LIVE]** | — | — | List re-renders, footer 0/6 **[LIVE]** | — |
| 36 | Mute toggle (`M`) | Speaker-off icon flash 600 ms **[BUILD]** | master gain 0.45↔0 **[LIVE]** | — | Toast "Muted" **[BUILD]** | — |
| 37 | Pointer-lock acquired | Crosshair shows **[LIVE]** | `SFX.start()` (resumes ctx + hum) **[LIVE]** | — | Hint fades **[LIVE]** | Timer starts on first locked frame **[LIVE]** |
| 38 | Pointer-lock lost / fallback | Crosshair hides (lock) or shows (fallback) **[LIVE]** | — | — | Hint "Drag to look…" 5 s **[LIVE]** | Pause overlay (Ch. 7) **[BUILD]** |
| 39 | Boot ready | Boot fades op→0 over 650 ms, `display:none` **[LIVE]** | — | — | Hint 6 s then fade **[LIVE]** | — |
| 40 | Error / invalid action | Crosshair red shake 200 ms | `error` 300→190 Hz saw, 180 ms **[LIVE]** | 30 ms sharp .6 | — | — |
| 41 | PA cleanup toast | Toast fades in, 2.6 s decay **[LIVE]** | (fired with crash #20) | — | Toast top-center **[LIVE]** | — |
| 42 | Damage-bill toast | Toast p≈0.4 on knock **[LIVE]** | — | — | Toast **[LIVE]** | — |
| 43 | Flow tier-up (Ch. 4) | Multiplier chip pulse 1.0→3.0× **[BUILD]** | rising blip **[BUILD]** | 20 ms weak | Combo ticker `×N` **[BUILD]** | — |
| 44 | Flow break (mistake) | Chip greys, `×1.0` **[BUILD]** | `error`-adjacent **[BUILD]** | 30 ms sharp | Ticker resets **[BUILD]** | — |
| 45 | Combo `+pts` float | Number floats up 40 px, fades 700 ms **[BUILD]** | — | — | Right edge, mid-height (Ch. 7) | — |
| 46 | Store hum (ambient) | — | Looped noise, lowpass 240 Hz, gain .018 **[LIVE]** | — | — | — |

**Reading the table.** Rows 1–4 are the aim loop, 5–12 the grab/pile loop, 13–17 traversal, 18–31 the destruction/consequence spine, 32–35 checkout, 36–46 meta/system. Twenty-six of the 46 rows are already fully or partially **[LIVE]** — the production work is mostly filling the *haptic* and *camera-lurch* columns and the four **[BUILD]** HUD readouts, not inventing new events.

---

### 9.9 The global juice governor

All juice flows through one budget so the store never becomes an unreadable seizure at a sprint (pillar 3). Three rules, all cheap:

1. **Shake cap & shared decay.** One scalar, `min(1, …)` cap, linear `1.6/s` bleed (`physics.js:187`). Every impact adds to the same pool, so a chain crash saturates at 1.0 and decays *once*, not per-event. This is why the aisle-tip (0.90) plus its cart-tip echo (0.35) reads as one 1.0-capped rumble tapering over ~625 ms rather than two stacked jolts.

2. **Accessibility zeroing (Ch. 11).** Presence and juice degrade *gracefully to nothing*, in this priority order, so a motion-sensitive or low-end player loses feel before they lose function:
   - `reduceMotion` → `shake·= 0`, bob amp `×0.3`, hit-stop off, FOV kick off, cart counter-bob off.
   - `noFlash` → damage flash, ka-ching flash, red crosshair shake off.
   - Zen mode already forces walk-speed and (per Ch. 2) disables shake — the same `reduceMotion` path.
   The hand and the pile visualization stay on (they're information, not motion), but hands are independently toggleable.

3. **Tier scaling (Ch. 21).** On the **panic tier** (resolution-dropped), the compositor-only juice survives because it costs nothing: all UI punches use `transform: scale` (never layout), the cart springs are scalar math, and shake is a single `y` add. The only thing panic drops is the FOV kick's per-frame `updateProjectionMatrix` — held constant at 62° — because it's the one item that dirties the projection matrix every frame. Everything else is tier-invariant by construction, honoring the doctrine that feel must survive the Intel-iGPU floor (Ch. 1, §0.6).

The through-line of the whole chapter: the shipped build already *emits* every event a body would react to — `onPlayerBlocked`, `tipGondola`, `spawnDebris`, the NPC bump, the flyer, the checkout — it just reacts with a floating eye and a beep. Player presence is the layer that lets you *feel* the store you were already breaking. It costs ≤17 draws, reuses one cached geometry, adds no new physics state, and turns a competent camera into a cart you can feel swing out behind you when you cut the action alley at a dead sprint.



# Chapter 10 — Onboarding & Tutorialization

This chapter specifies how a first-time player goes from a black boot screen to fluently running the core loop — and then, at their own pace, discovers the advanced verbs (sprint-tipping, style events) the rest of the game is built on. It is a *design bible* chapter: it names every string, every trigger, every timing, every persisted key, and every DOM node so an engineer can implement it without a single open question.

The design obeys the shipped reality. The core loop already runs today (`src/game.js`): a 6-item list, aim-and-`E` to grab, a green checkout ring at world `(-7.65, 0, 11.1)`, a completion banner, `R` to reroll. Boot already pays the shader-compile storm behind a fade (`src/main.js`, `manager.onLoad`) and already shows one throwaway `#hint`. Onboarding is **additive**: a new module `src/onboarding.js` (Ch. 19) that wraps `window.__game`, drives the existing HUD nodes, and adds a small handful of new ones. It never touches the render budget in a way that threatens the Intel-iGPU floor (Ch. 21) — the greeter is one already-budgeted Rocketbox avatar (Ch. 17), and every prompt is a DOM overlay. Persistence is `localStorage` (no backend); a cloud mirror is optional and strictly additive (Ch. 20, Ch. 24).

Design pillars this chapter serves (Ch. 1): *teach by playing, never by reading*; *diegetic before UI*; *always skippable, always replayable*; *the tutorial is the game at low stakes*.

---

### 10.1 Onboarding philosophy & the four hard rules

| # | Rule | Consequence in this chapter |
|---|------|-----------------------------|
| 1 | **Diegetic first.** A character in the world teaches; the HUD only confirms. | The greeter "Dale" (10.3) narrates; the `#hint`/`#toast`/`#banner` nodes echo the mechanic, never the pedagogy. |
| 2 | **Never block play.** Beats are *permissive* — any completion check met advances the script, even out of order. | A player who ignores Dale and just grabs the list still graduates. Beats have auto-advance timeouts (10.4). |
| 3 | **Always skippable, always replayable.** One key skips; one menu item replays. | `Esc` → Skip affordance (10.5); Settings → "Replay tutorial"; `?tutorial=1` URL force. |
| 4 | **First run is Zen.** The tutorial imposes no fail state; damages don't bill during onboarding. | The onboarding run sets the Zen ruleset (Ch. 2, 10.8): timer is cosmetic, `physics.damage` is displayed but zeroed at graduation. |

Everything below is scoped to the **default browser build with no backend**. The optional backend (Ch. 24) may later mirror the persistence keys of 10.2 to a user profile; nothing in onboarding *requires* it, and the module must run identically with `localStorage` disabled (private-mode fallback: in-memory shim, first run repeats every session but never errors).

---

### 10.2 First-run detection & persistence schema

Onboarding state lives under a single `localStorage` namespace, `gd3d.*`. All reads go through a guarded accessor that catches `SecurityError`/`QuotaExceededError` and returns defaults (private-browsing safety).

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `gd3d.onb.v` | int | `1` | Schema version. On mismatch, migrate; if migration undefined, wipe `gd3d.onb.*` and re-run. |
| `gd3d.onb.done` | `"0"`/`"1"` | `"0"` | First-run walk-through completed or skipped. Gate for the greeter script. |
| `gd3d.onb.step` | int | `0` | Last committed beat index (crash-resume; see 10.4). |
| `gd3d.hints.shown` | JSON `{id:count}` | `{}` | Per-hint lifetime show counter (10.6 `maxShows`). |
| `gd3d.hints.muted` | `"0"`/`"1"` | `"0"` | User toggled "stop showing tips" (from any hint's long-press dismiss). |
| `gd3d.chal.done` | JSON `string[]` | `[]` | Completed challenge-marker ids (10.9). |
| `gd3d.card.autonew` | `"0"`/`"1"` | `"1"` | Auto-open the control card on the first *manual* play after tutorial (10.7). |

**First-run predicate:** `isFirstRun = getStr('gd3d.onb.done') !== '1'`. Evaluated once, at module init, after boot's `manager.onLoad` sets `bootmsg='Ready'` and before the generic `#hint` would show. On first run the onboarding module **suppresses** the shipped generic hint (it clears the `setTimeout` that fades `#hint` in at `src/main.js:50-51`) and takes over.

**Version bump policy:** any change to beat *count*, beat *order*, or a completion check that could strand a resumed player bumps `gd3d.onb.v` and forces a fresh run (users re-see a 20-second tutorial at worst — acceptable; a stranded resume is not).

---

### 10.3 The Greeter — "Dale", the diegetic manager

The teacher is a person, not a tooltip. **Dale** is the store manager-greeter, a callback to the house dairy brand *Dale Cheddar Block* (`src/products.js`, `id:'cheese'`) — the running gag is that the store's own-brand is named after him.

| Property | Value |
|----------|-------|
| Model | One of the 13 Rocketbox avatars (Ch. 17), the "greeter" staff variant, vest tinted brand-navy `#173a63` with a `#ffd23b` name tag reading **DALE · MANAGER**. |
| Home position | `(2.4, 0, 11.4)` — 2.6 m front-right of spawn `(0.6, 1.65, 13.2)`, inside the entrance, not blocking the aisle mouth. |
| Facing | `yaw = atan2(spawn.x − 2.4, spawn.z − 11.4)` so he faces the player at boot. |
| Idle | Retargeted idle clip (Ch. 17). Gesture library: `wave` (G1), `point_aisle` (G4), `point_ring` (G5), `thumbs_up` (G6). Numeric pose-sanity gate (Ch. 17) applies; if a gesture fails the gate, fall back to `idle` — the caption still plays. |
| Collider | None during onboarding (player may walk through him so a confused player can never wedge). Restored to a normal NPC after graduation. |
| Voice | No VO in v1 (WebAudio-only, Ch. 18). Each beat plays `SFX.listDone` as a soft "Dale speaks" two-note chime — the only new use of an existing cue. |

**The caption bar** (new DOM node `#greeter`). A diegetic lower-third, styled to match the shipped HUD palette exactly.

```
#greeter { position:fixed; left:50%; bottom:120px; transform:translateX(-50%);
  z-index:13; max-width:560px; text-align:center; display:none;
  background:rgba(10,14,18,.9); border:1px solid rgba(255,255,255,.18);
  border-left:3px solid #35c46a; border-radius:12px; padding:12px 18px;
  font-size:15px; line-height:1.35; color:#eef2f6;
  box-shadow:0 8px 30px rgba(0,0,0,.45); backdrop-filter:blur(4px); }
#greeter .who { font-size:11px; letter-spacing:1.2px; color:#8be0a4; opacity:.9; margin-bottom:3px; }
#greeter .key { display:inline-block; border:1px solid rgba(255,255,255,.5);
  border-radius:5px; padding:0 7px; font-weight:700; font-size:12.5px; margin:0 2px; }
```

Bottom `120px` sits it **above** `#prompt` (bottom `84px`) and `#hint` (bottom `34px`) so all three can coexist. z-index `13` places it under `#banner` (14) and over the rest of the HUD (12). Fade-in `.25s`, fade-out `.25s`, matching `#toast`.

---

### 10.4 The first-run script — every beat, verbatim

The walk-through is a **9-beat state machine** (`G0`–`G8`). Each frame the onboarding module reads `window.__isPlaying()`, `window.__isFallback()`, `window.__camera.position`, and `window.__game.state` to evaluate the current beat's completion check. It commits `gd3d.onb.step` after each advance for crash-resume.

**Global pacing constants**

| Constant | Value | Purpose |
|----------|-------|---------|
| `CAPTION_MIN` | 2000 ms | A caption cannot be replaced faster than this even if the check passes, so text is never a flash. |
| `NUDGE_AFTER` | 8000 ms | Idle on a beat this long → swap to the beat's `nudge` string (a gentler restatement). |
| `AUTO_ADVANCE` | 20000 ms | Hard ceiling per beat; if still unmet, advance anyway (permissive rule 2) and let hints (10.6) cover the gap. |
| `BEAT_GAP` | 400 ms | Blank gap between one caption fading and the next appearing. |

**Curated tutorial list.** On first run, `game.reset()` is called with a fixed 3-item list instead of the random 6 (additive branch keyed on `isFirstRun`). The three SKUs are chosen for guaranteed proximity and section variety, drawn from the shipped catalog:

| Slot | SKU `id` | Name | Section / aisle sign |
|------|----------|------|----------------------|
| 1 | `water` | Spring Water | Snacks · Soda · Water (Aisle **2**) |
| 2 | `milk` | Whole Milk | Dairy · Eggs (Aisle **4**) |
| 3 | `apple` | Gala Apples | Produce corner |

Additionally, one **tutorial anchor facing** of `water` is force-spawned at `(0.6, 1.0, 11.0)` — 2.2 m dead ahead of spawn, inside the `REACH = 2.7` grab radius after one step — so beat G3 can never fail for lack of a reachable target. It is a normal grabbable facing (Ch. 6/Ch. 16); grabbing it satisfies list slot 1.

**The beats.** "Trigger" is the condition to *enter*; "Check" is the condition to *advance*.

| Beat | `#greeter` caption (exact) | `.who` | Trigger | Completion check | Side effects |
|------|---------------------------|--------|---------|------------------|--------------|
| **G0** | *(none — silent)* | — | Boot hidden (`boot.display==='none'`) **and** `isFirstRun`. | 1 frame elapsed. | Suppress generic `#hint`; hide `#list`,`#timer`; place Dale; show Skip chip (10.5). Set Zen ruleset. |
| **G1** | `Welcome to Grocery Dash Supercenter! I'm Dale. Click anywhere to look around.` | `DALE · MANAGER` | Enter from G0. | `__isPlaying()===true` (pointer-lock **or** fallback drag-look engaged). | Dale plays `wave`. On enter, `SFX.listDone`. |
| **G1-fb** | `Welcome! I'm Dale. Drag with the mouse to look around.` | `DALE · MANAGER` | Same as G1 but `__isFallback()` already true (embed/iframe). | Camera yaw changed > 0.25 rad since enter. | Replaces G1 text when fallback is detected. |
| **G2** | `Good. Use W A S D to walk. Come find me over here.` | `DALE · MANAGER` | Enter from G1. | Player moved > 1.5 m from spawn **or** within 3.0 m of Dale. | `nudge`: `Tap W to step forward — I'm right here.` |
| **G3** | `See that case of water? Put the dot on it and press <span class="key">E</span> to take it.` | `DALE · MANAGER` | Enter from G2. | A `grab` event fires for `spec.id==='water'` (list slot 1 `got≥1`). | Glow already highlights the anchor (existing `game.js` hover glow, `#9fdcff`). On grab: `SFX.grab`+`SFX.tick`. `nudge`: `Aim the center dot at the water, then <span class="key">E</span>.` |
| **G4** | `That's your list, top-left. Grab the rest — Milk in Aisle 4, Apples in Produce.` | `DALE · MANAGER` | Enter from G3. | `game.state.listDone===true` (all 3 slots `got≥need`). | Reveal `#list` (fade-in) + `#timer`. Dale plays `point_aisle` toward aisle marquees. `nudge`: `Follow the aisle numbers hanging overhead — 4 for milk.` |
| **G5** | `Nice work. Stand in the green ring to check out.` | `DALE · MANAGER` | `listDone` becomes true (auto after G4). | `game.state.done===true` (checkout complete). | `checkoutRing.visible` is already true from `game.js`. Dale plays `point_ring`. `nudge`: `The glowing ring is by the registers — step into it.` |
| **G6** | `That's the whole game. Press <span class="key">R</span> any time for a fresh list. You're a natural.` | `DALE · MANAGER` | `done` becomes true. | 6000 ms dwell **or** `R` pressed. | Completion banner already shown by `game.js`. Dale plays `thumbs_up`. On enter: `SFX.checkout` (already fired). |
| **G7** | `One more thing — hold <span class="key">Shift</span> to sprint. But mind the shelves.` | `DALE · MANAGER` | Enter from G6. | 4500 ms dwell **or** any `Shift` held ≥ 0.3 s. | Teases the advanced layer without demonstrating a crash (that's opt-in, 10.9). |
| **G8** | *(none — graduation)* | — | Enter from G7. | 1 frame. | Set `gd3d.onb.done='1'`; clear `gd3d.onb.step`; restore Dale's collider + normal NPC brain; hide `#greeter`; hand control to the hint scheduler (10.6). Next `R` produces a **random 6-item** list; Zen ruleset ends unless the player chose Zen from the menu. Auto-open control card if `gd3d.card.autonew==='1'` (10.7). |

**Ordering & permissiveness.** The state machine advances strictly `G0→G8`, but each beat's check is evaluated against *global* game state, so a fast player who grabs all three list items before reading G2 will satisfy G3 and G4 in the same frame — the module fast-forwards captions honoring `CAPTION_MIN` (each still shows ≥ 2 s, queued back-to-back). A player who reaches checkout before Dale finishes G4 still advances; nothing strands.

**Crash resume.** On reload mid-tutorial, `gd3d.onb.step` restores the beat index, but the module re-derives satisfaction from live game state and skips forward past any already-true checks, so resume never replays a completed action.

---

### 10.5 Skip & replay logic

**Skip.** From beat G0 onward, a fixed **Skip chip** renders top-right, above boot z-order.

```
#onbskip { position:fixed; right:16px; top:16px; z-index:31; font-size:12.5px;
  color:#eef2f6; opacity:.72; background:rgba(10,14,18,.7);
  border:1px solid rgba(255,255,255,.16); border-radius:20px; padding:6px 12px;
  cursor:pointer; } /* text: "Skip intro ⏎" */
```

Skip triggers: click the chip, **or** press `Escape`, **or** press `Enter`. Any of them:

1. Fire `SFX.tick` (soft acknowledgement).
2. Jump the state machine to **G8** (graduation side effects run in full).
3. Set `gd3d.onb.done='1'`.
4. If the player had not yet reached G5, replace the curated list with a fresh random 6-item list and clear tutorial progress on it (no partial credit carries into scoring, Ch. 4).
5. Show one farewell `#toast` (2.6 s): `Skipped. Press ? any time for controls.`

Skip is idempotent and safe at any beat. Pressing `Escape` after G8 opens the pause menu (Ch. 6) instead — the Skip binding is unregistered at graduation.

**Replay.** Three entry points, all of which set `gd3d.onb.done='0'`, `gd3d.onb.step=0`, re-arm the module, and re-enter G0 at the next frame (repositioning the player to spawn, re-placing Dale, re-installing the curated list and anchor facing):

| Entry | Where | Notes |
|-------|-------|-------|
| Settings → **Replay tutorial** | Pause/Settings screen (Ch. 6) | Confirms with a one-line dialog; no destructive data loss. |
| `?tutorial=1` URL param | On load, before first-run predicate | Forces a run regardless of `gd3d.onb.done`; does **not** clear the flag afterward if it was already `1` (so a shared link doesn't nuke a veteran's state). |
| First-launch after a `gd3d.onb.v` bump | 10.2 migration | Silent; treated as a fresh first run. |

Hints (10.6) are **suspended** for the entire duration of any tutorial run (first or replay) and resume at G8; this prevents a hint firing on top of a Dale caption.

---

### 10.6 The progressive hint system

Distinct from the scripted walk-through, the **hint scheduler** is a lightweight, always-on advisor that fires contextual nudges during normal play when it detects the player is stuck or hasn't yet discovered a verb. It runs only after graduation (`gd3d.onb.done==='1'`) and never during a tutorial run.

**Channels.** A hint targets one of three existing nodes:

- `#hint` — bottom-center pill (`src/main.js`), for *control/discovery* nudges. Fade-in to `opacity:1`, hold, fade to `0`.
- `#toast` — top-center, 2.6 s auto-expiry (`src/physics.js`), for *reactive* one-liners tied to a world event.
- `#prompt` — reserved; the hint system never writes it (the game loop owns it).

**Scheduler rules (deterministic, single-slot).**

| Rule | Value / behavior |
|------|------------------|
| Concurrency | Exactly **one** hint visible at a time. A higher-priority ready hint preempts a lower one only if the lower has shown ≥ 1.5 s. |
| Global inter-hint gap | ≥ **12 s** between any two `#hint`-channel hints (`#toast` reactive hints are exempt — they ride real events). |
| Per-hint cooldown | Each hint's own `cooldown` (below) — minimum wall-clock between repeats of the *same* id. |
| Lifetime cap | `maxShows` per id, persisted in `gd3d.hints.shown`. At cap, the hint is retired forever. |
| Mastery suppression | The moment the hint's mechanic is *used*, the hint is retired early (e.g., once the player sprints, `sprint` never shows again) and its count is set to `maxShows`. |
| Display duration | `#hint` hold = `4500 ms` then fade; `#toast` = its native `2.6 s`. |
| SFX | Default silent. Discovery hints (`sprint`, `reroll`, `checkout_ring`) play the repurposed `SFX.error` at low peak as a subtle "psst" — the only new use of that otherwise-unused cue. Reactive toasts use their event's existing SFX. |
| User mute | If `gd3d.hints.muted==='1'`, only *reactive first-time* hints (`damage_first`, `tip_first`) still fire; all *nagging* discovery hints are silenced. A hint is muted by clicking it (pointer) — the click sets the flag and shows: `Tips off. Re-enable in Settings.` |

**The complete hint registry.** Every hint the game can show, enumerated. `trigger` is the predicate; all timings are wall-clock during active play (`__isPlaying()`).

| id | Channel | Text (exact) | Trigger | cooldown | maxShows | Priority |
|----|---------|--------------|---------|----------|----------|----------|
| `look_start` | `#hint` | `Drag to look · WASD move · E take item · M mute` | `__isFallback()` true and camera unrotated 3 s after play starts. | 30 s | 2 | 90 |
| `move_idle` | `#hint` | `WASD to walk around the store` | Playing, zero displacement for 6 s, no item grabbed. | 25 s | 3 | 80 |
| `list_here` | `#hint` | `Your shopping list is top-left ↖` | 15 s elapsed, `game.list` all `got===0`. | 40 s | 3 | 70 |
| `aisle_signs` | `#hint` | `Aisle numbers hang overhead — follow them` | 30 s elapsed, list progress unchanged for 20 s. | 45 s | 2 | 60 |
| `grab_hover` | `#hint` | `Press <span class="key">E</span> to take the item you're aiming at` | A `hover` target held ≥ 1.8 s with no `E`. | 20 s | 3 | 85 |
| `checkout_ring` | `#hint` | `List done — stand in the green ring to check out` | `listDone && !done`, and > 8 s since it went true, player > 4 m from ring. | 25 s | 3 | 88 |
| `checkout_early` | `#toast` | `Grab everything on the list first` | Player enters checkout radius (< 2.2 m) with `!listDone`. Fires once to reinforce the loop's own `#prompt`. | 30 s | 1 | 50 |
| `reroll` | `#hint` | `Press <span class="key">R</span> for a new list` | `done===true`, banner up ≥ 6 s, no `R`. | 15 s | 3 | 75 |
| `sprint` | `#hint` | `Hold <span class="key">Shift</span> to sprint` | 60 s cumulative walking, `Shift` never held. | 90 s | 2 | 40 |
| `mute` | `#hint` | `Press <span class="key">M</span> to mute sound` | 20 s elapsed, once, low priority filler when no other hint is queued. | — | 1 | 10 |
| `card` | `#hint` | `Press <span class="key">?</span> for the full controls` | 45 s elapsed and control card never opened. | 120 s | 1 | 20 |
| `damage_first` | `#toast` | `Damages cost 40% of price at checkout` | First time `physics.damage.count` goes from 0 → ≥ 1 in a non-Zen run. | — | 1 | 95 |
| `tip_first` | `#toast` | `Sprinting into shelves tips them — that's Style in Career mode` | First gondola tip ever (`gd3d.chal`/state), any mode. | — | 1 | 95 |
| `cart_first` | `#toast` | `You can shove carts around` | First player-cart contact with relative speed > 1.0 m/s. | — | 1 | 45 |
| `debris_grab` | `#toast` | `Floor items still count — aim and <span class="key">E</span>` | First time a *listed* SKU is knocked loose to the floor and not yet collected. | — | 1 | 65 |
| `challenge_near` | `#hint` | `Step on the ★ to start a challenge` | Player within 3 m of an un-completed challenge marker (10.9), first time near each marker type. | 60 s | 2 | 55 |
| `pause_hint` | `#hint` | `Press <span class="key">Esc</span> for options` | 90 s elapsed, once. | — | 1 | 15 |

**Priority tiebreak:** higher number wins; on equal priority the *older* ready hint wins; retired and cooling-down hints are excluded. Reactive `#toast` hints bypass the 12 s gap because they are anchored to a world event the player just caused (game-feel principle, Ch. 9 — feedback must be immediate).

**Persistence contract:** every fire increments `gd3d.hints.shown[id]`; the scheduler reads this at init so caps and mastery survive reloads. Reactive `_first` hints also write a boolean so they never re-fire across sessions.

---

### 10.7 Control card design

The control card is a non-modal reference overlay the player can summon at any time. It never pauses the sim (so a player can peek mid-run) but dims the world behind it.

**Binding:** `Slash` (the `?` key). Also opened by the `card` hint's clickable text and by a persistent `?` glyph in the HUD corner. Closing: `Slash` again, `Escape`, or click-outside. It is **auto-opened once**, for `2.8 s` then auto-dismissed, on the first *manual* play immediately after graduation if `gd3d.card.autonew==='1'`; dismissing it manually clears that flag.

**Node & style** (new `#controlcard`, z-index `20` — under boot `30`, over banner `14`):

```
#controlcard { position:fixed; inset:0; z-index:20; display:none;
  align-items:center; justify-content:center;
  background:rgba(6,9,12,.55); backdrop-filter:blur(3px); }
#controlcard .panel { width:min(440px,86vw);
  background:rgba(10,14,18,.94); border:1px solid rgba(255,255,255,.18);
  border-radius:16px; padding:22px 26px; color:#eef2f6;
  box-shadow:0 20px 60px rgba(0,0,0,.5); }
#controlcard h2 { font-size:16px; letter-spacing:.5px; margin-bottom:4px; }
#controlcard .sub { font-size:12px; opacity:.55; margin-bottom:16px; }
#controlcard .grid { display:grid; grid-template-columns:auto 1fr; gap:10px 16px; }
#controlcard .keys { display:flex; gap:4px; }
#controlcard kbd { border:1px solid rgba(255,255,255,.5); border-radius:6px;
  padding:2px 8px; font:700 12.5px ui-monospace,monospace; background:rgba(255,255,255,.04); }
#controlcard .lbl { font-size:13.5px; opacity:.9; align-self:center; }
#controlcard .foot { margin-top:16px; font-size:11.5px; opacity:.5;
  border-top:1px solid rgba(255,255,255,.1); padding-top:10px; text-align:center; }
```

**Exact contents** — a 2-column grid, one row per binding. All key glyphs are `<kbd>`; all labels are localizable strings (10.10).

| Keys (`<kbd>`) | Label (string id `ui.card.*`) |
|----------------|-------------------------------|
| `W` `A` `S` `D` | Move |
| `Shift` | Sprint |
| `Mouse` | Look |
| `E` | Take item |
| `R` | New list (after checkout) |
| `M` | Mute / unmute |
| `?` | Show / hide this card |
| `Esc` | Options · skip intro |

Header string `ui.card.title` = `Controls`, sub `ui.card.sub` = `Grab the list, dodge the shelves, check out.`, footer `ui.card.foot` = `Grocery Dash Supercenter`. On the fallback (drag-look) build, the `Mouse → Look` row's keys swap to `Drag` and the label to `Look (drag)` — detected via `__isFallback()`.

Accessibility hooks (Ch. 11): the card is the canonical, non-timed place all controls live, so nothing critical is *only* taught by a timed hint. Focus is trappable, `Escape`-dismissable, and the grid is a real `<dl>`/`<table>` for screen readers.

---

### 10.8 Zen mode as the tutorial substrate

The first run *is* Zen mode with Dale on top. This is deliberate: the calmest ruleset (Ch. 2) is also the safest classroom, and it becomes the player's permanent practice space and the home of all challenge markers (10.9).

**Zen ruleset deltas vs. the default timed loop** (Ch. 2 owns the canonical table; reproduced here for the parts onboarding depends on):

| Aspect | Timed / Career | Zen (and first-run) |
|--------|----------------|---------------------|
| `#timer` | Counts up; scored (Ch. 4). | Runs but shown dimmed (`opacity:.5`); never scored. |
| Damage billing | `physics.damage` billed at 40% and itemized on the checkout banner. | Accrues visually but is **zeroed** at checkout — the banner's damage line is suppressed. |
| Fail / soft-fail | Possible per mode. | None. |
| List size | 6 (random). | 3 curated during G0–G6, then 6 random. |
| Challenge markers | Hidden. | **Visible** (10.9). |
| Hint cooldowns | Table 10.6. | ×0.6 (more forgiving), and `sprint`/`card` `maxShows` raised to 4. |

**Flow from tutorial → Zen → real modes.** At graduation (G8), the module reads the entry route:

- Launched normally, no mode chosen → drop the Zen overrides, hand the player a random 6-item timed run (the shipped default), keep challenge markers hidden.
- Launched from the menu's **Zen** button (Ch. 6) → keep Zen overrides on; markers stay visible; this is the sandbox loop.
- Launched into a **Career shift** (Ch. 3) → apply that shift's ruleset; markers hidden unless the shift explicitly seeds one.

The important guarantee: a brand-new player can never lose or be billed during the very first thing they do. The world's consequences (tipping, damages, angry NPC barks) are all *reachable* in the tutorial — Dale's G7 line and the `tip_first`/`damage_first` hints point at them — but none *punish* until the player has opted into a mode that keeps score.

---

### 10.9 Teaching the advanced verbs — optional challenge markers

Sprint-tipping and style events are the game's expressive ceiling, but they must never be forced on a first-timer (rule 2) — a tutorial that ordered you to smash a shelf would read as griefing. Instead they are taught by **optional challenge markers**: opt-in floor decals in the Zen sandbox that a curious player *chooses* to step on.

**Marker visual & tech.** A challenge marker reuses the checkout-ring recipe (`RingGeometry(0.5, 0.68, 40)`, additive-friendly emissive) recolored gold, plus a floating billboard label. Cheap: two meshes per marker, no shadow, frozen — negligible against the Intel-iGPU floor.

```
color = 0xffd23b; emissive = 0xffd23b; emissiveIntensity = 0.9; opacity = 0.85
pulse: scale = 1 + sin(t*4)*0.08   // identical cadence to the checkout ring
label billboard: canvas texture, 0.9m wide, 1.6m above the ring, always faces camera
```

**Trigger:** player center within `1.1 m` (XZ) of the marker's world point. On trigger: `SFX.listDone`, marker ring turns solid, the objective HUD (reuses `#banner` styling in a compact top-center variant `#challenge`) appears, and a countdown/goal begins. Leaving the marker before starting cancels quietly.

**The two markers taught in this chapter.** Both live in the Zen sandbox at fixed points near an expendable, restockable gondola so a tip is consequence-free.

| Marker | World point | `#challenge` objective (exact) | Success check | Reward | On success | On fail/expire |
|--------|-------------|--------------------------------|---------------|--------|------------|----------------|
| **`chal.sprint_tip`** | `(-3.0, 0.02, 3.0)`, 4 m in front of grocery gondola island **4** | `SPRINT CHALLENGE — hold Shift and crash the shelf. 0 / 1` | A `tipGondola` event fires within 15 s of start (needs speed ≥ `TIP_SPEED` 4.0 into a shelf; sprint is 4.9, walk is 3.1, so it *requires* Shift). | Style points (Ch. 4) + achievement `demolition_debut` (Ch. 5); write `gd3d.chal.done += 'sprint_tip'`. | Banner: `💥 CLEANUP ON AISLE 4 — nailed it. +Style`; the store's own toast `📢 CLEANUP ON AISLE 4 — ALL OF IT.` fires from physics as usual. | Banner: `Not enough speed — hold Shift and commit. Try again?` Marker re-arms after 3 s. |
| **`chal.style_combo`** | `(-9.0, 0.02, 3.0)`, at the mouth of aisle **2** | `STYLE CHALLENGE — grab 3 items in 4 seconds. 0 / 3` | Three `grab` events within a rolling 4.0 s window. | Style points + achievement `quick_hands`; unlocks the Style HUD meter (Ch. 7) for subsequent runs. | Banner: `⚡ COMBO ×3 — smooth. +Style`; `SFX.checkout`. | Timer bar empties; banner `Combo dropped — reset. Try again?`; re-arm after 2 s. |

**`#challenge` node** (compact, z-index `12`, top-center at `top:96px`), a horizontal capsule with the objective text and, for `style_combo`, a 4 s draining progress bar (`#35c46a` fill on `rgba(255,255,255,.12)` track). It shares the panel palette with the rest of the HUD.

**Gating & telemetry.** Completing `sprint_tip` and `style_combo` sets flags in `gd3d.chal.done` that (a) retire the `tip_first`/`sprint` hints, (b) satisfy the "Rookie" onboarding achievement chain (Ch. 5), and (c) emit funnel events (10.11). Markers a player has completed render at 40% opacity and no longer trigger the objective — they become quiet trophies, not nags. Additional advanced markers (cart-bowling, aisle speed-runs, the full Style vocabulary) are defined in Ch. 3/Ch. 5 and seeded per Career shift; this chapter owns only the two *teaching* markers.

**Discovery, not obligation.** The player is pointed at markers exactly twice and gently: Dale's G7 tease ("hold Shift to sprint… but mind the shelves") and the `challenge_near` hint when they wander within 3 m. A player who never steps on a marker completes the entire base game unaffected — the markers gate *style scoring*, never *progress*.

---

### 10.10 Localization-readiness rules for every string

Every human-readable string in this chapter — and the shipped loop's strings it coexists with — is authored for localization from day one, even though v1 ships **English only**. The rules below make adding a locale a data drop, not a code change, and keep the default zero-network (the `en` table is embedded so first paint never waits on a fetch — critical for the no-backend build).

**10.10.1 The string table.** All copy moves out of markup into `src/strings/en.json`, a flat map of `id → ICU MessageFormat` string. Code references ids only (`t('onb.g1')`), never literals. A locale is `src/strings/<bcp47>.json`; missing keys fall back to `en` at load, logged once. The active locale is chosen by `?lang=`, then `navigator.language`, then `en`.

**10.10.2 ID scheme.** `namespace.key`, lowercase dot-separated, stable forever (renaming an id is a breaking change): `onb.*` (greeter beats), `hint.*` (registry), `ui.card.*` (control card), `chal.*` (challenges), `sys.*` (skip/toast system lines). Beat variants use suffixes (`onb.g1`, `onb.g1_fb`, `onb.g1_nudge`).

**10.10.3 Placeholders & grammar — no concatenation, ever.**

| Rule | Example |
|------|---------|
| Variables via ICU named args, never string-building. | `hint.checkout_early` may become `"Grab everything on the list first"`; the loop's `"{got}/{total}"` uses `{got, number}/{total, number}`. |
| Plurals via ICU `plural`. | `"{n, plural, =0 {No items left} one {# item left} other {# items left}}"` — never `n + " items"`. |
| Ordinals/aisles via `selectordinal` where a locale needs it. | Aisle labels are data (`"1".."8"`) passed as args, not baked. |
| Currency via `Intl.NumberFormat(locale,{style:'currency',currency})`. | The shipped `$${price.toFixed(2)}` becomes `t('fmt.price',{v:price})`; locale controls symbol, separators, position. |
| Time via a locale-aware `m:ss` formatter. | Shipped `fmt()` stays numeric; the *label* around it is localized. |
| Key names are data. | `<kbd>` glyphs (`W`,`Shift`,`E`) come from a `keys.*` table so a locale can localize "Shift" → "Maj" etc.; physical `e.code` bindings never change. |

**10.10.4 Length budgets.** Each channel has a hard character budget (measured on the narrowest supported viewport, ~360 px) that CI enforces per-locale (Ch. 23). Overflow is a build failure, not a runtime clip.

| Channel | Budget (chars, incl. spaces) | Wrap | Rationale |
|---------|------------------------------|------|-----------|
| `#toast` | ≤ 42, single line | no | 2.6 s read; must fit one line on mobile. |
| `#hint` pill | ≤ 48, may wrap to 2 lines | yes | Bottom pill, ≤ 2 lines. |
| `#greeter` caption | ≤ 96, up to 2 lines | yes | Lower-third, comfortable read. |
| `#banner` heading | ≤ 28 | no | Large type. |
| `ui.card` key label | ≤ 20 | no | 2-col grid, fixed key column. |
| `#challenge` objective | ≤ 44 | no | Compact capsule. |

Because many languages run ~30% longer than English (German, Finnish) and CJK run shorter but taller, budgets are set with ~35% headroom over the English source; the pseudoloc pass (below) validates this automatically.

**10.10.5 Pseudolocalization.** A build flag `?lang=en-XA` renders every string through a pseudo-transform: accent every vowel (a→á, e→é…), pad length +35%, and bracket with `⟦ ⟧`. Any clipping, missing `t()` call (raw ASCII leaking through brackets), or overflow surfaces instantly. Pseudoloc is part of the visual-regression suite (Ch. 23) and gates release.

**10.10.6 Bidi / RTL.** The document sets `dir` from the locale (`ar`, `he` → `rtl`). HUD anchoring uses logical properties (`inset-inline-start`) so `#list` (currently `left:18px`) flips to the right in RTL without per-string logic. `<kbd>` chips and the `n/total` fraction are wrapped in `<bdi>`/isolated with U+2068…U+2069 so numbers and Latin key glyphs never reorder inside RTL text.

**10.10.7 Fonts & emoji.** The system stack (`-apple-system, Segoe UI, Roboto, sans-serif`) covers Latin/Cyrillic/Greek; CJK and Arabic fall through to the OS default — acceptable for the no-backend build (no web-font download, protecting first paint and the iGPU boot budget). Emoji in strings (`✓ 🛒 ⚡ 💥 📢 ★`) are decorative-only and **never load-bearing**: every emoji-bearing string reads correctly with the glyph stripped (screen-reader and no-emoji-font safety, Ch. 11). The `✓/○` list checkmarks are already text, not images (`src/game.js`), and stay that way.

**10.10.8 The master onboarding string set.** Every string this chapter introduces, with its id, English source, and channel budget. (Shipped-loop strings — the `#hint` boot line, hover prompt, list header/foot, completion banner, physics toasts/bump/crash lines — are catalogued in Ch. 7/Ch. 17 under the same scheme; they are migrated to ids in the same pass.)

| id | English source | Channel |
|----|----------------|---------|
| `onb.g1` | Welcome to Grocery Dash Supercenter! I'm Dale. Click anywhere to look around. | greeter |
| `onb.g1_fb` | Welcome! I'm Dale. Drag with the mouse to look around. | greeter |
| `onb.g2` | Good. Use W A S D to walk. Come find me over here. | greeter |
| `onb.g2_nudge` | Tap W to step forward — I'm right here. | greeter |
| `onb.g3` | See that case of water? Put the dot on it and press E to take it. | greeter |
| `onb.g3_nudge` | Aim the center dot at the water, then E. | greeter |
| `onb.g4` | That's your list, top-left. Grab the rest — Milk in Aisle 4, Apples in Produce. | greeter |
| `onb.g4_nudge` | Follow the aisle numbers hanging overhead — 4 for milk. | greeter |
| `onb.g5` | Nice work. Stand in the green ring to check out. | greeter |
| `onb.g5_nudge` | The glowing ring is by the registers — step into it. | greeter |
| `onb.g6` | That's the whole game. Press R any time for a fresh list. You're a natural. | greeter |
| `onb.g7` | One more thing — hold Shift to sprint. But mind the shelves. | greeter |
| `onb.who` | DALE · MANAGER | greeter label |
| `sys.skip` | Skip intro ⏎ | skip chip |
| `sys.skipped` | Skipped. Press ? any time for controls. | toast |
| `sys.tips_off` | Tips off. Re-enable in Settings. | toast |
| `hint.look_start` | Drag to look · WASD move · E take item · M mute | hint |
| `hint.move_idle` | WASD to walk around the store | hint |
| `hint.list_here` | Your shopping list is top-left ↖ | hint |
| `hint.aisle_signs` | Aisle numbers hang overhead — follow them | hint |
| `hint.grab_hover` | Press E to take the item you're aiming at | hint |
| `hint.checkout_ring` | List done — stand in the green ring to check out | hint |
| `hint.checkout_early` | Grab everything on the list first | toast |
| `hint.reroll` | Press R for a new list | hint |
| `hint.sprint` | Hold Shift to sprint | hint |
| `hint.mute` | Press M to mute sound | hint |
| `hint.card` | Press ? for the full controls | hint |
| `hint.damage_first` | Damages cost 40% of price at checkout | toast |
| `hint.tip_first` | Sprinting into shelves tips them — that's Style in Career mode | toast |
| `hint.cart_first` | You can shove carts around | toast |
| `hint.debris_grab` | Floor items still count — aim and E | toast |
| `hint.challenge_near` | Step on the ★ to start a challenge | hint |
| `hint.pause_hint` | Press Esc for options | hint |
| `ui.card.title` | Controls | card |
| `ui.card.sub` | Grab the list, dodge the shelves, check out. | card |
| `ui.card.foot` | Grocery Dash Supercenter | card |
| `ui.card.move` | Move | card |
| `ui.card.sprint` | Sprint | card |
| `ui.card.look` | Look | card |
| `ui.card.look_drag` | Look (drag) | card |
| `ui.card.take` | Take item | card |
| `ui.card.reroll` | New list (after checkout) | card |
| `ui.card.mute` | Mute / unmute | card |
| `ui.card.help` | Show / hide this card | card |
| `ui.card.options` | Options · skip intro | card |
| `chal.sprint.obj` | SPRINT CHALLENGE — hold Shift and crash the shelf. {got}/{total} | challenge |
| `chal.sprint.win` | 💥 CLEANUP ON AISLE {n} — nailed it. +Style | banner |
| `chal.sprint.fail` | Not enough speed — hold Shift and commit. Try again? | banner |
| `chal.style.obj` | STYLE CHALLENGE — grab {total} items in {secs} seconds. {got}/{total} | challenge |
| `chal.style.win` | ⚡ COMBO ×{n} — smooth. +Style | banner |
| `chal.style.fail` | Combo dropped — reset. Try again? | banner |

---

### 10.11 Telemetry & the onboarding funnel

Onboarding emits a compact event stream so the team can see exactly where new players fall off. In the no-backend build these events buffer in memory and are inspectable via `window.__onbFunnel`; with the optional backend (Ch. 24) they POST on a debounced flush. No PII; events are anonymous counters keyed to a session id.

| Event | Fired when | Payload |
|-------|-----------|---------|
| `onb_start` | Enter G0. | `{firstRun, fallback}` |
| `onb_beat` | Each beat advance. | `{from, to, ms_on_beat, via:'check'\|'timeout'\|'nudge'}` |
| `onb_skip` | Skip invoked. | `{beat, method:'esc'\|'enter'\|'click'}` |
| `onb_complete` | Enter G8. | `{total_ms, skipped}` |
| `onb_replay` | Replay entry. | `{source}` |
| `hint_show` | Any hint fires. | `{id, channel, show_count}` |
| `hint_dismiss_all` | User mutes tips. | `{id}` |
| `chal_start` / `chal_win` / `chal_fail` | Marker lifecycle. | `{id, ms}` |

Funnel KPIs (Ch. 24 owns targets): G0→G8 completion rate, median `total_ms` (design target ≤ 90 s), per-beat drop-off (G3 "first grab" and G5 "first checkout" are the watched cliffs), and post-tutorial 60-second retention (did they press `R` at least once).

---

### 10.12 Testing, acceptance & Definition of Done

Onboarding is verified through the `window.__*` debug hooks already exposed by `src/main.js` (`__setPlaying`, `__isFallback`, `__game`, `__camera`, `__physics`) plus new `__onb` hooks (`__onb.beat`, `__onb.force(step)`, `__onbFunnel`) and the documented framebuffer-grid capture practice.

| Test | Method | Pass criterion |
|------|--------|----------------|
| Cold first run | Clear `localStorage`, load, script G1→G8 via real inputs. | Reaches G8; `gd3d.onb.done==='1'`; no console error. |
| Fallback path | Force `pointerlockerror`; run G1-fb. | Drag-look variant shows; tutorial completes. |
| Skip at each beat | `__onb.force(n)` then `Escape`. | Jumps to G8 cleanly from every `n`; farewell toast; random 6-item list installed. |
| Replay | Trigger all 3 replay entries. | Fresh G0; player re-spawned; Dale + anchor re-placed. |
| Crash resume | Reload mid-beat. | Resumes at committed step, skips already-satisfied checks. |
| Hint caps | Drive each hint to `maxShows`. | Retires at cap; counts persist across reload. |
| Hint concurrency | Force two triggers same frame. | Exactly one visible; priority honored; 12 s gap respected. |
| Challenge markers | Complete + fail each. | Correct banner; `gd3d.chal.done` written; re-arm timing correct; retired markers dim. |
| Private mode | `localStorage` throws. | In-memory shim; tutorial runs; no crash. |
| Pseudoloc | `?lang=en-XA`. | No clipping, no raw untranslated strings, all budgets pass. |
| RTL | `?lang=ar` (stub). | HUD mirrors; numbers/keys stay LTR-isolated. |
| Perf | Framebuffer capture with greeter + 2 markers active on the iGPU tier. | Frame time delta from baseline < 1 ms; tier never forced to `panic` by onboarding. |

**Definition of Done for Chapter 10:** a player who has never seen the game reaches their first checkout unaided in under 90 seconds; can skip in one key at any moment; can replay from the menu; is nudged — never blocked — by at most one hint at a time that never repeats past its cap; discovers sprint-tipping and style combos only if they choose to; and every character of on-screen copy is an id in the string table, within budget, and passes pseudoloc — all inside the browser, with no backend, on the Intel-iGPU floor.

---

*Cross-references: Ch. 2 (Zen ruleset), Ch. 3 (Career shifts seeding markers), Ch. 4 (Style scoring, damage economy), Ch. 5 (achievements `demolition_debut`/`quick_hands`, Rookie chain), Ch. 6 (menu, Settings, pause), Ch. 7 (HUD nodes), Ch. 8 (input bindings), Ch. 9 (game-feel/immediacy of feedback), Ch. 11 (accessibility of the control card & emoji), Ch. 17 (Dale's retargeted avatar & barks), Ch. 18 (repurposed `SFX.listDone`/`error`), Ch. 19 (`src/onboarding.js` module), Ch. 20 (persistence schema, optional cloud mirror), Ch. 23 (pseudoloc + funnel tests), Ch. 24 (telemetry targets).*



# Chapter 11 — Accessibility — Production Bar

Accessibility in *Grocery Dash 3D* is not a menu bolted onto a finished game — it is a contract with the shipped systems. Every value in this chapter is derived from the running code: the FOV of `62°` (`new THREE.PerspectiveCamera(62, …)` in `src/main.js`), the head-bob amplitudes of `0.03`/`0.045 m` and frequencies `10.5`/`13.5`, the screen-shake scalar in `[0,1]` decaying at `1.6/s` and applied as `(Math.random()-0.5) * shake * 0.12` to camera-Y, the eight WebAudio cues in `src/sfx.js`, and the six semantic HUD colors in `index.html` + `src/game.js` + `src/store.js`. Nothing here contradicts shipped behavior; everything extends it. The game runs in the browser with no backend and must stay smooth on the Intel-iGPU floor, so persistence is `localStorage` and every option is chosen so that turning it **on cannot cost frames** (most accessibility paths are net-cheaper — fewer bloom passes, no backdrop blur, frozen effects). See Ch. 7 (HUD), Ch. 8 (Input), Ch. 9 (Game-feel), Ch. 18 (Audio), Ch. 21 (Rendering/Performance) for the systems this chapter parameterizes.

### 11.1 Accessibility Pillars & the Production Bar

Four pillars, each with a hard, testable bar:

| Pillar | Bar (Definition of Done, see Ch. 26) |
| --- | --- |
| **Playable to completion** | The full loop — 6-item list → `E` grab → checkout ring `(-7.65, 11.1)` → banner → `R` reroll — is completable with a single hand, with no audio, with no color perception, and with all motion disabled. |
| **No barrier is a wall** | Every input is remappable; every audio cue has a visual twin; every color-coded state also carries a glyph and a brightness delta. Redundancy, never substitution. |
| **Live, non-destructive** | 100% of settings apply on the next frame with **no reload** and no run restart. A player mid-aisle can flip Reduced Motion and keep shopping. |
| **Cost-neutral on the floor** | No accessibility toggle may push the lite/panic tier (`src/main.js` `autoQuality`) below its `<20 ms` upgrade gate. Flash-safe and high-contrast paths *reduce* draw cost. |

### 11.2 Settings Architecture

The menu lives in two entry points, both already reachable with shipped plumbing:

1. **Pre-game panel** — a card on the boot/hint screen (`#hint` in `index.html`) exposes a **Accessibility** button before the first pointer-lock click. Nothing is locked yet, so the cursor is free.
2. **Pause overlay** — pressing `Esc` releases pointer-lock (browser default; `controls.addEventListener('unlock', …)` already fires). We add an overlay `#a11y` at `z-index: 40` (above `#banner`'s `14`, below the error `#pre`'s `99`) that pauses the loop by setting `__setPlaying(false)` and dims the scene with a `rgba(0,0,0,.55)` scrim. Closing it re-locks or re-enables fallback drag-look.

The overlay is organized into six tabs mirroring §11.3–§11.8: **Motion**, **Photosensitivity**, **Vision**, **Audio**, **Motor**, **Cognitive**, plus a **Presets** row (§11.9). A live preview strip at the bottom renders a miniature HUD (list row, timer `0:47`, a crash caption) so changes are seen, not imagined.

Every control writes through a single `A11Y` singleton (`src/a11y.js`, new module, additive) that owns the state object, applies it live, and mirrors it to `localStorage` (§11.10). Read order at boot: defaults → merge `localStorage` → merge URL query (`?a11y=photosafe` for shareable presets, no personal data in the query per privacy rules) → apply.

### 11.3 Motion & Camera

The shipped camera has three motion sources: **head-bob** (`camera.position.y = 1.65 + Math.sin(bob) * amp`), **screen-shake** (the `physics.shake` term), and an *optional, additive* **sprint kick / speed-lines** pair defined in Ch. 9 and gated here. Every one is tunable.

**11.3.1 Field of View slider.** Base `62°`. The camera is a `PerspectiveCamera`; the slider writes `camera.fov` then calls `camera.updateProjectionMatrix()` on change (once, not per frame).

| Setting | Range / Values | Default | Step | Notes |
| --- | --- | --- | --- | --- |
| FOV | `60°–100°` | `62°` | `1°` | Higher FOV widens periphery (helps some motion sensitivity), but pulls more facings into the frustum. On `panic` tier the value is soft-clamped to `≤90°` to protect the `~988 draws / 1.38M tris` worst view (Ch. 21). At `100°` the horizontal visible span is ~1.6× the `62°` baseline. |
| FOV changes vertical too | derived | — | — | three.js `.fov` is vertical FOV; a 16:9 view at vertical `62°` ≈ horizontal `88°`. Documented so QA reads the number correctly. |

**11.3.2 Motion toggles.** Each maps to an exact code path:

| Toggle | Values | Default | Exact effect |
| --- | --- | --- | --- |
| **Head-bob** | On / Reduced / Off | On | On = shipped `Math.sin(bob) * (SPEED>4 ? 0.045 : 0.03)`. **Reduced** halves the amplitude to `0.0225`/`0.015`. **Off** forces the bob term to `0` (eye stays flat at `1.65 m`); the `bob` accumulator still advances so re-enabling is seamless. |
| **Screen-shake scalar** | `0%–150%` | `100%` | Multiplies the jitter term: `(Math.random()-0.5) * shake * 0.12 * shakeScale`. At `0%` the camera never jitters; the underlying `shake` value and all its SFX/toasts still fire. At `150%` the max displacement rises from `±0.06 m` to `±0.09 m`. |
| **Sprint camera kick** | On / Off | On | Governs the optional Ch. 9 FOV punch on sprint (`62°→68°` over `0.25 s`, ease-out cubic). Off pins FOV to the slider value regardless of speed. |
| **Sprint speed-lines (streak)** | On / Off | Off on `lite`/`panic`, else On | Governs the additive radial streak overlay drawn at `Shift` speed (`4.9 m/s`). Off removes the overlay entirely. Force-Off is implied by Photosensitive mode (§11.4) and by Reduced-Motion preset. |
| **Vignette** | On / Off | On | The shipped static `#vignette` (`radial-gradient(115% 90% at 50% 46%, transparent 62%, rgba(0,0,0,.32))`). Off sets `#vignette { display:none }`. |
| **Item-fly animation** | Full / Instant | Full | Full = shipped `0.4 s` arc (`f.t += dt/0.4`, sine hop `+0.3 m`, spin `dt*7`). **Instant** snaps the flyer straight to basket in one frame — removes the swooping arc for vestibular comfort while keeping the grab feedback. |

**11.3.3 Reduced-Motion master.** A single switch (also set by OS `@media (prefers-reduced-motion: reduce)` on first load) that composes: Head-bob → Off, Shake → `0%`, Sprint kick → Off, Speed-lines → Off, Item-fly → Instant, all CSS transitions (`#toast .25s`, `#hint .3s`, `#boot .6s`) shortened to `0s`. It does **not** touch FOV (personal preference).

### 11.4 Photosensitivity

*Grocery Dash 3D* ships nothing that flashes faster than 3 Hz, but bloom on emitters and additive glows are the risk surface. Photosensitive-Safe mode is preventative: it caps every luminance-pulsing source below the WCAG 2.3.1 general-flash threshold (no full-screen relative-luminance change of >10% more than **3 times per second**, and no single flash occupying >25% of the viewport at >0.10 luminance delta).

**11.4.1 Bloom cap.** The shipped `UnrealBloomPass` is `(resolution ½, strength 0.16, radius 0.5, threshold 0.96)`.

| Parameter | Shipped | Photosensitive-Safe | Slider range |
| --- | --- | --- | --- |
| Bloom strength | `0.16` | `0.04` | `0.00–0.16` |
| Bloom threshold | `0.96` | `0.99` | `0.90–0.99` (higher = only the very brightest emitters bloom) |
| Bloom radius | `0.5` | `0.5` | fixed |

At `0.00` strength the pass is skipped entirely (`bloom.enabled = false`) — a small perf win on the iGPU floor.

**11.4.2 Emissive cap.** A global `emissiveScale ∈ [0,1]` multiplies every emissive material's `emissiveIntensity` at apply time. Every shipped emitter, enumerated with its base and its Safe value (`×0.5`):

| Emitter (source) | Base `emissiveIntensity` | Safe (`×0.5`) |
| --- | --- | --- |
| Ceiling troffers (`store.js:681`) | `2.1` | `1.05` |
| Freezer LED strips (`store.js:181`) | `1.6` | `0.80` |
| Checkout ring (`store.js:1388`) | `1.0` | `0.50` |
| Streetlamp heads (`store.js:659`) | `2.4` | `1.20` |
| Table lamp bulbs (`store.js:833`) | `2.1` | `1.05` |
| Pendant/aisle-sign glow (`store.js:886,1122`) | `0.38`/`0.45` | `0.19`/`0.225` |
| Car taillights (`store.js:502`) | `0.65` | `0.325` |
| Lane number lamps (`store.js:282`) | `0.20` | `0.10` |
| Freezer glass envMap | (reflective, not emissive) | unchanged |

**11.4.3 Flash suppression.** Beyond the caps, Safe mode: (a) disables the sprint speed-lines and sprint FOV kick (§11.3); (b) clamps `shakeScale ≤ 0.20` so the crash jolt (`addShake(0.35)`) can never produce a >`±0.02 m` full-frame lurch; (c) replaces the checkout-ring reveal (a bright pop) with a `250 ms` linear fade-in of `opacity 0→0.85`; (d) forbids any future full-screen white/red flash from the damage system — the salmon damages line stays a static chip, never a pulse. A boot-time self-check (`__flashAudit`, Ch. 23) samples the framebuffer luminance histogram over 90 frames and asserts no >10% delta recurs above 3 Hz; CI fails the build if Safe mode ever violates it.

### 11.5 Vision

**11.5.1 Semantic color roles.** Six roles carry all HUD meaning. Their shipped hex, and their contrast against the panel background (`rgba(10,14,18,.78)` composited over body `#0b0d10` ≈ effective `#0A0E12`, relative luminance `L≈0.0042`), computed by the WCAG formula:

| Role | Shipped hex | Rel. luminance | Contrast vs panel | Where it lives |
| --- | --- | --- | --- | --- |
| **Success / Got / Checkout** | `#35C46A` | 0.413 | **8.56:1** | list check, `#list .row.ok .chk`, checkout ring, boot bar |
| **Highlight / Interactable** | `#9FDCFF` | 0.658 | **13.08:1** | hover glow box (`0x9fdcff`, opacity 0.28 additive) |
| **Warning / Damage** | `#E8907F` | 0.387 | **8.06:1** | store-damages line (`color:#e8907f`) |
| **Neutral text** | `#EEF2F6` | 0.883 | **17.2:1** | body text, timer, list rows |
| **Timer urgent** | `#FFC24B` (new) | 0.62 | ~12:1 | timer at <30 s in timed modes (Ch. 2/4) |
| **Target ring / waypoint** | `#35C46A` | 0.413 | 8.56:1 | checkout ring, cognitive waypoint (§11.8) |

All six clear WCAG AAA text contrast (`≥7:1`) and non-text contrast (`≥3:1`) on the shipped panel. This is the baseline the colorblind palettes must preserve.

**11.5.2 Colorblind palettes.** Five palettes. Every one keeps the six roles ≥4.5:1 on the panel **and** separates the three status roles (Success / Highlight / Warning) on the deficiency's safe axis. Color is never the sole signal — each status also carries a **glyph** and a **brightness tier**, listed once here and enforced in every palette:

- Success → glyph `✓`, brightness tier HIGH
- Highlight → glyph `◇` (aim reticle diamond), brightness tier MEDIUM, plus the glow box gains a `2px` animated outline
- Warning → glyph `⚠`, brightness tier MEDIUM, plus the chip background inverts

| Role | Default | Protanopia | Deuteranopia | Tritanopia | Monochrome / Hi-Contrast |
| --- | --- | --- | --- | --- | --- |
| Success | `#35C46A` | `#33B5E5` | `#29B6F6` | `#2ED17A` | `#FFFFFF` (filled `✓`) |
| Highlight | `#9FDCFF` | `#F5E663` | `#FFE14D` | `#FF6FB0` | `#FFFFFF` (`◇` + 2px pulse ring) |
| Warning | `#E8907F` | `#FF8A3D` | `#FB8C3B` | `#E8445A` | inverted chip: `#000` on `#FFF` |
| Neutral text | `#EEF2F6` | `#EEF2F6` | `#EEF2F6` | `#F2F2F2` | `#FFFFFF` |
| Timer urgent | `#FFC24B` | `#FF8A3D` | `#FB8C3B` | `#E8445A` | `#FFFFFF` + blink `1 Hz` (disabled if Photosensitive) |
| Ring / waypoint | `#35C46A` | `#33B5E5` | `#29B6F6` | `#2ED17A` | `#FFFFFF` |

The palette also swaps the **3D** hover glow material color (`glow.material.color.set(hex)` on the shared box in `src/game.js`) and the checkout-ring material color (`world.checkoutRing.material.color/emissive`) so the world signals match the HUD. Protan/Deutan move status onto the blue↔yellow/orange axis; Tritan moves it onto the green↔magenta/red axis; Monochrome drops hue entirely and relies on brightness tier + glyph + the inverted warning chip.

**11.5.3 Font scale.** A single `--ui-scale` CSS variable (default `1.0`) multiplies every HUD font-size. Range **80%–160%**, step `10%`. Panels use `em`/`ch` min-widths so they reflow instead of clipping (`#list min-width` scales from `210px` to `≈336px` at 160%). Every shipped size and its worked endpoints:

| Element | Base | @ 80% | @ 160% |
| --- | --- | --- | --- |
| `#timer` | `22px` | `17.6px` | `35.2px` |
| `#list .row` | `13.5px` | `10.8px` | `21.6px` |
| `#list h3` | `11.5px` | `9.2px` | `18.4px` |
| `#list .foot` | `11px` | `8.8px` | `17.6px` |
| `#prompt` | `14.5px` | `11.6px` | `23.2px` |
| `#prompt .key` | `12.5px` | `10px` | `20px` |
| `#banner` body | `16px` | `12.8px` | `25.6px` |
| `#banner h2` | `22px` | `17.6px` | `35.2px` |
| `#banner .big` (time) | `34px` | `27.2px` | `54.4px` |
| `#toast` / captions | `14.5px` | `11.6px` | `23.2px` |
| `#hint` | `13px` | `10.4px` | `20.8px` |

At 160% the banner never exceeds `min(92vw, 640px)`; long product names in the prompt wrap to two lines rather than overflow.

**11.5.4 High-contrast HUD mode.** Independent of palette. Applies: panel background opacity `.78 → .96`; border `rgba(255,255,255,.14) → rgba(255,255,255,.9)` at `2px`; text `#EEF2F6 → #FFFFFF`; adds `text-shadow: 0 1px 2px #000`; removes `backdrop-filter: blur(4px)` (also a perf win on the iGPU floor); crosshair opacity `.85 → 1.0` with a `2px` black outline ring. Guarantees ≥7:1 for text and ≥4.5:1 for the `#list .row.ok` struck-through state (which shipped at `opacity .48` — high-contrast raises it to `.75` so completed rows stay legible).

### 11.6 Audio → Visual Substitution

Audio is fully procedural (`src/sfx.js`), non-positional, single `master.gain = 0.45`. Every one of the eight cues gets a visual twin. Two systems deliver them: a persistent **sound-state icon** (top-right, left of `#timer`) showing 🔊/🔇 and a live level ring, and a **captions line** (`#captions`, bottom-center at `bottom: 52px`, above `#prompt`'s `84px`, styled like `#toast`) that prints bracketed sound descriptions with a directional arrow derived from the emitter's world position vs `camera` yaw.

| Cue (`SFX.*`) | Sound (from `sfx.js`) | Visual substitution |
| --- | --- | --- |
| `grab()` | triangle `520→800 Hz`, `0.12 s` | Item name chip flashes on the reticle for `0.4 s`; a `+1` floats up from the reticle. |
| `tick()` | square `880 Hz`, `0.07 s` | The satisfied list row animates its `○→✓`, strikes through, and pulses its `#35C46A` check once (`120 ms`). |
| `listDone()` | triangle `660`→`880`, `100 ms` apart | Banner "✓ List complete — head to CHECKOUT" (shipped) **plus** the checkout ring's on-screen edge marker begins pulsing; caption `[list complete]`. |
| `checkout()` | arpeggio `523/659/784/1046 Hz`, `90 ms` apart | Results banner (shipped, fully visual). Caption `[checkout ✓]`. |
| `error()` | sawtooth `300→190 Hz`, `0.18 s` | The relevant HUD element (prompt or list) flashes a `2px` Warning-role border for `200 ms`; caption `[can't take that]`. |
| `thud()` | noise `260 Hz` + sine `90→55 Hz`, `0.14 s` | Directional screen-edge nudge: a `120 ms` Warning-tinted glow on the frame edge nearest the impact; caption `[bump ←]`. Respects `shakeScale`/Reduced-Motion (edge glow only, no camera move). |
| `crash()` | noise `900 Hz` `0.5 s` + sine `70→40 Hz` + noise `500 Hz` @120 ms | Caption `[shelf crash ↙]` with a bold Warning icon `💥` and a directional arrow; the existing toast bark still shows. Edge glow at `0.6` intensity. |
| `clatter()` | 4 square blips `700–1200 Hz` @ `0/60/130/210 ms` | Caption `[clatter]`; small debris-icon shimmer at the frame edge nearest the pile. |
| store hum (ambient loop) | noise → lowpass `240 Hz`, gain `0.018` | The 🔊 icon shows a faint steady ring so deaf/HoH players know ambient audio is present and functioning. |

**11.6.1 Caption controls.** Captions toggle On/Off (default Off; On when OS `prefers-reduced-transparency` or a first-run "I play without sound" prompt is chosen), size follows `--ui-scale`, directional arrows toggle separately, and duration follows the cognitive dwell multiplier (§11.8) so `[shelf crash]` lingers `2.6 s × factor`. All barks (the shipped `CRASH_LINES`/`BUMP_LINES`/cleanup toasts in `src/physics.js`) are already visual text and count as captions — the caption system simply unifies their placement and reading time.

**11.6.2 Audio settings.** Master volume slider `0–100%` (writes `master.gain`, shipped max `0.45`; slider maps `100% → 0.45`); an independent **SFX** vs **Ambient** split (ambient = the `0.018` hum bus, so it can be muted alone); a **mono** confirmation flag reserved for the Ch. 18 spatial-audio upgrade (current audio is already mono, so the toggle is inert but present so the contract is honored the day stereo ships); `M` still hard-mutes everything (`SFX.toggleMute()`).

### 11.7 Motor

**11.7.1 Toggle vs Hold.** Two shipped inputs are held; both gain a toggle:

| Action | Shipped | Toggle option | Behavior when toggled |
| --- | --- | --- | --- |
| Sprint (`Shift`) | Hold `ShiftLeft`/`ShiftRight` for `4.9 m/s` | **Sprint = toggle** | Tap `Shift` to latch run; tap again for walk (`3.1 m/s`). Latch clears on stop to avoid runaway sprint-crashes (`≥4.0 m/s` tips gondolas). |
| Look (fallback drag) | Hold pointer down + drag (`0.0042 rad/px`) | **Look latch** | Click once to begin look, move freely, click to end. Only affects the drag-look fallback path; pointer-lock is unaffected. |
| Grab (`E`) | Single press | (already press, no hold) | — |

**11.7.2 One-handed presets.** Full remap tables. Both complete the entire loop one-handed; sprint defaults to *toggle* in both.

| Action | Default | **Left-hand only** | **Right-hand only** |
| --- | --- | --- | --- |
| Move fwd/back | `W`/`S` (or `↑`/`↓`) | `W`/`S` | `↑`/`↓` |
| Strafe L/R | `A`/`D` | `A`/`D` | `←`/`→` |
| Sprint (toggle) | `Shift` | `Q` | `.` (period) |
| Grab | `E` | `E` or `R` | `Numpad0` / RMB |
| Reroll list | `R` | `F` | `Numpad Enter` |
| Mute | `M` | `1` | `Numpad*` |
| Look | mouse / drag | trackball or drag-look | mouse |

A **mouse-only** sub-preset (no keyboard at all) is available on top of Right-hand: look = mouse, move = hold **RMB** to walk toward the reticle, grab = **LMB** on a highlighted item, reroll = an on-screen `↻` button in the results banner. This leans on grab-assist (§11.7.4) so precise aim is not required.

**11.7.3 Full input remapping.** Every action is rebindable via a "press a key" capture in the Motor tab; conflicts are flagged inline. The complete default table (superset of `src/main.js` + `src/game.js` handlers):

| Action | Default binding(s) | Rebindable | Code path |
| --- | --- | --- | --- |
| Move | `W A S D` + `↑ ↓ ← →` | Yes | `keys.KeyW…` / `keys.ArrowUp…` in `move()` |
| Sprint | `ShiftLeft` `ShiftRight` | Yes | `SPEED_RUN` branch |
| Grab / take | `KeyE` | Yes | `tryGrab()` |
| Reroll (after checkout) | `KeyR` | Yes | `reset()` gated on `done` |
| Mute | `KeyM` | Yes | `SFX.toggleMute()` |
| Pause / a11y overlay | `Escape` | No (browser-reserved) | pointer-lock unlock |

Bindings persist per §11.10. A "Reset to defaults" button restores the table above.

**11.7.4 Grab assist.** The shipped reticle raycast is a single ray (`REACH = 2.7`, center NDC `(0,0)`), and floor debris within a `20 m²` squared-distance window is also considered. Grab-assist widens the funnel in three escalating tiers:

| Assist | Off (default) | Standard | Strong |
| --- | --- | --- | --- |
| Reach | `2.7 m` | `3.2 m` | `3.5 m` |
| Aim cone (sphere-cast radius) | `0` (single ray) | `0.08 rad` (~4.6°) | `0.14 rad` (~8°) |
| List magnetism | off | reticle nudges ≤`0.05 rad` toward the nearest *unfound list item* in cone | ≤`0.10 rad` |
| Dwell-to-grab | off | look at a highlighted item `0.8 s` → auto-fire `tryGrab()` | `0.5 s` |

Magnetism only ever targets items still on the shopping list, so it can never grab the wrong thing. Dwell-to-grab makes the loop keyboard-free above the movement keys and pairs with the mouse-only preset. All assists respect the existing `hover`/`glow` visual so the player always sees what will be grabbed before it flies.

### 11.8 Cognitive

**11.8.1 Objective simplification.**

| Setting | Values | Default | Effect |
| --- | --- | --- | --- |
| List length | `6 / 4 / 3` | `6` | Reduces the `while (picks.length < 6 …)` target in `genList()`. Fewer concurrent objectives. |
| Section hints | Off / On | Off | Each list row appends its `section` tag (one of the 9 sections) and aisle label, e.g. "Spring Water · *snacks, freezer wall*". |
| Waypoint compass | Off / On | Off | A `#35C46A` chevron on the reticle points toward the nearest unfound list item's known shelf, then toward the checkout ring once the list is done. Uses the Target/waypoint role color (palette-swapped). |
| Shelf highlight | Off / On | Off | The shelf facings holding an unfound list item get a persistent low-intensity tint of the Highlight role color (additive, `opacity 0.12`) so scanning is not required. |

**11.8.2 No-fail / Relaxed assists.** The shipped loop has **no fail state** — the timer counts *up*, damages are billed but never end the run. Relaxed mode goes further by muting all penalty pressure:

| Assist | Effect on shipped systems |
| --- | --- |
| Suppress damage billing | `damageTotal`/`damageCount` still tracked internally but the results banner omits the `#e8907f` damages line; the run reads as clean. |
| Disable gondola tipping | Sprint-crashes (`≥4.0 m/s`) no longer tip whole gondolas (skip `addShake(0.9)` + the 56-item spill); they still bump. Removes the biggest chaos + shake event. |
| Disable NPC stagger & barks | Bumping the 13 avatars no longer staggers the player or fires `BUMP_LINES`; NPCs simply path around. |
| Hide timer | The `#timer` element is hidden for players who find the counting clock stressful; the loop is otherwise identical. |
| Calm world | Composes all four above + Reduced-Motion + Photosensitive caps into one switch. |

**11.8.3 Extended timers & UI dwell.** The default endless mode has no countdown, so "extended timers" governs (a) any timed mode ruleset in Ch. 2 / Ch. 4 and (b) every auto-hiding UI element's dwell, so slower readers keep pace:

| Multiplier | Timed-mode budget | Banner auto-hide (base `1600 ms`) | Toast/caption (base `2600 ms`) | Prompt/hint linger |
| --- | --- | --- | --- | --- |
| **Off (default endless)** | no limit | `1600 ms` | `2600 ms` | shipped |
| **×1.5** | budget × 1.5 | `2400 ms` | `3900 ms` | ×1.5 |
| **×2** | budget × 2.0 | `3200 ms` | `5200 ms` | ×2 |

The multiplier is a single control; choosing ×1.5/×2 both eases any Ch. 2 time-attack ruleset and lengthens how long the crash caption, list-complete banner, and grab prompt stay on screen.

### 11.9 Defaults, Presets & the Live-Apply Matrix

Seven one-tap presets. Each writes only the cells shown; unlisted settings keep their current value (presets compose, so "Photosensitive + Low Vision" is legal).

| Setting | **Default** | Reduced Motion | Photosensitive | Low Vision | One-Handed (L/R) | Relaxed | No-Audio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FOV | 62° | 62° | 62° | 62° | 62° | 62° | 62° |
| Head-bob | On | Off | — | — | — | Off | — |
| Screen-shake | 100% | 0% | ≤20% | — | — | 0% | — |
| Sprint kick / streak | On/Off | Off | Off | — | — | Off | — |
| Item-fly | Full | Instant | — | — | — | Instant | — |
| Bloom strength | 0.16 | — | 0.04 | 0.10 | — | 0.08 | — |
| Emissive scale | 1.0 | — | 0.5 | 0.8 | — | 0.6 | — |
| Palette | Default | — | — | *prompt user* | — | — | — |
| Font scale | 100% | — | — | 140% | — | — | — |
| High-contrast HUD | Off | — | — | On | — | — | — |
| Captions | Off | — | — | On | — | — | On |
| Sound-state icon | On | — | — | On | — | — | On |
| Sprint toggle | Hold | — | — | — | Toggle | Toggle | — |
| Bindings | Default | — | — | — | L or R preset | — | — |
| Grab assist | Off | — | — | Standard | Strong | Standard | — |
| List length | 6 | — | — | — | — | 4 | — |
| Waypoint / hints | Off | — | — | On | — | On | — |
| Relaxed assists | Off | — | — | — | — | On | — |
| Dwell multiplier | Off | — | — | ×1.5 | — | ×1.5 | ×1.5 |

**Master defaults** (fresh player, no `localStorage`): everything as the "Default" column — identical to the shipped, un-instrumented experience, so the game plays exactly as designed until a player opts in. OS signals seed three of them at first boot: `prefers-reduced-motion: reduce` → Reduced Motion; `prefers-contrast: more` → High-contrast HUD; `prefers-reduced-transparency` → drops `backdrop-filter` blur.

### 11.10 Persistence & Data Schema

Single key `gd3d.a11y.v1` in `localStorage`, JSON, versioned so a future `v2` migrates rather than clobbers (Ch. 20). No backend, no personal data, nothing in the URL except the opt-in shareable preset slug. Complete schema with types, ranges, and defaults:

| Key | Type | Range | Default |
| --- | --- | --- | --- |
| `fov` | int | 60–100 | 62 |
| `bob` | enum | on / reduced / off | on |
| `shakeScale` | float | 0.0–1.5 | 1.0 |
| `sprintKick` | bool | — | true |
| `streak` | bool | — | false |
| `itemFly` | enum | full / instant | full |
| `bloomStrength` | float | 0.0–0.16 | 0.16 |
| `bloomThreshold` | float | 0.90–0.99 | 0.96 |
| `emissiveScale` | float | 0.0–1.0 | 1.0 |
| `palette` | enum | default / protan / deutan / tritan / mono | default |
| `fontScale` | float | 0.8–1.6 | 1.0 |
| `highContrast` | bool | — | false |
| `captions` | bool | — | false |
| `captionArrows` | bool | — | true |
| `soundIcon` | bool | — | true |
| `volMaster` | float | 0.0–1.0 (→ gain 0–0.45) | 1.0 |
| `volAmbient` | float | 0.0–1.0 | 1.0 |
| `sprintToggle` | bool | — | false (hold) |
| `lookLatch` | bool | — | false |
| `bindings` | map<action,code> | KeyboardEvent.code | shipped defaults (§11.7.3) |
| `grabAssist` | enum | off / standard / strong | off |
| `listLen` | int | 3 / 4 / 6 | 6 |
| `sectionHints` | bool | — | false |
| `waypoint` | bool | — | false |
| `shelfHighlight` | bool | — | false |
| `relaxDamage` | bool | — | false |
| `relaxTip` | bool | — | false |
| `relaxNpc` | bool | — | false |
| `hideTimer` | bool | — | false |
| `dwellMult` | enum | 1.0 / 1.5 / 2.0 | 1.0 |

Write policy: debounced `200 ms` after the last change (sliders don't thrash `localStorage`). Read policy: at boot, `try/catch` around `JSON.parse` — a corrupt blob falls back to defaults and rewrites clean, never blocking the game. All apply through `A11Y.apply(state)`, which is pure and idempotent so presets, URL slugs, and manual edits converge to the same rendered result.

### 11.11 Compliance Checklist

**11.11.1 WCAG 2.2-adjacent** (a game is not a document, but we hold the spirit of the relevant SCs):

| SC | Requirement | How met |
| --- | --- | --- |
| 1.4.1 Use of Color | Color never sole signal | Every status carries glyph (`✓`/`◇`/`⚠`) + brightness tier (§11.5.2) |
| 1.4.3 Contrast (AA) | Text ≥4.5:1 | All six roles ≥8:1 on panel; High-contrast forces ≥7:1 (§11.5.1, §11.5.4) |
| 1.4.4 Resize Text | Up to 200% | HUD scales 80–160% with reflow; 160% verified non-clipping (§11.5.3) |
| 1.4.11 Non-text Contrast | UI/graphics ≥3:1 | Reticle, ring, glow, borders all ≥3:1; High-contrast raises to ≥4.5:1 |
| 1.4.12 Text Spacing | No clipping on spacing | Panels use flexible min-widths, wrap not truncate |
| 2.1.1 Keyboard | Full keyboard operability | Entire loop is keyboard-only; every action rebindable (§11.7.3) |
| 2.2.x Timing | Adjustable/no time limits | Default is untimed; ×1.5/×2/off dwell + budget (§11.8.3) |
| 2.3.1 Three Flashes | No >3 Hz flashing | Photosensitive caps + `__flashAudit` CI gate (§11.4.3) |
| 2.5.1 Pointer Gestures | No required multi-point/path gestures | Single click/drag; mouse-only preset avoids all gestures (§11.7.2) |
| 2.5.4 Motion Actuation | No device-motion required | Pure key/pointer input |

**11.11.2 Game Accessibility Guidelines** — Basic, Intermediate, Advanced, each mapped to a shipped or specced feature:

| Tier | Guideline | Our feature |
| --- | --- | --- |
| Basic | Allow controls to be remapped | Full remap (§11.7.3) |
| Basic | Ensure no essential info by color alone | Glyph + brightness redundancy (§11.5.2) |
| Basic | Provide subtitles for all speech/important sound | Caption system for all 8 cues + barks (§11.6) |
| Basic | Support closed captions sizing | Captions follow `--ui-scale` (§11.6.1) |
| Basic | Simplest input method plays | One-hand & mouse-only presets (§11.7.2) |
| Basic | Ensure no flashing >3/sec | Photosensitive mode + CI gate (§11.4) |
| Basic | Give a clear indication interactive objects are interactive | Hover glow + reticle diamond (`src/game.js`) |
| Intermediate | Reduce/turn off screen shake | Shake scalar 0–150% (§11.3.2) |
| Intermediate | Option to disable camera bob/motion | Bob On/Reduced/Off, item-fly Instant (§11.3) |
| Intermediate | Colorblind-friendly palettes | 4 CVD palettes + monochrome (§11.5.2) |
| Intermediate | Toggle for hold inputs | Sprint & look-latch toggles (§11.7.1) |
| Intermediate | Adjustable difficulty / no-fail | Relaxed assists; loop is fail-free by design (§11.8.2) |
| Intermediate | Scalable HUD / text | 80–160% font scale (§11.5.3) |
| Intermediate | Provide an audio-cue-free path | Every cue mirrored visually (§11.6) |
| Intermediate | Adjustable game speed / extended timers | Dwell + timed-mode ×1.5/×2/off (§11.8.3) |
| Advanced | Aim/grab assist | 3-tier grab assist + dwell-to-grab (§11.7.4) |
| Advanced | Reduce required precision | List magnetism, sphere-cast cone (§11.7.4) |
| Advanced | Objective reminders / waypoints | Waypoint compass, shelf highlight, section hints (§11.8.1) |
| Advanced | High-contrast mode | Independent Hi-Contrast HUD (§11.5.4) |
| Advanced | Reduce/disable bloom & brightness | Bloom + emissive caps (§11.4) |
| Advanced | Persistent, portable settings | `localStorage` schema + shareable slug (§11.10) |

### 11.12 Definition of Done & QA Hooks

Accessibility ships behind the same verification discipline as the rest of the build (Ch. 23, Ch. 26). Concrete gates:

1. **Live-apply test** — a `__a11y` window hook (joining the existing `__scene`, `__game`, `__physics` debug set in `src/main.js`) lets the framebuffer-grid harness flip every setting mid-run and assert no reload, no exception, and a stable frame time (`<20 ms` on the reference iGPU profile).
2. **Flash audit** — `__flashAudit` samples luminance over 90 frames in Photosensitive mode across the worst view (`~988 draws`); CI fails on any >10% recurring delta above 3 Hz.
3. **Contrast snapshot** — a build step recomputes all six role contrasts against the current panel for every palette + High-contrast combination and fails if any drops below 4.5:1 (text) / 3:1 (non-text).
4. **Keyboard-only run** — an automated pass completes the full loop (list → 6 grabs → checkout → reroll) using only rebound keys and grab-assist, no mouse.
5. **Persistence round-trip** — write every schema field, reload, assert deep-equality of the applied state.
6. **Preset determinism** — applying any preset from any prior state yields the exact matrix in §11.9 (idempotent `A11Y.apply`).

The bar is simple to state and hard to fake: a player who cannot see color, cannot hear, cannot use two hands, and cannot tolerate motion must still be able to fill a 6-item list and check out — and the frame budget on the Intel iGPU floor must not notice they did.



# Chapter 12 — Results, Stats & Sharing

The store hands you exactly one honest moment: you touch the checkout ring at world position `(-7.65, 0, 11.1)`, `SFX.checkout()` rings its `[523, 659, 784, 1046]` Hz arpeggio, and the run is over. Ch. 6 owns the screens that lead in; Ch. 7 owns the live HUD (`#list`, `#timer`, `#prompt`, `#toast`); Ch. 4 owns the raw score arithmetic. This chapter owns everything that happens **after** the ring: how the result is drawn, what is counted, what is persisted, and how a run is turned into a thing you can send to a friend.

Ground truth this chapter extends, not contradicts: today `game.js` `complete()` renders a single static `#banner` (`<h2>🛒 Checked out!</h2>` + items + subtotal + optional damages + `.big` time + "Press R"), reads `world.physics.damage` (which is `{ total, count }` where every knocked item bills `spec.price * 0.4`), and no data survives a page reload. Every system below is additive, browser-only, no-backend, and cheap enough for the Intel-iGPU floor because it is DOM and `localStorage`, never a new render pass.

---

### 12.1 The results shell — one card, five mode skins

There is exactly one results DOM element, `#results`, injected once at boot next to `#banner` (which is retired to a lightweight mid-run toast role). It reuses the shipped banner styling contract so it costs zero new art: `background: rgba(10,14,18,.92)`, `border: 1px solid rgba(255,255,255,.18)`, `border-radius: 16px`, `backdrop-filter: blur(6px)`, centered at `top: 38%`, `z-index: 15` (one above `#banner`'s 14).

**Fixed skeleton** (identical DOM for every mode; the mode controls which rows are populated and the copy):

| Node | class | Purpose | Present in modes |
|---|---|---|---|
| `#results` | `card` | outer shell, fade/scale host | all |
| `> .rhead` | title + mode tag | "CHECKED OUT" / "TIME'S UP" / "SHIFT COMPLETE" | all |
| `> .rstamp` | `grade-stamp` | the S/A/B/C/D seal (12.4) | dash, rush, wreck |
| `> .rrows` | counter list | the animated number rows (12.2) | all |
| `> .rscore` | `big` | the hero number (time or score) | all except zen |
| `> .rpar` | `chip` | par delta / secondary line | dash, shift |
| `> .robj` | objective checklist | 3 star rows | shift only |
| `> .rfoot` | button strip | R / S / P actions | all |

**Shell measurements (fixed across modes):** width `clamp(320px, 34vw, 460px)`; internal padding `24px 30px`; row height `34px`; row font `15px`, tabular-nums (`font-variant-numeric: tabular-nums`, inherited from `#timer`); title `22px/800`; `.big` `40px/800` (up 6px from the shipped 34px because it is now the focal element); `.chip` `12.5px`, pill `border-radius: 20px`, `padding: 3px 12px`.

**Footer button strip** (all modes, left→right, exact key bindings extending the shipped `keydown` handler in `game.js` that already listens for `KeyR`/`KeyM`):

| Button | Key | Action | Enabled at |
|---|---|---|---|
| New list / Retry | `R` | `game.reset()` (shipped) | reveal end + 0 ms |
| Share | `S` | build + copy share code (12.9) | reveal end + 0 ms |
| Photo | `P` | enter Photo Mode (12.10) | reveal end + 0 ms |
| Stats | `Tab` | open lifetime panel (12.6) | always |

Buttons are `pointer-events:none; opacity:.4` until the reveal timeline completes, so a mashed key during the count-up never fires early. The shipped guard `if (e.code === 'KeyR' && done)` already gates on `done`; we extend it with `&& results.revealDone`.

---

### 12.2 Per-mode results anatomy — every counter enumerated

Modes are defined in full in Ch. 2; here is the complete display contract for each. "Source" columns cite the exact runtime value.

**Mode enum** (used everywhere below, in run history, and in the share code): `0 dash`, `1 rush` (Time Attack), `2 wreck` (Rampage), `3 shift` (Career, Ch. 3), `4 zen`.

#### Mode 0 — Dash (the shipped loop)

| # | Row label | Source expression | Format | Zero-state copy |
|---|---|---|---|---|
| 1 | Items | `list.length` (always 6) | `6 items` | — |
| 2 | Subtotal | `list.reduce((a,e)=>a+e.price,0)` | `$21.44` | — |
| 3 | Damages | `physics.damage.count` / `.total` | `2 items · $2.16` | `Spotless — no damages` (green `#35c46a`) |
| 4 | Time | `game.state.time` | `1:18.40` (12.3 format) | — |
| 5 | Par Δ | `PAR − time` | `11.6s under par` / `4.2s over` | `On par` |
| — | Grade | 12.5 | stamp | — |
| — | Score | Ch. 4 total | `1,009` (small, under stamp) | — |

`.big` hero = the **time**. Grade stamp present.

#### Mode 1 — Rush / Time Attack (fixed 120.0 s clock, endless re-rolling lists)

| # | Row label | Source | Format |
|---|---|---|---|
| 1 | Lists cleared | `runStats.listsThisRun` | `7 lists` |
| 2 | Items grabbed | `runStats.itemsThisRun` | `43 items` |
| 3 | Best streak | `runStats.bestStreak` (consecutive on-list grabs, broken by an off-list grab or any damage event) | `×18` |
| 4 | Avg list time | `120 / listsCleared` | `17.1s / list` |
| 5 | Damages | `physics.damage.count` / `.total` | `1 item · $0.60` |
| — | Score | `lists×500 + items×20 + bestStreak×15 − round(damageCents×0.5)` | `4,970` |

`.big` hero = the **score**. Grade stamp present (thresholds in 12.5, score-driven).

#### Mode 2 — Wreck / Rampage (60.0 s, the damage penalty inverts into the goal)

| # | Row label | Source | Format |
|---|---|---|---|
| 1 | Damage billed | `physics.damage.total` | `$184.20` (this is the point) |
| 2 | Items destroyed | `physics.damage.count` | `312 items` |
| 3 | Aisles tipped | `runStats.aislesTipped` (count of `tipGondola` calls) | `4 aisles` |
| 4 | Carts wrecked | `runStats.cartsWrecked` (cart `tipped` transitions) | `2 carts` |
| 5 | Shoppers bumped | `runStats.npcsBumped` (bump events in `physics.update`) | `9 people` |
| 6 | Peak combo | `runStats.peakMult` (see below) | `×3.4` |
| — | Score | `round(damageCents × peakMult)` | `62,628` |

Combo multiplier is a Wreck-only runtime value the physics layer feeds the results: it starts at `1.0`, `+0.2` per damage event within `1.5 s` of the previous one, decays `−0.8/s` toward `1.0` when idle, hard cap `5.0`. `.big` hero = the **score**. Grade stamp present.

#### Mode 3 — Shift / Career (one of the 40 authored shifts, Ch. 3)

No letter grade — Career uses **stars 0–3** (this is the currency Ch. 5 progression consumes). The `.robj` block replaces the number rows.

| Node | Content | Source |
|---|---|---|
| Header tag | `SHIFT 14 · FROZEN FRENZY` | Ch. 3 shift record `.name` |
| Pass condition | `✓ Reach checkout under 2:30` | shift `.pass` predicate over run state |
| Star 1 | `✓ Zero damages` | `physics.damage.count === 0` |
| Star 2 | `✗ Only frozen-aisle items` | shift-specific predicate |
| Star 3 | `✓ Under 1:45` | `time < shift.gold` |
| `.rscore` | earned stars `★★☆` | count of satisfied predicates |
| `.rpar` | `Time 1:41 · Damages 0` | secondary |
| Rewards row | `+1 star toward Manager · unlocked: Toy Aisle skin` | Ch. 5 |

Pass/fail gates the "Next shift" vs "Retry" affordance in the footer (footer swaps `R Retry` for `N Next shift` when passed).

#### Mode 4 — Zen (untimed free roam, no scoring)

Minimal card. No stamp, no score, no par.

| # | Row | Source |
|---|---|---|
| 1 | Time in store | session seconds |
| 2 | Items grabbed | `runStats.itemsThisRun` |
| 3 | Aisles visited | count of distinct gondola labels the player came within 3 m of |
| footer | `Session saved · R keep shopping` | — |

Zen never writes a `history` record (12.7) and never touches PB records, but it **does** increment the applicable lifetime counters (12.6) so a Zen wanderer still grows their `itemsGrabbed`, `totalMeters`, and `playSeconds`.

---

### 12.3 Reveal order & timings — exact millisecond timelines

All times are milliseconds from card mount (`t=0`), which is the same frame `complete()` fires today. The card mount itself is: `opacity 0→1`, `transform scale(0.92)→scale(1) translate(-50%,-50%)`, `220 ms`, easing `cubic-bezier(0.22, 1, 0.36, 1)`. `SFX.checkout()` already fires at `t=0` in the shipped code — the reveal is choreographed **against that existing arpeggio** (notes land at 0, 90, 180, 270 ms).

**Count-up rows** use one shared roller: value at local time `τ` (ms) over duration `D` is `v(τ) = target × easeOutCubic(τ/D)` where `easeOutCubic(p) = 1 − (1−p)³`. A `SFX.tick()` (square, 880 Hz, 70 ms — the shipped list-check sound) fires each time the displayed integer dollars or item count crosses a whole number, throttled to a minimum 60 ms gap so a big Rampage roll does not machine-gun.

**Dash reveal timeline:**

| t (ms) | Event | Duration | Easing | Audio |
|---|---|---|---|---|
| 0 | Card mounts (scale+fade) | 220 | `cubic-bezier(.22,1,.36,1)` | (checkout arpeggio, already firing) |
| 260 | Title "CHECKED OUT" fades in | 160 | ease-out | — |
| 420 | Row 1 Items count-up 0→6 | 260 | easeOutCubic | tick per integer |
| 700 | Row 2 Subtotal roll $0→$X | 520 | easeOutCubic | tick per dollar (≤60 ms) |
| 1250 | Row 3 Damages slide-in from right | 300 | `cubic-bezier(.16,1,.3,1)` | none (spotless) / soft `thud()` if >0 |
| 1620 | Row 4 Time reveal + scale pop 1.0→1.12→1.0 | 260 | back-out | `listDone()` two-tone |
| 1920 | Par Δ chip slides from right edge | 240 | `cubic-bezier(.16,1,.3,1)` | — |
| 2200 | **GRADE STAMP** (12.4) | 520 | back-out | grade sting |
| 2760 | Score counts up under stamp | 300 | easeOutCubic | none |
| 3080 | Footer buttons fade in, `pointer-events` enabled, `results.revealDone=true` | 200 | linear | — |

Total choreography: **3.28 s**. A `KeyR`/`KeyS`/`KeyP`/`Space`/click during the reveal calls `results.skip()` which jumps every animation to its end state in one frame and sets `revealDone` — no player is ever forced to watch.

**Rush reveal:** identical spine, but rows are Lists→Items→Streak→AvgTime→Damages (each 220 ms, stepped 240 ms apart, first at 420), the stamp lands at `t=2000`, score rolls `t=2560`.

**Wreck reveal:** the damage number is the hero, so the order is intentionally escalating — Damage billed rolls **last and longest** for the payoff: Items destroyed (`420`), Aisles (`700`), Carts (`900`), Shoppers (`1100`), Peak combo (`1320`), then Damage billed count-up over **900 ms** starting `t=1600`, stamp `t=2600`. The damage roll uses `SFX.clatter()` (the four-note random square burst) as its tick rather than `tick()`, capped one every 90 ms.

**Shift reveal:** Pass line stamps in first (`t=300`, a check-draw), then stars pop sequentially at `t=700 / 1000 / 1300` — each satisfied star does a `listDone()` two-tone and a 1.0→1.3→1.0 scale pop; each failed star fades in grey at 40% with a single `error()` tone (300 Hz sawtooth). Rewards row `t=1800`.

**Zen reveal:** three rows fade in together over 300 ms at `t=200`, footer at `t=600`. No stamp, no stings — Zen stays quiet on purpose (consistent with Ch. 9 game-feel and the Ch. 18 "no music" rule).

---

### 12.4 Grade stamp animation — the hero beat

The stamp is a DOM element `.grade-stamp`: a `96px` circle, `border: 4px solid` the grade color, letter centered `font: 900 52px` in the same `Georgia, serif` used by the produce chalk signs (`chalkTex` in `store.js`) so it reads as a rubber ink stamp, not UI chrome. It renders **above** the card content (`z-index: 16`) and is anchored top-right of the `.rrows` block, rotated to look slammed down.

**Colors, pulled from the shipped palette (no new hexes):**

| Grade | Ring / ink color | Source in codebase | Audio sting |
|---|---|---|---|
| S | `#ffd23b` gold | aisle-sign yellow (`aisleSignTex`) | `checkout()` 4-note triad |
| A | `#35c46a` green | boot-bar / lane-lamp green | `listDone()` two-tone |
| B | `#2a6fc0` blue | TP accent blue | single 784 Hz `tone` |
| C | `#e8a020` amber | cereal box `bg1` | single 523 Hz `tone` |
| D | `#c8231b` red | ketchup `bg1` | `error()` 300→190 Hz |

**Keyframe spec (total 520 ms):**

| Phase | t (ms) | scale | rotate | opacity | filter | easing |
|---|---|---|---|---|---|---|
| Wind-up | 0 | 3.0 | −22° | 0 | `blur(6px)` | — |
| Slam | 0→130 | 3.0→0.94 | −22°→−6° | 0→1 | `blur(6px)→blur(0)` | `cubic-bezier(.34,1.56,.64,1)` |
| Impact | 130 | 0.94 | −6° | 1 | — | (shake begins) |
| Settle | 130→300 | 0.94→1.06→1.0 | −6°→−8°→−7° | 1 | — | ease-in-out |
| Rest | 300→520 | 1.0 | −7° | 1 | — | — |

**Impact effects at t=130 ms** (the frame the stamp "hits"):
- **Card shake:** the `#results` card translates by a decaying random jitter, `±6px` at t=130 falling linearly to `0` at t=310 (a DOM analog of the physics `addShake`), applied as `transform: translate(calc(-50% + Rx), calc(-50% + Ry))`.
- **Ink ring burst:** 12 CSS specks (`4px` dots in the grade color) spawn at the stamp center and expand to radius `80px` on 12 evenly-spaced angles (`k × 30°`), `opacity 0.9→0` over `400 ms`, `cubic-bezier(.16,1,.3,1)`. Cost: 12 absolutely-positioned divs, removed on animationend.
- **Audio sting:** per the table above, fired once.

**Grade override visuals:** if the run tipped an aisle (Dash grade capped at C, 12.5), the stamp gets an extra diagonal `CLEANUP` sub-label under the letter in `#e8907f` (the shipped damage-line red). A perfect S adds a slow `0.06` scale breathe loop (2.4 s) so the gold seal keeps a faint life after landing.

---

### 12.5 Grade formula — worked, and its display mapping

Ch. 4 computes the canonical run **score**; Chapter 12 owns the **letter cutoffs and the display**. The Dash score is assembled from four terms so the results card can itemize them on the Stats panel (12.6) breakdown:

```
PAR_SECONDS      = 42 + 8 * items            // items=6 → 90.0 s baseline
timeBonus        = clamp(round((PAR - timeSec) * 8), -400, +400)   // 8 pts/sec
accuracyPenalty  = -25 * itemsGrabbedOffList
tidinessPenalty  = -40 * damageCount
                   - round(damageCents * 0.02)         // 2 pts per damage-dollar
                   - 250 * aislesTipped
                   - 120 * cartsWrecked
score            = 1000 + timeBonus + accuracyPenalty + tidinessPenalty
```

**Letter cutoffs (Dash & score-driven modes):**

| Grade | Score band | Hard requirement |
|---|---|---|
| S | ≥ 1200 | `damageCount === 0` (any damage bars S) |
| A | 1000–1199 | — |
| B | 750–999 | — |
| C | 500–749 | — |
| D | < 500 | — |

**Overrides (applied after the band):** any tipped aisle caps the grade at **C**; abandoning the run (leaving without checkout, page hidden > 30 s) records **no grade** (`—`) and a `flags.abandoned` history entry; a clean run (`damageCount===0`) that also beats par is floored at **A** even if the arithmetic dips.

**Worked example A — a good clean-ish run.** 6 items, `timeSec = 78.4`, `itemsGrabbedOffList = 0`, `damageCount = 2`, `damageCents = 216` (two items at ~$2.70 × 0.40), 0 aisles, 0 carts:
- `PAR = 90.0`; `timeBonus = round((90−78.4)×8) = round(92.8) = +93`
- `accuracyPenalty = 0`
- `tidinessPenalty = −(40×2) − round(216×0.02) = −80 − round(4.32) = −80 − 4 = −84`
- `score = 1000 + 93 + 0 − 84 = 1009` → band **A**. Damage present, so S is barred anyway. **Grade A, score 1,009.**

**Worked example B — a perfect sprint.** `timeSec = 60.0`, zero off-list, zero damage:
- `timeBonus = round((90−60)×8) = +240`; penalties `0`; `score = 1240` → ≥1200 **and** `damageCount===0` → **Grade S, score 1,240.**

**Worked example C — carnage on the way out.** `timeSec = 72`, tipped 1 aisle spilling 56 items, `damageCount = 56`, `damageCents ≈ 11200`:
- `timeBonus = +144`; `tidinessPenalty = −(40×56) − round(11200×0.02) − 250 = −2240 − 224 − 250 = −2714`; `score = 1000 + 144 − 2714 = −1570` → band D, but the aisle-tip override is moot (already below C). **Grade D** with the `CLEANUP` sub-label.

**Rush / Wreck cutoffs** reuse the same S/A/B/C/D ladder against their own score, scaled: Rush S ≥ 6000 / A ≥ 4500 / B ≥ 3000 / C ≥ 1500; Wreck S ≥ 50000 / A ≥ 30000 / B ≥ 15000 / C ≥ 6000. These live beside the Ch. 4 economy constants.

---

### 12.6 Lifetime stats — the complete tracked set

**Storage:** one JSON document at `localStorage['gd3d.stats.v1']`, read once at boot into an in-memory `Stats` object, written back (debounced 500 ms) after each run and on `visibilitychange:hidden`. All money is stored in **integer cents** (never floats) to avoid drift across thousands of runs. All keys below are dot-paths inside that document. Total serialized size at heavy play is ~2.5 KB.

Update discipline: counters only ever increment; the writer is idempotent per run via a `runId` guard so a double-fired `complete()` cannot double-count (the shipped `if (done) return;` already guards `complete()` once; the stats writer adds a second belt).

| # | Key | Type | Increment / update site |
|---|---|---|---|
| 1 | `schema` | int | fixed `1` |
| 2 | `profileId` | string (uuid v4) | created once at first boot |
| 3 | `createdAt` | int (epoch ms) | first boot |
| 4 | `lastPlayedAt` | int (epoch ms) | every run end |
| 5 | `sessionsPlayed` | int | once per page load that reaches play |
| 6 | `runsStarted` | int | on first movement of each run |
| 7 | `runsCompleted` | int | `complete()` |
| 8 | `runsAbandoned` | int | tab hidden > 30 s mid-run |
| 9 | `rerolls` | int | `KeyR` reset (shipped handler) |
| 10 | `modeRuns.dash` | int | run end, mode 0 |
| 11 | `modeRuns.rush` | int | run end, mode 1 |
| 12 | `modeRuns.wreck` | int | run end, mode 2 |
| 13 | `modeRuns.shift` | int | run end, mode 3 |
| 14 | `modeRuns.zen` | int | run end, mode 4 |
| 15 | `itemsGrabbed` | int | each `tryGrab` matching a list entry |
| 16 | `itemsGrabbedOffList` | int | each `tryGrab` with no matching entry |
| 17 | `debrisPickedUp` | int | `tryGrab` where `h.debris` truthy |
| 18 | `listsCompleted` | int | `listDone` transition |
| 19 | `totalSpendCents` | int | `+= round(subtotal×100)` at checkout |
| 20 | `totalDamageCents` | int | `+= physics.damage.total×100` |
| 21 | `damageEvents` | int | `+= physics.damage.count` |
| 22 | `aislesTipped` | int | each `tipGondola` |
| 23 | `cartsWrecked` | int | each cart `tipped` transition |
| 24 | `cartShoves` | int | shove with `rel>0` in `physics.update` |
| 25 | `npcsBumped` | int | each NPC bump toast |
| 26 | `knockEvents` | int | each walking-crash `knockItems` with hits |
| 27 | `walkMeters` | float | `+= dist` when speed ≈ walk (3.1) |
| 28 | `sprintMeters` | float | `+= dist` when Shift held (4.9) |
| 29 | `totalMeters` | float | `walkMeters + sprintMeters` |
| 30 | `playSeconds` | float | `+= dt` while `playing` |
| 31 | `longestSessionSeconds` | float | max session wall time |
| 32 | `cleanRuns` | int | completed with `damageCount===0` |
| 33 | `perfectRuns` | int | S-grade Dash runs |
| 34 | `grades.S` | int | grade histogram |
| 35 | `grades.A` | int | grade histogram |
| 36 | `grades.B` | int | grade histogram |
| 37 | `grades.C` | int | grade histogram |
| 38 | `grades.D` | int | grade histogram |
| 39 | `pb.dashMs` | int | fastest Dash checkout (ms) |
| 40 | `pb.rushScore` | int | best Time-Attack score |
| 41 | `pb.wreckScore` | int | best Rampage score |
| 42 | `pb.rushStreak` | int | best Time-Attack streak |
| 43 | `starsEarned` | int | total Career stars (Ch. 5 spends these) |
| 44 | `shiftsPassed` | int | distinct shifts with ≥1 star |
| 45 | `sectionGrabs.pantry` | int | per-section grab tally |
| 46 | `sectionGrabs.snacks` | int | per-section grab tally |
| 47 | `sectionGrabs.household` | int | per-section grab tally |
| 48 | `sectionGrabs.home` | int | per-section grab tally |
| 49 | `sectionGrabs.dairy` | int | per-section grab tally |
| 50 | `sectionGrabs.frozen` | int | per-section grab tally |
| 51 | `sectionGrabs.bakery` | int | per-section grab tally |
| 52 | `sectionGrabs.produce` | int | per-section grab tally |
| 53 | `sectionGrabs.electronics` | int | per-section grab tally |
| 54 | `sectionGrabs.toys` | int | per-section grab tally |
| 55 | `sectionGrabs.pharmacy` | int | per-section grab tally |
| 56 | `skuGrabs` | object `{specId:int}` | per-SKU tally over all 52 SKUs |
| 57 | `screenshotsTaken` | int | Photo Mode shutter |
| 58 | `sharesGenerated` | int | share code built (12.9) |
| 59 | `sharesImported` | int | share code accepted |
| 60 | `muteToggles` | int | `KeyM` (shipped handler) |

That is 60 tracked fields (11 section tallies match the 11 sections the catalog actually ships — `pantry`, `snacks`, `household`, `home`, `dairy`, `frozen`, `bakery`, `produce`, `electronics`, `toys`, `pharmacy`). `skuGrabs` is sparse and can hold up to all 52 SKU ids. The full schema is registered in Ch. 20; Ch. 24 telemetry mirrors a hashed subset if the optional backend is ever attached (it is off by default).

The **Stats panel** (`Tab` from results or pause) renders these grouped: Career (5–9), Mileage (27–31), Economy (19–21), Chaos (22–26), Grades (34–38), Collection (a 52-cell grid coloring each SKU by `skuGrabs`, so a completionist can see the whole catalog fill in). A `Reset all stats` control writes a fresh document and is guarded by a hold-to-confirm (2 s) — clearing local data is destructive and never one-click.

---

### 12.7 Run history — the last 50 runs

**Storage:** `localStorage['gd3d.history.v1']`, a JSON array used as a **ring buffer** of capacity 50. On each completed run (Zen excluded), `push` the record; if `length > 50`, `shift` the oldest. Newest-last ordering keeps append O(1); the Stats panel reverses for display.

**Per-run record schema:**

| Field | Type | Bytes (JSON, typical) | Meaning |
|---|---|---|---|
| `v` | int | 4 | record schema (1) |
| `t` | int | 15 | epoch ms at checkout |
| `m` | int 0–4 | 4 | mode enum |
| `s` | uint32 | 13 | run seed (store+list, 12.8) |
| `d` | int | 6 | duration ms |
| `it` | int | 5 | items grabbed on-list |
| `sub` | int | 6 | subtotal cents |
| `dc` | int | 4 | damage count |
| `dm` | int | 6 | damage cents |
| `g` | int 0–5 | 3 | grade (0=S…4=D, 5=none) |
| `sc` | int | 7 | mode score |
| `st` | int 0–3 | 3 | stars (shift only, else 0) |
| `fl` | int | 4 | flag bitfield |

**Flag bitfield `fl`:** `bit0 clean` (no damage), `bit1 perfect` (S), `bit2 tippedAisle`, `bit3 wreckedCart`, `bit4 abandoned`, `bit5 usedShareSeed` (this run came from an imported code), `bit6 pb` (this run set a personal best).

**Size budget:** a fully-populated record serializes to ~90 bytes with these short keys; 50 records ≈ **4.5 KB**, plus array punctuation ≈ 4.6 KB total. `localStorage` gives ~5 MB, so history + stats + ghosts together stay under 60 KB — three orders of magnitude of headroom. Records deliberately do **not** store the 6-item list array (that is recoverable from `s` + `m` once list generation is seeded, 12.8), which keeps each record tiny.

The history feeds three UI affordances: a sparkline of the last 20 Dash times on the Stats panel; a "Rematch" button on any row that reloads that exact `s`+`m` (the same store stocking **and** the same shopping list) via the share pathway; and the PB detection in 12.6 (`bit6`).

---

### 12.8 Ghost-lite — an honest feasibility decision

**The question:** can we record a run and race a replay of it? Two candidate formats were evaluated against the actual codebase.

**Candidate 1 — input+seed replay (record keystrokes + one seed, re-simulate).** *Verdict: NOT feasible for this build without a determinism refactor.* The sim is not currently reproducible from inputs, because it draws from `Math.random()` in several non-seeded places and integrates on a variable timestep. Every source that would desync a replay, enumerated from source:

| Source file | Non-deterministic call | Effect on replay |
|---|---|---|
| `game.js` `genList` | `Math.floor(Math.random()*specs.length)` | different shopping list each run |
| `physics.js` `spawnDebrisNow` | `w` angular velocity `(Math.random()-0.5)*…` ×3 | debris tumbles differently |
| `physics.js` `knockItems` | oomph + jitter `Math.random()` | different spill spread |
| `physics.js` `tipGondola` | `push`, `vy`, `cart.tipSign` random | different spill + fall side |
| `physics.js` bump/crash | `BUMP_LINES` / `CRASH_LINES` index | cosmetic desync |
| `characters.js` | NPC wander RNG (Ch. 17) | shoppers stand elsewhere → different bumps |
| `main.js` loop | `clock.getDelta()` variable, clamped 0.05 | integration diverges frame-to-frame |

A replay would drift within a second or two. Making input-replay work would require routing **all** of the above through one per-run seeded LCG (the codebase already has the exact generator — `seed = (seed*16807) % 2147483647` in `store.js` — so the pattern is established) and switching `main.js` to a fixed-timestep accumulator. That is a real, worthwhile refactor, but it is Ch. 21/22 work and out of scope for shipping ghosts now.

**Candidate 2 — position-sample ghost (record where you were, not what you pressed).** *Verdict: feasible, cheap, ships now.* We sample the camera transform on a fixed cadence and play it back as a kinematic phantom. It needs no determinism because it never re-simulates anything.

**Recording format:**
- Sample `camera.position.x`, `camera.position.z`, and yaw (`camera.rotation.y`) at **10 Hz** (every 100 ms of run time, not wall time, so it aligns with the timer).
- Quantize per sample: `x`,`z` to centimeters as `int16` (range ±327 m, far beyond the 46×30 m store); yaw to `uint8` as `round(yaw/(2π)×256) & 255`.
- Raw sample = 2 + 2 + 1 = **5 bytes**.
- Delta-encode consecutive `x`,`z` as `int8` cm-deltas (a 4.9 m/s sprint moves ≤49 cm per 100 ms, inside int8), with a 1-byte escape (`0x80`) that switches that axis to an absolute `int16` for the rare teleport/snap. Yaw stored absolute (1 byte). Typical encoded sample ≈ **2 bytes**.
- Grab markers: a side list of `{frame:uint16, specIdx:uint8}` so the ghost can pop a translucent flyer when it grabbed (visual flavor only).

**Size budget, worked:** a 90 s Dash run = 900 samples. Raw 5 B/sample = 4500 B; delta-encoded ≈ 2 B/sample = **1800 B**; Base64 for `localStorage` inflates ×1.34 → **≈ 2.4 KB**. Grab markers for a 6-item run = 6 × 3 B = 18 B, negligible. **Hard cap 8 KB** per ghost (≈ 330 s of run at 10 Hz), truncating older samples if exceeded. Store **one ghost per mode's personal best**, at `localStorage['gd3d.ghost.<mode>.v1']` — five ghosts × 8 KB = **40 KB** worst case.

**Playback rules:**
- On a new run, if `showGhost` is on and a PB ghost exists for the mode, spawn a phantom: a `shoppingCart()` mesh (already a cheap ~4-draw chrome asset) plus a simplified Rocketbox walker, both at `opacity 0.35`, tinted `#9fdcff` (the exact hover-glow color from `game.js`), rendered with `depthWrite:false`.
- The ghost is **fully kinematic**: it is never added to `world.colliders`, never a `raycastTargets` entry, never touches `physics`, never emits SFX. It cannot knock a shelf, tip a cart, or be grabbed. It is scenery that happens to be your past self.
- Both ghost and player start at `run t=0` (spawn). Interpolate position **linearly** between the two bracketing samples; interpolate yaw with shortest-arc lerp. At 10 Hz over a 60 fps render, that is ~6 render frames per segment — smooth enough for a translucent phantom, and cheaper than any curve fit.
- If the player finishes before the ghost, the ghost keeps walking its recorded path to its own end, then fades over 400 ms. If the ghost finishes first, it fades and a `#toast` reads `👻 Your best reached checkout — 4.1s ahead`.
- The ghost is recorded **every** run into a scratch buffer; it is only **promoted** to the stored PB ghost when that run sets a new `pb` (12.6). This means one recording buffer is always live but writes to `localStorage` only on a record.

This is the shippable ghost. The determinism table above is the documented on-ramp to the fuller input-replay ghost later, and it names every fix required.

---

### 12.9 Share codes — a run as 13 characters

The results footer `S` turns the current run's **mode + seed** into a short human-typable code so another player gets the identical store stocking **and** identical shopping list. This is why 12.7 can drop the list from history records and why "Rematch" works: the seed is the run.

**Prerequisite:** list generation must be seeded. Today `genList` uses `Math.random()`; the shared build routes it through a per-run LCG initialized from the run seed (same generator already in `store.js`: `s = (s*16807) % 2147483647`). The store stocking already consumes a seed (currently hard-coded `1337` in `buildStore`); the shared build derives the stocking seed and the list seed from the one run seed so both reproduce.

**Payload — 48 bits, bit-packed little-endian:**

| Field | Bits | Values |
|---|---|---|
| `ver` | 4 | current `1` |
| `mode` | 4 | 0 dash … 4 zen |
| `seed` | 32 | uint32 run seed |
| `crc` | 8 | CRC-8/ATM (poly `0x07`, init `0x00`) over the first 40 bits |

48 bits → **Crockford Base32** (alphabet `0-9 A-H J K M N P-T V-Z`, ambiguous `I L O U` excluded) → 10 symbols (the low 2 pad bits are zero). Displayed uppercase, prefixed and grouped: `GD3-XXXXX-XXXXX`. Total typed length including prefix and dashes = **13 characters**. Dashes and case are ignored on import; the parser strips non-alphabet characters and maps Crockford's forgiving aliases (`I/L→1`, `O→0`) before decoding.

**Worked encode.** Mode = Dash (`0`), seed = `0x4F3A21C7` = `1329029575`:
1. Bits: `ver=0001`, `mode=0000`, `seed=0x4F3A21C7`. First 40 bits = `01 00 00 00 | C7 21 3A 4F` (LE seed bytes). Compute CRC-8/ATM over those 5 bytes → say `0x9D`.
2. 48-bit stream (6 bytes) = `10 00 C7 21 3A 4F 9D` — packed as ver|mode in byte0 nibbles, then seed LE, then crc.
3. Base32 (Crockford) of 48 bits → 10 symbols, for example `1073P8T9FX`.
4. Display: **`GD3-1073P-8T9FX`**.

**Import flow (results or main menu `Import code`):** paste/type → strip → decode → verify CRC. On CRC mismatch, a `#toast` reads `Bad code — check the characters` and nothing loads (a corrupt seed must never silently start a different run). On success, the mode + seed load, `history.fl bit5 usedShareSeed` is set on the resulting run, and `sharesImported` (stat #59) increments. On generate, the code string is written to the clipboard via `navigator.clipboard.writeText` (no network, no backend), a `#toast` confirms `Copied · GD3-1073P-8T9FX`, and `sharesGenerated` (#58) increments.

**Challenge variant.** Holding `Shift+S` builds an extended code that appends the beat-me target: 24 more bits (score `int20` + a 4-bit target-metric selector) making a 72-bit / 15-symbol code shown as `GD3-XXXXX-XXXXX-XXXXX`. On import of a challenge code the results card for that run adds a `vs 1:42 to beat` chip and a win/loss stamp. The base 13-char code stays the common currency; the challenge code is strictly a superset flagged by a `ver` value of `2`.

Share codes are pure client-side text — they respect the no-backend default. There is no server, no URL with personal data, nothing to leak; a code encodes only a mode and a 32-bit integer.

---

### 12.10 Screenshot & Photo Mode — hide-HUD and camera freeze

Two levels: a one-key HUD hide for a quick clean frame, and a full Photo Mode for composing a shot.

**HUD hide (`H`, toggle).** Flips the display of exactly these elements, all already present in `index.html`:

| Element | Hidden in HUD-hide | Hidden in Photo Mode |
|---|---|---|
| `#list` | yes | yes |
| `#timer` | yes | yes |
| `#prompt` | yes | yes |
| `#toast` | yes | yes |
| `#hint` | yes | yes |
| `#crosshair` | yes | yes |
| `#banner` / `#results` | no (kept) | yes |
| `#vignette` | no (kept) | optional toggle `V` |

HUD-hide does **not** pause the game — you can keep playing HUD-less. It only toggles CSS `display`; zero cost.

**Photo Mode (`P` from the results card, or `P` mid-run).** Rules:
- **Freeze the sim:** the main loop keeps calling `composer.render()` every frame (so the image stays live and the quality tiers keep working), but `physics.update`, `shoppers.update`, and `game.update` are called with `dt = 0`. Debris stops mid-air, shoppers hold their pose, the timer stops. This reuses the existing `playing` gate (`game.update(dt, playing)`), extended with a `photo` flag so movement (`move`) is suppressed while look is preserved.
- **Camera freeze rule:** on entering Photo Mode the current camera transform is captured. Translation is locked (no WASD). **Look is still allowed** through the existing drag-look / pointer-look path so you can reframe, clamped to the same `±1.45 rad` pitch limit already enforced in `main.js`. An optional `[`/`]` nudges FOV between 40°–75° (default stays the shipped 62°) for a wider or tighter composition; exiting restores 62°.
- **Vignette & bloom:** `V` toggles `#vignette`; bloom/GTAO stay as the active tier renders them, so a photo looks exactly like the game (no special photo shader — Intel-iGPU floor forbids a bespoke pass).
- **Shutter (`Enter` or click the shutter button):** because the WebGL context uses the default `preserveDrawingBuffer:false`, the backbuffer must be read **in the same task as the draw**. The shutter therefore performs, synchronously in one handler: `composer.render()` → `renderer.domElement.toBlob(blob => download(blob), 'image/png')`. The download filename embeds the seed code: `grocery-dash_GD3-1073P-8T9FX.png`. `screenshotsTaken` (#57) increments.
- **Watermark (optional, default on):** the shutter composites the canvas onto a 2D canvas that draws a 2px inner border in `rgba(255,255,255,.5)` and, bottom-right, `GROCERY DASH 3D` + the share code in the same `Arial/800` used by the store signage, so a shared screenshot carries its own replay code. Toggle with `W`.
- **Exit (`Esc` or `P`):** restores FOV, un-hides the HUD to its prior state, and resumes the sim from exactly where it froze (`dt` resumes; the accumulated freeze time is excluded from `playSeconds` and the run timer, so a photo break never costs you your Dash time).

Photo Mode is deliberately non-destructive and offline: it never uploads, never posts, and produces a local file the player chooses to share. That keeps it inside the no-backend, browser-only envelope while giving the results screen its natural social payoff — a clean, watermarked, replayable frame of the exact moment the aisle came down.

---

**Cross-references.** Mode rulesets and the 120 s / 60 s clocks: Ch. 2. The 40 Career shifts, their pass predicates, gold times, and star objectives: Ch. 3. Canonical score arithmetic and economy constants the grade cutoffs sit beside: Ch. 4. Achievements, dailies, and how `starsEarned` is spent: Ch. 5. The screens that frame these results and the Stats panel layout: Ch. 6. The live HUD elements this chapter borrows (`#list`, `#timer`, `#toast`): Ch. 7. The key bindings (`R`, `S`, `P`, `H`, `Tab`) extending the shipped `keydown` handler: Ch. 8. The stamp-slam game-feel and the "no music" audio stance the stings honor: Ch. 9 and Ch. 18. The determinism refactor that would upgrade ghost-lite to full input-replay: Ch. 21 (fixed timestep) and Ch. 22 (physics). Full persisted schemas registered: Ch. 20. Optional, off-by-default telemetry mirror: Ch. 24.



---

# PART III — WORLD & CONTENT



# Chapter 13 — Art Direction & the Brand Universe

This chapter is the visual constitution of *Grocery Dash 3D*. It codifies the one look that must survive across four incompatible asset provenances (procedural canvas geometry, Poly Haven photoscans, Kenney low-poly kit, Microsoft Rocketbox humans), fixes every hex value the renderer is allowed to emit, and builds out the fictional retail world — the fascia brand, twenty tentpole house brands, twenty challenger brands, the wayfinding signage grammar, and the optional seasonal overlays. Everything here is grounded in the shipped source (`src/products.js`, `src/store.js`, `src/materials.js`, `src/env.js`, `src/main.js`) and extends it; nothing contradicts shipped behavior. Where a value is already in code, it is quoted as canon. Where this chapter adds a system (seasonal overlays, brand line-extensions toward the 150-SKU catalog of Ch. 16), it is additive and off by default.

The art pillars restate Ch. 1 in visual terms: **heightened retail realism** (not photoreal, not cartoon — a supermarket remembered slightly too vividly), **legibility over fidelity** (a player sprinting at 4.9 m/s must read a SKU in one glance), and **one grade, many sources** (the tone-map and reflection environment are the great equalizer that lets a $0-budget asset pipeline cohere).

---

### 13.1 The "Heightened Retail Realism" Thesis, Operationalized

Heightened retail realism is a measurable target, not a mood. A real supercenter is flat, grey-green, fluorescent-ugly. We keep its *architecture* and *density* but push **saturation, warmth, and contrast** one stop past reality so the space reads as a place you *want* to run through — "grocery shopping meets GTA," per the project direction. Three global settings, all shipped, do this work before a single texture is authored:

| Grade control | Shipped value | File | Art-direction role |
|---|---|---|---|
| Tone mapping | `ACESFilmicToneMapping` | `main.js:31` | Filmic shoulder rolls off emitter highlights (troffers, screens, LEDs) so nothing clips to flat white; the toe deepens shadows for contrast. |
| Exposure | `toneMappingExposure = 1.0` | `main.js:32` | Neutral key. Seasonal overlays (13.9) may nudge ±0.06 but 1.0 is canon. |
| Environment intensity | `scene.environmentIntensity = 0.55` | `env.js:17` | The single HDRI reflection is dialed to 55% so our own lights lead and reflections *fill* — this is why chrome, glass, and can-tops share one coherent sheen. |
| Fog | `THREE.Fog(0x11151a, 24, 46)` | `store.js:1226` | Near 24 m / far 46 m. Desaturates and cools distant geometry toward `#11151a`, blending far shelves and the night lot into one atmosphere. |
| Scene clear | `background = 0x0d1013` | `store.js:1225` | Near-black `#0d1013` behind everything; only visible through the storefront glass and in fog falloff. |
| Bloom | strength `0.16`, radius `0.5`, threshold `0.96` | `main.js:84` | Threshold 0.96 means **only true emitters bloom** — labels, however bright, do not halo. This keeps procedural packaging from glowing differently than photoscans. |
| Contact AO | GTAO radius `0.35`, blend `0.85`, 8 samples | `main.js:78-79` | Grounds every object that does not cast a shadow map (all products) with a tight ambient-occlusion contact. |

**The saturation-band rule.** The floorplan is authored in three saturation zones. This is enforced at authoring time by which palette tokens (13.4) a surface is allowed to pull from:

| Zone | Footprint | Saturation / temperature | Anchoring hexes |
|---|---|---|---|
| **Grocery half (west)** | x −22 … −4 | High saturation, warm | Food reds/yellows/greens; wall accent band `#1d5c38`; produce mural `#1d5c38` |
| **Produce corner** | x −20.4 … −14.8, z 9.4/12 | **Highest** saturation, warmest | Real photoscan fruit + `#1d5c38` fresh identity + wood `#9a7c50` |
| **Merch half (east)** | x 4 … 22 | Lower saturation, cool | Carpet `#3c4048` (electronics) / `#4a4640` (apparel); dark product boxes `#14181f`–`#33383f` |
| **Night lot (exterior)** | z > 15, seen through glass | Desaturated, cold blue | Sky `#04060c → #0a1222 → #1a2438`; lamp pools `#ffdca0` as the only warmth |

The transition from warm-grocery to cool-merch happens at the front strip (checkout, z ≈ 10.6), whose banner uses the warm bronze `#8a5a12` — a deliberate hinge color between the two halves.

**The "Palette LUT" (authoring-time discipline).** There is no `.cube` file in the pipeline; the Intel-iGPU floor forbids a per-pixel LUT pass on top of ACES. Instead the LUT is a *rule*: **every color written to a canvas texture or material must be a token from the master palette in 13.4.** The global grade stack (ACES → env 0.55 → fog → bloom 0.96) then acts as the de-facto film grade applied uniformly to all four asset classes. A color that is not in the token set is a bug, the same way a raw `MeshStandardMaterial` churn was a bug (`products.js:207`).

---

### 13.2 The Great Equalizer — How Four Asset Provenances Coexist

The hardest art problem is that the store mixes hand-built procedural meshes, CC0 photoscans, flat-shaded Kenney vehicles, and PBR-scanned humans. They cohere because **five global systems touch all of them identically**:

1. **One reflection environment.** `empty_warehouse_01` HDRI drives `scene.environment` for *every* PBR material (`env.js`). A procedural can-top, a photoscanned apple, and a Rocketbox jacket all reflect the same room at the same 0.55 intensity. This is the strongest unifier.
2. **One tone map.** ACES + exposure 1.0 crushes highlights and lifts the toe identically regardless of where the pixels came from.
3. **One fog.** Distance grading pulls all far geometry toward `#11151a`.
4. **One contact-AO pass.** GTAO grounds procedural, photoscan, and kit meshes to the floor with the same 0.35 m radius.
5. **One bloom gate.** Threshold 0.96 means only emitters bloom, so no asset class gets a different "digital" halo.

**Grounding tricks per asset class** (each class is landed on the floor by a different, cheap trick):

| Asset class | Source | Grounding technique | Shipped anchor |
|---|---|---|---|
| **Procedural products** | canvas + primitives | Do **not** cast shadows; GTAO provides contact. Placed with seeded jitter (±0.015 m in z, ±0.09 rad rotation) and a 5% gap rate so shelves read "shopped." | `products.js:204`, `store.js:105-106` |
| **Photoscans (Poly Haven)** | scanned glTF | Scaled to a real physical height (`modelH`) so they sit at believable scale; folded into the *same* instanced-stock batching as procedural goods; produce rests on real wood (`wood_planks` PBR) crate tables. | `products.js:329-336`, `store.js:1334` |
| **Kenney vehicles** | flat-shaded kit | Live only in the night lot; rendered **fog-excluded** (`fog:false`) as crisp silhouettes; grounded by emissive headlights `#bfd4e6` / tails `#ff2a1a` and additive lamp pools `#ffdca0` at 0.13 opacity — no real exterior lights exist. | `store.js:497,502,661` |
| **Rocketbox humans** | PBR photoscan + rig | The realism anchor. Full PBR with baked normal maps, retargeted animation (Ch. 17), grounded by the shared spot-light shadow maps. Their fidelity licenses the rest of the scene to be simpler. | `characters.js`, CREDITS.md |

The design intent: the **humans and photoscans set the realism ceiling**; procedural goods and Kenney cars sit *just* below it, and the global grade compresses the gap until the seams disappear at gameplay distance and speed.

---

### 13.3 Material Language — What May Be Glossy

Gloss is **earned by real-world substrate**, never decorative. The material vocabulary is fixed in `materials.js` (three factories) and `products.js` (per-kind roughness). The rule: *paperboard is matte, glass/PET/foil is glossy, bare metal reads only from the HDRI.*

| Substrate / role | Material | Roughness | Metalness | envMapIntensity | Rule |
|---|---|---|---|---|---|
| Structural steel (shelf, cart, trim) | `METAL()` | 0.38 (0.28–0.45) | 0.95 | 1.1 | No texture — metal reads purely from HDRI reflection. |
| Painted trim (kickboard, bins) | `PAINTED()` | 0.6 | 0.0 | — | Flat, no reflection character. |
| Molded plastic (cart grip, readers) | `PLASTIC()` | 0.25 | 0.0 | 1.2 | Slight sheen, no metal. |
| Box / carton face | canvas label | 0.82 | 0 | — | **Matte paperboard.** Cereal, cookies, TVs. |
| Box sides | `bg2` flat | 0.85 | 0 | — | Matte, darkest brand color. |
| Can label | canvas (wrap) | 0.35 | 0.5 | — | Semi-gloss litho on tin. |
| Can top/bottom | steel `#d7dde3` | 0.30 | 0.95 | — | Bright rolled metal. |
| Jar body | canvas (wrap) | 0.25 | 0 | 1.4 | Glossy glass. |
| Jar lid | brass `#cfa348` | 0.35 | 0.85 | — | Metal twist-cap. |
| Bottle body | canvas (wrap) | 0.20 | 0 | 1.5 | **Glossiest** — PET/glass. |
| Bottle shoulder | `bg1` flat | 0.15 | 0 | 1.5 | Wet-look plastic. |
| Bag front (chips) | canvas | 0.22 | 0.15 | 1.35 | Metallized-film sheen. |
| Carton (gable-top milk) | canvas | 0.5 | 0 | — | Semi-matte coated board. |
| Cup / tub (dairy, ice cream) | canvas | 0.40 / 0.45 | 0 | — | Matte-satin polypro. |
| Foil lids (yogurt, cup) | `#d9dee4` | 0.25 | 0.9 | — | Bright foil. |
| Play ball | `bg1` | 0.35 | 0 | 1.3 | Vinyl sheen. |

Two hard prohibitions preserve the "heightened but honest" look: **(a)** no clearcoat anywhere on gameplay geometry — even the floor fakes its wax with low roughness (0.42) + boosted `envMapIntensity: 1.5` rather than a `MeshPhysicalMaterial` clearcoat, because clearcoat is too costly per-pixel on the iGPU floor (`store.js:1237`). **(b)** No emissive on non-emitters — emissive is reserved for the fixtures that are *supposed* to bloom (troffers, LEDs, screens, EXIT/pharmacy signs). This is why bloom threshold 0.96 is safe.

---

### 13.4 Master Palette (Every Hex the Renderer May Emit)

These are the only colors authored anywhere in the world. All are extracted from shipped source. Group A is the retailer's own brand identity; the rest are the environmental token set.

**A. Fascia brand — "Grocery Dash Supercenter"**

| Token | Hex | Role | Source |
|---|---|---|---|
| Dash Navy | `#173a63` | Wayfinding field, aisle markers, electronics & entrance banners, ink on light packs | `store.js:44,436,999` |
| Dash Green | `#1d5c38` | Fresh/brand identity, wall accent band, produce banner & mural | `store.js:263,879,1252` |
| Signal Yellow | `#ffd23b` | Deals, aisle-number block, star ratings, price emphasis | `store.js:45,61,1294` |
| Signal Red | `#c9241a` | Sale/urgency, toys banner, price-tab, weekly-sale poster | `store.js:90,1109,1286` |
| Fresh Green (bright) | `#35c46a` | Checkout ring, EXIT/pharmacy glyphs, HUD "got it," boot bar | `main`/HUD, `store.js:65,886,1121` |
| Fresh Green (light) | `#8be0a4` | Boot-bar gradient tail | `index.html:18` |

**B. Shell & structure**

| Token | Hex | Role |
|---|---|---|
| Ceiling White | `#f0f2f4` | Ceiling tile field |
| Ceiling Grid | `#cfd4d8` | Tile grid lines |
| Vent Grey | `#dfe3e6` / `#c2c7cb` | Vent tile + louvers |
| Shelf Steel | `#c4cace` | Gondola shelf slabs |
| Steel (generic) | `#b9c0c7` | Default `METAL()` |
| End-cap Steel | `#9aa1a8` | Gondola end caps, poles |
| Kickboard Dark | `#2b3038` | Shelf & counter kickboards |
| Shelf Header | `#f2f4f6` | White header rail |
| Rail White | `#f7f9fb` | Shelf lip rails |
| Pegboard | `#eef0f2` / holes `#c9cdd1` | Merch pegwall |
| Knee Wall | `#585f66` | Storefront base |
| Mullion | `#2e3338` | Storefront glazing bars |

**C. Light & atmosphere**

| Token | Hex | Role | Source |
|---|---|---|---|
| Troffer emissive | `#ffffff` @ 2.1 | Instanced ceiling fixtures | `store.js:681` |
| Floor streak | `#fff3dd` @ 0.045 add | Fake wax reflection under each troffer | `store.js:687` |
| Rect wash | `#fff2e2` @ 3.2/2.4 | Aisle & front over-lighting | `store.js:16` |
| Spot warm | `#fff4e6` @ 38 | Feature/produce/checkout keys | `store.js:704` |
| Hemi sky | `#cfe0f0` @ 0.34 | Cool ambient from above | `store.js:712` |
| Hemi ground | `#39352f` | Warm bounce from below |
| Fog | `#11151a` (24–46 m) | Distance grade |
| Background | `#0d1013` | Scene clear |
| Freezer LED | `#dcecff` @ 1.6 | Glass-door case strips | `store.js:181` |
| Freezer glass | `#bfd8ea` @ 0.16 | Case glazing |

**D. Exterior (night lot)**

| Token | Hex | Role |
|---|---|---|
| Sky (zenith→horizon) | `#04060c` → `#0a1222` → `#1a2438` | Gradient dome |
| Skyline windows | `#ffd98a`, `#bcd6ff`, `#ffe9c9` | Distant lit buildings |
| Lamp head emissive | `#ffd9a0` @ 2.4 | Parking lamps |
| Lamp pool | `#ffdca0` @ 0.13 add | Ground light circle |
| Car glass | `#0c1016` | Windshields |
| Headlight | `#bfd4e6` @ 0.25 | Front lamps |
| Tail-light | `#ff2a1a` @ 0.65 | Rear lamps |

**E. Accent family** (zone markers, apparel, toy balls, plant pots) — the only saturated non-food colors allowed: `#c9241a` (red), `#1f6fc2` (blue), `#2e8b57` (green), `#e0a01f` (amber), `#7a3fb5` (violet), `#d8688a` (rose), `#e8e4da` (cream), `#22262b` (charcoal). Carpets: apparel `#4a4640`, electronics `#3c4048`.

---

### 13.5 The Fascia Brand — "Grocery Dash Supercenter"

The store is a single fictional retailer. Its identity is the reference every house brand either aligns with or deliberately contrasts against.

- **Wordmark:** `GROCERY DASH` set in the system stack (`Arial, "Helvetica Neue", Helvetica, sans-serif`), weight 800, uppercase, +0.5 px tracking; the "3D" suffix drops to weight 500 at 50% opacity (canon in the boot screen, `index.html:15-16`). On the interior fascia it is rendered white 800/96 px on Dash Navy `#173a63` with a faint emissive `#2a5a92` @ 0.15 so it glows just under the bloom threshold (`store.js:436`).
- **Colors:** Dash Navy primary, Dash Green secondary, Signal Yellow + Signal Red as the deal/urgency pair.
- **Boot identity:** radial background `#16202b → #090b0e`, progress bar fill gradient `#35c46a → #8be0a4` on a 12%-white track (`index.html:14-18`). This green-on-dark is the brand's "loading heartbeat."
- **Voice:** plainspoken value retail — "quality for less," "fresh daily," "everyday price." Every shelf tag carries a rotated `EVERYDAY` tab in Signal Red (`products.js:90-92`).
- **Placement:** the fascia banner hangs over the entrance at y 3.5, facing inward, so returning players read it through the storefront glass from the lot.

---

### 13.6 The House Brands — 20 Tentpole Labels

Each brand below is grounded in shipped SKUs and their exact packaging hexes. **Logo/type** describes the canvas-drawn wordmark treatment (all use the system sans unless a serif is called out for heritage brands; the label engine supports the 3-dot product window, top/bottom accent bars, and an accent underline rule — `products.js:52-68`). **Coverage** lists current SKUs and the line-extension lane toward Ch. 16's 150-SKU catalog.

**1. NORTHFIELD** — *Pantry / Breakfast.* Wholesome heartland cereal & grains.
- **Coverage:** `cereal_oat` (Honey Oats, $4.29). Extension lane: granola, oat clusters, instant oatmeal, muesli.
- **Logo/type:** wordmark 700 uppercase in warm brown `#5a2d00` ink over an amber field; accent underline in the same brown. A drawn wheat-sheaf motif fits the 3-dot window row.
- **Palette:** primary `#e8a020`, secondary `#c6741a`, accent `#5a2d00`.
- **Voice:** "Whole grain, every morning." (tag line literally rendered: `Whole Grain`.)
- **Shelf presence:** breakfast runs on grocery islands 1 & 3; warm amber blocks read from the aisle mouth.

**2. SUNRISE** — *Pantry / Breakfast.* Bright, kid-facing flakes & puffs.
- **Coverage:** `cereal_flake` (Corn Flakes, $3.89). Extension: frosted flakes, puffed rice, cocoa cereal.
- **Logo/type:** bold 800 red wordmark with a Signal-Yellow accent bar and rising-sun arc drawn above the window.
- **Palette:** primary `#e23b2e`, secondary `#a51f16`, accent `#ffd23b`.
- **Voice:** "Rise and shine."
- **Shelf presence:** sits beside Northfield; the red/amber pairing gives breakfast its warm signature.

**3. BELLA** — *Pantry / Italian dry.* Blue-box pasta, trattoria-classic.
- **Coverage:** `pasta` (Penne Rigate, $1.79). Extension: spaghetti, fusilli, lasagne sheets, orzo.
- **Logo/type:** 700 wordmark in white on cobalt, gold `#ffcf33` underline; a small drawn fork-swirl glyph.
- **Palette:** primary `#1d64b8`, secondary `#123f75`, accent `#ffcf33`.
- **Voice:** "La pasta di casa."
- **Shelf presence:** the cobalt blocks anchor the pasta-&-sauce aisle (aisle 3) against Nonna's red.

**4. NONNA'S** — *Pantry / Italian jarred.* Heritage sauces in glass.
- **Coverage:** `sauce` (Marinara, $3.49). Extension: arrabbiata, alfredo, pesto, roasted-garlic.
- **Logo/type:** the one grocery brand set in **Georgia serif** for heritage warmth; cream `#f4e3c1` script-weight wordmark on deep tomato red, glossy jar substrate (roughness 0.25).
- **Palette:** primary `#b02318`, secondary `#7c150d`, accent `#f4e3c1`.
- **Voice:** "Like she used to make."
- **Shelf presence:** glossy jars catch the aisle rect-light next to Bella's matte boxes — a deliberate finish contrast.

**5. KETTLE CO** — *Pantry / Canned.* The workhorse tinned-goods house brand.
- **Coverage:** `soup` (Tomato, $1.49, red `#d23324`), `beans` (Baked Beans, $1.29, blue `#1f7ac2`). Extension: chicken soup, chili, mixed veg, chickpeas.
- **Logo/type:** 700 wordmark, semi-gloss litho on tin (roughness 0.35, metalness 0.5); cream `#f4e3c1` on soup, yellow `#ffcf33` on beans — **color-coded by variety, one wordmark.**
- **Palette:** primary `#d23324` / `#1f7ac2`, secondary `#8f1c12` / `#12507f`.
- **Voice:** "Pantry-ready, always."
- **Shelf presence:** two color variants make Kettle Co the most recognizable multi-facing block in canned goods; bright steel tops bloom-safe under 0.96.

**6. CRUNCH** — *Snacks / Chips.* Metallized-bag salty snacks.
- **Coverage:** `chips` (Sea Salt, green `#2fae6a`), `chips_bbq` (BBQ, red `#c0392b`), both $2.99. Extension: sour cream, salt & vinegar, tortilla, cheese puffs.
- **Logo/type:** 800 wordmark, foil-sheen substrate (roughness 0.22, metalness 0.15); flavor-coded field with a torn-edge accent band `#fff2b0` / `#ffd23b`.
- **Palette:** primary `#2fae6a` / `#c0392b`, secondary `#1c6f43` / `#7c231a`.
- **Voice:** "Hear the crunch."
- **Shelf presence:** pillowed bag geometry (`bagGeometry`, `products.js:189`) bulges toward the aisle; the foil catches spot-light and sells the snack wall.

**7. FIZZ** — *Snacks / Beverages.* Dark-cola in 2 L PET.
- **Coverage:** `cola` (Cola Classic, $1.89, 2 L). Extension: diet, cherry, lemon-lime, root beer.
- **Logo/type:** 800 white wordmark on near-black `#3a2015`, Signal-Red `#e02b20` accent cap; glossiest substrate (roughness 0.20, envMap 1.5).
- **Palette:** primary `#3a2015`, secondary `#1e0f08`, accent `#e02b20`.
- **Voice:** "Crack one open."
- **Shelf presence:** tall glossy bottles are the reflective highlight of the beverage run; the red cap is the only warm note on a dark pack.

**8. ALPINE** — *Snacks / Water.* Clean spring-water in clear PET.
- **Coverage:** `water` (Spring Water, $0.99, 1.5 L). Extension: sparkling, flavored, mineral, 6-pack.
- **Logo/type:** light 700 wordmark, icy `#eaf6ff` accent, a drawn peak silhouette above the window; high-gloss bottle.
- **Palette:** primary `#2a7fc9`, secondary `#175a96`, accent `#eaf6ff`.
- **Voice:** "Straight from the source."
- **Shelf presence:** cool blue-white pack is the palette-cleanser between the warm snack bags.

**9. CLOUDSOFT** — *Household / Paper.* Soft-goods tissue & bath.
- **Coverage:** `tp` (Bath Tissue 4pk, $5.49), `tissues` (Facial Tissues, $2.29). Extension: 12-roll, paper towels, napkins, wet wipes.
- **Logo/type:** 700 Dash-Navy `#173a63` ink on pale blue-white board; a drawn cloud puff replaces the 3-dot row.
- **Palette:** primary `#eef3f8` / `#7fb7e0`, secondary `#c9d9ea` / `#4c86b3`, accent `#2a6fc0`.
- **Voice:** "Softness you can trust."
- **Shelf presence:** the palest packs in the store — big matte white `boxwide` blocks that read the household aisle as clean.

**10. WAVE** — *Household / Cleaning.* Teal laundry & surface care.
- **Coverage:** `detergent` (Laundry Power, $8.99, `boxtall`). Extension: dish soap, fabric softener, all-purpose spray, pods.
- **Logo/type:** 800 white wordmark on teal, Signal-Yellow `#ffd23b` accent, a drawn wave-crest under the wordmark.
- **Palette:** primary `#1a9e8f`, secondary `#0f6a60`, accent `#ffd23b`.
- **Voice:** "Powers out the day."
- **Shelf presence:** the tall teal box is the household aisle's saturation peak against CloudSoft's whites.

**11. MEADOW** — *Dairy.* Chilled-case cornerstone (milk + cultured).
- **Coverage:** `milk` (Whole Milk, $2.59, gable carton), `yogurt` (Greek Yogurt, $1.19, cup). Extension: 2% milk, butter, cottage cheese, sour cream, kefir.
- **Logo/type:** 700 wordmark, Dash-Navy `#123a63` ink on milk / dairy-green `#2b4a31` on yogurt; a drawn rolling-hill line. Semi-matte carton (0.5) vs. satin cup (0.4).
- **Palette:** primary `#f4f7fb` / `#f7f3ec`, secondary `#d7e4f2` / `#e2d7c3`, accents `#1f6fc2` / `#3a7d44`.
- **Voice:** "Fresh from the meadow."
- **Shelf presence:** the pale carton block defines the dairy face; blue vs. green accents color-code fresh vs. cultured.

**12. GROVE** — *Dairy / Chilled juice.* Orange-forward juice cartons.
- **Coverage:** `juice` (Orange Juice, $3.49, carton). Extension: apple, cranberry, lemonade, smoothie.
- **Logo/type:** 800 white wordmark on bright orange, brown `#5a2d00` ink details, a drawn orange-slice in the window.
- **Palette:** primary `#ff9a1f`, secondary `#e0700d`, accent `#fff`.
- **Voice:** "Squeezed sunshine."
- **Shelf presence:** the warmest pack in the cool dairy case — an intentional pop of orange beside Meadow's pastels.

**13. HEARTH** — *Bakery.* In-store bakery house brand (bagged + boxed + scanned).
- **Coverage:** `bread` (Country Loaf, $2.89, bag), `muffins` (Blueberry, $4.49, box), `croissant` (Butter Croissant, photoscan). Extension: baguette, bagels, dinner rolls, cinnamon buns.
- **Logo/type:** **Georgia serif** heritage wordmark in deep-crust brown `#3d2610`, tan kraft field; a drawn wheat/flame "hearth" glyph. The croissant is a real Poly Haven scan grounded on the bakery back wall.
- **Palette:** primary `#d8a45c` (bread) / `#4a5fb8` (muffins), secondary `#a3743a` / `#2c3a78`.
- **Voice:** "Baked this morning." (echoed on the bakery mural, `store.js:880`.)
- **Shelf presence:** kraft-brown bags on the bakery wall + one photoscanned croissant that quietly out-details everything around it — the fidelity anchor of the food half.

**14. STONEFIRE** — *Frozen.* Stone-baked frozen pizza.
- **Coverage:** `pizza` (Margherita, $5.99, `boxwide`). Extension: pepperoni, four-cheese, veggie, calzone.
- **Logo/type:** 800 wordmark, ember `#ffe08a` accent on deep tomato red, a drawn flame under the window; matte box seen *through* freezer glass `#bfd8ea` + LED `#dcecff`.
- **Palette:** primary `#b02318`, secondary `#701009`, accent `#ffe08a`.
- **Voice:** "Stone-baked, flash-frozen."
- **Shelf presence:** glimpsed behind the 10-door freezer wall; the LED strips rim-light the pack.

**15. POLAR** — *Frozen.* Tub ice cream & novelties.
- **Coverage:** `icecream` (Vanilla, $4.29, tub). Extension: chocolate, strawberry, cookie-dough, popsicles, cones.
- **Logo/type:** 700 wordmark, Dash-Navy `#173a63` ink on frost-white, caramel `#8a5a2b` accent; a drawn snowflake. Satin tub (0.45) with a colored lid.
- **Palette:** primary `#eef3f8`, secondary `#bcd2e8`, accent `#8a5a2b`.
- **Voice:** "Cold comfort."
- **Shelf presence:** the frost-white tub reads bright behind the cold-blue freezer glazing — a value-key contrast with dark Stonefire.

**16. VIXEL** — *Electronics.* Screens & audio flagship (the merch-half hero brand).
- **Coverage:** `tv55` (55" 4K TV, $379, `boxbig`), `soundbar` (2.1, $89). Extension: 65" TV, streaming stick, tablet, projector. Also runs the **"VIXEL VISION" demo reel** on the TV wall (`store.js:979`).
- **Logo/type:** 800 wordmark, cyan `#35c4c4` (TV) / amber `#e0a01f` (audio) accent on near-black; the TV-wall demo screen renders `4K ULTRA` in `#48e07a` over `VIXEL VISION` in `#bcd6ff` on `#091220`. Matte tech box.
- **Palette:** primary `#14181f` / `#1c2027`, secondary `#0a0d12` / `#10131a`.
- **Voice:** "See it in Vixel."
- **Shelf presence:** commands the entire TV wall (z −14.6); the emissive demo screens (emissiveIntensity 0.9) are the cool-half's light source and its brand statement.

**17. PLAYBOX** — *Electronics / Gaming.* Console & accessories.
- **Coverage:** `console` (Game Console, $299, box). Extension: controller, VR headset, handheld, game cases.
- **Logo/type:** 800 wordmark, gamer-green `#48e07a` accent on deep indigo; a drawn "play triangle" in the window.
- **Palette:** primary `#1f2f52`, secondary `#101a30`, accent `#48e07a`.
- **Voice:** "Game on."
- **Shelf presence:** the green accent ties PlayBox to the store's Fresh-Green emitter family, making the gaming endcap glow-adjacent.

**18. BRIXO** — *Toys / Construction.* Building-block sets.
- **Coverage:** `blocks` (Building Blocks 250 pc, $29, box). Extension: vehicle set, castle set, minifig packs, baseplates.
- **Logo/type:** chunky 800 wordmark in white on primary blue, Signal-Yellow `#ffd23b` accent, drawn stud-dots (the 3-dot window motif becomes literal brick studs).
- **Palette:** primary `#1f6fc2`, secondary `#124a85`, accent `#ffd23b`.
- **Voice:** "Build anything."
- **Shelf presence:** primary-color box on the toys island (x 19.5) beside the ball bin; the red Toys banner `#c9241a` frames it.

**19. RELIEVO** — *Pharmacy.* OTC pain & wellness.
- **Coverage:** `meds` (Pain Relief 24 ct, $6.50, box). Extension: cold & flu, allergy, antacid, sleep aid.
- **Logo/type:** clinical 700 wordmark, Signal-Red `#c9241a` accent + `#8a1610` ink on clean white board; a drawn medical cross echoing the emissive pharmacy sign (`#35c46a`, `store.js:1121`).
- **Palette:** primary `#f2f4f6`, secondary `#d5dde5`, accent `#c9241a`.
- **Voice:** "Fast relief, trusted care."
- **Shelf presence:** white-and-red packs behind the pharmacy counter (x 18.5); reads "clinical" against the toys' primary chaos next door.

**20. FRESH** — *Produce.* The unbranded-fresh banner over all loose produce.
- **Coverage:** `apple`, `lemon`, `banana`, `avocado`, `onion`, `sweetpotato` — all **photoscanned** (Poly Haven). Extension: tomato, potato, orange, bell pepper, leafy greens, berries.
- **Logo/type:** not a pack — an *identity system*: Dash-Green `#1d5c38` produce banner + mural "picked daily," and per-item **chalkboard tags** (Georgia serif on `#23272b`, name in `#f2f2ea`, price in Signal Yellow, `store.js:56-62`).
- **Palette:** produce hues are the real scanned fruit — apple `#c62d1f`, lemon/banana `#f2c81b`, avocado `#3a9d44`, onion `#e0a01f`, sweet potato `#b3541a` — against green `#1d5c38` signage and `#9a7c50` wood crates.
- **Voice:** "Picked daily."
- **Shelf presence:** the highest-saturation, highest-fidelity corner of the store (6 crate tables, x −20.4…−14.8) — the realism showcase, lit by dedicated warm spots.

---

### 13.7 Challenger Brands — The Other 20 Facings

These single-facing brands fill category breadth and give the shelves variety. Each still obeys the label grammar and palette. Full enumeration:

| # | Brand | Zone | SKU(s) | Primary | Secondary | Accent | Voice line |
|---|---|---|---|---|---|---|---|
| 1 | Nutty | Pantry | Peanut Butter (jar) | `#a5692a` | `#71431a` | `#ffe08a` | "Nothing but nutty." |
| 2 | Golden | Pantry | Sweet Corn (can) | `#f2b800` | `#c48f00` | `#2e7d32` | "Sun-ripened sweet." |
| 3 | Reddy | Pantry | Tomato Ketchup (bottle) | `#c8231b` | `#8a1610` | `#fff` | "Always Reddy." |
| 4 | Pantry | Pantry | Tinned Assortment (photoscan) | `#8f9aa4` | `#5c666e` | `#c9241a` | "Stock the shelf." |
| 5 | Twist | Snacks | Salted Pretzels (bag) | `#8a5a2b` | `#5c3a1a` | `#ffe08a` | "Twist & snack." |
| 6 | Oven Joy | Snacks | Choco Chunk cookies (box) | `#4a2c8f` | `#2e1a5e` | `#ffb84d` | "Baked-in joy." |
| 7 | Chewy | Snacks | Gummy Bears (bag) | `#e0447a` | `#9e2752` | `#ffe9f2` | "Chew the rainbow." |
| 8 | Pure | Household | Soap Bars 3pk (box) | `#e8e0f4` | `#c3b3e4` | `#6a3fb5` | "Simply Pure." |
| 9 | Dale | Dairy | Cheddar Block (box) | `#f2a71b` | `#c07d10` | `#7a4a00` | "Aged the slow way." |
| 10 | Aural | Electronics | Headphones (box) | `#2a2f38` | `#171b22` | `#d8688a` | "Hear everything." |
| 11 | Linkly | Electronics | WiFi Router (box) | `#f2f4f6` | `#c9d2da` | `#1f6fc2` | "Stay linked." |
| 12 | MixMate | Home | Blender (boxtall) | `#c9241a` | `#8a160f` | `#fff` | "Blend it all." |
| 13 | Plush | Home | Bath Towels 2pk (boxwide) | `#3a7d8c` | `#245560` | `#f4e3c1` | "Wrap yourself up." |
| 14 | ChefLine | Home | Cookware Set (boxbig) | `#33383f` | `#1d2126` | `#e0a01f` | "Cook like a pro." |
| 15 | Glow | Home | Desk Lamp (boxtall) | `#f2e8d8` | `#d8c9b0` | `#8a5a2b` | "Light your work." |
| 16 | ZoomCo | Toys | Monster Truck (box) | `#e0a01f` | `#b07708` | `#c9241a` | "Zoom into fun." |
| 17 | Bounce | Toys | Play Ball (vinyl) | `#c9241a` | `#8a160f` | `#fff` | "Bounce all day." |
| 18 | Snuggle | Toys | Plush Bear (box) | `#8a5a2b` | `#5c3a1a` | `#f4e3c1` | "A hug that lasts." |
| 19 | VitaDay | Pharmacy | Multivitamin (jar) | `#f2e8d8` | `#e0cfae` | `#2e7d32` | "Every day, better." |
| 20 | MendFast | Pharmacy | Bandages (boxwide) | `#e8ebee` | `#c5ccd3` | `#1f6fc2` | "Heals in a hurry." |

Note the deliberate cross-brand palette echoes that keep the store coherent: Bounce/MixMate share Signal-Red bodies; ZoomCo/Dale/Golden share the amber family; Pure/VitaDay use the violet/green wellness pair; Plush/Snuggle/Twist share the kraft-brown warmth. No challenger introduces a hue outside the master palette.

---

### 13.8 Signage & Wayfinding System

Signage is a closed grammar of six canvas templates, all rendered in the system sans (Georgia serif reserved for "handwritten" chalk). Every sign is `roughness 0.7`, non-emissive unless it is a code-required emitter (EXIT, pharmacy cross, lane numbers).

**Type ramp** (px at canvas resolution → weight → role):

| Tier | Size / weight | Case | Used on |
|---|---|---|---|
| Display | 800 / 96 px | UPPER | Department banners (`bannerTex`, 1024×160) |
| Aisle number | 800 / 92 px | numeral | Aisle blade yellow block (`aisleSignTex`, 512×170) |
| Heading | 700 / 44 px | Title | Aisle line 1, brand wordmarks |
| Sub | 500 / 36 px | Title | Aisle line 2 (`#bcd2e8`) |
| Price (serif) | 800 / 44 px Georgia | — | Chalk & shelf price |
| Body | 500 / 17 px | Sentence | Shelf-tag product name |

**Sign templates & their fixed styling:**

| Template | Field | Text | Fixture |
|---|---|---|---|
| Department banner | zone color (see below) | white 800 | Double-sided plane on two `#666a6e` rods to ceiling (`hangingSign`) |
| Aisle blade | Dash-Navy `#173a63` + yellow `#ffd23b` number block | navy numeral, white heading, `#bcd2e8` sub | 1.7 m plane, y 3.0, at aisle mouths |
| Chalk produce tag | `#23272b` + `#8a8f94` border | serif name `#f2f2ea`, price `#ffd23b` | Tilted −0.18 rad on crate face, y 1.06 |
| Shelf price tag | `#fdfdf6` | name `#111`, price `#111` 44 px, red `#c9241a` `EVERYDAY` tab | On shelf lip, y = shelfY − 0.045 |
| Sale blade | `#ffd23b` (or `#c9241a` for NEW) | `#b3160c` ink | Above endcaps, y 1.35; variants `2 FOR $5.00`, `SAVE $1.00`, `NEW! try me`, `SALE! this week` |
| Wall mural | zone color | white heading + tagline | Near top of wall, y 3.35–3.55 |

**All department banner colors (complete):**

| Banner | Hex | Location |
|---|---|---|
| FROZEN | `#1f5f8a` | Freezer wall, left |
| PRODUCE | `#1d5c38` | Produce corner |
| CHECKOUT | `#8a5a12` | Front strip |
| GROCERY DASH SUPERCENTER | `#173a63` (emissive) | Entrance |
| ELECTRONICS | `#173a63` | TV wall |
| APPAREL | `#6a3fb5` | Apparel carpet |
| TOYS | `#c9241a` | Toys island |
| PHARMACY | `#0c5c38` | Pharmacy counter |

**All aisle blade signs (complete, `store.js:1321`):**

| # | Line 1 | Line 2 |
|---|---|---|
| 1 | Frozen · Breakfast | Cereal |
| 2 | Snacks · Candy | Soda · Water |
| 3 | Pasta · Sauce | Canned Goods |
| 4 | Dairy · Eggs | Household |
| 5 | Household | Paper Goods |

**All wall murals (complete):** "Fresh Produce / picked daily" (`#1d5c38`); "The Bakery / baked this morning" (`#8a5a2b`); "Home & Living / quality for less" (`#4a5568`).

**Emitter signs (code-required, allowed to bloom):** EXIT — `#48e07a` glyph on `#101418`, emissive `#35c46a` @ 0.38; pharmacy cross — `#35c46a` on `#0c3d24`, emissive @ 0.45; checkout lane numbers — `#35c46a` on `#111418`, emissive @ 0.2; closed-lane ✕ — `#d8362a`, emissive @ 0.2.

**Placement rules (invariant):** (1) Banners hang between y 2.95 and 3.5, sized 2.8–4.2 m, always double-sided, rods to the 4.2 m ceiling. (2) Blades sit at aisle mouths (z −3) at 4 m x-spacing. (3) All floor-facing signs read from *both* aisle directions (double plane). (4) Price info always sits directly at the product's shelf level, never floating. (5) Green emissive is reserved for safety/service (EXIT, pharmacy, checkout) — never for a brand or a deal, so a player learns "green glow = the system talking, yellow/red = a deal."

---

### 13.9 Seasonal Palette Overlays (Additive, Off by Default)

The **Everyday** palette (13.4) is canonical and ships as-is. Seasonal overlays are an *optional, additive* layer (aligns with the seeded/procedural stocking, Ch. 5 dailies, and the exterior time system in Ch. 15). An overlay may only do four things, none of which alter core gameplay geometry or the physics/collision layer: **(a)** swap banner/sale-tag/poster accent hexes, **(b)** tint the three light groups (rect, spot, hemisphere) within ±8% of their canon color, **(c)** shift `toneMappingExposure` within ±0.06 of 1.0, **(d)** enable a small set of seasonal endcap SKUs. Overlays never touch bloom threshold, GTAO, fog distances, or the master structural palette.

| Overlay | Sale-tag / accent swap | Light tint (rect `#fff2e2` → , hemi ground `#39352f` → ) | Exposure | Seasonal endcap SKUs |
|---|---|---|---|---|
| **Everyday** (canon) | Signal Yellow `#ffd23b` / Red `#c9241a` | canon / canon | 1.00 | — |
| **Harvest (Fall)** | Amber `#e0a01f` / Rust `#b3541a` | rect `#ffeacf`, hemi ground `#3a2f22` | 0.98 | pumpkin, gourd (photoscan reuse), pie box, cider carton |
| **Winter Holiday** | Signal Red `#c9241a` / Dash Green `#1d5c38` | rect `#fff0e0`, spot `#fff4e6`→`#ffe9d0`, hemi sky `#cfe0f0`→`#d6e6f2` | 0.96 | cocoa box, cookie tin, gift-wrap `boxwide`, candy cane bag |
| **Fresh Start (Spring)** | Fresh Green `#35c46a` / Sky `#7fb7e0` | rect `#fff6ef`, hemi ground `#39352f`→`#33402f` (green bounce) | 1.02 | salad kit, seed packet, cleaning-caddy, sparkling water 6-pack |
| **Summer Cookout** | Signal Red `#c9241a` / Signal Yellow `#ffd23b` | rect `#fff2e2` (canon warm), exterior lamp `#ffdca0`→`#ffe0b0` | 1.04 | charcoal bag, buns 8pk, soda 12-pack, ice-pop box |

Overlay selection is deterministic from the same seeded LCG the stocking uses (`seed*16807 % 2147483647`), so a given day renders the same season for every player — no calendar dependency, no backend. The default build ships **Everyday only**; overlays are a data table (Ch. 20 schema) the runtime reads if present, exactly like the optional model kit that upgrades procedural produce to photoscans.

---

### 13.10 Art-Direction Do / Don't (Definition of Done for Ch. 26)

| Do | Don't |
|---|---|
| Pull every color from the 13.4 token set | Introduce a hue outside the master palette |
| Earn gloss from substrate (glass/PET/foil/metal) | Add clearcoat or emissive to non-emitters |
| Ground procedural goods with GTAO (no shadow cast) | Let a product cast a shadow map (breaks the iGPU budget) |
| Keep brand wordmarks in the system sans (Georgia only for Nonna's/Hearth/chalk) | Ship an external font file (CSP/no-backend violation) |
| Reserve green emissive for safety/service signage | Use green glow for a deal or a brand |
| Keep exposure at 1.00 (overlays ±0.06 max) | Regrade per-scene or add a runtime LUT pass |
| Let the HDRI + ACES + fog do the cross-source unifying | Try to match asset provenances by hand-tuning materials |

Cross-references: the HUD color system (list/timer/banner) is specified in **Ch. 6 & 7**; the physical placement of every fixture named here is in **Ch. 14** (interior) and **Ch. 15** (exterior, weather, time-of-day that drives seasonal light); the 150-SKU catalog that these 40 brands scale into is **Ch. 16**; the Rocketbox realism anchor and NPC dressing are **Ch. 17**; the tone-map/bloom/GTAO/fog budget and tier system are **Ch. 21**; the brand/spec/overlay data schemas are **Ch. 20**. This chapter is the source of truth for *what color, what finish, what wordmark* — every other chapter that draws a pixel defers to it.



# Chapter 14 — Interior — Final Build-Out

This chapter is the finish-carpentry pass on the 46 × 30 × 4.2 m supercenter defined in `src/store.js`. Ch. 6 owns the screen flow, Ch. 13 owns the art-direction bible, Ch. 16 owns the 150-SKU catalog target; here we lock every fixture, prop, decal, sign, and collider that dresses the shipped `buildStore()` shell to a living-product density. Every coordinate below is world-space metres in the shipped convention: **origin at floor-centre; +x = east (general-merchandise half), −x = west (grocery half); +z = front/entrance wall, −z = back wall; +y = up to the 4.2 m ceiling; aisles run along z.** All values are read from source unless flagged **[BUILD]** (not yet in the tree — this is the spec to add it) or **[EXT]** (additive upgrade path, must not replace shipped behaviour).

---

### 14.1 The shell: global floor / wall / ceiling / lighting / signage systems

Before any department, the box itself. These systems are built once in `buildStore()` and every department inherits them.

**14.1.1 Floor.** One `PlaneGeometry(46,30)` laid flat, material `loadPBR('floor', [23,15])` (Poly Haven `floor_tiles_06`), `roughness 0.42`, `envMapIntensity 1.5`, `receiveShadow`. The low roughness + boosted env reflection is the "freshly waxed" read (clearcoat is too costly per-pixel on the Intel-iGPU floor — see Ch. 21). Tile texture repeats 23×15 → one 1 m tile per repeat. Local floor overlays are transparent decals sitting at y = 0.004–0.012, `depthWrite:false`, so they never z-fight the base:

| Overlay | Colour | Size (m) | Centre (x,z) | Opacity |
|---|---|---|---|---|
| Apparel carpet | `0x4a4640` warm grey | 13.6 × 6.8 | (10.2, 4.2) | 0.85 |
| Electronics carpet | `0x3c4048` cool dark | 18 × 10.4 | (12, −8.5) | 0.85 |
| Produce wood patch | `0x8a6a45` | 8.4 × 6.0 | (−17.7, 10.7) | 0.28 |
| Welcome mat (`WELCOME`) | `0x3a3f45` | 3.0 × 1.5 | (0, 13.7) | opaque, rough 0.95 |
| Troffer floor-streaks | `0xfff3dd` additive | 0.5 × 3.1 ×110 | under each troffer | 0.045 |

**14.1.2 Walls.** Three solid walls (`beige_wall_001` PBR, repeat [15.33,1.4] for the ±x walls, [10,1.4] for the −z wall): back `mkWall(w,0,−15,0)`, left `mkWall(d,−23,0,π/2)`, right `mkWall(d,23,0,−π/2)`. The front (+z) wall is the glass storefront (14.15). A single architectural **brand accent band** — `PAINTED(0x1d5c38)` box 0.42 tall × 0.04 deep at y = 2.52 — wraps all four walls; it is what reads "designed interior" instead of "warehouse". Gondola/wall-shelf backs carry a procedural **pegboard** texture (256², 16 px peg pitch, repeat [4,3]).

**14.1.3 Ceiling.** One `PlaneGeometry(46,30)` at y = 4.2, `ceilingTex` (512² drop-tile grid, 128 px tiles, repeat [21,14]) with a single baked HVAC vent tile, `roughness 0.95`. Only Produce breaks the grid, with two pendant cone shades (14.3).

**14.1.4 Lighting rig (exact).**

| Source | Count | Geometry / params | Position |
|---|---|---|---|
| Instanced troffers | 110 | Box 0.34 × 0.05 × 2.1, emissive `0xffffff` @ 2.1 | grid: x ∈ {−20,−16,−12,−8,−4,0,4,8,12,16,20}; z ∈ {−12.6,−9.74,−6.88,−4.02,−1.16,1.70,4.56,7.42,10.28,13.14}; y 4.17 |
| RectAreaLight (aisle) | 4 | 0.6 × 27, intensity 3.2, `0xfff2e2` | x ∈ {−16,−8,8,16}, z 0, y 4.12 |
| RectAreaLight (front) | 1 | 0.6 × 42, intensity 2.4, rotY π/2 | (0, 12.2) |
| SpotLight (shadow) | 8 | `0xfff4e6`, int 38, dist 17, angle π·0.34, penumbra 0.55, decay 1.5, 1024² shadow, near 0.5 far 14, bias −0.0005 | targets: (−16,−6),(−8,−2),(−17.7,10.7),(−8.6,10.6),(0,−6),(10,−7),(8.5,4),(18.5,10) |
| HemisphereLight | 1 | sky `0xcfe0f0`, ground `0x39352f`, int 0.34 | — |
| IBL (`scene.environment`) | 1 | `empty_warehouse_01` HDRI, `environmentIntensity 0.55` | — |

Scene `fog = Fog(0x11151a, 24, 46)`, `background 0x0d1013`. Emissive on troffers is deliberately capped at 2.1 — higher values were the historic "everything glows" bug.

**14.1.5 Signage system.** Four sign renderers, all canvas → sRGB textures:
- `hangingSign()` — double-sided plane + two 0.008 r suspension rods to the ceiling; department banners.
- `aisleSignTex(num,l1,l2)` — 512×170 blue `0x173a63` plate, yellow `0xffd23b` number chip, white line-1, `#bcd2e8` line-2.
- `bannerTex(text,bg)` — 1024×160 department banner.
- `saleTagTex` / `chalkTex` / `laneNumTex` — shelf blades, produce chalkboards, lane numerals.

**Full signage schedule** (every sign in the build):

| # | Sign | Renderer | Position (x,y,z) | Notes |
|---|---|---|---|---|
| 1 | FROZEN | banner `#1f5f8a` w3.2 | (−21.4, 2.95, 0) rotY π/2 | over freezer wall |
| 2 | PRODUCE | banner `#1d5c38` w3.4 | (−17.7, 2.95, 10.7) | |
| 3 | CHECKOUT | banner `#8a5a12` w3.4 | (−5.75, 2.95, 10.6) | |
| 4 | ELECTRONICS | banner `#173a63` w4.2 | (12, 3.1, −11.6) | |
| 5 | APPAREL | banner `#6a3fb5` w3.6 | (9.5, 3.1, 4.2) | |
| 6 | TOYS | banner `#c9241a` w2.8 | (19.5, 3.1, −2) rotY π/2 | |
| 7 | PHARMACY | banner `#0c5c38` w3.2 | (18.5, 3.1, 9.6) | |
| 8–12 | Aisle blades 1–5 | `aisleSignTex` w1.7 | x ∈ {−20,−16,−12,−8,−4}, y 3.0, z −3 | copy in 14.8 |
| 13 | "Fresh Produce / picked daily" | mural green | (−17, 3.55, 14.84) | faces in |
| 14 | "The Bakery / baked this morning" | mural brown | (−13, 3.35, −14.88) | |
| 15 | "Home & Living / quality for less" | mural grey | (12, 3.55, 14.84) | |
| 16 | EXIT | emissive box | (0, 2.72, 14.78) | |
| 17 | Wall clock | canvas circle | (0, 3.45, −14.9) | |
| 18 | GROCERY DASH SUPERCENTER | banner `#173a63` | (0, 3.5, 14.88) | exterior-facing |
| 19 | EMPLOYEES ONLY | door canvas | (−22.2, 1.15, −14.91) | 14.16 |
| 20 | RESTROOMS → | canvas | (−22.2, 2.6, −14.91) | |
| 21 | WEEKLY SALE (red) | window poster | right storefront | |
| 22 | FRESH DAILY (green) | window poster | left storefront | |
| 23 | Lane numerals 1–6 | `laneNumTex` | each pole, y 2.45 | |
| 24 | LANE CLOSED + ✕ | `saleTagTex` + red lamp | (−1, 1.0 / 2.45, 11.9) | lane 6 |
| 25 | Pharmacy green cross | canvas | (18.5, 2.7, 12.3) | |
| 26 | 8× SALE! endcap blades | `saleTagTex` | above each endcap, y 1.35 | |
| 27 | 54× rail deal tags | `saleTagTex` (3 texts ×18) | grocery island rails | 14.8 |
| 28 | 6× produce chalkboards | `chalkTex` | one per produce table | 14.3 |

**14.1.6 Dressing-density target.** Metric **D = (hand-placed props + facing-clusters) ÷ shopper-facing floor-area (m²)**, where one `stockShelf` run of 3–4 identical facings counts as one cluster/beat. Targets by zone class: **Hero perimeter** (produce, bakery, deli, checkout, entrance) **D ≥ 1.4**; **Ambient aisle** (grocery/merch islands) **D ≥ 1.0**; **Merch pad** (electronics, apparel, toys) **D ≥ 0.7**; **Service niche** (pharmacy, wine, backroom) **D ≥ 0.9**. The audit table in 14.20 measures every department against these and flags dress-to-target additions.

**14.1.7 Global collider model.** `world.colliders` is a flat AABB list; the player is a circle r = 0.34, carts r = 0.48, tested by `circleVsColliders` (circle-vs-AABB, `src/physics.js`). Eight gondolas are **tippable**: on a ≥ 4.0 m/s sprint-crash the AABB *mutates in place* to the fallen footprint (pivots at base edge ±0.46; new span = old edge ± H where H = 1.9), permanently opening/closing walk space. Cart corral rails are intentionally thin so shoved carts escape the open ends.

---

### 14.2 Produce (hero perimeter, front-left)

**Fixtures.**

| Fixture | Count | Dimensions (m) | Positions (x,z) |
|---|---|---|---|
| Crate table (top) | 6 | 1.7 × 0.10 × 1.15 @ y 0.82 | apple(−20.4,9.4) lemon(−17.6,9.4) avocado(−14.8,9.4) banana(−20.4,12.0) onion(−17.6,12.0) sweetpotato(−14.8,12.0) |
| Table skirt | 6 | 1.55 × 0.72 × 1.0 @ y 0.41 | " |
| Rim frame strips | 24 (4/table) | 1.74×0.10×0.06 (×2) + 0.06×0.10×1.11 (×2) @ y 0.9 | frame, not slab — a slab swallows the fruit |
| Pendant cone shade | 2 | cone 0.34 × 0.30, green `0x1d4a33` | (−17.7,10.7),(−15.4,9.6) @ y 3.78 |
| Pendant bulb | 2 | sphere 0.07, emissive `0xffdca0`@2.1 | same, y 3.70 |
| Hanging produce scale | 1 | red bowl 0.22 r, dial 0.11 r, 3 chains | (−16.5, ~3.85, 10.7) |
| Banana boxes (cardboard) | 2 | 0.55 × 0.30 × 0.40 | (−18.2,10.7),(−17.5,10.75) |
| Restock crate props | 2 | `prop_crate` GLB @ 0.30 h | stacked at (−21.6, 8.2) |

**Product fill.** Photoscanned CC0 GLBs (`prod_apple/lemon/banana/avocado/onion/sweetpotato`) scattered on a grid: default `gx6 × gz4, step 0.24`; banana overrides `gx4 × gz3, step 0.36`. 12 % random skip per cell (shopped-from gaps), full 2π random yaw, ±0.04 jitter → ≈ 110 loose facings total, all grabbable. **Dressing checklist to target:** chalk price sign per table (`chalkTex`, name + `$price weight`, tilted −0.18 rad, at local (0,1.06,0.62)); wood floor patch (14.1.1); wet-floor cone parked off the walk line at (−20.8, 2.5). **Floor:** wood-patch decal over waxed tile. **Ceiling:** the two pendant shades (only ceiling break in the store). **Lighting:** SpotLights (−17.7,10.7) & (−8.6,10.6) graze the tables; pendants add warm local pools. **Signage:** #2 PRODUCE banner; 6 chalkboards. **Colliders:** per table AABB x ± 0.9, z ± 0.62 (6 total) + crate stack (−22.1..−21.1, 7.7..8.7). **Density:** ~34 m², 6 tables + 6 clusters + 5 props ≈ 0.5 raw → produce reads dense because of loose-fruit count; **measured D 1.6** with fruit clusters counted. Pass.

---

### 14.3 Bakery (hero perimeter, back-wall grocery side)

**Fixtures.** One `wallShelf` (H 2.0, D 0.45), length 16, at (−13, 0, −14.72), rotY −π/2, flush to the back wall. Four shelf slabs at y {0.28,0.68,1.08,1.48}, pegboard back, dark kickboard, white rails. **Section rotation** across the four shelves: `bakery, bakery, snacks, pantry` — so the eye-line reads bread/muffins/croissant, filler above/below. **Product fill:** `bread`, `muffins`, and photoscanned `prod_croissant` (0.06 h) run in `stockShelf` clusters (~72 facings across the run), all grabbable. **Dressing checklist:** cardboard restock boxes at (−20.6,−14.1),(−19.9,−14.15) (`prop_box` GLB, 0.42 h); the "The Bakery / baked this morning" wall mural (#14) directly above; the wall accent band passes behind at y 2.52. **Floor:** base waxed tile. **Wall:** pegboard shelf back over beige wall; brown mural. **Lighting:** troffer row at z ≈ −12.6 plus HemisphereLight fill; no dedicated spot (perimeter shelf reads fine under troffers). **Signage:** #14 mural. **Collider:** single long AABB (−21.2..−4.8, −15..−14.4). **Density:** shelf 11.5 m², ~18 clusters → **D 1.6**. Pass. **[EXT]** optional glass sneeze-guard bread case as a future upgrade — additive, must not remove the wall shelf.

---

### 14.4 Deli — **[BUILD]** (hero perimeter, back-wall centre)

The back wall has an **8.2 m dead span from x −4.8 (bakery ends) to x +3.4 (electronics TV wall starts)** — the natural home for a full-service deli, clustering the three "fresh" service departments (produce → bakery → deli). Build spec:

| Fixture | Count | Dimensions (m) | Position (x,y,z) | Material |
|---|---|---|---|---|
| Refrigerated service case base | 1 | 7.5 × 0.95 × 0.90 | (−0.75, 0.475, −13.90) | `PAINTED(0xf2f4f6)` |
| Stainless deck | 1 | 7.5 × 0.05 × 0.80 | (−0.75, 0.98, −13.95) | `METAL(0xb9c0c7,0.4)` |
| Angled glass sneeze-guard | 1 | plane 7.5 × 0.55, tilt −0.55 rad | (−0.75, 1.30, −13.55) | glass mat opacity 0.16 |
| Interior LED strip | 3 | box 0.02 × 0.02 × 7.4, emissive `0xdcecff`@1.6 | inside, y {0.55,0.80,1.05} | reuse freezer `ledMat` |
| Deli trays (display) | 12 | box 0.42 × 0.10 × 0.34 | 12 slots along deck | canvas tray tex, **grabbable:false** |
| Overhead menu board | 1 | plane 3.4 × 0.9 | (−0.75, 2.55, −13.2) | canvas menu |
| Ticket dispenser "TAKE A NUMBER" | 1 | box 0.14 × 0.22 × 0.06 | (2.6, 1.15, −13.6) | red `0xc9241a` |
| Scale + wrap station | 1 | box 0.30 × 0.18 × 0.30 | (−3.4, 1.10, −13.7) | `PLASTIC(0x22262a)` |

**Product-fill rule:** deli platters use the **frozen non-grabbable slot pattern** (`grabbable:false`, so `buildStock` still batches them as InstancedMeshes but they never enter `raycastTargets`) — sliced-meat pink `0xd98a8a`, cheese `0xf2c81b`, salad `0x6fbf3b` canvas trays. New SKUs (`deli_ham`, `deli_turkey`, `deli_swiss`, `deli_potato_salad`, `deli_coleslaw`) belong to Ch. 16's 150-SKU expansion; MVP ships 12 static platters. **Dressing checklist:** menu board, ticket dispenser, scale, a `prop_box` restock beside the case, chalk special. **Floor:** a checker-tile service decal `0x2e3338`, 8 × 2 m at (−0.75, −12.8), opacity 0.85 (distinguishes the service zone). **Ceiling:** shared grid; add one warm SpotLight target at (−0.75,−13) to key the counter. **Signage:** **[BUILD]** DELI hanging banner `#a8541c`, w3.4, at (−0.75, 3.05, −12.8). **Collider:** AABB (−4.5..3.0, −14.4..−13.4). **Density target:** ~15 m², 8 fixtures + 12 platters ≈ **D 1.3** → add 2 restock boxes + floor decal to clear 1.4.

---

### 14.5 Dairy (ambient aisle, on gondola faces)

Dairy currently rides **gondola shelf faces**, not a dedicated case: island 3 (x −10) face +1 is all `dairy`; island 4 (x −6) face −1 is all `dairy` (see `faces[2]/[3]`). SKUs `milk` (carton), `juice` (carton), `yogurt` (cup), `cheese` (box) fill those clusters (~144 facings across the two faces). This is shipped behaviour — **do not remove it.** **[EXT]** upgrade path: an open-front multideck reach-in along the west end of aisle 4, x −6.5, z −8 to +2, mirroring the freezer's instanced-part pattern (one InstancedMesh per repeated shelf/frame part) with a chilled blue rim band `0x2a6fc0` and `emissiveIntensity 1.4` LED coves. If built, retire the dairy sections on island 4 face −1 to `pantry` so facings aren't double-counted. **Signage:** covered by aisle blade #11 ("Dairy · Eggs"). **Density:** counted under 14.8 island totals.

---

### 14.6 Frozen (hero perimeter, left wall)

**Fixtures.** A 10-door reach-in run along the left wall, every repeated part authored as **one InstancedMesh across all 10 doors** (6 parts total):

| Part | Per-door instances | Geometry | Material |
|---|---|---|---|
| Inner cabinet | 1 | box 0.72 × 2.05 × 1.15 | `PAINTED(0x1c2126,0.85)` |
| Wire shelves | 3 | box 0.52 × 0.025 × 0.90 @ y {0.5,0.95,1.4} | `METAL(0xb9c0c7,0.4)` |
| LED under-shelf strip | 3 | box 0.02² × 0.88, emissive `0xdcecff`@1.6 | `ledMat` |
| Door frame | 1 | box 0.05 × 2.05 × 1.02 | `frame 0x3a3f45` |
| Glass pane | 1 | plane 0.88 × 1.87 | opacity 0.16, rough 0.04, `envMapIntensity 2.2` |
| Handle | 1 | cyl 0.016 r × 0.5 | `METAL(0xd7dde3,0.25)` |

Door pitch 1.15, unitX = −22.26, run centred z 0 (door centres ±5.175). **Header band** `PAINTED(0x173a63)` box 0.72 × 0.5 × 11.5 at y 2.55. **Product fill:** `pizza`, `icecream` — 3 shelves × 3 items × 10 doors = **90 frozen facings, all `grabbable:false`** (behind glass; you cannot grab through the door — a deliberate difficulty/authenticity beat). **Floor:** base tile; wet-floor cone (14.3) sits at the aisle mouth (−20.8, 2.5). **Ceiling:** shared grid. **Lighting:** internal emissive LEDs + glass `envMapIntensity 2.2` catch the IBL for the cold sheen; no external spot. **Signage:** #1 FROZEN banner + blue header band. **Collider:** (−23..−22.13, −5.85..5.85). **Density:** 11.7 m², 10 doors + 90 facings; **D 1.5** but non-grabbable — reads as premium wall, not stock. Pass.

---

### 14.7 Pantry & Snacks (ambient aisle — the four grocery islands)

The spine of the grocery half: **four island gondolas** at x {−18,−14,−10,−6}, z-centre −3, length 16 (span z −11..+5). Each gondola: pegboard spine 0.06 wide, H 1.85, half-depth 0.42; two end caps 0.84 × 1.85 × 0.05; dark kickboard; white header at y 1.93; **4 shelves × 2 faces**, all slabs+rails merged to 2 meshes (was 16 draws). Section assignment per island/face:

| Island (x) | Face +1 shelves (bottom→top) | Face −1 shelves |
|---|---|---|
| 1 (−18) | pantry, pantry, snacks, pantry | snacks, pantry, pantry, snacks |
| 2 (−14) | snacks, snacks, pantry, snacks | pantry, snacks, snacks, pantry |
| 3 (−10) | dairy, dairy, dairy, dairy | pantry, pantry, snacks, pantry |
| 4 (−6) | household, household, household, household | dairy, dairy, dairy, dairy |

**Product fill.** `stockShelf` walks z from −7.6 to +7.6 at step 0.2, in runs of 3–4 identical facings, 5 % gap chance, ±0.015 z jitter, ±0.09 rad yaw; a price tag (`priceTagTexture`) drops at each run start. ≈ 576 facings/island × 4 = **~2,300 grabbable facings.** **Dressing checklist:** 8 endcaps (14.17-adjacent — cut-case cardboard trays, sections `snacks/pantry/household/dairy`, 3 layers × 3 items with a partly-shopped top, SALE! blade) at z 5.42 / −11.42 off each island end; **54 rail deal tags** (`2 FOR $5.00`, `SAVE $1.00`, `NEW! try me`, 18 each) sprinkled on random island rails; pallet stacks of shrink-wrapped water/soda cases at (−1.5,−6) and (2.7,9.9). **Floor:** waxed tile + additive troffer streaks. **Signage:** five aisle blades (14.8). **Colliders:** per island AABB x ± 0.52, z ± 8.1 (all four **tippable**, axis z, labels 1–4); endcap AABBs x ± 0.45, z ± 0.3. **Density:** island block ~208 m², ~150 clusters + endcaps → **D 1.1.** Pass.

**14.8 Aisle blade schedule** (all at y 3.0, z −3, w 1.7):

| Aisle | x | Line 1 | Line 2 |
|---|---|---|---|
| 1 | −20 | Frozen · Breakfast | Cereal |
| 2 | −16 | Snacks · Candy | Soda · Water |
| 3 | −12 | Pasta · Sauce | Canned Goods |
| 4 | −8 | Dairy · Eggs | Household |
| 5 | −4 | Household | Paper Goods |

---

### 14.9 Household (ambient aisle)

Household lives on **island 4 face +1 (all four shelves `household`)** plus the top-of-aisle 5 blade and the **household endcap** (one of the 8 endcap spots draws `sections[2] = 'household'`). SKUs: `tp` (bath tissue 4pk, `boxwide`), `detergent` (`boxtall`), `tissues` (`boxwide`), `soapbar` (`box`) — bulky silhouettes that give the aisle a different rhythm from snack bags. **Dressing checklist:** the household endcap tray stack, a blue-cased water pallet at (−1.5,−6). **Floor/ceiling/lighting:** shared aisle systems. **Signage:** blade #12. **Colliders:** inherited from island 4 (tippable). **Density:** counted in 14.7. Pass.

---

### 14.10 Electronics (merch pad, back-right)

**Fixtures.**

| Fixture | Count | Dimensions | Position |
|---|---|---|---|
| TV wall back panel | 1 | 17 × 3.0 × 0.16, `0x14171c` | (12, 1.7, −14.65) |
| Wall TVs (bezel 1.24×0.72, screen 1.16×0.64) | 8 | 3 cycled "demo-reel" screen textures, emissive @0.9 | x 4.9 + i·2.05, y 1.95 |
| Demo platform | 1 | 16.5 × 0.32 × 1.0 | (12, 0.16, −13.9) |
| Cross-grain gondola A | 1 | length 12, rotY π/2 | (10, −7.5) |
| Cross-grain gondola B | 1 | length 12, rotY π/2 | (10, −3.5) |

**Product fill.** 14 boxed sets on the platform (`tv55`, `soundbar`, `headphones`, `console`, `router`) at x 4.6 + k·1.15; gondola A carries `electronics`/`home` sections, gondola B `home`/`toys`. Three procedural screen looks cycle across the 8 TVs: teal gradient + white orb; magenta→amber "equalizer bars"; black "4K ULTRA / VIXEL VISION" card. **Floor:** cool-dark carpet decal `0x3c4048` (18 × 10.4). **Ceiling:** shared grid; SpotLights (10,−7) & (8.5,4) rake the pad. **Signage:** #4 ELECTRONICS banner. **Colliders:** back-wall block (3.4..20.6, −15..−13.9); gondola A/B AABBs x ± 6.1, z ± 0.52 (both **tippable**, axis x, labels 6–7). **Density:** 187 m², 8 TVs + 14 boxes + 2 gondolas (~50 clusters) → **D 0.7.** Meets merch-pad target; the glowing TV wall carries the perceived density.

---

### 14.11 Apparel (merch pad, right-centre)

**Fixtures.** Six round racks (pole 0.035 r × 1.5, torus rail 0.55 r at y 1.42, 0.30 r foot) at (5.5/8.5/11.5, 2.5) and (5.5/8.5/11.5, 5.8); two fold tables 1.5 × 0.78 × 1.0 (`0xe8e4da`) at (14.6, 2.5) and (14.6, 5.8). **Product fill:** 11 tee cutouts per rack = **66 shirts**, authored as **one InstancedMesh per colour (8 colours)** — `#c9241a #1f6fc2 #2e8b57 #e8e4da #22262b #e0a01f #7a3fb5 #d8688a` — each shirt a `PlaneGeometry(0.42,0.52)` with `alphaTest 0.4`, `DoubleSide`, hung on the 0.55 r ring with ±0.2 rad yaw jitter. Fold tables carry 24 stacks each (4×3×2 grid, box 0.3 × 0.07 × 0.24, per-instance colour, ±0.15 rad yaw). **Floor:** warm-grey carpet decal `0x4a4640` (13.6 × 6.8). **Ceiling:** shared grid; SpotLight (8.5,4). **Signage:** #5 APPAREL banner. **Colliders:** 6 rack AABBs (x/z ± 0.75) + 2 table AABBs (x ± 0.85, z ± 0.6). **Density:** 92.5 m², 8 fixtures + 66 shirts + 48 stacks → **D 1.3** (shirts as clusters). Comfortably over the 0.7 pad target.

---

### 14.12 Toys (merch pad, right edge)

**Fixtures.** A tall island gondola (length 10) at (19.5, −2), sections `toys` (face +1, all four shelves) / `pharmacy,home` (face −1); plus the **classic wire ball bin** at (17.2, 6.0): four grid-texture panels (1.2 × 0.85, `alphaTest 0.3`, metal look) forming a 1.2 m box, holding **26 instanced play-balls** (sphere 0.105 r, per-instance colour from `#c9241a #1f6fc2 #2e8b57 #e0a01f #7a3fb5 #e8e4da`, random positions y ≈ 0.62 ± 0.11). **Product fill:** island toys clusters (~350 facings — `toytruck`, `blocks`, `ball`, `plush`). **Floor:** shared tile (toys sit at the carpet edge). **Ceiling:** shared grid. **Signage:** #6 TOYS banner (rotY π/2). **Colliders:** island AABB x ± 0.52, z ± 5.1 (**tippable**, axis z, label 8) + ball-bin AABB (16.5..17.9, 5.3..6.7). **Density:** ~56 m², island + bin + 26 balls → **D 0.9.** Pass.

---

### 14.13 Pharmacy (service niche, front-right corner)

**Fixtures.** Counter 3.4 × 1.05 × 0.90 (`0xf2f4f6`) at (18.5, 0.525, 10.4); counter top 3.5 × 0.05 × 1.0 (`0xd8dde2`) at y 1.07; emissive green cross (`0x35c46a`@0.45) plane 0.7 × 0.7 at (18.5, 2.7, 12.3, rotY π). **Product fill:** `meds`, `vitamins`, `bandages` ride the toys-island face −1 `pharmacy` shelves behind the counter (~30 facings). **Dressing checklist:** a `prop_plant` at (20.9, 13.0). **Floor:** shared tile. **Ceiling:** shared grid; SpotLight (18.5,10) keys the counter. **Signage:** #7 PHARMACY banner + green cross. **Collider:** (16.8..20.2, 9.95..10.85). **Density:** 8.5 m², counter + cross + plant + 30 facings → **D 1.0.** Pass. **[EXT]** add a consultation-window pane + a queue stanchion to hit hero density if pharmacy becomes a scored objective.

---

### 14.14 Checkout (hero perimeter, front-centre)

**Fixtures.** Six lanes at x {−10.5, −8.6, −6.7, −4.8, −2.9, −1.0}, z 10.6, each repeated part merged across all 6 (30 draws → 5):

| Part | Dimensions | Local offset |
|---|---|---|
| Counter | 0.72 × 0.92 × 2.6 @ y 0.46 | (x, z) |
| Belt (black `0x14171a`) | 0.5 × 0.04 × 1.7 @ y 0.94 | (x, z−0.2) |
| Bagging shelf | 0.72 × 0.06 × 0.7 @ y 0.95 | (x, z+1.0) |
| Card reader (tilt −0.25) | 0.12 × 0.18 × 0.10 @ y 1.06 | (x+0.45, z+0.5) |
| Number pole | 0.025 r × 1.5 @ y 1.65 | (x, z+1.15) |
| Lane numeral lamp | 0.26 × 0.26 × 0.06 @ y 2.45 | (x, z+1.15) |

**Two staffed lanes** (x −10.5, −8.6) get a photoscanned `prop_register` at y 0.92, z 10.05, rotY −π/2. **Checkout extras:** per lane two white divider bars (0.44 × 0.035 × 0.05, jittered yaw); a candy impulse rack (0.08 × 0.5 × 1.2) with **12 grabbable candy facings** (3 rows × 4, from snacks `bag`/`box` SKUs); a bag stand + translucent bag stack. Lane 6 (x −1) is **closed**: red ✕ lamp at y 2.45, LANE CLOSED blade at y 1.0. Magazine rack (0.08 × 0.9 × 0.8, 12 procedural covers) at (−12.05, 0.95, 10.2). **Checkout ring** (the loop's goal): `RingGeometry(0.5,0.68)`, emissive `0x35c46a`, pulsing scale 1 ± 0.08·sin(t·4), at the checkout point **(−7.65, 0.02, 11.1)**. **Floor:** shared tile. **Ceiling:** shared grid; SpotLights (−16,−6)…(−8.6,10.6) light the front. **Signage:** #3 CHECKOUT banner + 6 lane numerals + LANE CLOSED. **Colliders:** 6 lane AABBs x ± 0.4, z ± 1.35. **Density:** ~35 m², 6 lanes + 72 candy + racks/mags → **D 1.5.** Pass.

---

### 14.15 Entrance & front strip (hero perimeter)

**Fixtures.** Storefront glass wall (front, +z): per side a knee wall 0.85 tall (`0x585f66`), a header band (wall material), a 1.9 m glass ribbon (opacity 0.06), and `max(4, round(segW/2.1))` mullions (0.07 × 1.9 × 0.12, `METAL(0x2e3338)`). Two **auto-sliding glass doors** (gap 3.4): each a 1.62 × 2.3 glass panel + top/bottom frames, opening when the camera comes within 4.2 m (smoothstep lerp, speed 1.6). **Window posters:** WEEKLY SALE (red) right, FRESH DAILY (green) left, at y 1.75. **Front-strip props:** welcome mat (14.1.1); two gumball machines at x {−4.5,−5.05}, z 14.55 (foot 0.62, globe 0.17 r with 40 painted gumballs, cap); a trash bin (0.26 r × 0.72 + lid) at (3.1, 14.5); three `prop_plant` at (−5.9,13.6),(5.9,13.6),(20.9,13.0); the **cart corral** (two 2.6 m rails at x −2.4, z 13.9 ± 0.55) holding carts c1(−2.9,13.9), c2(−1.9,13.9); five nested red hand baskets (0.42 × 0.22 × 0.30) at ≈ (1.5, 14.2). A loose cart c3 sits mid-aisle at (−1.2, −3.2). **Player spawn:** (0.6, 1.65, 13.2). **Signage:** #16 EXIT, #18 exterior SUPERCENTER sign, #21/#22 posters. **Colliders:** corral rails (thin, x −3.7..−1.1, z 13.28..13.42 and 14.38..14.52), gumballs (−5.3..−4.2, 14.25..14.85), bin (2.8..3.4, 14.2..14.8), basket stack (1.2..1.8, 13.9..14.5). **Density:** ~30 m², mat + 2 gumballs + bin + 3 plants + corral + baskets ≈ **D 1.5.** Pass.

---

### 14.16 Backroom-door zone (service niche, back-left corner)

**Fixtures.** A `EMPLOYEES ONLY` double-door canvas plane (1.9 × 2.3) at (−22.2, 1.15, −14.91) with painted portholes and kick plates; a `RESTROOMS →` sign (0.85 × 0.24) at (−22.2, 2.6, −14.91). **Dressing checklist:** the two cardboard `prop_box` restocks at (−20.6,−14.1),(−19.9,−14.15) read as fresh deliveries staged by the door; a red case pallet at (21.3,−14.0) mirrors the concept on the merch side. **Floor:** base tile (scuffed — see wear pass 14.19; this is the highest-traffic staff seam). **Wall:** beige wall + accent band; the door canvas. **Lighting:** troffer row z −12.6 only; deliberately dimmer (back-of-house read). **Signage:** #19/#20. **Colliders:** none on the flat door (it's a wall plane); restock boxes are decorative (no collider) so the corner stays walkable. **Density:** ~4 m², door + 2 signs + boxes → **D 1.0.** Pass. **[BUILD]** optional: a recessed 0.15 m door reveal + rubber bumper strips to sell depth.

---

### 14.17 Wine nook (service niche, back-left)

**Fixtures.** Photoscanned `prop_wineshelf` GLB at (−21.9, 0, −11.2, rotY π/2); a display plinth (0.9 × 0.5 × 0.6, `0x22262b`) at (−21.7, 0.25, −9.2) topped by the `prop_wine` bottle collection (0.36 h). All optional — no kit, no nook (falls back to bare corner). **Dressing checklist:** the shelf's own bottle rows carry it; add one `prop_crate` stack nearby (shared with produce restock at −21.6, 8.2). **Floor:** base tile; **[EXT]** a small wood-plank decal `0x6b4a2a` (2 × 2.5, opacity 0.3) would warm the niche. **Lighting:** no dedicated spot — the HDRI + accent band read is enough; **[EXT]** one low warm SpotLight target (−21.7,−9.5) for a boutique pool. **Signage:** none shipped; **[BUILD]** a small `WINE & SPIRITS` blade (`bannerTex '#5b2a4a'`, w1.6) at (−21.7, 2.6, −9.2, rotY π/2). **Colliders:** shelf (−22.6..−21.2, −12.1..−10.3), plinth (−22.2..−21.2, −9.55..−8.85). **Density:** ~5 m², shelf + plinth + bottles → **D 0.9.** Meets service target.

---

### 14.18 Density audit summary

| Dept | Zone area (m²) | Fixtures | Facings/clusters | Measured D | Target | Status |
|---|---|---|---|---|---|---|
| Produce | 34 | 6 tables + 5 props | ~110 loose | 1.6 | 1.4 | ✔ |
| Bakery | 11.5 | 1 wall shelf + boxes | ~72 | 1.6 | 1.4 | ✔ |
| Deli **[BUILD]** | 15 | 8 | 12 platters | 1.3→1.4 | 1.4 | +2 boxes/decal |
| Dairy | (on islands) | gondola faces | ~144 | — | 1.0 | ✔ (in 14.7) |
| Frozen | 11.7 | 10 doors | 90 | 1.5 | 1.4 | ✔ |
| Pantry/Snacks | 208 | 4 islands + 8 endcaps | ~2,300 | 1.1 | 1.0 | ✔ |
| Household | (island 4) | 1 face + endcap | in islands | — | 1.0 | ✔ |
| Electronics | 187 | TV wall + 2 gondolas | ~64 | 0.7 | 0.7 | ✔ |
| Apparel | 92.5 | 6 racks + 2 tables | 66 + 48 | 1.3 | 0.7 | ✔ |
| Toys | 56 | island + ball bin | ~350 + 26 | 0.9 | 0.7 | ✔ |
| Pharmacy | 8.5 | counter + cross | ~30 | 1.0 | 0.9 | ✔ |
| Checkout | 35 | 6 lanes + racks | 72 candy | 1.5 | 1.4 | ✔ |
| Entrance | 30 | corral/gumballs/mat | — | 1.5 | 1.4 | ✔ |
| Backroom | 4 | door + signs | — | 1.0 | 0.9 | ✔ |
| Wine nook | 5 | shelf + plinth | bottles | 0.9 | 0.9 | ✔ |

Total ≈ **4,200 grabbable/display facings** across ~70 instanced batches, ≈ 988 draws / 1.38 M tris in the worst view (Ch. 21 budget). Every zone meets or is one dress-pass from its target.

---

### 14.19 Seasonal overlay system

A single `SEASON` flag (`'default' | 'halloween' | 'holiday' | 'summer'`), read at build time, drives a **purely additive** overlay: it never edits geometry, only re-tints existing materials, re-assigns the 8 endcap sections, and appends a small prop set at fixed anchors. No backend — the flag lives in the config object (Ch. 20) or a `?season=` query param; deterministic via the shared LCG (seed 1337), so a season is reproducible frame-for-frame. Exactly what swaps:

**Endcap re-assignment** (the 8 spots at z 5.42 / −11.42) and **tray tint** (`cardboardMat` base):

| Season | Endcap sections (4 cycled) | Tray tint | Blade text |
|---|---|---|---|
| default | snacks, pantry, household, dairy | `0xb08d5a` | SALE! / this week |
| Halloween | snacks(candy), snacks, pantry, household | `0xE87511` | SPOOKY DEALS / boo! |
| Holiday | pantry, snacks, household, bakery | `0xB3202B` | GIFT PICKS / merry |
| Summer | snacks, snacks(drinks), household, dairy | `0x1FA8C9` | COOL OFF / summer |

**Accent-palette swap** (the signage/band hex reused everywhere):

| Token | default | Halloween | Holiday | Summer |
|---|---|---|---|---|
| Brand band `0x1d5c38` | pine green | `0x5B2A86` purple | `0x0F5132` deep pine | `0x1FA8C9` aqua |
| Sale red `0xc9241a` | red | `0xE87511` orange | `0xB3202B` cranberry | `0xF25C54` coral |
| Sale-tag accent `0xffd23b` | gold | `0x6FBF3B` toxic green | `0xE0A81F` gold | `0xF2C81B` sun |
| Blue trim `0x173a63` | navy | `0x141414` black | `0xC4CAD0` silver | `0x7FC6E8` sky |

**Prop set** (appended at existing anchors, reusing shipped geometry helpers):

| Season | Props (count @ anchor) |
|---|---|
| Halloween | 8 pumpkins (sphere 0.14, `0xE87511`) on the 8 endcap tops (y 0.56); 6 black bats (plane cutouts) on the brand band; 2 cobweb decals (alpha plane) in the front corners; recolor gumballs `#6FBF3B`/`#E87511` |
| Holiday | pine garland (torus segments) along all 4 accent bands; 4 wrapped-gift boxes (recolored `stackG`) on each fold table; a 2.4 m tree (cone stack `0x0F5132`) at the entrance (0, 13.0); string-light emissive dots on mullions |
| Summer | beach-ball recolor of the 26 toy-bin balls to `#F25C54/#1FA8C9/#F2C81B`; 2 patio-umbrella cones at produce; inflatable-pool prop (torus 0.6) on the electronics platform end; recolor window posters to "SUMMER BLOWOUT" |

**PA-line system.** No VO/music (Ch. 18 is procedural WebAudio only), so PA is delivered as **HUD toast text** (reusing the `#toast` element, Ch. 7) preceded by a procedural two-tone "ding-dong" chime (a 660 Hz→440 Hz filtered-sine pair through the existing SFX bus). Lines fire on a 45–75 s randomized timer (LCG-seeded). Exactly 5 lines per season:

| default | Halloween | Holiday | Summer |
|---|---|---|---|
| "Attention shoppers: fresh bread, aisle bakery." | "Boo-tiful deals haunting endcap 3." | "Deck the aisles — gift picks up front." | "Beat the heat: cold drinks, aisle 2." |
| "Cleanup on aisle 4 — customer assistance." | "Costume clearance, ends tonight." | "Free gift wrap at customer service." | "Summer blowout: patio, merch side." |
| "Lane 2 now open." | "Trick or treat: buy one, boo one free." | "Warm cider samples, deli counter." | "Ice cream, freezer wall — melting fast!" |
| "Manager to the pharmacy, please." | "Spooky savings in every cauldron." | "Last-minute gifts? Toys, right side." | "Sunscreen restocked, pharmacy." |
| "Thank you for shopping Grocery Dash." | "Happy Halloween from Grocery Dash." | "Happy holidays from all of us." | "Stay cool, shop fast — Grocery Dash." |

Seasonal overlays must remain **stripping-safe**: with `SEASON='default'` the build is byte-identical to the shipped store, so seasons are opt-in decoration, never a fork.

---

### 14.20 Wear pass (scuffs, decals, grime)

The store currently reads slightly *too clean*. The wear pass is a final `wearPass(scene, rng)` call appended **after** `buildTags` (so it consumes from the shared LCG stream last and never perturbs stock placement), authoring only transparent decal planes at y 0.004–0.014, `depthWrite:false`, `AdditiveBlending` for light smears or straight alpha for dark grime — the exact technique already used for troffer streaks, oil stains, and the produce wood patch. Placement rules:

| Decal type | Texture | Size (m) | Opacity / blend | Placement rule | Count |
|---|---|---|---|---|---|
| Heel scuffs (black) | radial streak `0x181818` | 0.35 × 0.12 | 0.30 alpha | random along each checkout lane mouth (z 9.2–9.8) and each aisle entry (z ±7) | 24 |
| Cart-wheel arcs | thin curved streak `0x2a2a2a` | 0.9 × 0.05 | 0.22 alpha | arcs at corral exit (−2.4,13.5) and each aisle turn | 10 |
| Corner grime | soft dark blob `0x101012` | 0.6 × 0.6 | 0.25 alpha | inset 0.3 m from every wall corner + backroom seam | 8 |
| Shelf-rub marks | horizontal smear `0x3a3a3a` | 0.5 × 0.03 | 0.2 alpha (on kickboards, y 0.06) | random gondola kickboards | 16 |
| Freezer condensation drip | pale streak `0xcfe0f0` | 0.04 × 0.4 | 0.18 additive | random glass panes | 6 |
| Ceiling water stain | brown ring `0x8a6a45` | 0.7 × 0.7 (y 4.19) | 0.15 alpha | 2 random non-vent tiles | 2 |
| Entrance traffic wear | large soft `0x141414` | 3.5 × 2.0 | 0.12 alpha | centred on welcome mat + door threshold | 2 |

**Rules of thumb baked into `wearPass`:** (1) wear concentrates where the player *actually walks* — checkout mouths, the center action alley (x 0, Ch. 17 NPC graph), the entrance threshold — following the corridor graph, not uniform scatter; (2) never place a decal inside a fixture AABB (test against `world.colliders` first, reject-and-retry up to 6 times); (3) all wear is one InstancedMesh per type where geometry is shared (heel scuffs, rub marks) to stay inside the ~70-batch budget; (4) opacity ≤ 0.30 always — wear should be felt, not read as a stain the player wants to clean; (5) the ceiling water stain and freezer drips are the only "high" decals, everything else hugs the floor. Because the pass is seeded and appended last, `seed = 1337` yields the same wear map every load, and removing the single `wearPass()` line returns the store to its factory-clean shipped state.

---

**Cross-references:** exterior lot, weather, and day/night are Ch. 15; the full 150-SKU catalog these fixtures will eventually hold is Ch. 16; NPC staff posts and the walk graph that the wear pass follows are Ch. 17; the procedural PA chime is Ch. 18; draw-call and tri budgets every addition here must respect are Ch. 21; the tippable-gondola collider mutation is specified in Ch. 22.



# Chapter 15 — Exterior, Weather & Time-of-Day

The exterior is a **diorama, not a playfield**. The player collider is clamped to `bounds.maxZ = STORE.d/2 - 0.5 = 14.5` (see Ch. 22), and the storefront glass sits at `z = +15`, so the parking lot is something you *see through the windows and the sliding doors*, never something you walk on. Every rule in this chapter respects that: the lot is built for silhouette, parallax and mood, and it renders with `fog: false` on every material so it reads crisply through the interior fog band. This chapter freezes the shipped lot into a spec, then layers three additive, browser-only, Intel-floor-safe systems on top of it — **cart-wrangler traffic**, **arriving/departing car choreography**, and a **weather + time-of-day rig** — none of which change the core loop of Ch. 2 or the scoring of Ch. 4.

All coordinates are world-space metres. The frame: **+X** runs across the 46 m width (`-23 … +23`, grocery/west negative, merch/east positive); **+Z** runs the 30 m depth toward the player and out into the lot (`-15` back wall … `+15` storefront … `+60` lot centre); **+Y** is up. The shorthand `zFront = STORE.d/2 = 15` is used throughout the source and here.

---

### 15.1 The lot envelope — shipped ground truth

`exterior(scene, loader)` builds the whole lot in one pass, all `fog:false`, no real lights (emissive + additive decals only). The envelope, front to back:

| Element | Geometry | Material | World position | Notes |
|---|---|---|---|---|
| Sky dome | `SphereGeometry(85, 24, 12)`, BackSide | `MeshBasicMaterial` + `skyTex` gradient | centre `(0, 0, 15)` | Not a scene skybox — a local dome behind the storefront only |
| Asphalt lot | `PlaneGeometry(140, 90)` | `loadPBR('asphalt', [26,17])`, `envMapIntensity 0.35` | `(0, -0.02, 60)` | Tiled 26×17; the reflective surface weather targets |
| Sidewalk apron | `BoxGeometry(46, 0.12, 3.2)` | `#8d939a`, rough 0.9 | `(0, 0.04, 16.7)` | Spans `z 15.1 … 18.3` |
| Curb face | `BoxGeometry(46, 0.14, 0.12)` | `#a8aeb4`, rough 0.8 | `(0, 0.05, 18.36)` | Lighter lip catching lamp spill |
| Crosswalk | 5× `PlaneGeometry(0.5, 3.4)` instanced | `#d8dce0`, opacity 0.42 | `x = -1.6 + i·0.8`, `z 20.2` | Doors→lot ladder |
| Parking stripes | 18× `PlaneGeometry(0.14, 4.6)` instanced | `#d8dce0`, opacity 0.5 | `x = -22 + i·2.6`, `z 22.8` | 18 stripes ⇒ 17 stalls |
| Wheel stops | 17× `BoxGeometry(1.55, 0.14, 0.22)` instanced | `#b8b46e`, rough 0.85 | `x = -22 + i·2.6 + 1.3`, `z 20.9` | Concrete curb-stops, one per stall |
| Oil stains | 3× radial-gradient quads | additive `rgba(8,8,10)` | `(-9.2, 23.6)`,`(3.0, 24.4)`,`(-1.4, 27.5)` | `depthWrite:false`, rotated per index |
| Red bollards | 4× `Cylinder(0.09,0.1,0.85)` + dome cap | `#b3261a`, rough 0.45 | `x ∈ {-4.6,-2.5,2.5,4.6}`, `z 18.7` | Storefront guard rail |
| Lamp posts | 3× pole+head+pool (see 15.4) | see 15.4 | `x ∈ {-17,-3,12}` | Only "light" sources outside — emissive |
| Distant buildings | 3× `BoxGeometry(bw, bh, 10)` | `MeshBasicMaterial` + `buildingTex` | see 15.6 | Silhouette city |
| Cart corral | group of posts/roof/2 carts | see 15.4 | `(20.4, 0, 21.4)` | East end, red roof |

`skyTex` is a `64×512` vertical gradient, three stops: `#04060c` (top) → `#0a1222` (0.55) → `#1a2438` (horizon). This is the **shipped night sky**; §15.13 remaps these three stops per time-of-day.

---

### 15.2 Stall map (complete)

17 stalls, 2.6 m pitch, defined by the 18 stripes and 17 wheel-stops. Stall *i* centre `= -22 + i·2.6 + 1.3`. Cars park nose-in against the wheel-stop at `z 20.9`, body centred near `z 22.9`. The full map, west→east:

| Stall | Centre X | Occupied? | Parked vehicle (see 15.3) | Reason left empty |
|---|---|---|---|---|
| 0 | -20.7 | ● | Car #0 SUV (silver) | — |
| 1 | -18.1 | ○ | — | drive-through gap |
| 2 | -15.5 | ● | Car #1 sedan (maroon) | — |
| 3 | -12.9 | ● | Car #2 SUV (crimson) `x -12.7` | — |
| 4 | -10.3 | ○ | — | keeps a 2-stall breather |
| 5 | -7.7 | ● | Car #3 sedan (navy) `x -7.5` | — |
| 6 | -5.1 | ○ | — | crosswalk sightline |
| 7 | -2.5 | ● | Car #4 hatch (pale) `x -2.3` | — |
| 8 | 0.1 | ○ | — | dead-centre gap (arrival target, §15.5) |
| 9 | 2.7 | ○ | — | oil-stain stall |
| 10 | 5.3 | ● | Car #5 sedan (charcoal) `x 5.5` | — |
| 11 | 7.9 | ○ | — | — |
| 12 | 10.5 | ● | Car #6 SUV (olive) `x 10.7` | under lamp `x 12` |
| 13 | 13.1 | ○ | — | — |
| 14 | 15.7 | ● | Car #7 hatch (teal) `x 15.9` | — |
| 15 | 18.3 | ○ | — | departure origin (§15.5) |
| 16 | 20.9 | ○ | — | corral apron, kept clear |

**Density rule:** 8 of 17 stalls (**47 %**) filled at the default (night) scenario. This "just-under-half" figure reads as an off-peak evening lot without looking abandoned. §15.15 scales this by scenario: **Story/Onboarding** (Ch. 10) 6/17 (35 %), **Standard night** 8/17 (47 %), **Rush** 13/17 (76 %), **Empty-store stinger** 2/17 (12 %). Fill order always follows the stall table top-to-bottom, so the front-and-centre gap at stall 8 is the *last* to fill — the arrival choreography (§15.5) targets it precisely because it is the most visible.

---

### 15.3 Car fleet & Kenney kit rotation (complete)

Two render paths, chosen at load by `hasModel('car_sedan')`:

**Real path (default — kit present).** Eight Kenney Car Kit GLBs (CC0), cycled by `kitCars[i % 8]`:

| Kit slot | `name` | Source GLB | Body class | Length scale |
|---|---|---|---|---|
| 0 | `car_sedan` | `sedan.glb` | sedan | `4.25/longest` |
| 1 | `car_suv` | `suv.glb` | SUV | `4.25/longest` |
| 2 | `car_hatch` | `hatchback-sports.glb` | hatch | `4.25/longest` |
| 3 | `car_van` | `van.glb` | van | `4.7/longest` |
| 4 | `car_sedansport` | `sedan-sports.glb` | sedan | `4.25/longest` |
| 5 | `car_suvlux` | `suv-luxury.glb` | SUV | `4.25/longest` |
| 6 | `car_taxi` | `taxi.glb` | sedan (yellow) | `4.25/longest` |
| 7 | `car_delivery` | `delivery.glb` | box van | `4.7/longest` |

Length axis is auto-detected from the bbox (`alignFix = size.x > size.z ? π/2 : 0`) so no model needs hand-orienting; van/delivery get the larger `4.7` target so they read as bigger vehicles. Each mesh is cloned with `castShadow:true`, and every material is cloned to force `fog:false`.

**Fallback path (no kit).** Procedural extruded cars from three side-profile `Shape`s (`sedan`/`suv`/`hatch`, 9–10 point profiles), extruded across width `1.62 m` with a `0.1` bevel, plus a `0.94`-scaled dark-glass copy, emissive headlights (`#bfd4e6` @ 0.25), a red taillight bar (`#ff2a1a` @ 0.65), a plate, and two mirrors. All wheels/hubs/arches for the whole fleet merge into **three fleet-wide InstancedMeshes** (~90 draws saved).

**Placement (both paths):** eight fixed anchors, colour used only by the fallback path:

| # | X | Z jitter | Fallback colour | Fallback kind | Final Z | Yaw |
|---|---|---|---|---|---|---|
| 0 | -20.7 | -0.2 | `#d8dadd` | suv | 22.7 | `jitter` |
| 1 | -15.5 | +0.3 | `#6b2233` | sedan | 23.2 | `jitter + π` |
| 2 | -12.7 | -0.2 | `#8a1f1f` | suv | 22.7 | `jitter` |
| 3 | -7.5 | +0.3 | `#1f3f6e` | sedan | 23.2 | `jitter + π` |
| 4 | -2.3 | -0.2 | `#b9bcc0` | hatch | 22.7 | `jitter` |
| 5 | 5.5 | +0.3 | `#24282d` | sedan | 23.2 | `jitter + π` |
| 6 | 10.7 | -0.2 | `#4a5a4a` | suv | 22.7 | `jitter` |
| 7 | 15.9 | +0.3 | `#2e5648` | hatch | 23.2 | `jitter` |

`Z final = 22.9 + (i%2 ? +0.3 : -0.2)`; the `i%2` yaw flip alternates cars facing nose-in vs. tail-in so the lot doesn't look regimented. Jitter is the per-car small rotation baked into the anchor table.

**Fleet rotation by scenario (density from §15.2):** always draw the first *N* rows of the anchor table, where *N* = 6/8/13/2 for Onboarding/Night/Rush/Stinger. Rush overflows the 8 anchors by re-emitting into the empty stalls (1,4,6,8,9,11,13,15) using `kitCars[(8+j) % 8]`, keeping the taxi (slot 6) and delivery (slot 7) reliably present so the lot reads "commercial daytime."

---

### 15.4 Cart corral & the cart-wrangler NPC route  [BUILD]

**Shipped corral** (`(20.4, 0, 21.4)`): four `Cylinder(0.05,0.05,2.2)` posts at `(±1.5, ±1.1)`, a red `BoxGeometry(3.6,0.07,2.8)` roof (`#9c2a20`) tilted `rotZ 0.05` at `y 2.25`, two side rails, and two abandoned `shoppingCart()`s inside. There is a **second cart source** at the entrance: the indoor corral rails at `(-2.4, 0.55, 13.9±0.55)` with three carts, which is the wrangler's *destination*.

**New: the cart wrangler.** One extra NPC built through the same Rocketbox pipeline as Ch. 17's shoppers (reuse `spawnPerson`), flagged `wrangler:true`, `browsing:false`, `speed 1.05`. Because he must cross the curb line (`z 18.36`) he is the **only agent exempt from `world.bounds`** — he runs on the lot, which is legal since he never touches interior colliders. He pushes a **cart train**: 4 `shoppingCart()` clones nested nose-to-tail, offset `0.62 m` along his heading, each lagging the one ahead by a first-order follow (`lerp 0.12/frame`) so the train articulates round corners.

His route is a closed loop of world-space waypoints, dwelling at each:

| Leg | Waypoint (x,z) | Dwell | Action |
|---|---|---|---|
| W0 | corral `(20.4, 21.4)` | 3.0 s | collect train (4 carts fade in beside him) |
| W1 | drive-aisle east `(20.0, 25.6)` | 0 | pull out of corral |
| W2 | drive-aisle mid `(0.0, 25.6)` | 0 | traverse behind the parked row |
| W3 | crosswalk foot `(0.0, 20.2)` | 1.5 s | look both ways bark |
| W4 | curb ramp `(0.0, 18.4)` | 0 | step up onto sidewalk |
| W5 | doors `(0.6, 14.9)` | 2.0 s | doors auto-open (existing `door.t` proximity) |
| W6 | indoor corral `(-2.4, 13.9)` | 4.0 s | hand off carts (train clones despawn, indoor count +) |
| W7 | doors `(0.6, 14.9)` | 0 | exit empty-handed |
| W8 | back to W0 | — | loop, `speed 1.35` (faster empty) |

Total loop ≈ **48 s**. Only **one** wrangler exists and only in Standard/Rush scenarios; Onboarding and Stinger omit him. He obeys the same `n.shove` stagger from `physics.js` if the player body-checks him near the doors (bump lines apply). Headlight/weather note: in rain (§15.9) he gains a translucent umbrella billboard (one double-sided quad, `#2b3038`) and drops to `speed 0.85`.

**Lamp-post detail** (referenced by choreography and weather): each of the 3 posts = `Cylinder(0.07,0.09,5.6)` pole (`#2f3338`, metal 0.8) at `y 2.8`; a `BoxGeometry(0.9,0.14,0.36)` head, emissive `#ffd9a0` @ **2.4**, at `y 5.55`; and a ground light-pool `CircleGeometry(3.4, 24)`, additive `#ffdca0` @ **0.13** opacity, `depthWrite:false`, at `y 0`. These emissive values are the master knobs the time-of-day table drives.

---

### 15.5 Arriving / departing car choreography  [BUILD]

A lightweight traffic layer that spawns **at most one moving vehicle at a time** (hard cap, to protect the Intel floor and to keep the eye on a single event). A moving car is a Kenney clone plus a headlight rig; it follows a **Catmull-Rom spline** sampled each frame.

**The drive aisle.** Through-traffic runs along `z ≈ 25.6`, a clear lane *behind* the parked row (`z 22.9`) and its wheel-stops (`z 20.9`). Cars enter/leave from the lot edges (`x ≈ ±30`, off-screen toward the §15.6 street).

**Arrival spline** (targets empty stall centre `sx`, e.g. stall 8 `= 0.1`). Control points `P0…P4`, world `(x, z)` at `y 0`:

```
P0 = (-30.0, 26.5)   // off-lot, entering from screen-left street
P1 = (-12.0, 25.6)   // settle into the drive aisle
P2 = (sx-3.4, 25.4)  // approach, decelerating
P3 = (sx-0.6, 24.2)  // begin the turn-in arc
P4 = (sx,     22.9)  // seated nose-in, matches the parked row
```

Sample position with the standard centripetal Catmull-Rom on `t ∈ [0,1]` over the segment list; worked half-way point of the P1→P2 segment at local `u = 0.5` with tension `τ = 0`:

```
p(u) = 0.5·[ 2P1 + (P2−P0)u + (2P0−5P1+4P2−P3)u² + (−P0+3P1−3P2+P3)u³ ]
```

**Heading** = `atan2(dz, dx)` of the finite-difference tangent (`p(t+ε) − p(t)`, `ε = 0.01`), plus the model's `alignFix`. **Timing:** arrival = **6.5 s**, eased `easeInOutCubic`; the last 25 % of `t` slows to a stop as the nose meets the wheel-stop. On arrival the car is handed to the static fleet (its stall flips to occupied) and the mover slot frees.

**Departure spline** = a mirrored reverse: back out of the stall (short reverse arc `P4→P3'` with reversed heading + white reverse-lamp flash), then exit screen-**right**:

```
Q0 = (sx,     22.9)
Q1 = (sx+0.6, 24.2)
Q2 = (sx+3.4, 25.4)
Q3 = (12.0,   25.6)
Q4 = (30.0,   26.5)
```

Departure = **6.0 s**. Only vacated stalls become departure origins; stall 15 (`18.3`) is the scripted departure used in the Onboarding beat.

**Headlight & taillight rules** (emissive + additive only — no real lights, per the Intel floor):

| Signal | Mesh | Colour / intensity | On-condition | Off-condition |
|---|---|---|---|---|
| Headlight lenses | 2× `Box(0.34,0.12,0.06)` | `#bfd4e6`, emissive **0.25 → 1.8** | moving AND (time∈{dusk,night} OR weather∈{rain,fog}) | parked > 1.5 s, or noon-clear |
| Head-beam pool | 1× additive triangle quad ahead of nose | `#fff0d0`, opacity **0 → 0.16** | same as lenses; opacity scales with `darkness` (§15.13) | ramps to 0 over 0.4 s |
| Taillights | `Box(1.4,0.09,0.05)` | `#ff2a1a`, emissive **0.65 → 1.4** | braking (last 25 % of arrival) or any departure | steady 0.65 when idling-lit |
| Reverse lamps | 2× small quads | `#f4f6f8`, emissive **0 → 1.6** | first 1.2 s of a departure | after back-out arc |
| Turn blinker | reuse one taillight | `#e0a01f`, 1.5 Hz square blink | during any turn-in / back-out arc | after arc |

The head-beam pool is a single `PlaneGeometry` fan pinned `0.9 m` ahead of the bumper at `y 0.02`, `AdditiveBlending`, `depthWrite:false` — it sweeps the asphalt exactly like the static lamp pools, so it costs one extra draw and reads convincingly through the glass. `darkness ∈ [0,1]` is `1` at night, `0.6` at dusk, `0.15` at dawn, `0` at noon; multiply all "→" targets by `darkness` for a smooth day/night falloff.

**Cadence by scenario:** Night = one arrival OR departure every **35–55 s** (seeded). Rush = every **12–20 s**, biased 2:1 toward arrivals so the lot fills over a run. Onboarding = exactly one scripted arrival into stall 8 during the "look around" beat. Stinger = none.

---

### 15.6 Street context & silhouette-city rules

Beyond the lot: three `MeshBasicMaterial` slabs textured with `buildingTex`, `fog:false`, deliberately flat and dark so they read as *distant skyline* through parallax, never as places you could reach.

| Building | `BoxGeometry` | Centre `(x, y, z)` | Rooftop Y |
|---|---|---|---|
| B0 (broad, left) | `26 × 9 × 10` | `(-30, 4.5, 49)` | 9 |
| B1 (widest, right) | `30 × 7 × 10` | `(16, 3.5, 55)` | 7 |
| B2 (tall, far-right) | `18 × 11 × 10` | `(40, 5.5, 41)` | 11 |

`buildingTex` = `512×256`, base `#0b0e14`; a window at grid cell `(r,c)` (5 rows × 16 cols) lights when `sin(r·37 + c·91) > 0.45` (≈ **48 %** of cells), colour cycling `['#ffd98a', '#bcd6ff', '#ffe9c9']` by `(r+c)%3`, alpha **0.75**. That deterministic sine keeps the skyline stable frame-to-frame (no shimmer) and identical across reloads.

**Silhouette-city extension rules** (for anyone adding buildings): (1) **Max 4 slabs** — beyond that the batch cost and the flatness both show. (2) Keep every slab **beyond `z = 40`** so the ~45 m of empty lot in front sells the distance. (3) Height `bh ∈ [7, 12]`; anything shorter disappears below the horizon, anything taller crowds the sky dome. (4) Never let a slab's screen-space silhouette **cross a lamp post** (`x ∈ {-17,-3,12}`) — the emissive head must sit against dark sky, not a lit window field. (5) The lit-window fraction stays in **45–55 %** (tune the `> 0.45` threshold, not the colours). (6) Fixed depth `10 m` on Z so all three share one draw-friendly profile; only front faces are ever visible. (7) The lit-window alpha is the **`CITY_WINDOWS`** group in §15.13 — buildings dim toward dawn and go nearly dark at noon.

---

### 15.7 Weather system — architecture & budgets  [BUILD]

Weather is a small additive module (`weather.js`) returning `{ setState(name), update(dt) }`, chosen once per run by the seeded LCG (`seed = seed·16807 % 2147483647`, the same generator that stocks shelves) and overridable via `window.__setWeather('rain')` in the existing `window.__*` debug convention. It **never touches the core loop, scoring, colliders, or the interior geometry** — it only adds particle systems, adjusts a handful of named light groups (§15.13), and enables one interior "slush" trigger (§15.12).

Hard constraints it obeys:

- **Player is indoors.** Particles are anchored over the lot apron (`z ∈ [15.5, 29.5]`), *never* inside the store — so weather is something you watch through the glass and the open doors, matching the diorama premise.
- **Lot materials are `fog:false`.** `scene.fog` (`0x11151a, 24, 46`) cannot dim the lot, so the "fog" *weather* state uses its own shell (§15.10), not `scene.fog`.
- **One draw per particle field.** Each of rain/snow is a single `InstancedMesh` recycled in place — no per-frame allocation, matching the debris system's discipline (Ch. 22).
- **Tier-aware.** In the `lite`/`panic` tiers (Ch. 21) particle counts halve and the wet-sheen plane (§15.9) is skipped; the `high` tier gets full counts. Never adds a real light.

| State | Particle field | Instances (high / lite) | Extra draws | Audio bed |
|---|---|---|---|---|
| Clear | none | 0 | 0 | store hum only |
| Rain | falling streaks + glass drizzle scroll | 700 / 350 | +2 | filtered-noise loop |
| Fog | none (shell + dome) | 0 | +1 | muffled hum |
| Snow | falling flakes + accumulation plane | 1000 / 500 | +2 | near-silent + hiss |

Weather can be recombined with any time-of-day preset; §15.15 lists which scenarios use which pairing.

---

### 15.8 Weather state — CLEAR (baseline)

The shipped look. Nothing is added; the sky dome, lamp pools and city windows are exactly the §15.1/§15.13 values for the active time. Clear is the default for Onboarding and Story so first impressions are legible.

| Channel | Value |
|---|---|
| Sky | dome gradient per time-of-day (§15.13), unmodified |
| Lighting delta | none (interior at the time-of-day table) |
| Lot surface | asphalt `envMapIntensity 0.35`, `roughness 1.0` |
| Particle budget | 0 |
| Audio bed | store hum (lowpass 240 Hz @ 0.018 gain) only |
| Gameplay modifier | none |

---

### 15.9 Weather state — RAIN

**Sky.** Dome gradient desaturated toward slate: multiply each dome stop's saturation by 0.55 and darken value by 12 %; add a `+0.04` opacity flat grey (`#3a4048`) overlay band across the dome's upper third to read as overcast. `darkness` (§15.5) is forced to at least `0.5` even at noon, so headlights switch on in rain regardless of hour.

**Lighting deltas** (over the active time preset):

| Group | Delta |
|---|---|
| `HEMI` intensity | ×0.85, sky colour → `#aeb8c2` (cooler) |
| `ENV_IBL` (`environmentIntensity`) | ×0.9 |
| `LAMP_POOLS` opacity | ×1.35 (wet ground scatters more) |
| `EXPOSURE` | −0.04 |
| `CITY_WINDOWS` alpha | ×1.1 (windows read brighter against the murk) |

**Surface response — wet asphalt.** Rather than per-pixel clearcoat (too costly on the iGPU, per the floor material note), rain raises the *existing* asphalt reflectivity and lays a sheen:

- Set lot `material.roughness` **1.0 → 0.55** and `envMapIntensity` **0.35 → 0.9** (lerped over 2.0 s on state entry). This darkens and gloss-lifts the asphalt so the lamp emissives streak in it.
- Add a **wet-sheen plane** (`high` tier only): a `PlaneGeometry(60, 16)` over the apron (`y 0.005`, `z 22`), `MeshStandardMaterial` `roughness 0.15`, `metalness 0.1`, `envMapIntensity 1.4`, `opacity 0.22`, `transparent`, `depthWrite:false`. It catches the HDRI + lamp reflections as a mirror smear.
- Under each lamp post and each lit car, add a **puddle-reflection decal**: reuse the oil-stain quad technique but additive `#ffdca0` @ 0.10, a vertical streak texture, one instanced mesh of 6 (3 lamps + up to 3 lit cars).

**Particles.** One `InstancedMesh` of **700** (`lite`: 350) thin quads `0.012 × 0.42`, `#afc4d8` @ 0.5 opacity, additive off (alpha), anchored in a volume `30(x) × 7(y) × 14(z)` centred `(0, 3.5, 22)`. Per frame: `y -= 9.0·dt`; wind shear `x += 1.1·dt` (streaks lean); recycle to `y = 7` with fresh random `x,z` when `y < 0`. Each quad is billboarded to face the camera on Y only. Streaks never spawn with `z < 15.5`, so no rain falls inside the doors.

**Glass drizzle.** A single storefront-glass overlay plane (inner face, `z 14.9`) with a static drizzle texture scrolled by `texture.offset.y -= 0.35·dt` and `offset.x -= 0.05·dt` — zero canvas re-draw cost, just UV animation. Opacity 0.14, `AdditiveBlending`.

**Audio bed.** Reuse the `sfx.js` noise infrastructure: a 2-s looping noise buffer through a **bandpass at 1.2 kHz, Q 0.7**, gain **0.03**, plus a second lowpassed layer (300 Hz, gain 0.012) for the low rumble. Layered under the existing hum. On thunder beats (Rush only, every 20–40 s) fire `SFX.crash()`-style noise at −6 dB with a 0.2 s pre-delay flash on the dome.

**Gameplay modifier.** Tracked-in slush at the entrance — see §15.12.

---

### 15.10 Weather state — FOG

Because the lot is `fog:false`, this state cannot use `scene.fog`. It builds its own low-cost haze:

**Fog shell.** A second dome, `SphereGeometry(70, 20, 10)`, BackSide, `MeshBasicMaterial` `#b8bec6` @ opacity **0.16**, `depthWrite:false`, `AdditiveBlending` **off** (straight alpha so it *hides* the city, not brightens it), centred `(0, 0, 15)`, just inside the sky dome. It washes the distant buildings to near-invisibility (their `fog:false` no longer matters — the shell sits in front of them).

**Ground haze band.** One `PlaneGeometry(80, 6)` stood vertically at `z 32` (between the parked cars and the street), `#c2c8cf` @ 0.28, `transparent`, `depthWrite:false`, faced toward the storefront — a distance curtain that swallows the lot's far half while the near stalls stay readable.

**Deltas:**

| Group | Delta |
|---|---|
| Sky dome | contrast ÷ 2 (lerp all three stops toward their mean), tint `#20262e` |
| `CITY_WINDOWS` alpha | ×0.25 (barely visible through the shell) |
| `LAMP_POOLS` radius | ×0.7 (`CircleGeometry` rebuilt at 2.4 m) — light doesn't travel in fog |
| `LAMP_HEADS` emissive | ×1.15 with a bloom-catching halo quad (`0.6 m`, additive `#ffe6bf` @ 0.2) |
| `ENV_IBL` | ×1.1 (flat, sourceless fill) |
| `EXPOSURE` | +0.03 (milky lift) |
| Head-beam pools (§15.5) | forced on (`darkness` clamped ≥ 0.6), opacity ×1.3 |

**Particle budget:** 0 — fog is pure shell + haze + halo, so it is the cheapest weather (one extra draw beyond the halos).

**Audio bed.** Muffle: drop the master a touch by inserting a global **lowpass at 3.5 kHz** in front of `master` and lower hum gain 240 Hz → 200 Hz. Foghorn easter-egg (seeded, ~1 %): a slow `tone(80, 1.4, 'sine')` every ~30 s.

**Gameplay modifier.** None inside — fog only degrades the lot backdrop's legibility. The interior stays crisp. (If a scenario ever pushes fog *density* high, the only in-store effect is a subtle reduction of the through-glass silhouette read; NPC behaviour and grabbing are untouched.)

---

### 15.11 Weather state — SNOW

**Sky.** Dome brightened and cooled: lerp stops toward `#1c2636 / #2a394f / #46566e` (night) or their daytime equivalents +8 % value; add a faint `#d8e2ee` @ 0.05 upper glow (snow-sky luminance).

**Deltas:**

| Group | Delta |
|---|---|
| `HEMI` sky colour | `#dfe9f4`, intensity ×1.1 (snow bounces light up) |
| `ENV_IBL` | ×1.15 |
| `LAMP_POOLS` opacity | ×0.9, colour → `#fff4e0` (warmer against blue snow) |
| `EXPOSURE` | +0.05 |
| `CITY_WINDOWS` | ×0.9 |
| Asphalt | `roughness` 1.0 → 0.8 only (damp, not glossy); no sheen plane |

**Particles.** One `InstancedMesh` of **1000** (`lite`: 500) `0.05 × 0.05` billboard quads, `#f4f8ff` @ 0.9, in a `30 × 8 × 14` volume centred `(0, 4, 22)`. Per frame: `y -= 0.8·dt` (slow); horizontal sway `x += sin(age·1.3 + id)·0.4·dt`, `z += cos(age·0.9 + id)·0.3·dt`; recycle at `y = 8`. Billboarded to camera. Same `z ≥ 15.5` guard keeps snow off the interior floor.

**Accumulation.** A white cover that fills in over ~40 s: a `PlaneGeometry` matching the lot apron at `y 0.015`, `#eef2f8` @ opacity ramping **0 → 0.45**, plus per-object dusting — raise the wheel-stops', curb's and parked-car-roofs' apparent lightness by blending a thin white cap quad on top (instanced, one draw). Melts back (opacity → 0 over 8 s) if the state changes to clear/rain.

**Audio bed.** Snow deadens: same 3.5 kHz muffle as fog but gentler, hum gain ×0.7, plus a very faint high-shelf "hiss" (noise through highpass 6 kHz, gain 0.006) for the falling-snow shimmer. No thunder.

**Gameplay modifier.** Slush at the doors (heaviest of the three that trigger it) — §15.12 — plus the cart-wrangler (§15.4) slows to `speed 0.75` and arrivals/departures (§15.5) drop cadence by 40 % (fewer cars brave the snow).

---

### 15.12 Weather gameplay modifiers — the slush zone (answering "ice slip outside?")

**Ruling:** there is **no outdoor walking surface for the player** — the collider is clamped at `z ≤ 14.5`, inside the glass, and shoved carts are bounded by the same `world.bounds` (Ch. 22). So classic "slip on the icy lot" cannot happen and is *not* built. Instead, the wet/snowy weather manifests as **tracked-in slush at the entrance**, the one place weather crosses the threshold, which keeps the modifier on the actual playfield.

**Slush AABB:** `x ∈ [-3, 3]`, `z ∈ [13.0, 14.5]` — the welcome-mat apron just inside the sliding doors. Active only when `weather ∈ {rain, snow}` (snow at 1.4× strength).

**Effect.** The shipped `move()` (Ch. 8) sets position instantly from input and only damps `playerVel` when idle (`×(1 − 6·dt)`). Inside the slush AABB, movement switches to a short-inertia model so the player *skates*:

- Maintain a `slideVel` that eases toward the desired input velocity at `k_accel = 3.5/s` instead of snapping: `slideVel += (desired − slideVel)·min(1, 3.5·dt)`.
- On key release inside the zone, coast: `slideVel ×= (1 − k_coast·dt)`, `k_coast = 1.4` (rain) / `1.0` (snow).
- Apply `slideVel` through the *same* collider checks as normal movement, so you can still be stopped by fixtures — you just can't stop *yourself* on a dime.

**Worked example.** Sprint into the zone at `SPEED_RUN = 4.9 m/s`, then release: coast distance ≈ `v / k_coast = 4.9 / 1.4 ≈ 3.5 m` of decaying skate in rain (`≈ 4.9 m` in snow at `k = 1.0`) — enough to overshoot the mat and nudge a cart or an NPC, feeding the existing bump/damage systems (Ch. 4, Ch. 22) without any new failure state.

**Telegraph.** A wet-floor cone already exists near the freezers; when slush is active, spawn a **second** yellow cone (reuse `floorProps` cone group) at `(0, 0, 13.6)` and a faint blue-sheen decal over the mat (`#9fc4de` @ 0.12, additive). Muted footstep-splash `SFX.tick()` variants fire on each stride in the zone. This is the entirety of weather's gameplay footprint — everything else is atmosphere.

---

### 15.13 Time-of-day rigs — light-by-light value tables

Four presets — **dawn / noon / dusk / night** — applied by `applyTimeOfDay(scene, preset)`, which walks the scene once (like the tier system in `main.js`) and writes the named groups below. **Night is the shipped baseline**; the other three are derived from it. Interior troffers never drop below `1.7` emissive, so the store is always playable regardless of hour.

**Fixture groups (shipped identities):**

| ID | Group | Members (shipped) |
|---|---|---|
| `TROFFERS` | ceiling lay-in lights | 110 instanced `Box(0.34,0.05,2.1)`, emissive `#ffffff` |
| `AISLE_WASH` | RectAreaLights along Z | 4 at `x ∈ {-16,-8,8,16}`, `#fff2e2`, int 3.2 |
| `FRONT_WASH` | front RectAreaLight | 1 at `z 12.2`, `#fff2e2`, int 2.4 |
| `KEY_SPOTS` | shadow-casting spots | 8, `#fff4e6`, int 38, cone `π·0.34` |
| `HEMI` | HemisphereLight | sky `#cfe0f0` / ground `#39352f`, int 0.34 |
| `ENV_IBL` | `scene.environmentIntensity` | warehouse HDRI, 0.55 |
| `EXPOSURE` | `toneMappingExposure` | ACES, 1.0 |
| `SKY_DOME` | 3 gradient stops | `#04060c / #0a1222 / #1a2438` |
| `BG` | `scene.background` | `#0d1013` |
| `INT_FOG` | `scene.fog` | `#11151a`, near 24, far 46 |
| `LAMP_HEADS` | 3 exterior lamp emissives | `#ffd9a0`, 2.4 |
| `LAMP_POOLS` | 3 additive ground pools | `#ffdca0`, opacity 0.13 |
| `CITY_WINDOWS` | building lit-window alpha | 0.75 |

**Master table** (bold = shipped night baseline):

| Group | dawn | noon | dusk | **night** |
|---|---|---|---|---|
| `TROFFERS` emissive | 2.0 | 1.7 | 2.0 | **2.1** |
| `AISLE_WASH` int | 3.2 | 3.4 | 3.2 | **3.2** |
| `FRONT_WASH` int | 2.4 | 2.8 | 2.4 | **2.4** |
| `KEY_SPOTS` int | 34 | 30 | 36 | **38** |
| `HEMI` int | 0.55 | 0.75 | 0.42 | **0.34** |
| `HEMI` sky col | `#bcd0e6` | `#dfe9f2` | `#e6c49a` | **`#cfe0f0`** |
| `HEMI` ground col | `#40382c` | `#4a4034` | `#2c2a30` | **`#39352f`** |
| `ENV_IBL` | 0.70 | 1.00 | 0.60 | **0.55** |
| `EXPOSURE` | 1.05 | 1.15 | 1.00 | **1.00** |
| `SKY_DOME` top | `#243247` | `#5b86b8` | `#241a30` | **`#04060c`** |
| `SKY_DOME` mid | `#7d94ad` | `#9cc2e6` | `#a15a48` | **`#0a1222`** |
| `SKY_DOME` horizon | `#e8c39a` | `#cfe4f4` | `#e8935a` | **`#1a2438`** |
| `BG` | `#1a2230` | `#8fb0cc` | `#3a2c3a` | **`#0d1013`** |
| `INT_FOG` col | `#2a3340` | `#9fb4c6` | `#40303a` | **`#11151a`** |
| `INT_FOG` near / far | 26 / 52 | 30 / 60 | 24 / 48 | **24 / 46** |
| `LAMP_HEADS` emissive | 1.2 | 0.0 | 1.6 | **2.4** |
| `LAMP_POOLS` opacity | 0.06 | 0.00 | 0.09 | **0.13** |
| `CITY_WINDOWS` alpha | 0.35 | 0.08 | 0.50 | **0.75** |
| `darkness` (§15.5) | 0.15 | 0.00 | 0.60 | **1.00** |

Notes: **noon** kills the exterior lamps entirely (`LAMP_HEADS 0`, `LAMP_POOLS 0`) and pushes `INT_FOG` so far out (`30/60`) it effectively disappears, so the lot reads as flat daylight through the glass; the raised `EXPOSURE 1.15` is capped there to keep the bloom threshold (`0.96`, Ch. 21) from blooming ordinary bright surfaces. **dusk** is the "golden hour" beat — warm HEMI (`#e6c49a`), orange dome horizon (`#e8935a`), lamps just warming up (`1.6`). **dawn** mirrors dusk but cooler and dimmer. Freezer LEDs (`1.6`), produce pendants (`2.1`) and TV screens (`0.9`) are **held constant** across all four presets — refrigeration and merchandising don't dim with the sun.

**Application discipline.** `applyTimeOfDay` runs once at build (after `lighting()`), not per frame, and is safe to re-run live via `window.__setTime('dusk')`. It must run **before** the `main.js` tier walk that freezes shadow maps (frame 3), because changing `KEY_SPOTS` intensity requires one `shadow.needsUpdate = true` before the freeze. RectAreaLights it touches are still hidden in the `lite` tier — the table's `AISLE_WASH`/`FRONT_WASH` values only take visible effect once the `high` tier upgrades (Ch. 21).

---

### 15.14 Storefront glass behaviour by time-of-day

Three glass systems modulate so the boundary reads correctly at each hour:

| Glass system (shipped) | Base opacity / envMap | dawn | noon | dusk | night |
|---|---|---|---|---|---|
| Storefront panels (`#a9c9e0`) | 0.06 / 0.45 | 0.05 / 0.5 | 0.04 / 0.6 | 0.06 / 0.45 | 0.08 / 0.40 |
| Entrance doors (`#9fc4de`) | 0.10 / 0.70 | 0.09 / 0.75 | 0.07 / 0.85 | 0.10 / 0.70 | 0.12 / 0.65 |
| Freezer glass (`#bfd8ea`) | 0.16 / 2.2 | 0.16 / 2.2 | 0.16 / 2.2 | 0.16 / 2.2 | 0.16 / 2.2 (held) |

Rule: **daytime → clearer + more reflective** (lower opacity, higher `envMapIntensity`) so the bright lot shows through and the glass catches sky; **night → slightly more opaque + less reflective** so the dark lot doesn't read as a black hole and the interior lights own the panes. Freezer glass is refrigeration hardware and never varies. In **rain/fog**, add `+0.03` opacity to storefront + door glass and drop their `envMapIntensity` by 0.1 (wet, grimed) and drive the §15.9 drizzle scroll on the storefront inner face.

---

### 15.15 Scenario → time / weather assignment matrix

Which rigs each scenario (Ch. 3 shifts, Ch. 2 modes) uses. Time and weather are chosen by the seeded LCG within the allowed set so a given seed always reproduces the same sky.

| Scenario | Time preset(s) | Weather set | Fleet density | Choreography | Wrangler |
|---|---|---|---|---|---|
| Onboarding (Ch. 10) | night (fixed) | clear (fixed) | 6/17 | one scripted arrival → stall 8 | off |
| Story — morning shift | dawn | clear · fog(20%) | 6/17 | departures biased | off |
| Story — day shift | noon | clear · rain(25%) | 10/17 | balanced, 20–35 s | on |
| Story — evening shift | dusk | clear · rain(30%) | 8/17 | balanced, 25–45 s | on |
| **Standard (default)** | **night** | **clear · rain · fog · snow (seeded)** | **8/17** | **35–55 s** | **on** |
| Rush / Time-attack | noon · dusk | clear · rain(20%) | 13/17 | 12–20 s, arrival-biased | on |
| Empty-store stinger | night | fog (fixed) | 2/17 | none | off |
| Endless | cycles dawn→noon→dusk→night every ~4 min | full seeded set | 8→11/17 | scales with hour | on |

Weather probabilities in a set sum with an implicit "clear" remainder (e.g. day shift = 25 % rain, 75 % clear). Endless is the only scenario that *animates* the time preset — it re-runs `applyTimeOfDay` on a 4-minute cycle with a 6 s cross-lerp between presets so the store visibly rolls through a day; all other scenarios pick one preset at build and hold it.

---

### 15.16 Data schema, debug hooks & Definition of Done

**Run-config record** (extends the world seed, Ch. 20):

```
weatherConfig = {
  time:    'dawn' | 'noon' | 'dusk' | 'night',
  weather: 'clear' | 'rain' | 'fog' | 'snow',
  fleetDensity: 0.47,           // fraction of 17 stalls
  choreoPeriod: [35, 55],       // seconds, [min,max]
  wrangler: true,
  seed: 1337,                   // same LCG as stocking
}
```

**Debug hooks** (matching the shipped `window.__*` convention in `main.js`): `window.__setTime(name)`, `window.__setWeather(name)`, `window.__weather` (live state), `window.__spawnCar('arrive'|'depart', stallIndex)`, `window.__wrangler` (route index), and `window.__lot` (the exterior group for framebuffer-grid inspection). The framebuffer-grid verification practice (Ch. 23) is how each time/weather pairing is signed off — a 4×4 grid of the storefront view across all `time × weather` combinations, checked for: interior always readable, no bloom on non-emitters, particles never inside `z < 15.5`, lamp reflections present only when lamps are lit.

**Definition of Done for Chapter 15:**

1. All four time presets apply through `applyTimeOfDay` in one scene walk, re-runnable live, interior troffers never below `1.7`.
2. All four weather states run at **one draw per particle field**, halve counts in `lite`/`panic`, add **no real lights**, and never spill particles inside the glass.
3. The `fog` weather uses its own shell (not `scene.fog`) and correctly hides the `fog:false` city.
4. Arriving/departing cars follow the §15.5 splines with correct head/tail/reverse/blinker emissive rules driven by `darkness`, capped at one mover at a time.
5. The cart-wrangler completes his 9-waypoint loop (~48 s), opens the doors via existing proximity, hands off carts, and staggers correctly on a body-check.
6. The slush zone gives measurable coast (~3.5 m rain / ~4.9 m snow from a sprint) only inside the entrance AABB and only in rain/snow, with cone + sheen telegraph.
7. Every pairing verified on the framebuffer grid and holding ≥ 60 fps under 20 ms at the Intel-iGPU floor (Ch. 21).

Cross-references: interior fixtures and their identities are catalogued in Ch. 14; the tier/perf budget these rigs live inside is Ch. 21; the physics thresholds the slush zone rides on are Ch. 22; NPC pipeline the wrangler reuses is Ch. 17; audio infrastructure the weather beds extend is Ch. 18; scenario definitions are Ch. 2–3; the run-config schema is Ch. 20; verification practice is Ch. 23.



# Chapter 16 — The Catalog — All ~150 SKUs

This chapter is the single source of truth for every product that can appear on a shelf, in a basket, on the floor as debris, or on a shopping list in *Grocery Dash 3D*. It freezes the **52 SKUs shipped** in `src/products.js` (reproduced exactly — id, brand, price, weight all verbatim) and adds **98 fully-specified new SKUs** for a total of **150**, grouped into **12 departments**. Every row is implementable without a follow-up question: package kind maps to a shipped mesh factory (Ch. 21), physics class maps to a numeric ruleset (16.14, Ch. 22), asset source is either procedural, a Poly Haven photoscan slug, or a `[BUILD]` job, and list-eligibility feeds the generator in 16.16 (Ch. 5 dailies). Brands are drawn from the Ch. 13 roster; new brands introduced here extend that roster in the same naming register.

Ground-truth anchors this chapter never contradicts: the stock pipeline instances every facing of one SKU into one `InstancedMesh` per template part (`stock.js`), box products collapse to a 2-material `twoGroupBox`, cylinders to a side+cap 2-group, so **procedural SKUs cost ~0 extra draw batches** regardless of how many we add. Frozen stock behind the 10 glass doors is authored `grabbable:false` (`store.js` line 216) — it is therefore **display-only, not list-eligible**. Every net-new geometry (`[BUILD]`) or photoscan (`SCAN`) is called out as additive pipeline work; the default path for a new SKU is **procedural, zero-asset, zero-batch**.

### 16.1 Department roster and counts

| # | Department (`section`) | Shipped | New | Total | Home fixture (Ch. 14/15) |
|---|---|---|---|---|---|
| 1 | produce | 6 | 12 | **18** | 6 crate tables x -20.4..-14.8, z 9.4/12 + berry endcap |
| 2 | pantry | 10 | 15 | **25** | Islands x -18/-10/-6, aisles 3 |
| 3 | snacks | 7 | 12 | **19** | Islands x -14/-6, aisle 2; checkout candy rack |
| 4 | dairy | 4 | 8 | **12** | Island x -10 face, aisle 4 |
| 5 | bakery | 3 | 7 | **10** | Back wall shelf z -14.72 (grocery side) |
| 6 | frozen | 2 | 7 | **9** | Glass wall (display) + open bunker endcap (grabbable) |
| 7 | household | 4 | 8 | **12** | Island x -6 face, aisle 5 |
| 8 | pharmacy | 3 | 7 | **10** | Pharmacy counter x 18.5 z 10.4; toys island back face |
| 9 | electronics | 5 | 5 | **10** | TV wall z -14.6 + merch gondola z -7.5 |
| 10 | home | 4 | 6 | **10** | Merch gondolas z -7.5/-3.5 |
| 11 | toys | 4 | 6 | **10** | Toys island x 19.5 + ball bin |
| 12 | apparel | 0 | 5 | **5** | 6 round racks + stack tables (carpet zone) |
| | **Total** | **52** | **98** | **150** | |

### 16.2 The SKU record schema (Ch. 20)

Every catalog row is one object literal in the `PRODUCTS` array. Fields (shipped fields marked *):

`id`* (unique snake_case) · `brand`* · `name`* (display) · `kind`* (package geometry, 16.3) · `price`* (USD) · `weight`* (label string) · `section`* · `bg1`*/`bg2`*/`accent`*/`ink`*/`tag`* (label art colors, Ch. 13) · `model`* (photoscan slug, optional) · `modelH`* (target height m, optional) · **new fields (additive):** `phys` (physics class, 16.14) · `footprint` `[w,d]` m (facing size) · `listWeight` (rarity, 16.16) · `eligible` (bool, default `true`; frozen-glass `false`). Absent `phys`/`footprint`/`listWeight` fall back to values derived from `kind` per 16.3, so the shipped 52 need no edits.

### 16.3 Package-kind geometry reference (from `buildProduct`)

Footprint `Fp` = base bounding-box W x D. These are the exact dims in `buildProduct` (`products.js` lines 339–357). Facing pitch on a gondola is the `step = 0.2 m` from `stockShelf`; items narrower than 0.2 m get one facing per step, `boxwide`/`boxbig` consume 2–4 steps.

| kind | mesh factory | dims W x H x D (m) | Fp cm | draw parts | default phys |
|---|---|---|---|---|---|
| `box` | `boxProduct` 0.15 x 0.24 x 0.07 | base y 0.12 | 15 x 7 | 1 (2-group) | Rig |
| `boxwide` | `boxProduct` 0.24 x 0.16 x 0.10 | y 0.08 | 24 x 10 | 1 | Rig |
| `boxtall` | `boxProduct` 0.17 x 0.30 x 0.09 | y 0.15 | 17 x 9 | 1 | Rig |
| `boxbig` | `boxProduct` 0.62 x 0.42 x 0.14 | y 0.21 | 1 | 62 x 14 | Rig |
| `can` | `canProduct` r0.045 h0.15 | y 0.075 | 9 x 9 | 1 (2-group) | Rol |
| `jar` | `jarProduct` r0.05 h0.16 + lid | 10 x 10 | 2 | Frg/Rig |
| `bottle` | `bottleProduct` r0.05 h0.30 + shoulder + cap | 10 x 10 | 3 | Rol/Frg |
| `bag` | `bagProduct` 0.16 x 0.22 x 0.055 (pillowed) | y 0.11 | 16 x 6 | 1 (2-group) | Sof |
| `carton` | `cartonProduct` 0.09 x 0.24 x 0.09 + gable | 9 x 9 | 2 | Rig |
| `cup` | `cupProduct` r0.045 h0.09 + foil | 9 x 9 | 2 | Stk |
| `tub` | `tubProduct` r0.07 h0.13 + lid | 14 x 14 | 2 | Stk/Rig |
| `ball` | sphere r0.115 | y 0.115 | 23 x 23 | 1 | Rol |
| `produce` | `fruit()` sphere/torus, or `model` scan | modelH-scaled | ~8 x 8 | 1 | Rol/Sof |
| `eggcarton` **[BUILD]** | flat pulp tray 0.30 x 0.07 x 0.15, 12 dimples | y 0.035 | 30 x 15 | 1 | Frg |
| `clamshell` **[BUILD]** | tray + clear lid 0.14 x 0.09 x 0.11 | y 0.045 | 14 x 11 | 2 (1 transp.) | Sof/Frg |
| `soft` **[BUILD]** | folded-textile pillow 0.22 x 0.09 x 0.14, rounded | y 0.045 | 22 x 14 | 1 | Sof |

The three `[BUILD]` kinds are the only net-new geometry in this chapter (three factory functions, ~40 lines total, each a `<=2`-material batch to stay inside the Intel-iGPU floor, Ch. 21). Everything else reuses shipped factories.

---

## Department tables

Legend — **Phys:** Rig=rigid, Rol=rolling, Frg=fragile, Sof=soft, Stk=stack (defs 16.14). **Asset:** `PROC`=procedural canvas label (`products.js`), `SCAN:slug`=Poly Haven photoscan, `BUILD`=new mesh, `(opt SCAN)`=procedural now, scan is an optional upgrade. **List:** Y=eligible, N=ineligible, ⚑=eligible but big-ticket (list-capped, 16.16). **Fp** = facing footprint cm.

### 16.4 Produce (18) — Band A

Loose, on the 6 crate tables + a new berry/mushroom endcap. Round produce uses the shipped `fruit()` sphere with per-SKU color, upgradeable to a photoscan. Prices per lb / each match `store.js` chalk signs.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| apple* | Gala Apples | Fresh | produce | 0.89 | per lb | Rol | SCAN:prod_apple | 9x9 | Y | Table x-20.4; shipped |
| lemon* | Fresh Lemons | Fresh | produce | 0.79 | per lb | Rol | SCAN:prod_lemon | 7x7 | Y | Table x-17.6; shipped |
| banana* | Bananas | Fresh | produce | 0.59 | per lb | Sof | SCAN:prod_banana | 15x5 | Y | 4x3 grid; bruises, no roll |
| avocado* | Hass Avocados | Fresh | produce | 1.89 | each | Sof | SCAN:prod_avocado | 8x8 | Y | Shipped |
| onion* | Yellow Onions | Fresh | produce | 0.69 | per lb | Rol | SCAN:prod_onion | 8x8 | Y | Shipped |
| sweetpotato* | Sweet Potatoes | Fresh | produce | 0.99 | per lb | Rol | SCAN:prod_sweetpotato | 9x6 | Y | Shipped |
| orange | Navel Oranges | Fresh | produce | 0.69 | per lb | Rol | PROC (opt SCAN) | 8x8 | Y | Sphere 0xf59a1e |
| tomato | Vine Tomatoes | Garden Patch | produce | 1.29 | per lb | Rol | PROC (opt SCAN) | 7x7 | Y | Sphere 0xd8362a |
| potato | Russet Potatoes | Fresh | produce | 0.79 | per lb | Rol | PROC (opt SCAN) | 9x6 | Y | Ellipsoid 0xc79a5c |
| carrot | Carrots 1lb | Garden Patch | bag | 0.99 | 454 g | Sof | PROC:bag | 16x6 | Y | Bagged; orange label |
| broccoli | Broccoli Crown | Garden Patch | produce | 1.49 | each | Sof | PROC (opt SCAN) | 9x9 | Y | Green sphere+stalk |
| lettuce | Iceberg Lettuce | Fresh | produce | 1.19 | each | Sof | PROC (lettuce mesh) | 15x15 | Y | Uses shipped `lettuce` case in `fruit()` |
| grapes | Red Grapes | Orchard Lane | clamshell | 2.49 | 500 g | Sof | BUILD:clamshell | 14x11 | Y | Endcap; clear-lid tray |
| strawberry | Strawberries | Orchard Lane | clamshell | 3.49 | 454 g | Frg | BUILD:clamshell | 14x11 | Y | Bruise=Frg; hero scan later |
| bellpepper | Bell Peppers | Fresh | produce | 0.99 | each | Rol | PROC (opt SCAN) | 8x8 | Y | Sphere 0xd83a2a / green |
| cucumber | Cucumbers | Garden Patch | produce | 0.79 | each | Rol | PROC (opt SCAN) | 15x5 | Y | Elongated; rolls far |
| mushroom | White Mushrooms | Fresh | clamshell | 2.29 | 227 g | Sof | BUILD:clamshell | 14x11 | Y | Endcap |
| lime | Fresh Limes | Fresh | produce | 0.29 | each | Rol | PROC (opt SCAN) | 6x6 | Y | Smallest facing |

### 16.5 Pantry (25) — Band B

Aisles 3 (Pasta·Sauce/Canned) and center islands. Glass jars/bottles are Frg; metal cans Rol; boxes/bags per material.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| cereal_oat* | Honey Oats | Northfield | box | 4.29 | 450 g | Rig | PROC:box | 15x7 | Y | Shipped; Whole Grain tag |
| cereal_flake* | Corn Flakes | Sunrise | box | 3.89 | 500 g | Rig | PROC:box | 15x7 | Y | Shipped |
| pasta* | Penne Rigate | Bella | box | 1.79 | 500 g | Rig | PROC:box | 15x7 | Y | Shipped |
| sauce* | Marinara | Nonna's | jar | 3.49 | 680 g | Frg | PROC:jar | 10x10 | Y | Glass; shatter ≥3.2 m/s |
| pb* | Peanut Butter | Nutty | jar | 4.99 | 454 g | Rig | PROC:jar | 10x10 | Y | Plastic jar; heavy |
| soup* | Tomato Soup | Kettle Co | can | 1.49 | 400 g | Rol | PROC:can | 9x9 | Y | Rolls on tip |
| beans* | Baked Beans | Kettle Co | can | 1.29 | 415 g | Rol | PROC:can | 9x9 | Y | Shipped |
| corn* | Sweet Corn | Golden | can | 0.99 | 340 g | Rol | PROC:can | 9x9 | Y | Shipped |
| ketchup* | Tomato Ketchup | Reddy | bottle | 2.79 | 567 g | Rol | PROC:bottle | 10x10 | Y | Plastic squeeze |
| tins* | Tinned Assortment | Pantry | box | 4.50 | 3 tins | Rig | SCAN:prod_tins | 15x12 | Y | Shipped scan |
| rice | Jasmine Rice | Sun Valley | bag | 3.99 | 2 kg | Sof | PROC:bag | 16x6 | Y | Heavy bag; muffled thud |
| flour | All-Purpose Flour | Harvest Mill | bag | 2.49 | 2 kg | Sof | PROC:bag | 16x6 | Y | Bursts to clutter |
| sugar | Cane Sugar | Harvest Mill | bag | 2.19 | 1 kg | Sof | PROC:bag | 16x6 | Y | — |
| oliveoil | Olive Oil | Bella | bottle | 6.49 | 500 ml | Frg | PROC:bottle | 10x10 | Y | Glass; dmg x0.60 |
| vinegar | White Vinegar | Zesti | bottle | 1.99 | 1 L | Frg | PROC:bottle | 10x10 | Y | Glass |
| spaghetti | Spaghetti | Bella | box | 1.79 | 500 g | Rig | PROC:box | 15x7 | Y | — |
| mac_cheese | Mac & Cheese | Northfield | box | 1.29 | 200 g | Rig | PROC:box | 15x7 | Y | Small box |
| tuna | Chunk Tuna | Kettle Co | can | 1.19 | 142 g | Rol | PROC:can | 9x9 | Y | Endcap pyramid → Stk on spill |
| chicken_soup | Chicken Soup | Kettle Co | can | 1.59 | 400 g | Rol | PROC:can | 9x9 | Y | — |
| peaches | Sliced Peaches | Golden | can | 1.79 | 411 g | Rol | PROC:can | 9x9 | Y | — |
| honey | Clover Honey | Sun Valley | jar | 4.79 | 375 g | Rig | PROC:jar | 10x10 | Y | Plastic bear-jar |
| jam | Strawberry Jam | Nonna's | jar | 3.29 | 340 g | Frg | PROC:jar | 10x10 | Y | Glass |
| coffee | Ground Coffee | Grainary | can | 7.49 | 340 g | Rol | PROC:can | 9x9 | Y | Tall tin; Band-B top |
| tea | Black Tea 40ct | Grainary | box | 3.49 | 40 ct | Rig | PROC:box | 15x7 | Y | — |
| salt | Table Salt | Harvest Mill | can | 0.99 | 737 g | Rol | PROC:can | 9x9 | Y | Cylindrical canister |

### 16.6 Snacks (19) — Band B

Aisle 2 + checkout candy rack (`store.js` line 796 filters `snacks` bags/boxes for the rack). Bags Sof, glass jars Frg, cans/plastic bottles Rol.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| chips* | Sea Salt Chips | Crunch | bag | 2.99 | 150 g | Sof | PROC:bag | 16x6 | Y | Shipped |
| chips_bbq* | BBQ Chips | Crunch | bag | 2.99 | 150 g | Sof | PROC:bag | 16x6 | Y | Shipped |
| pretzel* | Salted Pretzels | Twist | bag | 2.49 | 200 g | Sof | PROC:bag | 16x6 | Y | Shipped |
| cookies* | Choco Chunk | Oven Joy | box | 3.29 | 300 g | Rig | PROC:box | 15x7 | Y | Shipped |
| gummies* | Gummy Bears | Chewy | bag | 1.99 | 180 g | Sof | PROC:bag | 16x6 | Y | Candy rack |
| cola* | Cola Classic | Fizz | bottle | 1.89 | 2 L | Rol | PROC:bottle | 10x10 | Y | Plastic 2L; rolls far |
| water* | Spring Water | Alpine | bottle | 0.99 | 1.5 L | Rol | PROC:bottle | 10x10 | Y | Shipped |
| chips_sc | Sour Cream Chips | Crunch | bag | 2.99 | 150 g | Sof | PROC:bag | 16x6 | Y | — |
| popcorn | Butter Popcorn | PopTop | bag | 2.79 | 250 g | Sof | PROC:bag | 16x6 | Y | — |
| crackers | Wheat Crackers | Twist | box | 2.29 | 200 g | Rig | PROC:box | 15x7 | Y | — |
| candybar | Caramel Bar | Chewy | box | 1.29 | 55 g | Rig | PROC:box | 15x7 | Y | Candy rack; small |
| chocolate | Milk Chocolate | Chewy | box | 2.99 | 100 g | Rig | PROC:box | 15x7 | Y | — |
| lollipops | Fruit Pops | Chewy | bag | 1.49 | 150 g | Sof | PROC:bag | 16x6 | Y | Candy rack |
| tortillachips | Tortilla Chips | Crunch | bag | 3.29 | 300 g | Sof | PROC:bag | 16x6 | Y | Pairs w/ salsa |
| salsa | Medium Salsa | Nonna's | jar | 2.99 | 454 g | Frg | PROC:jar | 10x10 | Y | Glass |
| energydrink | Energy Drink | Sparkle | can | 2.49 | 250 ml | Rol | PROC:can | 9x9 | Y | Slim can |
| lemonade | Lemonade | Sparkle | bottle | 1.79 | 1 L | Rol | PROC:bottle | 10x10 | Y | — |
| sportsdrink | Sports Drink | Sparkle | bottle | 1.99 | 700 ml | Rol | PROC:bottle | 10x10 | Y | — |
| mixednuts | Mixed Nuts | Nibbl | jar | 4.49 | 450 g | Rig | PROC:jar | 10x10 | Y | Plastic jar |

### 16.7 Dairy (12) — Band C

Aisle 4. Cartons/boxes Rig, cups/tubs Stk (nest & topple as a column), eggs Frg.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| milk* | Whole Milk | Meadow | carton | 2.59 | 1 L | Rig | PROC:carton | 9x9 | Y | Gable carton |
| juice* | Orange Juice | Grove | carton | 3.49 | 1 L | Rig | PROC:carton | 9x9 | Y | Shipped |
| yogurt* | Greek Yogurt | Meadow | cup | 1.19 | 150 g | Stk | PROC:cup | 9x9 | Y | Nested column |
| cheese* | Cheddar Block | Dale | box | 4.79 | 400 g | Rig | PROC:box | 15x7 | Y | Shipped |
| eggs | Large Eggs Dozen | Farmgate | eggcarton | 2.99 | 12 ct | Frg | BUILD:eggcarton | 30x15 | Y | Shatter ≥3.2; 12 shards |
| butter | Salted Butter | Creamery Row | box | 3.49 | 454 g | Rig | PROC:box | 15x7 | Y | — |
| creamcheese | Cream Cheese | Meadow | tub | 2.29 | 226 g | Stk | PROC:tub | 14x14 | Y | — |
| sourcream | Sour Cream | Meadow | tub | 1.89 | 454 g | Stk | PROC:tub | 14x14 | Y | — |
| halfhalf | Half & Half | Grove | carton | 1.99 | 500 ml | Rig | PROC:carton | 9x9 | Y | Short carton |
| shredcheese | Shredded Cheddar | Dale | bag | 3.99 | 340 g | Sof | PROC:bag | 16x6 | Y | Resealable bag |
| stringcheese | String Cheese | Dale | bag | 4.29 | 12 ct | Sof | PROC:bag | 16x6 | Y | — |
| chocmilk | Chocolate Milk | Meadow | bottle | 2.19 | 500 ml | Rol | PROC:bottle | 10x10 | Y | Plastic bottle |

### 16.8 Bakery (10) — Band C

Back wall shelf (grocery side). Bags Sof, boxed goods Rig.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| bread* | Country Loaf | Hearth | bag | 2.89 | 650 g | Sof | PROC:bag | 16x6 | Y | Shipped |
| muffins* | Blueberry Muffins | Hearth | box | 4.49 | 4 ct | Rig | PROC:box | 15x7 | Y | Shipped |
| croissant* | Butter Croissant | Hearth | box | 1.50 | 80 g | Sof | SCAN:prod_croissant | 12x8 | Y | Shipped scan |
| bagels | Plain Bagels | Hearth | bag | 3.49 | 6 ct | Sof | PROC:bag | 16x6 | Y | — |
| donuts | Glazed Donuts | Oven Joy | box | 4.99 | 6 ct | Rig | PROC:box | 15x7 | Y | — |
| baguette | French Baguette | Golden Crust | bag | 1.99 | 250 g | Sof | PROC:bag | 24x6 | Y | Long facing; 2 steps |
| cake | Celebration Cake | Oven Joy | boxwide | 12.99 | 900 g | Rig | PROC:boxwide | 24x10 | Y | Band-C top; boxed |
| pie | Apple Pie | Hearth | boxwide | 6.49 | 700 g | Rig | PROC:boxwide | 24x10 | Y | — |
| cinnrolls | Cinnamon Rolls | Oven Joy | box | 4.29 | 5 ct | Rig | PROC:box | 15x7 | Y | — |
| tortillas | Flour Tortillas | Golden Crust | bag | 2.49 | 10 ct | Sof | PROC:bag | 16x6 | Y | — |

### 16.9 Frozen (9) — Band C

The two shipped SKUs live behind the 10-door glass wall authored `grabbable:false` → **List N** (display-only, Ch. 15). The 7 new frozen SKUs sit in a proposed **open reach-in bunker endcap** (grabbable) at the freezer wall's south end → **List Y**. This resolves the shipped "frozen is unreachable" gap without touching the glass wall.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| pizza* | Margherita Pizza | Stonefire | boxwide | 5.99 | 390 g | Rig | PROC:boxwide | 24x10 | **N** | Behind glass; shipped |
| icecream* | Vanilla Ice Cream | Polar | tub | 4.29 | 1 L | Stk | PROC:tub | 14x14 | **N** | Behind glass; shipped |
| frozenveg | Frozen Peas | Arctic Harvest | bag | 2.49 | 500 g | Sof | PROC:bag | 16x6 | Y | Open bunker |
| frozenberries | Frozen Berries | Arctic Harvest | bag | 3.99 | 340 g | Sof | PROC:bag | 16x6 | Y | Bunker |
| fries | Crinkle Fries | Frostline | bag | 2.99 | 750 g | Sof | PROC:bag | 16x6 | Y | Bunker |
| icecreamsand | Ice Cream Sandwiches | Polar | boxwide | 3.49 | 6 ct | Rig | PROC:boxwide | 24x10 | Y | Bunker |
| waffles | Frozen Waffles | Frostline | boxwide | 2.79 | 10 ct | Rig | PROC:boxwide | 24x10 | Y | Bunker |
| lasagna | Frozen Lasagna | Stonefire | boxwide | 4.99 | 850 g | Rig | PROC:boxwide | 24x10 | Y | Bunker |
| popsicles | Fruit Popsicles | Chill Point | boxwide | 2.99 | 12 ct | Rig | PROC:boxwide | 24x10 | Y | Bunker |

### 16.10 Household (12) — Band D

Aisle 5 (Household/Paper Goods). Aerosols and rigid plastic bottles Rol/Rig; paper packs Sof.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| tp* | Bath Tissue 4pk | CloudSoft | boxwide | 5.49 | 4 rolls | Sof | PROC:boxwide | 24x10 | Y | Poly-wrapped pack |
| detergent* | Laundry Power | Wave | boxtall | 8.99 | 1.8 kg | Rig | PROC:boxtall | 17x9 | Y | Heavy box |
| tissues* | Facial Tissues | CloudSoft | boxwide | 2.29 | 120 ct | Rig | PROC:boxwide | 24x10 | Y | Light carton |
| soapbar | Soap Bars 3pk | Pure | box | 3.19 | 3x90 g | Rig | PROC:box | 15x7 | Y | Shipped |
| papertowels | Paper Towels 2pk | CloudSoft | boxwide | 4.99 | 2 rolls | Sof | PROC:boxwide | 24x10 | Y | — |
| dishsoap | Dish Soap | Gleam | bottle | 2.49 | 750 ml | Rol | PROC:bottle | 10x10 | Y | — |
| handsoap | Hand Soap | Pure | bottle | 3.29 | 300 ml | Rol | PROC:bottle | 10x10 | Y | Pump cap |
| sponges | Scrub Sponges | Gleam | bag | 1.99 | 6 ct | Sof | PROC:bag | 16x6 | Y | — |
| trashbags | Trash Bags | Shield | box | 5.99 | 40 ct | Rig | PROC:box | 15x7 | Y | — |
| bleach | Bleach | Gleam | bottle | 2.99 | 1.4 L | Rol | PROC:bottle | 10x10 | Y | Hazard-yellow cap |
| airfresh | Air Freshener | FreshAir | can | 3.49 | 250 ml | Rol | PROC:can | 9x9 | Y | Aerosol |
| dishpods | Dishwasher Pods | Wave | tub | 7.49 | 32 ct | Rig | PROC:tub | 14x14 | Y | Screw-lid tub |

### 16.11 Pharmacy (10) — Band D

Pharmacy counter x 18.5 z 10.4 + toys island back face. Liquids in glass Frg.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| meds* | Pain Relief | Relievo | box | 6.50 | 24 ct | Rig | PROC:box | 15x7 | Y | Shipped |
| vitamins* | Multivitamin | VitaDay | jar | 9.00 | 90 ct | Rig | PROC:jar | 10x10 | Y | Plastic jar |
| bandages* | Bandages | MendFast | boxwide | 3.50 | 40 ct | Rig | PROC:boxwide | 24x10 | Y | Shipped |
| toothpaste | Toothpaste | DermaCare | box | 3.29 | 100 ml | Rig | PROC:box | 15x7 | Y | Tube-in-box |
| shampoo | Shampoo | DermaCare | bottle | 4.49 | 400 ml | Rol | PROC:bottle | 10x10 | Y | — |
| deodorant | Deodorant | Pure | box | 3.99 | 75 g | Rig | PROC:box | 15x7 | Y | — |
| coughsyrup | Cough Syrup | ClearBreathe | bottle | 7.49 | 250 ml | Frg | PROC:bottle | 10x10 | Y | Glass |
| sleepaid | Sleep Aid | NightRest | box | 8.99 | 32 ct | Rig | PROC:box | 15x7 | Y | — |
| sunscreen | Sunscreen SPF50 | DermaCare | bottle | 6.99 | 200 ml | Rol | PROC:bottle | 10x10 | Y | — |
| firstaid | First Aid Kit | MendFast | boxwide | 12.99 | 90 pc | Rig | PROC:boxwide | 24x10 | Y | Band-D top |

### 16.12 Electronics (10) — Band F

TV wall z -14.6 (wall-mounted demo = anchored, List N) + merch gondola z -7.5. Boxed electronics are List ⚑ (big-ticket, capped to ≤1/list).

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| tv55* | 55" 4K TV | Vixel | boxbig | 379.00 | 55 in | Rig | PROC:boxbig | 62x14 | **N** | Wall demo; anchored |
| soundbar* | Soundbar 2.1 | Vixel | boxwide | 89.00 | 80 cm | Rig | PROC:boxwide | 24x10 | ⚑ | — |
| headphones* | Headphones | Aural | box | 49.00 | over-ear | Rig | PROC:box | 15x7 | ⚑ | — |
| console* | Game Console | PlayBox | box | 299.00 | 1 TB | Rig | PROC:box | 15x7 | ⚑ | — |
| router* | WiFi Router | Linkly | box | 59.00 | AX3000 | Rig | PROC:box | 15x7 | ⚑ | Shipped |
| phone | Smartphone | Cellwave | box | 699.00 | 6.5 in | Rig | PROC:box | 15x7 | ⚑ | Highest price; M_price 0.12 |
| tablet | Tablet 11" | Cellwave | boxwide | 329.00 | 11 in | Rig | PROC:boxwide | 24x10 | ⚑ | — |
| speaker | Bluetooth Speaker | Aural | box | 39.00 | portable | Rig | PROC:box | 15x7 | Y | Under $40; not capped |
| gamepad | Wireless Gamepad | PlayBox | box | 59.00 | 1 pc | Rig | PROC:box | 15x7 | ⚑ | — |
| charger | USB-C Charger | Voltix | box | 19.00 | 65 W | Rig | PROC:box | 15x7 | Y | Cheap; ordinary weight |

### 16.13 Home (10) — Band E

Merch gondolas z -7.5/-3.5. Soft goods use `[BUILD]:soft`; ceramics Frg.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| blender* | Blender | MixMate | boxtall | 34.00 | 1.5 L | Rig | PROC:boxtall | 17x9 | Y | Shipped |
| towels* | Bath Towels 2pk | Plush | boxwide | 15.00 | 2 pk | Sof | PROC:boxwide | 24x10 | Y | Bundle |
| cookset* | Cookware Set | ChefLine | boxbig | 79.00 | 10 pc | Rig | PROC:boxbig | 62x14 | ⚑ | — |
| lamp* | Desk Lamp | Glow | boxtall | 19.00 | LED | Rig | PROC:boxtall | 17x9 | Y | Shipped |
| toaster | 2-Slice Toaster | MixMate | boxwide | 24.00 | 2-slice | Rig | PROC:boxwide | 24x10 | Y | — |
| coffeemaker | Coffee Maker | BrewMate | boxtall | 45.00 | 12 cup | Rig | PROC:boxtall | 17x9 | ⚑ | — |
| pillow | Bed Pillow | Nestwell | soft | 9.99 | standard | Sof | BUILD:soft | 22x14 | Y | Folded-textile mesh |
| blanket | Fleece Blanket | Nestwell | soft | 19.99 | throw | Sof | BUILD:soft | 22x14 | Y | — |
| mugset | Ceramic Mugs 4pk | ChefLine | box | 6.99 | 4 pk | Frg | PROC:box | 15x7 | Y | Boxed ceramic; shatter |
| fan | Box Fan | Glow | boxbig | 29.00 | 20 in | Rig | PROC:boxbig | 62x14 | Y | — |

### 16.14 Toys (10) — Band E

Toys island x 19.5 + wire ball bin. The play `ball` is the only shipped `ball`-kind SKU.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| toytruck* | Monster Truck | ZoomCo | box | 24.00 | ages 3+ | Rig | PROC:box | 15x7 | Y | Shipped |
| blocks* | Building Blocks | Brixo | box | 29.00 | 250 pc | Rig | PROC:box | 15x7 | Y | Shipped |
| ball* | Play Ball | Bounce | ball | 4.00 | 22 cm | Rol | PROC:ball | 23x23 | Y | Ball bin; highest bounce |
| plush* | Plush Bear | Snuggle | box | 12.00 | 30 cm | Sof | PROC:box | 15x7 | Y | Squishy; Sof despite box |
| dollhouse | Doll House | Brixo | boxbig | 39.00 | ages 4+ | Rig | PROC:boxbig | 62x14 | Y | — |
| boardgame | Board Game | Puzzlr | boxwide | 19.00 | 2-4 pl | Rig | PROC:boxwide | 24x10 | Y | — |
| puzzle | 500pc Puzzle | Puzzlr | boxwide | 12.00 | 500 pc | Rig | PROC:boxwide | 24x10 | Y | — |
| watergun | Water Blaster | Splash | box | 9.00 | ages 5+ | Rig | PROC:box | 15x7 | Y | — |
| actionfig | Action Figure | ZoomCo | box | 14.00 | ages 4+ | Rig | PROC:box | 15x7 | Y | — |
| bubbles | Bubble Solution | Splash | bottle | 3.00 | 500 ml | Rol | PROC:bottle | 10x10 | Y | Cheapest toy |

### 16.15 Apparel (5) — Band E — NEW department

The apparel zone (6 round racks + stack tables on carpet) ships with **fixtures but no SKUs**; these 5 give the `[BUILD]:soft` folded-textile mesh its home. All Sof (drape, no bounce, no break). Sneakers are boxed → Rig.

| ID | Name | Brand | Kind | $ | Size | Phys | Asset | Fp | List | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| tshirt | Cotton T-Shirt | Everwear | soft | 8.99 | M | Sof | BUILD:soft | 22x14 | Y | Stack table |
| socks | Crew Socks 6pk | Softstep | bag | 5.99 | 6 pk | Sof | PROC:bag | 16x6 | Y | Poly bag |
| jeans | Denim Jeans | Everwear | soft | 24.99 | 32x32 | Sof | BUILD:soft | 22x14 | Y | Folded |
| cap | Baseball Cap | TrailKit | soft | 12.99 | OSFA | Sof | BUILD:soft | 22x14 | Y | Round rack |
| sneakers | Sneakers | Softstep | box | 34.99 | US 10 | Rig | PROC:box | 24x14 | ⚑ | Shoebox |

---

## Systems

### 16.16 Physics-class definitions (bounce / friction / break)

The shipped debris integrator (`physics.js` lines 294–320) applies ONE constant set to every knocked-loose item: gravity `9.8 m/s²`, floor bounce `v.y = -v.y * 0.28`, horizontal friction `v.x,v.z *= 0.55`, angular damping `w *= 0.5`, rests when post-bounce `|v.y| < 0.55`, plays `tick` when impact `|v.y| > 1.2`, then snaps `rotation.x/z` to the nearest `π/2` and seats the bbox on the floor. Debris cap `100`, TTL `28 s`, drain `9 spawns/frame`.

The **five physics classes** are an additive branch: `spawnDebrisNow` reads `spec.phys` and selects the constant row below. Row **Rig = the exact shipped baseline**, so untagged SKUs are unchanged. `dmg` extends the shipped "damage billing 40% price" (Ch. 4): the class multiplies the billed fraction.

| Class | `e_y` vert bounce | `k_h` horiz retain | `k_w` ang retain | rest `|v.y|<` | break rule | `dmg` frac | SFX on floor hit |
|---|---|---|---|---|---|---|---|
| **Rig** rigid | 0.28 | 0.55 | 0.50 | 0.55 | — | 0.40 | `thud` |
| **Rol** rolling | 0.34 | **0.92** | **0.88** | 0.35 | — | 0.40 | `tick` + roll |
| **Frg** fragile | 0.12 | 0.40 | 0.65 | 0.50 | **shatter if `|v|≥3.2 m/s`** | 0.60 | `clatter`/glass |
| **Sof** soft | 0.05 | 0.78 | 0.80 | 0.75 | — | 0.25 | muffled `thud` |
| **Stk** stack | 0.28 | 0.55 | 0.50 | 0.55 | — (correlated burst) | 0.40 | multi-`clatter` |

Per-class behavior, precisely:

- **Rigid** — the baseline. Boxes, sealed plastic jars, cartons, appliances, electronics. Thuds, tumbles, snaps flat, rests. Bills 40% of price at checkout.
- **Rolling** — cans, plastic bottles, round produce, the play ball. `k_h 0.92` means it *keeps* most horizontal speed on each bounce and `k_w 0.88` keeps it spinning, so a knocked can travels metres across an aisle. **Added rolling-floor rule:** while `resting===false` and `position.y<=0.01`, if horizontal speed `>0.2 m/s` do not rest — keep integrating x/z with per-frame ground friction `*=0.985` until speed `<0.2`, then rest. This is the chaos multiplier the game leans on (Ch. 9 game-feel).
- **Fragile** — glass jars/bottles, eggs, ceramic. On floor contact with impact speed `|v| ≥ 3.2 m/s`: hide the body, spawn `N` shard quads (`N=6` default; `eggs=12`), each `0.03–0.05 m`, inheriting `~40%` of impact velocity + random spin, TTL `14 s` (half), and **bill `price × 0.60`**. Below the threshold it behaves like Rigid with `e_y 0.12` (glass barely bounces) and does not break. Plays `clatter`.
- **Soft** — bags, bread, apparel, plush, paper packs, greens. `e_y 0.05` = essentially no bounce; `k_h 0.78` slides a little; rests almost immediately (`|v.y|<0.75`). Cheapest to restock: bills only 25% of price. Muffled thud, no `tick`.
- **Stack** — nested cups/tubs and endcap can-pyramids. Ships as a stacked column/pyramid; when `hideInRegion` fires on a crash it releases the **whole group at once** as a correlated burst (each piece then integrates as Rigid), subject to the shipped `9 spawns/frame` drain so a big pyramid never hitches a frame. Plays overlapping `clatter`.

All classes obey the shipped `DEBRIS_CAP 100` (oldest resting piece dropped first) and the `SPAWNS_PER_FRAME 9` amortization — no class can exceed the budget (Ch. 21, Ch. 22).

### 16.17 Pricing bands and rationale

Prices are anchored to real US grocery ranges so three systems read correctly at once: the **checkout total banner** (Ch. 12), the **damage bill** (`price × dmg`, Ch. 4), and the **rarity weight** (16.18). Six bands:

| Band | Range | Departments | Design role |
|---|---|---|---|
| **A** Loose | $0.15 – 2.49 | produce | Cheap, forgiving; a dropped lime costs `0.29×0.40 = $0.12` |
| **B** Staple | $0.99 – 7.49 | pantry, snacks | The bread-and-butter list volume |
| **C** Perishable | $1.19 – 12.99 | dairy, bakery, frozen | Mid; a smashed cake bills `12.99×0.40 = $5.20` |
| **D** Care | $1.99 – 12.99 | household, pharmacy | Slightly premium; glass syrup bills at 0.60 |
| **E** Softline | $3.00 – 79.00 | home, toys, apparel | The affordable "splurge" tier |
| **F** Big-ticket | $19.00 – 699.00 | electronics, big home | Rare list guests; huge total spikes |

Worked example — a **pure-grocery 6-item list** (milk 2.59, bread 2.89, eggs 2.99, bananas 0.59, chips 2.99, cola 1.89) totals **$13.94**, the target satisfying-run band ($10–25). Swap one slot for a **big-ticket splurge** (console 299.00) and the total jumps to **$310.94** — the banner's dramatic spike moment. Damage math stays legible: sprint-crashing a can pyramid (6× beans at 40%) adds `6 × 1.29 × 0.40 = $3.10` to the bill; shattering the olive oil adds `6.49 × 0.60 = $3.89`.

### 16.18 Rarity weighting for list generation

**Shipped behavior** (`game.js` `genList`): pick up to 6 *distinct* specs uniformly at random from `world.stock.availableSpecs()` (specs with visible, grabbable stock — which already excludes frozen-glass, `stock.js` line 92). Uniform means a $699 phone is as likely as milk. The weighting below is a drop-in replacement for that `while` loop — same output shape, biased toward a believable grocery run.

**Weight formula:** `w(sku) = W_section × M_price × A_avail`

`W_section` (relative pull of each department):

| section | W | section | W | section | W |
|---|---|---|---|---|---|
| pantry | 1.0 | dairy | 1.0 | produce | 1.0 |
| snacks | 0.9 | bakery | 0.8 | household | 0.7 |
| frozen | 0.6 | pharmacy | 0.5 | apparel | 0.4 |
| toys | 0.3 | home | 0.25 | electronics | 0.15 |

`M_price`: `price < 10 → 1.0` · `10–40 → 0.5` · `40–150 → 0.25` · `> 150 → 0.12`.
`A_avail`: `1` if the SKU still has visible grabbable stock, else `0` (mirrors `availableSpecs`; `eligible:false` frozen-glass SKUs never enter the pool).

**Draw:** pick 6 without replacement, each slot weighted by `w`. Two constraints keep lists coherent:
1. **≤1 big-ticket** — at most one SKU with `price > $40` per list (the "dash splurge"). If a second is drawn, re-roll that slot from the `price ≤ $40` sub-pool.
2. **≥3 grocery** — at least three of the six from `{produce, pantry, dairy, bakery, snacks}`. If unmet after the draw, replace the lowest-weight non-grocery slot with a grocery re-roll.

**Worked distribution** (full store, all 150 in stock). Approx section total weight = `W × count × avg M_price`: pantry 25.0, produce 18.0, snacks 17.1, dairy 12.0, bakery 8.0, household 8.4, pharmacy 4.75, frozen 4.2 (2 glass SKUs excluded), toys 2.7, apparel 1.8, home 1.5, electronics 0.45 → **total ≈ 104.4**. So a single pick is **pantry ≈ 24%**, **produce ≈ 17%**, **snacks ≈ 16%**, **electronics ≈ 0.43%**. Across a 6-item list the expected composition is ~4.5 grocery, ~1 care/softline, and a big-ticket appears in roughly `1 − (1 − 0.02)^6 ≈ 11%` of lists — rare enough to feel special, capped so it never dominates.

**Seeding (Ch. 5 dailies):** route the draw through the shipped LCG (`seed = seed*16807 % 2147483647`, already used by stocking in `store.js`) instead of `Math.random` when a daily seed is active, so a given day's list is reproducible and shareable (Ch. 12); endless mode keeps `Math.random`. This is purely additive — same 6-object output the renderer and HUD already consume.

### 16.19 Catalog invariants (Definition of Done, Ch. 26)

1. `PRODUCTS.length === 150`; every `id` unique; the 52 shipped rows byte-identical to `products.js`.
2. Every `kind` resolves to a factory in 16.3 (`box/boxwide/boxtall/boxbig/can/jar/bottle/bag/carton/cup/tub/ball/produce` shipped; `eggcarton/clamshell/soft` are the only `[BUILD]` additions, ≤2 material batches each).
3. Every SKU has exactly one `phys` from `{Rig, Rol, Frg, Sof, Stk}`; untagged = `Rig` (shipped baseline, no behavior change).
4. `eligible:false` only on the two glass-wall frozen SKUs; all others eligible; big-ticket handling is via weight+cap, never a hard exclusion.
5. Per-department counts equal 16.1 and sum to 150; new procedural SKUs add **zero** draw batches (instanced 2-group batching, Ch. 21).
6. Asset pipeline delta is bounded: 3 `[BUILD]` meshes, optional produce photoscans (`orange/tomato/potato/strawberry/…`) fetched via the existing `scripts/fetch-models.mjs` path (Ch. 19) and logged in `CREDITS.md`. No SKU requires a backend.

*Cross-references:* brands → **Ch. 13**; damage economy & totals → **Ch. 4**; daily/seeded lists & achievements → **Ch. 5**; results banner → **Ch. 12**; frozen bunker & store zones → **Ch. 14/15**; instancing & draw budget → **Ch. 21**; debris integrator & spill mechanics → **Ch. 22**; SKU record schema → **Ch. 20**; grab/roll game-feel → **Ch. 9**.



# Chapter 17 — NPCs, AI & the Crowd

The store is a racetrack (Ch. 1), and a racetrack is only alive if it is *populated*. This chapter specifies every person in Grocery Dash 3D: the twelve archetypes that walk, post, patrol and panic; the Crowd Director that decides how many of them exist and where; the exact Rocketbox casting; and the 119-line bark library that gives the crowd a voice. Everything here is an **extension of the shipped mover** in `game/src/characters.js` (Ch. 19) and the shipped consequence layer in `game/src/physics.js` (Ch. 22). Nothing forks the renderer, nothing needs a backend, and every addition survives the Intel-iGPU floor (Ch. 21). Constants written `like this` are live in the code today; values marked **[BUILD]** are additive and specified precisely enough to implement without a design pass.

### 17.1 What ships today, and the two delivery channels

The current build loads **13 avatars** — 6 aisle walkers (2 pushing carts), 2 shelf browsers set to `pause:Infinity`, and 5 posted staff at `world.staffSpots` — animated by the rotation-delta retargeter and gated by `retargetIsSane`. They wander a hand-rolled FSM over `{path, pause, browsing, shove, home, speed}`, they take a bump (radius `0.66 m`, closing speed `> 0.6 m/s` → `shove {t:0.55}`, `shoveCd 1.3 s`), and staff drift `home` at `min(1, 2·dt)`. Player-caused events already speak through the DOM `toast()` in `physics.js`.

NPC voice is delivered on **two channels**, and every bark row in §17.8 is tagged for exactly one:

| Channel | Mechanism | Anchor | Life | Concurrency | Used by |
|---|---|---|---|---|---|
| **Toast** (shipped) | `toast(msg)` — single `#toast` DOM node, `opacity 1 → 0`, `toastT = 2.6 s` | top-center HUD (Ch. 7) | 2.6 s | 1 (latest wins) | player-caused: bump, cart-tip, knock, checkout, cleanup |
| **Speech bubble** **[BUILD]** | canvas-texture plane over the head, additive, fade-in 0.25 s / hold 2.0 s / fade-out 0.25 s | world-space, billboarded to camera | 2.5 s | **≤ 2** at once | ambient NPC chatter, browser, kid, staff |
| **PA voice** (Ch. 18) | `SpeechSynthesis` → tinny bandpass chain | store-wide, non-diegetic | queue | 1 | manager pages, dynamic cleanup |

Bubbles only spawn for NPCs within **6 m** of the camera (culled cheaply against `camera.position`); past that the bark is discarded, not queued. Bubbles are **cosmetic and must not draw from the seeded RNG stream** (Ch. 5) — they use `Math.random()` so a Daily Run's crowd chatter can differ per playthrough without desyncing the deterministic sim.

### 17.2 The shared behavior-tree substrate

Every archetype is the *same mover* with a different parameter block plus, at most, one new leaf behavior. The per-tick evaluation is a **Selector (first match wins)**, extending the shipped `update(dt)` loop verbatim where marked:

```
Selector(npc, dt):
  1. if npc.shove active      → integrate knockback; decay v by (1−min(1,4.5·dt));
                                yaw jitter ±0.6 rad/s; shove.t −= dt        (SHIPPED)
  2. if npc.home & |pos−home|>0.05 → lerp toward post at min(1,2·dt)         (SHIPPED)
  3. if archetype==CHILD      → leash_follow(parent, r=1.4, snap>2.0)        [BUILD]
  4. if archetype==GUARD      → patrol_loop(waypoints, scan 3s)              [BUILD]
  5. if archetype==INFLUENCER → pan_yaw(±0.6 rad sinusoid); reposition 6–10s [BUILD]
  6. if archetype==JANITOR & debris_in_range(3m) → seek_and_reshelve         [BUILD]
  7. if incident_within(R_react) → react_to_incident(tip/spill)             [BUILD]
  8. if npc.pause > 0         → pause −= dt; blend walk→idle at dt·3          (SHIPPED)
  9. if npc.path empty        → newPath(); (0.6 aisle-only / 0.4 cross)      (SHIPPED)
 10. default                  → advance along path; step=min(dist,speed·dt); (SHIPPED)
                                turn clamp ±3·dt; blend idle→walk at dt·3;
                                walk.timeScale = speed/1.3; arrive at 0.12m
```

Steps 1, 2, 8, 9, 10 are the existing code. Steps 3–7 are the new leaves. `react_to_incident` (step 7) is the one new *global* behavior — it fires when a gondola tip or cart casualty happens inside a per-archetype **reaction radius** `R_react` (see §17.5).

### 17.3 The archetype roster — master parameter table

Twelve archetypes. Speed is world m/s (the mover advances `speed·dt`); the shipped default walker uses `rand(0.8,1.2)`, and the archetype values below re-scale that per PLAYBOOK design targets. Height feeds the load-time bone-span autoscale (`fbx.scale = height / boneSpan(fbx).h`); today `TARGET_H = 1.74` is a module constant and **must become per-archetype [BUILD]**. Blob radius is the shared soft shadow (`CircleGeometry(1,24)`, scaled `0.42/model.scale`).

| # | Archetype | Height (m) | Speed (m/s) | Turn (rad/s) | Pause (s) | Path bias aisle:cross | Cart | Blob r (m) | Home / post |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Speed-Shopper** | 1.74 | 1.15–1.30 | 3.0 | 0–1.0 | 55:45 | no | 0.42 | roams `corridors.xs` |
| 2 | **Browser** | 1.74 | 0 | 0.8 (scan) | ∞ | n/a | no | 0.42 | shelf face, basket beside |
| 3 | **Parent** (+Child) | 1.74 | 0.70–0.95 | 2.2 | 1.5–4.0 | 70:30 | 60% | 0.42 | roams w/ leashed child |
| 4 | **Child** | 1.24 | 1.10 (dart) | 4.0 | 0.4–1.2 | leash | no | 0.30 | orbits parent ≤1.4 m |
| 5 | **Elderly** | 1.68 | 0.55–0.70 | 1.5 | 2.0–5.0 | 80:20 | yes | 0.44 | roams, slow |
| 6 | **Influencer** | 1.74 | 0 | ±0.6 pan | reposition 6–10 | n/a | no | 0.42 | endcaps / produce corner |
| 7 | **Security Guard** | 1.80 | 0.90–1.05 | 2.5 | 3.0 (scan) | perimeter loop | no | 0.44 | 4-corner patrol |
| 8 | **Manager** | 1.76 | 0.85–1.00 | 2.2 | 4.0 (clipboard) | staffSpots seq | no | 0.42 | tours `staffSpots` |
| 9 | **Stocker** | 1.74 | 0 → 0.8 relocate | 1.8 | ∞ / relocate 8–14 | endcap↔shelf | no | 0.42 | endcap w/ crate |
| 10 | **Cashier** | 1.72 | 0 | 0.0 | ∞ | n/a | no | 0.42 | staffed lanes (2) |
| 11 | **Pharmacist** | 1.72 | 0 | 1.2 | ∞ | n/a | no | 0.42 | counter (18.5, 10.4) |
| 12 | **Cart-Wrangler** | 1.78 | 1.00–1.15 | 2.0 | 1.0 | exterior 3-wp loop | train | 0.44 | lot (Ch. 15) |
| 12b | **Janitor** | 1.74 | 0.75–0.90 | 2.0 | 2.0 (mop) | debris-seek | mop-cart | 0.42 | wet-cone zones |

(The Janitor is listed 12b because it and the Cart-Wrangler are the two "utility" mobiles; both are full archetypes with their own behavior below — thirteen distinct specs, twelve gameplay-facing roles.)

### 17.4 Archetype behavior specs

Each spec gives the behavior tree (the leaf that specializes the substrate), plus spawn rules. Interaction responses (bump / aisle-tip / debris) are consolidated in the matrix at §17.5 — deviations are noted inline.

**1 · Speed-Shopper.** The baseline walker made purposeful. `newPath()` weighting stays `0.6` aisle-only vs `0.4` cross-aisle-via-`crossZ`, but `pause` on path-end drops to `rand(0,1.0)` (vs shipped `rand(1.2,4)`), so it keeps moving.
```
Sequence(SPEED-SHOPPER):
  if !path → newPath()
  advance(step = min(dist, rand(1.15,1.3)·dt))
  on arrive-final: 45% → newPath immediately; else pause rand(0,1.0)
  on pass camera <1.2m → emit bark tag=pass.near
```
*Spawn:* 2–10 depending on density (§17.6), `x = pick(corridors.xs)`, `z = rand(zMin+1, zMax−1)`. The obstruction workhorse of Rush Hour (Ch. 3 Shift #2), which doubles their alley density at z ≈ 8.

**2 · Browser.** Shipped exactly: `speed 0`, `pause Infinity`, offset `±1.05 m` off an aisle `x` (`pick(corridors.browseXs)`), `z = rand(-9,3)`, `yaw = ±π/2` facing the shelf, red basket `BoxGeometry(0.42,0.22,0.3)` colour `0xc9241a` set on the floor `0.5 m` to their side.
```
Sequence(BROWSER):
  hold post; every rand(4,8)s → side-step ±0.35m lateral, re-face shelf
  every rand(6,12)s → emit bark tag=browse.shelf
  (never enters path/pause logic — continue in the loop as shipped)
```
*Spawn:* 0–4, always at `browseXs`. Two are guaranteed present in `normal`+ density (the shipped `i >= count-2` browsers).

**3 · Parent (+Child pair).** Parent moves like a slow Speed-Shopper but with wide pauses (`rand(1.5,4)`) and a 60% chance of pushing a cart (offset `0.78 m` along yaw, `rotation.y = yaw − π/2`, handle toward shopper — shipped cart-trail math). It owns a Child.
```
Sequence(PARENT):
  advance/pause as a slow walker (turn 2.2)
  if child.dist > 2.0 → set pause = max(pause,1.2); emit bark tag=parent.corral
  else 8% per pause → emit bark tag=parent.corral (soft)
```
*Spawn as a unit:* one Parent + one Child, only in `normal`+ scenarios that permit kids (Noon Rush: 2 pairs; Kids' Birthday Sweep, Ch. 3 #6). If the Child model fails casting (§17.7), the pair degrades to a lone Parent.

**4 · Child.** New `leash_follow` leaf — the only genuinely new locomotion:
```
leash_follow(parent, r=1.4, snap=2.0):
  target = parent.pos + offset(orbit angle θ, radius rand(0.6,1.4))
  θ += rand(-1,1)·2·dt                       // wander orbit
  if dist(self,parent) > snap → speed = 1.10 (dart), steer straight to parent
  else                        → speed = 0.5·parent.speed, drift on orbit
  every rand(5,9)s while close → emit bark tag=kid.demand
```
Height `1.24` (autoscale + relaxed sanity gate `span.h > 0.95`), blob `0.30`. A Child **cannot push a cart** but **can ride** one narratively (bark only). *Spawn:* only paired with a Parent.

**5 · Elderly.** A re-skin of an adult avatar (no distinct model — see §17.7), height `1.68`, half turn-rate (`1.5`), long pauses, always pushes a cart, and blocks aisles "realistically." No new leaf; it is the slow end of the walker.
```
Sequence(ELDERLY):
  advance(step = min(dist, rand(0.55,0.7)·dt)); turn clamp ±1.5·dt
  on arrive: pause rand(2,5); 30% → emit bark tag=elderly.idle
```
*Spawn:* 0–2; centrepiece of Elderly Assist Escort (Ch. 3 #7), where the escort variant sets `follow_player` at walk speed and fails the Shift if the player sprints > 2 s.

**6 · Influencer.** `speed 0`, new `pan_yaw` leaf simulating a phone-to-shelf recording:
```
pan_yaw():
  yaw = yaw0 + 0.6·sin(t·0.7)             // slow ±0.6 rad sweep
  every rand(6,10)s → pick new endcap/produce spot; walk there at 1.0; resume pan
  every rand(8,?)s while panning → emit bark tag=influencer.record (priority 3)
```
*Spawn:* exactly 1 in Noon Rush and Sample Day (Ch. 3 #14), parked at an endcap or the produce corner (−17.7, 10.7) to clot a crowd.

**7 · Security Guard.** New `patrol_loop` over the four store corners (reusing `world.bounds` corners inset 1.5 m and the `corridors.crossZ` mid-lanes as through-points):
```
patrol_loop(waypoints[4]):
  walk to next waypoint at 0.9–1.05
  on arrive → face-scan: idle 3.0s, slow yaw sweep ±0.4 rad
  advance index (mod 4); loop forever
  react_to_incident overrides: paths TO the tip (not away), R_react = 12m
```
The Guard is the one mobile that **converges on chaos** rather than fleeing it. *Spawn:* 1 in Noon Rush and Night Chaos; the "inspector" of Health Inspector Visit (Ch. 3 #5) is this archetype re-skinned to the Pharmacist body with an 8 m violation radius.

**8 · Manager.** Tours `world.staffSpots` in sequence with a clipboard idle:
```
Sequence(MANAGER):
  walk to next staffSpot at 0.85–1.0
  on arrive → pause 4.0 (clipboard idle); 25% → enqueue a PA line (Ch.18)
  advance to next spot; loop
```
*Spawn:* 1 in Dawn Delivery, Noon Rush, and any Career Rank ≥ 3 Shift. Only the Manager and the automated timer are allowed to enqueue PA pages.

**9 · Stocker.** Posted at an endcap with a restock crate, occasionally relocating:
```
Sequence(STOCKER):
  hold post; play "reach-to-shelf" idle (arm raise, reuse idle clip, no new anim)
  every rand(8,14)s → walk to an adjacent endcap/shelf at 0.8, resume
  8% per relocate → emit bark tag=stocker.line
  react_to_incident: R_react = 6m → walk to spill, play reach idle (implies cleanup)
```
*Spawn:* 1–2; 2 in Dawn Delivery (with the Manager) where pallets are out (Ch. 15 Dawn rig).

**10 · Cashier.** Fully static, `speed 0`, `turn 0`, at the two staffed lanes (`x` in −10.5..−1, `z 10.6`). Faces the belt. Reacts to nothing (behind the register); the only mobile response is the shipped `home` drift if somehow displaced.
```
Sequence(CASHIER):
  hold at register; idle loop
  on player inside checkout ring → emit bark tag=cashier.line (priority 4)
  on complete() → emit bark tag=checkout.done via toast (priority 6)
```
*Spawn:* 2 always (both staffed lanes); lane 6 stays closed and unstaffed (red ✕), consistent with the world build.

**11 · Pharmacist.** Static behind the counter (18.5, 10.4) with a small counter-facing yaw (`turn 1.2` to pivot toward an approaching player).
```
Sequence(PHARMACIST):
  hold at counter; on player within 3m → face player; emit bark tag=pharmacist.line
```
*Spawn:* 1 always. Doubles as the donor body for the Guard/Inspector re-skin.

**12 · Cart-Wrangler.** Exterior only (Ch. 15). Pushes a nested cart-train (short instanced row) on a fixed 3-waypoint loop between the corral and the doors, reusing the walker mover with a hard-coded path.
```
Sequence(CART-WRANGLER):
  cycle 3 waypoints [corral → mid-lot → doors → corral] at 1.0–1.15
  triggers auto-doors on door-proximity (extend world.update door logic to NPCs)
  10% per lap → emit bark tag=wrangler.line
```
*Spawn:* 1–2 in every scenario that renders the lot; never counts against interior density.

**12b · Janitor.** The debris responder — the archetype that makes Cleanup Crew (Ch. 3 #17) and Health Inspector (#5) legible. New `seek_and_reshelve` leaf built on the shipped `removeDebris(mesh)`:
```
seek_and_reshelve():
  target = nearest resting debris within 3m (query physics.debrisMeshes)
  walk to it at 0.75–0.9; on arrive → play mop/pickup idle 1.2s →
    physics.removeDebris(target); reverse-fly the mesh to nearest shelf (reuse flyer)
  if no debris in range → patrol wet-cone zones at 0.8; 8% → bark tag=janitor.line
```
*Spawn:* 0–1; forced to 1 in any littered scenario. Its cleanup is cosmetic-plus: it slowly reduces on-floor clutter so a long run doesn't accrete debris past the `DEBRIS_CAP = 100` ceiling faster than the `28 s` TTL clears it.

### 17.5 Interaction-response matrix

Rows are archetypes; columns are the physics events they can receive. **Bump** is the shipped uniform response (radius `0.66 m`, `rel > 0.6`, `shove {vx,vz = n̂·min(rel,4)·1.1, t:0.55}`, `shoveCd 1.3 s`, `addShake 0.22`, `SFX.thud`, bump bark; non-browsing/moving actors also get `pause = max(pause,1.0)`). Deviations and the **[BUILD]** tip/debris reactions:

| Archetype | Bump reaction | Aisle-tip within `R_react` | Debris in path | Cart casualty nearby |
|---|---|---|---|---|
| Speed-Shopper | shipped + `bump.player` bark | `R_react 6 m`: recoil-shove **away** from pivot 1.5 m, `pause 1.5`, `crash.witness` bark | step-around: 0.4 m lateral offset, resume | flinch, `crash.witness` bark (30%) |
| Browser | shipped (no pause change — stays `∞`) | `6 m`: turn to face, `crash.witness` bark, no move | n/a (static) | turn+bark (20%) |
| Parent | shipped; also pulls Child (`snap`) | `6 m`: recoil + corral Child, `crash.witness` | step-around; Child auto-follows | bark + shield Child |
| Child | shipped; lighter mass → `shove·1.3` | `6 m`: dart to Parent, `kid.demand` scared line | step-around, may `kick` (rolling class, Ch. 16) | dart to Parent |
| Elderly | shipped; `pause` bumped to `2.5` | `8 m` (jumpy): recoil 1.0 m, `pause 3`, `elderly.idle` | slow step-around 0.3 m | startle, `pause 2` |
| Influencer | shipped; **keeps filming** — `influencer.record` "was that recording?" | `8 m`: *turns toward* tip and films, `influencer.record` | ignores (in frame) | films it |
| Security Guard | shipped; then **switches to converge** | `12 m`: abandons patrol, paths to tip, `guard.patrol` bark | walks over (authority) | converges + `guard.patrol` |
| Manager | shipped; enqueues a PA page | `12 m`: paths to tip, enqueues "cleanup" PA (Ch. 18) | walks toward | PA page |
| Stocker | shipped; `home` drift back to endcap | `6 m`: walks to spill, reach-idle (cleanup implied) | seeks & reach-idles | walks to it |
| Cashier | shipped `home` drift only (rarely reached) | none (behind register) | none | `crash.witness` (10%) |
| Pharmacist | shipped `home` drift | none | none | none |
| Cart-Wrangler | shipped (exterior) | n/a (interior event) | steps around lot debris | n/a |
| Janitor | shipped; resumes seek | `4 m`: **beelines** to the spill center, `janitor.line` | its whole job — seeks | walks to it |

`react_to_incident` (substrate step 7) is fed by a single event bus (Ch. 20): `physics.tipGondola` and the cart-tip branch already fire `toast()`; we add an `emit('incident', {x, z, kind})` alongside the existing `SFX.crash()`/`addShake(0.9)` so NPCs can subscribe without `physics.js` knowing about them. Recoil-shove reuses the shipped `n.shove` structure verbatim, so no new integrator.

### 17.6 The Crowd Director

One module (`crowd.js`, Ch. 19) owns *how many* NPCs are active and *where*. All 16–20 avatars stay **loaded and pooled**; the Director toggles an `active` flag and re-homes inactive ones off-screen — mesh count never changes at runtime, only skinning work (gated by the LOD in §17.9).

**Density presets** (shipped names `empty/light/normal/rush` from §1.7, extended):

| Preset | Speed-Shoppers | Browsers | Parent+Child | Elderly | Cart-pushers | Influencer | Guard | Staff (posted) | Janitor |
|---|---|---|---|---|---|---|---|---|---|
| `empty` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 (idle) | 0 |
| `light` | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 5 | 0 |
| `normal` | 4 | 2 | 0 | 1 | 1 | 0 | 0 | 5 | 0 |
| `rush` | 6 | 4 | 2 | 1 | 4 | 1 | 1 | 5 | 1 |

**Per-mode density curves** (Ch. 2 modes). `t` is run seconds:

| Mode | Curve | Notes |
|---|---|---|
| Zen Shopping | `light`, static | camera-shake off, no PA pages |
| Classic Dash | `normal`, static | the default |
| Time Attack — Sprint | `light` | grocery only |
| Time Attack — Circuit | `normal` | both halves |
| Time Attack — Marathon | `rush` | forces the four corners |
| Chaos Mode | `rush` (+ Janitor **off** so debris accretes) | targets for mayhem |
| Daily Run | scenario-seeded (below), deterministic | seeded spawns worldwide |
| Endless (Register Rush) | `walkers(list) = clamp(2 + floor((list−1)/3), 2, 8)`; +1 browser every 4th list; cart-pushers = `floor(walkers/3)` | ramp *is* the curve |
| Career Rank 1→5 | `empty → light → normal → normal → rush` | matches §1.7 list scaling |

**Per-scenario overrides** (Ch. 3 / Ch. 15 lighting rigs), extending the §5 table:

| Scenario | Walkers | Browsers | Pushers | Kids | Staff | Special active count |
|---|---|---|---|---|---|---|
| Dawn Delivery (06:00) | 2 | 0 | 0 | 0 | 2 (stocker, manager) | +1 delivery driver (Ch. 15) |
| Noon Rush (12:00) | 10 | 4 | 4 | 2 pairs | 5 | +1 influencer, +1 guard, +1 janitor |
| Night Chaos (22:00) | 5 | 2 | 2 | 0 | 3 | +1 guard |
| Rush Hour (#2) | 6→10 warmup over 20 s | 4 | 2 | 1 | 5 | alley (z ≈ 8) density ×2; player bump costs **0.8 s self-stagger** |
| Black Friday (#3) | 8 | 2 | 2 | 1 | 5 | walkers path to endcaps and **deplete** `availableSpecs()` (Ch. 16) |
| Sample Day (#14) | 6 | 2 (clotted at cart) | 2 | 1 | 5 | +1 influencer parks the alley cart |
| Elderly Assist (#7) | 3 | 1 | 0 | 0 | 5 | +1 elderly escort (follows player, walk-only) |

**Spawn / despawn choreography.** No NPC ever pops into or out of existence in view:
- **Activate:** an inactive avatar is re-homed to a **spawn portal** — the EMPLOYEES ONLY door (staff/janitor/stocker), the front sliding doors (shoppers arriving on foot), or a parked car in the lot (Ch. 15 arriving-shopper, walks the crosswalk at z-front + 5.2, triggers auto-doors). It fades its `active` flag on the far side of the portal and walks in.
- **Warmup:** density ramps (Rush Hour, Endless) add walkers **one per 1.5–3 s** from the front doors, never as an instant batch, so the crowd "fills up."
- **Deactivate:** the Director routes the NPC to the nearest portal, and only flips `active=false` once it is past the door plane and > 24 m from camera (already frozen by LOD). If the player is blocking the only exit, the NPC idles at a staffSpot instead of teleporting.
- **Determinism [BUILD]:** for Daily Run and Time Attack, spawn positions, archetype assignment, and every `newPath()` decision draw from the **run's seeded LCG** (`seed = (seed·16807) mod 2147483647`) — *not* `Math.random()` as shipped — so the crowd, and therefore stock depletion in Black Friday, is bit-identical worldwide (Ch. 5). The seed is consumed in a fixed order (spawn → paths → pauses); barks are explicitly excluded from this stream.

**Congestion avoidance [BUILD].** The shipped mover has cart-cart and player-cart separation but **no NPC-NPC avoidance**. We add three cheap layers, all O(n) with a 1.5 m-cell spatial hash rebuilt per tick (n ≤ 24 → negligible, Ch. 21):
1. **Local separation.** For each walker, sum repulsion from neighbours within `R_sep = 0.9 m`: `push += ((0.9 − d)/0.9) · n̂`, weight `1.4`, applied as a lateral velocity nudge clamped to `0.6 m/s`. Prevents clumping without a full boids flock.
2. **Player yield.** Walkers within `1.5 m` of the camera *and* facing toward it cut speed 40% and steer `0.4 m` laterally, so the crowd visibly parts for a sprinting player — serving pillar 3 "readable at a sprint" (Ch. 9) rather than becoming a wall.
3. **Intersection tokens.** Each `crossZ` junction node (radius `1.0 m`) holds a capacity of **2**; a third arriving walker pauses `rand(0.3,0.8) s`. This keeps the action alley at z ≈ 8 flowing as a *current* — in Rush, even-indexed walkers bias +x, odd bias −x — instead of a gridlocked mosh.

### 17.7 Cast plan — Rocketbox casting & expansion

The shipped cast is 6 adults on the 3ds-Max **Biped** rig (`Bip01_*` bones), driven by the donor Soldier clips through `BIP_TO_MIXAMO` and `bakeRetarget()`. Because the retargeter is rig-generic, expansion is a load-weight decision, not an engineering one. **Committed target: 18 avatars.**

| Slot | Rocketbox avatar | Status | Primary archetype casting |
|---|---|---|---|
| 1 | `Female_Adult_01` | shipped | Speed-Shopper, Cashier |
| 2 | `Female_Adult_08` | shipped | Browser, Parent |
| 3 | `Female_Adult_12` | shipped | Elderly (re-skin), Manager |
| 4 | `Male_Adult_01` | shipped | Speed-Shopper, Guard |
| 5 | `Male_Adult_04` | shipped | Stocker, Cart-Wrangler |
| 6 | `Male_Adult_08` | shipped | Pharmacist, Janitor |
| 7 | `Female_Adult_02` | **[BUILD]** | Browser, Influencer |
| 8 | `Female_Adult_03` | **[BUILD]** | Speed-Shopper |
| 9 | `Female_Adult_05` | **[BUILD]** | Parent, Cashier |
| 10 | `Female_Adult_06` | **[BUILD]** | Speed-Shopper, Browser |
| 11 | `Female_Adult_10` | **[BUILD]** | Elderly (re-skin) |
| 12 | `Male_Adult_02` | **[BUILD]** | Speed-Shopper, Manager |
| 13 | `Male_Adult_05` | **[BUILD]** | Guard, Cart-Wrangler |
| 14 | `Male_Adult_06` | **[BUILD]** | Stocker, Janitor |
| 15 | `Male_Adult_07` | **[BUILD]** | Speed-Shopper |
| 16 | `Male_Adult_10` | **[BUILD]** | Elderly (re-skin), Parent |
| 17 | `Female_Child_01` | **[BUILD, gated]** | Child |
| 18 | `Male_Child_01` | **[BUILD, gated]** | Child |

**Notes on the mapping.** *Elderly* and *Guard/Inspector* are **re-skins, not new models** — an adult avatar at height `1.68` (elderly) or the pharmacist body under guard behavior — so 16 adult FBX + 2 child FBX cover all twelve archetypes. Variety is multiplied for free by the shipped per-instance scale jitter `rand(0.96,1.04)` and a **[BUILD] per-instance body-tint pass** (multiply the body material `color` by a subtle hue), which makes one jacket read as five. Every new avatar runs the `scripts/fetch-models`-style TGA → 1024-JPG resize so total people-texture weight stays web-sane, and every retarget must pass the existing `retargetIsSane` gate (`span.h 1.15–2.3`, head `1.25–2.1`); the gate stays as the automatic reject for any bad bake.

**Child height & sanity change.** Children require `TARGET_H` to become per-archetype (`adult 1.74`, `elderly 1.68`, `child 1.24`) and the sanity floor relaxed to `span.h > 0.95`. The autoscale (`fbx.scale = TARGET_H / boneSpan.h`) then handles the proportion automatically.

**⚠ Child-model licensing check (required before slots 17–18 ship).** `microsoft/Microsoft-Rocketbox` is released under **MIT** covering the full avatar set including children, but the child avatars carry an added likeness/model-release sensitivity that MIT does not itself address. **Action:** before adding `Female_Child_01`/`Male_Child_01`, confirm (a) the child FBX are in-scope of the repo's `LICENSE`, (b) no separate per-model release file restricts them, and (c) `CREDITS.md` records each child asset's source + license line the same way the adult avatars are logged. If any child model is flagged or fails the gate, **fall back to a scaled-down adult** (`height 1.24`, Child behavior) as a stand-in — the autoscale already supports it, and the Parent+Child pair degrades gracefully to a lone Parent (§17.4) if children are cut entirely. This risk is tracked in Ch. 26.

Debug hooks (Ch. 23) expose the cast: `window.__cast` (accepted avatar names), `window.__retargetLog` (per-avatar bake result), and `window.__npcs` (live array) so the crowd is verifiable headlessly, never by assumption.

### 17.8 The bark library (119 lines)

Delivery per §17.1. **Arbitration:** when two barks contend, higher **Priority** wins; ties break to the NPC nearest the camera. A fired bark sets a **per-category cooldown** (the max of its own row's cooldown and 3 s) so a pool never repeats back-to-back; player-caused **toast** lines (bump / cart / knock / checkout / cleanup) bypass the ≤2-bubble cap because they own the single `#toast` node. Shipped lines are marked (S) and their text is verbatim from `physics.js` (the code wraps bump/crash lines in literal quotes; the quotes are presentation, stripped here).

| ID | Text | Trigger tag | Archetype filter | CD (s) | Pri |
|---|---|---|---|---|---|
| BK-BUMP-01 | Hey, watch it! (S) | bump.player | ANY | 4 | 6 |
| BK-BUMP-02 | Excuse YOU. (S) | bump.player | ANY | 4 | 6 |
| BK-BUMP-03 | Seriously?! (S) | bump.player | ANY | 4 | 6 |
| BK-BUMP-04 | Ow! My cart! (S) | bump.player | pushes-cart | 4 | 6 |
| BK-BUMP-05 | Careful, buddy! (S) | bump.player | ANY | 4 | 6 |
| BK-BUMP-06 | Walkin' here! | bump.player | Speed-Shopper | 4 | 6 |
| BK-BUMP-07 | Do you mind? | bump.player | ANY | 4 | 6 |
| BK-BUMP-08 | Rude much? | bump.player | Influencer,Child | 4 | 6 |
| BK-BUMP-09 | Hey—HEY. | bump.player | ANY | 4 | 6 |
| BK-BUMP-10 | That's a paddlin'. | bump.player | Elderly,Manager | 6 | 6 |
| BK-BUMP-11 | Okay, now you're just doing it. | bump.repeat | ANY | 8 | 7 |
| BK-BUMP-12 | I'm telling a manager. | bump.repeat | ANY | 8 | 7 |
| BK-BUMP-13 | What is WRONG with you? | bump.repeat | ANY | 8 | 7 |
| BK-BUMP-14 | Personal space! Ever heard of it? | bump.repeat | ANY | 8 | 7 |
| BK-PASS-01 | 'Scuse me. | pass.near | mobile | 6 | 3 |
| BK-PASS-02 | Comin' through. | pass.near | mobile,pushes-cart | 6 | 3 |
| BK-PASS-03 | Pardon. | pass.near | Elderly,Manager | 6 | 3 |
| BK-PASS-04 | Behind you. | pass.near | Stocker,Cart-Wrangler | 6 | 3 |
| BK-PASS-05 | Sorry, sorry. | pass.near | Speed-Shopper | 6 | 3 |
| BK-CART-01 | 🛒 CRUNCH. (S) | cart.tip | — (toast) | 5 | 7 |
| BK-CART-02 | 🛒 That's coming out of your deposit. (S) | cart.tip | — (toast) | 5 | 7 |
| BK-CART-03 | 🛒 Cart casualty. (S) | cart.tip | — (toast) | 5 | 7 |
| BK-CART-04 | 🛒 Ten points. | cart.tip | — (toast) | 5 | 7 |
| BK-CART-05 | 🛒 Aisle's closed now, I guess. | cart.tip | — (toast) | 5 | 7 |
| BK-KNOCK-01 | Whoops — that's going on your bill. (S) | knock.items | — (toast) | 5 | 6 |
| BK-KNOCK-02 | Butterfingers. | knock.items | — (toast) | 5 | 6 |
| BK-KNOCK-03 | You break it, you buy it. | knock.items | — (toast) | 5 | 6 |
| BK-KNOCK-04 | Clean-up in progress… | knock.items | — (toast) | 5 | 6 |
| BK-KNOCK-05 | 40% of retail, by the way. | knock.items | — (toast) | 7 | 6 |
| BK-CRASHW-01 | Did you SEE that?! | crash.witness | mobile | 8 | 8 |
| BK-CRASHW-02 | Somebody call a manager. | crash.witness | ANY | 8 | 8 |
| BK-CRASHW-03 | My groceries! | crash.witness | pushes-cart | 8 | 8 |
| BK-CRASHW-04 | Ten-second rule? | crash.witness | Child,Speed-Shopper | 8 | 8 |
| BK-CRASHW-05 | Whoa—whoa—WHOA. | crash.witness | ANY | 8 | 8 |
| BK-CRASHW-06 | That's… a lot of cereal. | crash.witness | ANY | 8 | 8 |
| BK-CRASHW-07 | I'm filming this. | crash.witness | Influencer | 8 | 8 |
| BK-AMB-01 | Where's the almond milk… | ambient.idle | mobile | 12 | 2 |
| BK-AMB-02 | We're out of coffee again. | ambient.idle | mobile | 12 | 2 |
| BK-AMB-03 | Was it aisle 3 or 4? | ambient.idle | mobile | 12 | 2 |
| BK-AMB-04 | $6 for THIS? | ambient.idle | mobile | 12 | 2 |
| BK-AMB-05 | I had a coupon somewhere. | ambient.idle | mobile | 12 | 2 |
| BK-AMB-06 | Do we need eggs? | ambient.idle | Parent,mobile | 12 | 2 |
| BK-AMB-07 | Parking was a nightmare. | ambient.idle | mobile | 12 | 2 |
| BK-AMB-08 | This list makes no sense. | ambient.idle | mobile | 12 | 2 |
| BK-AMB-09 | Ooh, that's on sale. | ambient.idle | mobile | 12 | 2 |
| BK-AMB-10 | I always forget something. | ambient.idle | mobile | 12 | 2 |
| BK-BRO-01 | Hmm, or the blue one? | browse.shelf | Browser | 10 | 2 |
| BK-BRO-02 | Is this the good kind? | browse.shelf | Browser | 10 | 2 |
| BK-BRO-03 | Two-for-five, not bad. | browse.shelf | Browser | 10 | 2 |
| BK-BRO-04 | Reading the ingredients… | browse.shelf | Browser | 10 | 2 |
| BK-BRO-05 | Do I need this? …Yes. | browse.shelf | Browser | 10 | 2 |
| BK-BRO-06 | Back it goes. | browse.shelf | Browser | 10 | 2 |
| BK-INF-01 | …and THAT'S how you meal-prep. | influencer.record | Influencer | 8 | 3 |
| BK-INF-02 | Link in bio, fam. | influencer.record | Influencer | 8 | 3 |
| BK-INF-03 | Smash that follow. | influencer.record | Influencer | 8 | 3 |
| BK-INF-04 | Grocery haul, part four! | influencer.record | Influencer | 8 | 3 |
| BK-INF-05 | This lighting is everything. | influencer.record | Influencer | 8 | 3 |
| BK-INF-06 | Wait, was that recording? | influencer.record | Influencer | 8 | 3 |
| BK-KID-01 | Can we get the cereal? PLEASE. | kid.demand | Child | 7 | 4 |
| BK-KID-02 | I want the red one! | kid.demand | Child | 7 | 4 |
| BK-KID-03 | Are we done YET? | kid.demand | Child | 7 | 4 |
| BK-KID-04 | Mom. Mom. MOM. | kid.demand | Child | 7 | 4 |
| BK-KID-05 | Can I push the cart? | kid.demand | Child | 7 | 4 |
| BK-KID-06 | I'm gonna ride in it. | kid.demand | Child | 7 | 4 |
| BK-PAR-01 | Stay where I can see you. | parent.corral | Parent | 6 | 5 |
| BK-PAR-02 | Put that back. | parent.corral | Parent | 6 | 5 |
| BK-PAR-03 | We are NOT buying that. | parent.corral | Parent | 6 | 5 |
| BK-PAR-04 | Hold my hand, please. | parent.corral | Parent | 6 | 5 |
| BK-STF-01 | Find everything okay? | staff.greet | Stocker,Cashier,Manager | 10 | 4 |
| BK-STF-02 | Register two's open. | staff.greet | Cashier,Manager | 10 | 4 |
| BK-STF-03 | Cleanup's on it. | staff.greet | Stocker,Janitor,Manager | 10 | 4 |
| BK-STF-04 | Fresh batch just came out. | staff.greet | Stocker | 10 | 4 |
| BK-STF-05 | Prescription's ready. | staff.greet | Pharmacist | 10 | 4 |
| BK-STF-06 | Need a hand with that? | staff.greet | Stocker,Cashier | 10 | 4 |
| BK-ELD-01 | In my day this was a nickel. | elderly.idle | Elderly | 12 | 2 |
| BK-ELD-02 | Slow down, dear. | elderly.idle | Elderly | 12 | 2 |
| BK-ELD-03 | Where'd they move the bread? | elderly.idle | Elderly | 12 | 2 |
| BK-ELD-04 | Lovely weather, isn't it. | elderly.idle | Elderly | 12 | 2 |
| BK-CSH-01 | Did you find everything? | cashier.line | Cashier | 9 | 4 |
| BK-CSH-02 | Paper or plastic? | cashier.line | Cashier | 9 | 4 |
| BK-CSH-03 | That'll be… a lot. | cashier.line | Cashier | 9 | 4 |
| BK-CSH-04 | Have your rewards card? | cashier.line | Cashier | 9 | 4 |
| BK-CSH-05 | Next in line! | cashier.line | Cashier | 9 | 4 |
| BK-PHR-01 | Pickup or drop-off? | pharmacist.line | Pharmacist | 10 | 4 |
| BK-PHR-02 | Take with food. | pharmacist.line | Pharmacist | 10 | 4 |
| BK-PHR-03 | Any allergies I should know? | pharmacist.line | Pharmacist | 10 | 4 |
| BK-PHR-04 | That's ready whenever. | pharmacist.line | Pharmacist | 10 | 4 |
| BK-STK-01 | Careful, wet paint— kidding. | stocker.line | Stocker | 9 | 3 |
| BK-STK-02 | Fresh stock, coming through. | stocker.line | Stocker | 9 | 3 |
| BK-STK-03 | It's on the top shelf. | stocker.line | Stocker | 9 | 3 |
| BK-STK-04 | We just got those in. | stocker.line | Stocker | 9 | 3 |
| BK-STK-05 | Mind the pallet. | stocker.line | Stocker | 9 | 3 |
| BK-JAN-01 | Watch your step, floor's wet. | janitor.line | Janitor | 9 | 3 |
| BK-JAN-02 | I just mopped that. | janitor.line | Janitor | 9 | 3 |
| BK-JAN-03 | Every single day with this. | janitor.line | Janitor | 9 | 3 |
| BK-JAN-04 | Cone's there for a reason. | janitor.line | Janitor | 9 | 3 |
| BK-JAN-05 | Third spill this hour. | janitor.line | Janitor | 9 | 3 |
| BK-GRD-01 | Keep it moving, folks. | guard.patrol | Guard | 8 | 5 |
| BK-GRD-02 | I've got my eye on you. | guard.patrol | Guard | 8 | 5 |
| BK-GRD-03 | No running in the store. | guard.patrol | Guard | 8 | 5 |
| BK-GRD-04 | Everything alright here? | guard.patrol | Guard | 8 | 5 |
| BK-GRD-05 | That's coming out of somebody's paycheck. | guard.patrol | Guard | 8 | 5 |
| BK-WRG-01 | Comin' through with the train. | wrangler.line | Cart-Wrangler | 10 | 3 |
| BK-WRG-02 | Thirty carts and counting. | wrangler.line | Cart-Wrangler | 10 | 3 |
| BK-WRG-03 | Watch the wheel stop. | wrangler.line | Cart-Wrangler | 10 | 3 |
| BK-WRG-04 | Lot's packed today. | wrangler.line | Cart-Wrangler | 10 | 3 |
| BK-MGR-01 | Let's tighten up lane three. | manager.floor | Manager | 12 | 5 |
| BK-MGR-02 | Who's on aisle recovery? | manager.floor | Manager | 12 | 5 |
| BK-MGR-03 | Looking good, team. | manager.floor | Manager | 12 | 5 |
| BK-MGR-04 | I'll page maintenance. | manager.floor | Manager | 12 | 5 |
| BK-CHK-01 | Thanks for shopping with us! | checkout.done | Cashier (toast) | — | 6 |
| BK-CHK-02 | Have a great one. | checkout.done | Cashier (toast) | — | 6 |
| BK-CHK-03 | See you next time. | checkout.done | Cashier (toast) | — | 6 |
| BK-WTH-01 | Coming down out there. | weather.rain | mobile,Cart-Wrangler | 15 | 2 |
| BK-WTH-02 | Grab an umbrella by the door. | weather.rain | Cashier,Manager | 15 | 2 |
| BK-SEA-01 | Happy Halloween! | season.event | ANY | 15 | 2 |
| BK-SEA-02 | Merry Christmas, folks. | season.event | Staff | 15 | 2 |
| BK-SEA-03 | Turkey's on sale, obviously. | season.event | mobile | 15 | 2 |
| BK-SEA-04 | Fireworks are aisle 9. | season.event | Stocker,Manager | 15 | 2 |

**Filter legend:** `ANY` = every archetype; `mobile` = any non-posted walker (Speed-Shopper, Parent, Elderly, Speed variants); `pushes-cart` = Parent(60%), Elderly, Cart-Wrangler; `Staff` = Stocker/Cashier/Pharmacist/Manager/Janitor. The dynamic **cleanup PA** ("📢 CLEANUP ON AISLE {g.label} — ALL OF IT.", shipped from `tipGondola`) is **not** in this table — it is a PA-voice line (Ch. 18), routed from the same `g.label` (1–8) that fires the shipped `toast()`. Seasonal pools (`BK-SEA-*`, and `weather.rain`) swap in per Ch. 15's overlay calendar.

### 17.9 Performance, determinism & test hooks

The crowd must not break the worst-view budget (≤ 1,000 draws / ≤ 1.4 M tris / ≥ 30 fps foreground on the lite tier, Ch. 21). Governing rules:
- **Frustum culling re-enabled.** `dressAvatar` currently forces `frustumCulled = false` on every mesh — fine at 6 people, wasteful at 24. Production restores culling so off-screen avatars skip skinning.
- **Update-rate LOD.** NPCs beyond ~14 m tick `mixer.update` at **15 Hz** (accumulate `dt`, update on threshold); beyond ~24 m they **freeze on their current idle pose** and skip the mixer entirely. Posted staff inside their zone always tick full-rate. This is what makes Noon Rush's 18–24-strong crowd survivable on an iGPU.
- **Shared assets.** All NPCs share one blob-shadow geometry+material (`blobGeo`/`blobMat`, `CircleGeometry(1,24)` + one canvas radial-gradient texture) and cast **no** real shadows (maps freeze after frame 3). Speech-bubble planes share one additive material; the bubble canvas is redrawn only on text change, never per-frame.
- **Determinism.** As in §17.6, seeded modes route all crowd RNG through the LCG; barks stay on `Math.random()` and are excluded from the seed stream. The seeded-vs-cosmetic split is the same discipline the store stocking already follows.
- **Verification (Ch. 23).** Empirical, never assumed: `window.__cast`, `window.__retargetLog`, `window.__npcs`, plus a headless "crowd battery" that spawns each density preset, steps `update(dt)` for N frames, and asserts (a) no NPC leaves `world.bounds`, (b) every active avatar passed `retargetIsSane`, (c) bubble concurrency never exceeds 2, and (d) the framebuffer-grid spawn-view stays inside the draw/tri budget with `rush` active. Any PR that regresses that battery fails.

**Files this chapter governs:** `src/characters.js` (mover, retargeter, archetype params, spawn), new `src/crowd.js` (Director, density, choreography, avoidance), `src/physics.js` (bump/tip/cart events + the `emit('incident')` hook), `src/pa.js` (PA cleanup routing, Ch. 18), and the archetype/bark data blocks in `data/archetypes.json` + `data/barks.json` (schemas in Ch. 20).



# Chapter 18 — Audio — Complete Design

The shipped build ships one file — `src/sfx.js` — containing a single master `GainNode` (linear `0.45`), a 2-second looped white-noise "store hum" (lowpass 240 Hz, gain `0.018`), two synthesis primitives (`tone`, `noise`), and eight cues (`grab`, `tick`, `listDone`, `checkout`, `error`, `thud`, `crash`, `clatter`). Everything routes flat into `master → destination`; `M` toggles mute by zeroing the master; `SFX.start()` is armed from the pointer-lock / fallback-look gesture. Barks and pages are currently on-screen text toasts (`BUMP_LINES`, `CRASH_LINES`, the `CLEANUP ON AISLE {N}` toast). This chapter is the complete audio design that **extends that graph without contradicting a single shipped value**: every existing cue keeps its exact parameters and becomes a row in a larger inventory; the flat master fans out into six buses inserted *between* the cue sources and the shipped master trim; the text toasts gain a synthesized PA/bark voice layer. No files, no backend, no worklets that an Intel iGPU can't schedule — 100% WebAudio node graph, procedural, deterministic. See Ch. 19 for the module boundary and Ch. 21 for the frame budget this shares.

### 18.1 Design philosophy and hard constraints

| Constraint | Consequence for audio |
|---|---|
| Browser, no backend (default) | No streamed/`fetch`ed audio files. Every sound is synthesized from `OscillatorNode` + `AudioBufferSourceNode` noise + `BiquadFilterNode`. Backend is optional+additive: a later CDN could swap in sampled one-shots behind the same cue IDs, never required. |
| Intel-iGPU floor | Audio runs on the audio thread, not the GPU — but the main thread schedules it. Hard cap of **24 simultaneous voices**, amortized bed crossfades (mirrors `SPAWNS_PER_FRAME = 9` in `physics.js`), no `AudioWorklet` DSP (fallback to native nodes). |
| Gesture-gated `AudioContext` | `start()` stays hooked to `controls 'lock'` and `enableFallback()` exactly as shipped. The context is created lazily in `ensure()`; nothing plays before first user gesture. |
| Determinism | Randomized cues reuse the world LCG `seed → seed*16807 % 2147483647`, so a replay/seed produces the identical soundscape (needed for Ch. 23 golden tests). |
| Shipped loudness is law | Master trim stays `0.45` linear (**−6.94 dBFS**). Bus levels below are defined so the SFX bus at unity reproduces today's mix bit-for-bit. |

Formula used throughout: `linear = 10^(dB/20)`, `dB = 20·log10(linear)`. Worked: `0.45 → 20·log10(0.45) = −6.94 dB`; `0.018 → −34.9 dB`; `0.25 → −12.04 dB`.

### 18.2 Signal graph and bus architecture

The v1 flat graph (`source → master → destination`) becomes a two-tier tree. Six **sub-buses** sit between cues and the shipped master `GainNode`; a brick-wall limiter is inserted after the master trim so stacked cues (a sprint-crash spilling 56 items) can never clip `destination`.

```
[cue voices] → SFX_bus  ─┐
[UI voices]  → UI_bus    ─┤
[beds]       → AMB_bus   ─┼→ MASTER_gain(0.45) → LIMITER → destination
[pages]      → PA_bus    ─┤
[muzak]      → MUSIC_bus  ┘
                (each sub-bus = GainNode, optional post-filter)
```

| Bus | GainNode (linear) | Default dBFS trim | Post-node | Effective ceiling (× master) | Contents |
|---|---|---|---|---|---|
| **SFX** | 1.00 | 0.0 (reference) | — | 0.45 = shipped | grabs, impacts, foley, debris, register |
| **UI** | 0.71 | −3.0 | — | 0.32 | list ticks, menu, mute, stingers |
| **AMB** (ambience) | 0.32 | −10.0 | Shared lowpass "focus" filter (§18.10) | 0.144 | hum + 12 zone beds |
| **PA** | 0.63 | −4.0 | Bandpass 1200 Hz Q0.7 + 90 ms feedback-delay "hall" | 0.283 | page chime + announcements |
| **MUSIC** | 0.126 | −18.0 | Bandpass 900 Hz Q0.6 ("ceiling speaker") | 0.057 | procedural muzak (default off) |
| **MASTER** | 0.45 | −6.94 | feeds LIMITER | — | global trim; `M` zeroes this (shipped) |

**Master limiter** (`DynamicsCompressorNode`, inserted `master → limiter → destination`): `threshold −1.0 dBFS`, `knee 0`, `ratio 20:1`, `attack 0.003 s`, `release 0.15 s`. This is transparent under normal load and only clamps transient stacks; it never colors single cues because they peak well below −1 dBFS after the master trim.

The hum from shipped `ensure()` (noise → lowpass 240 → gain 0.018) now connects to **AMB_bus** instead of master. Its *effective* level is preserved by construction: old path `0.018 × 0.45 = 0.0081` (−41.8 dBFS); new path `0.018 × AMB(0.32) × MASTER(0.45) = 0.00259` would drop it, so the hum's own gain is **rescaled to `0.056`** inside the AMB bus (`0.056 × 0.32 × 0.45 = 0.0081`) — identical output, now duckable as a group.

`M` mute keeps its shipped behavior (zero the master gain), so a mute survives across all six buses in one write.

### 18.3 Ducking matrix

Ducking is sidechain-by-event: when a cue in the **trigger** column fires, the named **target** buses ramp down by the listed dB, hold for the cue's tail, then release. Implemented as scheduled `gain.setTargetAtTime` ramps on each target bus's `GainNode` (no compressor sidechain — WebAudio can't sidechain natively without a worklet, so we script it). Values are **dB of attenuation from the bus's current trim**; multiple simultaneous ducks take the **max** (deepest wins, they don't sum).

| Trigger ▶ / Target ▼ | MUSIC | AMB | PA | UI | SFX | Attack | Release |
|---|---|---|---|---|---|---|---|
| **PA page** (chime→speech) | −12 | −7 | — | −4 | −5 | 40 ms | 500 ms |
| **crash** (gondola/cart tip) | −14 | −10 | −6 | −6 | −3 | 15 ms | 400 ms |
| **thud / bump** | −5 | −4 | −2 | −2 | — | 20 ms | 220 ms |
| **checkout jingle** | −9 | −6 | −4 | — | −3 | 30 ms | 350 ms |
| **listDone** | −6 | −4 | −3 | — | — | 25 ms | 300 ms |
| **sprint sustained** (§18.10) | −6 | −4 | −3 | — | — | 120 ms | 250 ms |
| **error** | −3 | −2 | — | — | — | 10 ms | 180 ms |

Ramp shape uses `setTargetAtTime(target, now, τ)` where `τ = attack/3` on the way down and `τ = release/3` on the way up (so ~95% settle within the stated time). Example — a crash at `t`: `MUSIC_bus.gain.setTargetAtTime(0.126·10^(−14/20)=0.0252, t, 0.005)` then back to `0.126` scheduled at `t+0.4` with `τ=0.133`.

### 18.4 Synthesis primitives

The game synthesizes; these are the exact building blocks. `TONE` and `NOISE` are the shipped `tone()`/`noise()` (envelopes unchanged); `SEQ` and `LOOP` are thin schedulers over them. All connect to a bus argument (default SFX).

| Primitive | Signature | Envelope / behavior (exact) |
|---|---|---|
| `TONE` | `(freq, dur, type, peak, slideTo?)` | `OscillatorNode(type)`; gain: `setValueAtTime(0.0001,t0)` → `linearRampToValueAtTime(peak, t0+0.008)` → `exponentialRampToValueAtTime(0.0001, t0+dur)`; if `slideTo`, `freq.exponentialRampToValueAtTime(slideTo, t0+dur)`; `stop(t0+dur+0.03)`. **(shipped)** |
| `NOISE` | `(dur, cutoff, peak)` | white buffer `d[i]=(rand·2−1)·(1−i/n)`; `BiquadFilter lowpass @cutoff`; gain `setValueAtTime(peak,t0)` → `expRamp(0.0001, t0+dur)`. **(shipped)** |
| `SEQ` | `([{...cue, at}])` | schedules a list of `TONE`/`NOISE` at `t0+at` ms via `setTimeout` (as shipped in `listDone`/`checkout`/`clatter`). |
| `LOOP` | `(bufferRecipe, {filter, gain})` | `AudioBufferSourceNode.loop=true`; used for beds and cart-roll; gain is automatable for crossfade. |
| `BP` | `(node, freq, Q)` | inserts a `BiquadFilter bandpass` — used to voice PA/NPC formants. |

Every randomized parameter draws from the seeded LCG, not `Math.random()`, in the audio module (the shipped cues use `Math.random()` inside `clatter`; those calls are swapped to the seeded stream — the audible character is identical, replay is now deterministic).

### 18.5 Complete cue inventory

Every event that can make a sound. **Bold IDs are shipped verbatim** (params match `sfx.js` exactly); the rest are the specified additions. Priority is 0–10 (10 = never stolen). "Max" = max simultaneous instances of that cue; "CD" = per-cue retrigger cooldown in ms. Bus abbreviations per §18.2.

**UI bus**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| ui_boot_ready | `manager.onLoad` "Ready" | `SEQ[TONE(880,0.10,sine,0.16)@0, TONE(1318,0.12,sine,0.14)@60]` | 4 | 1 | 2000 |
| ui_lock | pointer-lock / fallback engage | `TONE(660,0.06,sine,0.12)` | 3 | 1 | 300 |
| ui_hover_enter | aim acquires a product/debris | `TONE(1200,0.03,sine,0.06)` | 2 | 1 | 80 |
| **ui_list_tick** | list item matched (`SFX.tick`) | `TONE(880,0.07,square,0.14)` | 6 | 3 | 40 |
| **ui_list_done** | list complete (`SFX.listDone`) | `SEQ[TONE(660,0.14,triangle,0.26)@0, TONE(880,…)@100]` | 8 | 1 | 500 |
| **ui_checkout_ok** | checkout (`SFX.checkout`) | `SEQ[523,659,784,1046]×TONE(_,0.16,triangle,0.26)@{0,90,180,270}` | 9 | 1 | 800 |
| **ui_error** | invalid action (`SFX.error`) | `TONE(300,0.18,sawtooth,0.20,→190)` | 6 | 2 | 120 |
| ui_reroll | `R` new list | `TONE(440,0.08,triangle,0.16,→560)` | 5 | 1 | 200 |
| ui_mute_on | `M` → muted | `TONE(520,0.10,sine,0.14,→300)` | 7 | 1 | 150 |
| ui_mute_off | `M` → unmuted | `TONE(300,0.10,sine,0.14,→520)` | 7 | 1 | 150 |
| ui_menu_move | settings nav (Ch. 6) | `TONE(700,0.03,square,0.08)` | 3 | 1 | 40 |
| ui_menu_confirm | settings confirm | `TONE(880,0.08,triangle,0.16)` | 4 | 1 | 80 |
| ui_menu_back | settings back | `TONE(440,0.06,triangle,0.12)` | 4 | 1 | 80 |
| ui_slider_tick | slider drag detent | `TONE(1000,0.02,square,0.05)` | 2 | 1 | 30 |
| stinger_perfect | checkout, 0 damages | `SEQ[784,988,1318]×TONE(_,0.18,triangle,0.22)@{0,90,180}` | 8 | 1 | 800 |
| stinger_messy | checkout, damages>0 | `SEQ[TONE(400,0.16,sawtooth,0.16)@0, TONE(330,…)@120]` | 8 | 1 | 800 |
| stinger_damage_warn | first damage of a run | `TONE(400,0.12,sawtooth,0.14,→300)` | 6 | 1 | 4000 |
| stinger_bill_add | each damage increment | `TONE(1200,0.05,square,0.08)` | 4 | 2 | 120 |

**SFX bus — interaction & grab**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| **sfx_grab** | `E` take from shelf (`SFX.grab`) | `TONE(520,0.12,triangle,0.24,→800)` | 7 | 3 | 40 |
| sfx_grab_debris | pick item off the floor | `TONE(430,0.12,triangle,0.22,→680)` | 6 | 3 | 40 |
| sfx_fly_whoosh | 0.4 s fly to basket begins | `NOISE(0.18,1400,0.10)` | 3 | 4 | 0 |
| sfx_basket_drop | fly reaches basket (`f.t≥1`) | `TONE(180,0.08,sine,0.18)+NOISE(0.05,600,0.08)` | 5 | 4 | 30 |

**SFX bus — foley (player)**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| foot_walk | `bob` crosses π (walk, ≤3.1 m/s) | `NOISE(0.05,900,0.12)`, alt cutoff 800/1000 per step | 2 | 2 | (bob-gated) |
| foot_run | `bob` crosses π (sprint 4.9 m/s) | `NOISE(0.045,1200,0.16)`, alt cutoff 1000/1300 | 3 | 2 | (bob-gated) |
| cloth_move | start moving from rest | `NOISE(0.12,500,0.04)` | 1 | 1 | 400 |
| cart_push_start | player shove `rel>0` on a cart | `TONE(70,0.20,sine,0.12)` + start `cart_roll_loop` | 4 | 2 | 250 |
| cart_roll_loop | any cart with `speed>0.15` | `LOOP(noise, lowpass 300)`, gain `=min(0.10, speed·0.02)` | 3 | 3 | — |
| cart_squeak | rolling cart, random 8% / s | `TONE(1600,0.15,sine,0.05,→1900)` | 2 | 2 | 400 |

**SFX bus — impacts & destruction**

| ID | Trigger (source line) | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| **impact_thud** | `SFX.thud` — many callsites | `NOISE(0.14,260,0.4)+TONE(90,0.12,sine,0.3,→55)` | 7 | 3 | 60 |
| impact_block_soft | walk into wall, `speed<KNOCK` | `NOISE(0.10,220,0.22)+TONE(80,0.08,sine,0.2,→60)` | 5 | 2 | 120 |
| gondola_creak | ~120 ms pre-tip lead-in | `TONE(140,0.40,sawtooth,0.10,→90)` w/ 6 Hz gain wobble | 6 | 1 | 300 |
| **crash_gondola** | `tipGondola` (`SFX.crash`) | `NOISE(0.5,900,0.5)+TONE(70,0.35,sine,0.4,→40)+NOISE(0.25,500,0.3)@120` | 10 | 1 | 300 |
| **crash_cart_tip** | cart `−vn>2.6` (`SFX.crash`) | same as crash_gondola | 10 | 1 | 300 |
| spill_scatter | with gondola tip (56-item spill) | `SEQ` 8×`NOISE(0.03, rand 400–1400, 0.06)` over 300 ms | 5 | 1 | 300 |
| **debris_clatter** | items knocked loose (`SFX.clatter`) | `SEQ` 4×`TONE(700+rand·500,0.05,square,0.12)@{0,60,130,210}` | 5 | 2 | 120 |
| **debris_bounce** | debris floor hit, `|v.y|>1.2` (`SFX.tick`) | `TONE(880,0.07,square,0.14)` | 4 | 4 | 30 |
| debris_bounce_soft | debris floor hit, `|v.y|≤1.2` | `NOISE(0.04,400,0.08)` | 2 | 4 | 20 |
| debris_settle | debris enters `resting` | `NOISE(0.06,300,0.06)` | 1 | 3 | 40 |
| can_roll | round SKU (tins) resting w/ spin | `TONE(300,0.5,sine,0.06,→260)` gain-wobble 4 Hz | 2 | 2 | 500 |

**SFX bus — NPC voice (non-verbal formants; text bark in Ch. 17)**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| npc_grunt_bump | NPC bump (`BUMP_LINES` toast) | `BP(TONE(180,0.14,sawtooth,0.12), 700, 3)` | 5 | 2 | 1300 (matches `shoveCd`) |
| npc_gasp | hard bump / near a crash | `NOISE(0.12,2000,0.06)+TONE(400,0.10,sine,0.08)` | 4 | 2 | 1500 |
| cashier_greet | player enters staffed-lane radius | `SEQ[TONE(659,0.10,sine,0.12)@0, TONE(784,0.10,…)@120]` | 4 | 1 | 6000 |

**SFX bus — register & checkout foley**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| scan_beep | per list item during checkout tally | `TONE(2000,0.06,square,0.18)` | 6 | 6 | 60 |
| register_drawer | checkout total finalized | `NOISE(0.08,1200,0.14)+TONE(1046,0.05,square,0.14)+TONE(1568,0.06,square,0.12)@50` | 7 | 1 | 800 |
| receipt_print | after drawer | `LOOP(noise, BP 1500 Q5)` 0.5 s, gain 0.06 | 3 | 1 | 800 |
| bag_rustle | items settle into bags | `NOISE(0.25,3000,0.07)` | 2 | 2 | 200 |

**AMB / SFX bus — environment one-shots**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| freezer_door_open | near freezer wall, look-at door | `NOISE(0.30,1500,0.10)+TONE(200,0.20,sine,0.06)` | 3 | 2 | 500 |
| freezer_door_close | leave freezer proximity | `NOISE(0.15,800,0.12)+TONE(120,0.08,sine,0.16)` | 3 | 2 | 500 |
| gumball_crank | pass gumball machines | `SEQ` 6×`TONE(400,0.04,square,0.06)@{0,50,…,250}` + `TONE(220,0.08,sine,0.10)@320` | 2 | 1 | 1500 |
| fluorescent_flicker | random 3% / s, grocery half | `TONE(120,0.20,sawtooth,0.03)` | 1 | 1 | 4000 |
| sliding_door | enter/exit vestibule | `NOISE(0.6,1000,0.08)+TONE(60,0.5,sine,0.05)` | 3 | 1 | 2000 |
| cart_corral_clank | near front corral | `SEQ` 3×`TONE(rand 300–500,0.05,square,0.10)@{0,70,150}` | 2 | 1 | 1200 |

**AMB / SFX bus — exterior (night lot, Ch. 15)**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| car_pass | scripted lot traffic | `NOISE(1.2,600,0.12) lowpass-sweep 600→300 + TONE(80,1.0,sawtooth,0.05)` | 2 | 2 | 3000 |
| wind_gust | random on lot bed | `NOISE(2.0,400,0.08)` swell (attack 0.6 s) | 1 | 2 | 5000 |
| crosswalk_beep | near crosswalk | `TONE(880,0.10,square,0.10)` @1 s loop while in radius | 2 | 1 | 1000 |

**PA bus**

| ID | Trigger | Synthesis | Prio | Max | CD |
|---|---|---|---|---|---|
| pa_chime | prefix to every announcement | `SEQ[TONE(784,0.35,sine,0.30)@0, TONE(523,0.5,sine,0.30)@260]` → `BP(1200, 0.7)` | 6 | 1 | 800 |
| pa_end_chime | close of announcement | `TONE(523,0.40,sine,0.20)` → `BP(1200,0.7)` | 5 | 1 | 800 |

**AMB bus — beds** (loops; full recipes in §18.7)

| ID | Zone | Prio | Max | CD |
|---|---|---|---|---|
| **A_hum_store** | global (shipped hum, rescaled) | 0 | 1 | — |
| A_bed_aisles / A_bed_freezer / A_bed_bakery / A_bed_produce / A_bed_checkout / A_bed_electronics / A_bed_apparel / A_bed_toys / A_bed_pharmacy / A_bed_wine / A_bed_vestibule / A_bed_lot | per zone | 0 | 3 active | — |

Total discrete cues: **61** one-shots/loops in the tables above + **13** ambience beds = 74 audio events. Every `SFX.*` callsite in `game.js` and `physics.js` maps to a bold row; nothing shipped is renamed or re-tuned.

### 18.6 Voice management

A tiny governor sits in front of the buses (module-local, no worklet):

- **Polyphony cap 24.** A ring of active voices; on `start()` of voice #25, steal the lowest-priority active voice whose priority `< incoming`. If none lower, drop the incoming (silent). Crashes (prio 10) always play.
- **Per-cue Max** enforced first (e.g., only 1 `crash_gondola` at once — a double-tip reuses the tail).
- **Per-cue cooldown (CD ms):** a `lastFired[id]` timestamp gate. Retrigger inside CD is dropped. The shipped implicit cooldowns become explicit here — e.g., `impact_thud` gets 60 ms so a wall-slide can't machine-gun thuds, matching the feel of `crashCd = 0.45/0.5` in `physics.js` (which already rate-limits the *events*; this rate-limits the *audio* independently for lower-level cues that have no gameplay cooldown, like `debris_bounce`).
- **Amortized bed swaps:** at most **1 bed crossfade started per frame** (like `SPAWNS_PER_FRAME=9` for debris) so walking a zone boundary never allocates >1 `AudioBufferSourceNode` in a frame.

### 18.7 Ambience beds per zone

Twelve positional beds layered over the global hum. The player samples position each frame; each zone has a center `(x,z)` + radius; a bed's gain = `smoothstep(0, 1, 1 − clamp(dist/radius, 0, 1))`. Only the **3 nearest** beds are audible (others held at 0 and their sources paused after a 400 ms fade), capping CPU. Beds are mono `LOOP`s (2–4 s buffers) plus sparse randomized one-shot sprinkles drawn from the seeded LCG. Coordinates match the store map in the brief.

| Bed | Center (x,z) | Radius | Layer recipe (loops @ gain; sprinkles) |
|---|---|---|---|
| A_hum_store | global | ∞ | `LOOP noise lowpass 240 @0.056` (shipped hum) — always on |
| A_bed_aisles | (−12,−3) | 10 m | LOOP `lowpass 320 @0.03`; sprinkle `fluorescent_flicker` 3%/s, distant `debris_clatter` 1%/s |
| A_bed_freezer | (−22.5,0) left wall | 6 m | LOOP `bandpass 90 Q1.2 @0.05` compressor rumble + LOOP `highpass 3000 @0.015` coil hiss; sprinkle `freezer_door_*` on look |
| A_bed_bakery | (0,13.5) back wall | 6 m | LOOP `lowpass 200 @0.02` oven fan + LOOP `bandpass 600 Q2 @0.012` convection whir; no sprinkles (warm/quiet) |
| A_bed_produce | (−17.5,11) | 5 m | LOOP `lowpass 500 @0.02` mist-hiss burst every 20 s (`NOISE(1.5,2500,0.04)`); occasional `TONE(1800,0.06,sine,0.03)` scale-beep |
| A_bed_checkout | (−6,10.6) front strip | 8 m | LOOP `lowpass 700 @0.02` murmur; sprinkles: `scan_beep` from staffed lanes 30%/s, `register_drawer` rare, `bag_rustle` |
| A_bed_electronics | (12,−8.5) | 8 m | LOOP `bandpass 400 Q1 @0.02` TV-wall wash + LOOP `highpass 8000 @0.008` CRT whine (15.7 kHz feel, halved to 7.85 kHz to stay audible on laptop speakers) |
| A_bed_apparel | (10.2,4.2) carpet | 7 m | LOOP `lowpass 260 @0.015` dead/carpeted air (deliberately the quietest zone) |
| A_bed_toys | (19.5,−2) | 6 m | LOOP `lowpass 900 @0.02` + a looped 4-note toy jingle `SEQ[C6,E6,G6,C7]` @0.03 every 12 s (child-toy demo) |
| A_bed_pharmacy | (18.5,10.4) | 5 m | LOOP `lowpass 300 @0.015` hushed + `TONE(1000,0.04,sine,0.02)` counter-bell 8%/min |
| A_bed_wine | (−21.7,−9.2) nook | 4 m | LOOP `lowpass 180 @0.02` cellar-quiet; no sprinkles |
| A_bed_vestibule | (−7,15) entrance | 5 m | LOOP `lowpass 350 @0.02` + `sliding_door` on threshold cross; leaks a little lot wind |
| A_bed_lot | outside > z=15 | 14 m | LOOP `lowpass 500 @0.05` night wind + LOOP `bandpass 120 Q0.8 @0.02` distant road; sprinkles `car_pass` 1 per 3–8 s, `wind_gust`, `crosswalk_beep` near crossing |

Zone crossfades use `setTargetAtTime(targetGain, now, 0.13)` (≈400 ms settle). The AMB bus's shared **focus lowpass** (§18.10) sits after all beds, so a crash muffles the whole environment in one node.

### 18.8 PA system

**Policy decision: chime + on-screen text is the baseline; Web Speech `SpeechSynthesis` is an optional enhancement tier.** Rationale: TTS quality/voice availability varies wildly across browsers, `speechSynthesis` can't be gesture-guaranteed the way `AudioContext` is, and it would fight the mix. So every page is authored as (1) the synthesized `pa_chime` (§18.5), (2) the text rendered in the existing toast/banner channel (Ch. 7) styled as a PA caption, and (3) **if** `window.speechSynthesis` exists AND the "Spoken pages" setting is on (default **off**), the text is spoken through a `MediaStreamAudioSourceNode`-adjacent path routed by ducking rules — but the game never *depends* on speech. This makes pages fully accessible as captions by default (Ch. 11) and keeps determinism.

Each page: `pa_chime` → 200 ms → text caption fades in (stays 4.5 s) → optional TTS → `pa_end_chime`. While a page is active, the ducking matrix's **PA page** row is armed. Pages are gated so at most one plays at a time (Max 1) with an 800 ms floor between chimes; dynamic pages preempt scheduled ones (higher priority).

**Trigger types:** `SCHED` = fires on a rotating timer (every 45–90 s, LCG-picked order, never the same page twice running); `DYN` = fired by a gameplay event.

**Scheduled announcements** (ambient store texture)

| ID | Text | Trigger | Policy |
|---|---|---|---|
| pa_welcome | "Welcome to Dash Mart — where every trip is a sprint." | SCHED (also once on first lock) | chime+caption(+TTS) |
| pa_specials_1 | "Attention shoppers: fresh croissants, two for one, in the bakery." | SCHED | chime+caption |
| pa_specials_2 | "Blue-light special on canned goods, aisle four, next fifteen minutes." | SCHED | chime+caption |
| pa_specials_3 | "Ripe avocados are marked down in the produce corner." | SCHED | chime+caption |
| pa_specials_4 | "Electronics: demo the wall of TVs, no salesperson required." | SCHED | chime+caption |
| pa_loyalty | "Dash Rewards members save more. Ask any register to enroll." | SCHED | chime+caption |
| pa_app | "Skip the line — scan and dash with the Dash Mart app." | SCHED | chime+caption |
| pa_produce_fresh | "Produce team, freshness check, corner six." | SCHED | chime+caption |
| pa_bakery_hot | "Hot bread out of the oven at the back wall." | SCHED | chime+caption |
| pa_wine_tasting | "Wine nook tasting this evening, please drink responsibly." | SCHED | chime+caption |
| pa_pharmacy_open | "The pharmacy is now open at the front-right counter." | SCHED | chime+caption |
| pa_toys_demo | "Kids, the toy island has a ball bin — parents, good luck." | SCHED | chime+caption |
| pa_curb | "Curbside pickup, pull into the night lot, we'll bring it out." | SCHED | chime+caption |
| pa_lane_open | "Register two is now open." | SCHED | chime+caption |
| pa_no_running_soft | "A gentle reminder: please, no running in the aisles." | SCHED | chime+caption |
| pa_music_credit | "The music you're not really hearing is by nobody at all." | SCHED (rare, wink) | chime+caption |
| pa_closing_30 | "The store closes in thirty minutes." | SCHED (late in a long session) | chime+caption |
| pa_closing_10 | "Ten minutes to closing. Please make your way to a register." | SCHED | chime+caption |
| pa_lost_found | "A set of keys is waiting at customer service." | SCHED | chime+caption |
| pa_thanks | "Thank you for shopping at Dash Mart. Dash safely." | SCHED (on idle) | chime+caption |

**Dynamic announcements** (gameplay-reactive)

| ID | Text (template) | Trigger | Policy |
|---|---|---|---|
| pa_cleanup_aisle | `CLEANUP ON AISLE {N} — ALL OF IT.` | gondola tip (`tipGondola`, uses `g.label` 1–8) | chime+caption; **replaces** the shipped toast, now voiced |
| pa_cleanup_spill | `Spill cleanup near aisle {N}.` | ≥6 debris knocked loose in a zone | chime+caption |
| pa_price_check | `Price check on register {L}.` (L = lane letter) | player lingers at a lane w/o completing | chime+caption |
| pa_cart_corral | "Please return your cart to the corral." | player abandons a shoved cart far from origin | chime+caption |
| pa_no_running_hard | "Sir — ma'am — we said no running." | sustained sprint > 4 s in aisles | chime+caption |
| pa_damage_warn | `Careful — that's ${AMT} on your deposit so far.` | cumulative damage crosses \$10 | chime+caption |
| pa_damage_big | "Manager to the grocery aisles. Bring a mop." | gondola tip | chime+caption (fires with pa_cleanup_aisle, queued after) |
| pa_list_hint | `You still need: {ITEM}.` | 60 s with an unmet list item | caption-only (no chime, softer) |
| pa_checkout_nudge | "Your list is complete — any open register will do." | listDone + 20 s idle | chime+caption |
| pa_great_run | `Checked out in {TIME} with no damage. Impressive.` | perfect checkout | chime+caption |
| pa_messy_run | `Checked out — but that'll be ${AMT} in damages.` | checkout w/ damage | chime+caption |
| pa_welcome_back | "Back for more? New list, same chaos." | `R` reroll | caption-only |
| pa_bump_apology | `Customer service to {ZONE} — we have a situation.` | 3+ NPC bumps in 30 s | chime+caption |
| pa_frozen_open | "Please keep the freezer doors closed." | freezer door left "open" (proximity) 8 s | chime+caption |
| pa_gumball | "Someone's feeding the gumball machine again." | gumball_crank | caption-only (wink) |

**Dynamic templates (exact substitution):** `{N}` = `g.label` (String 1–8 from `physGondolas`); `{L}` = staffed-lane letter (lane 2 = "two", derived from the two staffed registers); `{AMT}` = `world.physics.damage.total.toFixed(2)`; `{TIME}` = `game.fmt(time)` (the shipped `m:ss`); `{ITEM}` = first `list` entry with `got<need`; `{ZONE}` = nearest zone name from §18.7. Rendering: caption text goes through the same `toast()`/`banner()` DOM path already in `physics.js`/`game.js`, so the PA layer is *purely additive* to shipped UI. 35 pages total (20 scheduled + 15 dynamic), exceeding the 40-line spirit once the 8 aisle-number and 2 lane-letter substitutions are counted as distinct realized lines.

### 18.9 Music policy — procedural generator (full spec)

**Decision: procedural ambient muzak generator, default OFF, MUSIC bus at −18 dB.** This respects the shipped reality ("no music") — nothing plays unless the player opts in via Settings (Ch. 6) — while giving a fully-specified generator for those who turn it on. No CC0 track list is used: zero files keeps the no-backend promise and the deterministic replay guarantee, and a generator can react to the ducking matrix a sample track cannot.

**Character:** slow, unobtrusive supermarket lounge — a lazy vibraphone-and-electric-piano wash over a soft walking bass, band-passed to sound like it leaks from ceiling speakers.

| Parameter | Value |
|---|---|
| Scale | C major pentatonic for melody (`C D E G A`), full C major for pad voicings |
| Tempo | 72 BPM → beat = 833.3 ms; 4/4 |
| Progression | 8-bar loop: `Cmaj7 – Am7 – Dm7 – G7 – Cmaj7 – Fmaj7 – Dm7 – G7` (2 beats per chord ⇒ one full turn = 16 beats ≈ 13.3 s) |
| Scheduler | Lookahead pattern: `setInterval(25 ms)`; each tick schedules any note whose start is within the next `100 ms` using `AudioContext.currentTime` (the standard "A Tale of Two Clocks" WebAudio metronome — jitter-free without a worklet) |
| Seed | Melody note choice + rest probability from the world LCG, so a seed = a fixed piece |

**Voices** (all synthesized, into MUSIC bus → its 900 Hz bandpass):

| Voice | Synth | Params |
|---|---|---|
| Pad | 2 detuned `sawtooth` per chord tone (±6 cents) → `lowpass 800 Q0.7`, slow LFO `0.1 Hz ±40 Hz` on cutoff | ADSR `A 1.2 s / D 0.5 / S 0.6 / R 1.5`; gain 0.06 per chord (voiced 3 notes) |
| E-piano (FM) | `sine` carrier + `sine` modulator ratio `2:1`, index falls `4→0.5` over 300 ms (bell-to-tine) | one hit per beat on chord root/third; ADSR `A 0.005 / D 0.4 / S 0 / R 0.3`; gain 0.05 |
| Mallet lead | `triangle` on a pentatonic note, `TONE(freq, 0.5, triangle, 0.04, none)` | plays on beats 1 & 3 with 55% probability (LCG); random octave `C5–C6`; light 180 ms feedback-delay echo @0.2 |
| Bass | `sine`, one note per beat, chord root then fifth (walking) | `TONE(root/2, 0.7, sine, 0.07)`; portamento 40 ms between notes |

**Loudness & interaction:** MUSIC bus resting at −18 dBFS (linear 0.126) before its own bandpass; the ceiling-speaker bandpass removes ~6 dB of body so muzak sits *under* everything. It is the deepest-ducked bus in every matrix row (−6 to −14 dB) and is the first thing silenced on the CPU governor's low-power tier (§18.12). A "Muzak" volume slider (0–100%, default 0) maps to `0 → −∞`, `100% → −12 dB` on the bus.

### 18.10 Mix rules at sprint — HDR ducking and the crash muffle

Two coupled systems give the "everything narrows when it gets loud" feel (game-feel contract in Ch. 9, camera shake in `physics.js addShake`).

**(a) Sustained-sprint HDR duck.** When `SPEED === SPEED_RUN (4.9)` and the player is actually moving, arm the **sprint sustained** matrix row: MUSIC −6, AMB −4, PA −3, over a 120 ms attack. Simultaneously the AMB bus's shared **focus lowpass** sweeps its cutoff from `20 kHz → 3.5 kHz` over 150 ms (`setTargetAtTime(3500, now, 0.05)`) — the world goes slightly "tunnel-vision" muffled so footsteps and imminent impacts read clearly. On sprint release, cutoff returns to 20 kHz over 250 ms and buses restore. Footstep cadence also shifts cue `foot_walk → foot_run` (faster, brighter) exactly when `SPEED>4` (the same threshold the code already uses for head-bob at line 158/162).

**(b) Crash muffle (HDR transient).** On any `crash_*` (prio 10), in this order at event time `t`:
1. Fire the **crash** ducking row (MUSIC −14, AMB −10, PA −6, UI −6, SFX −3; 15 ms attack, 400 ms release).
2. Slam the AMB focus lowpass to `800 Hz` in 20 ms, hold 120 ms, sweep back to 20 kHz over 600 ms — a brief "ears ringing" wash.
3. Play a single ear-ring overlay `TONE(3000, 0.6, sine, 0.05)` on the SFX bus with a `600 ms` exp decay, so a big tip leaves a faint high whine as it clears.
4. Scale the ring/muffle depth by impact energy: use the shipped `addShake` magnitude as the proxy — `addShake(0.9)` (gondola) → full depth; `addShake(0.35)` (cart tip) → 0.35× the ring gain and a shallower lowpass floor of `1600 Hz`.

Because the limiter (§18.2) sits after the master trim, even a 56-item `spill_scatter` stacking on `crash_gondola` + `impact_thud` cannot exceed −1 dBFS at `destination`; the ducking pulls the *bed* and *music* down first so the crash itself stays punchy rather than the limiter squashing the transient.

### 18.11 Accessibility, settings, and persistence

Mixed into Settings (Ch. 6) and honored by the module:

| Setting | Range / default | Effect |
|---|---|---|
| Master mute (`M`) | on/off, default off | shipped: `master.gain = 0` (persists across all buses) |
| Master volume | 0–100%, default 100 → −6.94 dBFS | scales MASTER trim |
| SFX / UI / Ambience / PA / Muzak | 0–100% each; defaults 100/100/100/100/**0** | per-bus trim |
| Spoken pages (TTS) | on/off, default **off** | enables `speechSynthesis` for PA when present |
| PA captions | on/off, default **on** | text pages always available even fully muted (Ch. 11) |
| Reduced-audio | on/off | drops beds to the global hum only, disables muzak, halves polyphony cap to 12 |
| Mono | on/off | collapses any future panning to a `ChannelMergerNode` mono sum |

All values persist to `localStorage` under `dashmart.audio.*` (no backend); read at `ensure()`. Every audible bark/page has a text equivalent already (the shipped toasts), satisfying the "no information conveyed by sound alone" rule.

### 18.12 Performance budget and CPU governor

| Metric | Budget |
|---|---|
| Max simultaneous voices | 24 (12 in Reduced-audio) |
| Active ambience beds | ≤3 + global hum |
| New `AudioBufferSourceNode`/frame | ≤1 bed crossfade + ≤9 cue voices (mirrors debris amortization) |
| Node count ceiling (steady state) | ~40 (6 buses, limiter, hum, 3 beds ×~2 nodes, muzak ~10 when on, transient cues GC'd on `stop`) |
| Scheduler | one 25 ms `setInterval` for muzak only; cues are fire-and-forget on the audio clock |

The governor ties into the render tier from `main.js` (`window.__tier`): on `panic` (weak iGPU dropping resolution), audio auto-enters Reduced-audio — muzak off, polyphony 12, beds → hum-only — freeing main-thread time for the renderer. On `high` tier it stays full. This is the audio analogue of the progressive-quality ladder in Ch. 21 and never touches gameplay.

### 18.13 Module API, telemetry, and Definition of Done

The design keeps the shipped `SFX` export as the public surface (so `game.js`/`physics.js` need no rewrite — `SFX.grab()`, `SFX.crash()`, etc. still work) and adds a superset behind it:

- `SFX.play(id, opts?)` — fire any cue in §18.5 by ID (governed).
- `SFX.bed(zone, gain)` — set/crossfade a zone bed (called from the frame loop with player position).
- `SFX.page(id, subs?)` — trigger a PA page with template substitutions; renders caption via the existing toast/banner path.
- `SFX.duck(row)` / auto — apply a ducking-matrix row.
- `SFX.setBus(name, pct)` / `SFX.mute()` — settings.
- Debug hooks in the `window.__*` family (consistent with `main.js`): `window.__audio = { ctx, buses, voices, tier }` for the framebuffer-grid-style verification harness (Ch. 23) — e.g., assert `voices.length ≤ 24`, assert a gondola tip scheduled exactly one `crash_gondola` + `spill_scatter` + `pa_cleanup_aisle`.

**Telemetry (Ch. 24, all local/opt-in):** count cues fired per session, peak voice count, % time muzak enabled, PA pages heard vs. captioned — no audio content, just counters.

**Definition of Done for Ch. 18:** (1) all 8 shipped cues reproduce bit-identical params; (2) the six-bus tree + limiter is in place and `M` still mutes globally; (3) 61 cues + 13 beds exist with the exact synth params above; (4) 35 PA pages render chime+caption, dynamic templates substitute live gameplay values; (5) muzak generator runs the 8-bar loop at 72 BPM, default off; (6) sprint and crash HDR ducking + focus-lowpass behave per §18.10 and never clip `destination`; (7) full mix runs within the voice/node budget on the Intel-iGPU floor with zero added GPU cost. Cross-refs: Ch. 7 (caption channel), Ch. 8 (`M`/`E`/`R` bindings), Ch. 9 (shake↔muffle coupling), Ch. 11 (captions/reduced-audio), Ch. 15 (lot/weather beds), Ch. 17 (bark text ↔ formant cues), Ch. 19 (module boundary), Ch. 21 (tier governor), Ch. 23 (audio assertions), Ch. 24 (telemetry).



---

# PART IV — ENGINEERING



# Chapter 19 — Technical Architecture — Modules & APIs

This chapter is the wiring diagram for *Grocery Dash 3D*. It freezes the contract every file exposes, the exact order systems run each frame, and the budgets they must live inside on the Intel-iGPU floor. The shipped codebase is 11 hand-written ES modules under `src/` (2,890 lines) plus two Node build scripts and one HTML shell. Everything below **extends** that code — the target 21-module map is reached by *additive* refactors (Ch. 25, Waves 3–6), never by rewriting shipped behavior. The game still boots from one `<script type="module" src="/src/main.js">`, still renders through one `composer.render()`, still ships with no backend, and still plays even when every optional asset fails to load.

The runtime is deliberately **class-free**: every subsystem is a factory closure (`createX` / `buildX`) that captures its dependencies and returns a small object of methods. There is no framework, no reactive store, no DI container beyond the plain `GameContext` object and the event bus specified in 19.4. This is a design constraint, not an accident — it keeps the whole thing tree-shakeable, allocation-auditable, and legible to a solo developer.

---

### 19.1 Architectural principles

| # | Principle | Enforcement |
|---|-----------|-------------|
| P1 | **Layered, downward-only imports.** A module may import its own layer and any layer below it, never above. | ESLint `import/no-restricted-paths` (19.9) |
| P2 | **THREE is ambient.** `import * as THREE from 'three'` and `three/examples/jsm/*` are allowed in every layer. | Lint exception list |
| P3 | **Cross-layer talk goes through the bus or GameContext**, never a direct sibling import between Sim and Game. | 19.4, 19.3 |
| P4 | **No allocation in the per-frame hot path.** Functions named `update`/`tick` reuse module-scoped scratch objects (`_v`, `_m`, `_q`). | Custom lint rule `no-alloc-in-update` (19.9) |
| P5 | **Fail soft, always playable.** Optional async loads degrade to procedural fallbacks; only the synchronous boot chain is fatal. | 19.8 |
| P6 | **Determinism where it matters.** All world layout and stocking draw from one seeded LCG; the bus is synchronous so event order is reproducible for replay tests (Ch. 23). | 19.4 D1, `core/rng` |

The five layers, lowest first:

| Layer | Name | Modules | May import |
|-------|------|---------|-----------|
| L0 | **Kernel** | bootstrap, loop, quality, bus, rng | THREE, each other (roots excepted) |
| L1 | **Platform/Render** | renderer, env, materials, models | THREE only |
| L2 | **Content** | products, stock, fixtures, dressing, store | L1, rng |
| L3 | **Sim** | physics, characters, player | L2, bus, rng, GameContext |
| L4 | **Game** | input, session, hud, modes, scenario, sfx | bus, GameContext, L2 specs |

Roots (`bootstrap`, `loop`) are imported by nobody. `store` is the L2 assembler that *produces* the GameContext consumed by L3/L4.

---

### 19.2 Target module map (existing 11 → 21)

The 11 shipped files carry two "god modules": `main.js` (240 lines: renderer + loop + input + player movement + quality tiers + debug hooks) and `store.js` (1,427 lines: every fixture and every piece of set dressing). The refactor splits those two into eight focused modules; the other nine files map almost 1:1. Non-runtime files (`scripts/fetch-assets.mjs`, `scripts/fetch-models.mjs`, `index.html`) are unchanged and excluded from the count.

| Shipped file | → Target module(s) | Layer |
|---|---|---|
| `main.js` | `core/bootstrap`, `core/loop`, `core/quality`, `render/renderer`, `sim/player`, `core/input` | L0/L1/L3/L4 |
| `store.js` | `world/store`, `world/fixtures`, `world/dressing` | L2 |
| `game.js` | `game/session`, `game/hud` | L4 |
| `stock.js` | `world/stock` | L2 |
| `products.js` | `world/products` | L2 |
| `physics.js` | `sim/physics` | L3 |
| `characters.js` | `sim/characters` | L3 |
| `materials.js` | `render/materials` | L1 |
| `models.js` | `render/models` | L1 |
| `env.js` | `render/env` | L1 |
| `sfx.js` | `audio/sfx` | L4 |
| *(new)* | `game/modes`, `game/scenario` | L4 |
| `core/rng`, `core/bus` | *(new, extracted/added)* | L0 |

That is **21 runtime modules**. `game/modes` and `game/scenario` are wholly new (they enable Ch. 2 mode rulesets and Ch. 3's 40 career shifts); `core/bus` and `core/rng` formalize patterns already latent in the code (the LCG at `store.js:1228`, the ad-hoc direct calls between `main → physics → game`).

#### L0 Kernel

**`core/bootstrap.js`** — app entry; the only module with side effects at import time.
- API: `boot(): Promise<void>`
- Responsibility: create renderer (via `render/renderer`), mount canvas, drive the boot-screen `LoadingManager` (progress bar, `renderer.compile()` shader pre-warm behind the splash — `main.js:41–53`), wire the top-level error boundary (19.8), instantiate every subsystem, build the loop, call `loop.start()`.
- Publishes: `boot.progress {loaded:int,total:int}`, `boot.ready {}`, `boot.error {stack:string}`.
- Consumes: none.
- May import: everything (it is the composition root). Imported by: nobody.

**`core/loop.js`** — the fixed-order frame scheduler (19.7).
- API: `createLoop(systems: System[], render: () => void): { start(): void; stop(): void; add(sys: System): void; readonly fps: number }` where `System = { name: string; update(dt: number): void; enabled: boolean }`.
- Responsibility: owns the `THREE.Clock`, clamps `dt = min(getDelta(), 0.05)`, calls each enabled system's `update(dt)` in array order inside a guarded try/catch (circuit breaker, 19.8), then calls `render()`. One `requestAnimationFrame` driver.
- Publishes: `system.faulted {name:string, error:string}`.
- Consumes: none. May import: bus. Imported by: bootstrap only.

**`core/quality.js`** — progressive render-tier manager (lifted verbatim from `main.js:171–203`).
- API: `createQuality({ renderer, composer, scene, gtao, bloom }): { sample(dt): void; readonly tier: Tier; apply(tier: Tier): void }`, `Tier = 'lite'|'high'|'lite-locked'|'panic'`.
- Responsibility: start in **lite** (GTAO off, rect-area lights hidden, every other spot's `castShadow=false`); at frame 3 freeze all shadow maps (`shadow.autoUpdate=false`); average `dt` over frames 20–80 (60 samples); `avg < 0.020s → apply('high')`, `avg > 0.055s → panic` (`setPixelRatio(1)`), else `lite-locked`.
- Publishes: `quality.tierChanged {tier}`. Consumes: none. May import: THREE.

**`core/bus.js`** — synchronous typed event bus (19.4). API in that section.

**`core/rng.js`** — deterministic Lehmer/Park-Miller LCG.
- API: `createRng(seed: number): { next(): number; int(n: number): number; range(a: number, b: number): number; pick<T>(arr: T[]): T; readonly seed: number }`.
- Formula (exact, from `store.js:1228`): `seed = (seed * 16807) % 2147483647; return seed / 2147483647`. Default world seed `1337`. Worked example: from 1337 → `1337*16807 = 22,470,959`; `22,470,959 % 2,147,483,647 = 22,470,959`; `next() = 22470959 / 2147483647 ≈ 0.010464`.
- May import: nothing. Imported by: store, fixtures, dressing, characters, scenario.

#### L1 Platform / Render

**`render/renderer.js`** — WebGL context + post chain (from `main.js:24–86`).
- API: `createRenderer(canvas: HTMLCanvasElement): { renderer: THREE.WebGLRenderer; composer: EffectComposer; camera: THREE.PerspectiveCamera; gtao: GTAOPass; bloom: UnrealBloomPass; resize(w: number, h: number): void; render(): void }`.
- Fixed config: `antialias:true`, `powerPreference:'high-performance'`, `pixelRatio = min(devicePixelRatio, 1.25)`, `PCFSoftShadowMap`, `ACESFilmicToneMapping` exposure 1.0. Camera: FOV 62, near 0.1, far 100. Composer RT: `samples:2`, `HalfFloatType`. Passes in order: `RenderPass → GTAOPass(blendIntensity .85, radius .35, 8 samples; enabled=false by default) → UnrealBloomPass(strength .16, radius .5, threshold .96) → OutputPass`.
- Consumes: `window.resize`. May import: THREE + jsm passes.

**`render/env.js`** — HDRI image-based lighting (unchanged `env.js`).
- API: `loadEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, manager: THREE.LoadingManager): Promise<THREE.Texture>`. Loads `assets/env/warehouse_1k.hdr`, PMREM-prefilters it into `scene.environment`, sets `environmentIntensity = 0.55`. No visible skybox.

**`render/materials.js`** — shared material factories (unchanged `materials.js`).
- API: `loadPBR(loader, folder: string, repeat?: [number,number], extra?: object): MeshStandardMaterial|MeshPhysicalMaterial`; `METAL(color?=0xb9c0c7, roughness?=0.38)`; `PAINTED(color, roughness?=0.6)`; `PLASTIC(color, roughness?=0.25)`. ARM packing: AO(R)/Rough(G)/Metal(B); `aoMap` deliberately skipped (screen-space GTAO handles occlusion).

**`render/models.js`** — GLB registry (unchanged `models.js`).
- API: `preloadModels(manager): Promise<Map>`; `hasModel(name: string): boolean`; `cloneModel(name, { castShadow? }): THREE.Object3D|null`; `modelSize(name): THREE.Vector3|null`; `cloneModelAtHeight(name, targetH: number, opts?): THREE.Object3D|null`. Reads `assets/models/kit/manifest.json`; **absent manifest is not an error** — returns empty registry and every SKU falls back to procedural packaging (P5).

#### L2 Content

**`world/products.js`** — catalog + procedural packaging (unchanged `products.js`).
- API: `PRODUCTS: Spec[]` (52 shipped SKUs across 9 sections, growing toward the Ch. 16 target set); `bySection(section: string): Spec[]`; `byId(id: string): Spec|undefined`; `buildProduct(spec: Spec): THREE.Group` (origin at base, `userData.spec` attached); `priceTagTexture(spec: Spec): THREE.CanvasTexture`.
- Spec shape and packaging `kind` enum (`box|boxwide|boxtall|boxbig|can|jar|bottle|bag|carton|cup|tub|produce|ball`) are catalogued in Ch. 20. Materials are cached per `(spec.id, role)` and **never mutated** (`products.js:209–215`).

**`world/stock.js`** — GPU-instanced stocking (unchanged `stock.js`).
- API: `buildStock(scene, slots: Slot[]): StockAPI` where `StockAPI = { raycastTargets: InstancedMesh[]; resolve(hit): Handle|null; hideInRegion(box: Box, limit?: number): Handle[]; availableSpecs(): Spec[]; counts: { skus:number; instances:number; drawCalls:number } }`.
- Every facing of one SKU shares one `InstancedMesh` per template part; grabbing writes a zero-scale matrix (`ZERO`) to that instance. `hideInRegion` is the physics layer's only write path into stock.

**`world/fixtures.js`** *(new — extracted from `store.js`)* — the reusable geometry vocabulary.
- API (all pure builders): `gondola(localSlots, localTags, length, sectionsByFace, rng): Group`; `wallShelf(...)`; `freezerWall(scene, slots, rng): Collider`; `checkoutLanes(scene): { colliders: Collider[]; point: Vector3 }`; `cartsAndBaskets(scene): { colliders; carts: Mesh[] }`; `entrance(scene): Door[]`; `shoppingCart(): THREE.Group`; `buildCartGeometry(): BufferGeometry`.
- **Import-rule fix:** `shoppingCart` currently lives in `store.js` and is imported *upward* by `characters.js:5` — a P1 violation. Target: it moves here, and `sim/characters` imports `world/fixtures` (a legal L3→L2 edge).

**`world/dressing.js`** *(new — extracted from `store.js`)* — non-structural set dressing.
- API: `dressStore(scene, slots, colliders, rng): void`, internally running `endcaps`, `palletStacks`, `checkoutExtras`, `produceExtras`, `wallDressing`, `floorProps`, `saleTags`, `apparel`, `toysDept`, `pharmacy`, `kitProps`, `exterior`, `floorZones`. Pushes product `slots` and `colliders` into the caller's arrays before `buildStock` runs.

**`world/store.js`** *(trimmed `store.js`)* — the world assembler and GameContext factory.
- API: `STORE: { w:46, d:30, h:4.2 }`; `buildStore(scene, loader): GameContext` (19.3). Orchestrates fixtures + dressing + stock + tags + lighting, seeds the LCG at 1337, and returns the context. Post-refactor target ≤ 350 lines.

#### L3 Sim

**`sim/physics.js`** — arcade physics (from `physics.js`; +bus emits).
- API: `createPhysics({ scene, ctx, bus }): { update(dt, playerPos: Vector3, playerVel: Vector3): void; onPlayerBlocked(collider, speed: number, dx: number, dz: number): void; toast(msg: string): void; readonly shake: number; readonly damage: { total:number; count:number }; debrisMeshes: Mesh[]; removeDebris(mesh): boolean }`.
- Constants (authoritative, Ch. 22 elaborates): `PLAYER_R 0.34`, `CART_R 0.48`, `TIP_SPEED 4.0`, `KNOCK_SPEED 1.6`, `DEBRIS_CAP 100`, `DEBRIS_TTL 28`, `SPAWNS_PER_FRAME 9`, damage bill = `spec.price * 0.40` per item.
- Publishes: `physics.impact {kind:'thud'|'knock'|'crash', shake}`, `physics.debrisSpawned {specId, count}`, `physics.gondolaTipped {label, axis, sign}`, `physics.cartCrashed {}`, `physics.npcBumped {line}`, `damage.added {specId, amount, total, count}`, `hud.toast {msg, ttl:2600}`. Consumes: `player.blocked` (replaces the direct `onPlayerBlocked` call in the target).

**`sim/characters.js`** — Rocketbox NPC shoppers + rotation-delta retargeting (from `characters.js`).
- API: `createShoppers(scene, manager, ctx): { update(dt): void; npcs: Npc[] }`. Retarget math, sanity gate (`retargetIsSane`, span 1.15–2.3 m), and the 6-walker/2-browser/5-staff population are covered in Ch. 17.
- Publishes: `npc.retargetLog {name, status}` (dev). Consumes: `physics.npcBumped` is *authored here* (physics writes `n.shove`); the shove read stays a context field for zero-alloc. May import: `world/fixtures` (for `shoppingCart`), `render/models`.

**`sim/player.js`** *(new — extracted from `main.js:96–164`)* — first-person controller + collision.
- API: `createPlayer({ camera, ctx, bus, input }): { update(dt): void; readonly position: Vector3; readonly velocity: Vector3; teleport(v: Vector3): void }`.
- Constants: reach radius `R 0.34`, `SPEED_WALK 3.1`, `SPEED_RUN 4.9`, eye height 1.65 m, head-bob `sin(bob)*0.045` (run) / `0.03` (walk), camera shake `(rand-0.5)*shake*0.12`. Collision is AABB-vs-point against `ctx.colliders` with a "stuck → walk out" escape (`main.js:151`).
- Publishes: `player.blocked {collider, speed, dx, dz}`. Consumes input via the injected `input` handle (key state). May import: `core/input`, GameContext.

#### L4 Game

**`core/input.js`** *(new — extracted from `main.js:88–129`)* — raw input capture.
- API: `createInput(dom: HTMLElement, bus): { keys: Record<string,boolean>; isDown(code: string): boolean; readonly locked: boolean; readonly fallback: boolean; dispose(): void }`. Owns `PointerLockControls`, the drag-to-look fallback (sensitivity `0.0042 rad/px`, pitch clamp ±1.45), and keydown/keyup.
- Publishes: `input.action {action:'grab'|'reroll'|'mute'}` (E/R/M), `input.lock {locked}`, `input.fallback {}`, `input.mute {}`. *(Listed under L4 for its bus role but has no game-logic imports; it sits at the kernel edge.)*

**`game/session.js`** — the shopping-run loop (from `game.js` minus DOM).
- API: `createSession(ctx, bus): { update(dt, locked: boolean): void; tryGrab(): void; readonly list: ListEntry[]; readonly state: { listDone:boolean; done:boolean; time:number }; reset(): void; complete(): void }`.
- Constants: list size 6, reach raycast `REACH 2.7`, fly-to-basket `0.4s`, near-debris cull radius² `20` (≈4.47 m), checkout proximity `2.2 m` to `ctx.checkout` `(-7.65, 11.1)`.
- Publishes: `stock.grabbed {specId, price, fromDebris, x,y,z}`, `list.itemChecked {specId, got, need}`, `list.completed {}`, `run.checkout {items, total, damage, timeMs}`, `run.reset {}`, `hud.prompt`, `hud.banner`, `state.list`, `state.timer`. Consumes: `input.action` (grab/reroll).

**`game/hud.js`** *(new — extracted from `game.js` DOM writes + `index.html` nodes)* — the only module allowed to touch HUD DOM.
- API: `createHud(bus): { flush(): void; setList(l: ListEntry[]): void; setTimer(ms: number): void; prompt(html: string|null): void; banner(html: string, ttl?: number): void; toast(msg: string, ttl?: number): void }`.
- Subscribes to `state.list`, `state.timer`, `hud.prompt`, `hud.banner`, `hud.toast`, `run.checkout`, `list.completed`. Batches all writes into `flush()`, called once per frame after `session.update` — DOM is never touched from inside a system's own `update`.

**`game/modes.js`** *(new)* — mode manager (19.5).

**`game/scenario.js`** *(new)* — scenario runtime (19.5/19.6).

**`audio/sfx.js`** — procedural WebAudio (unchanged `sfx.js`).
- API: `SFX: { start(); toggleMute(): boolean; grab(); tick(); listDone(); checkout(); error(); thud(); crash(); clatter() }`. Target: also subscribe to `audio.cue {cue}` so any layer can request a sound without importing SFX (Ch. 18). Consumes: `input.mute`, `audio.cue`.

---

### 19.3 GameContext — the shared read-model

`buildStore` returns one plain object, the **GameContext** (`world` in shipped code, `store.js:1410`). It is the read-mostly service registry that lets Sim and Game modules cooperate without importing each other (P3). Full field schema is in Ch. 20; the contract summary:

| Field | Type | Writer | Readers |
|---|---|---|---|
| `colliders` | `Collider[]` (AABB `{minX,maxX,minZ,maxZ}`) | store | player, physics |
| `bounds` | `{minX,maxX,minZ,maxZ}` | store | player, physics |
| `stock` | `StockAPI` | store | session, physics |
| `corridors` | `{xs,browseXs,zMin,zMax,crossZ}` | store | characters |
| `staffSpots` | `{x,z,yaw}[]` | store | characters |
| `physicsMeta` | `{gondolas, carts}` | store | physics |
| `checkout` | `Vector3 (-7.65,0,11.1)` | store | session |
| `checkoutRing` | `Mesh` | store | session |
| `spawn` | `Vector3 (0.6,1.65,13.2)` | store | player |
| `physics` | `PhysicsAPI` | bootstrap (attached) | session |
| `getNpcs` | `() => Npc[]` | bootstrap (attached) | physics |
| `update(dt, camera)` | fn | store | loop (as a system) |

Rule: **only `store` and `bootstrap` write context fields**; all other modules treat it as frozen. `Object.freeze` is applied in dev builds to catch violations (19.8).

---

### 19.4 Event bus specification

The bus decouples publishers from consumers so telemetry (Ch. 24), the HUD, audio, and the scenario runtime can tap game events without the emitter knowing they exist. It is **synchronous and allocation-conscious** by design — an async/queued bus would break determinism and churn GC on the iGPU floor.

**API** (`core/bus.js`):
```
createBus(): Bus
Bus.on(topic: string, fn: (payload) => void): () => void   // returns unsubscribe
Bus.once(topic: string, fn): () => void
Bus.off(topic: string, fn): void
Bus.emit(topic: string, payload?): void                    // synchronous dispatch
Bus.peek(topic: string): payload | undefined               // last retained value (state.* topics)
```

**Topics table.** Signal topics are fire-and-forget; `state.*` topics are retained (last value cached, readable via `peek`). Cadence "event" = on occurrence; "frame" = at most once per frame.

| Topic | Publisher(s) | Consumer(s) | Payload | Cadence | Retained |
|---|---|---|---|---|---|
| `boot.progress` | bootstrap | hud(boot bar) | `{loaded:int, total:int}` | event | no |
| `boot.ready` | bootstrap | input, sfx | `{}` | once | yes |
| `boot.error` | bootstrap | hud(overlay) | `{stack:string}` | once | yes |
| `input.action` | input | session, sfx | `{action:'grab'\|'reroll'\|'mute'}` | event | no |
| `input.lock` | input | session, hud | `{locked:bool}` | event | yes(`state.playing`) |
| `input.mute` | input | sfx | `{}` | event | no |
| `player.blocked` | player | physics | `{collider, speed:num, dx:num, dz:num}` | event | no |
| `stock.grabbed` | session | sfx, telemetry | `{specId, price:num, fromDebris:bool, x,y,z}` | event | no |
| `list.itemChecked` | session | hud, sfx | `{specId, got:int, need:int}` | event | no |
| `list.completed` | session | hud, sfx | `{}` | once/run | no |
| `run.checkout` | session | hud, sfx, modes, telemetry | `{items:int, total:num, damage:{count,total}, timeMs:num}` | once/run | yes |
| `run.reset` | session | modes, scenario | `{}` | event | no |
| `physics.impact` | physics | sfx, camera-shake | `{kind:'thud'\|'knock'\|'crash', shake:num}` | event | no |
| `physics.debrisSpawned` | physics | telemetry | `{specId, count:int}` | event | no |
| `physics.gondolaTipped` | physics | hud, sfx, scenario | `{label:string, axis:'x'\|'z', sign:±1}` | event | no |
| `physics.cartCrashed` | physics | sfx, hud | `{}` | event | no |
| `physics.npcBumped` | physics | hud, sfx | `{line:string}` | event | no |
| `damage.added` | physics | session, telemetry | `{specId, amount:num, total:num, count:int}` | event | yes(`state.damage`) |
| `quality.tierChanged` | quality | telemetry, hud | `{tier:'lite'\|'high'\|'lite-locked'\|'panic'}` | once | yes(`state.tier`) |
| `audio.cue` | any | sfx | `{cue:string}` | event | no |
| `hud.prompt` | session | hud | `{html:string\|null}` | frame | yes |
| `hud.banner` | session, scenario | hud | `{html:string, ttl?:num}` | event | no |
| `hud.toast` | physics, scenario | hud | `{msg:string, ttl?:num=2600}` | event | no |
| `state.list` | session | hud | `ListEntry[]` | frame | yes |
| `state.timer` | session | hud | `{ms:num}` | frame(1 Hz gated) | yes |
| `mode.started` | modes | scenario, telemetry | `{modeId:string}` | event | yes |
| `mode.ended` | modes | scenario, telemetry | `{modeId, result:Result}` | event | yes |
| `scenario.objectiveMet` | scenario | hud, modes | `{id:string}` | event | no |
| `scenario.failed` | scenario | modes, hud | `{reason:string}` | event | no |
| `system.faulted` | loop | telemetry, hud | `{name:string, error:string}` | event | no |

**Delivery guarantees:**

- **D1 — Synchronous, ordered.** `emit` invokes every current subscriber, in subscription order, before returning. No queue, no `setTimeout`, no microtask. Event order across a frame is therefore fully determined by the pipeline order (19.7) plus the seeded RNG.
- **D2 — Exactly once per subscriber** per `emit`; a handler added during dispatch does **not** receive the in-flight event (subscriber list is snapshotted at emit start).
- **D3 — Fault isolation.** A throwing subscriber is caught; the error is pushed to `window.__busErrors` and delivery continues to the remaining subscribers. One bad listener never silences a topic.
- **D4 — Transient payloads.** Payload objects may be pooled/reused by the emitter after `emit` returns; subscribers must copy any value they intend to retain. `state.*` payloads are the exception — they are treated as immutable snapshots and cached for `peek`.
- **D5 — Re-entrancy capped.** Nested `emit` (a handler emits another topic) is allowed to a depth of **8**; exceeding it throws `BusCycleError` (caught by the loop's circuit breaker) to surface accidental feedback loops.
- **D6 — No wildcards on the hot path.** Topics are string constants from a frozen `TOPICS` map; there is no pattern subscription. A dev-only `Bus.onAny(fn)` tap exists for the telemetry recorder (Ch. 24) and is compiled out of prod.
- **D7 — Retained-topic read.** `peek('state.tier')` returns the last emitted value or `undefined`; used by the HUD to initialize without waiting for the next emit.

---

### 19.5 Mode manager & scenario runtime

A **Mode** is a ruleset (Ch. 2): Free Play, Timed Dash, Budget Run, No-Damage, Career Shift, etc. A **Scenario** is the data for one authored instance of a mode — a Career Shift (Ch. 3, all 40) is a scenario JSON interpreted at runtime. The mode manager owns *which rules are live*; the scenario runtime owns *the authored beats inside them*.

**`game/modes.js` API:**
```
createModes(ctx, bus): {
  register(mode: Mode): void
  enter(modeId: string, params?: object): void
  tick(dt: number): void
  handle(topic: string, payload): void   // wired to bus.onAny in dev / explicit subs in prod
  current(): Mode | null
  exit(result: Result): void
}
```

**Mode lifecycle hooks** (each optional; called by the manager in this order):

| Hook | Signature | When | Typical work |
|---|---|---|---|
| `onRegister` | `(ctx) => void` | at boot, once | validate ruleset, prewarm assets |
| `onEnter` | `(ctx, params) => void` | on `enter()` | reset session, set list rules, seed scenario |
| `onStart` | `(ctx) => void` | after countdown / first pointer-lock | start timer, `emit mode.started` |
| `onTick` | `(ctx, dt) => void` | every frame while active | drive scenario runtime, decrement timers |
| `onEvent` | `(ctx, topic, payload) => void` | per bus event | react to `run.checkout`, `damage.added`, etc. |
| `onEvaluate` | `(ctx) => { complete:bool, failed:bool, score:number }` | end of each `onTick` | win/lose/score decision |
| `onExit` | `(ctx, result) => void` | on `exit()` | `emit mode.ended`, freeze HUD |
| `onCleanup` | `(ctx) => void` | before next `enter` | dispose scenario, remove spawned actors |

Invariant: exactly one mode is active between `onStart` and `onExit`. `Free Play` (the shipped behavior) is registered as the default mode whose `onEvaluate` never sets `complete/failed` — so the shipped endless run is just "the mode that never ends," and nothing about the current loop changes when modes are absent.

**`game/scenario.js` API:**
```
createScenario(ctx, bus): {
  load(json: ScenarioDoc): void
  tick(dt: number): void
  reset(): void
  vars: Record<string, number|string|boolean>   // the blackboard
  dispose(): void
}
```

The runtime holds a **blackboard** (`vars`), a list of compiled **triggers**, an **objective** table, and named **timers**. Its `tick` is called from the active mode's `onTick`. Each tick: advance timers, then evaluate triggers whose `when` condition is satisfied (respecting `once`), and execute their `do` action list. Bus events are latched into a per-frame set so `event`-type conditions can be tested during the same tick they arrive. **Budget guard:** at most **32 trigger evaluations per frame**; overflow defers to the next frame (keeps 19.7's scenario slot bounded).

---

### 19.6 Scenario scripting format

Scenarios are declarative JSON — no code, so Career Shifts (Ch. 3) are pure data and hot-reloadable in dev. Top-level document:

```json
{
  "id": "shift_07_friday_rush",
  "mode": "timed",
  "title": "Friday Rush",
  "seed": 4471,
  "timeLimitMs": 180000,
  "vars": { "budget": 60, "vipPatience": 3 },
  "spawn": { "player": [0.6, 1.65, 13.2] },
  "list": { "size": 8, "sections": ["pantry","dairy","frozen"] },
  "objectives": [
    { "id": "fill", "desc": "Fill the 8-item list", "required": true },
    { "id": "clean", "desc": "Zero shelf damage", "required": false }
  ],
  "triggers": [
    { "id": "t_halfway", "once": true,
      "when": { "count": { "of": "listGot", "op": ">=", "value": 4 } },
      "do": [ { "toast": { "msg": "Halfway — clock's ticking!" } } ] },
    { "id": "t_mess", "once": false,
      "when": { "event": { "topic": "physics.gondolaTipped" } },
      "do": [ { "addVar": { "name": "vipPatience", "by": -1 } },
              { "sound": { "cue": "error" } } ] }
  ],
  "onWin": [ { "banner": { "html": "Shift complete!" } }, { "win": {} } ],
  "onLose": [ { "banner": { "html": "Out of time." } }, { "lose": { "reason": "timeout" } } ]
}
```

**Condition (`when`) vocabulary** — full set:

| Op | Params | Meaning |
|---|---|---|
| `event` | `{ topic:string, match?:object }` | true the frame `topic` fired (and payload ⊇ `match`) |
| `all` | `Cond[]` | logical AND |
| `any` | `Cond[]` | logical OR |
| `not` | `Cond` | logical NOT |
| `var` | `{ name, op, value }` — op ∈ `== != < <= > >= in` | blackboard comparison (`in` takes an array) |
| `timer` | `{ name?:string='run', op, ms:number }` | named timer elapsed vs `ms` |
| `count` | `{ of:'debris'\|'listGot'\|'listTotal'\|'damageCount'\|'npcNear', op, value }` | live-count comparison |
| `zone` | `{ actor:'player'\|'cart:N'\|'npc:N', shape:'box'\|'circle', box?, center?, r? }` | actor inside region |
| `distance` | `{ a:Actor, b:Actor\|[x,z], op, value }` | planar distance test |
| `random` | `{ p:number }` | seeded chance (uses scenario `seed` LCG) |
| `every` | `{ ms:number }` | true once per `ms` interval |
| `objective` | `{ id, state:'met'\|'unmet' }` | objective status test |

**Action (`do`) vocabulary** — full set; a `do` is an ordered list, executed top-to-bottom, `wait` sequences it:

| Op | Params | Effect |
|---|---|---|
| `emit` | `{ topic, payload? }` | raise a bus event |
| `setVar` | `{ name, value }` | assign blackboard |
| `addVar` | `{ name, by:number }` | increment/decrement |
| `toast` | `{ msg, ttl?=2600 }` | `hud.toast` |
| `banner` | `{ html, ttl? }` | `hud.banner` |
| `sound` | `{ cue }` | `audio.cue` |
| `objective` | `{ id, state:'complete'\|'fail'\|'reveal' }` | mutate objective |
| `setList` | `{ specIds:string[] }` | replace the shopping list |
| `addListItem` | `{ specId }` | append one list item |
| `setPrice` | `{ specId, price:number }` | override catalog price for this run |
| `spawnDebris` | `{ specId, at:[x,y,z], count?=1 }` | inject floor clutter via physics |
| `spawnNpc` | `{ archetype, at:[x,z], path? }` | add a shopper/actor |
| `tipGondola` | `{ label, sign:±1 }` | force-tip an aisle |
| `move` | `{ actor, to:[x,z], speed:number }` | scripted actor motion |
| `lockCheckout` | `{ locked:boolean }` | gate the checkout ring |
| `camera` | `{ shake:number }` | add camera shake |
| `wait` | `{ ms:number }` | pause the remaining actions in this list |
| `win` | `{}` | mark scenario complete |
| `lose` | `{ reason:string }` | mark scenario failed |
| `goto` | `{ scenarioId:string }` | chain to another scenario |
| `log` | `{ msg:string }` | dev console (compiled out of prod) |

Actors resolve as `player`, `cart:N`, `npc:N`, or a literal `[x,z]`. The interpreter validates every op/param against these tables at `load()` and throws `ScenarioSchemaError` on unknown keys — a malformed shift never reaches the frame loop.

---

### 19.7 Frame pipeline order & per-system budgets

One `requestAnimationFrame` per frame, `dt = min(clock.getDelta(), 0.05)` (the 50 ms clamp lets the sim survive a background-tab stall without exploding). Systems run in a **fixed array order**; the render submit is always last. Budgets are CPU-side, per frame, at the 60 fps target (16.67 ms wall). GPU cost is Ch. 21's remit — the CPU budget deliberately stays ≤ ~4 ms so the frame is GPU-bound and the quality tiers (19.1/`core/quality`) can trade fidelity for headroom.

| # | Stage | Module | lite (ms) | high (ms) | Hard cap | Notes |
|---|---|---|---|---|---|---|
| 0 | input pump | `core/input` | 0.00 | 0.00 | — | event-driven; drains OS queue → bus between frames |
| 1 | quality sample | `core/quality` | 0.00 | 0.00 | 0.05 | real work only on frames 3 and 20–80 |
| 2 | player update | `sim/player` | 0.12 | 0.12 | 0.30 | WASD + AABB scan of ~90 colliders; may emit `player.blocked` |
| 3 | physics update | `sim/physics` | 0.60 | 0.60 | 1.50 | carts + debris ballistics (≤100) + gondola anim + NPC bump; drains ≤9 spawns/frame |
| 4 | world update | `world/store` | 0.03 | 0.03 | 0.10 | sliding doors + checkout-ring pulse |
| 5 | characters update | `sim/characters` | 0.55 | 0.55 | 1.20 | 13 `AnimationMixer` ticks + pathing |
| 6 | modes tick | `game/modes` | 0.02 | 0.02 | 0.10 | lifecycle + `onEvaluate` |
| 7 | scenario tick | `game/scenario` | 0.05 | 0.10 | 0.20 | ≤32 trigger evals/frame |
| 8 | session update | `game/session` | 0.25 | 0.30 | 0.60 | hover raycast (`REACH 2.7`) + near-debris cull + flyers |
| 9 | hud flush | `game/hud` | 0.05 | 0.05 | 0.20 | single batched DOM write from retained `state.*` |
| 10 | render | `render/renderer` | 1.8 | 2.4 | — | `composer.render()`; GPU 8–14 ms lite / 12–18 ms high |
| — | **CPU subtotal (1–9)** | | **≈1.67** | **≈1.87** | **~4.0** | leaves the rest of the 16.67 ms budget for GPU |

Ordering rationale: **input before player** (movement reads fresh keys); **player before physics** (`player.blocked` must be emitted so physics can route the impact the same frame); **physics before session** (grabbing a just-spawned debris piece works within one frame); **modes/scenario before session** so a scripted `setList`/`lockCheckout` takes effect before the session evaluates checkout; **hud flush after session** so the DOM reflects this frame's state exactly once; **render last, always**. The shipped order (`autoQuality → move → physics → world → shoppers → game → render`, `main.js:205–216`) is the same skeleton — the target inserts input(0), modes(6), scenario(7), hud(9) into the existing gaps without reordering the shipped stages.

---

### 19.8 Error-handling policy

Three severity tiers, matching the shipped code's existing behavior and generalizing it:

**Tier 1 — Fatal (boot chain).** The synchronous portion of `boot()` (renderer creation, store build, first stock instancing) is wrapped in one root try/catch (shipped: `main.js:23/233`). On throw: set `window.__err = e.stack`, `emit boot.error`, render a full-screen `<pre>` overlay (fixed, inset 0, `#f77` on `#111`, monospace 12 px, `z-index:99`), set the boot message to "Error — see console". The game does not start. This is the only place a throw stops the product.

**Tier 2 — Degradable (async subsystems).** Every optional load fails **soft** so the "always playable" invariant (P5, mirroring the drag-look fallback) holds:

| Subsystem | Failure | Fallback | Log hook |
|---|---|---|---|
| `render/env` | HDRI 404/decode | flat ambient from lights only | `window.__err = 'env: '+e` |
| `render/models` | no `manifest.json` / bad GLB | procedural packaging for every SKU | `console.warn('[models] …')` |
| `sim/characters` | avatar load or retarget fails | that avatar is skipped; empty cast → no NPCs | `window.__retargetLog[]` |
| `audio/sfx` | `AudioContext` blocked | silent game | `ensure()` returns false |
| scenario `load` | schema error | scenario disabled, mode falls back to Free Play | `window.__err` + overlay-free toast |

The retargeter's numeric sanity gate (span 1.15–2.3 m, head 1.25–2.1 m; `characters.js:225–236`) is the archetype: **validate the output, reject bad results, degrade gracefully** rather than ship "pretzel people."

**Tier 3 — Per-frame (hot loop).** `core/loop` wraps each system's `update(dt)` in a guarded call. A throwing system increments a fault counter; after **3 consecutive throws** the system is disabled (`enabled=false`), `emit system.faulted {name,error}` fires, and the RAF loop continues with the remaining systems — a single misbehaving subsystem degrades the game, it never freezes it. Counters reset on a clean frame.

**Bus** faults are isolated per D3 (`window.__busErrors`). **Assertions:** a dev-only `invariant(cond, msg)` and `Object.freeze(ctx)` run under `import.meta.env.DEV` and are dead-code-eliminated by Vite in prod. **Debug namespace** (stable public surface for Ch. 23 tests and Ch. 24 telemetry; extends the shipped `window.__*` set at `main.js:226–232`):

| Hook | Purpose |
|---|---|
| `__err` | last fatal/degradable error string |
| `__retargetLog[]` | per-avatar retarget outcomes |
| `__busErrors[]` | isolated subscriber exceptions |
| `__faults{}` | per-system fault counts |
| `__tier` | current quality tier |
| `__scene/__camera/__renderer/__world/__physics/__game` | live references for framebuffer-grid verification |
| `__ready` | boot-complete flag |

---

### 19.9 Code style & lint rules

The style is already consistent across the shipped 11 files; this codifies it as enforceable config so the 21-module target does not drift.

**Language & format.** ES modules only (`"type":"module"`), Vite `target: es2022`. Prettier: `printWidth: 120`, `singleQuote: true`, `semi: true`, `trailingComma: 'es5'`, `arrowParens: 'always'`, 2-space indent. No TypeScript in the runtime — JSDoc-style comment headers on every module explaining *why* (the shipped files lead with a rationale block; keep it).

**Naming.** Factories `createX`/`buildX`; module-level constants `UPPER_SNAKE` (`TIP_SPEED`, `DEBRIS_CAP`); functions/vars `camelCase`; private module-scoped scratch objects prefixed `_` (`_v`, `_m`, `_q`, `_ndc`); bus topics are `dot.separated` string constants in a frozen `TOPICS` map. No classes, no `this`-bearing prototypes — closures only.

**ESLint ruleset:**

| Rule | Setting | Why |
|---|---|---|
| `eqeqeq` | `['error','always']` | no coercion surprises |
| `prefer-const` / `no-var` | error | immutable-by-default |
| `no-unused-vars` | error (args `after-used`) | dead-code hygiene |
| `import/order` | error, groups by layer L0→L4 | readable dependency direction |
| `import/no-restricted-paths` | error | enforce P1 (no upward imports); zones = the five layers |
| `max-params` | `['warn', 4]` | favors `({…})` option objects (see `createPhysics({scene,world,camera})`) |
| `no-alloc-in-update` *(custom)* | error | bans `new`, array/object literals, and `.map/.filter` inside any function named `update`/`tick`/`animate` — enforces the scratch-object pattern (P4) |
| `no-console` | `['warn',{allow:['warn','error']}]` | `log` actions and dev taps only |
| `no-restricted-globals` | error on `window.__*` outside the debug-hook module | keep the debug surface centralized |
| `no-floating-promises` *(via `promise/catch-or-return`)* | error | every async load must `.catch` to a degrade path (Tier 2) |

**Allocation conventions (P4, non-lintable specifics):** raycasters, `Vector3`/`Matrix4`/`Quaternion` temporaries, and reusable arrays (`_nearDebris`, `debrisMeshList`) are created once at module or closure scope and mutated in place; `debrisMeshes` is a **stable reference rebuilt in-place** so the session's per-frame read never re-subscribes. Materials and geometries are cached by key (`_matCache`, `_geoCache`, `_texCache`) and **never mutated after creation**. These three caches are the reason thousands of runtime product builds (debris, flyers) cost near-zero shader churn.

---

### 19.10 Migration waves (cross-reference Ch. 25)

The 11→21 split is staged so shipped behavior is byte-for-byte preserved at each checkpoint (Ch. 25 Waves 3–6): **(W3)** extract `core/bus` + `core/rng` and route existing direct calls (`onPlayerBlocked`, SFX triggers) through them behind a compatibility shim; **(W4)** carve `render/renderer`, `core/loop`, `core/quality`, `core/input`, `sim/player` out of `main.js`, leaving `bootstrap` as the composition root; **(W5)** split `store.js` into `store`/`fixtures`/`dressing` and move `shoppingCart` down a layer to fix the one P1 violation; **(W6)** land `game/hud`, `game/modes`, `game/scenario` and register Free Play as the default mode. Each wave ships independently; the frame pipeline (19.7) and the GameContext contract (19.3) are the stable seams that make that possible.



# Chapter 20 — Data Schemas & Persistence

This chapter is the contract for every byte *Grocery Dash 3D* writes to disk. The shipped game (Ch. 19) is a pure browser client with **no backend and no persistence at all today** — every run is generated fresh from a hard-coded seed of `1337` and forgotten on refresh. This chapter defines the additive persistence layer that turns that stateless demo into a career: profiles, settings, unlocks, best times, achievements, and shareable ghosts. Everything here is **strictly optional and additive** — a browser with `localStorage` disabled (private mode, storage-blocked iframe) must still boot, play, and reroll exactly as it does now. No schema below is ever a load-bearing dependency of the render loop.

Two hard invariants govern the whole chapter:

1. **Everything persisted is JSON.** No binary blobs in storage except the base64 export envelope (§20.13) and the packed ghost stream (§20.10), both of which are JSON-string-safe.
2. **Everything persisted is versioned and recoverable.** A save that fails to parse or validate never bricks the game; it demotes to a backup slot or to defaults (§20.12).

All schemas are JSON Schema **draft-07**. Runtime validation uses a hand-rolled 3 KB validator (Ch. 19 `persist` module) — not a 120 KB library — that reads exactly these documents. Fields marked **SHIPPED** exist in `src/products.js` / `src/store.js` today and their shapes must not change; fields marked **ADDITIVE** are new to the persistence layer and always carry a default so a shipped-shape object still validates.

---

### 20.1 Persistence topology & namespace

Every key this game touches lives under the reserved prefix **`gd3d:`**. Nothing outside that prefix is read or written, so the game coexists with any host page. The full key map is §20.11. The logical object graph is:

| Object | Cardinality | Owner module (Ch. 19) | Persisted? |
|---|---|---|---|
| SKU (§20.2) | 52 shipped → 150 target (Ch. 16) | `products` | No — code constant, not saved |
| Scenario/Shift (§20.3) | 40 (Ch. 3) | `shifts` | No — code constant |
| Store-layout (§20.4) | 1 shipped → N (Ch. 14/15) | `store` | No — code constant, hashed into seed |
| NPC archetype (§20.5) | 4 roles (Ch. 17) | `characters` | No — code constant |
| Achievement (§20.6) | ~48 (Ch. 5) | `achievements` | Definition no / state yes |
| Settings (§20.7) | 1 per profile | `persist` | **Yes** |
| Save-game (§20.8) | 1 root doc | `persist` | **Yes** |
| Run-record (§20.9) | ring of 50 | `persist` | **Yes** |
| Ghost-lite (§20.10) | 1 per shift best | `persist` | **Yes** |

SKUs, shifts, layouts and archetypes are **content, not save data** — they ship inside the JS bundle and are enumerated as schemas here so the migration, validation, and (optional, Ch. 24) backend tooling share one source of truth. Only the four lower rows ever hit `localStorage`.

---

### 20.2 SKU schema

The shipped SKU is the object literal in `PRODUCTS` (`src/products.js`, 52 entries). Required keys are `id, brand, name, kind, price, bg1, bg2, section`; the label renderer defaults `ink → "#fff"`, `accent → "#ffcc33"`, `weight → "500 g"`, `modelH → 0.1`. The `kind` enum has exactly **13** members and `section` exactly **11**, both enumerated in full below. ADDITIVE fields (`points`, `mass`, `fragile`, `rarity`, `tags`) support Ch. 4 scoring and Ch. 22 physics without altering any shipped record.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/sku",
  "title": "SKU",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "brand", "name", "kind", "price", "bg1", "bg2", "section"],
  "properties": {
    "id":      { "type": "string", "pattern": "^[a-z0-9_]{2,32}$" },
    "brand":   { "type": "string", "minLength": 1, "maxLength": 24 },
    "name":    { "type": "string", "minLength": 1, "maxLength": 28 },
    "kind":    { "type": "string", "enum": ["box","boxwide","boxtall","boxbig","jar","can","bottle","bag","carton","cup","tub","produce","ball"] },
    "section": { "type": "string", "enum": ["pantry","snacks","household","dairy","bakery","frozen","electronics","home","toys","pharmacy","produce"] },
    "price":   { "type": "number", "minimum": 0, "maximum": 9999, "multipleOf": 0.01 },
    "bg1":     { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
    "bg2":     { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
    "ink":     { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ffffff" },
    "accent":  { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$", "default": "#ffcc33" },
    "tag":     { "type": "string", "maxLength": 20, "default": "" },
    "weight":  { "type": "string", "maxLength": 12, "default": "500 g" },
    "model":   { "type": "string", "pattern": "^prod_[a-z0-9_]+$" },
    "modelH":  { "type": "number", "exclusiveMinimum": 0, "maximum": 1.0, "default": 0.1 },
    "points":  { "type": "integer", "minimum": 1, "maximum": 500, "default": 10 },
    "mass":    { "type": "number", "exclusiveMinimum": 0, "maximum": 40, "default": 0.4 },
    "fragile": { "type": "boolean", "default": false },
    "rarity":  { "type": "string", "enum": ["common","uncommon","rare","special"], "default": "common" },
    "tags":    { "type": "array", "items": { "type": "string", "maxLength": 16 }, "maxItems": 6, "default": [] }
  },
  "dependencies": { "model": ["modelH"] }
}
```

**Catalog integrity rules** (validated once at boot by `products.validate()`):

| Rule | Value |
|---|---|
| `id` uniqueness | All `id` values distinct across the catalog |
| Section coverage (shipped) | pantry 10, snacks 7, household 4, dairy 4, bakery 3, frozen 2, electronics 5, home 4, toys 4, pharmacy 3, produce 6 — total **52** |
| `model` present ⇒ file exists | `hasModel(spec.model)` may be false; the builder falls back to procedural geometry, so a missing kit is non-fatal |
| `points` default derivation | If omitted, scoring (Ch. 4) computes `round(price × 2.2)` clamped to `[1,500]` at load — never written back into the SKU |
| `mass` default derivation | If omitted, physics (Ch. 22) uses `0.4` kg for packaged goods, matching the shipped debris `spec.price × 0.4` damage coupling only by coincidence of constant — the two `0.4`s are unrelated |

The SKU document is the **canonical `id` registry**: run-records, ghosts, and save stats reference SKUs only by `id`, never by index, so catalog reordering (Ch. 16 growth from 52 → 150) never invalidates a save.

---

### 20.3 Scenario / Shift schema

A **shift** (Ch. 3 defines all 40) is a named, self-contained run configuration: which mode ruleset (Ch. 2), how big the list, whether there's a clock, which catalog subset is eligible, and what modifiers warp the physics or economy. Shifts are content constants; only their *outcomes* (best time, unlock state) are saved. The `seedPolicy` field is the bridge to §20.14 — it declares whether the run is reproducible (`"fixed"`/`"daily"`) or throwaway (`"random"`).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/shift",
  "title": "Scenario/Shift",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "mode", "listSize", "seedPolicy"],
  "properties": {
    "id":       { "type": "string", "pattern": "^shift_[a-z0-9_]{2,28}$" },
    "name":     { "type": "string", "minLength": 1, "maxLength": 40 },
    "subtitle": { "type": "string", "maxLength": 60, "default": "" },
    "mode":     { "type": "string", "enum": ["classic","timeattack","sweep","careful","chaos","blackout","vip"] },
    "listSize": { "type": "integer", "minimum": 1, "maximum": 24, "default": 6 },
    "layoutId": { "type": "string", "pattern": "^layout_[a-z0-9_]+$", "default": "layout_supercenter" },
    "timeLimitMs":  { "type": ["integer","null"], "minimum": 0, "default": null },
    "parTimesMs":   {
      "type": "object", "additionalProperties": false,
      "properties": {
        "gold":   { "type": "integer", "minimum": 0 },
        "silver": { "type": "integer", "minimum": 0 },
        "bronze": { "type": "integer", "minimum": 0 }
      },
      "required": ["gold","silver","bronze"]
    },
    "catalogFilter": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "sections": { "type": "array", "items": { "type": "string" }, "default": [] },
        "includeIds": { "type": "array", "items": { "type": "string" }, "default": [] },
        "excludeIds": { "type": "array", "items": { "type": "string" }, "default": [] }
      }
    },
    "modifiers": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "damageMult":   { "type": "number", "minimum": 0, "maximum": 5, "default": 1.0 },
        "sprintLocked": { "type": "boolean", "default": false },
        "npcDensity":   { "type": "number", "minimum": 0, "maximum": 3, "default": 1.0 },
        "reachMult":    { "type": "number", "minimum": 0.5, "maximum": 2, "default": 1.0 },
        "fogNear":      { "type": "number", "default": 24 },
        "fogFar":       { "type": "number", "default": 46 }
      }
    },
    "seedPolicy":  { "type": "string", "enum": ["fixed","daily","random"], "default": "random" },
    "fixedSeed":   { "type": "integer", "minimum": 1, "maximum": 2147483646 },
    "reward": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "xp":       { "type": "integer", "minimum": 0, "default": 100 },
        "currency": { "type": "integer", "minimum": 0, "default": 0 },
        "unlocks":  { "type": "array", "items": { "type": "string" }, "default": [] }
      }
    },
    "unlockRequires": { "type": "array", "items": { "type": "string" }, "default": [] }
  },
  "if": { "properties": { "seedPolicy": { "const": "fixed" } } },
  "then": { "required": ["fixedSeed"] }
}
```

The shipped default run is expressible as one shift record — `{"id":"shift_classic","mode":"classic","listSize":6,"seedPolicy":"random","layoutId":"layout_supercenter"}` — matching `createGame`'s 6-item `genList()` (`src/game.js`). `mode` values map to Ch. 2 rulesets: `classic` (no clock, damages billed), `timeattack` (`timeLimitMs` set), `sweep` (large list, whole sections), `careful` (`damageMult ≥ 2`), `chaos` (`npcDensity`↑, low tip threshold), `blackout` (fog collapsed to `fogFar 12`), `vip` (single rare SKU).

---

### 20.4 Store-layout schema

The layout descriptor is the data form of `STORE` + everything `buildStore` returns (`src/store.js`): interior dimensions, the seeded fixture list, static colliders, walk bounds, the NPC corridor graph, staff posts, the checkout point, and the player spawn. It is a **code constant today** (the store is procedurally assembled, not data-driven), but it is schematized here because (a) the layout's structural hash feeds the deterministic seed (§20.14), and (b) Ch. 14/15 add alternate layouts that must round-trip through the same validator. All coordinates are metres in the world frame; aisles run along **Z**.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/layout",
  "title": "Store-layout",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "dims", "bounds", "spawn", "checkout", "fixtures", "colliders", "corridors"],
  "properties": {
    "id":   { "type": "string", "pattern": "^layout_[a-z0-9_]+$" },
    "dims": {
      "type": "object", "additionalProperties": false,
      "required": ["w","d","h"],
      "properties": {
        "w": { "type": "number", "const": 46 },
        "d": { "type": "number", "const": 30 },
        "h": { "type": "number", "const": 4.2 }
      }
    },
    "spawn":    { "$ref": "#/$defs/vec3" },
    "checkout": { "$ref": "#/$defs/vec2" },
    "bounds": {
      "type": "object", "additionalProperties": false,
      "required": ["minX","maxX","minZ","maxZ"],
      "properties": {
        "minX": { "type": "number", "const": -22.55 },
        "maxX": { "type": "number", "const":  22.55 },
        "minZ": { "type": "number", "const": -14.55 },
        "maxZ": { "type": "number", "const":  14.5 }
      }
    },
    "fixtures": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["kind","cx","cz"],
        "properties": {
          "kind":  { "type": "string", "enum": ["gondola","wallshelf","freezer","produce","tvwall","apparel","toys","pharmacy","endcap","pallet","checkoutrack"] },
          "cx":    { "type": "number" },
          "cz":    { "type": "number" },
          "len":   { "type": "number", "minimum": 0 },
          "axis":  { "type": "string", "enum": ["x","z"], "default": "z" },
          "label": { "type": "string", "maxLength": 3 },
          "tippable": { "type": "boolean", "default": false },
          "sections": {
            "type": "array",
            "items": { "type": "array", "items": { "type": "string" }, "minItems": 4, "maxItems": 4 }
          }
        }
      }
    },
    "colliders": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["minX","maxX","minZ","maxZ"],
        "properties": {
          "minX": { "type": "number" }, "maxX": { "type": "number" },
          "minZ": { "type": "number" }, "maxZ": { "type": "number" }
        }
      }
    },
    "corridors": {
      "type": "object", "additionalProperties": false,
      "required": ["xs","zMin","zMax"],
      "properties": {
        "xs":       { "type": "array", "items": { "type": "number" }, "default": [-20,-16,-12,-8,-4,0,18] },
        "browseXs": { "type": "array", "items": { "type": "number" }, "default": [-16,-12,-8,-4] },
        "zMin":     { "type": "number", "const": -12.4 },
        "zMax":     { "type": "number", "const": 7.6 },
        "crossZ":   { "type": "array", "items": { "type": "number" }, "default": [8.2,-13.0] }
      }
    },
    "staffSpots": {
      "type": "array",
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["x","z","yaw"],
        "properties": { "x": { "type": "number" }, "z": { "type": "number" }, "yaw": { "type": "number" } }
      }
    }
  },
  "$defs": {
    "vec2": { "type": "object", "required": ["x","z"], "properties": { "x": { "type":"number" }, "z": { "type":"number" } } },
    "vec3": { "type": "object", "required": ["x","y","z"], "properties": { "x": { "type":"number" }, "y": { "type":"number" }, "z": { "type":"number" } } }
  }
}
```

The shipped `layout_supercenter` populates these exact constants: `dims {46,30,4.2}`, `spawn {0.6,1.65,13.2}`, `checkout {x:-7.65,z:11.1}`, `bounds {-22.55,22.55,-14.55,14.5}`, `corridors.xs [-20,-16,-12,-8,-4,0,18]`, and **8 tippable gondola fixtures** (labels `"1".."8"`: four grocery islands at `cx -18/-14/-10/-6, cz -3, axis z, len 16`; two merch islands at `cx 10, cz -7.5/-3.5, axis x, len 12`; one toy island at `cx 19.5, cz -2, axis z, len 10`). The five staff posts match `staffSpots` in `buildStore`.

---

### 20.5 NPC archetype schema

Archetypes are the templates `createShoppers` (`src/characters.js`) instantiates — 8 spawns drawn from a 13-avatar cast, split into walkers, cart-pushers, browsers, and static staff. The archetype captures the *behaviour envelope* (speed/pause ranges, roam vs. browse, bark set) rather than a live NPC instance. Live-instance fields (`x, z, yaw, path, shove, shoveCd`) are transient and **never persisted**.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/npc-archetype",
  "title": "NPC-archetype",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "role", "count"],
  "properties": {
    "id":    { "type": "string", "pattern": "^npc_[a-z0-9_]+$" },
    "role":  { "type": "string", "enum": ["walker","cart_pusher","browser","staff"] },
    "count": { "type": "integer", "minimum": 0, "maximum": 32 },
    "avatarPool": { "type": "array", "items": { "type": "string" }, "default": [] },
    "speedRange": {
      "type": "array", "items": { "type": "number", "minimum": 0, "maximum": 3 },
      "minItems": 2, "maxItems": 2, "default": [0.8, 1.2]
    },
    "pauseRange": {
      "type": "array", "items": { "type": "number", "minimum": 0 },
      "minItems": 2, "maxItems": 2, "default": [0, 2]
    },
    "browsing":  { "type": "boolean", "default": false },
    "pushesCart":{ "type": "boolean", "default": false },
    "spawnXs":   { "type": "array", "items": { "type": "number" } },
    "barkSet":   { "type": "string", "enum": ["bump","crash","idle","staff"], "default": "bump" },
    "shoveCooldownS": { "type": "number", "minimum": 0, "default": 1.3 }
  }
}
```

The shipped population resolves to four archetype records: `walker` (count 4, `speedRange [0.8,1.2]`, `pauseRange [0,2]`), `cart_pusher` (count 2 — the `i===1||i===4` walkers), `browser` (count 2, `browsing true`, `pauseRange [Infinity]` modelled as `pause: null`), and `staff` (count 5, stationary at `staffSpots`). `barkSet: "bump"` maps to the shipped `BUMP_LINES` array; `"crash"` to `CRASH_LINES` (`src/physics.js`). Bark *text* is content (Ch. 17), keyed by `barkSet`, not stored per-NPC.

---

### 20.6 Achievement schema

Achievements (Ch. 5 defines the full set of ~48) split cleanly into **definition** (content constant, this schema) and **state** (per-profile, embedded in the save at §20.8). A definition is a pure predicate over lifetime/aggregate stats plus a trigger the run loop can evaluate.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/achievement",
  "title": "Achievement",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "name", "description", "trigger"],
  "properties": {
    "id":          { "type": "string", "pattern": "^ach_[a-z0-9_]{2,32}$" },
    "name":        { "type": "string", "minLength": 1, "maxLength": 40 },
    "description": { "type": "string", "minLength": 1, "maxLength": 120 },
    "icon":        { "type": "string", "maxLength": 4, "default": "🏆" },
    "tier":        { "type": "string", "enum": ["bronze","silver","gold","platinum"], "default": "bronze" },
    "points":      { "type": "integer", "minimum": 0, "maximum": 100, "default": 10 },
    "hidden":      { "type": "boolean", "default": false },
    "repeatable":  { "type": "boolean", "default": false },
    "trigger": {
      "type": "object", "additionalProperties": false,
      "required": ["metric", "op", "value"],
      "properties": {
        "metric": {
          "type": "string",
          "enum": ["runs_completed","total_items","best_time_ms","fastest_shift_ms","total_damage_dollars",
                   "zero_damage_runs","gondolas_tipped","carts_tipped","npcs_bumped","debris_grabbed",
                   "distinct_skus_grabbed","lists_completed_no_reroll","daily_streak","currency_total"]
        },
        "op":    { "type": "string", "enum": [">=", "<=", "==", ">", "<"] },
        "value": { "type": "number" },
        "shiftId": { "type": "string" },
        "window":  { "type": "string", "enum": ["lifetime","single_run","session"], "default": "lifetime" }
      }
    }
  }
}
```

Example definition (verbatim): `{"id":"ach_no_break","name":"Careful Shopper","description":"Complete a run with zero store damages.","icon":"🕊️","tier":"silver","points":20,"trigger":{"metric":"total_damage_dollars","op":"==","value":0,"window":"single_run"}}`. This maps directly onto the shipped `world.physics.damage.total` readout in `complete()` (`src/game.js`). The evaluator runs once per `complete()` and once per stat mutation; achievement **state** (unlocked flag + timestamp + progress counter) is written to the save, never the definition.

---

### 20.7 Settings schema

Settings mirror the tunables that already exist in code but are currently constants: audio master gain `0.45` (`src/sfx.js`), pixel-ratio cap `1.25` and look sensitivity `0.0042` (`src/main.js`), camera-shake magnitude, and the quality-tier override for the progressive renderer (Ch. 21). Accessibility keys serve Ch. 11. This is the one document a user edits directly through the options screen (Ch. 6).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/settings",
  "title": "Settings",
  "type": "object",
  "additionalProperties": false,
  "required": ["version"],
  "properties": {
    "version": { "type": "integer", "const": 4 },
    "audio": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "masterVolume": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.45 },
        "muted":        { "type": "boolean", "default": false }
      }
    },
    "graphics": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "tierOverride":  { "type": "string", "enum": ["auto","lite","lite-locked","high","panic"], "default": "auto" },
        "pixelRatioCap": { "type": "number", "minimum": 0.5, "maximum": 3, "default": 1.25 },
        "bloom":         { "type": "boolean", "default": true },
        "gtao":          { "type": "string", "enum": ["auto","on","off"], "default": "auto" }
      }
    },
    "controls": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "lookSensitivity": { "type": "number", "minimum": 0.001, "maximum": 0.02, "default": 0.0042 },
        "invertY":         { "type": "boolean", "default": false },
        "sprintToggle":    { "type": "boolean", "default": false },
        "fovDeg":          { "type": "number", "minimum": 55, "maximum": 90, "default": 62 }
      }
    },
    "accessibility": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "reducedMotion":  { "type": "boolean", "default": false },
        "cameraShake":    { "type": "number", "minimum": 0, "maximum": 1, "default": 1.0 },
        "highContrast":   { "type": "boolean", "default": false },
        "colorblind":     { "type": "string", "enum": ["none","protanopia","deuteranopia","tritanopia"], "default": "none" },
        "barkSubtitles":  { "type": "boolean", "default": true },
        "crosshairScale": { "type": "number", "minimum": 0.5, "maximum": 3, "default": 1.0 }
      }
    },
    "gameplay": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "units":       { "type": "string", "enum": ["metric","imperial"], "default": "metric" },
        "showTimer":   { "type": "boolean", "default": true },
        "confirmReroll": { "type": "boolean", "default": false }
      }
    }
  }
}
```

`cameraShake` scales the shipped `physics.shake * 0.12` shake term in `move()`; `0` fully disables it for motion-sensitive players. `reducedMotion` additionally freezes the list-complete banner pulse and the checkout-ring breathe. `tierOverride: "auto"` preserves the shipped progressive-quality state machine (lite → high/panic at frame 80); any explicit value pins the tier and skips the auto-benchmark.

---

### 20.8 Save-game schema

The save-game is the single root document under `gd3d:save`. It aggregates settings-by-reference-copy, career progression, achievement state, lifetime stats, per-shift best records, and ghost pointers. It carries the authoritative `schemaVersion` that drives migration (§20.12) and a `checksum` (§20.12) for corruption detection.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/save",
  "title": "Save-game",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "profileId", "createdAt", "updatedAt", "settings", "progression", "stats"],
  "properties": {
    "schemaVersion": { "type": "integer", "const": 4 },
    "profileId":     { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
    "displayName":   { "type": "string", "maxLength": 24, "default": "Shopper" },
    "createdAt":     { "type": "integer", "minimum": 0 },
    "updatedAt":     { "type": "integer", "minimum": 0 },
    "settings":      { "$ref": "gd3d/settings" },
    "progression": {
      "type": "object", "additionalProperties": false,
      "required": ["xp", "level"],
      "properties": {
        "xp":            { "type": "integer", "minimum": 0, "default": 0 },
        "level":         { "type": "integer", "minimum": 1, "default": 1 },
        "currency":      { "type": "integer", "minimum": 0, "default": 0 },
        "unlockedShifts":{ "type": "array", "items": { "type": "string" }, "default": ["shift_classic"] },
        "unlockedItems": { "type": "array", "items": { "type": "string" }, "default": [] },
        "dailyStreak":   { "type": "integer", "minimum": 0, "default": 0 },
        "lastDailyId":   { "type": "string", "default": "" }
      }
    },
    "achievements": {
      "type": "object",
      "additionalProperties": {
        "type": "object", "additionalProperties": false,
        "required": ["unlocked"],
        "properties": {
          "unlocked":   { "type": "boolean" },
          "unlockedAt": { "type": ["integer","null"], "default": null },
          "progress":   { "type": "number", "minimum": 0, "default": 0 }
        }
      },
      "default": {}
    },
    "stats": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "runsCompleted":     { "type": "integer", "minimum": 0, "default": 0 },
        "totalItems":        { "type": "integer", "minimum": 0, "default": 0 },
        "totalDamageDollars":{ "type": "number",  "minimum": 0, "default": 0 },
        "totalPlayMs":       { "type": "integer", "minimum": 0, "default": 0 },
        "gondolasTipped":    { "type": "integer", "minimum": 0, "default": 0 },
        "cartsTipped":       { "type": "integer", "minimum": 0, "default": 0 },
        "npcsBumped":        { "type": "integer", "minimum": 0, "default": 0 },
        "debrisGrabbed":     { "type": "integer", "minimum": 0, "default": 0 },
        "distinctSkus":      { "type": "array", "items": { "type": "string" }, "maxItems": 150, "default": [] }
      }
    },
    "bestRuns": {
      "type": "object",
      "additionalProperties": { "$ref": "gd3d/run-record" },
      "default": {}
    },
    "ghosts": {
      "type": "object",
      "additionalProperties": { "type": "string", "pattern": "^gd3d:ghost:" },
      "default": {}
    },
    "checksum": { "type": "string", "pattern": "^[0-9a-f]{8}$" }
  }
}
```

`bestRuns` is keyed by `shiftId → run-record`; `ghosts` is keyed by `shiftId → localStorage key` (an indirection so the heavy ghost blob lives in its own key and never bloats the hot save read). `settings` is stored **by copy** inside the save (single-write consistency) and *also* mirrored to `gd3d:settings` (§20.11) for a fast pre-boot read before the full save parses — the migrator reconciles the two, save winning on conflict.

---

### 20.9 Run-record schema

A run-record is the immutable summary emitted by `complete()` (`src/game.js`). It is the atomic unit of history: `bestRuns` holds the best one per shift, and `gd3d:runlog` (§20.11) is a ring of the 50 most recent. It captures exactly the values the shipped banner already computes — item count, dollar total, and the `{count,total}` damage object from `world.physics.damage`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/run-record",
  "title": "Run-record",
  "type": "object",
  "additionalProperties": false,
  "required": ["runId", "shiftId", "seed", "startedAt", "durationMs", "itemsCollected", "cartTotal", "damages", "completed"],
  "properties": {
    "runId":     { "type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
    "shiftId":   { "type": "string" },
    "seed":      { "type": "integer", "minimum": 1, "maximum": 2147483646 },
    "layoutId":  { "type": "string", "default": "layout_supercenter" },
    "startedAt": { "type": "integer", "minimum": 0 },
    "durationMs":{ "type": "integer", "minimum": 0 },
    "listSize":  { "type": "integer", "minimum": 1, "maximum": 24, "default": 6 },
    "itemsCollected": { "type": "integer", "minimum": 0 },
    "list":      { "type": "array", "items": { "type": "string" }, "maxItems": 24, "default": [] },
    "cartTotal": { "type": "number", "minimum": 0, "multipleOf": 0.01 },
    "damages": {
      "type": "object", "additionalProperties": false,
      "required": ["count", "total"],
      "properties": {
        "count": { "type": "integer", "minimum": 0 },
        "total": { "type": "number",  "minimum": 0, "multipleOf": 0.01 }
      }
    },
    "medal":     { "type": "string", "enum": ["none","bronze","silver","gold"], "default": "none" },
    "tier":      { "type": "string", "enum": ["lite","lite-locked","high","panic"], "default": "lite" },
    "completed": { "type": "boolean" },
    "score":     { "type": "integer", "default": 0 },
    "ghostKey":  { "type": "string", "default": "" }
  }
}
```

`seed` records the run's master seed (§20.14) so any run-record can be replayed byte-identically — even a `random`-policy run, because the wall-clock seed is captured at run start. `list` stores the 6 SKU ids the run demanded; `tier` records which render tier the run actually executed under, letting Ch. 24 telemetry correlate performance with hardware without any personal data. `score` is the Ch. 4 economy result; `medal` is derived by comparing `durationMs` against the shift's `parTimesMs`.

---

### 20.10 Ghost-lite schema

A **ghost-lite** is a downsampled replay of the player camera path — enough to render a translucent racing ghost or a heatmap, not a full deterministic input log. "Lite" means it stores **sampled pose keyframes**, not per-frame input, at **10 Hz**, quantised, then base64-packed. One ghost per shift-best is retained; older ghosts are overwritten.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "gd3d/ghost-lite",
  "title": "Ghost-lite",
  "type": "object",
  "additionalProperties": false,
  "required": ["ghostVersion", "runId", "shiftId", "seed", "sampleHz", "durationMs", "frames"],
  "properties": {
    "ghostVersion": { "type": "integer", "const": 1 },
    "runId":    { "type": "string" },
    "shiftId":  { "type": "string" },
    "seed":     { "type": "integer", "minimum": 1, "maximum": 2147483646 },
    "sampleHz": { "type": "integer", "const": 10 },
    "durationMs": { "type": "integer", "minimum": 0 },
    "origin": {
      "type": "object", "additionalProperties": false, "required": ["x","z"],
      "properties": { "x": { "type": "number" }, "z": { "type": "number" } }
    },
    "frames": { "type": "string", "contentEncoding": "base64", "maxLength": 20000 },
    "events": {
      "type": "array", "maxItems": 128,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["t","type"],
        "properties": {
          "t":    { "type": "integer", "minimum": 0 },
          "type": { "type": "string", "enum": ["grab","crash","tip","bump","checkout"] },
          "sku":  { "type": "string" }
        }
      }
    }
  }
}
```

**Frame packing (exact).** Each 10 Hz sample is **5 bytes**, little-endian:

| Field | Bytes | Encoding | Range | Formula |
|---|---|---|---|---|
| `x` | 2 | Int16 | −23.00 … +23.00 m | `round((x − origin.x) × 100)` (centimetres) |
| `z` | 2 | Int16 | −15.00 … +15.00 m | `round((z − origin.z) × 100)` |
| `yaw` | 1 | Uint8 | 0 … 2π | `round(((yaw mod 2π)/2π) × 256) & 0xFF` |

The byte array is base64-encoded into `frames`. Player height is fixed (`1.65` m eye, §20.4) so `y` is never stored. A 90-second run yields `900 frames × 5 B = 4500 B` raw → `~6.0 KB` base64 — comfortably under the 20 000-char cap. Decode: `x = origin.x + int16/100`, and the ghost mesh is a translucent capsule interpolated (linear position, shortest-arc yaw) between samples at render time. `events` are sparse gameplay beats keyed to elapsed `t` (ms) for optional replay callouts. Because `seed` is stored, a ghost can be shown against the **same generated store and list** the record-holder shopped.

---

### 20.11 localStorage key map & size budgets

All keys are `gd3d:`-prefixed. `localStorage` gives ~5 MB per origin; the game's entire footprint is budgeted to **≤ 512 KB**, an order of magnitude under the floor, so a full storage quota is never approached.

| Key | Contents | Format | Typical | Hard budget | Write cadence |
|---|---|---|---|---|---|
| `gd3d:meta` | `{schemaVersion, ghostVersion, savedAt}` | JSON | 80 B | 256 B | On every save |
| `gd3d:settings` | Settings mirror (§20.7) | JSON | 420 B | 2 KB | On options change |
| `gd3d:save` | Save-game root (§20.8) | JSON | 6 KB | 64 KB | Debounced 1/s max after a run |
| `gd3d:save.bak` | Last-known-good copy of `gd3d:save` | JSON | 6 KB | 64 KB | Before each `gd3d:save` write |
| `gd3d:save.corrupt` | Raw string of a save that failed parse/validate | string | 0 | 64 KB | Only on corruption |
| `gd3d:runlog` | Ring buffer, 50 newest run-records (§20.9) | JSON array | 14 KB | 32 KB | After each `complete()` |
| `gd3d:ghost:<shiftId>` | One ghost-lite per shift (§20.10) | JSON | 6.5 KB | 24 KB each | On new shift-best only |
| `gd3d:export.tmp` | Scratch during import validation | string | 0 | 64 KB | Transient, deleted immediately |

**Ghost budget.** 40 shifts (Ch. 3) × 24 KB worst-case = 960 KB — this alone would blow the 512 KB target, so ghost retention is **capped at the 12 most-recently-beaten shifts**; the 13th eviction deletes the oldest `gd3d:ghost:*` key (LRU by run-record `updatedAt`). Typical realised total across all keys: **~110 KB**.

**Write discipline.** Saves are **debounced** — never written mid-frame, only on `complete()`, options change, or `visibilitychange → hidden`. Every write is wrapped in `try/catch(QuotaExceededError)`; on quota failure the game evicts ghosts oldest-first, then the runlog tail, and retries once before silently degrading to memory-only for the session (a `console.warn`, no user-facing error — persistence is never load-bearing).

---

### 20.12 Versioned migration framework

Every persisted root (`save`, `settings`, `ghost-lite`) carries an integer version: `schemaVersion` (currently **4**) for saves/settings, `ghostVersion` (currently **1**) for ghosts. `gd3d:meta.schemaVersion` is the fast-path check read before the heavy save.

**Migration registry.** A frozen, ordered list of pure, idempotent step functions, each advancing exactly one version. `CURRENT = 4`.

```js
// persist/migrations.js — each fn: (doc) => doc, pure, one version step
const MIGRATIONS = [
  { from: 1, to: 2, fn: (d) => {                     // v1→v2: rename audio key
      d.settings.audio.masterVolume = d.settings.audio.sfxVol ?? 0.45;
      delete d.settings.audio.sfxVol; return d; } },
  { from: 2, to: 3, fn: (d) => {                     // v2→v3: introduce ghosts map
      d.ghosts = d.ghosts ?? {}; return d; } },
  { from: 3, to: 4, fn: (d) => {                     // v3→v4: damages number → {count,total}
      for (const k in (d.bestRuns ?? {})) {
        const r = d.bestRuns[k];
        if (typeof r.damages === 'number') r.damages = { count: 0, total: r.damages };
      }
      d.stats ??= {}; d.stats.distinctSkus ??= []; return d; } },
];

function migrate(doc) {
  let v = doc.schemaVersion ?? 1;
  while (v < CURRENT) {
    const step = MIGRATIONS.find((m) => m.from === v);
    if (!step) throw new MigrationGap(v);          // no path → treat as corrupt
    doc = step.fn(structuredClone(doc));           // never mutate the input in place
    v = step.to;
    doc.schemaVersion = v;
  }
  return doc;
}
```

**Load pipeline** (`persist.load()`), in order:

1. Read `gd3d:save`. If absent → return `defaults()` (fresh profile). No migration needed.
2. `JSON.parse`. On throw → **corrupt path** (step 6).
3. Verify `checksum`: recompute FNV-1a over the canonicalised doc *minus* the `checksum` field; if mismatch → corrupt path.
4. If `schemaVersion < CURRENT` → **back up first** (`gd3d:save.bak ← raw string`), then `migrate()`. On `MigrationGap` or throw → corrupt path.
5. Validate against `gd3d/save`. On failure → corrupt path. On success → re-checksum, write back if the version advanced, return.
6. **Corrupt path / backup recovery:** copy the offending raw string to `gd3d:save.corrupt` (for support/export), then attempt `gd3d:save.bak`: parse → checksum → migrate → validate. If the backup passes, promote it to `gd3d:save` and continue. If the backup also fails or is absent, return `defaults()` — **the game always boots**. A one-line non-blocking toast ("Couldn't read your saved progress — starting fresh. Your old data is kept for export.") informs the player; the `corrupt` blob is never auto-deleted so `Export` can still recover it.

**Checksum — FNV-1a, 32-bit** (exact): offset basis `2166136261`, prime `16777619`.

```
h = 2166136261
for each byte b of canonicalJSON(doc without "checksum"):
    h = h XOR b
    h = (h × 16777619) mod 2^32
checksum = lowercaseHex8(h)     // e.g. "1a2b3c4d"
```

`canonicalJSON` sorts object keys lexicographically and uses no whitespace, so the checksum is stable across engines. This is an **integrity** check (detect truncation/tampering/half-writes from a killed tab), not security — the export format (§20.13) is trivially editable by design.

---

### 20.13 Export / import save (base64 blob)

Export produces one copy-pasteable ASCII string; import consumes it. This is the only supported cross-device transfer in the no-backend default (Ch. 24 may add optional cloud sync, strictly additive).

**Envelope format:** `GD3D` + `<schemaVersion>` + `.` + `<base64payload>`. Example prefix for a v4 save: `GD3D4.eyJzY2hlbWFWZXJz…`. The payload is base64 of the UTF-8 JSON of a **transfer bundle**:

```json
{
  "kind": "gd3d-export",
  "schemaVersion": 4,
  "exportedAt": 1815200000000,
  "save": { "...": "full gd3d/save document" },
  "runlog": [ "…up to 50 run-records…" ],
  "ghosts": { "shift_classic": { "…gd3d/ghost-lite…" } },
  "checksum": "9f8e7d6c"
}
```

**Encode:** `payload = btoa(unescape(encodeURIComponent(JSON.stringify(bundle))))` — the `unescape(encodeURIComponent(...))` sandwich makes `btoa` safe for the full Unicode range (emoji icons, non-ASCII display names). Final string = `"GD3D" + version + "." + payload`. No compression library is used (keeps the bundle dependency-free and Intel-iGPU-irrelevant); a 110 KB profile base64s to ~150 KB, acceptable for a manual copy or a downloadable `.txt`. Downloading the blob as a file is an explicit user action gated behind a button — never automatic.

**Decode / import:**

1. Trim; assert the string matches `^GD3D(\d+)\.([A-Za-z0-9+/=]+)$`. Reject otherwise ("This doesn't look like a Grocery Dash code.").
2. Capture the leading version. If it is **greater than** `CURRENT`, refuse ("This code is from a newer version — update the game first.") — never guess forward migrations.
3. `JSON.parse(decodeURIComponent(escape(atob(payload))))`. On throw → reject.
4. Assert `bundle.kind === "gd3d-export"`; recompute the bundle `checksum` (FNV-1a over the bundle minus `checksum`) and require a match.
5. Run each contained `save`/`ghost` through the §20.12 `migrate()` + validate pipeline.
6. **Require explicit user confirmation** before overwrite — import replaces the local profile, so the UI shows a diff summary (level, runs completed, best times) and a Confirm/Cancel. On confirm, the current `gd3d:save` is first copied to `gd3d:save.bak` (so an unwanted import is one click to undo), then the imported bundle is written and the page reloads. Import writes go through `gd3d:export.tmp` first and are only committed after full validation, so a malformed paste never corrupts the live save.

Import is a data-only operation: it can never carry executable content (it's parsed as JSON, never `eval`'d), and unknown extra fields are stripped by the `additionalProperties:false` validators before persistence.

---

### 20.14 Determinism rules & the seeded LCG streams

The store today is generated by one Park–Miller MINSTD generator seeded at `1337` (`src/store.js`): `seed = (seed × 16807) mod 2147483647`, normalised `rng() = seed / 2147483647`. Everything else that needs randomness — the shopping list (`genList`), NPC roaming (`characters.js`), and debris/tip/bark selection (`physics.js`) — currently calls the **non-deterministic** `Math.random()`. That is fine for a throwaway demo but makes runs unreproducible, which breaks replays, ghosts, daily challenges, and shareable seeds. This section formalises a **multi-stream deterministic model** that keeps the shipped LCG exactly as-is for layout and promotes the other systems onto their own seeded streams.

**The generator (unchanged).** `x₀ = seed (1 … 2147483646)`, `xₙ₊₁ = (xₙ × 16807) mod 2147483647`, `rng() → xₙ₊₁ / 2147483647 ∈ (0, 1)`. Worked example from the shipped `seed = 1337`, first eight outputs (verify by hand — `1337 × 16807 = 22470959`, below the modulus so no reduction on step 1):

| n | xₙ | rng() |
|---|---|---|
| 1 | 22470959 | 0.010463856 |
| 2 | 1859769688 | 0.866022747 |
| 3 | 524664131 | 0.244315775 |
| 4 | 462195135 | 0.215226382 |
| 5 | 665282746 | 0.309796420 |
| 6 | 1607245740 | 0.748432121 |
| 7 | 1929840214 | 0.898651879 |
| 8 | 1378956057 | 0.642126453 |

**Master seed.** Each run has one 31-bit `masterSeed` (recorded in the run-record, §20.9), chosen by `seedPolicy` (§20.3): `fixed` → the shift's `fixedSeed`; `daily` → `YYYYMMDD` as an integer (all players share the day's store and list); `random` → `(Date.now() ^ (performance.now()*1000)) & 0x7fffffff, or 1 if 0`. **The shipped `layout` stream keeps `1337` regardless of masterSeed** so the physical store is stable while the *shopping* varies (see stream table).

**Child-seed derivation.** Each named stream gets an independent seed hashed from the master seed and the stream label, so streams never share state or correlate:

```
seedFor(master, label):
    h = master >>> 0
    for each char c in label:  h = (h * 31 + c.charCodeAt(0)) >>> 0
    h = h mod 2147483647
    return h === 0 ? 1 : h
```

Worked child seeds for `masterSeed = 20260711` (the shipping test seed): `layout → 519616850`, `list → 170380422`, `npc → 144045595`, `physics → 531295488`, `ambient → 225245521`. (The `layout` stream *ignores* this derived value in the default supercenter and uses the fixed `1337`; the derivation exists for alternate layouts, Ch. 14.)

**Stream registry — the complete list of who may draw from which stream.** These are the *only* five streams; no code path outside this table may call a seeded generator, and no gameplay-affecting code may call `Math.random()`.

| Stream | Default seed | Gameplay-critical? | Sole consumers (exhaustive) | Draw order contract |
|---|---|---|---|---|
| **layout** | `1337` (fixed) | Yes — store contents | `store.buildStore` fixture stocking, in call order: (1) grocery gondola x=-18, (2) x=-14, (3) x=-10, (4) x=-6, (5) bakery `wallShelf`, (6) `freezerWall`, (7) `produceCorner`, (8) `tvWall`, (9) merch gondola z=-7.5, (10) merch gondola z=-3.5, (11) toy island x=19.5, (12) `apparel`, (13) `toysDept`, (14) `endcaps`, (15) `palletStacks`, (16) `checkoutExtras`, (17) `saleTags` | **Frozen.** Reordering any fixture, or making `checkoutLanes`/`cartsAndBaskets`/`entrance`/`floorZones`/`pharmacy`/`kitProps`/`produceExtras`/`wallDressing`/`floorProps` draw from this stream, shifts every downstream placement. Those nine builders take **no** rng and must stay that way. |
| **list** | `seedFor(master,"list")` | Yes — the objective | `game.genList` (replaces `Math.random`): draws 6 distinct SKUs from `stock.availableSpecs()` | Draw exactly `min(6, specs.length)` picks; index = `floor(rng() × specs.length)` then splice. Same master ⇒ same list. |
| **npc** | `seedFor(master,"npc")` | No — cosmetic | `characters.createShoppers` spawn placement, roam paths, pauses, yaw jitter (replaces `Math.random`) | Determinism optional: pinned only in `replay`/`daily` mode; free-running `Math.random` allowed in casual play (declared per-run in the record). |
| **physics** | `seedFor(master,"physics")` | No — cosmetic/consequential-but-not-objective | `physics.js` debris scatter velocities, tumble spin, gondola tip sign, cart tip sign, bark-line selection | Same as `npc`: pinned in replay mode so ghosts match; wall-clock in casual. Damage *dollar* totals are deterministic regardless (they depend only on which SKUs were dislodged, itself a function of the deterministic layout + player path). |
| **ambient** | `seedFor(master,"ambient")` | No — décor only | Sale-tag placement (`saleTags` cosmetic subset), light flicker phase, poster variant — anything with zero gameplay effect | Never pinned; may use `Math.random`. Listed so it is explicitly *out* of the reproducibility contract. |

**Determinism tiers.** Three run modes select how many streams are pinned:

| Mode | layout | list | npc | physics | ambient | Use |
|---|---|---|---|---|---|---|
| `casual` (shipped default) | seeded 1337 | seeded | Math.random | Math.random | Math.random | Normal play; store + list reproducible, world "breathes" |
| `daily` / `shared-seed` | seeded 1337 | seeded | seeded | seeded | Math.random | Leaderboards — identical store, list, crowd, and physics for all players on a seed |
| `replay` (ghost render) | seeded 1337 | seeded | seeded | seeded | Math.random | Re-run a record with the ghost overlaid on a byte-identical world |

**Hard rules.**

1. **One consumer per stream per draw.** A stream is single-threaded through its consumers in a fixed order; interleaving two systems on one stream is forbidden (it would couple their sequences).
2. **No hidden draws.** Any new randomness must declare its stream in this table. A gameplay-affecting `Math.random()` anywhere is a determinism bug caught by the Ch. 23 "seed replay" test (run seed `S` twice, assert identical list + layout + score).
3. **State is never persisted.** Only *seeds* are saved (run-record `seed`), never mid-stream `xₙ` state — the full sequence is always reconstructed from the seed, so a save is tiny and version-independent of generator internals.
4. **Generator constants are frozen forever.** `A = 16807`, `M = 2147483647`, the `seedFor` hash (`× 31`), and the `1337` layout seed are part of the save contract: changing any of them silently invalidates every stored ghost and daily seed, so they may only change behind a `ghostVersion` bump that discards old ghosts.

With this model, a run-record's single `seed` integer (§20.9) plus its `shiftId` fully reconstructs the store, the shopping list, and — in `daily`/`replay` — the crowd and the carnage, which is precisely what the ghost (§20.10), the daily challenge (Ch. 5), and the shareable-seed feature (Ch. 12) all stand on.

---

**Cross-references.** SKU fields feed Ch. 16 (catalog, 150 SKUs) and Ch. 4 (scoring `points`). Shift records drive Ch. 2 (modes) and Ch. 3 (all 40 shifts). Layout schema underpins Ch. 14 (interior) and Ch. 15 (exterior). Archetypes serve Ch. 17 (NPCs/AI/barks). Achievement/settings state powers Ch. 5 (progression) and Ch. 11 (accessibility). The persistence pipeline is owned by the `persist` module in Ch. 19 (architecture); its quota and telemetry behaviour connect to Ch. 24 (release/ops). The determinism contract is exercised by the seed-replay suite in Ch. 23 (testing/CI).



# Chapter 21 — Rendering & Performance

This chapter is the authoritative spec for how *Grocery Dash 3D* turns a 46×30×4.2 m supercenter into pixels on an Intel integrated GPU at 60 fps. It documents the shipped renderer, the shipped three-tier quality system (`lite` → `lite-locked` → `high`, with a `panic` fallback), the exact light and draw-call inventory, and it extends the shipped baseline with the region-split instancing, LOD, atlas/KTX2, watchdog, and audit systems the project needs as the catalog grows from today's 52 SKUs toward the 150-SKU target of Ch. 16. Every proposed extension is additive and browser-only; nothing here contradicts shipped behavior. Cross-references: art direction Ch. 13, exterior/lot Ch. 15, catalog Ch. 16, module map Ch. 19, data schemas Ch. 20, physics Ch. 22, testing/framebuffer-grid Ch. 23, telemetry Ch. 24.

The single non-negotiable constraint that shapes this entire chapter: **start cheap, upgrade only if the GPU proves it can afford it.** The shipped code begins in the `lite` tier on frame one and *earns its way up*, because the original "start heavy, degrade later" approach made integrated GPUs stutter through the first several seconds of play.

### 21.1 Renderer configuration (ground truth)

The renderer and camera are constructed once in `src/main.js`. These values are load-bearing; changing any of them changes every budget below.

| Setting | Value | Rationale |
|---|---|---|
| `WebGLRenderer` | `antialias: true`, `powerPreference: 'high-performance'` | request the discrete GPU on hybrid laptops |
| `setPixelRatio` | `Math.min(devicePixelRatio, 1.25)` | hard DPR ceiling of 1.25; a 4K/retina panel never renders at native |
| `shadowMap.enabled` | `true` | |
| `shadowMap.type` | `PCFSoftShadowMap` | soft edges without VSM memory cost |
| `toneMapping` | `ACESFilmicToneMapping` | applied in `OutputPass` when rendering through the composer |
| `toneMappingExposure` | `1.0` | |
| Camera | `PerspectiveCamera(62, aspect, 0.1, 100)` | 62° horizontal-ish FOV, near 0.1 m, far 100 m |
| `scene.background` | `0x0d1013` | near-black; never actually seen (walls enclose) |
| `scene.fog` | `Fog(0x11151a, 24, 46)` | linear fog: full opacity at 46 m == store diagonal, so the far plane is *effectively* 46 m for culling-relevant density |

The post chain is an `EffectComposer` writing into a **multisampled half-float** render target: `WebGLRenderTarget(w, h, { samples: 2, type: HalfFloatType })`. `samples: 2` is WebGL2 2× MSAA on the offscreen target (on top of the context's own `antialias:true`); `HalfFloatType` is mandatory because bloom and ACES need HDR values above 1.0 to survive into the tone-mapping pass. The composer passes, in order, are: `RenderPass` → `GTAOPass` → `UnrealBloomPass` → `OutputPass`.

Environment lighting (`src/env.js`) loads `empty_warehouse_01_1k.hdr` (1.67 MB), runs it through `PMREMGenerator`, assigns the result to `scene.environment`, and sets `scene.environmentIntensity = 0.55` so the store's own lights lead and the HDRI only fills reflections and ambient bounce. It is **never** used as a visible skybox — indoors, walls and ceiling enclose the frustum; outdoors (Ch. 15) a painted gradient sky dome (`SphereGeometry(85, 24, 12)`, `BackSide`, `fog:false`) stands in.

### 21.2 The six benchmark views

Performance is not a scalar; it is a distribution over where the camera can point. We fix **six canonical camera poses** that bracket the store's worst geometry, transparency, bloom, skinned-mesh, and photoscan hot-spots. Every budget table, every CI framebuffer-grid capture (Ch. 23), and every telemetry percentile (Ch. 24) is reported against these six and only these six. Camera height is the player eye height 1.65 m; FOV 62°; poses use world coordinates from `buildStore`.

| ID | Name | Camera pos (x, y, z) | Look yaw | What fills the frame | Stress axis |
|---|---|---|---|---|---|
| **BV1** | Entrance Sweep | (0.6, 1.65, 13.2) | 180° (−Z) | all 4 grocery gondolas end-on, freezer wall, bakery back wall, both merch gondolas, front strip behind partially | **worst-case draw count** |
| **BV2** | Grocery Canyon | (−8.0, 1.65, 5.0) | 180° (−Z) | two full 16 m gondola faces (x=−6 and x=−10) walling the frame | **peak visible instances** |
| **BV3** | Freezer Glass | (−15.0, 1.65, 0.0) | 270° (−X) | 10-door glass freezer wall, LED strips, transparent glass | **transparency sort + bloom** |
| **BV4** | Produce Corner | (−17.7, 1.65, 6.5) | 0° (+Z) | 6 photoscan tables (apple/lemon/avocado/banana/onion/sweetpotato), pendant emissives | **triangle density (scans)** |
| **BV5** | Checkout Strip | (−7.65, 1.65, 7.5) | 0° (+Z) | 6 lanes, 2 photoscan registers, 2 cashier NPCs (skinned) | **skinned-mesh + fill** |
| **BV6** | Merch / TV Wall | (12.0, 1.65, −2.0) | 180° (−Z) | 8 emissive TV screens, apparel instanced shirts, toys island | **bloom emitters** |

The geometry cost of each view (draws and triangles are essentially tier-independent — enabling rect-area lights or GTAO changes *shading* cost, not draw count, and shadow maps are frozen after frame 3):

| View | Draw calls | Triangles | Dominant contributor |
|---|---|---|---|
| BV1 Entrance Sweep | **988** | **1.38 M** | everything in frustum + exterior lot through storefront glass |
| BV2 Grocery Canyon | 612 | 1.02 M | ~4,200 facings collapse to ~70 instanced batches; tris dominate |
| BV3 Freezer Glass | 344 | 0.46 M | 6 instanced freezer parts + transparent glass overdraw |
| BV4 Produce Corner | 421 | 1.19 M | decimated photoscan produce (thousands of tris each) |
| BV5 Checkout Strip | 508 | 0.74 M | 2 skinned Rocketbox cashiers (~30 k tris each) + merged lanes |
| BV6 Merch / TV Wall | 396 | 0.55 M | 8 TV groups + 8-color instanced apparel |

**BV1 is the ceiling: 988 draws / 1.38 M triangles.** All optimization targets are pinned to keeping BV1 inside frame budget on the reference floor device.

### 21.3 Per-tier specification

Three tiers ship (`main.js`), plus a locked resting state and a panic fallback. The tier is chosen by a one-shot benchmark over frames 21–80 (§21.10) and exposed on `window.__tier` for CI and telemetry.

**Post-processing stack per tier:**

| Pass | lite | lite-locked | high | panic |
|---|---|---|---|---|
| `RenderPass` | ✅ | ✅ | ✅ | ✅ |
| `GTAOPass` (radius 0.35, distanceExp 1, thickness 1, scale 1, **samples 8**, screenSpaceRadius false, blendIntensity 0.85) | ❌ | ❌ | ✅ | ❌ |
| `UnrealBloomPass` (strength **0.16**, radius **0.5**, threshold **0.96**, resolution **½×½**) | ✅ | ✅ | ✅ | ✅ |
| `OutputPass` (ACES tonemap + sRGB) | ✅ | ✅ | ✅ | ✅ |
| MSAA on composer RT | 2× | 2× | 2× | 2× |
| **DPR** | ≤ 1.25 | ≤ 1.25 | ≤ 1.25 | **1.0** |

The bloom threshold of 0.96 is deliberately high so only true emitters — ceiling troffers (emissiveIntensity 2.1), freezer LED strips (1.6), TV screens (0.9 emissiveMap), lamp heads, the pharmacy cross, EXIT sign — cross into bloom; ordinary bright painted surfaces stay clean. Bloom runs at half resolution in every tier (`Vector2(innerWidth/2, innerHeight/2)`); it is the one pretty pass cheap enough to never turn off.

**Light inventory per tier** (full enumeration in §21.4). The lite tier hides all 5 `RectAreaLight` wash lights and disables shadow casting on 4 of the 8 `SpotLight`s:

| Light class | lite / lite-locked | high | panic |
|---|---|---|---|
| HemisphereLight ×1 | on | on | on |
| SpotLight ×8 (shadow casters) | **4 of 8 cast** | 8 of 8 cast | 4 of 8 cast |
| RectAreaLight ×5 | **hidden** | visible | hidden |
| Instanced troffers (emissive, ×110) | on | on | on |
| Emissive-only fakes (streaks, LEDs, screens, pools) | on | on | on |
| GTAO ambient occlusion | off | **on** | off |

**Per-view frame-time budgets by reference device.** Three reference devices bracket the field. D0 "Floor" = Intel UHD 620 (the absolute minimum we ship for). D1 "Baseline" = Intel Iris Xe. D2 "Discrete" = GTX 1650 / Apple M1. Times are the design targets the content must not exceed; the auto-tier logic (§21.10) picks the tier per device.

BV1 (worst view), milliseconds per frame:

| Device | lite ms | resulting tier | high ms (if upgraded) | fps delivered |
|---|---|---|---|---|
| D0 Floor (UHD 620) | 26.0 | **lite-locked** (avg > 20 ms, < 55 ms) | — | ~38 fps |
| D1 Baseline (Iris Xe) | 15.0 | **high** (avg < 20 ms → upgrade) | 21.0 | ~47 fps w/ GTAO |
| D2 Discrete (M1/1650) | 7.0 | **high** | 9.0 | 60 fps (capped) |

Per-view lite-tier targets on the D0 Floor device (the number CI asserts against — Ch. 23):

| View | Floor lite ms | Floor panic ms (recovery) |
|---|---|---|
| BV1 Entrance Sweep | 26.0 | 18.5 |
| BV2 Grocery Canyon | 21.0 | 15.0 |
| BV3 Freezer Glass | 16.5 | 11.8 |
| BV4 Produce Corner | 19.5 | 13.9 |
| BV5 Checkout Strip | 20.5 | 14.6 |
| BV6 Merch / TV Wall | 17.5 | 12.5 |

Panic is a genuine recovery mode: dropping DPR from 1.25 to 1.0 removes `(1.25² − 1.0²)/1.25² ≈ 36%` of fragment shading work, which is why every panic column sits ~29% below its lite counterpart. Panic only ever triggers when lite measured > 55 ms (see §21.10), so in practice D0 Floor never enters it at these budgets — panic exists for devices *below* the floor (old Atom/Mali tablets) so the game still limps rather than dies.

### 21.4 Light inventory (complete enumeration)

Every real light in the scene, from `lighting()` in `store.js`. "Real" means it participates in the PBR lighting equation; emissive materials and additive decals (troffers, streaks, lamp pools, screens) are *not* lights and cost nothing per-light.

| # | Type | Position (x, y, z) | Color | Intensity | Shadow | Notes |
|---|---|---|---|---|---|---|
| 1 | HemisphereLight | ambient | sky `0xcfe0f0` / ground `0x39352f` | 0.34 | — | fills undersides |
| 2 | RectAreaLight | (−16, 4.12, 0) | `0xfff2e2` | 3.2 | no | 0.6×27 m ceiling strip; **lite: hidden** |
| 3 | RectAreaLight | (−8, 4.12, 0) | `0xfff2e2` | 3.2 | no | **lite: hidden** |
| 4 | RectAreaLight | (8, 4.12, 0) | `0xfff2e2` | 3.2 | no | **lite: hidden** |
| 5 | RectAreaLight | (16, 4.12, 0) | `0xfff2e2` | 3.2 | no | **lite: hidden** |
| 6 | RectAreaLight | (0, 4.12, 12.2) | `0xfff2e2` | 2.4 | no | 0.6×42 m, rotated 90°, front strip; **lite: hidden** |
| 7 | SpotLight | (−16, 4.08, −6) | `0xfff4e6` | 38 | **yes** (1024²) | dist 17, angle π·0.34, penumbra 0.55, decay 1.5, near 0.5, far 14, bias −0.0005 |
| 8 | SpotLight | (−8, 4.08, −2) | `0xfff4e6` | 38 | no (lite) | odd index → shadow off in lite |
| 9 | SpotLight | (−17.7, 4.08, 10.7) | `0xfff4e6` | 38 | yes | produce corner key light |
| 10 | SpotLight | (−8.6, 4.08, 10.6) | `0xfff4e6` | 38 | no (lite) | checkout |
| 11 | SpotLight | (0, 4.08, −6) | `0xfff4e6` | 38 | yes | center alley |
| 12 | SpotLight | (10, 4.08, −7) | `0xfff4e6` | 38 | no (lite) | merch |
| 13 | SpotLight | (8.5, 4.08, 4) | `0xfff4e6` | 38 | yes | apparel |
| 14 | SpotLight | (18.5, 4.08, 10) | `0xfff4e6` | 38 | no (lite) | pharmacy |

Shadow-caster selection in lite is `si++ % 2 === 1 → castShadow = false`, so 4 of the 8 spots cast in lite/lite-locked/panic and all 8 in high. Each shadow map is 1024×1024 depth; total shadow VRAM is 4×(1024²×4 B) ≈ 16.8 MB in lite, 33.5 MB in high. **Shadow maps are frozen after frame 3** (`shadow.autoUpdate = false`), so their render cost is a one-time ~3-frame amortized spike at boot, not a per-frame cost — legal because the store geometry is static and products deliberately do **not** cast shadows (`castShadow=false` on all instanced stock; GTAO grounds them instead).

Fake lights that add zero light-count cost but sell the room: 110 emissive ceiling troffers (1 InstancedMesh), 110 additive floor streaks (1 InstancedMesh), 30 freezer LED strips (instanced), 8 TV emissive screens, 3 exterior lamp heads + additive light pools, pharmacy cross, EXIT sign, lane-number lamps, produce pendant bulbs.

### 21.5 Draw-call batching (shipped)

The store renders ~4,200 product facings plus thousands of fixtures in **~70 draw batches** because every repeated thing is either merged geometry or an `InstancedMesh`. Complete enumeration of the batching strategy:

| System | Naive draws | Shipped draws | Technique (source) |
|---|---|---|---|
| Product stock (all facings) | ~5,000 | ~70 | 1 `InstancedMesh` per (SKU × template part); `StaticDrawUsage` (`stock.js`) |
| Box products | 6 groups/box | **2 groups** | `twoGroupBox`: sides 0–23 → group 0, faces 24–35 → group 1 (`products.js`) |
| Can products | 3 groups | **2 groups** | side → label, top+bottom contiguous → one metal group |
| Bag products | 6 groups | **2 groups** | px..ny merged to back-material group, pz front, nz back |
| Gondola slabs + rails | 16 | **2** | `mergeGeometries` per gondola (`gondola()`) |
| Freezer wall (10 doors) | 60 | **6** | 1 `InstancedMesh` per repeated part × 10 doors |
| Checkout lanes (6) | 30 | **5** merged + 6 lamps + 2 registers | `mergeGeometries` per lane part |
| Shopping cart (~90 bars) | ~90 | **~4** | bars merged into 1 chrome geometry; grip/flap/wheels share geo |
| Apparel shirts (66) | 66 materials | **8** | 1 `InstancedMesh` per shirt color |
| Folded stacks / toy balls | 48 / 26 | **1 each** | `InstancedMesh` with per-instance `setColorAt` |
| Endcap trays (24) | 24 | **1** | `InstancedMesh` |
| Price tags (per SKU) | thousands | **1 per SKU** | `InstancedMesh`, shared geo, per-SKU texture (`buildTags`) |
| Sale tags (54) | 54 | **3** | 1 `InstancedMesh` per text variant × 18 |
| Ceiling troffers + streaks | 220 | **2** | 2 `InstancedMesh` |
| Exterior wheels (fallback cars) | ~90 | **3** | fleet-wide `InstancedMesh` (wheel/hub/arch) |
| Crosswalk / stripes / bumps | 40 | **3** | `InstancedMesh` |

Material sharing is equally aggressive: `materials.js` exports three shared factories (`METAL`, `PAINTED`, `PLASTIC`); `products.js` caches every product material per `(spec.id : role)` key in `_matCache` and every geometry per dimension key in `_geoCache`, so building a flyer or debris copy at runtime reuses the exact GPU program and buffers rather than churning shaders. This is why the "material cache per (spec, role)" line in the game-state summary exists — fresh `MeshStandardMaterial`s per debris spawn caused unbounded shader recompilation before the cache landed.

### 21.6 Region-split instancing design (proposed extension)

**Shipped baseline:** each SKU is one `InstancedMesh` whose instances span the *entire* store, with `computeBoundingSphere()` producing one sphere that encloses every facing. Consequence: a freezer-only SKU and its whole-store bounding sphere are frustum-visible from almost everywhere, so the batch is submitted (and its instance matrices traversed) even when only 3 of its 90 facings are on-screen. At 52 SKUs this is fine (~70 batches, all submitted every frame). At the 150-SKU target of Ch. 16 with the same design, BV1 climbs toward ~200 batches and the GPU pays vertex cost for thousands of off-screen instances.

**Proposed region split** (additive; keeps the per-SKU `InstancedMesh` API, just multiplies it by cell):

- **Grid:** the 46×30 m floor is partitioned into a fixed grid. **Cell size 5.75 × 6.0 m** — chosen so grocery-aisle pitch (4 m island spacing, 16 m aisle length) and the merch half both fall on clean boundaries. Grid dimensions: `ceil(46/5.75) = 8` columns × `ceil(30/6) = 5` rows = **40 cells**.
- **Key derivation:** for a slot at world `(x, z)`, `cellX = clamp(floor((x + 23) / 5.75), 0, 7)`, `cellZ = clamp(floor((z + 15) / 6.0), 0, 4)`, and the batch key is `` `${spec.id}|${cellX}|${cellZ}` ``. `buildStock` groups by this compound key instead of by `spec.id` alone.
- **Expected batch counts:** SKUs are spatially clustered by section (frozen only on the left wall, electronics only in the merch half), so a given cell contains only ~3–6 distinct SKUs, not all 52. Empirically the 40 cells yield **~150–180 region batches** at 52 SKUs (up from ~70), scaling to **~260 batches** at 150 SKUs. That sounds worse — until culling.
- **Culling win:** each region batch gets a *tight* bounding sphere (≤ 4.1 m radius). At BV2 (Grocery Canyon) the 62° frustum with 46 m fog reach sees ~3 of 40 cells → three.js frustum-culls **~90%** of region batches, submitting ~18 instead of ~180. At BV1 (worst, looking down the whole store) ~14 of 40 cells are visible → ~60% culled, ~72 batches submitted versus 180 built. Net: **submitted** draw calls at BV1 drop from the shipped ~70 (all submitted) to ~72 (region, but each far tighter in vertex work), and at BV2 from ~70 to ~18. The vertex-processing win is the real prize: BV2 stops paying for 4,200 instances and pays for ~450.
- **Cost:** +110 `InstancedMesh` objects (each a few hundred bytes of JS overhead + one bounding sphere), and the grab/hide path in `stock.js` gains one cell-lookup indirection. Memory neutral — the instance matrices are the same total count, just partitioned. Ship this the moment the catalog crosses ~90 SKUs; below that the shipped single-batch design wins on simplicity.

### 21.7 LOD policy per asset class

The shipped game has **no runtime geometric LOD** — it relies on aggressive fog (46 m), frozen shadows, and instancing. That is correct at 52 SKUs. The policy below defines LOD *thresholds by asset class* for when scene density grows; all distances are camera-to-object in metres.

| Asset class | Near (full) | Mid | Far / cull | Technique |
|---|---|---|---|---|
| **Instanced packaged products** (box/can/jar/bottle/bag/carton/cup/tub) | 0–8 m | 8–20 m: keep geo (already 14–20 seg cylinders, 12-tri boxes — no cheaper LOD worth building) | > 20 m: keep, but region-batch culls off-frustum; > 46 m fog-opaque | none needed; geometry is already minimal |
| **Photoscan produce** (`prod_*`, decimated 0.1–0.6 ratio) | 0–6 m: photoscan | 6–12 m: swap to procedural `fruit()` primitive (≤ 30 tris) | > 12 m: fruit primitive | material/mesh swap keyed on distance; scans are ≤ 13 cm, invisible past 12 m |
| **Skinned NPCs** (Rocketbox, ~20–40 k tris) | 0–8 m: `mixer.update(dt)` every frame | 8–16 m: `mixer.update` every **2nd** frame (half-rate anim) | > 16 m: freeze mixer, hold last pose; > 30 m or off-frustum: also skip | NPCs currently force `frustumCulled=false` (see below) — the LOD gate must re-add a manual distance check |
| **Exterior cars** (Kenney GLB, ~5–15 k tris) | any | any | fog + distance | static, single LOD; the whole lot sits behind storefront glass with `envMapIntensity` reflections |
| **Structural fixtures** (gondolas, freezer, walls, ceiling) | all | all | all | merged, no LOD; they *are* the occluders |
| **Shopping carts** (~90 merged bars) | 0–14 m | > 14 m | fog | single LOD; dynamic carts (Ch. 22) are few |

Critical implementation note for NPC LOD: `dressAvatar()` sets `o.frustumCulled = false` on every avatar mesh so retargeted skinned bounds (which three.js computes conservatively and often wrongly for runtime-retargeted rigs) never pop the avatar out of view mid-stride. This means **NPCs are never auto-culled** — the LOD gate above must implement its own `camera.position.distanceTo(npc)` check to skip `mixer.update`, because the engine will not skip them for you. Skinned animation (`mixer.update`) is the single most expensive per-NPC cost and dominates BV5.

### 21.8 Texture & memory budgets

**Shipped texture sources**, exact bytes on disk:

| Asset | Files | Disk size | Runtime format |
|---|---|---|---|
| HDRI `warehouse_1k.hdr` | 1 | 1.67 MB | → PMREM cube (RGBA16F) |
| PBR floor (`floor_tiles_06`) | diff 347 / arm 53 / nor 118 KB | 518 KB | 1k JPG → RGBA |
| PBR wall (`beige_wall_001`) | diff 32 / arm 85 / nor 149 KB | 266 KB | 1k JPG |
| PBR wood (`wood_planks`) | diff 595 / arm 374 / nor 637 KB | 1.61 MB | 1k JPG |
| PBR asphalt (`asphalt_02`) | diff 714 / arm 289 / nor 1211 KB | 2.21 MB | 1k JPG |
| Model kit (22 GLB) | cars 180–246 KB, produce 318–630 KB, props 459 KB–1.43 MB | ~11 MB | GLB w/ 1024² textures |
| Rocketbox people (6) | body/head color+normal (~150 KB each), opacity PNG 820 KB, model.fbx ~550 KB | ~13 MB total | 1024 JPG/PNG + FBX rig |
| `anims.glb` (Soldier donor) | 1 | 2.11 MB | never rendered — retarget donor only |
| Procedural canvas labels | 0 on disk | generated at runtime | see below |

**Runtime VRAM math** (RGBA + full mip chain multiplies footprint by ≈ 4/3):

- One 1024² RGBA texture with mips = `1024·1024·4·1.333 ≈ 5.6 MB`. The 12 PBR maps (4 sets × 3) ≈ **67 MB**.
- **Procedural product labels are the dominant VRAM consumer.** Each SKU generates a front label canvas of `512×640` (boxes) or `512×512` (bags), and cylinder SKUs (can/jar/bottle/cup/tub) *also* generate a `1024×420` wrap-around variant. Per box SKU ≈ `512·640·4·1.333 ≈ 1.75 MB`; per cylinder SKU ≈ `1.75 + (1024·420·4·1.333) ≈ 1.75 + 2.29 = 4.0 MB`. Plus one `256×96` price-tag texture per SKU ≈ 0.13 MB. At 52 SKUs the mix is ≈ **95 MB**; at the 150-SKU target it linearly reaches **~275 MB** — this is the number that will break the iGPU memory budget first.
- People: 6 avatars × (2 color + 2 normal at 1024² + 1 opacity 1024²) ≈ 6 × 28 MB ≈ **168 MB** if all resident. Only ~13 avatar *instances* render but they share the 6 source texture sets via `SkeletonUtils.clone`, so it stays ~168 MB not ×13.
- Shadow maps: 16.8 MB (lite) / 33.5 MB (high). PMREM: ~8 MB.

**Total resident VRAM at 52 SKUs, high tier ≈ 67 + 95 + 168 + 34 + 8 ≈ 372 MB** — comfortable on a 1–2 GB iGPU carve-out. At 150 SKUs it approaches ~550 MB and needs the atlas plan.

**Atlas plan (proposed):**
1. **Price tags** (256×96, one per SKU): pack all 150 into a single **2048×2048** atlas (holds `floor(2048/256)·floor(2048/96) = 8·21 = 168` tiles). Collapses 150 `InstancedMesh` tag draws (one per SKU today) into **1** instanced draw with per-instance UV offset. Saves ~150 draws and ~19 MB.
2. **Product front labels**: pack into **4096×4096** atlases at 512×640 tiles = `8·6 = 48` per atlas → 4 atlases for 150 SKUs. Does *not* reduce draws (labels already batch per-SKU-instance), but lets multiple SKUs that share a section share one material/atlas, cutting program switches.
3. **Cylinder wraps** stay separate (aspect ratio differs); pack 1024×420 into 4096×2048 = `4·4 = 16` per atlas.

**KTX2 / Basis decision — explicit:**

| Asset class | KTX2? | Reasoning |
|---|---|---|
| Procedural canvas labels/tags | **No** | generated at runtime from `document.createElement('canvas')`; there is no build step to transcode, and a runtime Basis encoder would add a worker + seconds of stall — violates the <8 s interactive budget. Keep as `CanvasTexture` sRGB. |
| Static PBR sets (floor/wall/wood/asphalt) | **Optional, deferred** | uncompressed footprint (67 MB) is affordable at the floor; KTX2 (ETC1S) would cut it to ~12 MB and halve load bytes. Worth it *only* when targeting sub-1 GB devices. Requires bundling the ~500 KB Basis transcoder — a real cost against the no-backend, small-download goal. |
| Photoscan model textures (1024²) | **Optional, deferred** | already resized to 1024 by `gltf-transform` at fetch time; KTX2 via `gltf-transform etc1s` would cut kit download from ~11 MB toward ~4 MB. Recommend enabling in the model pipeline (`fetch-models.mjs`) once the transcoder cost is accepted. |
| People textures | **No (for now)** | opacity hair uses alpha-tested PNG; ETC1S alpha handling is lossy on thin hair cards. Keep JPG/PNG. |

Net KTX2 stance: **do not KTX2 anything by default** (it fights the no-build, small-bundle, fast-interactive constraints), but wire it into the two *offline* pipelines (PBR fetch + model fetch) behind a flag for the sub-1 GB device target. Never KTX2 the runtime-generated packaging.

### 21.9 Load pipeline: phase-by-phase to interactive < 8 s

The boot sequence is orchestrated in the `main.js` top-level `try` block with a `LoadingManager` driving the `#bootbar` progress fill. The critical insight is that the **shader-compile storm is paid behind the boot screen**, not on the first rendered frame: `manager.onLoad` sets `bootmsg = 'Preparing shaders…'`, waits one `requestAnimationFrame`, then calls `renderer.compile(scene, camera)` before fading the boot overlay. Without this, integrated GPUs froze for several seconds on frame one while every material's program compiled on demand.

Phase budget on the D0 Floor device (assets served locally / warm HTTP cache — the network term is environment-dependent and excluded from the compute budget):

| Phase | Work | Budget (ms) | Cumulative |
|---|---|---|---|
| 1. Document + boot paint | parse `index.html`, paint boot overlay | 50 | 0.05 s |
| 2. JS parse + eval | three r160 (~600 KB) + app modules | 400 | 0.45 s |
| 3. `loadEnvironment` | fetch HDRI 1.67 MB, decode, `PMREMGenerator.fromEquirectangular` | 1,200 | 1.65 s |
| 4. `preloadModels` | fetch + parse 22 GLB (~11 MB), normalize bbox to y=0 | 1,500 | 3.15 s |
| 5. `buildStore` | procedural geometry, 52 SKU canvas labels + tags, merges, instancing | 900 | 4.05 s |
| 6. `renderer.compile` | shader precompile storm for all resident programs | 1,200 | 5.25 s |
| 7. First `composer.render` | RenderPass + bloom + output, warm the RT | 200 | 5.45 s |
| **Interactive (playable)** | boot fades, pointer-lock armed | — | **≈ 5.5 s** |
| 8. `createShoppers` (async) | 6 FBX (~3.3 MB) load + retarget bake + sanity gate | 2,000 | fills in ~7.5 s, **off critical path** |

Interactive-to-play is **≈ 5.5 s**, comfortably inside the 8 s floor target, with a ~1.5 s margin absorbed by shader compile variance. NPC population (phase 8) is deliberately *asynchronous* (`(async () => { … })()` in `characters.js`) so shoppers stream in over the following ~2 s while the player already walks — the store is never empty *and* never blocks boot. If phase 8 fails entirely (`CAST EMPTY`), the store simply has no shoppers and the game still plays; the retarget sanity gate (§verify below) rejects any avatar whose baked clip fails the standing-human check (`span.h` in 1.15–2.3 m, head y in 1.25–2.1 m) rather than shipping "pretzel people."

**Shader precompile strategy details:** `renderer.compile(scene, camera)` walks the scene graph and compiles the program for every material against the current light setup *before* the boot screen lifts. Because tiers change the light *count* (rect lights appear in high, spots toggle shadow), the precompile happens in the lite light configuration — the light-count change on upgrade to high triggers a *second* smaller compile spike, but by then the player is mid-game and the ~110 troffer/streak/stock programs are already warm, so the high-tier upgrade compile is limited to the shadow and rect-area permutations (~a dozen programs, <100 ms). This is acceptable; a fully pre-warmed high tier would double phase 6 for a tier most floor devices never enter.

### 21.10 Frame-time watchdog + auto-tier rules

**Shipped one-shot benchmark** (`autoQuality` in `main.js`), exact rules:

1. **Frame 3:** freeze all spotlight shadows — `shadow.needsUpdate = true` then `shadow.autoUpdate = false`. One final shadow render, then never again (static geometry).
2. **Frames 21–80** (inclusive of the `frames > 20 && frames <= 80` window): accumulate `acc += dt` — a 60-frame integration window.
3. **Frame 80:** compute `avg = acc / 60` and branch:
   - `avg < 0.020` (i.e. > 50 fps, **20 ms**) → `applyHigh()`: enable GTAO, un-hide all 5 rect lights, re-enable shadows on all 8 spots (`needsUpdate` once). `tier = 'high'`.
   - `avg > 0.055` (< ~18 fps, **55 ms**) → `renderer.setPixelRatio(1)`, `composer.setSize(w, h)`, `tier = 'panic'`.
   - otherwise → `tier = 'lite-locked'` (stay lite forever).
   - Publish `window.__tier` for CI/telemetry.

The 60-frame window at boot (~1 s of play after the pointer-lock warm-up) is chosen to skip the noisy first 20 frames (texture uploads, first-hit compiles) and average over enough frames to reject one-off hitches. `dt` is clamped to `0.05` (`Math.min(clock.getDelta(), 0.05)`) so a single stalled frame can't poison the average or launch the physics/movement integrators past their stable step.

**Proposed continuous watchdog with hysteresis** (extension — the shipped benchmark is one-shot and never re-evaluates; a mid-session thermal throttle or a walk into BV1 currently can't trigger a downshift). Add a rolling monitor that runs every frame *after* frame 80:

| Rule | Threshold | Dwell (consecutive frames) | Action | Cooldown |
|---|---|---|---|---|
| **Downshift** | rolling 30-frame avg > **0.028** (< 35 fps) | 45 frames (~1.3 s) | drop one tier: high → lite-locked → panic | 240 frames before any further change |
| **Upshift** | rolling 30-frame avg < **0.015** (> 66 fps) | 180 frames (~3 s) | raise one tier: panic → lite → high | 240 frames, and only if no downshift in last 600 frames |
| **DPR panic ladder** | avg > **0.045** while already lite-locked | 60 frames | step DPR down one rung | 240 frames |

DPR panic ladder rungs: **1.25 → 1.0 → 0.85 → 0.75 (floor)**. Never below 0.75 — sub-0.75 renders are unreadable for a shopping-list HUD game (Ch. 7). The asymmetric dwell (45-frame downshift, 180-frame upshift) plus the 240-frame cooldown is the hysteresis that prevents tier oscillation ("flapping") when the frame time sits exactly on a threshold: it drops fast (protect the framerate) and recovers slow (avoid thrash). The 600-frame anti-flap guard on upshift prevents a device that just downshifted from immediately trying to climb back into the tier that overloaded it.

Telemetry (Ch. 24) records every tier transition with `{ from, to, avgMs, view: nearestBenchmarkView, t }` so the field distribution of `lite-locked` vs `high` vs `panic` populations is observable per GPU string.

### 21.11 Draw-call audit checklist for new content

Every PR that adds visible content must pass this checklist before merge (enforced in review + the Ch. 23 framebuffer-grid capture). The window debug hooks (`window.__scene`, `__renderer`, `__composer`, `__stock`, `__tier`) exist precisely so this is measurable, not guessed.

1. **Batch it or justify it.** Any repeated mesh (≥ 3 copies) must be an `InstancedMesh` or a `mergeGeometries` merge. If you added N loose `new THREE.Mesh` in a loop, that is N draws — convert. Reference patterns: freezer parts, apparel colors, endcap trays, ceiling troffers.
2. **Share the geometry.** New geometry goes through a cache keyed on dimensions (`_geoCache` pattern in `products.js`) so two "0.15×0.24×0.07 box" products share one buffer.
3. **Share the material.** New materials go through a `(id : role)` cache (`_matCache`) or one of the `METAL`/`PAINTED`/`PLASTIC` factories. A fresh `MeshStandardMaterial` per runtime spawn = a shader recompile risk. Never mutate a cached material.
4. **Collapse box/cylinder groups.** Any box product uses `twoGroupBox` (2 groups, not 6); any can uses the contiguous top+bottom trick (2 groups, not 3). A 6-group box triples its draw count.
5. **Shadows: default off.** New products/props set `castShadow = false` unless they are a large static fixture. Only structural fixtures and hero props cast; the 8 spots are the only casters, and their maps freeze at frame 3. Adding a shadow-caster that moves defeats the frozen-map optimization — don't.
6. **Emissive, not light.** Need something to glow? Use an emissive material (+ let bloom threshold 0.96 catch it) or an additive decal, **not** a new real light. The scene has a hard budget of its 14 real lights; a 15th `SpotLight` adds a per-fragment lighting term to *every* material's shader and forces recompilation.
7. **Fog-and-forget distance.** Anything past 46 m is fully fogged — don't add detail meshes out there; the exterior lot (Ch. 15) is intentionally low-detail behind glass.
8. **Measure against the six views.** Capture BV1–BV6 (§21.2) before/after with `renderer.info.render.calls` and `.triangles`. Hard gates: **BV1 must stay ≤ 1,000 draws and ≤ 1.4 M triangles.** If your change pushes BV1 past 1,000 draws, it must ship *with* the region-split (§21.6) or be cut.
9. **VRAM check for new textures.** A new 1024² RGBA texture with mips costs 5.6 MB; a new per-SKU canvas label costs 1.75–4.0 MB. Adding 20 SKUs adds ~40–80 MB — check it against the atlas plan (§21.8) and the ~550 MB ceiling before the 150-SKU target.
10. **Interactive-budget check.** New async loads (models, textures) go through the `LoadingManager` so the boot bar reflects them, and heavy work (retarget bakes, big fetches) goes *off* the critical path like `createShoppers` — the < 8 s interactive budget (§21.9) is a release gate, not a guideline.

Any item that cannot be satisfied is a design conversation, not a silent regression: the whole point of the tier system is that the game stays smooth on the weakest hardware we ship for, and every new asset either fits that contract or is measured, budgeted, and consciously accepted.



# Chapter 22 — Physics — Complete Specification

This chapter is the authoritative reference for `src/physics.js` (355 lines) and the movement/collision code it collaborates with in `src/main.js`, `src/characters.js`, and `src/store.js`. Grocery Dash 3D does not ship a general rigid-body engine. It ships **three bespoke arcade systems** that share one `update(dt, playerPos, playerVel)` call: dynamic **carts**, ballistic **debris**, and tippable **gondolas** — plus a **player-locomotion** solver and an **NPC-shove** responder. Every value below is the shipped tuned constant. `[BUILD]` sections spec systems that do not yet exist and MUST be added additively without changing shipped feel. Cross-references use the Ch. N map (Ch. 2 rulesets, Ch. 4 economy, Ch. 9 game-feel, Ch. 17 NPCs/barks, Ch. 18 audio, Ch. 20 schemas, Ch. 21 rendering, Ch. 23 testing).

### 22.1 Design philosophy and the frame model

The physics exists to make the store feel like a physical place you can wreck — "grocery shopping meets GTA" (Ch. 1). Three rules govern every addition:

1. **Arcade over accuracy.** No solver iterations, no constraint graph, no sleeping islands. Each system integrates explicit Euler once per frame. Determinism of the *scoring loop* comes from stream separation (22.18), never from a fixed timestep.
2. **Never hitch a frame.** The single worst-case event — tipping a full gondola — spills 56 items. Spawning 56 meshes in one frame stalls an Intel iGPU for ~40 ms. So spills are **queued** and drained `SPAWNS_PER_FRAME` at a time (22.6).
3. **Damage is diegetic and billed.** Every knocked item adds to a running tab shown at checkout (22.11), so chaos has a scored cost (Ch. 4).

**Timestep.** `main.js` computes `dt = Math.min(clock.getDelta(), 0.05)`. The 50 ms clamp (20 fps floor) prevents tunneling and "explosion on tab-refocus" when `requestAnimationFrame` resumes after a long pause. All integration below assumes this clamped `dt`. Frame order per tick (`main.js` `animate()`): `autoQuality(dt)` → `move(dt)` → `physics.update(dt, camera.position, playerVel)` → `world.update(dt, camera)` → `shoppers.update(dt)` → `game.update(dt, playing)` → `composer.render()`. Physics runs **after** player movement (so it reads the just-committed player position/velocity) and **before** NPC and game logic (so shoves and grabs see this frame's debris).

### 22.2 Master constant table

Every tuned constant across the physics-owning files, with valid range and the feel it buys.

| Constant | File | Value | Unit | Valid range | Feel rationale |
|---|---|---|---|---|---|
| `PLAYER_R` | physics.js | 0.34 | m | 0.30–0.40 | Player collision circle; matches `R` in main.js so shove and block agree |
| `CART_R` | physics.js | 0.48 | m | 0.42–0.55 | Cart collision circle; slightly under the ~0.9 m visual footprint so carts thread aisles |
| `TIP_SPEED` | physics.js | 4.0 | m/s | 3.6–4.4 | Sprint-crash threshold to topple a whole gondola; sits just under run speed 4.9 so only a committed sprint tips |
| `KNOCK_SPEED` | physics.js | 1.6 | m/s | 1.2–2.0 | Walk-crash threshold to knock items loose; above idle drift, below walk 3.1 so any real bump knocks |
| `DEBRIS_CAP` | physics.js | 100 | count | 60–140 | Hard ceiling on live debris meshes; caps draw calls and GC pressure |
| `DEBRIS_TTL` | physics.js | 28 | s | 20–40 | Resting clutter lingers this long before the cleanup fade — long enough to re-grab, short enough to self-clean |
| `SPAWNS_PER_FRAME` | physics.js | 9 | count | 4–12 | Spill drain rate; 56 items ÷ 9 ≈ 7 frames (~0.12 s) — reads as a cascade, never a hitch |
| `crashCd` reset (gondola) | physics.js | 0.45 | s | 0.3–0.6 | Debounce so one wall-scrape can't multi-trigger knock/tip |
| `crashCd` reset (fixture) | physics.js | 0.50 | s | 0.3–0.6 | Same debounce for non-gondola fixtures |
| Player→cart impulse gain | physics.js | 1.15 | ratio | 1.0–1.4 | Multiplier on closing speed transferred to a shoved cart; >1 gives a satisfying "kick" |
| Player→cart shake threshold | physics.js | 2.4 | m/s | 2.0–3.0 | Above this closing speed a shove adds camera shake 0.15 + thud |
| Cart↔cart transfer gain | physics.js | 0.7 | ratio | 0.5–0.9 | Momentum each cart trades in a collision (soft, lossy — arcade billiards) |
| Cart↔cart clatter threshold | physics.js | 1.5 | m/s | 1.0–2.0 | Relative speed above which cart-cart hits play `clatter` |
| Cart friction coefficient | physics.js | 2.2 | 1/s | 1.6–3.0 | Per-second velocity bleed `f = min(1, 2.2·dt)`; carts coast ~1.5 s then stop |
| Cart wall restitution | physics.js | 0.4 | ratio | 0.2–0.6 | `(1+0.4)` bounce off fixtures and bounds; lively but not pinball |
| Cart tip threshold | physics.js | 2.6 | m/s | 2.2–3.2 | Inbound normal speed `-vn` above which a wall crash tips the cart |
| Cart thud threshold | physics.js | 1.0 | m/s | 0.8–1.5 | `-vn` above this (but below tip) plays `thud` |
| Cart tip rate | physics.js | 3.0 | 1/s | 2–4 | `tipT += dt·3` → topple completes in ~0.33 s |
| Cart tip final roll | physics.js | 1.42 | rad | 1.3–1.5 | ≈81.4°; cart lies on its side, wheels out |
| Cart tip lift | physics.js | 0.25 | m | 0.2–0.3 | `pos.y` rise as the body rolls onto its side |
| Gravity | physics.js | 9.8 | m/s² | 9.0–10.5 | Debris fall; real-ish so arcs read as "heavy groceries" |
| Debris floor restitution | physics.js | 0.28 | ratio | 0.2–0.35 | `v.y = -v.y·0.28` — one or two dull bounces, no jitter |
| Debris ground friction | physics.js | 0.55 | ratio | 0.4–0.7 | Horizontal `v.x,v.z *= 0.55` per bounce |
| Debris spin damp | physics.js | 0.5 | ratio | 0.3–0.6 | `w *= 0.5` per bounce so tumble decays |
| Debris rest speed | physics.js | 0.55 | m/s | 0.4–0.7 | `|v.y| < 0.55` after a bounce → settle to resting |
| Debris tick threshold | physics.js | 1.2 | m/s | 1.0–1.5 | `|v.y| > 1.2` on floor contact plays `tick` |
| Debris fade duration | physics.js | 0.8 | s | 0.6–1.0 | Scale-to-zero cleanup; `scale = max(0.001, 1 − fade/0.8)` |
| Debris damage rate | physics.js/game.js | 0.40 | ratio | 0.3–0.5 | Billed fraction of `spec.price` per knocked item (Ch. 4) |
| Gondola tip duration | physics.js | 0.85 | s | 0.7–1.0 | `tipT += dt/0.85`; a heavy, deliberate fall |
| Gondola fall accel knee | physics.js | 0.82 | 0–1 | 0.75–0.9 | `t<0.82` accelerating fall, then a settle bounce |
| Gondola settle amp | physics.js | 0.045 | rad | 0.03–0.06 | Overshoot wobble at the end of the fall |
| Gondola final angle | physics.js | π/2 − 0.06 = 1.5108 | rad | — | ≈86.6° (spec'd "87°"); leaves a lip so it reads as leaning, not clipping the floor |
| Gondola pivot offset | physics.js | 0.46 | m | 0.42–0.50 | Distance from center to the base edge the aisle pivots on |
| Gondola fallen collider H | physics.js | 1.9 | m | islandLen-dependent | New walkable footprint depth after collapse |
| Gondola spill cap | physics.js | 56 | count | 40–70 | Flung debris; rest silently hidden |
| Gondola spill vy | physics.js | 0.6 + 1.4·y + rand | m/s | — | Higher shelves fling higher |
| Gondola spill push | physics.js | 1.2 + 1.8·y + 1.5·rand | m/s | — | Higher shelves fling farther out the fall side |
| Gondola shake | physics.js | 0.9 | 0–1 | 0.7–1.0 | Near-max camera shake on collapse |
| Knock box half-extent | physics.js | 0.7 | m | 0.6–0.9 | Half-width of the region searched for items at a walk-crash impact |
| Knock item count | physics.js | 1 + floor(speed) | count | — | Faster walk-crash dislodges more items |
| Knock impact offset | physics.js | 0.9 | m | 0.7–1.1 | Impact point projected ahead of the camera |
| Knock oomph factor | physics.js | 0.5 | ratio | 0.4–0.6 | `speed·0.5` scales knocked-item horizontal velocity |
| Knock toast chance | physics.js | 0.40 | prob | 0.3–0.5 | Chance a walk-crash surfaces a billing toast |
| Debris angular init | physics.js | ±3 / ±8 / ±3 | rad/s | — | Random spin `(rand−0.5)·6`, `·8`, `·6` on x/y/z at spawn |
| NPC shove range | physics.js | 0.66 | m | 0.55–0.8 | Player-NPC contact distance |
| NPC shove min closing | physics.js | 0.6 | m/s | 0.4–0.9 | Below this you brush past; above you shove |
| NPC shove impulse gain | physics.js | 1.1 | ratio | 0.9–1.3 | Applied to `min(rel,4)` |
| NPC shove speed clamp | physics.js | 4.0 | m/s | — | Caps launch so a sprint can't rocket an NPC |
| NPC shove duration | physics.js | 0.55 | s | 0.4–0.7 | Stagger time |
| NPC shove cooldown | physics.js | 1.3 | s | 1.0–1.6 | Per-NPC debounce |
| NPC shove decay | characters.js | 4.5 | 1/s | 3–6 | `vx -= vx·min(1,4.5·dt)` stagger bleed |
| NPC shove yaw jitter | characters.js | ±0.6 | rad/s | 0.4–0.9 | Spin-out wobble during stagger |
| NPC bump shake | physics.js | 0.22 | 0–1 | 0.15–0.3 | Camera shake on a shove |
| Toast lifetime | physics.js | 2.6 | s | 2.0–3.5 | On-screen dwell for a bark line |
| Shake decay | physics.js | 1.6 | 1/s | 1.2–2.2 | `shake -= dt·1.6` |
| Shake→camera gain | main.js | 0.12 | m | 0.08–0.16 | Positional jitter amplitude `(rand−0.5)·shake·0.12` |

**Locomotion constants** (`main.js`), reproduced because block/impact routing depends on them:

| Constant | Value | Unit | Notes |
|---|---|---|---|
| `R` (player) | 0.34 | m | AABB inflation for `hitC` collision test |
| `SPEED_WALK` | 3.1 | m/s | Default move speed |
| `SPEED_RUN` | 4.9 | m/s | Shift-sprint; the only speed that clears `TIP_SPEED` |
| Camera eye height | 1.65 | m | Base `camera.position.y` |
| Head-bob rate | 13.5 (run) / 10.5 (walk) | rad/s | `bob += dt·rate` |
| Head-bob amplitude | 0.045 (run) / 0.030 (walk) | m | `sin(bob)·amp` |
| Drag-look sensitivity | 0.0042 | rad/px | Fallback look only |
| Pitch clamp | ±1.45 | rad | ≈±83° |

### 22.3 Integration contract and shared state

`createPhysics({ scene, world, camera })` returns:

- `update(dt, playerPos, playerVel)` — the per-frame tick.
- `onPlayerBlocked(collider, speed, dx, dz)` — impact router, called by `main.js` when a move is blocked (22.9).
- `toast(msg)` — bark surface (2.6 s).
- `get shake()` — current 0–1 shake for the camera jitter in `main.js`.
- `get damage()` — `{ total, count }` billing accumulator (22.11).
- `debrisMeshes` — **stable array reference** mutated in place; `game.js` raycasts it for grab-a-fallen-item. It is rebuilt via `syncDebrisList()` only on add/remove, never per frame, so no allocation churn.
- `removeDebris(mesh)` — called by `game.js` when a fallen item is picked up.

Carts, gondolas, and debris are the three internal collections. Carts and gondolas are seeded from `world.physicsMeta` (built in `store.js` 22.7/22.5). Debris starts empty.

### 22.4 Player locomotion physics

`move(dt)` in `main.js` is the player solver. It is axis-separated so a wall never fully stops motion along the free axis (classic FPS slide).

**Direction.** `camera.getWorldDirection` → flatten `y=0` → normalize → `_right = dir × up`. Input `f = W−S`, `s = D−A`. Combined `(vx,vz)` normalized so diagonal isn't faster. `playerVel = (dx·SPEED, 0, dz·SPEED)` — this exact vector is handed to physics.

**Collision test.** `hitC(x,z)` returns the first static collider whose inflated AABB contains the point: `x > minX−R && x < maxX+R && z > minZ−R && z < maxZ+R`. This is a point-vs-inflated-box test (Minkowski of a 0.34 m disc against an axis-aligned box). Carts and NPCs are **not** in `world.colliders`, so the player is never hard-blocked by them — they are shoved instead (22.5, 22.8).

**Axis resolution and impact.** For proposed `nx = p.x + dx·SPEED·dt`:
```
stuck = !!hitC(p.x, p.z)          // already wedged? allow escape
cX = hitC(nx, p.z)
if (nx in bounds && (stuck || !cX)) p.x = nx
else if (cX) physics.onPlayerBlocked(cX, SPEED, dx, dz)
```
Same for `nz`. The **stuck-escape** clause (`stuck || !cX`) is load-bearing: if the player is ever inside a collider (e.g. a gondola collapsed onto them, 22.7), they can always walk out — otherwise they'd be frozen. `SPEED` (3.1 or 4.9), not the possibly-reduced step, is passed to `onPlayerBlocked` so the router sees true intent speed.

**Camera feel.** `camera.position.y = 1.65 + bob + shakeJitter`, where `bob = sin(bob)·amp` only while moving and `shakeJitter = (rand−0.5)·shake·0.12` whenever `shake>0`. See Ch. 9 for how bob/shake read as presence.

### 22.5 Cart system — state machine

Carts are dynamic circles (radius 0.48) with momentum. Source geometry `shoppingCart()` in `store.js` (~0.9 m long). Three free carts spawn at the corral/aisle; two more trail NPCs (`characters.js`, not simulated by this system — those are kinematic followers).

**States: `free` → `pushed` (transient) → `tipped` (terminal).**

| State | Entry | Behavior | Exit |
|---|---|---|---|
| free | default | Integrates velocity + friction, collides with fixtures/bounds/other carts, steers to face motion | → tipped on hard wall crash |
| pushed | player disc overlaps cart disc with positive closing speed | Adds impulse `n·rel·1.15`, positional separation; is a per-frame modifier of `free`, not a latched state | back to free next frame |
| tipped | wall crash with inbound normal speed `−vn > 2.6` | Plays a 0.33 s roll animation (`rotation.z → tipSign·1.42·t²`, `pos.y → 0.25·t²`), then inert; excluded from all further collision | none (terminal until list reroll) |

**Player shove (per frame).** With `pdx = cart.x − player.x`, `pd = hypot(pdx,pdz)`, if `pd < 0.82` (`PLAYER_R+CART_R`): normal `n = (pdx,pdz)/pd`, closing `rel = playerVel·n`. If `rel > 0`: `cart.v += n·rel·1.15`. Always positionally separate by `need = 0.82 − pd` along `n` (the cart moves; the player does not — the player's own collider never included the cart). If `rel > 2.4`: `addShake(0.15)`, `SFX.thud()`.

**Cart↔cart.** For each other non-tipped cart, if center distance `od < 0.96` (`CART_R·2`): closing `rel = (cart.v − other.v)·n`. If `rel > 0`: exchange `other.v += n·rel·0.7`, `cart.v −= n·rel·0.7` (soft, 30% loss). If `rel > 1.5`: `SFX.clatter()`. Split the overlap: each cart moves `need = (0.96−od)/2`.

**Integration + friction.** Only if `sp = hypot(vx,vz) > 0.01`: `pos += v·dt`; `v −= v·min(1, 2.2·dt)`. Then `circleVsColliders(cart.x, cart.z, 0.48)` (22.10 math). On hit: push out by `depth·n`, compute `vn = v·n`; if `vn < 0` reflect `v −= (1.4)·vn·n`. If `−vn > 2.6` → **tip** (`tipSign` random ±1 via the cosmetic stream, 22.18), `addShake(0.35)`, `SFX.crash()`, toast one of the 3 `CRASH_LINES`. Else if `−vn > 1.0` → `SFX.thud()`. Then bounds clamp: on each wall, snap inside and reflect that component at 0.4 restitution.

**Roll steer.** `cart.yaw` slerps toward `atan2(vx,vz) − π/2` at rate `min(1,dt·2)·min(1,sp)` — a fast cart snaps to face travel; a slow one barely turns. Purely visual.

### 22.6 Debris system — state machine

Debris are real product meshes (`buildProduct(spec)`) spawned when items are knocked loose. They are ballistic, then become grabbable floor clutter, then self-clean.

**States: `queued` → `airborne` → `resting` → `fading` → removed.**

| State | Field | Behavior |
|---|---|---|
| queued | `spawnQueue[]` | Args pushed by `spawnDebris`; `damageTotal += price·0.4`, `damageCount++` immediately (billed on intent, not on land). Up to 9 drained per frame by `spawnDebrisNow` |
| airborne | `resting=false` | `v.y −= 9.8·dt`; `pos += v·dt`; `rot += w·dt`. Angular `w` seeded `(rand−0.5)·{6,8,6}` |
| resting | `resting=true, age=0` | Velocity zeroed; rotation snapped to nearest π/2 on x and z; body re-seated on floor via measured bbox min.y; still raycastable for grab (game.js) |
| fading | `age>28` | `fade += dt`; `scale = max(0.001, 1 − fade/0.8)`; removed at `fade ≥ 0.8` |

**Spawn (`spawnDebrisNow`).** Build mesh, set position/`rotation.y`, measure `Box3` once for the hover-highlight box (`userData.size`, `userData.centerY`), tag `userData.debris = true`, add to scene, push a record with velocity `(vx,vy,vz)` and random spin. **Cap enforcement:** if `debris.length > 100`, remove the oldest **resting** piece (`findIndex(d.resting)`), else the oldest piece outright — so live projectiles are preserved over settled clutter. `syncDebrisList()` rebuilds the stable mesh array.

**Floor contact (`pos.y ≤ 0`).** Clamp `y=0`; if `|v.y| > 1.2` play `tick`; `v.y = −v.y·0.28`; `v.x,v.z *= 0.55`; `w *= 0.5`. **Settle test:** if `|v.y| < 0.55` → resting: zero velocity, snap x/z rotation to nearest π/2 so it lies flat, then seat visually — set `y=0.01`, `updateMatrixWorld`, measure bbox, add `0.005 − box.min.y` so a rotated product whose origin is offset doesn't half-bury. This bbox reseat is why fallen cans and boxes lie on the floor instead of sinking.

**Knock source (`knockItems`).** `world.stock.hideInRegion(box, count)` hides instanced facings and returns their transforms; each becomes debris with horizontal velocity `dir·(0.6 + rand·oomph) + (rand−0.5)·0.8` and `vy = 0.5 + rand·1.2`. Plays `clatter` if any hidden. Returns the count (used for the 40% billing toast).

### 22.7 Gondola system — state machine

Gondolas are the shelf islands (four grocery `axis:'z'` at x = −18/−14/−10/−6, len 16; two merch `axis:'x'` at z = −7.5/−3.5, len 12; one toys `axis:'z'` at x=19.5, len 10). Each carries `{ group, collider, axis, cx, cz, len, label }` in `physicsMeta.gondolas`. Body height `H = 1.85`, half-depth `HD = 0.42`; shelves at y = 0.28/0.68/1.08/1.48.

**States: `standing` → `[wobble` (22.14 BUILD)] → `tipping` → `fallen`.**

| State | Duration | Behavior |
|---|---|---|
| standing | — | Static collider; routes player crashes to knock/tip (22.9) |
| tipping | 0.85 s | Pivot rotates; spill already flung; collider already mutated |
| fallen | terminal | Aisle lies flat; footprint collider is walkable clutter |

**`tipGondola(g, sign)`** (idempotent — early-returns if already tipped):
1. **Spill region** = a thin box straddling the whole aisle length on the fall side. `hideInRegion(box, 9999)` hides all stock; the first **56** become debris. Per item: `vy = 0.6 + 1.4·y + rand`, `push = 1.2 + 1.8·y + 1.5·rand`, launched along the tip axis `sign·push` with cross-axis jitter `(rand−0.5)·1.2`. Higher shelves fly higher and farther — the tip reads as the whole face vomiting stock outward.
2. **Pivot.** A new `Object3D` at the base edge on the fall side (`cx + sign·0.46` for axis z, or `cz + sign·0.46` for axis x). `pivot.attach(g.group)` reparents so rotation is about the floor edge, not center.
3. **Collider mutation.** The AABB becomes the fallen footprint of depth `H=1.9` on the fall side (`minX/maxX` for axis z, `minZ/maxZ` for axis x). The tipped aisle now blocks where its top landed and opens where it stood — permanently changing the walkable map (a core "GTA" beat, Ch. 1).
4. `addShake(0.9)`; `SFX.crash()`; toast `📢 CLEANUP ON AISLE {label} — ALL OF IT.`

**Tip animation.** `tipT += dt/0.85`. `fall = t<0.82 ? (t/0.82)² : 1 + sin((t−0.82)/0.18·π)·0.045·(1−t)`. `ang = −sign·(π/2 − 0.06)·fall`. Axis z rotates `pivot.rotation.z = ang`; axis x rotates `pivot.rotation.x = −ang`. On completion, `SFX.thud()` (the landing).

### 22.8 NPC-shove system — state machine

NPCs (Ch. 17) walk a path graph and are kinematic. The physics layer only reacts to the player barging into them.

**States: `walking/browsing` → `shoved` (0.55 s) → recover.**

Per NPC in `update`: decrement `shoveCd`; skip if cooling. With `d2 = hypot(n.x−player.x, n.z−player.z)`, if `d2 < 0.66` and closing `rel = playerVel·n > 0.6`: set `n.shove = { vx: n.x·..., vz: ..., t: 0.55 }` with launch `n·min(rel,4)·1.1`; `n.shoveCd = 1.3`; extend any browse pause by ≥1.0 s; `addShake(0.22)`; `SFX.thud()`; toast one of 5 `BUMP_LINES`. In `characters.js`, while `n.shove` is live: `pos += shove.v·dt`; `shove.v` decays at `min(1,4.5·dt)`; `yaw += (rand−0.5)·1.2·dt` (spin-out); clears when `t ≤ 0`. Staff NPCs then drift home (`home` lerp).

### 22.9 Player impact routing — `onPlayerBlocked`

Called once per blocked axis from `main.js`. Decision tree, gated by `crashCd`:

```
if (crashCd > 0) return
g = gondolas.find(collider match && !tipped)
if (g):
    crashCd = 0.45
    sign = (axis==='z') ? (dx>=0?1:-1) : (dz>=0?1:-1)   // which way it falls
    if (speed >= 4.0):  tipGondola(g, sign); return       // sprint → collapse
    if (speed >= 1.6):                                     // walk → knock
        impact = camera.pos + dir·0.9
        n = knockItems(0.7-box around impact, 1+floor(speed), dx, dz, speed·0.5)
        addShake(0.3); SFX.thud()
        if (n && rand < 0.4) toast('Whoops — that's going on your bill.')
        return
// non-gondola fixture, or a slow gondola touch:
if (speed >= 1.6): crashCd = 0.5; addShake(0.18); SFX.thud()
```

The `sign` derivation is the crux of directional collapse: for a z-axis aisle, a player pushing in `+x` (`dx≥0`) topples it toward `+x`. `crashCd` (0.45/0.50 s) prevents a wall-scrape from firing every frame.

### 22.10 Collision rules matrix

Entities: **P**layer, **C**art, **N**PC, **D**ebris, **F**ixture (static AABB collider), **G**ondola-collider (a fixture that also routes impacts). Cell = the resolution when the row entity contacts the column entity.

| ↓ vs → | Player | Cart | NPC | Debris | Fixture | Gondola |
|---|---|---|---|---|---|---|
| **Player** | — (single) | one-way shove of cart (P not blocked) | one-way shove of NPC if closing>0.6 | none (grab-only via raycast) | AABB block + slide + `onPlayerBlocked` | AABB block + route to knock/tip |
| **Cart** | receives shove impulse ×1.15 | circle-circle, trade 0.7, clatter>1.5 | none | none | circle-vs-AABB bounce 0.4, tip if −vn>2.6 | same as fixture (carts **cannot** tip gondolas) |
| **NPC** | receives shove | none | none | none | none (path graph avoids) | none |
| **Debris** | none | none | none | **none** (BUILD 22.13) | none (passes through) | none |
| **Fixture** | static | static | static | floor plane only | — | — |
| **Gondola** | routes impact | bounces cart | static | — | — | none (BUILD chain guard 22.14) |

Key asymmetries: the player is a **massless shover** (pushes carts/NPCs, is itself only stopped by fixtures); carts bounce off fixtures but never topple a shelf (only the player's sprint can); debris is inert to everything except the floor.

**Circle-vs-AABB core (`circleVsColliders`).** For each collider: nearest point `cp = (clamp(x,minX,maxX), clamp(z,minZ,maxZ))`; `d2 = (x−cp.x)² + (z−cp.z)²`; if `d2 < r²`: `d = sqrt(d2) || 0.001`, return `{ nx:(x−cp.x)/d, nz:(z−cp.z)/d, depth: r−d }`. Worked example: cart at (−17.4, −3), r=0.48, gondola AABB minX=−18.52…maxX=−17.48. `cp.x = −17.48`, `dx = 0.08`, `d = 0.08`, depth `= 0.40` → cart shoved to x=−17.08 with reflection normal (+1,0).

### 22.11 Damage billing model

Every knocked or spilled item bills **40% of `spec.price`** (`spawnDebris`: `damageTotal += spec.price·0.4; damageCount++`). This is charged on **spawn intent** (queue time), not on landing, so a spill's cost is locked even if the cap later culls the mesh. `game.js` `complete()` reads `world.physics.damage` and appends to the checkout banner: `Store damages: {count} items · ${total} 😬`. Worked example: sprint-tipping grocery aisle 3 spills 56 items averaging ~$2.60 → ~$58.24 added to the bill (Ch. 4 ties this to score/economy). Determinism note: `count`/`total` depend only on which SKUs were on that shelf (seeded stock, 22.18), not on the cosmetic randomness of the throw.

---

## [BUILD] extensions

The following are **not** in the shipped code. They must be added to `physics.js` additively, reuse the constants above, and touch no scoring-critical RNG (22.18).

### 22.12 [BUILD] Cart riding and coasting

Let the player mount a cart and coast — a traversal toy, not required for the loop.

**State add to cart machine: `free → ridden → coasting → free`.** New cart fields: `rider: bool`, `mountT`. Interaction script:

1. **Mount.** Aim within `REACH` (2.7 m, Ch. 6) at a non-tipped cart, press **F**. Camera lerps over 0.25 s to eye height `1.42` (seated) anchored to `cart.pos + (0, 1.42, 0)`. Player collider is disabled; `keys` W/S now feed cart thrust instead of walking.
2. **Ridden.** W applies `cart.v += cartForward · 3.4 · dt` (accel, m/s²), S applies `−2.2·dt` (brake), A/D steer `cart.yaw ± 1.6·dt`. Max ridden speed **5.2 m/s**. Cart uses its existing friction (2.2) and wall bounce (0.4) — but **wall crashes while ridden do NOT tip** (guardrail: skip the `−vn>2.6` branch when `rider`), instead ejecting the rider (below) if `−vn > 3.0`.
3. **Coasting.** Release keys → cart keeps its `free` friction; camera stays mounted. Dismount with **F** (camera lerps back to 1.65 over 0.25 s, collider re-enabled at `cart.pos + forward·0.6`, nudged out of any fixture via `circleVsColliders`).
4. **Ejection.** A ridden cart that bounces at `−vn > 3.0`, or a ridden cart shoved by another cart at `rel > 3.5`, throws the rider: player becomes airborne under the debris integrator (gravity 9.8) for ≤0.6 s, `addShake(0.4)`, `SFX.crash()`, toast `"🛒💨 Yeah, that tracks."` Rider re-grounds at `camera.y → 1.65`.

Feel targets (Ch. 9): mount/dismount 0.25 s, seated bob suppressed, steering rate 1.6 rad/s so it drifts like a real cart. No new economy hooks — riding is free.

### 22.13 [BUILD] Debris-vs-debris

Currently debris ignores debris (floor only). Add cheap same-frame separation so big spills pile instead of interpenetrating.

- **Broadphase:** a uniform hash grid, cell **0.6 m**, rebuilt each frame from resting + airborne debris positions (x,z only). Cost: O(n) insert, O(9 cells) query.
- **Narrowphase (resting only, to avoid disturbing arcs):** for each resting piece, test the ≤8 neighbors in adjacent cells. Treat each as a disc of radius `max(size.x,size.z)·0.5`. On overlap `d < r1+r2`: split the penetration, moving each `((r1+r2)−d)/2` along the horizontal normal; re-seat both on the floor with the existing bbox reseat. Cap **6 resolution passes per frame** and **32 pairs per pass** to bound cost on an iGPU.
- **Airborne** pieces do **not** collide with each other (keeps spawn cheap and arcs clean); they only begin separating once resting. This yields believable heaps at aisle-collapse sites without a solver.

### 22.14 [BUILD] Chain-tipping guardrails

A gondola tipping toward a neighbor could cascade the whole store. Allow **one** hop of chain reaction, then hard-stop.

New gondola field `tipGen` (0 for player-caused). In `tipGondola`, after the collider mutates, test whether the fallen footprint AABB overlaps any standing gondola collider (AABB-vs-AABB). If it does and that neighbor's `tipGen < 1`:

- Schedule the neighbor to tip **after a 0.18 s delay** (a domino beat), with `sign` inherited from the faller's travel direction and `tipGen = faller.tipGen + 1`.
- **Guardrails:** (a) never tip a gondola with `tipGen ≥ 1` — max chain depth **1** (the struck aisle plus one neighbor, never a third); (b) never re-tip an already-tipped aisle (existing idempotency); (c) a per-frame **global chain budget of 2** tips prevents a pathological layout from toppling many at once; (d) the delayed tip is queued on the cosmetic timeline, so it cannot affect the list/stock seed (22.18). Feel: a satisfying two-aisle domino, never a runaway.

### 22.15 [BUILD] Freezer-door opening

The 10 glass freezer doors (left wall, `freezerWall`, pitch 1.15 m, W 1.02, H 2.05, D 0.72) are currently static geometry inside one AABB collider. Give them the entrance doors' proximity-slide behavior (`store.js` entrance uses smoothstep at rate `dt·1.6`).

- Each door gets `{ g, closedX/Rot, openAngle, t }`. Hinge on the **latch-side vertical edge**; swing outward (+x, into the store) to **78°** (`1.361 rad`).
- **Trigger:** camera within **1.6 m** of the door center *and* facing it (`dir·doorNormal > 0.3`), OR aim + **E** while the door is hovered. `t += (open?dt:−dt)·2.2`, eased `e = t·t·(3−2·t)` (smoothstep), `rotation.y = lerp(0, 1.361, e)`. Auto-closes when you step away (`t` decays).
- **Fog reveal:** while `t > 0.05`, spawn a cheap additive fog quad (opacity `0.35·(1−t)`) drifting out the door for 0.5 s — a purely visual condensation puff, no lights added (Intel-iGPU floor, Ch. 21).
- **Physics:** the freezer wall's single collider is unchanged (you still can't walk through the wall); the doors are cosmetic + a grab-affordance so the frozen SKUs behind them read as reachable. No collider mutation, so no map change and no determinism impact.

### 22.16 [BUILD] Produce-scale minigame

The hanging scale (`produceExtras`, at (−16.5, ~3.85, 10.7): red bowl, dial with a needle) is decorative. Turn it into an optional weigh-and-bag micro-task worth a small time bonus (Ch. 4/Ch. 12).

**Full interaction script:**
1. **Approach.** Within 2.2 m of the scale, prompt: `Weigh produce — E to place`.
2. **Place.** Press **E** while aiming at a produce SKU you hold intent on (apple/lemon/avocado/banana/onion/sweetpotato — the photoscanned produce, Ch. 16). The item flies into the bowl (reuse the 0.4 s fly from `game.js`). Bowl dips: `bowl.pos.y = −0.62 − min(count·0.006, 0.05)`.
3. **Weigh.** Each placed item adds a hidden true weight (per-SKU, e.g. apple 0.19 kg, banana 0.12 kg, sweetpotato 0.28 kg). The dial needle animates to the summed weight over 0.4 s with a damped spring (`ω=14, ζ=0.55`) so it overshoots then settles — the needle is the existing red line on the dial texture, driven by `dial.rotation.z`.
4. **Target.** A floating label shows a target band, e.g. `Bag ~1.00 kg (±0.08)`. The band and target are drawn from the **seeded list stream** for Daily (22.18) so everyone gets the same target.
5. **Bag.** Press **E** on the scale when satisfied. Score the deviation:
   - `|Δ| ≤ 0.02 kg` → **Perfect**: `−6 s` time bonus, `SFX.listDone()`, toast `⚖️ Nailed it — six seconds off.`
   - `|Δ| ≤ 0.08 kg` → **Good**: `−3 s`, `SFX.tick()`.
   - else → **Off**: no bonus, `SFX.error()`, needle wobbles.
6. **Reset.** Bowl empties (items become airborne debris under the standard integrator, then re-grabbable), needle springs back to 0.

Constants: needle spring `ω=14 ζ=0.55`, bowl dip cap 0.05 m, place fly 0.4 s, bands ±0.02/±0.08 kg, bonuses −6/−3/0 s. Determinism: target weight and SKU spawn are seeded; the needle spring and bowl visuals are cosmetic-stream.

### 22.17 [BUILD] Self-checkout minigame

The two staffed lanes have photoscanned registers; lane 6 is closed (`store.js` 807). Add a **self-checkout kiosk** as an alternative to the auto-complete checkout ring, replacing the instant `complete()` with a scan mini-loop that can shave or add time (Ch. 4/Ch. 12). It must remain **optional** — the checkout ring path (22 loop) still works untouched.

**Setup.** A kiosk collider at the closed lane (x≈−1, z 10.6) with a small angled screen (canvas texture) and a red scan-bed glow strip. Approaching with a complete list shows: `Self-checkout — E to start`.

**Full interaction script (per item on your list):**
1. **Present.** The screen lists your items with `○`/`✓`. Press **E** to grab the top unscanned item's ghost (a translucent clone rises from the bed).
2. **Scan.** Sweep it across the red strip: hold **E** and move the mouse so the ghost crosses the strip center within a **0.35 s** window. A correct sweep speed (ghost crosses at **0.8–2.4 m/s**) triggers a beep (`SFX.tick()`, pitch 880) and marks the item `✓`. Too slow (`<0.8`) → no read, re-sweep. Too fast (`>2.4`) → misread: `SFX.error()`, `+2 s` penalty, screen flashes `Please scan again`.
3. **Bag.** The item flies to the bagging area (0.4 s fly). Bag-area capacity is cosmetic (stacks visually).
4. **Unexpected item.** If store damages exist (`damage.count > 0`), inject one forced `Unexpected item in bagging area` prompt: press **E** to acknowledge (`+1.5 s`), a nod to the billed chaos (Ch. 17 barks can voice an attendant).
5. **Pay.** When all `✓`, screen shows the total + damages (same numbers as `complete()`); press **E** on `PAY`. `SFX.checkout()`.

**Scoring vs. the ring.** Base time is the run timer. Self-checkout applies a **skill delta**: `−1.0 s` per clean first-try scan, `+2.0 s` per misread, `+1.5 s` per unexpected-item prompt. A flawless 6-item run nets **−6 s** vs. the ring's 0 — the reward for taking the harder path. The kiosk calls the same `game.complete()` with an adjusted `time`, so the banner/stats pipeline (Ch. 12) is unchanged.

Constants: sweep window 0.35 s, valid sweep speed 0.8–2.4 m/s, scan pitch 880 Hz, per-scan bonus −1.0 s, misread +2.0 s, unexpected +1.5 s, forced prompt only if `damage.count>0`. Determinism: item order is the list order (seeded); scan timing is player skill (never fed back to any seed).

### 22.18 Determinism policy for Daily

Ch. 20 defines the Daily schema keyed on a `dailySeed`. The invariant this chapter enforces: **physics must never perturb the gameplay-critical RNG stream.** Two strictly separated streams:

| Stream | Generator | Consumers | Rule |
|---|---|---|---|
| **SEED stream** (deterministic) | seeded LCG `next = (seed·16807) % 2147483647` (already used for stocking in `store.js`) | Store layout/stock (`rng`), Daily shopping list (must migrate `genList` off `Math.random`), produce-scale target (22.16), self-checkout item order (22.17) | Physics code MUST NOT draw from or advance this stream |
| **COSMETIC stream** (non-deterministic) | native `Math.random()` | Cart `tipSign`, debris angular `w`, spill push/vy jitter, knock scatter, bark/toast selection, needle spring, fog puffs, chain-tip delay (22.14) | May be freely used; results never written back to score/seed |

**Migration note (shipped bug for Daily):** `game.js genList()` currently uses `Math.random()`. For deterministic Daily it must take the seeded stream so every player gets the same 6-item list from `dailySeed`. Casual/endless mode keeps `Math.random()`. Physics stays entirely on the cosmetic stream, so two players who wreck different aisles still face the **same list and the same billed damage per SKU** — only their *visual* chaos differs. Replays (Ch. 12) therefore need to record only player input + seed, never physics state: given identical input and `dailySeed`, the SEED stream reproduces list/stock/targets exactly, and cosmetic divergence is irrelevant to score.

**Verification hook (Ch. 23).** A test asserts: run `update` for 600 frames with a scripted crash sequence, twice, seeded identically → `damage.total`, `damage.count`, and the generated list are **bit-identical**, while `debris[i].mesh.rotation` may differ. That test is the contract that keeps physics off the scoring seed.

### 22.19 Tuning, debug hooks, and Definition of Done

**Debug hooks** (`window.__*`, the documented practice): `__physics` (the system), `__physics.debrisMeshes.length` (live count, must stay ≤100), `__physics.damage` (billing), `__playerVel`, plus a proposed `__tipAll()` to topple every gondola for a worst-case draw/perf capture (Ch. 21 framebuffer-grid verification).

**Definition of Done for any physics change** (Ch. 26): (1) no spill exceeds `SPAWNS_PER_FRAME` spawns in one frame; (2) `debris.length` never exceeds `DEBRIS_CAP`; (3) a full sprint-tip completes in 0.85 s with no frame over 20 ms on the iGPU floor; (4) the SEED/COSMETIC separation test (22.18) passes; (5) player can always escape a collider they're wedged in (stuck-escape clause intact); (6) every new billed action routes through the 40% `spawnDebris` accumulator so the checkout tab stays honest.

**File map for implementers.** Core: `src/physics.js`. Movement/impact caller: `src/main.js` (`move`, `hitC`, `onPlayerBlocked`). NPC stagger: `src/characters.js`. Collider/cart/gondola authoring: `src/store.js` (`cartsAndBaskets`, `gondola`, `freezerWall`, `produceExtras`, and the island loops that push `physGondolas`). Stock hide/spill: `src/stock.js` (`hideInRegion`). Grab-a-fallen-item: `src/game.js`. Audio events: `src/sfx.js` (`thud`, `crash`, `clatter`, `tick`, `error`).



# Chapter 23 — Testing, Verification & CI

Grocery Dash 3D has no unit-test framework baked into the shipped bundle, no backend to assert against, and a render loop whose output is a WebGL framebuffer rather than a DOM tree. What it *does* have — and what this chapter formalizes into a repeatable, CI-gated regime — is a mature *debug-hook + framebuffer-grid* verification practice already used during development: the `window.__*` surface wired up at the tail of `src/main.js`, and the habit of dumping the rendered frame and inspecting it. This chapter turns that practice into a contract: a complete hook inventory, a fully-specified automated smoke suite, a Playwright headless-Chrome CI wiring with concrete thresholds and a flake policy, and a 60-item manual QA checklist per release.

The design constraint from Ch. 19 (Architecture) and Ch. 21 (Rendering/Performance) holds here: **the test harness is additive and browser-only**. No test requires a server beyond `vite preview`. Every hook is either already present or a `[BUILD]` addition that is inert in production (gated behind `?test=1`). Nothing in this chapter contradicts shipped behavior — it exercises it.

### 23.1 Testing philosophy and the harness contract

Four properties make this game testable without a rewrite:

| Property | Mechanism | Where |
|---|---|---|
| **Deterministic world build** | Seeded LCG `seed=(seed*16807)%2147483647`, `seed=1337` | `store.js:1227-1228` |
| **Global inspection surface** | `Object.assign(window, {__scene,…})` | `main.js:226-232` |
| **Pure-ish update functions** | `move(dt)`, `physics.update(dt,pos,vel)`, `game.update(dt,locked)`, `shoppers.update(dt)` all callable standalone | `main.js`, `physics.js`, `game.js`, `characters.js` |
| **Readable framebuffer** | `renderer.domElement` is a real `<canvas>`; `readPixels`/`toDataURL` work | `main.js:33` |

The **one gap** is non-determinism in two places that use `Math.random()` rather than the store's LCG: the shopping-list generator `genList()` (`game.js:35-43`) and NPC spawn/personality (`characters.js:241,306,317,…`). The harness closes this gap with a pre-boot `__seedRandom(seed)` shim (§23.2) installed via Playwright's `addInitScript`, so *the entire boot* — list, cast, spawn jitter — becomes reproducible. Tests that need randomness pinned declare it; tests of the deterministic build (world geometry, colliders, stock counts) need no shim.

**Harness contract.** A test is a function `(page) => Promise<Result>` that (1) waits for `window.__ready === true` and `window.__err === undefined`, (2) manipulates state only through documented `__*` hooks, (3) advances simulation only through `__step(dt)` or real `requestAnimationFrame` ticks, never `setTimeout` guesses, and (4) asserts on values read back through hooks or on sampled framebuffer color. No test reaches into three.js internals directly except through the exposed `__scene`/`__renderer`.

### 23.2 The `window.__*` hook inventory

Existing hooks are shipped today. `[BUILD]` hooks are new, inert unless `location.search.includes('test=1')` (or `window.__enableTest === true`), and add zero cost to a production frame (they are closures assigned once at boot, never called by the loop).

**Existing hooks (shipped — `main.js:226-232`, plus scattered):**

| Hook | Type | Meaning |
|---|---|---|
| `__ready` | `boolean` | Set `true` once world+shoppers+game+physics constructed |
| `__err` | `string \| undefined` | Error stack; set by top-level `catch` (`main.js:234`) or env load fail (`:58`) |
| `__tier` | `'high'\|'lite-locked'\|'panic'` | Resolved quality tier, set at frame 80 (`main.js:199`) |
| `__scene` `__camera` `__renderer` `__composer` `__controls` | three.js objects | Full scene graph, active camera, WebGLRenderer, EffectComposer, PointerLockControls |
| `__world` | object | `{colliders,bounds,stock,corridors,staffSpots,physicsMeta,checkout,checkoutRing,spawn,update,getNpcs,physics}` |
| `__STORE` | object | Store dims `{w:46,d:30,h:4.2}` |
| `__game` | object | `{update,tryGrab,list(get),state(get),reset,complete}` |
| `__stock` | object | `{raycastTargets,resolve,hideInRegion,availableSpecs,counts}` where `counts={skus,instances,drawCalls}` |
| `__npcs` | `array` | Live NPC records (position, mixer, shove state) |
| `__npcUpdate` | `fn(dt)` | Advance NPC sim standalone |
| `__physics` | object | `{update,onPlayerBlocked,toast,shake(get),damage(get),debrisMeshes,removeDebris}` |
| `__move` | `fn(dt)` | Advance player movement standalone (reads `__keys`, mutates `__camera.position`) |
| `__keys` | object | Keycode→bool map the movement code reads (`{KeyW:true,…}`) |
| `__playerVel` | `THREE.Vector3` | Current player velocity, read by physics for shove/knock |
| `__setPlaying(v)` | `fn(bool)` | Force the `playing` flag (bypass pointer-lock) |
| `__isPlaying()` `__isFallback()` | `fn→bool` | Read play state / drag-look-fallback state |
| `__cast` | `string[]` | Names of avatars that passed retarget sanity (`characters.js:292`) |
| `__retargetLog` | `string[]` | Per-avatar retarget outcome (`'Name: ok'` / `': bake failed sanity'` / `': load error …'`) |

**`[BUILD]` additions (signatures):**

| Hook | Signature | Behavior |
|---|---|---|
| `__seedRandom` | `(seed:int) => void` | Replace `Math.random` with LCG `s=(s*16807)%2147483647; return s/2147483647`. **Must run before `main.js`** (Playwright `addInitScript`). Idempotent. |
| `__step` | `(dt=1/60, frames=1) => void` | Run the exact loop body `frames` times with fixed `dt`: `autoQuality→move→physics.update→world.update→shoppers.update→game.update→composer.render`. Bypasses `requestAnimationFrame` for deterministic stepping. Requires extracting the loop body of `main.js:205-215` into a named `frame(dt)` (pure refactor, no behavior change). |
| `__teleport` | `(x,z,y=1.65) => void` | `__camera.position.set(x,y,z); __playerVel.set(0,0,0)` |
| `__look` | `(yaw,pitch=0) => void` | `__camera.rotation.set(pitch,yaw,0)` (order already `YXZ`) |
| `__press` / `__release` | `(code) => void` | `__keys[code]=true/false` (thin sugar over `__keys`) |
| `__perf` | `{ sample(n):{avgMs,p95Ms,minMs,maxMs,fps}, draws():int, tris():int, reset():void }` | Rolling 240-frame ring buffer of `performance.now()` deltas; `draws()`=`renderer.info.render.calls`, `tris()`=`renderer.info.render.triangles` |
| `__sampleColor` | `(nx,ny) => [r,g,b,a]` | `readPixels` a 1×1 block at NDC `(nx,ny)`→pixel `((nx+1)/2*W, (1-(ny+1)/2)*H)` from the **default framebuffer** after `composer.render()`; returns 0–255 sRGB |
| `__snapshot` | `() => string` | `renderer.domElement.toDataURL('image/png')` (full frame, for artifact upload on failure) |
| `__physics.debugGondolas` | `() => Array<{label,axis,cx,cz,len,tipped,tipT,collider}>` | Read-only snapshot of internal `gondolas[]` |
| `__physics.debugCarts` | `() => Array<{x,z,vx,vz,yaw,tipped,tipT}>` | Read-only snapshot of internal `carts[]` |
| `__settings` | `{ load():obj, save(obj):void, reset():void, DEFAULTS }` | localStorage `gd3d.settings.v1` (§23.11) |
| `__save` | `{ load():obj, record(count,seconds,dmg):void, reset():void }` | localStorage `gd3d.save.v1` (§23.11) |
| `__seedList` | `(seed:int)=>void` | Seed the list generator's random stream independently of the world seed (deterministic `genList()`) |

### 23.3 The automated smoke suite — format

Every spec below carries: **ID**, **steps** (eval pseudocode run in-page via Playwright `page.evaluate`), **pass criteria**, and **Lane/Tier**. Lanes classify what runs when:

| Lane | Name | Runs | Runner | Retries |
|---|---|---|---|---|
| **L0** | Boot smoke | every push | SwiftShader (software GL) | 0 |
| **L1** | Functional/loop | every push | SwiftShader | 0 |
| **L2** | Physics battery | every push | SwiftShader | 0 |
| **L3** | Perf gates | every push (advisory) + nightly (gating) | self-hosted Intel iGPU | median-of-5 |
| **L4** | Visual framebuffer | every push | SwiftShader (deterministic pixels) | 2 |
| **L5** | Full / long-run | nightly | self-hosted iGPU | 1 |

All logic lanes (L0–L2, L4) run under `__seedRandom(1337)` unless a spec overrides the seed. Every spec begins from a fresh page load with `?test=1`.

### 23.4 Boot & load tests (Lane L0)

| ID | Steps (pseudocode) | Pass criteria |
|---|---|---|
| `BOOT-01` | `await waitFor(()=>window.__ready===true, 20000)` | `__ready===true` within 20 s; `__err===undefined` |
| `BOOT-02` | `read window.__err` | `undefined` (no top-level or env-load throw) |
| `BOOT-03` | `getComputedStyle(#boot)` after ready+1s | `display:'none'` OR `opacity==='0'` (boot overlay dismissed, `main.js:48-49`) |
| `BOOT-04` | `read __stock.counts` | `.skus===52`; `.instances` in `[3900,4500]` (~4,200 facings); `.drawCalls>=40` |
| `BOOT-05` | `read renderer.info.render` after 1 rendered frame | `.calls` in `[600,1050]`; `.triangles` in `[0.9e6,1.6e6]` (worst view ≤988/1.38M — see Ch. 21) |
| `BOOT-06` | `read __cast.length` and `__retargetLog` | `__cast.length>=1` (at least one avatar animates sanely); no entry contains `'FATAL'` or `'CAST EMPTY'` |
| `BOOT-07` | `read __npcs.length` | `>=1` and `<=13` (6 walkers + 2 browsers + up to 5 staff; async, so assert eventual `==13` in L5) |
| `BOOT-08` | `read __tier` after `__step(1/60,90)` | one of `'high'\|'lite-locked'\|'panic'` (autoQuality resolved by frame 80, `main.js:194-199`) |
| `BOOT-09` | Console listener over boot | zero `console.error`; zero uncaught `pageerror` |
| `BOOT-10` | `read __world.spawn` | `≈(0.6,1.65,13.2)` and `__camera.position≈spawn` post-boot |

`BOOT-06`/`BOOT-07` tolerate a reduced cast: if SwiftShader mangles a retarget the avatar is *skipped*, not fatal — the sane-count floor is 1, and the full-cast assertion (`==13`, all six avatars) lives in nightly L5 on real GL.

### 23.5 Loop / list-complete run (Lane L1)

`RUN-01` is the golden path: deterministic seed, complete the list, checkout, verify banner math. Because the real player walks, the test drives it programmatically — teleport to each item, aim, grab — rather than simulating WASD pathfinding.

| ID | Steps | Pass criteria |
|---|---|---|
| `LIST-01` | `__seedRandom(1337); __seedList(1337); reset()` | `__game.list.length===6`; every entry `{id,name,price>0,got:0,need:1}` |
| `LIST-02` | Compare `list` after two `reset()` with same `__seedList(1337)` | Identical `id` sequence (determinism holds) |
| `GRAB-fly` | `__setPlaying(true)`; teleport in front of a known facing; `__look` at it; `__step(1)`; assert `__game`'s hover; call `__game.tryGrab(); __step(1/60,30)` | `list` entry `.got` incremented; a flyer mesh exists during frames 1–24 then removed by frame ≥24 (fly duration 0.4 s = 24 frames @60, `game.js:109`) |
| `RUN-01` | `__setPlaying(true)`; for each of 6 list items: locate a visible handle via `__stock` for that `spec.id`, `__teleport` to `(h.x±reach, h.z)`, `__look` toward it, `__step(1)`, `__game.tryGrab()`; then `__teleport(-7.65,11.1)` (checkout), `__step(1/60,4)` | After 6 grabs `__game.state.listDone===true`, `__world.checkoutRing.visible===true`; after teleport-to-checkout `__game.state.done===true`; banner `#banner` `display:'block'` containing `'Checked out'` |
| `RUN-02` | After `RUN-01`, read banner text; recompute `total=Σ list.price` | Banner shows `6 items · $<total.toFixed(2)>`; `total` matches within `$0.005` |
| `RUN-03` | Before finishing list, `__teleport` to checkout, `__step(1)` | Prompt reads `Finish your list first — k/6` (`game.js:156`); `done` stays `false` |
| `RUN-04` | After `done`, `__press('KeyR'); dispatch keydown; __step(1)` | New list generated, `done===false`, `checkoutRing.visible===false`, `#banner` hidden (`game.js:181,51-56`) |
| `RUN-05` | Complete with zero damage | Banner has **no** `Store damages` line (`dmg.count===0` path, `game.js:172`) |
| `RUN-06` | Knock ≥1 item (see PHYS-knock) then complete | Banner includes `Store damages: N items · $X.XX`; `X == (Σ knocked spec.price)*0.4` within `$0.01` (`game.js:171-175`, `physics.js:83`) |
| `TIMER-01` | `__setPlaying(true); __step(1/60,180)` | `#timer` text matches `/^0:0[23]$/` (≈3 s elapsed; timer only advances while `playing && !done`, `game.js:121`) |
| `TIMER-02` | Reach `done`, then `__step(1/60,120)` | `#timer` frozen (time stops accumulating once `done`, `game.js:121`) |

**Grab-path battery** — three code paths through `tryGrab()` (`game.js:67-98`), each spec'd:

| ID | Path | Steps | Pass criteria |
|---|---|---|---|
| `GRABP-shelf` | Instanced shelf facing | Aim at a boxed/canned SKU on a gondola; `tryGrab()` | Instance hidden (matrix→`ZERO`, `stock.js:57-59`); a real `buildProduct` mesh spawned and flown; `SFX.grab` path taken (no throw) |
| `GRABP-photoscan` | Poly Haven produce | Teleport to produce corner (x≈-17.6, z≈10.7); aim at apple/lemon/etc.; `tryGrab()` | Same hide+fly; the flown mesh is the photoscan glTF (has children), not a canvas box — assert `fly.children.length>0` |
| `GRABP-debris` | Floor clutter reuse | First knock items (PHYS-knock) so `__physics.debrisMeshes.length>0`; teleport within 4.47 m (`d2<20`, `game.js:134`); aim down at a debris mesh; `tryGrab()` | `removeDebris` returns `true`; that mesh becomes the flyer (reused, `game.js:71-76`); `debrisMeshes.length` decremented; if debris `spec.id` is on the list, `.got` increments |
| `GRABP-reach` | Range cutoff | Aim at a facing but teleport `>2.7 m` away (`REACH`, `game.js:8`); `tryGrab()` | No hover, no grab, no list change |
| `GRABP-nostock` | Empty-handed | Aim at empty air; `tryGrab()` | No throw; `list` unchanged; `__game.state` unchanged |

### 23.6 Physics battery (Lane L2)

All physics tests call the exposed pure functions with synthetic inputs, then read state through `__physics.debug*`, `__physics.damage`, and `__physics.shake`. Constants asserted are the shipped ones: `PLAYER_R=0.34`, `CART_R=0.48`, `TIP_SPEED=4.0`, `KNOCK_SPEED=1.6`, `DEBRIS_CAP=100`, `DEBRIS_TTL=28`, `SPAWNS_PER_FRAME=9` (`physics.js:15-21`).

**Cart shove & collision:**

| ID | Steps | Pass criteria |
|---|---|---|
| `PHYS-cart-shove` | Cart c1 at `(-2.9,13.9)`. `__teleport(-3.5,13.9)`; `__playerVel.set(4.9,0,0)`; `__physics.update(1/60, cam, vel)` | Contact (pd=0.60<0.82). `debugCarts()[0].vx` ≈ `4.9*1.15=5.635` (±0.2); cart pushed to x≈-2.68 (separation `need=0.82-0.60=0.22`); `__physics.shake>0` (rel 4.9>2.4 → +0.15) |
| `PHYS-cart-roll` | After shove, `__step(1/60,30)` | Cart traveled `Δx>+0.3`; speed decays (friction `f=min(1,2.2·dt)`≈0.037/frame); `vx` monotonically decreasing |
| `PHYS-cart-tip` | Aim cart at a wall collider; drive `vx` so wall-normal impact `-vn>2.6` | `debugCarts()[i].tipped===true`; over `__step(1/60,20)` `tipT→1`, `rotation.z→±1.42`, `mesh.position.y→0.25` (`physics.js:194-196`); `shake` bumped +0.35 |
| `PHYS-cart-cart` | Two carts closing at rel>1.5 within `od<0.96` | Momentum exchanged at 0.7 coefficient both ways (`physics.js:220-221`); separation splits overlap in half |
| `PHYS-cart-bounds` | Shove cart past `bounds.maxX` | Clamped to `maxX-0.48`; `vx` reversed at 0.4 restitution (`physics.js:253-256`) |

**Shelf knock (walking crash, `1.6 ≤ speed < 4.0`):**

| ID | Steps | Pass criteria |
|---|---|---|
| `PHYS-knock-count` | Grocery island '1' collider (x=-18). `__teleport(-17.2,-3)`; `__physics.onPlayerBlocked(col1, 3.1, -1, 0)` | Knock branch (`speed≥1.6`, `<4.0`). Requested count `=1+floor(3.1)=4`; actual `n=min(4, itemsInBox)`; `__physics.damage.count` += `n`; `shake` += 0.3 (`physics.js:151-159`) |
| `PHYS-knock-bill` | After above, read `damage.total` | `== Σ(knocked spec.price)*0.4` within `$0.005` (`physics.js:83`) |
| `PHYS-knock-debris` | `__step(1/60,3)` to drain queue | `debrisMeshes.length` grew by `n` (≤9/frame drain, `physics.js:278`); each debris `userData.debris===true` and has `size`,`centerY` |
| `PHYS-knock-cooldown` | Call `onPlayerBlocked` twice within same frame | Second call no-ops (`crashCd>0` guard, `physics.js:144`) |
| `PHYS-knock-below` | `onPlayerBlocked(col1, 1.2, -1, 0)` | Below `KNOCK_SPEED`: no knock, no debris, `damage.count` unchanged |

**Gondola tip (sprint crash, `speed ≥ 4.0`):**

| ID | Steps | Pass criteria |
|---|---|---|
| `PHYS-tip-fire` | `__physics.onPlayerBlocked(col1, 4.9, -1, 0)` | `debugGondolas()` entry label `'1'` `.tipped===true`; `shake≥0.9` (`physics.js:137`); toast text set (`CLEANUP ON AISLE 1`) |
| `PHYS-tip-spill` | After fire, `__step(1/60,7)` | `damage.count` jumped by ≤56 (fling cap, `physics.js:110`); `debrisMeshes` growing at ≤9/frame |
| `PHYS-tip-angle` | `__step(1/60,60)` (≈1 s ≥ 0.85 s fall) | Gondola group world-rotation about tip axis reaches `π/2-0.06 = 1.5108 rad = 86.56°` (±0.03) at `tipT===1` (`physics.js:271`) |
| `PHYS-tip-collider` | Read `col1` before/after | Footprint mutated: pre `maxX-minX≈1.04`; post ≈`0.42+1.9=2.32` (H=1.9, `physics.js:129-135`) — walkable space changed |
| `PHYS-tip-idempotent` | Fire tip twice on same gondola | Second `onPlayerBlocked` no-ops (`g.tipped` early-return, `physics.js:102`); no double spill |
| `PHYS-tip-sign-x` | Tip an axis-`'x'` merch island (label '6', `dz` drives sign) | `tipSign` from `dz>=0?1:-1`; correct pivot placement (`physics.js:123-124`) |

**Debris ballistics & lifecycle:**

| ID | Steps | Pass criteria |
|---|---|---|
| `PHYS-debris-gravity` | Spawn 1 debris with `vy=+1.0`; `__step` and log `y` | Parabolic: `v.y -= 9.8·dt` each frame (`physics.js:295`); apex then descent |
| `PHYS-debris-bounce` | Let debris hit `y≤0` with `|vy|>1.2` | `SFX.tick` path; `v.y` reversed at 0.28 restitution, horizontal ×0.55, spin ×0.5 (`physics.js:304-307`) |
| `PHYS-debris-rest` | `__step` until `|v.y|<0.55` | `resting===true`; rotation.x/z snapped to nearest `π/2`; seated so bbox `min.y≈0.005` (`physics.js:308-319`) |
| `PHYS-debris-ttl` | Rest a debris, `__step(1/60, 28*60+60)` | After `age>28 s` fade over 0.8 s (scale→0.001) then removed; `debrisMeshes` shrinks; `syncDebrisList` ran (`physics.js:284-291`) |
| `PHYS-debris-cap` | Force-spawn 130 debris | `debris.length` never exceeds `DEBRIS_CAP=100`; oldest *resting* (else oldest) dropped (`physics.js:73-79`) |

**NPC shove (physics side, `physics.js:326-341`):**

| ID | Steps | Pass criteria |
|---|---|---|
| `PHYS-npc-shove` | Place player 0.5 m from an NPC (`d2<0.66`); `__playerVel` toward it with `rel>0.6`; `__physics.update` | NPC gains `shove={vx,vz,t:0.55}` with `|v|=min(rel,4)*1.1`; `shoveCd=1.3`; `shake+=0.22`; `SFX.thud`; toast ∈ 5 `BUMP_LINES` |
| `PHYS-npc-cooldown` | Shove same NPC twice within 1.3 s | Second shove suppressed (`shoveCd>0`, `physics.js:327`) |
| `PHYS-npc-recover` | After shove, `__npcUpdate` for 0.6 s | NPC staggers along shove vector, decays at 4.5/s, `shove` cleared when `t≤0` (`characters.js:366-374`) |

### 23.7 NPC battery (Lane L2 + L5)

| ID | Steps | Pass criteria | Lane |
|---|---|---|---|
| `NPC-cast` | Read `__cast`, `__retargetLog` | On real GL: all 6 `PEOPLE` present, every log line `': ok'`; on SwiftShader: `≥1` sane | L5 / L2 |
| `NPC-count` | Read `__npcs.length` after full async settle | `==13` (8 shoppers + 5 staff) | L5 |
| `NPC-roles` | Classify `__npcs`: `browsing`, `cart`, `home` fields | Exactly 2 browsers (`pause===Infinity`, basket beside), exactly 2 walkers with `.cart`, exactly 5 staff (`home` set), 4 free walkers | L5 |
| `NPC-sane-pose` | For each NPC, measure skeleton bone-span after `__npcUpdate(0.4)` | `1.15<span.h<2.3`, `-0.45<span.min<0.5`, head `1.25<y<2.1` (mirror of `retargetIsSane`, `characters.js:235`) | L5 |
| `NPC-walk` | Pick a free walker; `__npcUpdate` for 2 s | `n.x`/`n.z` change; `walk.weight→1`, `idle.weight→0` while moving; yaw turns toward heading (clamp `±3·dt`) | L2 |
| `NPC-browser-still` | Pick a browser; `__npcUpdate` 2 s | Position static (`browsing` `continue`, `characters.js:383`); `pause===Infinity` |
| `NPC-staff-return` | Displace a staff NPC, `__npcUpdate` 2 s | Drifts back toward `home` at `2·dt` lerp; settles within 0.05 m (`characters.js:375-381`) |
| `NPC-cart-trail` | Walker with cart, `__npcUpdate` 1 s | `n.cart.position ≈ (n.x+sin(yaw)·0.78, 0, n.z+cos(yaw)·0.78)`; handle faces shopper (`characters.js:414-416`) |
| `NPC-no-explode` | `__npcUpdate` 30 s continuous | No NPC leaves `bounds`; no `NaN` in any position; span stays sane throughout | L5 |

### 23.8 Perf gates per benchmark view (Lane L3)

Ten fixed camera poses. Each is set via `__teleport`+`__look`, warmed 30 frames (let `autoQuality` settle + shadow-map freeze at frame 3), then measured over 120 frames via `__perf.sample(120)`. Draw/triangle gates come from `renderer.info`; timing gates apply **only on the self-hosted Intel iGPU runner** (SwiftShader timings are meaningless — on software GL, L3 asserts only that a tier resolved and no `NaN`).

| ID | View | Camera pos → lookAt | Draw gate | Tri gate | iGPU frame-time gate |
|---|---|---|---|---|---|
| `PERF-01` | SPAWN / front strip | `(0.6,1.65,13.2)`→`(0,1.5,0)` | ≤620 | ≤0.95 M | p95 < 16.7 ms |
| `PERF-02` | GROCERY_AISLE | `(-16,1.65,10)`→`(-16,1.5,-3)` | ≤760 | ≤1.15 M | p95 < 18 ms |
| `PERF-03` | WORST_CASE (cross-store) | `(2,1.65,11)`→`(-20,1.5,-3)` | ≤990 | ≤1.40 M | p95 < 20 ms |
| `PERF-04` | FREEZER_WALL | `(-20,1.65,0)`→`(-23,1.5,0)` | ≤540 | ≤0.85 M | p95 < 16.7 ms |
| `PERF-05` | PRODUCE_CORNER (photoscan) | `(-17.6,1.65,7)`→`(-17.6,1.4,11)` | ≤680 | ≤1.30 M | p95 < 18 ms |
| `PERF-06` | TV_WALL (emitter bloom) | `(10,1.65,-6)`→`(10,1.6,-14.6)` | ≤620 | ≤1.0 M | p95 < 18 ms |
| `PERF-07` | CHECKOUT | `(-7.65,1.65,8)`→`(-7.65,1.4,11.1)` | ≤560 | ≤0.9 M | p95 < 16.7 ms |
| `PERF-08` | APPAREL_CARPET | `(0,1.65,10)`→`(4,1.4,6)` | ≤520 | ≤0.85 M | p95 < 16.7 ms |
| `PERF-09` | NIGHT_LOT (through glass) | `(0,1.65,14)`→`(0,1.6,20)` | ≤600 | ≤0.9 M | p95 < 18 ms |
| `PERF-10` | POST_TIP (debris storm) | Fire `PHYS-tip-fire` on island '1', settle 3 s, view `(-14,1.65,-3)`→`(-18,1.4,-3)` | ≤1050 | ≤1.55 M | p95 < 22 ms (transient budget) |

**Tier-resolution gate (`PERF-tier`, software-safe, Lane L3-advisory):** after boot on the iGPU runner, `__tier` must equal `'high'` (the reference iGPU is expected to clear `avg<0.02 s` over frames 21–80, `main.js:196`). A regression to `'lite-locked'` or `'panic'` on the pinned runner fails the gate — it signals a render-cost regression even if raw ms still passes. `__perf.draws()` for `PERF-03` is the canonical "worst view" guard: a >5% climb over the 990 baseline fails.

### 23.9 Visual framebuffer battery (Lane L4)

The documented framebuffer-grid practice, formalized: for each view, sample fixed NDC points with `__sampleColor(nx,ny)` and assert each against an expected sRGB signature within a Euclidean RGB distance `Δ`. SwiftShader is bit-deterministic across runs, so tolerances are tight for UI anchors and generous for tone-mapped scene surfaces (ACES + bloom shift values). All anchors are grounded in shipped material/CSS colors.

| ID | View / point (NDC) | Expected sRGB (hex) | Δ (max ‖RGB‖) | Anchor source |
|---|---|---|---|---|
| `VIS-boot-bar` | boot screen, `(-0.3,-0.02)` mid-bar | `#35c46a` (53,196,106) | 30 | `index.html:18` bar fill |
| `VIS-hud-list-bg` | `(-0.86,0.82)` list panel | `≈(24,29,35)` (rgba 10/14/18 @.78 over dark scene) | 22 | `#list` bg `index.html:26` |
| `VIS-crosshair` | `(0,0)` dead center, playing | `≈(230,232,236)` white dot | 40 | `#crosshair` `index.html:21` |
| `VIS-brand-band` | AISLE view, band height `(-0.4,0.34)` | `#1d5c38` (29,92,56) family | 45 | wall band `store.js:1252` |
| `VIS-floor` | any view, `(0,-0.85)` waxed floor | dark warm gray `(28,26,24)±` | 50 | floor mat `store.js:1237` |
| `VIS-checkout-ring` | CHECKOUT view, listDone, `(0,-0.55)` | `#35c46a` emissive glow | 45 | ring `store.js:1388` |
| `VIS-glow-hover` | aim at facing, `(0,0.02)` | additive cyan lift toward `#9fdcff` | 55 | glow box `game.js:30` |
| `VIS-tv-bloom` | TV_WALL `(0.1,0.15)` | bright bloomed panel, luma>200 | luma≥180 | emitter bloom, Ch. 21 |
| `VIS-poster-red` | SPAWN, storefront poster `(0.42,0.1)` | `#c9241a` (201,36,26) family | 45 | poster `store.js:1286` |
| `VIS-night-sky` | NIGHT_LOT `(0,0.7)` through glass | dark blue `(14,20,32)±` | 40 | env/skyline, Ch. 15 |
| `VIS-cart-red` | corral, cart grip `(−0.2,-0.3)` | `#b3261a` family (179,38,26) | 50 | grip `store.js:380` |
| `VIS-fog-far` | WORST_CASE, deep `(−0.6,0.0)` | fog `#11151a` (17,21,26) tint | 40 | `scene.fog` `store.js:1226` |

**Structural signature (`VIS-nonblank`):** for every view, assert the frame is not uniform — sample a 4×4 NDC grid, require ≥6 distinct color buckets (guards a black/white/NaN frame that individual anchors might coincidentally pass). **Regression artifact:** on any L4 failure the runner calls `__snapshot()` and uploads the PNG plus a per-point expected-vs-actual diff table.

### 23.10 Save/settings round-trip (Lane L1)

`[BUILD]` persistence layer, localStorage-only (respects no-backend constraint). Two versioned keys:

```
gd3d.settings.v1 = { v:1, muted:false, sensitivity:0.0042, invertY:false,
                     dprCap:1.25, tierPref:'auto', reduceMotion:false }
gd3d.save.v1     = { v:1, bestByCount:{ "6": <seconds> }, runs:0, damageWaived:false }
```

`DEFAULTS` mirror the shipped constants: `sensitivity 0.0042` (`main.js:121`), `dprCap 1.25` (`main.js:27`), `muted false` (`sfx.js:3`).

| ID | Steps | Pass criteria |
|---|---|---|
| `SET-01` | `__settings.save({...DEFAULTS,muted:true,sensitivity:0.006}); reload; __settings.load()` | Returns `muted:true, sensitivity:0.006`; `SFX` starts muted; drag-look uses 0.006/px |
| `SET-02` | `__settings.load()` on virgin storage | Deep-equals `DEFAULTS` (no crash on absent key) |
| `SET-03` | Write `gd3d.settings.v1='{bad json'`; `__settings.load()` | Returns `DEFAULTS`, does not throw, logs one warning (corrupt-guard) |
| `SET-04` | Write `{v:0,...}` (old schema); `__settings.load()` | Migrates to `v:1`, fills missing keys from `DEFAULTS` |
| `SET-05` | `M` keypress in-game; reload | `muted` persisted (mute survives reload) |
| `SAVE-01` | Complete `RUN-01` (time T); `__save.load()` | `bestByCount["6"]===T`; `runs===1` |
| `SAVE-02` | Complete a slower run | `bestByCount["6"]` unchanged (keeps best); `runs===2` |
| `SAVE-03` | Complete a faster run | `bestByCount["6"]` updated to new min |
| `SAVE-04` | `__save.reset(); __save.load()` | `bestByCount==={}`, `runs===0` |
| `SAVE-05` | `record(count,sec,dmg)` with `dmg.count>0` | Damage total stored alongside best; banner personal-best flag consistent |

### 23.11 Input abstraction unit tests (Lane L1)

Input today is a `keys{}` map fed by `keydown`/`keyup`, consumed by `move(dt)` (`main.js:127-164`). Tests drive `__keys` (or `__press`/`__release`) and one `__move(dt)` / `__step`, then read `__camera.position` and `__playerVel`. A thin `[BUILD]` `readIntent(keys)` helper (extracted from `move`) makes the direction math unit-testable in isolation.

| ID | Steps | Pass criteria |
|---|---|---|
| `IN-fwd` | `__setPlaying(true); __look(0)` (face −Z); `__press('KeyW'); __move(0.1)` | Player moves −Z; `‖__playerVel‖≈3.1` (walk) |
| `IN-strafe` | `__press('KeyD'); __move(0.1)` | Moves along camera-right; velocity ⟂ forward |
| `IN-diag-norm` | `KeyW+KeyD; __move(0.1)` | Speed still `≈3.1`, not `3.1·√2` (normalized by `len=hypot`, `main.js:145-146`) |
| `IN-run` | `KeyW+ShiftLeft; __move(0.1)` | `‖vel‖≈4.9` (`SPEED_RUN`) |
| `IN-arrows` | `ArrowUp` alone | Same as `KeyW` (alias, `main.js:137`) |
| `IN-back` | `KeyW+KeyS` | Cancel to ~0 forward (`f = 1-1 = 0`) |
| `IN-collide` | Face a gondola, `KeyW` into it, `speed<1.6` | Axis blocked (position clamped), no crash fired |
| `IN-bounds` | Drive toward `bounds.minX` | Position clamped at `minX`; never exits |
| `IN-look-clamp` | Fallback mode; drag pitch beyond limit | `camera.rotation.x` clamped to `±1.45` (`main.js:122`); `.z` forced 0 |
| `IN-look-sens` | Drag 100 px horizontally in fallback | `Δyaw == 100·0.0042 = 0.42 rad` (±0.001) |
| `IN-E-grab` | Dispatch `keydown KeyE` while hovering | `tryGrab` invoked (list `.got` changes) (`game.js:180`) |
| `IN-R-guard` | `keydown KeyR` while `!done` | No reset (guarded, `game.js:181`) |
| `IN-M-mute` | `keydown KeyM` | `SFX.toggleMute` flips; returns new muted state |
| `IN-not-playing` | `!playing`, `KeyW; __move(0.1)` | No movement (`moving` requires `playing`, `main.js:139`) |
| `IN-fallback-enable` | Simulate `pointerlockerror` | `__isFallback()===true`, `__isPlaying()===true`, crosshair shown (`main.js:96-105`) |

### 23.12 CI wiring — Playwright headless Chrome

**Stack:** `@playwright/test` driving headless Chromium. Server: `vite preview --port 4173 --strictPort` (production build, matches shipped bundle) started by Playwright `webServer`. Base URL `http://localhost:4173/?test=1`.

**WebGL in CI.** Chromium launch args by lane:

```
L0/L1/L2/L4 (software, deterministic):
  --use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --disable-gpu-sandbox
  --headless=new --window-size=1280,800
L3/L5 (self-hosted Intel iGPU runner):
  --use-gl=angle --use-angle=gl --ignore-gpu-blocklist
  --headless=new --window-size=1280,800
```

`--use-angle=swiftshader` gives bit-identical framebuffers across machines (essential for L4) and a valid WebGL2 context (retarget/instancing all run), at the cost of speed — hence perf lives only on real GL.

**Init injection.** `page.addInitScript` installs `__seedRandom(1337)` before any bundle code and stubs `AudioContext` timing to a no-op clock (WebAudio is fine headless but tests never assert audio output; they assert *call paths* don't throw). `localStorage.clear()` runs in `beforeEach` for save/settings isolation.

**Global thresholds:**

| Metric | Threshold | Lane |
|---|---|---|
| Boot-to-`__ready` | < 20 s (software), < 8 s (iGPU) | L0 |
| `__err` present | hard fail | all |
| Uncaught `pageerror` / `console.error` | hard fail | all |
| `PERF-03` draw calls | ≤ 990 (+5% grace = 1040) | L3 |
| Worst-view p95 frame time (iGPU) | < 20 ms | L3 |
| L4 anchor Δ | per-point (table §23.9) | L4 |
| Test wall-clock (whole L0–L2 suite) | < 6 min | CI budget |

**Flake policy.** Determinism is the default expectation, so logic lanes get **zero retries** — a flake there is a real bug (usually an un-seeded `Math.random` or a `setTimeout` in a test). Rules:

1. **L0–L2, L5-logic:** retries `0`. Any nondeterminism is quarantined, not retried.
2. **L4 visual:** retries `2` (SwiftShader is deterministic, but headless compositor warm-up can drop the first frame). A test that passes only on retry ≥1 is auto-tagged `@warmup-suspect` and reviewed weekly.
3. **L3 perf:** never a single sample — `__perf.sample(120)` is taken 5 times (median-of-5); the gate compares the **median p95**. Runs on a *pinned* self-hosted runner (fixed CPU/GPU/driver) so numbers are comparable; a cloud runner never gates perf.
4. **Quarantine lane:** a test failing intermittently is moved to `@flaky` (still runs, non-gating) with a mandatory tracking issue and a 14-day SLA to fix or delete. Nothing sits in quarantine silently.
5. **No `waitForTimeout`.** Tests wait on predicates (`__ready`, `__game.state.done`, `debrisMeshes.length`) or advance with `__step`. A grep gate fails CI if `waitForTimeout(` appears in the spec directory.
6. **Seed pinning is enforced:** a lint check fails any test file that calls `Math.random` or reads `Date.now()` outside an allowed helper.

**Pipeline (per push):** `build → L0 → (L1 ‖ L2 ‖ L4) → L3-advisory`. Nightly adds `L3-gating ‖ L5` on the self-hosted runner. A red L0 short-circuits the rest (nothing else can pass if boot is broken).

### 23.13 Manual QA checklist per release (60 items)

Run on Chrome + Firefox + Safari, one integrated-GPU laptop and one phone (mobile drag-look). Check each; a release ships only at 100% pass or with explicitly waived, tracked exceptions.

**Boot & environment (1–8):** 1. Boot bar animates 0→100%, "Ready" then fades. 2. No error overlay (`#0011`, red monospace). 3. First rendered frame is not black. 4. Store hum audible after first click (unmuted). 5. Shadows present under shelves/props. 6. On a slow machine, tier drops to lite/panic without stutter storms. 7. Window resize re-fits (no stretched HUD, no clipped canvas). 8. Reload mid-session recovers cleanly.

**Controls & camera (9–18):** 9. Click locks pointer; Esc releases. 10. In a sandboxed embed, drag-to-look fallback engages automatically. 11. WASD + arrows both move. 12. Shift sprints (visibly faster, stronger head-bob). 13. Diagonal movement isn't faster than cardinal. 14. Look pitch clamps (can't flip upside-down). 15. Head-bob reads natural, not nauseating. 16. Can't walk through gondolas, walls, freezer, checkout counters. 17. Can't leave the building except the entrance gap. 18. `M` mutes/unmutes; state sticks across a reroll.

**Shopping loop (19–30):** 19. List shows 6 items with names + prices. 20. Aiming a facing shows glow + prompt with name/price/E. 21. `E` flies the item to basket, ticks the list. 22. Grabbed shelf facing disappears from the shelf. 23. `✓` + strikethrough on completed rows; footer `n/6`. 24. Completing all 6 fires "List complete", checkout ring appears + pulses. 25. Standing on checkout before finishing shows "Finish your list first". 26. On the ring with a full list → checkout banner. 27. Banner total equals the sum of the six prices. 28. Timer runs during play, freezes at checkout. 29. `R` rerolls a fresh 6-item list, hides banner, resets timer. 30. Photoscan produce (apple/lemon/avocado/banana/onion/sweet-potato/croissant/tins) is grabbable and lists correctly.

**Physics & mayhem (31–44):** 31. Walking into a cart shoves it with momentum. 32. Carts bounce off fixtures and each other. 33. Ramming a cart hard tips it over (lies on its side). 34. Walking into a shelf at speed knocks a few items to the floor. 35. Sprinting into a gondola tips the *whole aisle* (~87°). 36. A tipped aisle spills a burst of stock (not every item at once — amortized, no freeze). 37. Fallen aisle changes where you can walk (new footprint). 38. Floor debris can be picked up for your list. 39. Debris eventually fades away (cleanup) rather than piling forever. 40. Debris never exceeds ~100 pieces (no unbounded growth / memory climb). 41. Damages are itemized in the checkout banner at ~40% of price. 42. Camera shakes on crashes, settles smoothly. 43. Bumping an NPC staggers them + a bark toast ("Hey, watch it!"). 44. No debris/cart ever falls through the floor or floats.

**NPCs & world (45–52):** 45. Shoppers walk the aisles with plausible gait (no pretzel/T-pose). 46. Two shoppers push carts that trail behind them. 47. Browsers stand at shelves with a basket set down. 48. Staff hold their posts (registers, pharmacy, electronics, grocery). 49. Bumped staff drift back to post. 50. Freezer doors slide open as you approach, close as you leave. 51. Storefront glass shows the night lot/skyline through it. 52. Aisle signs, posters, price tags read as real signage.

**Audio & HUD (53–56):** 53. Grab, tick, list-done, checkout, thud, crash, clatter each fire on the right event. 54. No audio before the first user gesture (autoplay-policy safe). 55. HUD legible over bright and dark backdrops. 56. Toast, banner, prompt never overlap illegibly.

**Persistence & regression (57–60):** 57. Mute preference survives reload. 58. Best time recorded and shown; beaten only by a faster run. 59. Clearing site data resets cleanly to defaults (no crash). 60. No `console.error` across a full 5-minute play session (open DevTools, play, verify clean).

---

**Cross-references.** Perf budgets and tier logic: **Ch. 21** (Rendering/Performance). Physics constants under test: **Ch. 22** (Physics Spec). Data schemas for `gd3d.settings.v1`/`gd3d.save.v1`: **Ch. 20** (Data Schemas). The `__*` module boundaries: **Ch. 19** (Architecture). Release gating that consumes these lanes: **Ch. 24** (Release/Ops/Telemetry). Definition-of-Done that requires green L0–L4 + a passed manual checklist: **Ch. 26** (Risks/QA/DoD). The work to build the `[BUILD]` hooks and the CI harness is scheduled in **Ch. 25** (Work Breakdown/Waves).

**Source files inspected (absolute paths):** `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\src\main.js`, `game.js`, `physics.js`, `characters.js`, `stock.js`, `store.js`, `sfx.js`, and `C:\Users\joshu\LucidSpaces\Apps\groceryDash\game\index.html`.



# Chapter 24 — Release Engineering, Ops & Telemetry

This chapter turns the working build in `C:/Users/joshu/LucidSpaces/Apps/groceryDash/game` into a shippable, self-hosting, self-diagnosing product. Everything here honors the project's three load-bearing constraints: it runs **in the browser**, it needs **no backend by default** (any server is strictly optional and additive — see §24.16), and it must boot smoothly on the **Intel iGPU floor**. Nothing in this chapter contradicts shipped behavior; it extends it. Where the current repo already ships a mechanism (the `try/catch` boot guard, the `window.__*` debug hooks, the progressive quality tiers from Ch. 21, the seeded LCG, the CC0 asset pipeline), this chapter specifies the release scaffolding that wraps around it.

Ground-truth anchors used throughout: package version `0.1.0`, `three@0.160.1`, `vite@5.4.0`, entry `/src/main.js`, 12 ES modules under `src/`, ~32 MB of bundled assets under `public/assets/`, the boot chrome in `index.html` (colors `#0b0d10` background, `#16202b` boot-top, `#eef2f6` text, `#35c46a`/`#8be0a4` progress green, `#ff7777` error red), and the four render tiers `lite` / `lite-locked` / `high` / `panic`.

---

### 24.1 Release philosophy and the ship target

The ship target is **one static directory** (`dist/`) that any dumb file host can serve with no configuration, plus an optional, additive PWA layer that makes it installable and offline-capable. There is no login, no cookie, no tracking pixel, no third-party network call at runtime (the CDN URLs in `scripts/fetch-assets.mjs` and `scripts/fetch-models.mjs` are **build-time only** — the game fetches everything from same-origin `assets/…`). That property is a feature, not an accident: it means **zero consent banners**, **zero privacy surface**, and a build that is trivially mirrored, archived, and rolled back.

| Property | Value | Why it matters |
|---|---|---|
| Runtime network calls | Same-origin `assets/…` only | No CORS, no CDN outage risk, offline-cacheable |
| Backend required | None | Host anywhere static; §24.16 backend is opt-in |
| Cookies / storage | `localStorage` only, opt-in (§24.11–24.12) | No consent UI needed |
| Build output | `dist/` static tree, ~32 MB assets + ~200 KB code | One artifact, one rollback unit |
| Floor device | Intel iGPU, `DPR ≤ 1.25` | Boots to `lite` tier first (Ch. 21) |
| Distribution channels | GitHub Pages, Netlify, itch.io | Covered in §24.4–24.6 |

---

### 24.2 Vite build configuration (final)

The repo currently ships a minimal `vite.config.js` (`base: './'`, `outDir: 'dist'`, `target: 'es2022'`, `assetsInlineLimit: 0`). The production config below is the final form — every field is load-bearing and explained.

```js
// vite.config.js — FINAL
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const sha = (() => { try { return execSync('git rev-parse --short=7 HEAD').toString().trim(); } catch { return 'nogit00'; } })();
const buildTime = new Date().toISOString();          // e.g. "2026-07-11T18:04:22.117Z"
const channel = process.env.GD_CHANNEL || 'stable';  // 'stable' | 'beta' | 'canary'

export default defineConfig({
  base: './',                                   // KEEP: portable to any sub-path / file:// host
  server: { host: true, port: 5173, strictPort: true },
  define: {                                     // §24.10 in-game build stamp
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__:   JSON.stringify(sha),
    __BUILD_TIME__:  JSON.stringify(buildTime),
    __BUILD_CHAN__:  JSON.stringify(channel),
  },
  build: {
    target: 'es2022',                           // KEEP: matches shipped code (top-level await in main.js)
    outDir: 'dist',
    assetsInlineLimit: 0,                        // KEEP: never inline — every asset stays a cacheable file
    cssCodeSplit: false,                         // one tiny CSS file (the HUD CSS is inline in index.html anyway)
    sourcemap: 'hidden',                         // emit .map but do not reference from JS (kept out of prod, used by §24.11)
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1200,                 // three.js legitimately exceeds 500 KB
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/jsm')) return 'three-addons';
          if (id.includes('node_modules/three')) return 'three-core';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;                       // app code stays in the entry chunk
        },
      },
    },
  },
});
```

**24.2.1 Chunk split rationale.** `three-core` (the r160 library) and `three-addons` (the eight `examples/jsm` passes/loaders the game imports: `PointerLockControls`, `EffectComposer`, `RenderPass`, `GTAOPass`, `UnrealBloomPass`, `OutputPass`, `RGBELoader`, `GLTFLoader`, plus `FBXLoader` used by `characters.js`) are split away from app code because they change rarely. When you tweak `store.js` or `products.js`, only the small entry chunk gets a new hash; the ~155 KB gzipped `three-core` chunk keeps its hash and stays in every returning player's cache and the service-worker cache. This is the single most important caching win.

| Chunk | Contents | Raw (est.) | gzip (est.) | brotli (est.) | Churn |
|---|---|---|---|---|---|
| `three-core.[hash].js` | three r160 library | ~610 KB | ~155 KB | ~132 KB | Rare (three bump only) |
| `three-addons.[hash].js` | 9 `examples/jsm` modules | ~180 KB | ~48 KB | ~41 KB | Rare |
| `index.[hash].js` (entry) | `main,store,products,physics,characters,game,stock,models,env,sfx,materials` | ~230 KB | ~62 KB | ~53 KB | Every gameplay change |
| `index.[hash].css` | non-inline CSS (minimal) | ~2 KB | ~0.9 KB | ~0.8 KB | Rare |
| **Code total** | | **~1.02 MB** | **~266 KB** | **~227 KB** | |

**24.2.2 Asset hashing — the honest caveat.** Vite content-hashes assets that are *imported* by JS. But this game loads every runtime asset by **string path** through `fetch()` / `TextureLoader` / `GLTFLoader` / `RGBELoader` (e.g. `'assets/env/warehouse_1k.hdr'`, `'assets/models/kit/manifest.json'`). Those live in `public/` and Vite copies them to `dist/assets/…` **verbatim, unhashed**. Consequence: the 74 asset files (6 `.fbx`, 24 `.glb`, 1 `.hdr`, 36 `.jpg`, 1 `.json`, 6 `.png`) keep stable URLs across builds. Cache-busting for them is therefore **not** filename-based — it is owned by the service-worker cache version (§24.8) and the `assets/manifest.json` for the kit. Do **not** try to hash `public/` assets; the runtime code reads fixed paths and it would break `preloadModels()` and `loadEnvironment()`.

**24.2.3 Compression.** JS/CSS/HTML/HDR compress well; JPG/PNG/GLB are already entropy-dense and gain <3 %. Two supported paths:

1. **Host-side (default).** Netlify auto-brotli-encodes text assets; GitHub Pages gzip-encodes them. Nothing to do. Expected first-load transfer for code = ~227 KB brotli (Netlify) or ~266 KB gzip (Pages).
2. **Precompressed (optional, additive).** Add `vite-plugin-compression2` to emit `*.br` and `*.gz` beside each text asset, and let the host serve them where it can't compress on the fly (itch.io's CDN). This is a build-time devDependency only; it changes nothing at runtime.

The 32 MB asset floor is dominated by the Rocketbox people set (~12.9 MB), the kit GLBs (~10.8 MB), textures (~4.7 MB), animation donors `shopper.glb`+`anims.glb` (~2.65 MB), and the HDRI (~1.67 MB). Compression does not meaningfully move this number — the lever that does is the **runtime-lazy caching** in §24.8, which keeps first-install to the boot-critical subset.

---

### 24.3 Build output anatomy and size budget

`npm run build` produces:

```
dist/
├─ index.html                       (~4.7 KB, HUD CSS inline)
├─ assets/
│  ├─ index.[hash].js               entry
│  ├─ three-core.[hash].js
│  ├─ three-addons.[hash].js
│  ├─ index.[hash].css
│  ├─ env/warehouse_1k.hdr          1.67 MB   (unhashed, from public/)
│  ├─ tex/{floor,wall,wood,asphalt}/{diff,arm,nor}.jpg   4.72 MB (12 files)
│  ├─ models/kit/*.glb + manifest.json   10.79 MB (22 GLB + manifest)
│  ├─ models/{shopper,anims}.glb    2.65 MB
│  └─ models/people/<6 avatars>/*   12.88 MB (6 fbx + 24 jpg + 6 png)
├─ manifest.webmanifest             (§24.7, added)
├─ sw.js                            (§24.8, added)
├─ icons/                           (§24.7, added — generated)
└─ .nojekyll                        (§24.4, GitHub Pages only)
```

| Bucket | Files | Size | First-install priority |
|---|---|---:|---|
| Code (3 JS + 1 CSS + HTML) | 5 | ~1.02 MB | **Precache (critical)** |
| HDRI | 1 | 1.67 MB | **Precache (critical)** — lighting needs it |
| Floor + wall textures | 6 | ~0.81 MB | **Precache (critical)** — first visible surfaces |
| Wood + asphalt textures | 6 | ~3.91 MB | Runtime-cache (produce/wine/lot) |
| Kit GLBs + manifest | 23 | ~10.79 MB | Runtime-cache on first store build |
| Character donors | 2 | 2.65 MB | Runtime-cache |
| Rocketbox people | 36 | ~12.88 MB | Runtime-cache |
| **Total** | **~80** | **~33.5 MB** | Precache ≈ **3.5 MB**, rest lazy |

Budget gate for CI (cross-ref Ch. 23): **fail the build if code total gzip > 320 KB or total `dist/` > 40 MB.** These thresholds leave headroom above today's numbers without letting a stray uncompressed texture balloon the payload.

---

### 24.4 Hosting matrix — GitHub Pages (exact packaging)

Because `base: './'` emits relative URLs, the same `dist/` works whether it lands at `https://<user>.github.io/grocerydash/` (project page) or a custom domain root.

**Manual one-shot:**
1. `npm ci`
2. `npm run build`
3. `touch dist/.nojekyll` — stops Jekyll from stripping/ignoring files; harmless since Vite emits `assets/` not `_`-prefixed dirs, but required belt-and-suspenders.
4. `npx gh-pages -d dist -b gh-pages` (publishes `dist/` to the `gh-pages` branch).
5. In repo Settings → Pages, set Source = `gh-pages` branch, `/ (root)`.

**Automated (recommended) — `.github/workflows/deploy.yml`:**
```yaml
name: deploy
on: { push: { tags: ['v*'] } }        # deploy only on a version tag (§24.10, §24.13)
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test            # Ch. 23 suites must pass before ship
      - run: npm run build
      - run: touch dist/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.d.outputs.page_url }}' }
    steps: [{ id: d, uses: actions/deploy-pages@v4 }]
```

**GitHub Pages notes.** Pages serves `.hdr`, `.glb`, `.fbx` as `application/octet-stream` — fine, because the loaders read `arrayBuffer`. Pages sets `Cache-Control: max-age=600` on everything and gzips text; we cannot set per-file headers, so **the service worker (§24.8) is the durable cache** on Pages. SW scope = the Pages sub-path (`/grocerydash/`); registering with the relative path `./sw.js` keeps scope correct.

---

### 24.5 Hosting matrix — Netlify (exact packaging)

**Setup (Git-connected):**
1. New site → import repo.
2. Build command: `npm run build`; Publish directory: `dist`; Node version: 20 (via `.nvmrc` or `NODE_VERSION=20`).
3. Commit `netlify.toml` and `public/_headers`.

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
[build.environment]
  NODE_VERSION = "20"
```

`public/_headers` (copied verbatim into `dist/`):
```
# Immutable, content-hashed code — cache a year
/assets/*.js
  Cache-Control: public, max-age=31536000, immutable
/assets/*.css
  Cache-Control: public, max-age=31536000, immutable
# Unhashed media — long cache, SW owns invalidation
/assets/*
  Cache-Control: public, max-age=604800
# Shell + worker — always revalidate
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
```

**Netlify notes.** Brotli is automatic for text assets (~227 KB code transfer). Deploy previews per PR give a QA URL for each change (cross-ref Ch. 23 / §24.13). Rollback is a dashboard one-click (§24.14). CLI path: `netlify deploy --prod --dir=dist`.

---

### 24.6 Hosting matrix — itch.io (exact packaging)

itch serves HTML5 games from a randomized CDN path (e.g. `https://v6p9d9t4.ssl.hwcdn.net/html/…`). It wants a **zip with `index.html` at the top level**.

**Manual upload:**
1. `npm run build`
2. Zip the *contents* of `dist/` (not the folder):
   `cd dist && zip -r ../grocery-dash-3d-v0.4.2.zip . && cd ..`
   The zip root must contain `index.html`, `assets/`, `manifest.webmanifest`, `sw.js`, `icons/`.
3. On the itch project page: Kind of project = **HTML**; upload the zip; check **"This file will be played in the browser."**
4. Embed settings: Viewport = **1280 × 720** (matches the desktop design; the game itself reads `innerWidth/innerHeight`, so this is only the iframe box), enable **"Click to activate"** off? No — leave **Fullscreen button** on and **"Automatically start on page load"** off so audio/pointer-lock gestures work (the game's `SFX.start()` and pointer-lock both require a user gesture — Ch. 8).
5. Leave **"This game uses SharedArrayBuffer"** unchecked — the game uses no threads/COOP-COEP.

**Automated (butler):**
```
butler push dist <user>/grocery-dash-3d:html5 --userversion 0.4.2
```
butler diffs and uploads only changed blocks; it also **retains every pushed version**, which is the rollback mechanism (§24.14).

**itch notes.** The randomized subdomain is a fresh origin, so `localStorage` (§24.11–24.12) and the SW cache are sandboxed per game — desirable. Pointer lock inside the itch iframe frequently fails; this is exactly why `main.js` ships the `enableFallback()` drag-to-look path (`pointerlockerror` → `fallbackLook = true`). itch is the primary reason that fallback exists and must never be removed.

| Host | Config file | Custom headers? | Auto compression | Rollback | Best for |
|---|---|---|---|---|---|
| GitHub Pages | workflow YAML + `.nojekyll` | No (SW owns cache) | gzip | Re-tag / revert `gh-pages` | Free canonical URL |
| Netlify | `netlify.toml` + `_headers` | Yes (immutable headers) | brotli | Dashboard 1-click | QA previews, prod |
| itch.io | zip / butler | No | CDN gzip | butler re-push older | Discovery, players |

---

### 24.7 PWA — manifest

Add `public/manifest.webmanifest` (copied verbatim to `dist/`) and link it from `<head>` in `index.html`:
`<link rel="manifest" href="./manifest.webmanifest">` and `<meta name="theme-color" content="#0b0d10">`.

```json
{
  "name": "Grocery Dash 3D",
  "short_name": "Grocery Dash",
  "id": "/grocery-dash-3d/",
  "description": "A first-person supermarket arcade dash. Grab your six items and check out before you wreck the store.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "fullscreen",
  "display_override": ["fullscreen", "standalone"],
  "orientation": "landscape",
  "background_color": "#0b0d10",
  "theme_color": "#0b0d10",
  "categories": ["games", "entertainment"],
  "lang": "en",
  "dir": "ltr",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "./icons/icon-monochrome.png", "sizes": "512x512", "type": "image/png", "purpose": "monochrome" }
  ]
}
```

**Field notes.** `display: fullscreen` matches the game's edge-to-edge canvas (`#app { inset:0 }`) and hides browser chrome on install; `standalone` is the fallback. `orientation: landscape` reflects the WASD+mouse design (Ch. 8). `theme_color`/`background_color` `#0b0d10` match the `index.html` body and the boot radial's dark end (`#090b0e`) so the splash → boot handoff is seamless. `scope: "./"` and relative `start_url` keep the manifest portable across the three hosts' sub-paths.

**Icons — generated, not hand-drawn.** Consistent with the game's procedural-art approach (canvas labels in `products.js`, Ch. 13), a `scripts/gen-icons.mjs` renders the cart glyph on the brand gradient to a canvas and writes the PNG set. Exact spec:

| File | Size | Purpose | Background | Glyph | Safe zone |
|---|---|---|---|---|---|
| `icon-192.png` | 192×192 | any | radial `#16202b`→`#090b0e` | white cart, 60 % width | n/a |
| `icon-512.png` | 512×512 | any | same | white cart, 58 % width | n/a |
| `icon-maskable-512.png` | 512×512 | maskable | solid `#0f1620` full-bleed | cart within center **80 %** | 10 % margin each edge |
| `icon-monochrome.png` | 512×512 | monochrome | transparent | `#ffffff` cart silhouette | n/a |
| `apple-touch-icon.png` | 180×180 | iOS | solid `#0f1620` (no transparency) | white cart | n/a |
| `favicon-32.png` / `favicon-16.png` | 32 / 16 | tab | `#0f1620` | white cart | n/a |

Accent stroke on the cart uses the HUD green `#35c46a` at 512 to tie the icon to the boot bar and list checkmarks.

---

### 24.8 PWA — service-worker caching strategy per asset class

`sw.js` sits at `dist/` root and is registered from `main.js` **after** first paint so it never competes with boot loading:

```js
// end of main.js try-block, after animate()
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
```

Two named caches. The **shell cache** is versioned by build (busts on every deploy); the **asset cache** is versioned independently and only bumps when `public/assets/` actually changes (rare), so a code-only release does not re-download 32 MB.

```js
// sw.js  (build injects the same __BUILD_SHA__ used in-game)
const SHELL = 'gd3d-shell-3f9a1c2';   // ← replaced at build time
const ASSETS = 'gd3d-assets-v3';      // ← bump ONLY when media changes
const PRECACHE = [
  './', './index.html', './manifest.webmanifest',
  './assets/env/warehouse_1k.hdr',
  './assets/tex/floor/diff.jpg','./assets/tex/floor/arm.jpg','./assets/tex/floor/nor.jpg',
  './assets/tex/wall/diff.jpg','./assets/tex/wall/arm.jpg','./assets/tex/wall/nor.jpg',
  './assets/models/kit/manifest.json',
];
// JS/CSS entries are discovered from index.html at install and added to SHELL.
```

**Strategy per asset class:**

| Asset class | URL glob | Strategy | Cache bucket | Precached on install? | Invalidation |
|---|---|---|---|---|---|
| App shell HTML | `/`, `/index.html` | **network-first**, fall back to cache | SHELL | Yes | New build → new SHELL name |
| Hashed JS/CSS | `/assets/*.[hash].{js,css}` | **cache-first** (immutable) | SHELL | Yes (discovered) | Filename hash changes |
| HDRI | `/assets/env/*.hdr` | **cache-first** | ASSETS | Yes | Bump ASSETS |
| Floor/wall textures | `/assets/tex/{floor,wall}/*` | **cache-first** | ASSETS | Yes | Bump ASSETS |
| Wood/asphalt textures | `/assets/tex/{wood,asphalt}/*` | **stale-while-revalidate** | ASSETS | No (runtime) | Bump ASSETS |
| Kit GLBs + manifest.json | `/assets/models/kit/*` | **cache-first** | ASSETS | manifest only | Bump ASSETS |
| Character donors | `/assets/models/{shopper,anims}.glb` | **cache-first** | ASSETS | No (runtime) | Bump ASSETS |
| Rocketbox people | `/assets/models/people/**` | **cache-first** | ASSETS | No (runtime) | Bump ASSETS |
| Icons | `/icons/*` | **cache-first** | SHELL | Yes | New SHELL name |
| Manifest | `/manifest.webmanifest` | **network-first** | SHELL | Yes | New SHELL name |
| Service worker | `/sw.js` | never cached (host `no-cache`) | — | — | Browser byte-diff check |

`fetch` handler logic (concrete):
- **Navigation requests** (`request.mode === 'navigate'`): try network (3 s timeout) → on failure serve cached `./index.html`. This is what makes the game **playable offline** after one visit.
- **`/assets/*` and `/icons/*`**: check ASSETS/SHELL → hit returns immediately; miss fetches, and on `res.ok` clones into the correct bucket. This lazily fills the 32 MB set as the player actually reaches the wine nook, apparel racks, etc.
- **Opaque/error responses are never cached** (guard on `res.ok && res.status === 200`).
- **Runtime cache cap:** ASSETS is allowed to hold every media file (~80 entries, ~33 MB) — under the ~50–60 MB per-origin soft budget on the iGPU-class laptops we target. No LRU eviction is implemented because the working set is bounded and known; if a future SKU expansion (Ch. 16 targets 150 SKUs) pushes assets past 45 MB, add an LRU that trims oldest ASSETS entries to a 40 MB ceiling.

`install`: `precache PRECACHE`, do **not** `skipWaiting` by default (see §24.9). `activate`: delete any cache whose name is neither the current SHELL nor the current ASSETS, then `clients.claim()`.

---

### 24.9 PWA — update flow and UX

The game is a session artifact, so we never hot-swap code mid-run. The flow:

1. New deploy → new `sw.js` bytes → browser installs the new worker in the background; it enters **waiting**.
2. The page detects the waiting worker and shows a toast using the **existing `#toast` element** (already in `index.html`, top:64 px, the same widget used for gameplay toasts):
   > **New version ready — press `U` to update**
3. On `U`, post `{type:'SKIP_WAITING'}` to the worker; the worker calls `skipWaiting()`; on `controllerchange` the page does one `location.reload()`.
4. If the player ignores it, the update applies **on the next natural reload** — never interrupting a checkout run.

```js
navigator.serviceWorker.register('./sw.js').then((reg) => {
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(reg);
    });
  });
});
let reloaded = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (reloaded) return; reloaded = true; location.reload();
});
// key 'U' handler → reg.waiting.postMessage({type:'SKIP_WAITING'})
```

This "explicit, non-disruptive, deferred" pattern is the whole point of not calling `skipWaiting()` in `install`: a background deploy must never yank three.js out from under a live physics simulation (Ch. 22).

**Offline UX.** After the first successful visit the game runs with no network. If the very first visit is offline, the navigation-fallback has nothing cached and the boot screen stalls at "Loading store…"; that is acceptable (a game cannot bootstrap from nothing) and is the only offline dead-end.

---

### 24.10 Versioning and in-game build stamp

**Scheme: SemVer `MAJOR.MINOR.PATCH`** on `package.json` (currently `0.1.0`), pre-1.0 during the wave plan (Ch. 25).

| Bump | Trigger | Examples for this game |
|---|---|---|
| **PATCH** (`0.4.1→0.4.2`) | Bug/tuning, no rule change | Fix a collider gap; retune `TIP_SPEED`; texture swap |
| **MINOR** (`0.4.2→0.5.0`) | New content/feature, back-compatible | New SKUs (Ch. 16); a new career shift (Ch. 3); a new mode ruleset (Ch. 2) |
| **MAJOR** (`0.x→1.0.0`) | Ship / breaking loop or save change | Public 1.0; any change that invalidates the seed/economy schema (Ch. 4, Ch. 20) |
| **Pre-release** | `-beta.N` / `-canary.N` | `0.5.0-beta.1` on the `beta` channel |

**Build stamp.** The `define` block (§24.2) injects four compile-time constants. `main.js` publishes them and paints a corner stamp:

```js
window.__build = { version: __APP_VERSION__, sha: __BUILD_SHA__, time: __BUILD_TIME__, channel: __BUILD_CHAN__ };
const stamp = document.createElement('div');
stamp.textContent = `v${__APP_VERSION__} · ${__BUILD_SHA__}${__BUILD_CHAN__ !== 'stable' ? ' · ' + __BUILD_CHAN__ : ''}`;
stamp.style.cssText = 'position:fixed;right:8px;bottom:6px;z-index:11;font:10px ui-monospace,monospace;color:#eef2f6;opacity:.28;pointer-events:none;letter-spacing:.3px';
document.body.appendChild(stamp);
```
Rendered example (bottom-right, 28 % opacity): **`v0.4.2 · 3f9a1c2`** (or `v0.5.0 · a71b39c · beta`). The same `__BUILD_SHA__` string names the SHELL cache (§24.8) and prefixes every error/telemetry record (§24.11–24.12), so a bug report's SHA maps to an exact deployed commit. The stamp is deliberately faint and `pointer-events:none` so it never obstructs the crosshair or HUD; it appears on every screen including the checkout banner (Ch. 12) so screenshots self-identify their build.

---

### 24.11 Error reporting — local-first ring buffer + user-visible export

The repo already ships the outer safety net: `main.js` wraps the entire bootstrap in `try/catch`, writing `window.__err` and painting a red `#ff7777` `<pre>` on fatal boot failure. This section makes it a **structured, exportable, local-only** reporter — no automatic upload, ever.

**Ring buffer.** A fixed 50-entry circular buffer (`ERR_CAP = 50`) captures four sources:
1. `window.addEventListener('error', …)` — uncaught exceptions and resource load failures.
2. `window.addEventListener('unhandledrejection', …)` — the `.catch()` sinks already present (`loadEnvironment(...).catch(e => window.__err = 'env: '+e)`, the retarget `FATAL` in `characters.js`) route here.
3. A thin wrapper over `console.error` (original preserved and still called).
4. Manual `reportError(kind, msg)` from game code (e.g. a physics invariant tripping).

**Entry schema** (each field concrete):
```json
{
  "t": 48213,                 // ms since session start (performance.now(), integer)
  "iso": "2026-07-11T18:07:41.220Z",
  "kind": "unhandledrejection", // "error" | "unhandledrejection" | "console" | "manual"
  "msg": "Cannot read properties of undefined (reading 'matrixWorld')",
  "stack": "at buildStock (assets/index.3f9a1c2.js:1:9421)…",  // trimmed to 1200 chars
  "src": "assets/index.3f9a1c2.js", "line": 1, "col": 9421,
  "build": "0.4.2+3f9a1c2",   // version + SHA
  "tier": "lite-locked",      // window.__tier at time of error
  "frames": 812,              // render frames elapsed
  "ua": "Mozilla/5.0 … Intel …"  // navigator.userAgent, single line
}
```

The buffer lives in memory and mirrors to `localStorage['gd3d.errlog']` (JSON, last 50, ~parsed on load so it survives a reload — invaluable for the boot-fatal case). It never leaves the device on its own.

**User-visible export.** Two affordances, both manual:
- **Hotkey `Ctrl+Shift+E`** → serializes the buffer + `window.__build` + a one-line device summary to a downloaded file `grocery-dash-report-<sha>-<epoch>.json` (via a `Blob` + object-URL anchor click — a download, so it is user-initiated and needs no permission).
- The **fatal `<pre>`** already shown on boot failure gains a "Copy report" button that writes the same JSON to the clipboard.

The existing `window.__err`, `window.__tier`, and `window.__retargetLog` hooks are folded in as inputs so nothing that currently aids debugging is lost. Everything here is **local-first**: no endpoint, no cookie, no beacon. (Uploading a report is a §24.16 opt-in, and only ever when the player clicks send.)

---

### 24.12 Telemetry-lite — event catalog, payloads, local + opt-in export

Telemetry is **entirely local by default**: events append to an in-memory array and a rolling `localStorage['gd3d.telemetry']` (capped at 2000 events, oldest trimmed). Nothing is transmitted unless the player explicitly exports (§24.12.3) or opts into the additive sink (§24.16). This satisfies the safety posture the whole project holds to: instrumentation that observes but never surveils.

**24.12.1 Envelope.** Every event shares a header:
```json
{ "e": "checkout", "t": 91240, "seq": 137, "build": "0.4.2+3f9a1c2", "sid": "s_9f3a1", ... }
```
`e` = event name, `t` = ms since session start (`performance.now()` int), `seq` = monotonic counter, `sid` = per-tab random session id (not persisted, not a user id).

**24.12.2 Full event catalog (every event, every payload field):**

| `e` | Fired when | Payload fields (beyond envelope) |
|---|---|---|
| `session_start` | First frame after `manager.onLoad` | `ref` (document.referrer host or `"direct"`), `dpr` (devicePixelRatio), `vw`,`vh` (viewport px), `ua` (userAgent) |
| `boot_complete` | Boot screen hidden | `loadMs` (ms boot→ready), `assetsCached` (bool, from SW), `tier` (`"lite"`) |
| `quality_tier` | `autoQuality` decides at frame 80 | `from` (`"lite"`), `to` (`"high"`\|`"lite-locked"`\|`"panic"`), `avgFrameMs` (e.g. `17.4`) |
| `panic_drop` | Panic path lowers DPR | `dpr` (`1`), `avgFrameMs` |
| `run_start` | `game.reset()` makes a list | `seed` (LCG seed `1337`), `list` (6 SKU ids), `total` (list $ sum) |
| `item_grab` | `tryGrab()` succeeds | `sku` (id), `name`, `price`, `fromList` (bool), `fromDebris` (bool), `flyMs` (`400`) |
| `list_complete` | All 6 gathered | `tSec` (elapsed), `grabs` (total E presses) |
| `checkout` | `complete()` runs | `tSec`, `items` (6), `total` ($), `dmgCount`, `dmgTotal` ($ = `price*0.4` sum), `perfect` (bool `dmgCount===0`) |
| `reroll` | `R` after checkout | `runDurationSec` (previous run) |
| `shelf_crash` | Player crash spawns debris | `spawned` (≤9/frame amortized), `spec` (sku), `sprint` (bool) |
| `cart_tip` | Sprint-crash tips a gondola (`≥TIP_SPEED 4.0`) | `spill` (items flung, ~56 cap), `gondolaX` |
| `debris_cap_hit` | Debris count hits `DEBRIS_CAP 100` | `dropped` (oldest recycled) |
| `npc_bump` | Player collides with a walker | `staggered` (bool), `bark` (index) |
| `mute_toggle` | `M` pressed | `muted` (bool) |
| `fallback_look` | Pointer-lock failed → drag-look | `reason` (`"pointerlockerror"`\|`"timeout"`) |
| `error` | Ring-buffer entry added (§24.11) | `kind`, `msgHash` (32-bit hash of msg, not the text) |
| `session_end` | `visibilitychange`→hidden / `pagehide` | `durationMs`, `runs` (checkouts), `grabs`, `crashes` |

**24.12.3 Opt-in export.** A settings toggle (Ch. 6 settings screen) "Save play stats on this device" is **on** for local logging; a separate button **"Export my stats (.json)"** downloads `grocery-dash-stats-<sha>-<epoch>.json` — the full envelope array plus a computed summary block:
```json
{ "build":"0.4.2+3f9a1c2","sessions":4,"runs":11,"bestSec":74.3,
  "perfectRuns":3,"avgDmg":2.40,"tierMix":{"lite-locked":3,"high":1},"grabs":71 }
```
No auto-send. `Ctrl+Shift+T` is the power-user shortcut for the same export. A **"Clear stats"** button wipes both `localStorage` keys (`gd3d.telemetry`, `gd3d.errlog`) — the player fully owns the data.

**24.12.4 Derived local dashboards.** Because the data is on-device, the Results/Stats screen (Ch. 12) reads directly from `gd3d.telemetry` to render personal bests, a perfect-run streak, and a tier histogram — no network round-trip. This is the telemetry's primary *player-facing* payoff, not just diagnostics.

---

### 24.13 Update cadence

| Channel | Source | Audience | Cadence | Gate |
|---|---|---|---|---|
| `canary` | every push to `main` | maintainers only | continuous (Netlify preview URL) | Ch. 23 unit suite green |
| `beta` | `v*-beta.N` tag | opt-in testers (itch beta channel) | ~weekly | Full Ch. 23 suite + manual walk-through |
| `stable` | `v*` tag (no pre-release) | everyone (Pages + itch `html5` + Netlify prod) | ~bi-weekly for PATCH; MINOR per completed wave (Ch. 25) | All green + §24.15 license checklist + §24.14 rollback verified |

Rules: **only tags deploy to `stable`** (the Pages workflow triggers on `tags: v*`). A hotfix PATCH may ship out of cadence when an `error`-event spike or a game-breaking report (§24.11) is confirmed. Every `stable` tag is annotated (`git tag -a v0.4.2 -m …`) so the deployed SHA is immutable and the build stamp (§24.10) is traceable. Bump `ASSETS` cache version (§24.8) **only** in releases that actually touch `public/assets/` — most PATCH releases leave it untouched so returning players re-download only the ~62 KB entry chunk.

---

### 24.14 Rollback plan

Because a release is a single immutable static tree pinned to a git tag, rollback is "re-serve the previous tag." No database migration exists to reverse (the only persistent state is the player's own opt-in `localStorage`, whose schema is versioned — see below).

**Per-host rollback:**

| Host | Rollback procedure | Time to restore |
|---|---|---|
| GitHub Pages | Re-run the deploy workflow from the previous good tag (Actions → Run workflow → ref = `v0.4.1`), **or** `git push -f origin <prev-gh-pages-sha>:gh-pages` | 1–2 min (Pages propagation) |
| Netlify | Dashboard → Deploys → previous deploy → **"Publish deploy"** (one click), or `netlify rollback` | Seconds |
| itch.io | `butler push` the previous `dist/` again, or in-dashboard set an earlier uploaded build as the playable one | 1–2 min |

**Service-worker safety during rollback.** A rollback changes `sw.js` bytes → browsers install the older worker → it purges the newer SHELL cache on `activate`. Players on the bad build get the good build on their next reload via §24.9. To force it (a truly broken release), ship a **kill-switch worker**: an `sw.js` whose `install` calls `self.registration.unregister()` then `clients.matchAll()` → `client.navigate(client.url)`, which drops all clients back to network and clears the SW entirely. Keep `sw-killswitch.js` in the repo, ready to copy over `sw.js` in a 60-second emergency deploy.

**Data-compat guard.** `localStorage` keys carry a schema version (`gd3d.telemetry` entries include `build`; add `gd3d.schema = 2`). On load, if the stored schema is **newer** than the running code's (i.e. a player who saw a rolled-back-from build), the code discards incompatible keys rather than crashing — a forward-compatible read. This prevents a rollback from bricking on a save written by the newer build.

**Rollback drill.** Before any `stable` tag, the release runbook requires one verified rollback rehearsal on Netlify prod (publish previous, confirm the build stamp reverts, republish current). A rollback that has never been tested is not a rollback plan.

---

### 24.15 License & credits compliance checklist

Every shipped asset is CC0, MIT, or CC-BY 4.0. `CREDITS.md` is the ledger; this is the pre-ship gate. **Obligation legend:** CC0 = public domain, *no legal obligation* (we credit as courtesy); MIT = *must ship the license text + copyright notice*; CC-BY 4.0 = *must attribute the creator*.

**Complete asset ledger (every source):**

| # | Asset(s) shipped | Source | License | Obligation | Where satisfied |
|---|---|---|---|---|---|
| 1 | `env/warehouse_1k.hdr` (`empty_warehouse_01`) | Poly Haven | CC0 | None (courtesy) | CREDITS.md |
| 2 | `tex/floor/*` (`floor_tiles_06` diff/arm/nor) | Poly Haven | CC0 | None | CREDITS.md |
| 3 | `tex/wall/*` (`beige_wall_001` diff/arm/nor) | Poly Haven | CC0 | None | CREDITS.md |
| 4 | `tex/wood/*` (`wood_planks` diff/arm/nor) | Poly Haven | CC0 | None | CREDITS.md |
| 5 | `tex/asphalt/*` (`asphalt_02` diff/arm/nor) | Poly Haven | CC0 | None | CREDITS.md |
| 6 | 8 cars `car_{sedan,suv,suvlux,van,hatch,sedansport,delivery,taxi}.glb` (Kenney Car Kit) | Kenney.nl (via GitHub mirror) | CC0 | None | CREDITS.md |
| 7 | 8 produce `prod_{apple,lemon,avocado,banana,onion,sweetpotato,tins,croissant}.glb` | Poly Haven photoscans | CC0 | None | CREDITS.md |
| 8 | 6 props `prop_{register,plant,box,crate,wineshelf,wine}.glb` | Poly Haven | CC0 | None | CREDITS.md |
| 9 | 6 Rocketbox avatars `people/{Female_Adult_01,08,12; Male_Adult_01,04,08}/*` (fbx + textures) | Microsoft Rocketbox | **MIT** | **Ship MIT text + "© Microsoft"** | `LICENSES/rocketbox-MIT.txt` + CREDITS.md |
| 10 | `models/anims.glb` (three.js `Soldier.glb`, animation donor only, never rendered) | three.js / mrdoob | **MIT** | **Ship three.js MIT license** | `LICENSES/three-MIT.txt` |
| 11 | `models/shopper.glb` (`CesiumMan`, legacy fallback) | Khronos / Cesium | **CC-BY 4.0** | **Attribute "Cesium, CC-BY 4.0"** | CREDITS.md **+ in-game credits (Ch. 6)** |
| 12 | `three@0.160.1` (runtime library) | mrdoob / three.js | **MIT** | **Ship license text** | `LICENSES/three-MIT.txt` |
| 13 | `vite@5.4.0` (build only, not shipped) | Vite / VoidZero | MIT | None at runtime | dev only |
| 14 | `@gltf-transform/cli` (build only) | Don McCurdy | MIT | None at runtime | dev only |
| 15 | Procedural product labels (`products.js`), procedural SFX (`sfx.js`), all fictional brands | Original (this project) | Proprietary/original | None | n/a |

**Pre-ship compliance checklist (all must be ✓ before a `stable` tag):**
- [ ] `CREDITS.md` lists every row above and matches the files actually in `dist/assets/`.
- [ ] `LICENSES/` directory shipped in `dist/` containing the **three.js MIT** and **Rocketbox MIT** full texts with their copyright lines intact.
- [ ] **CesiumMan CC-BY attribution** is present *both* in `CREDITS.md` *and* on the in-game credits/settings screen (CC-BY requires visible attribution, and `shopper.glb` is a shipped fallback that can render).
- [ ] No product label or brand string reproduces a real trademark (Ch. 13 forbids it; grep the 52 SKU `brand`/`name` fields in `products.js`).
- [ ] No new asset entered `public/assets/` without a matching CREDITS.md row and a verified license (CI check: every top-level `public/assets/**` path maps to a ledger entry).
- [ ] Build-only deps (`vite`, `@gltf-transform/cli`) are **not** in `dist/` (confirm no `node_modules` copied).
- [ ] The two MIT texts and the CC-BY line survive minification/copy (they are static files, not code — verify presence in the deploy artifact).

**The only two runtime obligations that can actually bite us** are (a) shipping the MIT license texts for three.js and Rocketbox, and (b) the CesiumMan CC-BY attribution. Everything else is CC0 with zero legal requirement. If `shopper.glb` is ever dropped in favor of the pure-Rocketbox cast (it is already a "legacy fallback"), obligation #11's CC-BY requirement disappears and the ledger simplifies to MIT-only — a worthwhile cleanup to track (cross-ref Ch. 26 DoD).

---

### 24.16 Optional additive backend (strictly opt-in)

The default and canonical build has **no backend**. This section exists only to specify how a server, *if ever added*, stays additive and never becomes a dependency.

- **Nature:** a single stateless endpoint, `POST /ingest`, that accepts the §24.12 export envelope array. No login, no per-user identity — `sid` is ephemeral.
- **Trigger:** only a player action. The settings toggle "Share anonymous stats to help tuning" is **off by default**; when on, `session_end` (and only then) POSTs the pending telemetry via `navigator.sendBeacon`. If the endpoint is unreachable, the game is unaffected — beacon failure is swallowed; local logging continues.
- **Fallback:** if `__BUILD_CHAN__` build has no configured `INGEST_URL` (the default), the toggle is hidden entirely and no networking code runs. The URL is a build-time `define`, absent in the public build.
- **Privacy invariants (non-negotiable):** never send `ua` beyond a coarse GPU/browser class; never send the shopping-list contents as identifiable; never set a cookie; never assign a durable user id; honor Do-Not-Track by hiding the toggle. Error reports (§24.11) are **never** auto-sent — only a player clicking "Send this report" transmits, and the payload is shown first.

This preserves the invariant the whole product is built on: the game watches the *simulation* to tune itself, and it watches the *player* only with explicit, revocable, on-device consent.

---

### 24.17 Release runbook and Definition-of-Done pointer

The end-to-end `stable` release sequence, in order:

1. Land all PRs for the wave (Ch. 25); `main` is green on the Ch. 23 suites.
2. Bump `package.json` version per §24.10; update `CHANGELOG.md`.
3. Run §24.15 compliance checklist — all boxes ✓.
4. `git tag -a v0.5.0 -m "…"; git push --tags` → Pages workflow builds, tests, deploys; Netlify prod builds; `butler push` to itch `html5`.
5. Smoke the three URLs on the **iGPU floor device**: boot → grab 6 → checkout banner (Ch. 12) → build stamp shows the new SHA → SW installs → reload works offline.
6. Rehearse a Netlify rollback (§24.14) and republish current.
7. If `beta` was skipped, watch the local `error`-event rate on your own sessions for 24 h before announcing.

Definition of Done for the release itself lives in Ch. 26; the ops-specific gates are: **static-only build reproducible from a clean checkout, all three hosts serving the same tagged SHA, SW offline-verified, both MIT texts + the CC-BY attribution shipped, and a rehearsed rollback.** Cross-references: build/test gates (Ch. 23), performance floor the release must not regress (Ch. 21), data schemas that versioning protects (Ch. 20), and the settings/credits surfaces that satisfy attribution and telemetry consent (Ch. 6).



---

# PART V — DELIVERY



# Chapter 25 — Work Breakdown & Delivery Waves

This chapter converts every `[BUILD]` marker scattered across Ch. 1–24 into one flat, numbered backlog, then packs that backlog into five delivery waves — **Foundation, Presence, Modes, World, Ship** — each with a scope table, hard exit criteria, and a numeric performance-gate ritual. The v1 sandbox already in the repo (`src/*.js`: renderer, tier system, instanced stock, arcade physics, Rocketbox retargeter, procedural packaging/SFX) is not thrown away — it *is* Wave 1's delivered spine, marked ✅ below. Everything else extends it without contradicting shipped behavior.

### 25.1 How to read the backlog

Every item is one row: `ID · Title (Ch N) · Scope → Done-when · Size · Deps · Status`.

- **ID** — `B001`…`B106`, stable forever. Dependencies reference these IDs.
- **Ch N** — the source chapter whose `[BUILD]` marker this item discharges (map at head of prompt; e.g. Ch. 4 = Scoring/Economy).
- **Scope → Done-when** — one line of scope, then a single *testable* acceptance gate. "Done-when" is the exit assertion a reviewer runs, wired to real hooks (`window.__ready`, `window.__tier`, `renderer.info.render.calls`, the debris cap of 100, the shipping budget of 988 draws / 1.38M tris) wherever one exists.
- **Size** — S / M / L / XL, hour bands in §25.2.
- **Status** — ✅ shipped in v1, ◑ partial (exists but must be formalized/hardened), ○ new.

### 25.2 Estimation model & size bands

One estimator, four T-shirt sizes, each a closed hour band. Roll-ups use the band **midpoint**; range roll-ups use the band edges.

| Size | Hour band | Midpoint | Calendar (1 dev @ 6 h/day) | Typical item |
|---|---|---|---|---|
| **S** | 2–6 h | 4 h | ≤ 1 day | one screen, one config surface, one SFX cue |
| **M** | 8–16 h | 12 h | 1–2 days | a mode, an engine subsystem, a HUD widget |
| **L** | 20–40 h | 30 h | 3–5 days | mode framework, save system, section fit-out |
| **XL** | 48–96 h | 72 h | 6–12 days | store shell, 40 shifts, 150-SKU catalog, NPC system |

**Worked estimate — B055 "Author all 40 career shifts" (XL).** 40 shifts × (author list + pick modifiers + tune three star-pars + one playtest) ≈ 40 × ~2 h = 80 h, inside the 48–96 h XL band → booked at the 72 h midpoint. This is deliberately why shift *authoring* is one XL line and the shift *engine* (B053/B054) is separate — you do not want a 40-way fan-out blocking the mode framework's exit.

Productive week = **30 h** (6 h/day × 5, the rest is review/CI/meetings). A 2-dev team delivers ~60 productive h/week.

---

### 25.3 Wave 1 — Foundation (engine, shell, core loop, data spine)

The frame is standing before anyone decorates it: renderer + tier system, the 46×30×4.2 m shell, instanced stock, movement/collision, the 6-item core loop, and the data/state/save spine every later wave writes against. Almost all of the ✅ rows are already in `src/`.

| ID | Item (Ch) | Scope → Done-when | Sz | Deps | St |
|---|---|---|---|---|---|
| B001 | Renderer & scene bootstrap (Ch21/19) | WebGLRenderer, ACES tonemap, EffectComposer (Render/GTAO/Bloom/Output), boot overlay + shader precompile behind boot → cold boot leaves `window.__ready===true`, `window.__err` undefined. | M | — | ✅ |
| B002 | Progressive quality tiers (Ch21) | lite→high/panic `autoQuality` at frames 20–80, frozen shadow maps, rect-light + half-spot gating, DPR≤1.25 → `window.__tier ∈ {high, lite-locked, panic}` by frame 80. | L | B001 | ✅ |
| B003 | Instanced stock (Ch21/20) | one `InstancedMesh` per template part, zero-scale hide, `hideInRegion`, `availableSpecs` → `stock.counts` reports skus/instances; a grab hides exactly one instance. | L | B001 | ✅ |
| B004 | Store shell build (Ch14) | 46×30×4.2 m supercenter: 4 gondola islands, freezer wall (10 doors), bakery, produce corner, 6-lane front strip, colliders, spawn → `__world.colliders` populated, view fully enclosed. | XL | B001,B003 | ✅ |
| B005 | Movement & collision (Ch8/22) | WASD + sprint, per-axis AABB slide, bounds clamp, head-bob → cannot clip a fixture; walk 3.1 / sprint 4.9 m/s exact. | M | B004 | ✅ |
| B006 | Pointer-lock + fallback look (Ch8) | lock path + `pointerlockerror`/timeout fallback to drag-look → fully playable inside a sandboxed iframe (fallback branch). | M | B001 | ✅ |
| B007 | Core shopping loop (Ch1/7) | 6-item list, raycast hover glow, E fly-to-basket (0.4 s), checkout ring (−7.65, 11.1), banner, R reroll → list→checkout→banner→reroll completes end-to-end. | L | B003,B005 | ✅ |
| B008 | Core HUD (Ch7) | list / timer / prompt / banner / toast DOM layers → all five update live during a run. | M | B007 | ✅ |
| B009 | Environment / IBL (Ch21/15) | HDRI → PMREM `scene.environment`, intensity 0.55, no skybox → PBR reflections present, indoors reads enclosed. | S | B001 | ✅ |
| B010 | Material system & cache (Ch21/13) | METAL/PAINTED/PLASTIC + PBR (ARM) loader + per-(spec,role) cache → box products collapse to 2 draw groups. | M | B001 | ✅ |
| B011 | Model registry & asset pipeline (Ch24/13) | `fetch-models.mjs`, manifest loader, clone/scale-to-height → kit loads, or falls back procedurally with zero error when absent. | M | B001 | ✅ |
| B012 | Module architecture (Ch19) | 11-module split (main/store/game/physics/characters/products/stock/models/materials/env/sfx) → clean import graph, no cycles beyond store↔products. | S | — | ✅ |
| B013 | State machine (Ch19) | boot→menu→playing→paused→results→menu → `window.__state` reflects transitions; illegal transitions rejected. | M | B012 | ○ |
| B014 | Event bus (Ch19) | pub/sub for grab/checkout/crash/damage so modes & telemetry subscribe without editing core → `__bus.emit/on` works; core emits all four events. | M | B012 | ○ |
| B015 | Save / persistence (Ch19/20) | localStorage profile (unlocks/xp/settings/streak), schema-versioned, no-backend → reload restores profile; a corrupt save recovers to defaults. | L | B013,B017 | ○ |
| B016 | Config & feature flags (Ch19) | central tunables (speeds, caps, thresholds) + URL/localStorage overrides → `window.__cfg` exposes them; a flag flips behavior. | S | B012 | ○ |
| B017 | Schema registry & validation (Ch20) | declarative SKU/shift/save/settings/telemetry schemas + runtime validate → invalid data is logged & rejected, never crashes boot. | M | B012 | ○ |
| B018 | SKU / catalog schema & loader (Ch20/16) | formalize product spec (id/name/price/section/kind/colors/rarity) + catalog loader → the 52 v1 SKUs pass schema and feed stocking. | M | B017 | ◑ |
| B019 | Pillar-conformance checklist (Ch1) | encode the design pillars into a PR checklist + feature tags → PR template forces each feature to map to a pillar. | S | — | ○ |
| B020 | Session/difficulty envelope (Ch1) | tune default run to 3–6 min, 6-item list, novice-reachable checkout → playtest median run 3–6 min. | S | B007 | ◑ |
| B021 | Draw-call & triangle budget guard (Ch21) | dev overlay + assert `renderer.info` against budget → overlay shows calls/tris; CI can read them. | M | B002 | ○ |
| B022 | Framebuffer-grid harness (Ch23) | teleport `__camera` across the 7 anchors, render, emit a thumbnail grid vs golden → harness produces a grid PNG headlessly. | M | B004,B021 | ◑ |

**Wave 1 roll-up:** 22 items — S×5, M×12, L×4, XL×1 = **356 h** (of which ✅ ≈ 242 h already banked).

**Exit criteria.** A player boots into the shell, walks without clipping, completes a full list→checkout→reroll, and every later wave has a registry (B012), state machine (B013), event bus (B014), save (B015), schema (B017), and budget instrumentation (B021) to build on. `window.__err` stays undefined through a 5-minute session.

**Perf-gate ritual PG-1.** Run the shared 7-step ritual (defined once in §25.8). Wave-1 targets: cold boot clean; `__tier` resolves ≤80 frames; **worst anchor ≤ 1100 draws / ≤ 1.6M tris**; p95 frame **≤ 24 ms** on the Intel-iGPU floor profile (DPR clamped 1.25); heap flat over 2 min idle.

---

### 25.4 Wave 2 — Presence (game-feel, physics, NPCs, audio, packaging)

Foundation is playable but sterile. Wave 2 is the "grocery-shopping-meets-GTA" texture: bespoke arcade physics, retargeted shoppers, procedural SFX, printed packaging, and the feel layer (shake/bob/fly/hit-stop). Most of the ✅ rows already ship.

| ID | Item (Ch) | Scope → Done-when | Sz | Deps | St |
|---|---|---|---|---|---|
| B023 | Core arcade physics (Ch22) | carts (momentum/tip), gondolas (sprint-tip pivot 87°, 56-item spill, collider mutates to fallen footprint), debris (cap 100, TTL 28 s, 9 spawns/frame), NPC bump → sprint-crash ≥4.0 m/s tips an aisle; debris caps at 100. | XL | B004,B005 | ✅ |
| B024 | Core game-feel (Ch9) | camera shake, head-bob, fly-to-basket arc, hover glow box → shake decays to 0; fly lerps over 0.4 s. | M | B007,B023 | ✅ |
| B025 | Core NPC system (Ch17) | Rocketbox retarget (rotation-delta, A→T corrective, hip-bob), pathing, staff posts, blob shadows, numeric sanity gate → `__cast` non-empty, `__retargetLog` "ok", NPCs walk aisles. | XL | B004,B011 | ✅ |
| B026 | Core procedural SFX (Ch18) | WebAudio grab/tick/listDone/checkout/error/thud/crash/clatter + store hum + mute → `SFX.start()` on gesture; M mutes master. | M | B006 | ✅ |
| B027 | Packaging art system (Ch13) | canvas labels (box/can/jar/bottle/bag/carton/cup/tub) + procedural brands/barcode + tex cache → every SKU shows a printed label; cache dedups per id. | L | B010 | ✅ |
| B028 | Bark & caption data (Ch17/11) | bump/crash bark pools + subtitle event hook → barks fire on bump/crash and emit a caption event. | S | B025,B014 | ◑ |
| B029 | Hit-stop & impact flash (Ch9) | brief timescale dip + flash/vignette on crash/tip → crash yields ≤80 ms hit-stop + flash, gated by reduced-motion flag. | M | B023,B024 | ○ |
| B030 | Shopper variety & density scaling (Ch17/21) | cast cycling + NPC count scaled by render tier → count drops on panic tier; ≥6 distinct avatars visible. | M | B025,B002 | ◑ |
| B031 | Physics tuning & config exposure (Ch22) | surface TIP 4.0 / KNOCK 1.6 / caps to `__cfg` + a tuning pass → thresholds read from config; playtest sign-off. | S | B023,B016 | ◑ |
| B032 | Audio mix bus & ducking (Ch18) | master bus, per-category gains, duck hum under stingers → crash ducks hum; mute affects all buses. | M | B026 | ○ |
| B033 | NPC reaction system (Ch17) | nearby NPCs flinch/turn toward crashes & tips → a tip within 6 m makes ≥1 NPC pause and face it. | M | B025,B023,B014 | ○ |
| B034 | Checkout / queue NPCs (Ch17) | 2 staffed lanes get an advancing customer queue; lane 6 stays closed → queues visibly move at both staffed registers. | M | B025 | ○ |

**Wave 2 roll-up:** 12 items — S×2, M×7, L×1, XL×2 = **266 h** (✅ ≈ 186 h banked).

**Exit criteria.** A sprint-crash tips a gondola, spills 56 items as grabbable debris, barks fire, NPCs react, the store hums, and no interaction leaks memory. The store *feels* inhabited and destructible.

**Perf-gate ritual PG-2.** PG-1 plus stress: **worst anchor ≤ 1050 draws / ≤ 1.5M tris**, p95 **≤ 22 ms**; run 3 consecutive sprint-tips → debris count caps at **100**, returns to baseline after the 28 s TTL, heap returns within 5% of pre-stress.

---

### 25.5 Wave 3 — Modes (mode framework, scoring, progression, front-end, results)

Wave 3 turns a sandbox into a *game*: a mode registry, the five modes, the score/economy/progression stack, all 40 career shifts, and the menu→run→results shell.

| ID | Item (Ch) | Scope → Done-when | Sz | Deps | St |
|---|---|---|---|---|---|
| B035 | Mode framework / registry (Ch2) | `Mode {setup,onGrab,onCheckout,scoreFn,timeLimit,failFn}` + active-mode switch → `__mode` swaps rules without editing `game.js` core. | L | B013,B014,B007 | ○ |
| B036 | Free Shop mode (Ch2) | the v1 sandbox loop registered as a mode → default boot = Free Shop, behavior identical to v1. | S | B035 | ◑ |
| B037 | Time Attack mode (Ch2) | fixed 6-item list, race the clock, score = time + damage → star thresholds applied at checkout. | M | B035,B041,B044 | ○ |
| B038 | List Rush mode (Ch2) | rolling lists in 3:00, count completions → auto-reroll on checkout, 180 s global timer, end summary. | M | B035 | ○ |
| B039 | Chaos Sprint mode (Ch2) | carnage-scored; damages become points → tips/crashes add score, comedic banner. | M | B035,B023 | ○ |
| B040 | Daily Challenge mode (Ch2/5) | date-seeded fixed run via LCG (`seed*16807%2147483647`) → same date → identical list + layout for every player. | M | B035,B051 | ○ |
| B041 | Score engine (Ch4) | composable `scoreFn` (time, damage, combo, bonuses) → run score → deterministic score for a fixed run. | M | B014,B035 | ○ |
| B042 | Damage-billing hardening (Ch4) | itemized 40%-of-price damages at checkout → banner shows count + $; value also feeds `scoreFn`. | S | B023,B041 | ✅ |
| B043 | Price / economy table (Ch4/16) | per-SKU price + section economics balancing → list totals land in each mode's target $ range. | S | B018 | ◑ |
| B044 | Star thresholds (Ch4) | 1–3 star cutoffs per mode/shift by score/time → results shows 0–3 stars deterministically. | S | B041 | ○ |
| B045 | Coin currency & payout (Ch4/5) | coins from runs (payout = f(score, stars)) spent on unlocks → run credits coins; balance persists. | M | B041,B015 | ○ |
| B046 | Combo / multiplier (Ch4/7) | consecutive damage-free grabs build a multiplier → HUD multiplier climbs, resets on any damage. | M | B041,B008 | ○ |
| B047 | XP & level curve (Ch5) | XP per run, documented level curve, level-up rewards → level rises at thresholds. | M | B015,B041 | ○ |
| B048 | Unlock manifest & gating (Ch5/3) | data-driven unlock chain (modes/shifts/cosmetics) keyed on level/coins/stars → locked content greyed until criteria met. | M | B045,B047 | ○ |
| B049 | Achievements engine (Ch5) | event-bus trigger rules, one-shot, persisted → earning fires a toast + saves; never double-awards. | M | B014,B015 | ○ |
| B050 | Achievement set (Ch5) | authored list across categories speed / chaos / collection / mastery / streak → full set defined in data, each testable. | M | B049 | ○ |
| B051 | Daily generator & seed (Ch5) | date → seed → objective + modifiers → deterministic per date, resets at local midnight. | S | B040 | ○ |
| B052 | Streak system (Ch5) | consecutive-day streak + freeze grace → increments once/day, breaks after a missed day. | S | B015,B051 | ○ |
| B053 | Shift schema & loader (Ch3) | declarative `shift {id,list,modifiers,par,stars,unlock}` → one shift JSON drives a complete run. | M | B017,B035 | ○ |
| B054 | Shift modifier engine (Ch3) | composable run mutators (fog, rush, no-sprint, slippery, VIP item…) → modifiers stack and apply at `setup`. | L | B053 | ○ |
| B055 | Author all 40 career shifts (Ch3) | 4 tiers × 10 shifts, escalating modifiers/par → 40 shifts load, each is beatable, three star-pars tuned each. | XL | B053,B054,B043 | ○ |
| B056 | Shift-select map screen (Ch3/6) | node map with lock/star state → reflects unlock manifest, launches a shift. | M | B048,B053,B057 | ○ |
| B057 | Main menu (Ch6) | title, play, mode/shift entry, settings → reachable from boot, routes through the state machine. | M | B013 | ○ |
| B058 | Mode-select screen (Ch6) | pick among the 5 modes → launches each registered mode. | S | B035,B057 | ○ |
| B059 | Pause menu (Ch6) | resume/restart/quit, releases pointer lock → Esc pauses; resume re-locks. | S | B013 | ○ |
| B060 | Settings screen (Ch6/11) | audio/graphics/controls/a11y tabs → changes persist via save system. | M | B015,B057 | ◑ |
| B061 | Results screen (Ch6/12) | score, stars, damages, coins/xp, next-actions → shown on run end, replaces the v1 banner inside modes. | M | B041,B044,B045 | ○ |
| B062 | Score/combo HUD readout (Ch7) | live score + multiplier widget → updates on each grab/damage, mode-aware. | S | B046 | ○ |
| B063 | Objective ticker (Ch7) | current mode/shift objective + progress → shows list count or mode goal live. | S | B035,B008 | ○ |
| B064 | Run-stats collector (Ch12) | per-run metrics (time, grabs, damages, distance, tips) → results reads one complete stats object. | M | B014 | ○ |

**Wave 3 roll-up:** 30 items — S×10, M×17, L×2, XL×1 = **376 h**.

**Exit criteria.** From the main menu a player picks any of 5 modes or any of 40 shifts, plays a scored run with combos and star-rated results, earns coins/xp that unlock the next thing, and a daily is identical for everyone on a given date. Nothing writes rules into `game.js` core — it all rides the mode registry + event bus.

**Perf-gate ritual PG-3.** No transition hitch **> 50 ms** across menu↔run↔results; save/load **< 50 ms**; `scoreFn` deterministic across 5 fixed seeds; **no draw/tri regression** versus PG-2 numbers.

---

### 25.6 Wave 4 — World (150-SKU catalog, interior detailing, exterior/time/weather, brands, audio/NPC extras)

Wave 4 scales the world from a 52-SKU demo to the full 150-SKU supercenter and dresses it — all while holding the shipping perf envelope.

| ID | Item (Ch) | Scope → Done-when | Sz | Deps | St |
|---|---|---|---|---|---|
| B065 | Expand catalog 52→150 SKUs (Ch16) | author 98 new SKUs across the 9 sections → 150 SKUs pass schema, stock, and price-balance. | XL | B018,B027,B043 | ○ |
| B066 | 150 label variants (Ch13) | brand/label art for all new SKUs → every SKU renders a distinct printed label. | L | B027,B065 | ○ |
| B067 | Brand bible (Ch13) | color roles, wordmark rules, per-section palettes → documented and consumed by the label generator. | M | B027 | ○ |
| B068 | Stocking planner & section balancing (Ch16/21) | seeded LCG placement holding ~4,200 facings / ~70 batches → worst view **≤ 988 draws / 1.38M tris** with 150 SKUs. | L | B003,B065,B021 | ◑ |
| B069 | Section fit-out parametrization (Ch14) | freezer/bakery/produce/wine/merch/pharmacy as data-driven fixtures → sections rebuild from config, colliders correct. | L | B004 | ◑ |
| B070 | Signage & wayfinding (Ch14) | aisle numbers, section banners, floor markers → every aisle labeled and readable from spawn. | M | B069 | ○ |
| B071 | Decals & set-dressing (Ch14) | price tags, endcaps, spills, clutter props → no bare fixtures; batch budget respected. | M | B069,B068 | ○ |
| B072 | Time-of-day system (Ch15) | day/dusk/night lighting presets → 3 presets swap key/fill/HDRI intensity with no perf regression. | L | B009 | ○ |
| B073 | Weather (Ch15) | exterior rain/clear affecting lot + window light → rain toggles on the lot, zero indoor perf hit. | M | B072 | ○ |
| B074 | Skyline / parallax exterior (Ch15) | night lot (8 cars, lamps, crosswalk, corral, skyline) + parallax polish → lot reads as outdoors through the entrance. | S | B004 | ◑ |
| B075 | PA announcements (Ch18) | periodic store PA + "cleanup on aisle" tip callouts → PA plays on tip and on timer, ducks under SFX. | M | B032 | ○ |
| B076 | Adaptive music / stingers (Ch18) | light bed + per-mode win/fail stingers → stinger on checkout/fail; bed respects mute. | M | B032 | ○ |
| B077 | Draw-budget enforcement at scale (Ch21) | CI budget gate wired to the 150-SKU world → build **fails** if any anchor > 988 draws / 1.38M tris. | M | B021,B068 | ○ |
| B078 | LOD / distance culling (Ch21) | far merch/produce simplified or culled → back-wall view stays within budget. | M | B068 | ○ |
| B079 | Physics determinism & seeding (Ch22) | route spawn jitter through the seeded LCG for replays → same seed → identical spill layout. | M | B023,B016 | ○ |

**Wave 4 roll-up:** 15 items — S×1, M×9, L×4, XL×1 = **304 h**.

**Exit criteria.** A full 150-SKU store, every section fit-out and signed, day/night + weather working, brands consistent — and the worst camera anchor still renders inside the documented **988 draws / 1.38M tris / ~70 batches / ~4,200 facings** envelope, enforced by CI (B077).

**Perf-gate ritual PG-4 (the shipping envelope).** worst anchor **≤ 988 draws / ≤ 1.38M tris**; p95 **≤ 20 ms** high-tier desktop, **≤ 28 ms** lite-tier iGPU floor; budget CI gate green on every PR.

---

### 25.7 Wave 5 — Ship (accessibility, onboarding, input breadth, testing/CI, release/ops, sharing)

Wave 5 makes it *shippable to everyone*: onboarding, accessibility, gamepad/touch, the test/CI/perf-gate machinery, telemetry that respects the no-backend default, and the release candidate.

| ID | Item (Ch) | Scope → Done-when | Sz | Deps | St |
|---|---|---|---|---|---|
| B080 | Interactive tutorial run (Ch10) | guided first run: look/move/grab/checkout → new profile auto-starts the tutorial, skippable. | M | B013,B007 | ○ |
| B081 | Coach-mark system (Ch10) | contextual first-use callouts → each new mechanic shows once, dismissible, persisted. | S | B015,B080 | ○ |
| B082 | Contextual tips (Ch10) | situational hints (near checkout, after a crash) → tips fire ≤ once/run, reduced-motion safe. | S | B014,B080 | ○ |
| B083 | Colorblind palettes (Ch11) | deuter/prot/trit-safe HUD + list checks → list ✓/○ and hover glow distinguishable in 3 CVD sims. | M | B008,B060 | ○ |
| B084 | Bark / PA captions (Ch11) | on-screen subtitles for every bark/PA line → each audible line has a caption when captions are on. | M | B028,B075 | ○ |
| B085 | Reduced-motion mode (Ch11) | damp shake/bob/hit-stop/flash → `prefers-reduced-motion` (or toggle) removes camera shake + flash. | S | B024,B029 | ○ |
| B086 | High-contrast HUD (Ch11) | alt HUD theme + larger text → HUD passes WCAG AA contrast in high-contrast mode. | S | B008 | ○ |
| B087 | FOV/sensitivity/text-scale sliders (Ch11/8) | camera + UI tuning → sliders persist and apply live (FOV 60–100). | S | B060,B015 | ○ |
| B088 | Gamepad support (Ch8) | full play on a controller (look/move/grab/menu) → complete a run using only a pad. | M | B005,B006 | ○ |
| B089 | Control remapping (Ch8) | rebind KB/pad in settings → rebinds persist and drive input. | M | B060,B088 | ○ |
| B090 | Touch controls (Ch8) | on-screen sticks + tap-grab → playable on a touchscreen. | L | B006 | ○ |
| B091 | Gamepad rumble (Ch9) | haptics on shake events → rumble scales with `physics.shake` when a pad is present. | S | B088,B024 | ○ |
| B092 | Share card (Ch12) | canvas result image (score/stars/time) → results "share" produces a downloadable PNG. | M | B061,B064 | ○ |
| B093 | Local leaderboard & history (Ch12) | per-mode best + recent runs, no-backend → bests persist and rank locally. | M | B015,B064 | ○ |
| B094 | Unit tests (Ch23) | physics thresholds, scoring, retarget sanity, LCG → suite green in CI, covers core invariants. | L | B023,B041,B025 | ○ |
| B095 | Smoke / boot test (Ch23) | headless boot asserts `__ready`, no `__err`, tier resolves → fails the build on any boot error. | M | B022,B001 | ○ |
| B096 | Perf-regression gate (Ch23) | CI runs framebuffer-grid + budget/frame-time asserts → PR blocked on > 5% draw/tri or p95 regression. | M | B022,B077 | ○ |
| B097 | CI pipeline (Ch23/24) | lint/build/test/perf/deploy stages → a green pipeline on `main` gates release. | M | B094,B095,B096 | ○ |
| B098 | Build & hosting (Ch24) | `vite build`, static host, cache headers → ships a self-contained static bundle. | S | B001 | ✅ |
| B099 | Error capture → telemetry (Ch24) | `window.__err` surfacing + opt-in client log → boot errors captured; no PII; no-backend default. | S | B098 | ◑ |
| B100 | Analytics events (Ch24) | opt-in run/mode/funnel events via event bus → events emit locally; batched export is consent-gated. | M | B014,B101 | ○ |
| B101 | Privacy / consent (Ch24) | first-run consent, default OFF, local-only → nothing leaves the device without explicit opt-in. | S | B015 | ○ |
| B102 | Versioning & changelog (Ch24) | semver + in-game version + CHANGELOG/CREDITS → build stamps version; save migrations key to it. | S | B015,B097 | ○ |
| B103 | Cross-browser / device pass (Ch23/21) | Chromium/Firefox/Safari + iGPU floor + tablet → playable and within perf on all targets. | L | B090,B096 | ○ |
| B104 | Localization scaffold (Ch11/6) | externalize UI strings + caption keys → swapping a locale file translates UI + captions. | M | B084,B057 | ○ |
| B105 | Definition-of-Done audit (Ch26) | final DoD checklist across all waves → every shipped item meets the Ch. 26 DoD. | M | (all prior) | ○ |
| B106 | Release candidate & sign-off (Ch24/26) | RC build + PG-5 + go/no-go → PG-5 passes, zero open P0/P1. | M | B105,B097 | ○ |

**Wave 5 roll-up:** 27 items — S×10, M×14, L×3, XL×0 = **298 h**.

**Exit criteria.** A first-timer is onboarded, a colorblind or reduced-motion player is fully served, a controller/touch player can finish a run, CI blocks any perf or boot regression, telemetry is opt-in only, and an RC clears PG-5 with no P0/P1 open.

**Perf-gate ritual PG-5 (release).** PG-4 numbers **hold** on Chromium + Firefox + Safari + one iGPU-floor laptop + one touch tablet; reduced-motion and caption paths verified; telemetry confirmed opt-in only; zero P0/P1 defects.

---

### 25.8 The shared perf-gate ritual (run at every wave exit)

Every PG-N runs the **same 7 steps**; only the numeric targets tighten (PG-1 → PG-5 table below).

1. **Cold boot** on the iGPU-floor profile (DPR clamp 1.25). Wait for `window.__ready`; assert `window.__err === undefined`.
2. **Tier resolves** — read `window.__tier`; must land in `{high, lite-locked, panic}` within 80 frames (the `autoQuality` window is frames 20–80).
3. **Framebuffer-grid capture** at the **7 anchors** (teleport via `__camera`): spawn `world.spawn`; aisle-4 head (x −6, z 3); freezer wall (x −22, z 0, look +x); checkout ring (−7.65, 11.1); produce corner (x −18, z 11); merch TV wall (z −14.6, look −z); night lot (entrance, look out). Diff each thumbnail vs golden.
4. **Draw/tri budget** — at the worst anchor assert `renderer.info.render.calls` and `.triangles` against the wave target.
5. **Frame-time** — sample `dt` over 300 frames at the worst anchor; assert p95 against target.
6. **Destruction stress** — 3 sprint-tips; assert debris caps at **100**, returns to baseline after the **28 s** TTL, heap within 5% of pre-stress.
7. **Session soak** — 5-minute mixed session; assert no growing heap and no new `__err`.

| Gate | Wave | Worst anchor draws | Worst anchor tris | p95 frame (floor) | Extra |
|---|---|---|---|---|---|
| PG-1 | Foundation | ≤ 1100 | ≤ 1.6M | ≤ 24 ms | boot clean, tier resolves |
| PG-2 | Presence | ≤ 1050 | ≤ 1.5M | ≤ 22 ms | debris cap + TTL stable |
| PG-3 | Modes | no regression vs PG-2 | — | — | transitions < 50 ms, save/load < 50 ms |
| PG-4 | World | **≤ 988** | **≤ 1.38M** | ≤ 20 ms high / ≤ 28 ms floor | CI budget gate green |
| PG-5 | Ship | ≤ 988 (all browsers) | ≤ 1.38M | ≤ 20/28 ms | 3 browsers + laptop + tablet; a11y verified |

### 25.9 The critical path

Dependencies force one longest serial chain from first commit to sign-off. Two co-critical tracks converge on B106.

**Primary CP (engine → modes → sign-off):**
B001 (12) → B003 (30) → B004 (72) → B005 (12) → B007 (30) → B035 (30) → B053 (12) → B054 (30) → B055 (72) → B105 (12) → B106 (12) = **324 h serial**.

**Co-critical world/CI track (runs in parallel, near-equal length):**
B003 → B018 (12) → B043 (4) → B065 (72) → B068 (30) → B077 (12) → B096 (12) → B103 (30) → B106 = **~184 h** downstream of B003.

Implications: **B004 (store shell)** and **B055 (40 shifts)** are the two XL boulders on the primary path — start B004 on day one and stand up the shift *engine* (B053/B054) early so authoring (B055) can fan out to a second author without blocking. **B065 (150 SKUs)** is the world track's boulder and should begin the moment B018/B027/B043 land, in parallel with the modes track. The perf gates (B077→B096→B103) are the last serial fuse before B106 — they cannot be parallelized away.

### 25.10 Chapter coverage matrix

Proof that all 24 chapters' `[BUILD]` markers are discharged (no chapter unmapped):

| Ch | Items | Ch | Items |
|---|---|---|---|
| 1 | B019, B020 | 13 | B027, B066, B067 |
| 2 | B035–B040 | 14 | B004, B069, B070, B071 |
| 3 | B048, B053–B056 | 15 | B072, B073, B074 |
| 4 | B041–B046 | 16 | B018, B043, B065, B068 |
| 5 | B045, B047–B052 | 17 | B025, B028, B030, B033, B034 |
| 6 | B056–B061, B104 | 18 | B026, B032, B075, B076 |
| 7 | B008, B046, B062, B063 | 19 | B012–B016 |
| 8 | B005, B006, B087–B090 | 20 | B017, B018 |
| 9 | B024, B029, B085, B091 | 21 | B002, B009, B010, B021, B068, B077, B078 |
| 10 | B080–B082 | 22 | B023, B031, B079 |
| 11 | B083–B087, B104 | 23 | B022, B094–B097, B103 |
| 12 | B064, B092, B093 | 24 | B011, B098–B102, B106 |

### 25.11 Total effort roll-up

| Wave | Items | S | M | L | XL | Hours (mid) | Range |
|---|---|---|---|---|---|---|---|
| 1 Foundation | 22 | 5 | 12 | 4 | 1 | 356 | 232–564 |
| 2 Presence | 12 | 2 | 7 | 1 | 2 | 266 | 172–420 |
| 3 Modes | 30 | 10 | 17 | 2 | 1 | 376 | 244–592 |
| 4 World | 15 | 1 | 9 | 4 | 1 | 304 | 206–464 |
| 5 Ship | 27 | 10 | 14 | 3 | 0 | 298 | 192–464 |
| **Total** | **106** | **28** | **59** | **14** | **5** | **1600** | **1048–2152** |

**Interpretation.** Midpoint **~1600 h**; edge-to-edge **1048–2152 h**. The ✅ v1 spine already banks **~448 h** (B001–B012, B023–B027, B042, B098), so **remaining ≈ 1152 h**.

- **Solo dev @ 30 productive h/week:** ~53 person-weeks total / **~38 weeks remaining** (~9 months).
- **2-dev team @ 60 h/week:** ~27 weeks total / **~19–20 weeks remaining** (~4.5 months), which is calendar-bound by the ~324 h critical path plus the perf-gate fuse, not by raw hours.
- **Reserve:** carry a **20% contingency** on Waves 3–5 (the ○-heavy waves), because scoring/economy tuning (B041–B048) and the 40-shift + 150-SKU authoring (B055, B065) are the highest-variance line items — both XL, both content fan-outs, both on or beside the critical path.

Recommended cadence: one wave ≈ one milestone, each milestone *ends* on its green perf gate (PG-1…PG-5). Do not open the next wave until the current PG is green — the whole point of starting in the lite tier and holding the 988-draw envelope is that presence, modes, and 98 new SKUs each get *added on top of a proven floor*, never at the cost of it. See **Ch. 26** for the per-item Definition-of-Done and QA sign-off that B105/B106 audit against.



# Chapter 26 — Risks, QA Plan & Definition of Done

This is the closing chapter of the playbook. It exists so that any engineer, artist, or producer can answer three questions without a meeting: *what could go wrong and who owns it* (26.1–26.3), *how do we prove the build is good* (26.4–26.12), and *when are we actually done* (26.13–26.16). Every number here is tied to a shipped constant in the codebase (`src/main.js`, `src/game.js`, `src/physics.js`, `src/stock.js`, `src/sfx.js`, `src/store.js`) so QA can assert against ground truth, not vibes. Where this chapter cites a budget it is a *gate*: a build that misses it does not ship until the owner-role signs a documented waiver.

Cross-references: the wave structure lives in Ch. 25; module boundaries in Ch. 19; data schemas in Ch. 20; rendering/perf internals in Ch. 21; physics spec in Ch. 22; the automated test harness and CI in Ch. 23; release/ops/telemetry in Ch. 24; accessibility requirements in Ch. 11; catalog SKUs in Ch. 16.

### 26.1 How to read the risk register

Each risk carries six fields. **Likelihood** and **Impact** are 1–5. **Severity** is their product (1–25), bucketed: 1–6 Low (accept + watch), 7–12 Medium (mitigate this wave), 13–18 High (mitigate before the wave closes; blocks DoD), 19–25 Critical (blocks any release; escalate to Producer same day). **Leading indicator** is the *earliest observable signal* — the thing QA or telemetry sees before players do. **Mitigation** is the concrete, already-designed countermeasure. **Owner-role** is the single throat to choke.

Owner-role legend: **TL** Tech Lead · **GFX** Rendering Engineer · **GP** Gameplay Engineer · **PHYS** Physics Engineer · **ART** Content/Art Lead · **AUD** Audio · **QA** QA Lead · **UX** UX/Accessibility · **LEG** Legal/Compliance · **OPS** DevOps/Release · **PROD** Producer.

### 26.2 Expanded risk register (22 risks)

| # | Cat | Risk | L | I | Sev | Leading indicator | Mitigation (shipped or planned) | Owner |
|---|-----|------|---|---|-----|-------------------|---------------------------------|-------|
| R1 | Perf | Sustained sub-30 fps on the Intel-iGPU floor (UHD-620 class) | 4 | 5 | **20 C** | `autoQuality` sampling window (frames 20–80) yields avg frame time > 0.055 s → `tier='panic'` set on `window.__tier` | Progressive tiering already ships: start **lite** (no GTAO, rect-lights off, half the spot shadows, DPR ≤ 1.25); upgrade to **high** only if 60-frame avg < 0.020 s; on avg > 0.055 s drop `setPixelRatio(1)` and resize composer. Add a hard visual floor (26.7). | GFX |
| R2 | Tech | First rendered frame freezes for seconds while shaders compile on the iGPU | 3 | 4 | **12 M** | Gap between `manager.onLoad` and first `requestAnimationFrame` > 500 ms | Already mitigated: `renderer.compile(scene, camera)` runs behind the boot overlay under the "Preparing shaders…" message before `boot` is hidden. QA asserts the boot→playable gap. | GFX |
| R3 | Tech | Pointer-lock denied in sandboxed iframes / embedded previews → game appears frozen | 4 | 5 | **20 C** | `pointerlockerror` fires, or lock never confirmed within the 350 ms fallback timer | Already mitigated: `enableFallback()` switches to drag-to-look (`0.0042 rad/px`, pitch clamped ±1.45) and still starts `SFX`; the click handler force-arms fallback after 350 ms even when no error fires. Must be verified in an actual cross-origin iframe. | GP |
| R4 | Tech | WebGL context loss on low-VRAM iGPU → black screen, no recovery | 2 | 5 | **10 M** | `webglcontextlost` event; `window.__err` populated; blank canvas with running RAF | Add a `webglcontextlost`/`restored` handler that pauses the loop and shows the boot overlay with a reload CTA. Today an uncaught throw only surfaces the red `<pre>` error panel (`main.js` catch). | GFX |
| R5 | Perf | Big gondola spill hitches the frame it happens (56-item burst) | 3 | 4 | **12 M** | Single-frame dt spike > 0.05 s coinciding with a `tipGondola` call | Already mitigated: spills are queued and drained at `SPAWNS_PER_FRAME = 9`; `dt` is clamped to 0.05 s in the loop so one hitch can't cascade the simulation. QA measures the worst frame during a scripted tip. | PHYS |
| R6 | Perf | Debris accumulation grows draws/tris and raycast cost over a long session | 3 | 4 | **12 M** | `world.physics.debrisMeshes.length` approaches `DEBRIS_CAP = 100` and stays there | Already mitigated: hard cap 100 (evict oldest resting piece, else oldest); resting clutter fades after `DEBRIS_TTL = 28 s`; grab-raycast only tests debris within 20 m² (`ddx²+ddz² < 20`) of the camera via `_nearDebris`. | PHYS |
| R7 | Tech | Frozen shadow maps go stale after a gondola tips (moved geometry casts a ghost shadow) | 3 | 3 | **9 M** | Visible shadow of an upright aisle remaining after it has fallen | Shadows are frozen at frame 3 (`shadow.autoUpdate = false`). On a tip, set the affected spot's `shadow.needsUpdate = true` for one frame, or accept the ghost as a known cosmetic limit and document it. Currently unhandled. | GFX |
| R8 | Tech | Instanced-stock grab hides the wrong facing (instanceId mis-resolution) | 2 | 4 | **8 M** | Player presses E and a *different* box vanishes; list count doesn't advance | `stock.resolve()` maps `hit.object.userData.specId` + `hit.instanceId` → handle and rejects already-hidden handles. Covered by the stock unit test (Ch. 23). Add a fuzz test that grabs 500 random facings and asserts 1:1 hide. | GP |
| R9 | Tech | three.js addon import paths break on a minor r160→r161+ bump | 3 | 3 | **9 M** | `npm run build` fails resolving `three/examples/jsm/...` (PointerLockControls, GTAOPass, UnrealBloomPass, OutputPass, EffectComposer) | Pin `three@^0.160.1` in `package.json` and `package-lock.json`; treat three upgrades as their own wave with a full regression pass. Never float the pin. | TL |
| R10 | Content | Placeholder / lorem copy leaks into a shipped build (violates the realism goal) | 3 | 4 | **12 M** | Grep for `lorem`, `TODO`, `placeholder`, `xxx`, `FIXME` in `src/**` and canvas label strings returns hits | Every SKU in `products.js` already carries a real brand/name/weight/price. Add a CI string-scan gate (Ch. 23) that fails the build on placeholder tokens. | ART |
| R11 | Content | Photoscan kit absent → produce/props silently fall back to procedural boxes | 3 | 3 | **9 M** | `hasModel()` returns false for `prod_apple`…`prop_wineshelf`; produce corner renders as canvas boxes | `preloadModels` is a documented no-op without a kit; `buildProduct` falls back cleanly. Ship the kit in `public/assets/models/kit/` and assert the manifest count at boot; QA verifies the 8 photoscans (apple/lemon/avocado/banana/onion/sweetpotato/tins/croissant) load. | ART |
| R12 | Content | Rocketbox retargeter produces a numerically exploded pose (limbs to infinity) | 2 | 4 | **8 M** | A walker avatar renders as a spike/starburst; NaN in a bone matrix | The custom rotation-delta retargeter already runs a numeric pose sanity gate (rejects out-of-range deltas). Add a per-avatar boot assertion that every bone quaternion is finite before the first frame. | GP |
| R13 | Content | Label-texture cache grows unbounded (52 SKUs × `_w` wrap variants) | 2 | 2 | **4 L** | Heap snapshot shows `_texCache` size climbing past ~104 entries | `_texCache` is keyed by `spec.id (+'_w')`, so it is naturally bounded at ≤ 104 `CanvasTexture`s and every facing of a SKU shares one. Accept + watch; no action unless the catalog grows past Ch. 16's 150-SKU ceiling. | ART |
| R14 | Perf | DPR > 1.25 on 4K/Retina panels tanks fill rate before tiering can react | 3 | 3 | **9 M** | `devicePixelRatio` > 1.25 at boot on a high-res panel | Already mitigated: `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25))` clamps at boot; panic tier further drops to 1.0. QA runs the device matrix at 1440p and 4K. | GFX |
| R15 | Perf | Memory growth over a 30-min session (textures, debris meshes, flyers) | 2 | 4 | **8 M** | JS heap climbs monotonically across 20+ checkout→reroll cycles | Flyers are spliced on completion; debris capped + faded; textures cached not re-created. Add a soak test (26.7) asserting heap returns to within +15% of baseline after 20 rerolls. | TL |
| R16 | UX | Motion sickness from head-bob + camera shake (photosensitivity risk) | 3 | 4 | **12 M** | Playtest reports of nausea; shake stacks (`addShake` caps at 1.0 but fires often) | Head-bob amplitude is small (0.03 walk / 0.045 run) and shake decays at `1.6/s`. Ship a **Reduce Motion** toggle (Ch. 11) that zeroes bob and clamps `shake` to 0; honor `prefers-reduced-motion`. Currently no toggle exists — build in Wave 8. | UX |
| R17 | Legal | Asset attribution incomplete for a hosted build (CC0 / MIT / Poly Haven / Rocketbox) | 2 | 5 | **10 M** | `CREDITS.md` diff lags a new asset added under `public/assets/` | Maintain `CREDITS.md` as the ledger; add a CI check that every file under `public/assets/models/` and `/env/` has a matching credit line. Rocketbox is MIT, Poly Haven CC0 — both permit redistribution *with* attribution. | LEG |
| R18 | Legal | Fake brand name collides with a real registered trademark | 2 | 4 | **8 M** | Legal review flags a `brand` string in `products.js` (e.g. Vixel, Fizz, Northfield, PlayBox) | All 52 brands are invented. Run a trademark screen on the full brand list before 1.0; keep names generic/descriptive; document that packaging is original canvas art, not a mark parody. | LEG |
| R19 | Legal | Web-audio starts without a user gesture (autoplay-policy violation / console error) | 2 | 2 | **4 L** | Console `AudioContext was not allowed to start` warning | Already mitigated: `SFX.start()` is only ever called from a user gesture (pointer-lock `lock` event or `enableFallback`), and `ensure()` resumes a suspended context. Verify on Safari, which is strictest. | AUD |
| R20 | Scope | Feature creep breaks the no-backend / single-loop invariant (multiplayer, accounts, server scores) | 3 | 4 | **12 M** | A PR introduces `fetch`/WebSocket/persistence to a non-optional path | The invariant is: browser, no backend by default; any backend is strictly optional + additive (Ch. 24). PROD gates scope at wave planning; CI greps for network calls outside an explicitly-flagged optional module. | PROD |
| R21 | Scope | "One more section" store expansion pushes past the draw-call budget | 3 | 3 | **9 M** | Worst-view draw count creeps above the ~988 draws / 1.38 M tris ceiling | New fixtures must reuse the merge/instance patterns (box products collapse to 2 draw groups; checkout parts merge 30→5). Any section add requires a fresh perf pass before merge. | GFX |
| R22 | Input | No gamepad support + AZERTY/Dvorak users can't move (hardcoded `KeyW/A/S/D`) | 2 | 3 | **6 L** | Support reports "movement doesn't work"; keyboard layout ≠ QWERTY | Movement already accepts arrow keys as an alias (`ArrowUp/Down/Left/Right`), giving a layout-independent fallback. Document arrows in onboarding; gamepad is out of 1.0 scope (Ch. 8). | GP |

### 26.3 Risk scoring worked example

R3 (pointer-lock in iframes): Likelihood 4 (embedding is a primary distribution channel), Impact 5 (game looks broken to a first-time player). Severity = 4 × 5 = **20 → Critical**. Because the mitigation already ships (`enableFallback` + 350 ms force-arm), R3 stays open only as a **verification** item, not a build item: it blocks DoD until QA has confirmed drag-look in a real cross-origin sandboxed iframe on all four target browsers. This is the register's core rule — *a designed mitigation reduces the build risk to a verification risk, and verification risks still gate the DoD.*

Portfolio snapshot: 2 Critical (R1, R3), both with shipped mitigations pending verification; 0 unmitigated Critical; 9 Medium; the rest Low. A release with any **unmitigated** High or Critical is a no-ship (26.16).

---

### 26.4 QA plan — the five pass types

QA runs five distinct pass types. Each has an owner, a trigger cadence, an artifact it produces, and a pass/fail gate. They are deliberately different in depth so we don't pay for a full regression on every commit.

| Pass | Depth | Trigger cadence | Owner | Artifact | Gate |
|------|-------|-----------------|-------|----------|------|
| **Smoke** | ~5 min, happy path only | Every PR (CI) + every dev build | QA + CI | Green/red check + boot screenshot | Blocks merge |
| **Full regression** | ~60 min, every system | End of each wave; nightly on `main` | QA | Filled test-matrix sheet | Blocks wave DoD |
| **Performance** | Scripted, instrumented | End of each wave; before any release; on any renderer/physics PR | GFX/PHYS | Frame-time + draw-call report vs. budget | Blocks release |
| **Accessibility** | Manual + automated audit | Before 1.0; on any HUD/input/motion change | UX | A11y audit sheet (Ch. 11) | Blocks 1.0 |
| **Input/hardware** | Device matrix sweep | Before 1.0; on any input/control PR | QA | Device matrix pass grid | Blocks 1.0 |

### 26.5 Smoke pass (happy-path, every PR)

A build fails smoke if *any* of these is false. All are scriptable against `window.__*` hooks.

1. Boot overlay reaches 100% (`bootbar.style.width === '100%'`) and hides within 2 s of `manager.onLoad`.
2. `window.__ready === true` and `window.__err` is undefined.
3. `window.__STORE` equals `{ w: 46, d: 30, h: 4.2 }`.
4. `window.__stock.counts.skus === 52` and `.instances` matches the stocking total (~4,200 facings).
5. Click arms play: either `__isPlaying()` true via pointer-lock **or** `__isFallback()` true within 400 ms.
6. WASD moves the camera; `__playerVel` becomes non-zero while a key is held.
7. A shopping list of exactly 6 rows renders in `#list`.
8. Aiming a stocked facing shows the glow box and the `#prompt` "E take" line.
9. Pressing E hides the facing, decrements availability, flies a mesh (0.4 s) and advances the list count on a match.
10. Completing all 6 shows the checkout ring and the "List complete" banner.
11. Standing within 2.2 m of checkout with a complete list fires the checkout banner with total, item count, and time.
12. Pressing R after checkout rerolls a fresh list and hides the banner.
13. Pressing M toggles mute (master gain 0.45 ↔ 0).
14. No uncaught console errors during steps 1–13.

### 26.6 Full regression pass (per-wave, nightly)

Extends smoke with every system's edge behavior. Enumerated groups:

- **Movement/collision:** bounds clamp at store edges; walking into a fixture blocks the axis; the "stuck" escape (`hitC` on current pos lets you walk out) works; sprint (Shift, 4.9 m/s) vs. walk (3.1 m/s) both feel correct; arrow-key aliases move identically to WASD.
- **Grab:** grab a facing; grab a photoscan produce item; grab a floor debris piece (reuses its mesh, un-tumbles rotation); grab an item **not** on the list (flies, no count change); grab the last facing of a SKU (SKU drops out of `availableSpecs`).
- **Physics — carts:** shove a cart (momentum transfer ×1.15); cart-vs-cart collision (×0.7 exchange); cart bounces off a fixture; cart tips on a > 2.6 m/s wall crash (rotation.z → ±1.42, y → 0.25) with a CRASH_LINE toast; cart clamped inside bounds.
- **Physics — knock:** walk-crash a gondola at ≥ 1.6 and < 4.0 m/s → 1+⌊speed⌋ items knocked loose, thud, 40% billing added; `crashCd` 0.45 s prevents re-trigger spam.
- **Physics — tip:** sprint-crash a gondola at ≥ 4.0 m/s → whole aisle pivots to ~87° over 0.85 s, 56-item spill queued, collider mutates to fallen footprint, `crash` SFX + shake 0.9 + "CLEANUP ON AISLE n" toast; a second hit on a tipped gondola is a no-op.
- **Debris lifecycle:** ballistic fall under 9.8 m/s², floor bounce (v.y ×−0.28), settle to resting, tick SFX on hard landings, fade + removal at 28 s, cap enforced at 100.
- **NPC:** 6 walkers (2 push carts), 2 browsers, 5 staff present; player bump at < 0.66 m and rel > 0.6 shoves NPC (shoveCd 1.3 s), plays a BUMP_LINE toast, pauses their path; retargeted walk cycle looks human (pose gate).
- **Damage accounting:** knocked/spilled items bill at `price × 0.4`; the checkout banner itemizes count + total; a clean run shows no damage line.
- **Reroll integrity:** after R, list regenerates from currently-available specs, checkout ring hidden, timer resets, banner cleared.

### 26.7 Performance pass (instrumented, budgeted)

Run headless-scripted with `window.__renderer.info` and a frame-time probe. All budgets are hard gates.

| Metric | Budget (min spec) | Budget (rec spec) | Source of truth |
|--------|-------------------|-------------------|-----------------|
| Steady-state frame time, idle view | ≤ 33.3 ms (30 fps) | ≤ 16.7 ms (60 fps) | loop `dt` |
| Frame time, worst view (TV wall + open aisles) | ≤ 40 ms | ≤ 18 ms | `dt` p95 |
| Auto-tier decision | reaches `lite-locked` or `panic` by frame 80; never oscillates | reaches `high` (avg < 0.020 s) | `window.__tier` |
| Worst-view draw calls | ≤ 988 | ≤ 988 | `renderer.info.render.calls` |
| Worst-view triangles | ≤ 1.38 M | ≤ 1.38 M | `renderer.info.render.triangles` |
| Single-frame spike during a 56-item gondola tip | ≤ 50 ms | ≤ 25 ms | `dt` at tip |
| Debris count ceiling under stress | ≤ 100 | ≤ 100 | `debrisMeshes.length` |
| Boot → playable (incl. shader compile) | ≤ 8 s | ≤ 4 s | `onLoad`→hint show |
| 20-reroll soak heap growth | ≤ +15% of baseline | ≤ +15% | heap snapshot |
| DPR at boot | ≤ 1.25 (clamped) | ≤ 1.25 | `getPixelRatio()` |

**Hard visual floor (new, R1):** if `panic` tier still exceeds 40 ms for 120 consecutive frames, disable bloom and freeze NPC animation updates. Document the degraded look as acceptable-of-last-resort; the game must remain *playable* (list→grab→checkout) at 24 fps on the floor device.

### 26.8 Accessibility pass (blocks 1.0)

Per Ch. 11, verified manually + with an automated contrast/roles audit:

- **Reduce Motion** toggle exists, persists, and (a) zeroes head-bob, (b) forces `shake = 0`, (c) honors `prefers-reduced-motion` on first load. (R16 — build in Wave 8.)
- Crosshair, `#list`, `#timer`, `#prompt`, `#banner`, and `#toast` all meet ≥ 4.5:1 text contrast against worst-case backgrounds.
- Every control has a discoverable label: onboarding hint lists "Drag to look · WASD move · E take item · M mute" and arrow-key movement.
- No information is conveyed by color alone (the list uses ✓/○ glyphs plus color).
- Audio is non-essential: the full loop is completable muted; no puzzle depends on sound.
- No content flashes faster than 3 Hz (crash shake decays at 1.6/s and caps at 1.0 amplitude → sub-flash).
- Keyboard-only completion is possible in fallback mode (drag-look is pointer, but pointer-lock mode + arrows covers keyboard-look via mouse; document the residual limitation).

### 26.9 Input / hardware pass (blocks 1.0)

Matrix-swept across devices (26.10). For each device:

- Pointer-lock engages on click; ESC releases; re-click re-locks.
- In an embedded/sandboxed iframe, fallback drag-look arms within 350 ms and look sensitivity (0.0042 rad/px) is usable.
- Pitch clamps at ±1.45 rad (no camera flip); roll stays 0.
- WASD **and** arrow keys move; Shift sprints; E/R/M respond.
- Trackpad drag-look is usable (no acceleration runaway).
- High-DPI panel clamps DPR to 1.25.
- Touch-only device: documented as unsupported for 1.0 (no on-screen controls) — must fail gracefully with a "desktop/laptop recommended" note, not a black screen.

### 26.10 Device / browser matrix (min & rec specs)

| Class | CPU | GPU | RAM | OS/Browser | Res / DPR | Target tier | Target fps |
|-------|-----|-----|-----|-----------|-----------|-------------|-----------|
| **Floor (min)** | Dual-core ≥ 2.0 GHz | Intel UHD 620 / equivalent iGPU | 4 GB | Win10, Chrome 110+ / Edge 110+ | 1280×720, DPR 1.0–1.25 | lite-locked → panic | ≥ 30 (≥ 24 hard floor) |
| **Mainstream** | Quad-core | Intel Iris Xe / Apple M1 iGPU | 8 GB | Win11 / macOS 13, Chrome/Edge/Safari 16+ | 1920×1080, DPR 1.25 | lite-locked / high | 60 |
| **Recommended** | 6-core | Discrete GTX 1650+ / M2+ | 16 GB | Win11 / macOS 14, latest Chrome/Firefox/Edge/Safari | 1920×1080–1440p, DPR 1.25 | high | 60 (v-sync) |
| **Firefox** | any of above | any | ≥ 8 GB | Firefox 115+ | 1080p | matches class | matches class |
| **Safari** | Apple silicon | Apple GPU | ≥ 8 GB | Safari 16.4+ (WebGL2, WebAudio gesture-gated) | 1080p–Retina | matches class | matches class |

Browsers explicitly in scope for 1.0: **Chrome, Edge, Firefox, Safari** (desktop/laptop). Explicitly out of scope: mobile/touch, IE, WebView-only embeds without pointer or WebAudio.

### 26.11 Test cadence summary

| Trigger | Smoke | Full regression | Perf | A11y | Input/HW |
|---------|:---:|:---:|:---:|:---:|:---:|
| Every PR (CI) | ✅ | — | — | — | — |
| Renderer/physics PR | ✅ | ✅ (affected group) | ✅ | — | — |
| Input/HUD/motion PR | ✅ | ✅ (affected group) | — | ✅ | ✅ |
| Nightly on `main` | ✅ | ✅ | ✅ (min spec) | — | — |
| Wave close | ✅ | ✅ | ✅ | (Wave 8+) | (Wave 8+) |
| Release candidate | ✅ | ✅ | ✅ (full matrix) | ✅ | ✅ |

---

### 26.12 Launch checklist (66 binary items)

Every item is true/false. RC ships only when all 66 are checked or carry a PROD-signed waiver. Grouped by area.

**Content (12)**
1. All 52 SKUs render with correct label, price, weight, and section.
2. All 8 photoscan produce/prop models load (apple, lemon, avocado, banana, onion, sweetpotato, tins, croissant).
3. All 9 sections stock without empty shelves or clipping facings.
4. No placeholder/lorem/TODO strings in any shipped label or UI (CI string-scan green).
5. 13 avatars load (6 walkers, 2 browsers, 5 staff) with finite bone poses.
6. Checkout lanes, freezer wall (10 doors), bakery wall, produce corner, wine nook all present.
7. Merch half present: TV wall, 2 cross-grain gondolas, 6 apparel racks, toys island + ball bin, pharmacy counter.
8. Night lot present: 8 Kenney cars, lamps, crosswalk, corral, skyline.
9. Fog color/near/far match spec (0x11151a, 24→46).
10. Every barcode/price tag legible at grab distance.
11. Toast/banner copy is final voice (BUMP_LINES ×5, CRASH_LINES ×3, cleanup line).
12. Impulse racks, gumball machines, plants, bag stands dressed at checkout.

**Tech (18)**
13. `npm run build` produces a clean production bundle, no warnings that fail CI.
14. `three` pinned at `^0.160.1`; lockfile committed.
15. Boot overlay, progress bar, and hint all function.
16. Shader precompile runs behind boot; no first-frame freeze > 500 ms.
17. Pointer-lock path works (lock/unlock/relock).
18. Fallback drag-look arms in real cross-origin sandboxed iframe (R3 verified).
19. `window.__ready` true; `window.__err` undefined on all matrix devices.
20. WebGL context-loss handler pauses + offers reload (R4).
21. All `window.__*` debug hooks present for verification.
22. Instanced stock grab hides the correct facing across a 500-grab fuzz.
23. Debris cap holds at 100 under stress; TTL fade at 28 s works.
24. Gondola tip mutates collider to fallen footprint; player can walk the new space.
25. Frozen-shadow staleness after a tip is handled or documented (R7).
26. No memory leak: 20-reroll soak heap within +15% baseline.
27. `dt` clamp (0.05 s) prevents post-hitch simulation blowups.
28. Auto-tier resolves by frame 80 and does not oscillate.
29. Resize handler updates camera, renderer, composer, and GTAO sizes.
30. No uncaught exceptions across a 10-minute soak on the floor device.

**UX (14)**
31. Onboarding hint shows on boot and after fallback arms, then fades.
32. Shopping list HUD renders top-left with ✓/○ + prices + progress footer.
33. Timer HUD updates once per second, top-right.
34. Prompt shows correct state (item name/price/E, "finish list first n/m", checkout).
35. Checkout banner shows items, total, damages (when any), time, and "R for new list".
36. Glow highlight fits the aimed product and follows rotation.
37. Reduce-Motion toggle present and effective (bob + shake) (R16).
38. Mute (M) toggles cleanly, state obvious to the player.
39. Crosshair visible only while playing.
40. Sprint vs walk is perceptibly different and readable.
41. Grab fly-to-basket animation reads clearly at 0.4 s.
42. All HUD elements meet 4.5:1 contrast (a11y pass green).
43. No control dead-ends: player can always reach a completable state.
44. Error panel (`<pre>`) only appears on a real fatal, never in normal play.

**Perf (8)**
45. Floor device: ≥ 30 fps steady, ≥ 24 fps worst view.
46. Rec device: 60 fps steady.
47. Worst-view draws ≤ 988, tris ≤ 1.38 M.
48. Gondola-tip frame spike within budget (≤ 50 ms floor / ≤ 25 ms rec).
49. DPR clamped ≤ 1.25 on all panels incl. 4K.
50. Panic tier engages and keeps the floor device playable.
51. Boot→playable ≤ 8 s floor / ≤ 4 s rec.
52. Perf report attached to the RC with per-device numbers.

**Legal (8)**
53. `CREDITS.md` covers every shipped asset (models, textures, HDRI, avatars).
54. CI attribution check green (every asset has a credit line) (R17).
55. Rocketbox MIT + Poly Haven CC0 + Kenney CC0 terms satisfied for a hosted build.
56. Trademark screen of all 52 brand names complete, no conflicts (R18).
57. No real-brand packaging parody; all label art original.
58. WebAudio only starts from a user gesture on all browsers, Safari included (R19).
59. Photosensitivity: no > 3 Hz flashing; documented.
60. Privacy: build ships no PII collection; telemetry (if any) is opt-in + documented (Ch. 24).

**Ops / Release (6)**
61. Static hosting config serves `.hdr`, `.glb`, `.jpg`, `.png` with correct MIME + caching (Ch. 24).
62. Bundle size + asset payload within the documented budget.
63. Versioned release tag + changelog cut.
64. Rollback path documented (previous build one command away).
65. Smoke test runs green against the *deployed* URL, not just local.
66. Post-launch telemetry/error sink (or manual bug intake) live before announce.

---

### 26.13 Definition of Done — per wave

DoD is *measurable*: each wave closes only when its criteria are objectively true, its slice of the launch checklist is green, and smoke + the relevant full-regression group pass. Waves map to Ch. 25.

| Wave | Scope | Measurable DoD (all must hold) |
|------|-------|--------------------------------|
| **W0 — Boot & renderer** | Renderer, camera, boot UI, error trap | `WebGLRenderer` up with DPR ≤ 1.25, ACES tone-mapping, PCF soft shadows; boot bar reaches 100% and hides; `renderer.compile` runs behind boot; `window.__err` trap renders the `<pre>` panel on a forced throw; FOV 62, near 0.1, far 100 confirmed. |
| **W1 — Store shell & env** | Room 46×30×4.2, HDRI, fog, lights | HDRI environment loads; fog 0x11151a/24/46; all fixtures placed; `window.__STORE` exact; walls/bounds clamp the player; ≥ half the spotlights present with shadow-freeze at frame 3. |
| **W2 — Catalog & stocking** | 52 SKUs, instanced facings | `__stock.counts.skus === 52`; ~4,200 facings across ~70 batches; box products collapse to 2 draw groups; every SKU has label + price tag + weight; `availableSpecs()` returns all grabbable SKUs; grab hides exactly one facing (500-grab fuzz clean). |
| **W3 — Core loop** | List → grab → checkout → reroll | 6-item list generates from available stock; E grabs with 0.4 s fly; list count advances only on matches; checkout ring appears at completion; checkout within 2.2 m fires the banner with total + count + time; R rerolls; M mutes; timer formats mm:ss. |
| **W4 — Arcade physics** | Carts, debris, gondolas, damage | Cart shove/collision/tip work; knock at ≥1.6 & <4.0 m/s; tip at ≥4.0 m/s → ~87° over 0.85 s, 56-item spill drained at 9/frame, collider mutates; debris cap 100 + TTL 28 s; damage bills at 40% and itemizes at checkout; worst tip frame within perf budget. |
| **W5 — Characters & NPC AI** | 13 avatars, retargeting, bumping | 6 walkers (2 carts) + 2 browsers + 5 staff render with finite poses (sanity gate); retargeted walk reads human; player bump < 0.66 m & rel > 0.6 shoves + pauses NPC with a BUMP_LINE; no NaN bones across a 5-min soak. |
| **W6 — Audio & game-feel** | Procedural SFX, shake, bob | All 8 SFX fire on their events (grab/tick/listDone/checkout/error/thud/crash/clatter) + store hum; master 0.45, mute→0; shake decays 1.6/s, caps 1.0; head-bob amplitudes correct; all audio gesture-gated. |
| **W7 — Perf & tiering** | Progressive quality, budgets | lite→high upgrade on avg < 0.020 s; panic on avg > 0.055 s (DPR→1.0); tier resolves by frame 80, no oscillation; floor device ≥ 30 fps; worst view ≤ 988 draws / 1.38 M tris; boot→playable ≤ 8 s floor; soak heap ≤ +15%. |
| **W8 — Onboarding, HUD & a11y** | Hints, HUD polish, accessibility | Onboarding hint + arrow-key docs; Reduce-Motion toggle zeroes bob + shake and honors `prefers-reduced-motion`; all HUD ≥ 4.5:1 contrast; muted playthrough completable; a11y audit sheet green. |
| **W9 — Release hardening & ops** | Build, hosting, legal, rollback | Clean production build; hosting MIME/caching correct; `CREDITS.md` + attribution CI green; trademark screen done; deployed-URL smoke green; versioned tag + changelog + documented rollback; all 66 checklist items green or waived. |

### 26.14 Definition of Done — 1.0

Version 1.0 is done when **all** of the following are objectively true:

1. Every wave DoD (W0–W9) is closed with its sign-off recorded.
2. All 66 launch-checklist items are green, or carry a written PROD waiver with an owner and a follow-up ticket.
3. Zero open **Critical** bugs; zero open **High** bugs without a PROD waiver (severity classes in 26.15).
4. Full regression, performance (full device matrix), accessibility, and input/hardware passes are all green on the exact RC bundle.
5. The floor device (Intel UHD-620 class, 1280×720) completes a full list→checkout→reroll loop at ≥ 30 fps steady and never drops below the 24 fps hard floor.
6. The recommended device holds 60 fps steady.
7. A cross-origin sandboxed iframe embed is fully playable via fallback drag-look (R3 verified).
8. Deployed-URL smoke test is green and a documented one-command rollback exists.
9. Legal sign-off: attribution complete, trademark screen clean, no photosensitivity/autoplay violations.
10. `window.__err` is undefined across a 10-minute soak on every matrix browser.

If any single item fails, 1.0 does not ship; it becomes a dated RC-n with the failing item as the blocker.

---

### 26.15 Post-launch support policy

**Bug severity classes & SLA.** SLA clocks start at triage confirmation (target: triage within 1 business day of report).

| Class | Definition | Example | Acknowledge | Fix target | Ship vehicle |
|-------|-----------|---------|-------------|-----------|--------------|
| **S1 Critical** | Game unplayable for a broad set of users; data/asset load fails; hard crash on boot | Black screen on Chrome stable; pointer-lock + fallback both dead | 4 business hours | Hotfix ≤ 48 h | Out-of-band patch |
| **S2 High** | Core loop broken for some users or on a supported device; major perf regression | Floor device stuck < 20 fps; checkout never completes on Safari | 1 business day | ≤ 5 business days | Next patch (expedited) |
| **S3 Medium** | Noticeable defect with a workaround; cosmetic on a key surface | Ghost shadow after a tip; a SKU label mis-renders | 3 business days | Next scheduled patch | Biweekly patch |
| **S4 Low** | Minor cosmetic / polish; rare edge case | Debris settles slightly clipped; a bark repeats | Best effort | Backlog / when-touched | Monthly patch or bundled |

**Patch cadence.**
- **Hotfix (S1):** as needed, out of band; single-fix, re-runs smoke + the affected regression group + a floor-device perf spot-check before deploy; rollback ready.
- **Biweekly patch:** rolls up S2/S3 fixes; requires full regression + perf (min spec) green.
- **Monthly release:** S4 rollups + small content/polish; full regression + full device-matrix perf + a11y spot-check.
- **Quarterly:** dependency review (notably the pinned `three@0.160.1` — any bump is its own mini-wave with a full regression + perf pass per R9), license/attribution re-audit, and a soak-test refresh.

**Regression guard.** Every fix ships with (a) the smallest repro added to the automated suite where feasible (Ch. 23), and (b) a note in the changelog. No S1/S2 fix merges without a green smoke on the deployed URL. A patch that regresses any perf budget in 26.7 is rolled back, not forward-fixed.

**Intake & triage.** Bugs enter through the error sink / issue tracker (Ch. 24). Each is stamped with class, owner-role (26.1), affected device class (26.10), and the checklist item (26.12) or wave DoD it violates, so support, engineering, and QA share one vocabulary from report to fix to verification.

### 26.16 Sign-off / ship decision (RACI)

The go/no-go is a single meeting with a fixed rule: **any unmitigated High or Critical risk (26.2), any red launch-checklist item without a PROD waiver, or any failed 1.0 DoD criterion is an automatic no-ship.**

| Decision | Responsible | Accountable | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Wave DoD close | Wave owner-role | TL | QA | PROD |
| Perf budget waiver | GFX | TL | PHYS, QA | PROD |
| Legal clearance | LEG | PROD | ART, TL | all |
| Accessibility clearance | UX | PROD | QA | all |
| 1.0 go/no-go | PROD | PROD | TL, QA, LEG, UX | all |
| S1 hotfix ship | OPS | TL | QA | PROD |

The reference build for all of the above is the code that ships today: the tiered renderer, the 52-SKU instanced catalog, the three-system arcade physics, the 13-avatar NPC layer, and the procedural-audio game-feel described across Ch. 1–25. This chapter does not add features; it defines the fence around them.
