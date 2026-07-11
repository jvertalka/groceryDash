# GROCERY DASH 3D — The Production Playbook

> **What this document is.** The definitive design and engineering bible for Grocery
> Dash 3D — how the finished game works, functions, looks, feels, and operates.
> It is written against the shipped codebase in `game/` (not aspirationally against
> a blank page): every system below either exists today or is specified precisely
> enough to build without further design work. Where a section describes something
> not yet built, it is marked **[BUILD]**; unmarked systems are live.
>
> **How to use it.** Treat it as the contract. PRs either implement a [BUILD]
> section, tune a live one, or amend this document first.

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

# PART 1 — GAME DESIGN & GAMIFICATION

*Production Playbook — Section 4. Owns: the fun. What the player does with the store that `store.js` builds, the physics that `physics.js` lets them break, and the reasons they come back tomorrow. Everything here runs client-side against the existing three.js loop; anything needing a server is called out with a local-first fallback.*

## 1.1 Vision, Pillars, Fantasy, Tone

**Vision statement.** *Grocery Dash 3D* is a supermarket you are allowed to take too seriously and not seriously enough at the same time. It is a photoscanned, 4,200-facing, fully-shoppable big-box store where a six-item list is a legitimate speedrun, a full sprint is a demolition tool, and the checkout receipt is the scoreboard. We are shipping the arcade racing game that happens to be set in a grocery store — precision lines, risk/reward on every corner, a leaderboard clock — wearing the skin of the most mundane errand on Earth.

**The player fantasy** is *mastery of a boring space.* Everyone has walked a supercenter. Almost no one has walked one *well* — knowing that Marinara is aisle 3, that the produce corner is a five-second detour off the checkout line, that you can carry momentum through the action alley at z ≈ 8 and cut the whole grocery half in one arc. We turn spatial familiarity into skill. The second fantasy, unlocked by holding Shift, is *sanctioned vandalism*: the store is load-bearing, tippable, billable, and it forgives you at a price.

**Design pillars (4).** Every feature is justified against these; if it serves none, it is cut.

1. **The store is a racetrack.** Layout is memorizable and exploitable. Routing is the core skill. The 46×30 m footprint, the four grocery islands at x = −18/−14/−10/−6, the cross-grain merch gondolas, and the single checkout ring at (−7.65, 11.1) are a *track*, not a backdrop. Good design gives the player reasons to learn the racing line.
2. **Everything reacts, everything bills.** The world is honest: it never fakes a collision and never eats a consequence silently. A knocked can (`spec.price × 0.4`) shows on the receipt. This is the source of all tension — the player is always trading time against damage.
3. **Readable at a sprint.** At `SPEED_RUN = 4.9 m/s` with camera shake and 988 draws on screen, the player must still parse the list, the prompt, and the aim glow. HUD, audio, and highlight design are held to "legible at speed" as a hard requirement, not a nicety.
4. **One more run.** The genome is seeded and short. A run is 60–360 seconds. The meta-layer (grades, daily seed, unlocks, streaks) must always dangle a next attempt that's one click and zero load away — we already reseed instantly on `R`.

**Tone.** Deadpan-competent front-of-house over slapstick back-of-house. The store's *voice* (aisle signs, "EVERYDAY" price tags, WELCOME mat) plays it completely straight — a real supercenter that believes in itself. The *physics* voice is the comedian: `"CLEANUP ON AISLE 3 — ALL OF IT."`, `"That's coming out of your deposit."`, `"Excuse YOU."` The gap between the two is the whole joke. No fourth-wall gags, no memes with a shelf life; the humor is situational and generated, so it never gets old and never dates the build.

## 1.2 Mode Lineup

Six modes, one shared simulation. Each is a *ruleset object* layered over the existing loop — it configures list length, timer direction, crowd density, damage-billing on/off, win/lose predicate, and the scoring weights in §1.4. No mode forks the renderer.

### Career / Shift Mode (the spine)
Structured campaign of ~40 hand-authored **Shifts** (the scenarios in §1.3), grouped into five **Ranks**: *Cart Pusher → Stocker → Team Lead → Assistant Manager → Store Manager*. Each Shift is a mission with a par time, a mission twist, and 3 star-objectives. Stars gate the next Rank (need 60% of available stars to advance). Damage billing **on**.
- **Win:** all mission objectives met before fail condition.
- **Lose:** timer expiry (if timed), damage over the Shift's *ceiling* (a hard cap, e.g. $50 → instant "You're fired for the day"), or a scenario-specific fail (dropped the escort, missed the rush window).
- **Duration:** 90–360 s. **Curve:** Rank 1 lists are 4 items, one department, empty store, no damage ceiling. Rank 5 lists are 8–10 items across both halves, full crowd, damage ceiling $18, and a live twist. See tuning table §1.7.

### Time Attack
Single seeded list, race the clock. The list, item spawn availability, and crowd are fixed by the seed so two players get an identical track. Timer counts **up** (as it does today); you're chasing a target/ghost. Damage billing **on** but soft — damage adds *seconds* (a flat +1.5 s per damaged item) instead of a fail, keeping it a pure race.
- **Win/Lose:** no lose; you always finish, you just place. **Duration:** 45–120 s. **Curve:** three fixed tracks — *Sprint* (4 items, grocery only), *Circuit* (6 items, both halves), *Marathon* (10 items, full store, forces a pharmacy-corner + freezer-wall + toys-island triangle).

### Chaos Mode
The pillar-2 sandbox with the sign flipped: destruction is the objective. Score is **mayhem**, not shopping. Tip gondolas (`TIP_SPEED = 4.0` — sprint into the base), bowl carts into fixtures, trigger `hideInRegion` spills, stagger NPCs. Every point of `damageTotal`, every tipped island (the 56-item spill), every cart casualty and NPC bark scores. A 3-minute timer; a "Heat" multiplier that climbs while you keep destroying and decays when you stop, à la a combo meter. Damage billing is repurposed as the score source, not a penalty.
- **Win:** beat the seed's target mayhem score. **Lose:** none. **Duration:** 180 s fixed. **Curve:** self-selected — restraint is boring, so the mode teaches the physics thresholds by rewarding them.

### Zen Shopping
No timer, no billing, no fail. Ambient WebAudio bed only (still no music track — we layer store tone: distant PA chime, cooler hum near the freezer wall, cart rattle). The list refreshes on completion (`R`), damage is auto-forgiven and debris fades on the existing 28 s TTL. This is the onboarding sandbox and the "I just want to walk around the pretty store" mode. It also serves accessibility: the mode disables camera shake and lowers `SPEED_RUN` to walk speed.
- **Win/Lose:** none. **Duration:** open. Doubles as the **tutorial**: first Zen session runs the contextual prompt ladder (look → E to grab → fill list → walk to ring).

### Daily Run
One scenario per calendar day, one *ranked* attempt, globally identical. This is the retention engine and it needs **no backend** (see §1.6): the day's seed is `dateSeed = YYYY*10000 + MM*100 + DD`, fed to the same LCG the store already uses (`seed = (seed*16807) % 2147483647`). Same seed → same list, same crowd spawns, same twist, same sale tags. Your score and grade are stored in `localStorage`; a 6-character **share code** (base-32 of score+grade+seed) lets friends verify each other without a server. Optional server leaderboard is a drop-in (§1.6).
- **Win/Lose:** it's scored, not pass/fail — you get a grade and it locks for the day. **Duration:** ~120 s. **Curve:** rotates twist-of-the-day from the §1.3 pool so the daily never feels like yesterday.

### Endless (Register Rush)
Back-to-back lists with a bleeding clock. Start at 60 s. Complete a list → bank it, +12 s, next list spawns immediately (reusing `reset()`), each list one item longer than the last starting from 4, crowd density ramps every third list. Damage billing **on** and it *costs time* (−0.5 s per dollar). Run ends when the clock hits zero.
- **Win:** none — it's a high-score chase. **Lose:** clock zero. **Duration:** emergent, typically 2–6 min. **Curve:** the ramp *is* the curve — the interesting failure is greed (a top-shelf sprint grab that tips an aisle and eats your banked time).

## 1.3 Scenario / Mission Briefs

Structure for each: **Setup** (world state), **Twist** (the rule that makes it not a plain shop), **Objectives** (★ = star; base clear is implicit), **Scoring** (what this brief weights). All are authored against real geometry — coordinates below are live from `store.js`. Twenty-two briefs; Career draws ~40 Shifts by re-skinning these with different lists/ranks.

1. **Opening Shift.** *Setup:* empty store, doors just opened. *Twist:* none — the clean-line teacher. *Obj:* 4-item single-department list. ★ under par, ★ zero damage, ★ no wrong grabs. *Scoring:* speed-weighted.
2. **Rush Hour.** *Setup:* max crowd (13 NPCs, all 6 walkers active, 2 pushing carts). *Twist:* NPC density doubles in the action alley (z ≈ 8); bumping costs a 0.8 s stagger to *you* too. *Obj:* 6 items. ★ Pacifist (0 bumps), ★ under a tight par. *Scoring:* accuracy + pacifist bonus heavy.
3. **Black Friday.** *Setup:* every endcap and pallet is a "doorbuster"; sale tags everywhere. *Twist:* required items are *only* on endcaps/pallets (the cut-case trays at gondola ends) and NPCs actively path to the same endcaps and deplete stock — `availableSpecs()` shrinks live. *Obj:* grab 8 before rivals clear them. ★ beat the crowd to all 8. *Scoring:* speed brutal, damage cheap (chaos is thematic).
4. **Freezer-Aisle Power Outage.** *Setup:* freezer wall (left wall, 10 doors) LEDs cut; that zone goes dark, emissive-only. *Twist:* frozen items on the list glow only within `REACH`; you shop the wall by feel. Production change: freezer stock becomes grabbable (currently `grabbable:false`) and doors open on proximity. *Obj:* pull 3 frozen SKUs (pizza/icecream) in the dark. ★ no wrong door. *Scoring:* precision.
5. **Health Inspector Visit.** *Setup:* inspector NPC (re-skinned pharmacist rig) patrols a route. *Twist:* any debris on the floor when the inspector is within 8 m = a violation strike; 3 strikes fail. You must shop *clean* and can press **Q** to re-shelve nearby debris (new verb, §1.8). *Obj:* full list, ≤1 violation. ★ zero violations. *Scoring:* damage penalty tripled.
6. **Kids' Birthday Sweep.** *Setup:* toys island (19.5, −2), ball bin (17.2, 6), bakery back wall. *Twist:* themed list locked to toys + cake + balloons; the ball bin spills 26 instanced balls as rolling hazards if bumped. *Obj:* 6 party items. ★ don't spill the ball bin. *Scoring:* routing across the far-right corner.
7. **Elderly Assist Escort.** *Setup:* an escort NPC follows you at walk speed. *Twist:* you can't sprint (escort can't keep up — sprint for >2 s drops them, fail); you fetch *their* list and lead them from spawn to pharmacy (18.5, 10.4). *Obj:* 5 items + deliver escort to counter. ★ escort never lost, ★ zero bumps near escort. *Scoring:* patience; time par is generous, penalties for jostling.
8. **Spill on Aisle 3.** *Setup:* aisle 3 (x = −10) pre-tipped at load — the fallen-footprint collider is already in place, 56 items on the floor. *Twist:* your list items are *in* the spill (grabbable debris), racing the 28 s fade TTL before they despawn. *Obj:* recover 4 buried items before they fade. ★ recover all before any fades. *Scoring:* pure speed vs. TTL.
9. **Price Check.** *Setup:* normal store. *Twist:* the list shows *prices, not names* — you must know the catalog ($4.29 = Honey Oats, $379 = the 55" TV) to grab the right SKU. Wrong-price grabs are mispicks. *Obj:* 6 items by price. ★ zero mispicks. *Scoring:* accuracy only, no clock pressure.
10. **Restock the Endcaps.** *Setup:* several endcaps pre-emptied. *Twist:* inverse loop — carry items *from* full shelves *to* target endcaps using **Q** drop. *Obj:* stock 3 endcaps to quota. *Scoring:* trip efficiency.
11. **Lane 6 Is Closed.** *Setup:* the closed lane (x = −1, red ✕). *Twist:* the normal checkout ring is disabled; a *roaming* express-checkout marker relocates every 20 s among the 5 open lanes — you finish where it currently is. *Obj:* full list + hit the moving ring. *Scoring:* reaction routing.
12. **Two-Cart Tango.** *Setup:* both cart-pushing NPCs run tight loops in the grocery aisles. *Twist:* their carts are live physics bodies; a collision tips *your* run's momentum and scatters stock. *Obj:* 6 items without a cart collision. ★ shove a rival cart into the corral (style). *Scoring:* evasion + a style bounty.
13. **The Perfectionist.** *Setup:* clean store, no crowd. *Twist:* zero-tolerance — one damaged item OR one mispick ends the run. *Obj:* flawless 8-item list. ★ under par while flawless. *Scoring:* S-grade or bust.
14. **Sample Day.** *Setup:* a demo cart NPC parks in the action alley handing out samples; a crowd clots around it. *Twist:* the alley is blocked; you must route *around* the merch-half long way, learning the east loop. *Obj:* 6 cross-store items. *Scoring:* routing knowledge.
15. **Wine & Dine.** *Setup:* wine nook (−21.9, −11.2, back-left). *Twist:* fragile list — wine/jars, doubled damage value, so a single bump is expensive. *Obj:* 5 fragile items intact. ★ zero damage. *Scoring:* careful play, damage penalty ×2.
16. **The Grand Sweep.** *Setup:* full store, full crowd. *Twist:* 10-item list forcing all four corners — freezer wall, produce corner (−17.7, 10.7), pharmacy (18.5, 10.4), toys (19.5, −2). The true routing exam. *Obj:* 10 items under a stretch par. ★ single continuous route (no backtrack past checkout). *Scoring:* everything, balanced.
17. **Cleanup Crew.** *Setup:* store littered with debris from a "previous shift." *Twist:* dual objective — shop your list *and* re-shelve N debris (Q). *Obj:* 5 items + clear 12 debris. *Scoring:* multitask.
18. **Slippery When Wet.** *Setup:* wet-floor cones near freezers. *Twist:* a defined wet zone reduces friction — momentum carries further, harder to stop before a shelf (raises effective crash speed, more tips). *Obj:* shop the frozen/dairy list without a tip. *Scoring:* control.
19. **VIP Shopper.** *Setup:* you *are* the demanding customer. *Twist:* a running "patience" bar drains; grabbing correct items refills it, wrong grabs/backtracks drain it faster. Bar empty = fail. *Obj:* finish before patience runs out. *Scoring:* momentum/flow.
20. **Inventory Night.** *Setup:* store lights at half, few NPCs, moody. *Twist:* no list card — you're handed items one at a time (reveal-next-on-grab), can't plan a route ahead. *Obj:* 8 sequential items. *Scoring:* reactive routing + memory.
21. **The Speedrun (Any%).** *Setup:* Time Attack's Circuit track, formalized as a Shift. *Twist:* none — the pure clock, ghost of the dev best overlaid. *Obj:* beat the ghost. *Scoring:* time only.
22. **Manager's Final.** *Setup:* Rank-5 capstone. *Twist:* a live *random* twist from briefs 2–20 drawn by seed, undisclosed until you spawn. *Obj:* 8 items, damage ceiling $12, meet the mystery twist. ★ S-grade. *Scoring:* mastery of all systems.

## 1.4 Scoring Economy

One score function, weights set per mode. Computed at checkout in `complete()`, extending today's `total`/`damage` readout.

**Components.**
- **Item Value.** `IV = requiredItemsFound × 1000`. (Base clear of a 6-item list = 6,000.)
- **Speed Bonus.** Each mode defines `T_par`. `SB = round(clamp((T_par − T) / T_par, −0.5, 1) × 4000)`. Beating par by ≥100% caps at +4000; finishing at 1.5× par floors at −2000. Continuous, so shaving a second always matters.
- **Combo / Flow.** A **Flow** meter drives a live multiplier. Each correct list grab adds +34 flow; flow decays at −10/s. Multiplier tiers by flow: `0–33 → 1.0×`, `34–66 → 1.5×`, `67–99 → 2.0×`, `100 (max) → 3.0×`. A wrong grab, a gondola tip, or an NPC bump **resets flow to 0**. The multiplier applies to `IV` per item *at the moment of grab*, so a clean, fast, unbroken run compounds — a flawless 6-item chain banks up to ~14,000 vs. 6,000 for a stop-start clear. This is the single biggest skill expression in the score.
- **Style Bonus.** Trick dictionary, evaluated from physics events (all already emitted by `physics.js`):
  | Trick | Trigger | Points |
  |---|---|---|
  | Clean Sweep | list complete, `damage.count === 0` | +1500 |
  | Pacifist | 0 NPC bumps all run | +600 |
  | Aisle Runner | sprint a full 16 m island length, no collision | +400 |
  | Cart Curler | shove a cart ≥6 m into a corral collider | +500 |
  | Buzzer Grab | last item grabbed within `REACH` while already inside the checkout ring | +300 |
  | Cold Open | grab a frozen SKU within 0.5 s of the door opening | +250 |
  | No-Look | complete without the aim glow ever settling >0.3 s on a wrong SKU | +350 |
- **Damage Penalty.** `DP = damage.total × 12` points per dollar (that's the same 40%-of-price debris cost, now scored). In fragile briefs, ×24.
- **Mispick Penalty.** `MP = wrongGrabs × 150` (grabbing a non-list item, tracked in `tryGrab` when `entry` is null).

**Final:** `Score = Σ(itemValue × flowMultAtGrab) + SB + StyleBonus − DP − MP`, floored at 0.

**Grades.** Each mode ships a `parScore`. Grade by ratio `r = Score / parScore`:

| Grade | Ratio | Meaning |
|---|---|---|
| **S** | r ≥ 1.15 | mastery — near-perfect line, high flow, no damage |
| **A** | r ≥ 1.00 | par — clean competent run |
| **B** | r ≥ 0.82 | fine — some friction |
| **C** | r ≥ 0.62 | messy but done |
| **D** | r < 0.62 | you shopped; the store suffered |

The banner already renders time and damage; production adds a large centered grade letter (color-keyed: S = gold `#ffd23b`, A = green `#35c46a`, down to D = red `#c9241a`), the score with a count-up tween, and a one-line breakdown (IV / speed / style / −penalties).

## 1.5 Progression & Meta

**XP & Levels.** Every run grants `XP = round(Score / 20) + gradeBonus` (S:+300, A:+150, B:+60, C:+20, D:+5). Levels 1–50 on a soft curve `xpToNext(L) = 200 + 90·L^1.35`. Levels are the drip that unlocks *access* to cosmetics in the shop (gating purchases), not power.

**Currency: Carts (₵).** `earned = round(Score / 100) × (1 + 0.5·isDaily)`. Sinks below. Career star-objectives and first-time achievement pops pay lump ₵ bounties (200–1000). Nothing purchasable affects scored-mode outcomes — cosmetics are cosmetic, and the two *modifiers* that touch the sim (below) carry a scoring handicap so the leaderboard stays clean.

**Unlockables (₵ + level-gated).**
- **Cart skins** (the pushable cart mesh & your basket-flyer): chrome (default), matte black, gold, "rusty loyalty cart," neon-wire, wood-crate. 300–1500 ₵.
- **Hand / grab FX:** the fly-to-basket trail — default sparkle, comet, cash-register burst, freezer-frost, confetti. 200–800 ₵.
- **Highlight glow color** (the aim box, today `#9fdcff`): pick from unlocked palette. 150 ₵ each.
- **Store cosmetic themes** (re-tint of the whole interior, seed-stable): *Grand Opening* (default), *Golden Hour* (warm exposure + amber troffers), *After Hours* (the Inventory-Night look), *Retro '80s* (magenta/cyan carpet zones, chrome). 2000–4000 ₵. Purely a re-color of existing materials — zero new draws.
- **Cosmetic aisle vanity:** name a saved "home store" and pin your best daily grade to the entrance mural.
- **Modifiers (opt-in handicaps):** *Damage Insurance* (halves DP, −10% final score), *Sprint Boost* (`SPEED_RUN` 4.9→5.6, +5% par difficulty). Flagged on the leaderboard so runs are comparable.

**Achievements (34).** Name — trigger. All checkable from existing event emissions.
1. *First Cart* — finish any run. 2. *Clean Sweep* — a run with 0 damage. 3. *Full Basket* — 100 total items grabbed. 4. *Grand Total* — cumulative $2,500 rung up. 5. *Speed Demon* — sub-45 s Circuit. 6. *S-Tier* — first S grade. 7. *Untouchable* — Pacifist ×5 runs. 8. *Demolition Man* — tip 10 gondolas (lifetime). 9. *Cleanup Crew* — re-shelve 50 debris. 10. *Cart Curler* — land the 6 m corral shove. 11. *Cold Blooded* — Cold Open trick. 12. *Aisle Whisperer* — clear Aisle 3 spill before any item fades. 13. *Regular* — 7-day daily streak. 14. *Local Legend* — 30-day daily streak. 15. *Frequent Flyer* — 50 dailies played. 16. *No Backsies* — Grand Sweep single-route star. 17. *Priced In* — Price Check with 0 mispicks. 18. *Bull in a China Shop* — $100 damage single run (Chaos). 19. *Butterfingers* — drop 20 items lifetime. 20. *Escort Service* — Elderly Assist with escort never lost. 21. *Perfect Attendance* — clear all Rank-1 Shifts. 22. *Middle Management* — reach Assistant Manager. 23. *Store Manager* — complete Career. 24. *Freezer Burn* — pull 3 frozen in the blackout brief. 25. *Wine Snob* — Wine & Dine with 0 damage. 26. *Combo Breaker* — hit max Flow (3.0×). 27. *Marathoner* — Marathon track finish. 28. *Register Rush 500* — Endless score 500k. 29. *Window Shopper* — 30 min in Zen. 30. *Completionist* — every SKU grabbed at least once (52). 31. *Sale Hunter* — grab 25 endcap items. 32. *Ghost Buster* — beat the dev ghost on Any%. 33. *Rainbow Cart* — own all cart skins. 34. *Manager's Pet* — S-grade the Manager's Final.

**Daily/Weekly without a backend.** Detailed in §1.6.

## 1.6 Economy Loop & the No-Backend Retention Layer

**Source/sink balance.** A median B-grade daily nets ~150 ₵ + streak bonus; the cheapest cosmetic is 150 ₵ (one good run = one small unlock), the flagship store theme is 4000 ₵ (~20–30 runs or a full daily week with streak bonuses). Career star bounties front-load ~6,000 ₵ across the campaign so a solo-Career player still earns 2–3 marquee cosmetics. There is no ₵ source that isn't play; there is no sink that isn't cosmetic. This makes the whole economy tunable by two constants (`Score/100` earn rate, price table) with zero balance risk to the leaderboard.

**Retention, all client-side (default build).** The game already ships a seeded LCG (`seed = (seed*16807) % 2147483647`) and rebuilds the world deterministically. We reuse it:
- **Daily seed** = `date → seed`, driving list, twist, crowd, sale tags. Everyone worldwide gets the identical track with no server round-trip.
- **Profile** in `localStorage`: XP, level, ₵, owned cosmetics, per-mode bests, achievement flags, daily history, current streak. One JSON blob, versioned, ~a few KB.
- **Streaks** computed from the stored last-played date vs. today; a weekly seed (ISO week number) drives a **Weekly Challenge** (a fixed modifier stack, e.g. "fragile lists, no sprint") that grants a badge.
- **Ghosts** stored locally: a ghost is a downsampled camera-path recording (position every 100 ms; ~600 floats/min) so you race your own or the baked dev-best PB with no network.
- **Share codes:** base-32 encode `(seed, score, grade, modifiers)` into a 6–8 char code. Friends paste it to *verify* a claimed daily without any server — the client re-derives the seed and displays "valid: A-grade, 118k." Social proof, zero infra.

**What genuinely needs a backend (optional module).** Global/friend leaderboards, server-authoritative ghost sharing, and cross-device profile sync. Local-first alternative ships by default; the backend is a thin, stateless drop-in: a single serverless function + KV store keyed by `dailySeed`, accepting `{seed, score, grade, ghostHash, modifiers}` and returning top-N. It is *never* required to play, never gates progression, and the client treats it as best-effort (submit-and-forget, read-if-available). No account required — an anonymous device UUID suffices; sign-in is an opt-in upsell for cross-device only. This keeps the "no backend by default" constraint intact while leaving a clean seam for a hosted leaderboard.

## 1.7 Difficulty Systems

Three dials, all data-driven, no code branches per Shift.

**List-length & department scaling** (drives route complexity via `genList`, today a flat random 6):

| Rank / tier | Items | Dept spread | Forces far corners? |
|---|---|---|---|
| 1 Cart Pusher | 4 | 1 dept | no |
| 2 Stocker | 5 | 2 depts | one corner |
| 3 Team Lead | 6 | 3 depts | two corners |
| 4 Asst. Mgr | 8 | 4 depts | three corners |
| 5 Store Mgr | 10 | 5+ depts | all four |

Production upgrades `genList` from "random 6" to a **department-quota sampler**: pick required departments first, then draw SKUs within them from `availableSpecs()`, guaranteeing the route actually crosses the store instead of clustering by luck.

**Dynamic crowd density.** The store has 13 avatars; scenarios scale the *active* count and behavior, not the mesh count (all avatars stay loaded; idle ones stand at `staffSpots`). Density presets: `empty` (0 walkers), `light` (2), `normal` (4), `rush` (6 walkers + 2 cart-pushers, tightened patrol loops in the alley). Rush also shortens `n.shoveCd` and widens the bump radius from 0.66 m so the crowd genuinely obstructs.

**Timer / par tuning.** Par is derived, not hand-guessed: `T_par = walkPathEstimate × 1.15 + items × 1.2 s`, where `walkPathEstimate` is the nearest-neighbor route length through the item positions from spawn (0.6, 13.2) to the checkout ring (−7.65, 11.1) at `SPEED_WALK = 3.1`. The 1.15 gives a competent player headroom; the +1.2 s/item covers aim-and-grab. Endless/Time-Attack expose tighter multipliers (1.0 and 1.05). Because par is computed from geometry, adding a Shift never requires re-tuning a magic number.

## 1.8 Replayability Levers & Risk/Reward

**The central tension** is time vs. damage vs. flow, and every mechanic already in `physics.js` feeds it:
- **The top-shelf sprint grab.** Items on the 1.48 m shelf are slower to reach on foot; a sprint approach saves time but any contact ≥ `KNOCK_SPEED (1.6)` knocks stock loose (−DP, and the bump *resets Flow*). A contact ≥ `TIP_SPEED (4.0)` tips the whole island — catastrophic in Career, jackpot in Chaos. Same action, opposite value by mode. This is the risk/reward engine, and it's already implemented — we're only scoring it.
- **Debris as opportunity.** Knocked items stay grabbable for 28 s. A confident player *deliberately* knocks a needed cluster and scoops it off the floor faster than shelf-picking — a high-skill, high-risk line the TTL keeps honest.
- **Cart as tool or trap.** Shoving a cart (momentum 1.15×) can clear a path or block a rival NPC (style bounty) — but a cart you tip (`vn > 2.6`) is a "cart casualty" that bills you.
- **Damage Insurance modifier.** Buy down the risk (halve DP) at a flat −10% score — a genuine strategic choice, not a power creep, since it can never beat a clean run on the leaderboard.
- **Flow greed.** Because the multiplier peaks at 3.0× and *any* mistake zeroes it, the optimal line is a continuous, contact-free sprint-shop. The tension between "go faster (risk contact, lose flow)" and "protect the chain" is the skill ceiling. Two players with identical routes and times can differ 2× in score purely on flow discipline.

**New verbs to add** (small, HUD/state only): **Q** = re-shelve nearest debris (drives Cleanup/Inspector briefs; reuses `removeDebris` + a reverse of the fly animation). **Tab** = expand objectives/minimap. **Esc** = pause. Everything else stays as shipped.

**HUD zones (exact).** Held to pillar 3. 1280×720 reference, all values responsive-anchored:
- **Top-left (16, 16), 280 px wide:** `#list` shopping-list card (existing) + Flow meter as a thin bar under the footer.
- **Top-center (50%, 16):** par clock — elapsed / `T_par`, turning amber at 0.8× par, red past par.
- **Top-right (−16, 16):** live score (count-up), current Flow multiplier chip (e.g. "2.0×"), ₵ balance.
- **Bottom-center (50%, 62% height, above crosshair):** `#prompt` context line (existing).
- **Screen-center:** `#banner` mission complete/fail + grade card (existing element, extended).
- **Bottom-left (16, −16):** `#toast` stack — physics barks & "CLEANUP" lines (existing), max 3 stacked, 2.6 s decay.
- **Bottom-right (−16, −16), 160×120:** compact department minimap — a static canvas top-down of the 46×30 footprint with department blocks, a player dot, and list-item pings. Cheap (one 2D canvas, redrawn on grab, not per-frame). Hidden in Zen.

**Key bindings (final).** `W/A/S/D` + arrows move · `Shift` sprint · `E` take · `Q` re-shelve/return · `R` new list / retry (when done) · `M` mute · `Tab` objectives + map · `Esc` pause. Pointer-lock primary, drag-look fallback — both already shipped and both must keep working, since the embedded-preview fallback path is how the game guarantees it always plays.

**Why it replays.** The store is fixed and knowable (you *can* master the track); the list, twist, crowd, and daily seed are variable (the track is never the same twice); the grade and Flow ceiling are always just out of reach (there's always a cleaner line); and the next attempt is one `R` away with zero load. That loop — memorize the space, get punished for greed, chase the S — is the whole game, and every system in this section exists to keep feeding it.


---

# PART 2 — UX, UI, CONTROLS, ACCESSIBILITY & GAME FEEL

This section is the interaction bible for *Grocery Dash 3D*. It assumes the shipping architecture from the rest of the playbook: three.js r160 + Vite, single page, no backend, progressive quality tiers with an Intel-iGPU floor. Everything here is designed to survive on the panic tier and cost nothing that would bust the ~988-draw budget. The current build already establishes the load-bearing conventions — a 62° FOV pinhole camera, `PointerLockControls` with a drag-look fallback, a five-element DOM HUD (`#list`, `#timer`, `#prompt`, `#banner`, `#toast`), procedural WebAudio SFX, and a bespoke arcade physics layer that tips aisles and bills you for the wreckage. The production target keeps all of that and closes the gaps: presence (you have no body today), input parity (keyboard-only today), a real front-end flow (there is no title or results screen today — the run just resets on `R`), and an accessibility layer that the motion-heavy feel demands.

## Design Pillars & the Diegetic Line

Three pillars govern every UX decision:

1. **The store is the interface.** Wayfinding, feedback, and comedy should live in the world before they live in a panel. A tipped gondola is a better "you screwed up" message than a red toast — but we keep the toast because arcade legibility beats purity.
2. **Legible chaos.** The fantasy is *speed plus destruction*. The player must always parse, in one glance, three things: what to grab, where to go, how badly they are wrecking the place. Anything that muddies those three loses.
3. **Zero-friction restart.** This is a seed-and-repeat arcade loop. Boot-to-playing is ≤1 gesture after assets load; results-to-next-run is one key. No menu should ever be more than two inputs deep.

**Diegetic vs. HUD split.** We draw a hard line. *Diegetic* (rendered in-world, obeys lighting/occlusion): the cart and its item pile, aisle number signs, the checkout ring, price/sale tags, the destruction itself, the tutorial staffer. *HUD* (screen-space DOM overlay, always readable): shopping list, timer, interaction prompt, damage meter, combo ticker, compass strip, minimap, toasts, banners, crosshair. The rule for deciding: if it answers "where/what is in the world," push it diegetic or onto the compass; if it answers "what is my run state," it's HUD. We deliberately keep HUD as DOM rather than rendered-to-texture — it's crisper on iGPUs, costs zero draws, scales with the accessibility font slider for free, and is trivially themeable for colorblind modes.

## Front-End Flow & Screen Wireframes

The app is a small state machine layered over the existing render loop. States: `BOOT → TITLE → MODE → COUNTDOWN → RUN → RESULTS → (RUN | TITLE)`, plus `PAUSE` and `SETTINGS` as overlay states that suspend `RUN` without tearing it down. All screens except `RUN` are DOM overlays composited over a live, slowly-orbiting camera view of the store (a cheap "attract" dolly using the frozen shadow maps — no extra draws, just a moving camera), so the world is never a black void behind a menu.

**Typography scale** (single modular scale, root 16px, ratio ~1.25, all `-apple-system, "Segoe UI", Roboto`):

| Token | px | Weight | Use |
|---|---|---|---|
| `display` | 52 | 800 | Title logo, grade stamp |
| `h1` | 34 | 800 | Banner time, results total |
| `h2` | 22 | 700 | Screen headers, timer |
| `body-lg` | 16 | 600 | Prompts, toasts, buttons |
| `body` | 13.5 | 500 | List rows, results lines |
| `label` | 11.5 | 600, +1.4px tracking | Panel captions ("SHOPPING LIST") |
| `micro` | 11 | 500 | Foot notes, seed string |

A global `--ui-scale` (0.85–1.4, from the accessibility slider) multiplies every token via `font-size: calc(var(--tok) * var(--ui-scale))`.

### BOOT
Reuse the current `#boot`: centered logo `GROCERY DASH 3D` (`display`, the "3D" at 0.5 opacity), a 260×5px progress bar filling on `LoadingManager.onProgress`, status line cycling `Lighting… → Loading models… → Building store… → Preparing shaders… → Ready`. The shader-compile storm is paid here behind the curtain (already implemented via `renderer.compile` in `onLoad`). **Motion:** bar eases width over 0.3s; on ready, boot fades opacity→0 over 0.65s and `display:none`. No spinner — the bar is the honesty.

### TITLE
Full-bleed attract camera. Centered stack: logo (`display`), a one-line tagline, and a vertical button column — **PLAY** (primary, green `#35c46a` fill), **HOW TO PLAY**, **SETTINGS**, **CREDITS**. Bottom-right: build hash + `MIT/CC0 assets` micro-credit. Bottom-left: last run's grade chip if one exists ("Last: B · 1:42"). **Input:** any of click / `Enter` / gamepad `A` / tap advances to MODE. **Motion:** buttons stagger-fade up 12px over 0.25s, 40ms apart; hover/focus lifts 2px and brightens border.

### MODE SELECT
A horizontal card row (3–4 cards, keyboard/stick navigable, focused card scales to 1.04 and gains a green outline):

- **Classic Dash** — 6-item list, no timer pressure, damages billed. The default.
- **Time Attack** — same list, a countdown target with medal thresholds (see Results).
- **Pacifist** — `no-damage` assist forced on; shelves are immovable. Doubles as the accessibility on-ramp.
- **Daily Seed** — deterministic list + store layout from a date-seeded PRNG, shared leaderboard string (local only; see Share).

Each card shows a one-line rule and the modifier icons active. A **Seed** field (micro input) lets players paste a run seed. Below: difficulty assists summary chips reflecting current settings. Confirm with `A`/`Enter`/click → COUNTDOWN.

### COUNTDOWN
Pointer locks (or fallback engages), the shopping list slides in from the left, and a diegetic PA chime plays with a 3-2-1 count rendered as a large centered `display` number that punches (scale 1.3→1.0, 0.4s each). At "GO" the timer starts (`started` flag in `game.js`). This replaces today's abrupt start and gives pointer-lock a moment to settle before the clock runs.

### RUN
The gameplay HUD, specified in full below. No chrome beyond the HUD zones.

### RESULTS
Detailed in *Results / Scorecard UX*. Enter on checkout completion.

### PAUSE (overlay)
`Esc`/`Start`/menu. Dims the frame to 55% with a 6px blur, unlocks pointer, shows a compact column: **RESUME**, **RESTART LIST**, **SETTINGS**, **QUIT TO TITLE**, plus a live control card. The timer holds. This is also where pointer-lock loss lands (see Error UX) so an accidental unlock never feels like a failure.

## The HUD Specification

Screen-space DOM, `z-index` band 10–14. All panels share a token background `rgba(10,14,18,0.78)`, 1px `rgba(255,255,255,0.14)` border, 12px radius, `backdrop-filter: blur(4px)` (dropped automatically on panic tier — it's the one filter iGPUs hate). Positions are anchored to viewport edges with `clamp()` gutters so they survive ultrawide and mobile. A single `--hud-opacity` (default 1.0, min 0.4) and a **HUD scale** feed every zone.

**Zone map** (origin top-left; the eight zones and their exact anchors):

| Zone | Anchor | Size | Contents | Show / hide |
|---|---|---|---|---|
| **List card** | top-left, 18px gutter | min-width 210px, auto height | Title, 6 rows (check, name, price), footer `n/6 · then CHECKOUT` | Always during RUN; collapses to a 1-line `n/6` chip when `listDone` |
| **Timer** | top-right, 18px | 22px `h2`, tabular-nums | `m:ss` (Time Attack: counts down, turns amber <15s, red <5s) | Always during RUN |
| **Damage meter** | top-right, under timer, 8px gap | 160×10px bar + `$` readout | Fill = `min(1, damageTotal / softCap)`; softCap = 25% of a nominal cart | Fades in on first damage, stays; pulses on each new hit |
| **Combo ticker** | right edge, mid-height, right-aligned | 18px | `×N` grab streak + floating `+pts` | Appears at combo ≥2, hides 2s after break |
| **Compass strip** | top-center | 320×24px | Ribbon of department labels + a green ▾ for the nearest unchecked item, a 🛒 for checkout | Always during RUN; the target pip hides when `listDone` (only 🛒 remains) |
| **Minimap** | bottom-right, 18px | 150×98px (world 46×30 → 3.26px/m) | Top-down store, player arrow, item dots, checkout ring | Toggleable (default on); auto-hides on Pacifist newcomers' first 20s to reduce clutter |
| **Prompt** | bottom-center, 84px up | auto | `<b>Name</b> · $X — [E] take`, or checkout status | Only when hovering a grabbable or inside checkout radius |
| **Toast** | top-center, 64px down | auto | Bumps/crashes/PA barks | 2.6s auto-expire (already implemented) |
| **Crosshair** | dead center | 6px dot, 2px dark ring | Aim point; grows to 10px + green tint when a grabbable is under it | Visible whenever `playing` |
| **Banner** | center, 38% from top | modal card | List-complete flash; results summary | Event-driven |

**Compass strip — the wayfinding spine.** This is the one genuinely new HUD element and it earns its pixels because a 46×30m store across two themed halves is easy to get lost in. It's a 320px horizontal ribbon showing compass-relative department markers (Produce, Freezers, Bakery, Electronics, Apparel, Toys, Pharmacy, Checkout). Each department has a fixed world centroid; we project the bearing from the camera to each centroid onto the strip: `x = 160 + ((bearing − camYaw + π) mod 2π − π) / FOVspread * 160`, clamped to the strip, with markers past the edge pinned and dimmed. The nearest **unchecked list item's** shelf gets a bright green ▾ chevron with distance in meters; checkout gets a persistent 🛒 that pulses once `listDone`. This is diegetic-adjacent (it reads like an aisle-sign horizon) but implemented as cheap DOM. It replaces a hard objective marker and keeps the player's eyes near screen-center where the action is.

**Minimap** is a `<canvas>` redrawn at 10Hz (not per-frame — it's a rounding-tolerant overview): store footprint from a baked static image (drawn once), then per-tick we stamp the player as a rotating arrow, unchecked item shelves as green dots, checked ones as faint gray, and the checkout as a ring that lights when the list is done. Tipped gondolas redraw as rotated bars so the map reflects the wreckage. It never rotates (north-up) — rotating minimaps induce the same nausea we're fighting elsewhere.

**Damage meter** makes the existing `damageTotal`/`damageCount` legible in real time instead of only at checkout. The bar sits under the timer; each new spawn of debris (see `spawnDebris`) pushes the fill and triggers a 120ms red flash + a small `+$X` number that floats up and fades. This is the "legible chaos" pillar: you feel the bill climbing, which makes the choice to sprint through an endcap a real decision.

## Player Presence — Cart & Hands

Today the camera is a floating eye. Production ships a **visible cart** as the primary presence anchor, plus lightweight hands for the grab. Presence is the single biggest game-feel upgrade available and it's nearly free on the draw budget (one instanced cart, a handful of piled items).

**Cart geometry & framing.** A shopping-cart mesh occupies the lower-center foreground, basket rim at roughly screen-y 78%, handle bar nearest camera. It's parented to a rig that trails the camera rather than locking to it: target position is `camPos + camForward*0.55 + camDown*0.62`, target yaw eases toward camera yaw. We drive it with critically-damped springs:

```
cart.pos   += (target − cart.pos) * (1 − exp(−k_pos * dt))   // k_pos ≈ 9
cart.yaw   += shortestAngle(target − cart.yaw) * (1 − exp(−k_yaw * dt))  // k_yaw ≈ 6
```

The asymmetric gains give a satisfying **swing-out on turns** (yaw lags, so the cart visibly arcs when you whip the mouse) and a subtle bob coupled to the existing walk `bob` phase (cart dips ~1.5cm opposite the head-bob for a "pushing weight" read). Sprint tightens `k_pos` to 12 and adds a forward lean of 3°, so the cart feels shoved ahead of you.

**Collision feel.** The cart is cosmetic-forward but reads impacts: when `onPlayerBlocked` fires or a NPC bump lands, the cart rig gets a one-shot recoil impulse (kick back 6cm + pitch up 5°, spring back over 0.3s) synced to the existing camera shake and `SFX.thud`. On a full sprint-crash aisle-tip, the cart jolts hard (12cm, 9° roll) and a can or two visibly bounces out of the basket. This ties the player's body to the destruction physics that already exist.

**Item pile-up.** Grabbed items don't just vanish into an abstract count — the fly-to-basket (currently a 0.4s lerp to a point 0.45m ahead and 0.32m down) retargets to a **basket stack**. We maintain up to 12 visible instances in the basket, positioned on a jittered grid with slight random yaw; item 13+ increments the count but recycles the oldest slot's transform (so the basket looks full without unbounded meshes). Each landed item does a small squash-and-settle (scale y 0.85→1 over 0.12s). This makes progress physical: a near-full basket is a glanceable "I've grabbed a lot."

**Hands & grab timing.** A pair of low-poly gloved hands (or just a right hand + forearm; keep it cheap) rests on the handle during traversal. On `E`, the near hand does a 0.18s reach toward the aimed product, "contact" frame triggers `SFX.grab` and the pinch, then the product does the existing 0.4s fly arc (which we keep — it reads well) while the hand returns. Total perceived grab is ~0.4s, matching the current flyer duration; we're just adding an anticipatory reach so it doesn't feel like telekinesis. First-person hands are the classic presence cheat and they cost one animated skinned mesh at most. **Toggle:** hands can be disabled in Settings (some players find FP hands intrusive), cart cannot — it's load-bearing for wayfinding and the pile visualization.

## Input Specification

The current build is keyboard+mouse only, with pointer-lock and a drag-look fallback. Production ships three fully-realized schemes with a shared, rebindable action map. We define **actions**, not keys, and bind devices to actions:

`MOVE_X/Y (analog), LOOK_X/Y (analog), SPRINT, INTERACT, NEW_LIST, MUTE, PAUSE, MAP_TOGGLE, HUD_HIDE, TUTORIAL_REPLAY`.

### Keyboard + Mouse (final bindings)

| Action | Default | Notes |
|---|---|---|
| Move | `W A S D` / Arrows | Both already supported |
| Look | Mouse (pointer-lock) | Drag-look fallback in sandboxed embeds |
| Sprint | `Shift` (hold) | **Hold/toggle option** in Settings |
| Interact / Take | `E` | Also `Left-Click` as an alias (huge discoverability win — everyone clicks) |
| New list / Continue | `R` | Only active when `done` |
| Pause | `Esc` | Lands on Pause overlay, not a dead unlock |
| Mute | `M` | Toggles master gain (implemented) |
| Toggle minimap | `Tab` | Hold to expand map to 2× |
| Hide HUD (photo mode) | `H` | For screenshots |

**Rebindable map:** Settings → Controls shows the action list; clicking a row enters "press a key" capture, writes to `localStorage` (`gd3d.binds`). Conflicts flag inline. A **Reset to defaults** button. We store bindings by `KeyboardEvent.code` (layout-independent, so AZERTY/QWERTZ get sane defaults and can rebind). Left-click-to-take must be defer-able because click is also the pointer-lock re-acquire gesture — we only treat click as INTERACT while already locked/playing.

### Gamepad (Xbox / PlayStation, via the Gamepad API — no backend)

Polled each frame in the existing `animate` loop through `navigator.getGamepads()`. Deadzone 0.18 radial, response curve `sign(x)*x²` on look for fine aim.

| Action | Xbox | PlayStation |
|---|---|---|
| Move | Left stick | Left stick |
| Look | Right stick | Right stick |
| Sprint | Left stick click (L3) or hold `LT`? → **`A`+move? No.** Use `LB` (hold) | `L1` (hold) |
| Take / Interact | `A` | Cross |
| New list / Continue | `A` (on results) | Cross |
| Pause | `Start`/`Menu` | Options |
| Mute | `View`/`Back` | Share |
| Recenter/aim-assist snap | `RB` | `R1` |
| Toggle map | `D-pad ↑` | D-pad ↑ |

**Aim assist** (default on for gamepad, off for KB+M): when the crosshair passes within ~4° of a grabbable within REACH (2.7m), look velocity gets a gentle magnetism scalar (0.6×) and the crosshair "sticks" briefly. `RB`/`R1` performs a soft snap to the nearest in-reach grabbable — critical for a fast grab game on a stick.

**Haptics** (dual-rumble via `GamepadHapticActuator.playEffect`, gracefully no-ops where unsupported):

| Moment | Effect |
|---|---|
| Grab item | 40ms, weak 0.25 |
| List complete | Two 60ms pulses, strong 0.5 |
| Cart shove / NPC bump | 90ms, mixed 0.4/0.3 |
| Walking shelf-knock | 120ms, strong 0.5 + weak 0.4 |
| **Sprint-crash aisle tip** | 350ms ramp 0.9→0.2, both motors — the money moment |
| Checkout complete | Ascending triple 0.3/0.4/0.6 matched to the SFX arpeggio |
| Damage tick (billed) | 30ms sharp 0.6 weak-only (a "nick") |

### Touch (mobile / tablet)

Left half of screen = **virtual stick** (appears where the thumb lands, 90px radius, move vector = offset/radius). Right half = **look area** (drag delta drives yaw/pitch at 0.0045 rad/px, matching the fallback constant). Context buttons, bottom-right stack, 56px targets, 20px apart, thumb-safe:

- **TAKE** (primary green) — enabled/glows only when a grabbable is aimed; also the checkout confirm.
- **SPRINT** (hold) — toggle-able to a lock in Settings.
- Small top-corner icons: mute, pause, map.

Look sensitivity, invert-Y, and stick size are exposed in Settings. Touch auto-detected (`pointer:coarse` + touch events); we never show both touch controls and a crosshair-prompt for `E`. On touch, the tutorial swaps key glyphs for button glyphs automatically.

## Game Feel / Juice Inventory

Every action resolves across four channels — **sound** (procedural WebAudio, already built), **visual**, **haptic** (gamepad), **UI**. The existing SFX map (`grab, tick, listDone, checkout, thud, crash, clatter, error`) covers most of it; production adds the missing visual/haptic/UI columns.

| Action | Sound | Visual | Haptic | UI |
|---|---|---|---|---|
| Hover grabbable | — | Additive glow box on item (impl.), crosshair grows + tints green | — | Prompt shows name/price/`E` |
| Grab item | `grab` (520→800Hz chirp) | 0.4s fly arc + spin + shrink (impl.); hand reach; basket squash-settle | 40ms weak | List row checks + strikethrough; combo `+pts` float |
| List item satisfied | `tick` (880Hz) | Row flips to green ✓, 1.06 scale punch | 40ms weak | Footer `n/6` increments |
| List complete | `listDone` (2-note) | Green banner flash; checkout ring lights; compass shows only 🛒 | Two strong pulses | Banner "head to CHECKOUT"; list collapses to chip |
| Walk into shelf (<1.6 m/s) | `thud` | Camera shake 0.18; cart recoil | 120ms | — |
| Knock items off (≥1.6 m/s) | `thud` + `clatter` | Items ballistically spill (impl.); shake 0.3; damage flash | Strong mixed | Damage meter climbs + `+$X` float; 40% toast |
| **Sprint-crash aisle tip (≥4 m/s)** | `crash` (boom+debris) | Whole gondola pivots over 0.85s (impl.); 56-item spill; shake 0.9; cart jolts | 350ms ramp both motors | PA toast "CLEANUP ON AISLE… ALL OF IT"; big damage jump |
| Shove a cart | `thud` if hard | Cart rolls with momentum (impl.); your cart recoils | 90ms | — |
| Tip a cart | `crash` | Cart pivots + settles (impl.) | 90ms | Snark toast (impl.) |
| Bump an NPC | `thud` | NPC staggers + wobble-recovers (impl.); shake 0.22 | 90ms | Bark toast (impl.) |
| Pick debris off floor | `grab` | Same fly arc, reused mesh (impl.) | 40ms | List credit if on-list |
| Enter checkout radius | — | Ring pulse | — | Prompt: status or auto-complete |
| Checkout complete | `checkout` (4-note arp) | Grade stamp slam; register ka-ching flash | Ascending triple | Results screen |
| Mute | (silence) | Speaker-off icon flash | — | Toast "Muted" |
| Error / invalid | `error` (300→190Hz) | Crosshair red shake | 30ms | — |

**Global juice rules:** camera shake decays at 1.6/s and is capped at 1.0 (impl.); shake is one of the first things the accessibility layer can zero out. All UI punches use `transform: scale`, not layout, so they're compositor-only. Hit-stop: on the aisle-tip only, we insert a 60ms time-scale dip (dt × 0.35) to sell the impact — nowhere else, because frequent hit-stop on iGPUs reads as jank.

## Onboarding

**Diegetic first-run tutorial.** On the very first `RUN` ever (flag in `localStorage: gd3d.seen`), a friendly staffer avatar (reuse a Rocketbox associate, `speed:0`, `browsing`) is waiting at spawn (0.6, 1.65, 13.2) beside a cart. Instead of a modal wall of text, guidance arrives as **three staged compass/prompt beats** with speech-bubble toasts anchored above the staffer:

1. *"Grab that first item on your list — walk up and press `E` (or click)."* Compass chevron exaggerated; the target shelf item pulses. Advances when the player grabs anything.
2. *"Nice. Careful with the aisles though — sprint into one and… well, you'll see."* Only fires the "you'll see" if they haven't already tipped something. Teaches the destruction/consequence without forcing it.
3. *"Grab all six, then roll up to a checkout lane."* Points the 🛒. Advances on `listDone`.

The staffer waves and returns to idle after beat 3. Total tutorial is skippable (any input during a beat + `Esc` dismisses) and never repeats unless replayed from Settings (`TUTORIAL_REPLAY`). This respects the "store is the interface" pillar — no separate tutorial level, it's woven into a real run.

**Progressive hints** (post-tutorial, contextual, each shown once, tracked in `localStorage`): first time damage exceeds $20 → "Damages come off your total at checkout — worth slowing down"; first time lost for >25s with no grab → compass chevron brightens + "Looking for X? It's in Produce, back-right"; first debris on floor → "Knocked-down items still count — grab them off the floor."

**Control card.** A persistent, collapsible glyph card (bottom-left, above nothing) available via the `?` icon or Pause. It renders the *current* device's bindings (auto-switches KB/gamepad/touch glyphs based on last input device) and reflects rebinds live. Replaces the current auto-fading `#hint` string, which we keep only as the very first "Click to play" affordance on the title.

## Results / Scorecard UX

On `complete()`, we transition to a dedicated **RESULTS** overlay (today it's just a banner) built for readability and re-run velocity.

**Anatomy** (centered card, world dimmed behind):

- **Header:** `CHECKED OUT` (`h2`).
- **Grade stamp:** a large letter grade (S/A/B/C/D) that *slams* in — see animation below.
- **Receipt breakdown**, itemized like a real receipt (monospace tabular): the 6 items with prices, a subtotal, then a red **STORE DAMAGES** section listing `count items · $total` (from `world.physics.damage`, billed at 40% of price), then the grand **TOTAL**.
- **Time:** the `m:ss` big (`h1`), with Time-Attack medal (🥇/🥈/🥉) against thresholds.
- **Stats row:** items grabbed, aisles tipped, carts wrecked, NPCs bumped, longest grab combo — the comedy metrics.
- **Actions:** **[R] Play Again** (new seed), **New Layout**, **Share**, **Title**.

**Grading formula** (deterministic, local): `score = 1000 − timePenalty − damagePenalty`, where `timePenalty = max(0, seconds − parSeconds) * 4` (par ≈ 75s for a 6-item list) and `damagePenalty = damageTotal * 6`. Bands: S ≥ 950, A ≥ 820, B ≥ 650, C ≥ 450, else D. A clean sub-par run with zero damage is the only path to S, which teaches the risk/reward: destruction is fun but graded against you.

**Grade stamp animation:** the letter enters at scale 3.0, opacity 0, rotated −12°, and slams to scale 1.0 / 0° over 0.22s with an overshoot (ease-out-back), landing with a red ink-stamp `SFX.thud` + a 6px screen shake and a dust-puff of particles behind it. On an S, add a gold shimmer sweep and the ascending checkout arpeggio. This is the payoff beat; it should feel earned and loud.

**Share (local-first, no backend).** Two options: (1) **Screenshot** — `renderer.domElement.toDataURL('image/jpeg', 0.9)` composited under the results card via an offscreen canvas, offered as a download and a Clipboard-API copy; (2) **Copyable seed string** — `GD3D-<seed>-<grade>-<mmss>` written to clipboard so players can challenge each other ("beat GD3D-4F2A-B-0142"). Pasting a seed in MODE reconstructs the exact list and (for Daily/Seed modes) layout from the PRNG. A future optional backend could turn seed strings into a leaderboard, but the shipping game needs none.

## Accessibility (Production Bar)

This game is motion-heavy (head-bob, shake, cart sway, aisle-tips, bloom) and its comedy leans on color-coded tags — both are accessibility risks we address head-on. Every item maps to a Settings toggle, persisted in `localStorage: gd3d.a11y`.

| Concern | Setting | Default | Implementation |
|---|---|---|---|
| Motion sickness | **FOV slider** 55–100° | 62 | `camera.fov`; wider reduces sim-sickness for many |
| | **Head-bob** off/low/full | full | Scales the `Math.sin(bob)` amplitude (currently 0.03/0.045) to 0 |
| | **Camera shake** off/half/full | full | Scales `physics.shake` multiplier (currently ×0.12) |
| | **Cart sway** off/reduced/full | full | Scales the yaw-lag spring; off = cart locks rigidly |
| | **Hit-stop** off/on | on | Disables the 60ms tip time-dip |
| | **Reduced motion master** | follows `prefers-reduced-motion` | Sets bob/shake/sway/hit-stop all to off, disables screen animations |
| Photosensitivity | **Flash reduction** | off | Caps damage/grade flashes to a slow fade; disables bloom pulses; clamps any flash to <3/s |
| | **Bloom** off/low/full | tier-dependent | Toggles `UnrealBloomPass.strength` to 0 |
| Colorblind | **List/tag color mode** normal/deuter/prot/trit | normal | Recolors ✓ green, damage red-orange, sale tags via a palette map; **never rely on hue alone** — checks always also show the ✓ glyph + strikethrough (already true), damage always shows `$` + icon |
| Audio→visual | **Visual audio cues** | off | On-screen directional pips for off-screen crashes/barks; captions for PA/NPC barks |
| Subtitles | **Bark captions** | on | The toast system already carries bark text; formalize as captioned, sized by `--ui-scale` |
| Sprint ergonomics | **Sprint: hold / toggle** | hold | Toggle latches `SPRINT` state |
| Interact ergonomics | **Interact: press / hold** | press | Hold-to-confirm option prevents accidental grabs for tremor users |
| Difficulty | **Extra time** +25%/+50% | off | Raises `parSeconds` and any countdown |
| | **No-damage mode** | off | Shelves become immovable (skip `knockItems`/`tipGondola`); nothing bills — this *is* Pacifist mode |
| | **Auto-grab in reach** | off | Grabs the aimed on-list item without `E` when within 1.2m for 0.4s |
| | **Objective assist** | on | Compass chevron + minimap dots; off for purists |
| Readability | **UI / HUD scale** 0.85–1.4 | 1.0 | `--ui-scale` multiplies all type tokens |
| | **HUD opacity** 0.4–1.0 | 1.0 | `--hud-opacity` |
| | **Crosshair** dot/cross/ring, size, high-contrast | dot | Swaps `#crosshair` styling |
| | **Dyslexia-friendly font** | off | Swaps stack to a bundled OpenDyslexic-style face (local, no CDN) |

Reduced-motion and colorblind modes are surfaced *on first launch* via a one-screen "Comfort" prompt before the tutorial ("Any of these on? You can change them anytime in Settings") — proactive, not buried. All of these are pure client toggles; none require a backend.

## Error & Edge UX

**Pointer-lock loss.** Browsers drop pointer-lock on `Esc`, tab-out, or focus loss. Today `unlock` just sets `playing=false` and hides the crosshair — the player is stranded. Production routes any unlock into the **Pause overlay** with a clear "Click / press any key to resume" affordance and a held timer. The `pointerlockerror` path (sandboxed embeds) already flips to drag-look fallback; we keep that and show a persistent small "Drag to look" hint in fallback mode.

**Tab-out / visibility.** On `visibilitychange → hidden`, auto-pause (freeze timer, suspend `AudioContext`, stop advancing the clock), and on return show the Pause overlay rather than snapping straight back — prevents "lost 20 seconds while I answered Slack."

**Low-perf notice.** The tier system already downgrades to `panic` (pixel ratio 1, no GTAO, frozen shadows) after sampling 60 frames. When it drops to panic, surface a *dismissible* one-time toast: "Performance mode on for a smooth run — you can tweak visuals in Settings." Never silently ship a worse experience without telling the player it's deliberate. Settings exposes a manual **Quality: Auto / Lite / High** override for players who want to force it.

**Save-corrupt recovery.** All persistence is `localStorage` (binds, a11y, seen-flags, last grade, daily seed). Wrap reads in a versioned schema (`gd3d.v1`); on `JSON.parse` failure or version mismatch, fall back to defaults, preserve the raw bad blob under `gd3d.corrupt.<ts>` for debugging, and show a quiet toast "Settings reset." No data loss is fatal — the game is stateless between runs by design, so worst case is defaults.

**WebGL context loss.** Listen for `webglcontextlost`, `preventDefault`, pause, and on `webglcontextrestored` re-run `renderer.compile` behind a mini boot curtain. On outright WebGL-unavailable (the top-level `try/catch` in `main.js` already catches init failure and prints the stack), replace the raw error `<pre>` with a friendly full-screen card: "Grocery Dash needs WebGL — try a desktop browser or enable hardware acceleration," keeping the stack behind a "details" toggle for support.

**Audio autoplay.** `AudioContext` must start from a user gesture (already hooked to pointer-lock/click via `SFX.start()`); if a player somehow reaches RUN without it resuming, the first `E` re-attempts `resume()`. Muted state persists across runs.

---

Taken together, this layer turns the current tech demo — a floating eye in a beautifully instanced store — into a game with a body, a front door, a scoreboard, three input languages, and a comfort floor that lets the destruction stay loud without leaving anyone behind. Nothing here needs a server, and nothing here spends draws the iGPU floor can't afford.


---

# PART 3 — WORLD, CONTENT, VISUALS & AUDIO

This section is the art bible for the shipping build. Every system below is written against the real code: the world is assembled in `src/store.js` (`buildStore`), items in `src/products.js`, people in `src/characters.js`, physics in `src/physics.js`, audio in `src/sfx.js`, and the render/quality spine in `src/main.js`. Draw-call budget (≈988 in the worst view), the Intel-iGPU floor, frozen shadow maps, and the no-backend rule are hard constraints — anything I add here either instances, merges, or bakes, and nothing requires a server.

---

## 1. Art Direction Statement: "Heightened Retail Realism"

We are fusing four asset families that were authored by four different worlds: **photoscans** (Poly Haven produce/tins/croissant/register, physically-measured albedo + normal + ARM), **procedural packaging** (canvas-drawn labels in `products.js`, flat vector graphics), **Rocketbox people** (game-grade JPEG-textured humans), and **Kenney cars** (stylized flat-shaded low-poly). Left alone these read as a collage. The reconciler is **one lighting model, applied to everything**.

**The unifier is `scene.environment`.** `src/env.js` loads a single warehouse HDRI into a PMREM and sets `scene.environmentIntensity = 0.55`. Every material — a photoscanned apple, a canvas cereal box, a Rocketbox jacket, a Kenney fender — samples that same irradiance and specular probe, then passes through the same `ACESFilmicToneMapping` at `exposure 1.0`. That shared tone response and shared reflection is what makes a scanned tin sit next to a drawn soup can without either looking pasted in. **Rule: no asset ships with baked lighting in its albedo, and no material overrides tone mapping.** Photoscan albedos must be de-lit in the offline pipeline (`scripts/fetch-models.mjs`) so the runtime HDRI is the only light they see.

**The three-layer light recipe** (already in `lighting()`):
1. **Ambient/reflection bed** — the HDRI at 0.55 plus a `HemisphereLight(0xcfe0f0, 0x39352f, 0.34)` for cool-sky-over-warm-floor fill.
2. **The soft box wash** — instanced emissive troffers (≈110 fixtures, one draw) plus `RectAreaLight` panels for the diffuse "grocery glow." Rect lights are the tier-gated luxury (off in `lite`).
3. **Shaped accents** — 8 shadow-casting `SpotLight`s over hero fixtures (produce, checkout, entrance), frozen after frame 3.

**Palette (canonical hex, harvested from the build):**

| Role | Hex | Usage |
|---|---|---|
| Brand Navy | `#173a63` | Aisle signs, banners, murals, wall band alt |
| Fresh Green | `#1d5c38` | Produce, wall accent band, "FRESH DAILY" |
| Signal Yellow | `#ffd23b` | Sale tags, sign chevrons, accent stripes |
| Cart Red | `#c9241a` / `#b3261a` | Carts, bollards, baskets, clearance |
| Terminal Green | `#35c46a` / `#48e07a` | Lane numbers, EXIT, pharmacy cross, checkout ring |
| Warm Light | `#fff2e2` / `#fff4e6` | Rect/spot emitter color |
| Cool Fill | `#cfe0f0` | Hemisphere sky term |
| Structural Metal | `#b9c0c7` / `#c4cace` | Shelving, chrome, poles |
| Fog / Void | `#11151a` (fog 24→46m), `#0d1013` (bg) | Depth cueing |

Warm interior against cool fill and a near-black fog void is the signature. **Keep emissive intensities moderate** — the git history flags "everything glows" as a real bug; troffers cap at `emissiveIntensity 2.1`, screens at `0.9`, and `UnrealBloomPass` threshold stays at `0.96` so only true emitters bloom.

**Materials language.** Four shared constructors in `src/materials.js`, and new fixtures must reuse them:
- `METAL(color, rough)` — `metalness 0.95`; reads as metal purely from HDRI reflection, no map needed.
- `PLASTIC(color, rough)` — `metalness 0`, `envMapIntensity 1.2`; toys, carts, caps.
- `PAINTED(color, rough)` — matte `metalness 0`; MDF fixtures, walls, platforms.
- `loadPBR(folder, repeat, extra)` — packed ARM (AO=R, Rough=G, Metal=B) for floor/wall/asphalt/wood.

Glass is the one special case: `transparent`, `opacity 0.06–0.16`, `roughness 0.04–0.08`, `envMapIntensity 2.2` (freezers) so the HDRI does the reflecting we can't afford to ray-trace.

### The Fake-Brand Universe

The catalog already carries ~40 invented brands. We formalize them into a **house-brand architecture** with locked color DNA so a shopper learns to recognize a brand across a shelf. Today `Crunch` chips are green but `Crunch BBQ` is red, and `Meadow` milk and yogurt disagree — **final rule: `bg1/bg2/accent/ink` are properties of the *brand*, not the SKU.** `labelTexture()` in `products.js` already reads these; we just move them up a level into a `BRANDS` table the SKUs inherit from.

Fifteen+ house brands with identity notes:

1. **Northfield** (breakfast/grain) — amber→ochre gradient, dark-brown ink, wheat-sheaf dot motif. Wholesome heartland.
2. **Sunrise** (breakfast/value) — red→maroon, yellow chevron. Loud, cheap, cheerful.
3. **Bella** (pasta/Italian dry) — cobalt→navy, gold rule. Tricolore restraint.
4. **Nonna's** (sauces) — tomato-red, cream accent. Handwritten-serif wordmark exception.
5. **Kettle Co** (canned staples) — brand navy `#1f7ac2`, cream label ring on the metal cylinder. The value workhorse; widest SKU count.
6. **Golden** (canned veg) — marigold with green leaf accent, brown ink.
7. **Crunch** (salty snacks) — **flavor-coded within a fixed frame**: the bag silhouette, wordmark, and top stripe stay constant; only the hero color-block flips per flavor (sea-salt teal, BBQ red, cheese orange). This is how real snack lines work and it's the model for all multi-flavor brands.
8. **Fizz** (soda) — near-black bottle body, red cap, effervescence dots. Cola-house parody.
9. **Alpine** (water/hydration) — glacier blue→white, snow-peak accent.
10. **CloudSoft** (paper goods) — pale blue-white, soft-serif, cloud dots. Premium-soft.
11. **Wave** (cleaning) — teal→deep-teal, yellow burst. Clinical brightness.
12. **Meadow** (dairy) — off-white cartons, navy rule, single green leaf. Farm-fresh minimal.
13. **Hearth** (bakery) — kraft tan→brown, dark ink, oven-warm. Also owns the photoscanned croissant.
14. **Polar** (frozen dessert) — icy white-blue, brown vanilla accent.
15. **Vixel** (electronics) — carbon-black→charcoal, cyan `#35c4c4` tech accent. Owns TVs, soundbars, and demo-screen graphics.
16. **Relievo / VitaDay / MendFast** (pharmacy trust tier) — clinical white grounds, single saturated accent (red/green/blue), heavy sans, no gradient theatrics.
17. **Dashmart** (NEW — the retailer's own private label) — a value line under the store's own name (`GROCERY DASH SUPERCENTER`). Flat brand-navy panel, yellow price-forward burst, deliberately plainer than the national brands. Spans every aisle at the cheapest price point; teaches players the "store brand looks boring, costs less" real-world read and gives us a free SKU multiplier.

---

## 2. Interior Build-Out to Final

The 46×30m floor splits at x≈0: **grocery (west)** and **general merchandise (east)**, joined by a central action-alley the NPC graph already uses (`corridors.crossZ`). Build order and coordinates are locked in `buildStore()`.

### Fixture list & dressing-density targets per zone

**Grocery half**
- **4 island gondolas** (`groceryXs = [-18,-14,-10,-6]`, `islandZ=-3`, len 16, `H 1.85`). Each: pegboard back, 4 shelves at `y = 0.28/0.68/1.08/1.48`, kick-plate, header. Density target: **≥90% facing occupancy** with a 5% procedural gap (`rng()>0.05`) reading as "shopped-from." Every island is a tippable `physGondola`.
- **Freezer wall** (left, 10 glass doors, pitch 1.15). Final: doors become **openable** (see §7); interior gets a subtle cold-fog card and per-door LED strips (already emissive `#dcecff`).
- **Bakery back-wall shelf** (`wallShelf`, len 16) + a display case with the photoscanned croissant hero.
- **Produce corner** (6 crate tables, x −14.8…−20.4, z 9.4/12) — the photoscan showcase. Dressing: loose fruit at ~88% cell fill, chalk price signs, pendant shades, hanging scale, banana boxes, wood floor patch.
- **6 checkout lanes** (x `-10.5+i*1.9`, z 10.6): belts, card readers, number pylons, candy impulse racks (grabbable), bag stands, magazine rack, one **closed lane** (red ✕). Two lanes carry the photoscanned register.
- **Cart corral, gumball machines, wet-floor cone, trash bin, welcome mat, wine nook** (kit prop, back-left).

**General-merch half**
- **Electronics**: 8 emissive demo TVs on a dark back wall (z −14.65), a low platform of boxed sets, plus two **cross-grain gondolas** (rotated 90°, x=10) that deliberately break the boxy grid.
- **Apparel**: 6 circular racks (instanced tee billboards, one draw per color), 2 folded-stack tables (instanced boxes, per-instance color), warm-gray carpet decal zone `(10.2, 4.2)`.
- **Toys**: colorful tall island (x 19.5) + the classic wire ball-bin (instanced spheres, x 17.2).
- **Pharmacy**: white counter + emissive green cross, front-right corner.

### Ceiling / floor / wall treatment per zone

- **Ceiling** is one `ceilingTex` plane (acoustic-tile grid + one vent tile) at y=4.2, lit by the instanced troffer field. Final refinement: paint **soffit color zones** into the ceiling texture over apparel (warm) and electronics (cool) to echo the carpet decals — free, texture-only.
- **Floor**: `floor_tiles_06` PBR at `roughness 0.42, envMapIntensity 1.5` for the waxed sheen (clearcoat is too costly per-pixel at this size — the additive troffer "streaks" fake the reflection). Zone overrides: warm-gray carpet decal under apparel, cool-dark under electronics, wood patch under produce.
- **Walls**: `beige_wall_001` PBR + a painted **brand-green accent band** at y=2.52 wrapping all four walls. Department murals (Georgia-italic wordmarks), EXIT/clock/cameras/staff-door dressing. The band is what reads "designed interior," not "warehouse."

### Seasonal Overlay System

A **data-driven overlay** applied after `buildStore()`, toggled by real date or `?season=` query param. No backend; a pure additive module (`src/seasons.js`) that never mutates core geometry so it can be removed cleanly. It touches four cheap surfaces: the wall accent-band color, the endcap product pool + a themed instanced prop, PA promo lines, and a color-grade nudge (exposure + hemisphere tint).

```
SEASONS = {
  halloween: { band:#5a2d8f, accent:#e0801f,
    endcapProp: InstancedMesh(pumpkin, ~24), decals: cobweb alpha-planes (corners),
    pool:['candy'], pa:['Spooky savings on aisle 2…'], grade:{exposure:0.94} },
  christmas: { band:#8a1610, accent:#1d5c38,
    tree(entrance) + instanced baubles + instanced emissive string-lights along wall band,
    lotSnow: scrolling-alpha overlay on storefront glass, pa:['…holiday hours…'],
    grade:{exposure:1.05, hemi warm} , muzak:'jingle-variant' },
  summerBBQ: { band:#1f6fc2, accent:#e0a01f,
    grill+cooler endcaps, inflatable-pool prop in toys, timeOfDay:'dusk' (not night),
    pa:['Fire up the grill…'] }
}
```

Every seasonal prop is instanced (pumpkins, baubles, lights = one draw each) so overlays cost ~5–8 extra draws, well inside budget. Cobweb/snow are alpha-blended planes with `depthWrite:false`.

---

## 3. Exterior Final

The lot outside the storefront glass (`exterior()`) is a **night stage lit with zero real lights** — emissive lamp heads + additive light-pool circles + a gradient sky dome, all `fog:false`. That "fake it additively" discipline is the exterior's core constraint and every addition honors it.

### Parking-lot life
- **Fleet → 14 cars** (from 8), reusing the 8 Kenney kit models cycled with paint tints; length axis auto-detected from bbox. Add **2 arriving/leaving cars**: scripted actors that slide along a lane spline in `world.update`, headlights (already emissive) leading, a taillight pair trailing. Keep to ≤2 moving cars — everything else parked-static.
- **Cart wranglers**: 1–2 Rocketbox NPCs on an exterior patrol pushing a **nested cart train** (a short instanced row) between the corral and the doors. Reuses the walker FSM with a fixed 3-waypoint loop.
- **Arriving shoppers**: an NPC spawns at a car, walks the crosswalk (already striped, z-front+5.2), triggers the auto-doors (`world.update` door logic keys off camera proximity — extend to NPC proximity), and joins the interior crowd. This sells "a living store."

### Weather system (local-first, iGPU-safe)
- **Rain on glass**: a scrolling raindrop **canvas texture** on an overlay plane in front of the storefront and freezer glass; animate `.offset` in `world.update`. No shader authoring.
- **Wet lot**: swap the asphalt to a darker albedo + `roughness −0.25` and `envMapIntensity +0.4`; puddle **decal planes** near lamp pools inherit the HDRI reflection. We do **not** do SSR — too costly on iGPU; the existing additive light-pools intensified read as wet streaks.
- **Rain particles**: one instanced streak system (~800 max, only when `weather==='rain'`), world-space fall with vertical wrap, gated off in `panic` tier.
- **Lightning (optional)**: occasional 60ms `toneMappingExposure` spike + additive white flash, paired with a filtered-noise thunder one-shot.

### Time-of-day scenarios & their lighting rigs

Three rigs are **parameter sets applied at build** (cheapest, given frozen shadow maps and static lights). A runtime switch is allowed but must set `shadow.autoUpdate=true` for exactly one frame to re-bake, then re-freeze.

| Rig | Sky/Lot | Interior | Fog | Exposure | Crowd |
|---|---|---|---|---|---|
| **Dawn Delivery (06:00)** | blue-pink dome gradient, lamps switching off, cool hemi | troffers at 0.6×, back dock door open, pallets out | `#1a2230`, 20→46 | 0.96 | ~4 (stockers, manager) |
| **Noon Rush (12:00)** | bright day dome, high lot albedo, strong daylight through glass (+Z brightened hemi) | troffers full, all lanes staffed | `#c9d4e0`, 30→48 | 1.06 | 18–24 (heaviest) |
| **Night Chaos (22:00)** | current dark lot + lamp pools | full moody interior | `#11151a`, 24→46 | 1.0 | ~10 |

Each rig is `{domeTex, hemi:[sky,ground,int], trofferInt, spotColor, lotEnvInt, fog, exposure}`. Noon is the perf ceiling (bright exterior + max crowd) and must be validated against the `tier` auto-detector in `main.js` — if `avg frame > 0.055`, Noon should also cap `pixelRatio` to 1.

---

## 4. Items Catalog to Final (~150 SKUs)

Current: **52 SKUs** across `pantry, snacks, household, dairy, bakery, frozen, electronics, home, toys, pharmacy, produce`. Target **~150**, distributed to make list-shopping feel deep without exploding the instanced-stock cost (each new SKU is one InstancedMesh per template part — the win from `stock.js`).

### Taxonomy tree & target counts

```
GROCERY
├─ Pantry (9→26): cereal, pasta, rice, sauces, canned veg/beans/soup,
│                 condiments, oils, baking, coffee/tea
├─ Snacks (7→22): chips(flavor-coded), pretzels, crackers, cookies,
│                 candy, nuts, granola bars, soda, water, juice-box
├─ Dairy (4→14): milk(2%/whole/oat), yogurt, cheese(block/shred/string),
│                butter, eggs*, cream
├─ Bakery (2→10): loaves, rolls, muffins, croissant(scan), bagels, cake, donuts
├─ Frozen (2→14): pizza, ice cream, veg, fries, entrees, waffles, popsicles
└─ Household (4→14): TP, tissues, detergent, soap, dish, cleaner, foil, bags
GENERAL MERCH
├─ Electronics (5→14): TV, soundbar, headphones, console, router,
│                      speaker, tablet, controller, cables, camera
├─ Home (4→14): blender, cookware, towels, lamp, bedding, mug-set, storage
├─ Toys (4→12): truck, blocks, ball, plush, doll, board-game, art-kit, puzzle
├─ Pharmacy (3→10): meds, vitamins, bandages, sunscreen, cough, first-aid
└─ Produce (6→14): apple, lemon, banana, avocado, onion, sweet-potato(scans)
                   + orange, tomato, potato, broccoli, grapes, pepper
```

`* eggs` are the marquee new **fragile** SKU — a carton that behaves like nothing else in the current build (see physics classes).

### Physics classes (NEW field: `physicsClass`)

Today all debris behaves identically (`restitution 0.28`, always re-grabbable, `damage = price*0.4`). We add a `physicsClass` that `physics.js` reads at `spawnDebrisNow` and settle:

| Class | SKUs | Behavior | Damage mult | SFX | Re-grab? |
|---|---|---|---|---|---|
| **rigid** | boxes, cartons, TP, cans (dented) | current bounce/tumble/settle | ×0.4 | `thud`/`tick` | yes |
| **fragile** | jars, glass bottles, eggs, wine | **shatter** on `v.y>2` impact → spill decal, no re-grab | ×0.6 | glass-shatter | no |
| **rolling** | cans, produce spheres, cola/water bottles, play-ball | angular-velocity-coupled floor translation until friction stops | ×0.4 | roll-rumble | yes |
| **stack** | folded apparel, endcap cases | topple as a group, settle flat | ×0.4 | soft-thud | yes |

Rolling is the highest-value addition: a can knocked off a shelf that **rolls down the aisle** is the kind of emergent moment the arcade physics promises. It's cheap — one extra `if` in the debris integrator coupling `w.z→v.x` while `y<=0`.

### Procedural vs photoscan vs modeled
- **Procedural (canvas label + primitive):** all packaged goods — boxes, cans, jars, bottles, bags, cartons, cups, tubs. This is the scalable path; ~130 of the 150 SKUs. New SKUs cost a row in `PRODUCTS[]` and a color inherited from `BRANDS`.
- **Photoscan (Poly Haven GLB via `models.js`):** the 6 produce + tins + croissant. Add oranges/tomatoes/potatoes only if CC0 scans exist and pass the offline decimate/resize; otherwise fall back to the procedural `fruit()` sphere path (already wired via `hasModel`).
- **Modeled (kit props):** register, plant, box, crate, wine, wineshelf. Non-grabbable set dressing.

### Naming & pricing table (sample of new additions)

| id | brand | name | kind | class | price | section |
|---|---|---|---|---|---|---|
| `rice` | Bella | Long Grain Rice | boxwide | rigid | 3.19 | pantry |
| `coffee` | Northfield | Ground Coffee | can | rigid | 7.49 | pantry |
| `eggs` | Meadow | Large Eggs 12ct | boxwide | **fragile** | 3.29 | dairy |
| `butter` | Meadow | Sweet Cream Butter | box | rigid | 4.19 | dairy |
| `oj_shred` | Dale | Shredded Cheese | bag | rigid | 3.99 | dairy |
| `fries` | Polar | Crinkle Fries | bag | rigid | 2.89 | frozen |
| `sunscreen` | MendFast | SPF 50 | bottle | fragile | 8.99 | pharmacy |
| `boardgame` | Brixo | Family Game | boxbig | stack | 19.00 | toys |
| `orange` | Fresh | Navel Oranges | produce | **rolling** | 0.79 | produce |
| `wine_red` | (kit) | Table Red | bottle | fragile | 12.00 | wine |

Pricing bands: pantry/produce `$0.59–7.49`, dairy/frozen `$1.19–5.99`, household `$2.29–8.99`, electronics/home `$19–379`, keeping the checkout damage line (`price*0.4`) meaningful — smashing a `$379` Vixel TV is a `$151` gut-punch, which is exactly the comedy we want.

---

## 5. NPC Cast Final

Current cast: 6 Rocketbox adults (`Female_Adult_01/08/12`, `Male_Adult_01/04/08`) + the Soldier animation donor (never rendered) + CesiumMan legacy fallback. The retargeter in `characters.js` (rotation-delta bake, A-pose→T-pose correction, sanity check) is the crown jewel — it works on **any Rocketbox Biped rig**, which is what makes expansion cheap.

### Verified library expansion

The upstream `microsoft/Microsoft-Rocketbox` repo has ~115 adult avatars and child models, all on the identical 3ds-Max **Biped** skeleton with `Bip01_*` bone names — meaning `BIP_TO_MIXAMO` and `bakeRetarget()` apply unchanged. **Child models retarget too**, with one required change: `TARGET_H = 1.74` is currently a module constant used by `boneSpan`-autoscale; it must become **per-archetype** (`adult 1.74`, `elderly 1.68`, `child 1.24`). The autoscale already normalizes bone-span to `TARGET_H`, so a child just needs its own height and the sanity thresholds in `retargetIsSane` relaxed (`span.h > 0.95`).

**Committed cast target: 16–20 avatars** (from 6). More is a load-weight decision, not a runtime one — each is a skinned FBX + body/head color+normal + hair opacity, so we hold the line at ~18 and get variety from: per-instance scale jitter (already `rand(0.96,1.04)`), and a **tint pass** (multiply the body material `color` by a subtle per-instance hue) to make one jacket read as five. Run the `scripts/fetch-models`-style TGA→1024-JPG resize on every new avatar so total people-texture weight stays web-sane.

**Perf note that gates the crowd:** `dressAvatar` sets `frustumCulled=false` on every mesh. At 6 people that's fine; at 24 it wastes skinning on off-screen characters. Final: **re-enable frustum culling** and add an **update-rate LOD** — NPCs beyond ~14m tick their `mixer.update` at 15Hz instead of per-frame, and beyond ~24m freeze on their current idle pose. This is what makes Noon Rush's 24-strong crowd survivable on an iGPU.

### Archetypes & behavior trees

The existing `update()` in `characters.js` is a hand-rolled FSM over `{path, pause, browsing, shove, home, speed}`. Archetypes are **parameter sets + a few new leaf behaviors** layered on that mover — not a new engine.

```
SPEED-SHOPPER   speed 1.15–1.3, pause 0–1s, straight aisle→cross→aisle paths,
                mutters on pass. (≈ current fast walker)

BROWSER         speed 0, basket beside, side-step every 4–8s, pause ∞ at shelf.
                (≈ current browsing)

ELDERLY         speed 0.55–0.7, pause 2–5s, pushes cart, turn-rate halved,
                height 1.68. Gentle, blocks the aisle "realistically."

PARENT+KID      Sequence: parent walks/pauses like a browser; Child NPC LEASH-
                FOLLOWS at offset within radius 1.4m (new leaf: seek parent,
                wander when close); if kid strays >2m → parent pauses + "corral"
                bark, kid snaps back.

INFLUENCER      speed 0, slow yaw pan ±0.6rad (new leaf: sinusoidal yaw, as if
                filming a shelf), reposition every 6–10s, "content" barks.

SECURITY GUARD  Patrol: fixed perimeter waypoint loop (reuse corridors + bounds
                corners), pause+scan (idle) 3s at each, resume. Mobile staff.

MANAGER         Walks staffSpots in sequence, pauses at each with clipboard-idle,
                occasionally triggers a PA line.

STAFF (fixed)   cashier×2, stocker, pharmacist, electronics-assoc — already at
                staffSpots; drift back home() after a bump.
```

Behavior-tree shape per tick (Selector, first match wins), extending the current loop:

```
Selector(NPC):
  Sequence: if shove active        → apply knockback + wobble + decay   (exists)
  Sequence: if home & displaced    → drift back to post                 (exists)
  Sequence: if archetype==KID      → leash-follow(parent)               (new)
  Sequence: if archetype==GUARD    → patrol-loop(waypoints)             (new)
  Sequence: if archetype==INFLU    → pan-yaw + hold                     (new)
  Sequence: if pause > 0           → decrement, blend walk→idle         (exists)
  Sequence: if !path               → newPath(); (weighted aisle vs cross)(exists)
  Default:  advance along path, blend idle→walk by speed               (exists)
```

### Crowd density by scenario

| Scenario | Walkers | Browsers | Cart-pushers | Kids | Staff | Special |
|---|---|---|---|---|---|---|
| Dawn Delivery | 2 | 0 | 0 | 0 | 2 (stocker, mgr) | delivery driver |
| Noon Rush | 10 | 4 | 4 | 2 | 5 | 1 influencer, 1 guard |
| Night Chaos | 5 | 2 | 2 | 0 | 3 | 1 guard |

### Bark library (60+ lines)

Delivered two ways: **player-caused events** use the existing DOM `toast()` in `physics.js`; **ambient NPC chatter** uses a new lightweight **billboard speech-bubble** (a canvas-texture plane over the head, additive, fades in 2.5s) shown only for NPCs within ~6m of the camera, max 2 concurrent. Categories:

- **Bump (5, exists):** "Hey, watch it!" · "Excuse YOU." · "Seriously?!" · "Ow! My cart!" · "Careful, buddy!"
- **More bump (5):** "Walkin' here!" · "Do you mind?" · "Rude much?" · "Hey—HEY." · "That's a paddlin'."
- **Crash (3, exists):** "🛒 CRUNCH." · "That's coming out of your deposit." · "Cart casualty."
- **More crash (4):** "Did you SEE that?!" · "Somebody call a manager." · "My groceries!" · "Ten-second rule?"
- **Ambient mutter (10):** "Where's the almond milk…" · "We're out of coffee again." · "Was it aisle 3 or 4?" · "$6 for THIS?" · "I had a coupon somewhere." · "Do we need eggs?" · "Parking was a nightmare." · "This list makes no sense." · "Ooh, that's on sale." · "I always forget something."
- **Browser (6):** "Hmm, or the blue one?" · "Is this the good kind?" · "Two-for-five, not bad." · "Reading the ingredients…" · "Do I need this? …Yes." · "Back it goes."
- **Influencer (6):** "…and THAT'S how you meal-prep." · "Link in bio, fam." · "Smash that follow." · "Grocery haul, part four!" · "This lighting is everything." · "Wait, was that recording?"
- **Kid (6):** "Can we get the cereal? PLEASE." · "I want the red one!" · "Are we done YET?" · "Mom. Mom. MOM." · "Can I push the cart?" · "I'm gonna ride in it."
- **Staff greeting (6):** "Find everything okay?" · "Register two's open." · "Cleanup's on it." · "Fresh batch just came out." · "Prescription's ready." · "Need a hand with that?"
- **Elderly (4):** "In my day this was a nickel." · "Slow down, dear." · "Where'd they move the bread?" · "Lovely weather, isn't it."

That's 65 lines; expandable per season (Halloween/Christmas variants swap the mutter and staff pools).

---

## 6. Audio Final

All spine audio stays **procedural WebAudio** (`sfx.js` `tone()`/`noise()`) — no files, instant, tiny, and it already carries the faint low-pass store hum. We bundle CC0 samples only where synthesis is genuinely weak (glass shatter, a convincing register), and we drive the **PA voice from the browser's on-device `SpeechSynthesis` API** — zero bundle, zero backend, perfect fit.

### Full SFX inventory (synthesis method)

| Event | Method | Notes (exists?) |
|---|---|---|
| grab | `tone(520→800, tri)` | ✔ |
| list tick / checkout | `tone` arpeggios | ✔ |
| list done | 2-note rise | ✔ |
| error | `tone(300→190, saw)` | ✔ |
| thud (bump/knock) | `noise(260) + tone(90→55)` | ✔ |
| crash (tip) | `noise(900) + tone(70→40)` + delayed noise | ✔ |
| clatter (items loose) | 4 random square blips | ✔ |
| **door whoosh** | filtered `noise` swell, 0.4s | new |
| **freezer open/close** | seal-suck `noise` + `tone` thunk | new |
| **can/produce roll** | looped low `noise` through a moving bandpass | new |
| **glass shatter** | short CC0 sample (synthesis too weak) | new, sampled |
| **egg splat** | `noise(180)` short + wet `tone` | new |
| **register beep** | the existing checkout arpeggio, per-item | ✔ reuse |
| **gumball** | coin `tone` + wooden roll `noise` | new |
| **footsteps** | soft `noise` click, **retextured per surface** (tile bright / carpet muffled — pick filter by camera-in-zone) | new |
| **PA chime** | classic 2-tone `tone(659)`+`tone(880)` ding-dong | new |
| **cart rattle** | sparse metallic `tone` pings while a cart has velocity | new |

### Music direction

Ship a **procedural generative muzak** bed — cheesy elevator supermarket music, on-theme, no files, no backend. A fixed 4-chord loop (ii–V–I–vi) rendered on a soft FM/triangle voice + a light shaker `noise`, key-locked, tempo ~92 BPM, generated the same way `sfx.js` builds its hum. It evolves subtly (voicing rotation) so it never feels looped. Seasonal variants swap the chord voicing (jingle bells for Christmas). CC0 sampled tracks are the fallback only if generative muzak underwhelms — bundle 2 loops ≤1.5MB each, streamed via one `<audio>` element, decoded lazily.

### PA announcement system (30+ lines, dynamic)

A queue-driven subsystem: **chime → SpeechSynthesis utterance → done.** The voice runs through a "tinny PA speaker" chain (bandpass 400–3000Hz + light waveshaper distortion + a short feedback-delay "room"), all WebAudio nodes we already have the vocabulary for. If `speechSynthesis` is unavailable, degrade gracefully to chime-only + on-screen `toast` text. Announcements fire on a loose timer and on events. Categories:

- **Welcome/wayfinding (5):** "Welcome to Grocery Dash Supercenter." · "Guest services is at the front of the store." · "Restrooms are located near aisle 5." · "Please keep carts inside the yellow lines." · "Thank you for shopping with us."
- **Promo (8):** "Attention shoppers — Crunch chips are two-for-five this week." · "Fresh croissants, baked this morning, in the bakery." · "Rollback on Vixel electronics — today only." · "Save on CloudSoft paper goods in aisle 5." · "Dashmart value brand — same quality, lower price." · "Meadow milk, two for four dollars." · "Check out our weekly deals on the endcaps." · "Polar ice cream — buy one get one."
- **Department callouts (6):** "Pharmacist to the pharmacy counter." · "Associate needed in electronics." · "Price check on register two." · "Fresh produce, picked daily, in the produce corner." · "Free samples available in the bakery." · "Register three is now open."
- **Dynamic cleanup (existing hook, now voiced):** "Cleanup on aisle {g.label} — all of it." The aisle number is already carried on `physGondola.label` (1–8) and fed from `tipGondola`'s `toast`. Route the same string into the PA queue.
- **Closing/gag (6):** "The store will be closing in fifteen minutes." · "Would the owner of a blue sedan please move your vehicle." · "Lost child at guest services — parents, please." · "Spill in frozen foods, associate en route." · "Would a manager come to the front, please." · "Attention: cart wrangler needed in the lot."

That's 31 static + the dynamic cleanup family.

### Ambience beds per zone

Distance-gated gain crossfades keyed to `camera.position` against zone AABBs (cheaper than HRTF `PannerNode` on an iGPU; we already compute every zone's bounds). Each bed is filtered `noise` + sparse `tone`:
- **Freezer** (x < −19): steady compressor hum + faint fan.
- **Bakery/deli** (back-left): warm low murmur + occasional oven timer.
- **Produce**: intermittent misting hiss.
- **Electronics**: overlapping muffled TV-audio bleed (a couple of detuned tones).
- **Lot** (z > 15, near doors): night crickets + distant traffic; swaps to rain when weather active.
- **General floor**: a low crowd-murmur bed whose gain tracks NPC count in the scenario.

### Mix bus structure

```
master (DynamicsCompressor → gain 0.45 → destination)   ← M mutes this (exists)
 ├─ SFX bus        (gain 1.0)   grab/thud/crash/clatter/roll…
 ├─ Ambience bus   (gain 0.7)   zone beds + store hum
 ├─ Music bus      (gain 0.45)  generative muzak
 └─ PA/Voice bus   (gain 0.9)   chime + SpeechSynthesis
```

Ducking (sidechain via scheduled gain ramps): **PA ducks Music −6dB and Ambience −4dB** for the utterance + 300ms tail; **crash ducks Music −3dB for 400ms** so the smash punches through. A `DynamicsCompressorNode` on master tames peaks when a 56-item spill clatters at once. `M` continues to mute master (existing `toggleMute`).

---

## 7. Interaction Matrix (current → final)

Rows are the actor/object; columns are what it can act upon. ✔ = shipping today (verified in code), ★ = final target to build.

| Actor ↓ / Target → | Stock/Shelf | Cart | NPC | Debris | Fixtures/Props |
|---|---|---|---|---|---|
| **Player** | ✔ grab (E, ray→hide→fly) · ✔ knock (walk-crash ≥1.6) · ✔ tip aisle (sprint ≥4.0) · ★ open freezer door (E) · ★ weigh produce (E at scale) | ✔ shove w/ momentum · ★ grab & steer own cart | ✔ bump→stagger+bark · ★ hand item to staff (self-checkout) | ✔ pick up off floor (re-list) · ★ kick rolling item | ✔ auto-doors · ★ gumball (coin) · ★ TV channel · ★ sample station · ★ topple ball-bin |
| **Cart** | ★ scoop item on contact (drop-in) | ✔ cart-cart bounce | ★ pin/shove NPC | ★ scatter debris on roll-through | ✔ bounce off fixtures · ✔ tip on hard crash |
| **NPC** | ★ "shop" (hide a facing, carry) | ✔ push own cart (trails shopper) | ✔ bump→pause · ★ converse (paired bubbles) | ★ step around / kick | ★ trigger auto-doors · ✔ drift home after bump |
| **Debris** | — | ★ get run over by cart | ★ trip NPC path | ✔ ballistic→bounce→settle→fade(28s) · ★ roll (rolling class) · ★ shatter (fragile) | ✔ rest on floor as clutter |
| **Fixtures** | ✔ hold stock, tip→spill 56 items, become fallen footprint | ✔ collide | ✔ block/waypoint | ✔ spawn spill on tip | — |

**Priority build order for the ★ items** (highest gameplay-per-cost first):
1. **Open freezer doors** — flip `frozen` slots to `grabbable:true` on open, swing the door mesh (reuse the auto-door tween), puff a cold-fog card. Unlocks a whole department.
2. **Rolling physics** — one coupling term in the debris integrator; turns cans/produce into comedy.
3. **Weigh produce** — E at the existing hanging scale animates the dial and prints a price toast; makes produce a verb, not a texture.
4. **Self-checkout minigame** — at an unstaffed lane, items on your list scan one-by-one (register beep, belt scroll) before the total resolves; converts the checkout *zone* into a checkout *act*.
5. **Sample station & gumball** — small delight loops; both are single-prop, single-SFX additions.

Every ★ addition must obey the four standing constraints: **merge or instance** any repeated geometry, keep **emissive moderate** (respect the 0.96 bloom threshold), add **no runtime-updating shadow casters** (the maps are frozen after frame 3), and add **no network dependency** — SpeechSynthesis, WebAudio, and canvas textures keep the whole product a single-page, no-backend build that boots on an Intel iGPU.

---

### Files this section governs
- World assembly, fixtures, lighting, exterior, dressing: `src/store.js`
- Item catalog, packaging art, brand DNA, physics classes: `src/products.js` (+ `src/stock.js` for instancing)
- NPC cast, retargeter, archetypes, barks: `src/characters.js`
- Interaction physics, debris, tipping, toasts: `src/physics.js`
- Audio spine, PA, ambience, mix bus: `src/sfx.js`
- Render tiers, tone map, bloom, boot: `src/main.js` · IBL: `src/env.js` · shared materials: `src/materials.js` · kit models: `src/models.js`
- New modules to add: `src/seasons.js` (overlay), and a `src/pa.js` / audio-zone helper if `sfx.js` grows past comfort.


---

# PART 4 — TECHNICAL ARCHITECTURE

## Technical Architecture

This section specifies the production-final engineering foundation for *Grocery Dash 3D*: the module layout, the data model, persistence, settings, performance budgets, the rendering roadmap, the asset pipeline, testing, release, and the strictly-optional backend. Every decision here is constrained by the shipping reality of the current build — a single-page three.js r160 + Vite app with **no backend**, a **frozen-shadow, progressively-tiered** renderer, and a hard floor of **Intel integrated graphics in a desktop browser**. The guiding principle is *local-first, additive-online*: the entire game must boot, play, save, and replay with the network cable pulled, and any server we introduce may only add a social skin on top of a self-sufficient client.

The current `src/` tree — `main / store / products / stock / characters / physics / game / sfx / models / materials / env` — is a clean, mostly-acyclic dependency graph with `main.js` as the composition root and `sfx/models/materials/env` as leaves. It works, but it has three structural problems we fix here: `main.js` is a god-module (renderer setup, input, player controller, quality manager, the frame loop, and every `window.__` debug hook all in one file); gameplay data is hard-coded in JS (the 52-entry `PRODUCTS` array, the imperative store layout, the inline NPC spawn loop); and side-effect systems are wired by direct call (`game.js` reaches straight into `SFX.grab()`), which makes scoring, telemetry, and achievements impossible to add without editing the core loop. Everything below is a migration *from* that working state, not a green-field rewrite.

## Module Architecture

### Target directory structure

We split the flat `src/` into seven subsystem folders, each with a single responsibility and an explicit public surface:

- **`core/`** — engine spine. `app.js` (composition root; replaces `main.js`'s orchestration), `renderer.js` (WebGLRenderer + EffectComposer construction), `loop.js` (the fixed-timestep accumulator + ordered update chain), `events.js` (the typed event bus).
- **`world/`** — static scene. `store/` split from today's 81 KB `store.js` into `layout.js` (data interpreter), `fixtures.js` (gondola/wallshelf/freezer/checkout builders), `departments.js` (electronics/apparel/toys/pharmacy), `exterior.js`, `lighting.js`; plus `stock.js`, `products.js`, `materials.js`, `env.js`, `models.js` unchanged in role.
- **`sim/`** — dynamic simulation. `physics.js` (carts/gondolas/debris/bumps), `agents.js` (renamed `characters.js`), `scenario.js` (new: mode scripting).
- **`player/`** — `controller.js` (the movement + collision code lifted out of `main.js`: `move()`, `hitC()`, the `SPEED_WALK 3.1 / SPEED_RUN 4.9` constants, head-bob) and `input.js` (the input-abstraction/rebinding layer).
- **`game/`** — `objectives.js` (renamed `game.js`: list, grab, checkout), `modes.js` (mode manager), `achievements.js`.
- **`presentation/`** — `ui/` (the HUD promoted from raw DOM pokes to a real layer), `audio.js` (audio director wrapping `sfx.js`), `quality.js` (the tier manager extracted from `main.js`'s `autoQuality`).
- **`platform/`** — `save.js`, `settings.js`, `telemetry.js`, `data.js` (JSON load + validate).

### Dependency diagram and call policy

```
                 ┌─────────────── core/app.js (composition root) ───────────────┐
                 │        constructs everything, owns the event bus             │
                 ▼                                                              ▼
   core/loop.js ──(ordered per-frame calls)──►  player.controller
        │                                        sim.physics
        │  each frame, in this exact order:      world.update
        │  input → controller → physics →        sim.agents
        │  world → agents → objectives → render  game.objectives
        ▼                                        presentation.quality (probe)
   core/renderer.js ◄── presentation/quality.js (tier switches)

   events.js  ◄────── emit ──────  objectives, physics, modes, settings
        │
        └── subscribe ──►  audio.js · telemetry.js · achievements.js · ui/
   platform/data.js ──► world (SKUs, layout), sim (archetypes), game (scenarios)
   platform/save.js ◄──► settings.js, achievements.js, modes.js
```

**The policy is explicit and enforced in review.** The per-frame hot path — the update chain that runs 60×/second — uses **direct ordered calls only**, never the bus. This preserves the current allocation-free frame (the code already reuses scratch vectors like `_dir`, `_flyTarget`, `_nearDebris` precisely to avoid GC hitches) and keeps the ordering deterministic: `input → controller → physics.update → world.update → agents.update → objectives.update → composer.render`, exactly the sequence `main.js` runs today. **The event bus** (`core/events.js`, ~40 lines, synchronous, payload objects pooled so `emit` allocates nothing) carries only *low-frequency, cross-cutting gameplay facts* to *observers that produce side effects*: sound, score, analytics, achievement checks, HUD text.

The event catalog (frozen names, versioned payloads):

| Event | Payload | Emitted by | Subscribed by |
|---|---|---|---|
| `item:grabbed` | `{skuId, price, fromDebris}` | objectives | audio, telemetry, achievements |
| `list:complete` | `{size, elapsedMs}` | objectives | audio, ui |
| `checkout:done` | `{items, total, damage, timeMs}` | objectives | audio, telemetry, achievements, modes |
| `gondola:tipped` | `{label, axis, spillCount}` | physics | audio, telemetry, achievements |
| `damage:added` | `{skuId, amount, total}` | physics | ui, telemetry |
| `npc:bumped` | `{line}` | physics | audio, ui |
| `mode:changed` | `{modeId}` | modes | ui, quality |
| `settings:changed` | `{keys}` | settings | renderer, quality, audio, input, ui |

The rule stated plainly: *a system may directly call a system it constructed or owns; anything merely observing gameplay to make noise, keep score, log, or draw text subscribes to an event.* This single change lets `objectives.js` stop importing `SFX` and lets us bolt on `achievements.js` and `telemetry.js` with zero edits to the loop.

## Data-Driven Design

Today, gameplay content lives in code. Production moves all **declarative** content to JSON with schemas and validation, while keeping **procedural** content (canvas label art, mesh factories) in code where it belongs.

**Where data lives.** Gameplay-critical, small, always-needed data (SKUs, store layout, NPC archetypes, achievements) is authored as JSON under `src/data/` and **imported at build time** — Vite bundles and tree-shakes it, there is no extra network round-trip, and a malformed file fails the build. Large or optional content (scenario packs, cosmetic sets, event configs) lives under `public/data/` and is **fetched at runtime** through the existing `THREE.LoadingManager` so it can be added or hot-swapped without a rebuild. `platform/data.js` is the single entry point: it loads, validates, and hands typed objects to consumers.

### Schemas

**SKU** (`skus.json`) — the current `PRODUCTS` spec object promoted to a validated record. Grounded in the fields the mesh factories already read:

```json
{
  "id": "cereal_oat",              // unique, kebab; primary key everywhere
  "brand": "Northfield",
  "name": "Honey Oats",
  "kind": "box",                   // enum: box|boxwide|boxtall|boxbig|can|jar|
                                   //       bottle|bag|carton|cup|tub|ball|produce
  "section": "pantry",             // enum: pantry|snacks|household|dairy|bakery|
                                   //       frozen|electronics|home|toys|pharmacy|produce
  "price": 4.29,                   // number > 0; drives checkout total AND damage (0.4×)
  "weight": "450 g",
  "colorway": { "bg1":"#e8a020", "bg2":"#c6741a", "ink":"#fff",
                "accent":"#5a2d00", "tag":"Whole Grain" },
  "model": { "name":"prod_apple", "height":0.085 },   // optional photoscan override
  "spawnWeight": 1.0,              // NEW: bias for list generation / restock
  "tags": ["breakfast","grain"]    // NEW: for scavenger objectives & achievements
}
```

**Store layout** (`layout.json`) — this is the biggest win. The store today is *imperative*: `groceryXs = [-18,-14,-10,-6]`, the `faces` matrix, `merchIslands`, and hand-computed colliders. Production makes it *declarative* and lets `world/store/layout.js` interpret it, deriving colliders and the `physicsMeta.gondolas` entries automatically:

```json
{
  "dims": { "w":46, "d":30, "h":4.2 },
  "spawn": [0.6, 1.65, 13.2],
  "fixtures": [
    { "type":"gondola", "id":"g1", "pos":[-18,-3], "len":16, "axis":"z",
      "label":"1",
      "faces":[["pantry","pantry","snacks","pantry"],
               ["snacks","pantry","pantry","snacks"]] },
    { "type":"wallshelf", "id":"bakery-back", "pos":[-13,-14.72], "rot":-1.5708,
      "len":16, "sections":["bakery","bakery","snacks","pantry"] },
    { "type":"checkout", "id":"lane-2", "pos":[-8.6,10.35], "staffed":true }
  ],
  "lighting": { "rig":"night", "troffers":[...], "rectLights":[...] }
}
```

**NPC archetype** (`archetypes.json`) — replaces the inline spawn loop in `characters.js`:

```json
{ "id":"cartpusher", "role":"walker", "model":"Male_Adult_04",
  "speed":[0.8,1.2], "pause":[0,2], "pushesCart":true,
  "barks":["\"'Scuse me.\"","\"Comin' through.\""] }
```

**Scenario** (`scenarios/*.json`) — drives the mode manager:

```json
{ "id":"rush-hour", "name":"Rush Hour", "objective":"list", "listSize":6,
  "timeLimit":120, "modifiers":["crowded","slippery"],
  "win":{ "type":"listAndCheckout" },
  "reward":{ "achievement":"speed_demon" } }
```

**Achievement** (`achievements.json`) — `{id, name, desc, icon, trigger:{event,predicate}, secret}`, where `trigger.event` is one of the bus event names above and `predicate` is a small serializable expression (e.g., `"payload.timeMs < 60000"`).

### Validation

A `npm run validate-data` step runs **ajv** against JSON Schema definitions in `schema/` and is a CI gate — invalid data fails the build, never ships. In dev builds, `platform/data.js` additionally runs a lightweight runtime assert (required keys, enum membership, `price > 0`, every `section` present in `layout.json`, every `model.name` present in the kit `manifest.json`) and logs failures to `window.__dataErrors`, which the smoke suite asserts is empty. Cross-file referential integrity — a SKU's `section` must have a fixture that stocks it, a scenario's rewards must name a real achievement — is checked here too.

## Save System

Persistence is `localStorage`, one namespaced, versioned key: **`gd3d.save.v3`**. Budget is generous (5 MB available; we use well under 100 KB). Schema:

```json
{ "v":3,
  "settings": { ...see below... },
  "stats": { "runs":142, "bestTimeBySize":{"6":74200,"9":121400},
             "totalItems":880, "totalDamage":193.40, "lifetimeDistanceM":41200 },
  "achievements": { "speed_demon":1720742400000 },   // id -> unlock epoch ms
  "unlocks": { "modes":["rush-hour"], "cosmetics":["cart_gold"] },
  "daily": { "date":"2026-07-11", "seed":774411, "bestTimeMs":88900 },
  "clientId": "b3f1c2a9"           // random; the ONLY thing that ever leaves the device
}
```

**Migration policy.** A `MIGRATIONS = { 1: v1→v2, 2: v2→v3 }` map holds pure upgrade functions. On load: parse, read `v`; if `v < CURRENT`, run each migration in sequence; if `v > CURRENT` (save written by a newer build) or parse throws, **copy the raw string to `gd3d.save.corrupt.<timestamp>` and start fresh** — we never hard-lose data silently and never let a bad save crash the boot. **Write policy:** debounced 500 ms on `settings:changed`, and immediately (flushed) on `checkout:done`. Every write is wrapped in try/catch for private-mode/quota failures — a failed save degrades to in-memory-only, it never throws into the frame loop. **What persists:** settings, aggregate stats, achievements, unlocks, the daily record, and `clientId`. **What does not:** transient run state — a run is 60–180 s, there is no mid-run save. `save.js` also exposes `exportBlob()` / `importBlob(json)` (JSON to clipboard or `.json` file) so players can back up and support can reproduce.

## Settings System

All settings live under `save.settings` and are applied through one idempotent `applySettings(s)` that fans out to the renderer, quality manager, audio director, input layer, and `:root` CSS custom properties, then emits `settings:changed`.

### Graphics

`qualityMode` = `auto | lite | high | panic`, mapping directly onto the existing tiers. **`auto`** runs today's probe (below); a forced mode skips the probe and applies at boot. Sub-controls: `pixelRatioCap` (0.75–2.0; today hard-coded `min(devicePixelRatio, 1.25)`), `shadows` = `frozen | off` (frozen is the current default: rendered once, `autoUpdate=false` after frame 3), `bloom` on/off, `gtao` on/off (forced off below high), `resolutionScale` (0.7–1.0, drives `composer.setSize`). The panic path — today `renderer.setPixelRatio(1)` — additionally drops bloom to quarter-res or off.

### Audio

`sfx.js` currently exposes one master gain (0.45) and a mute. Production splits the graph in `audio.js`: `master → { sfxBus, ambientBus }`, with `masterVolume`, `sfxVolume`, `ambientVolume` (the low-pass store hum), all 0–1. `M` still toggles global mute. The audio director subscribes to the bus, so `objectives.js` no longer calls `SFX` directly.

### Controls (remapping)

`input.js` owns a reverse map `KeyboardEvent.code → actionId`, rebuilt whenever bindings change. Default bindings, promoted from the scattered `keydown` handlers:

| Action | Default | Notes |
|---|---|---|
| move fwd/back/left/right | `KeyW/S/A/D` + arrows | dual-bound today |
| sprint | `ShiftLeft/Right` | `SPEED_RUN 4.9` |
| interact | `KeyE` | grab / pick debris (`REACH 2.7`) |
| new list | `KeyR` | only when a run is `done` |
| mute | `KeyM` | |
| **pause** (new) | `Escape` | **unbindable**, always pauses/opens menu |
| **map** (new) | `Tab` | store overview |

Plus mouse `sensitivity` (base `0.0042` → 0.5×–2.0× multiplier) and `invertY`. Rebind UI writes `settings.controls.bindings = { actionId: ["KeyD","ArrowRight"] }`.

### Accessibility

First-class, not an afterthought, because several map onto existing mechanics: `reduceMotion` clamps `physics.shake` to 0 (the shake term in the camera-Y expression); `reduceCameraBob` zeroes the head-bob amplitude (`Math.sin(bob)*0.045`); `hudScale` (0.8–1.5) drives a `--hud-scale` CSS var on the HUD elements; `highContrastHUD` swaps the translucent panels for opaque; `colorblindMode` (prot/deut/trit) re-palettes the load-bearing greens — the emissive checkout ring (`0x35c46a`), the list check marks, and the red sale tags — to a safe scheme; `holdToInteract` vs tap for the grab; `photosensitiveSafe` clamps bloom flash intensity. Toast/bark text is already on-screen, satisfying subtitles for free.

## Performance Budgets

The current worst view is **~988 draw calls**; the loop already caps `dt` at 0.05 s and the tier probe samples frames 20–80. We formalize per-tier budgets and fix the one architectural perf bug.

### Per-tier targets (worst-case single view)

| Tier | Floor GPU | Frame budget | Draw calls | Tris | Post stack | pixelRatio |
|---|---|---|---|---|---|---|
| **panic** | Intel UHD 620 | 33 ms (30 fps floor) | ≤ 700 | ≤ 900 K | Render→Output (bloom off/¼) | 1.0, resScale 0.85 |
| **lite** (default) | Iris Xe / old dGPU | 16.6 ms | ≤ 988 | ≤ 1.5 M | Render→Bloom(½-res)→Output, MSAA×2 | ≤ 1.25 |
| **high** | RTX / Apple Silicon | 10 ms | ≤ 1400 | ≤ 3 M | Render→GTAO→Bloom→Output, MSAA×4 | ≤ 1.5 |

### The probe, plus a runtime watchdog

Keep the current boot probe: sample `dt` for frames 20–80 (60 frames), `avg = acc/60`; `avg < 0.020 →` high, `avg > 0.055 →` panic, else `lite-locked`. **Add a runtime watchdog** the current build lacks — after the initial probe, the game never downgrades even if a later view tanks. `quality.js` maintains an EMA: `ema = ema*0.9 + dt*0.1`; if `ema > tierBudget*1.4` sustained > 2 s, step down one tier; only step back up if `ema < tierBudget*0.7` sustained > 6 s. The hysteresis (1.4× down / 0.7× up, asymmetric dwell) prevents flapping when the player pans across a heavy view.

### Region-split instancing (the real fix)

Today `stock.js` builds **one `InstancedMesh` per SKU spanning the whole store**. Its bounding sphere therefore covers all 46×30 m, so frustum culling can *never* drop it — every SKU draws even when you face a single aisle. The fix is to batch instances **per fixture** rather than per SKU-globally. `emitSlots` already emits slots per fixture, so the natural unit exists: each gondola face, wall segment, and endcap becomes its own `InstancedMesh` group with a tight bounding box, culled as a unit. A SKU present in six fixtures becomes six meshes — total scene draw *count* rises, but the *visible* count per view falls because off-screen aisles cull out, keeping worst-view draws at or under the current 988. Bonus: `hideInRegion` (used by gondola tips and knock-offs) then touches one fixture's `instanceMatrix` instead of scanning every SKU's global handle list.

### LOD and memory

**People LOD** is the missing win: all 13 Rocketbox avatars run `mixer.update(dt)` every frame regardless of distance or visibility. Tier by distance: L0 full skinned (< 8 m), L1 half-rate mixer (8–16 m, update every other frame), L2 frozen pose (> 16 m or off-screen, skip the mixer entirely). Produce photoscans are already decimated offline (`simplify --ratio 0.1–0.6`); cars are Kenney low-poly. **Texture memory:** the 52 procedural labels at 512×640 (1024×420 wraparound) sRGB + mips cost ~1.7 MB GPU each → ~90 MB just for labels — real pressure on iGPU. Mitigations: anisotropy 8→4 on lite/panic, cap the label canvas to 512² on panic, and ship the *non-procedural* PBR sets (floor/wall/wood/asphalt, currently JPG 1k) as **KTX2/Basis** compressed. GPU texture budgets: panic ≤ 256 MB, lite ≤ 512 MB, high ≤ 1 GB.

### Loading budget

The ~2.7 s shader-compile storm is paid behind the boot screen via `renderer.compile(scene, camera)`. Target **TTFI ≤ 4 s** on the iGPU floor over broadband: asset fetch ≤ 1.5 s warm / ≤ 3 s cold, `buildStore` ≤ 400 ms, `buildStock` ≤ 300 ms, compile ≤ 2.7 s. Two concrete r160 wins: swap the blocking `renderer.compile` for **`await renderer.compileAsync(scene, camera)`**, which yields to the browser and lets the boot bar animate instead of freezing; and add a `KTX2Loader` to shrink texture downloads. The PWA (below) makes every repeat visit near-instant by serving assets from Cache Storage, leaving only the compile.

## Rendering Roadmap

The post stack is per-tier as tabled above, built on the existing HalfFloat render target. Panic collapses to `RenderPass → OutputPass` (MSAA off); lite keeps the current half-res `UnrealBloom(0.16, 0.5, threshold 0.96)` so only true emitters — troffers, LEDs, demo screens — bloom while bright surfaces stay clean; high adds `GTAOPass` (radius 0.35, 8 samples, blend 0.85, exactly today's config) and MSAA×4.

**Day/night rigs.** The scene is a night parking lot with a warm interior. Production stores **two lighting rigs as data** in `layout.json` — `night` (current) and `day` (bright exterior via a day HDRI + a directional sun, lower interior contrast). Because shadows are frozen (`autoUpdate=false`), switching rigs requires a single-frame `shadow.needsUpdate = true` re-bake, then re-freeze. **Baked vs realtime:** the shell is static, so we bake further than today — offline-bake interior AO/lightmaps into the floor/walls/gondola bodies so **GTAO becomes optional polish rather than the primary occlusion channel**, removing it from the lite critical path entirely. Emissive materials continue to drive bloom; the 0.96 threshold stays.

## Asset Pipeline as a First-Class Tool

The two existing scripts — `fetch-assets.mjs` (Poly Haven textures/HDRI + donor rigs) and `fetch-models.mjs` (Kenney cars + Poly Haven photoscans through gltf-transform) — become a governed `pipeline/` toolchain.

**Manifests are the single source of truth.** `assets.manifest.json` and the existing kit `manifest.json` (extended) carry, per asset: `{name, source, license, sha256, ops:[...], out}`. **Idempotent + verified:** skip when `out` exists *and* its sha256 matches the manifest — today `fetch-models.mjs` skips on mere existence, which lets a truncated download persist; hash verification closes that. **Ops are declarative:** `tga2jpg`, `resize:1024`, `simplify:0.22`, `pack-glb`, and a new `ktx2` (Basis ETC1S/UASTC) op — the single biggest download reduction. **License ledger:** the pipeline *generates* `CREDITS.md` from the `license` fields (it is hand-maintained today); CI fails if any shipped asset lacks a license row.

**Validation CI — formalized headless render smoke tests.** The build already self-verifies via framebuffer sampling and `window.__` hooks; we make that a job. A headless Chromium runner (Playwright, real GPU or SwiftShader) loads the built app, waits on `window.__ready`, and asserts: `!window.__err`; the center framebuffer pixels are not uniform black/single-color (the existing sampling technique — proves the scene actually rendered); `window.__stock.counts.skus === 52`; `window.__npcs.length` equals the expected avatar count; and `renderer.info.render.calls` is under the tier budget at a canonical worst-view pose. `window.__dataErrors` and `window.__retargetLog` must show no fatals.

## Testing Strategy

The `window.__` harness graduates into a three-tier suite.

**1. Unit (Vitest, no WebGL, < 2 s, every commit).** We extract the pure logic currently trapped in closures into importable modules: list generation (`genList` — six distinct available specs), damage math (`price × 0.4`), timer format (`fmt`), AABB and circle collision (`hitC`, `circleVsColliders`), tip-sign resolution, save migrations, `applySettings`, and data validation. This refactor (pulling `objectives.core.js`, `sim/collide.js`, `platform/save.js` out of their closures) is itself a testability improvement.

**2. Smoke (Playwright + GL, on PR).** Boots the built app and drives it through the hooks:
- *List-complete run* — `window.__setPlaying(true)`, teleport `__camera` to each list item's slot, invoke `__game.tryGrab()`, walk into the checkout ring, assert `__game.state.done` and a printed total. Proves the whole core loop.
- *Physics battery* — sprint the camera into a gondola, assert it tips (debris count rises past the spill, `damage.count` increments), that no exception fires and the loop keeps advancing; a cart-shove test; a debris-settle test (spawn N, advance the sim, assert all `resting` and that `DEBRIS_TTL 28` cleanup fires). Determinism comes from the store's fixed `seed 1337`; we make the physics RNG seedable for tests too.
- *Perf regression gate* — after boot, render 300 frames at the canonical worst view (camera at a committed pose down the longest aisle), record `renderer.info.render.calls`, tri count, and median frame time; fail if calls exceed the tier budget or median regresses > 15 % versus a committed `test/baselines/*.json`.

**3. Visual regression (nightly, tolerant).** Canvas screenshots at fixed poses diffed against golden PNGs with a loose threshold — catches accidental all-black frames or a whole department failing to build. Unit gates every push; smoke + perf gate every PR; visual runs nightly; all block merge.

## Release Engineering

**Build.** `vite build` → `dist/`, `base:'./'` already set so it runs from any subpath or `file://`. Add `manualChunks` to split the three.js vendor bundle from game code for cache longevity; Vite's hashed filenames handle cache-busting. Inject `__VERSION__` from `package.json` via Vite `define` so the boot screen, telemetry, and crash log all stamp the build.

**Hosting.** Static, no backend by default — GitHub Pages or Netlify, published from `dist/` by a tagged GitHub Action. **itch.io**: `vite build`, zip `dist/`, `butler push dist/ user/grocery-dash:html5`. The existing drag-to-look fallback (`enableFallback`, triggered when pointer-lock is refused or swallowed) is *essential* here — itch serves HTML5 games in a sandboxed iframe that often blocks pointer lock, and the fallback is what keeps the game playable there.

**PWA / offline.** A service worker (Workbox or a ~60-line hand-rolled SW) precaches the app shell plus the hashed assets (textures, HDRI, models, JSON data) on first load, plus a `manifest.webmanifest` (fullscreen, landscape, icons) for installability. Result: fully offline replay, and repeat boots that skip all fetching — only the shader compile remains. The SW is gated off in dev.

**Crash reporting, local-first.** The app already sets `window.__err` and paints a red error pane. Formalize with global `error`/`unhandledrejection` handlers writing a ring buffer of the last N errors — each tagged with tier, the `WEBGL_debug_renderer_info` GPU string, version, and settings — to `localStorage['gd3d.crashlog']`, surfaced via an in-game "copy diagnostics" button. Add a `webglcontextlost` handler: pause the loop, show a "rendering restarted" toast, restore on `webglcontextrestored`. Nothing leaves the device unless the player opts in.

## Backend-Optional Design

Everything above stands alone. Online features are a **strictly-additive serverless skin** (Netlify Function or Cloudflare Worker), never required to play.

**Dailies are the archetype of the local-first split.** The daily challenge — same shopping list, same store seed for everyone — is derived *client-side* from the UTC date: `seed = hash("YYYY-MM-DD")`, feeding both the store RNG (which already takes a seed) and list generation. The *content* is deterministic-from-date and works with the network unplugged; only the *shared leaderboard* is online.

**Leaderboards.** On `checkout:done`, optionally POST `{mode, size, timeMs, damage, version, clientId, nonce}`; the function applies plausibility bounds (time within human range, `damage ≥ 0`, a signed nonce to blunt spam) and writes to KV/D1; a GET returns top-N for the side panel. If the fetch fails, **the panel simply hides** — gameplay is untouched. Server-side replay validation is explicitly out of scope for a browser game; plausibility bounds are best-effort. `clientId` is a random token from the save, never PII.

**Remote flags.** An optional `flags.json` fetched with a short timeout and a **bundled fallback**, for toggling seasonal events without a redeploy; on timeout, bundled defaults win.

**Privacy boundary.** Only aggregate run stats and the random `clientId` ever leave the device, only on the leaderboard opt-in. The game is fully playable, savable, and replayable offline — the server adds a scoreboard, and nothing more.


---

# PART 5 — DELIVERY PLAN & RISK REGISTER

## 5.1 Build order (dependency-sorted)

Every [BUILD] item in Parts 1–4, sequenced so nothing blocks:

1. **Foundation wave** — input abstraction + rebinding, save/settings system,
   mode-manager & ruleset objects, event bus (Part 4). Everything else hangs off
   these.
2. **Presence wave** — visible player cart + hands, grab polish, gamepad + touch
   schemes, results screen (Part 2). The game stops feeling like a camera.
3. **Modes wave** — Time Attack, Endless, Chaos, Zen, Daily seed plumbing
   (Part 1). Career ships last inside this wave since scenarios consume all
   other systems.
4. **World wave** — catalog to ~150 SKUs, NPC archetypes + cast expansion,
   PA/audio director, day/night + weather rigs, seasonal overlays (Part 3).
5. **Ship wave** — telemetry-lite, automated smoke suite in CI, PWA packaging,
   itch.io/static deploy, launch content lock (Part 4).

Each wave lands behind the perf gates in Part 0.6 — a wave that cannot hold
30 fps on the Intel floor in lite tier does not merge.

## 5.2 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| iGPU perf ceiling breached by content growth (150 SKUs, crowds) | High | High | Region-split instancing (Part 4), per-wave perf battery, content budgets per department |
| Whole-store instanced batches defeat frustum culling at worst views | Certain (known) | Medium | Cell-keyed batch splitting — scheduled in Foundation wave |
| Rocketbox child/extra avatars fail the retarget sanity gate | Medium | Low | Gate already rejects bad bakes; cast grows only with verified rigs |
| Browser audio policy breaks the audio director | Medium | Medium | All audio behind first-gesture unlock (already shipped); director must queue, not fire-and-forget |
| localStorage save corruption | Low | Medium | Versioned schema + checksum + automatic reset-with-backup (Part 4) |
| Scope creep past the playbook | High | High | This document is the contract; features not traceable to a section get a playbook amendment first |

## 5.3 Definition of done (production)

The game is **done** when: all Part 1 modes are playable and graded; the Part 2
input matrix (KB/M, gamepad, touch) passes on hardware; the Part 3 catalog,
cast, and audio inventories are at counts; the Part 4 smoke suite is green in
CI on every commit; and a cold load on Intel UHD reaches interactive in < 8 s
and holds ≥ 30 fps through the full physics battery. Nothing else is required;
nothing less is acceptable.
