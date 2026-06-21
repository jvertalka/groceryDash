# Grocery Dash → Unity 6 port (staging)

C# scripts for the Unity rebuild, generated from [`../docs/PORTING_TO_UNITY.md`](../docs/PORTING_TO_UNITY.md)
(the porting bible). This folder is a **staging area** — Unity isn't run here; you
copy these scripts into a real Unity project's `Assets/`.

## Status: Phase 0 ✅ + Phase 1 ✅ (code parts)

| File | What it is |
|------|------------|
| `Assets/Scripts/Core/GameConstants.cs` | Global **100 px = 1 world unit** scale (`PX = 0.01f`) + the Dart/Flutter→Unity coordinate helpers. The store's `+y-is-south` world is flipped to Unity's XZ ground plane (`Z = north`) in **one place** (`ToWorldZ`). Heading helpers (`DartHeadingToYaw`, `DartHeadingToForward`, …) convert Dart radians (0 = east, CW) to Unity yaw. Store dims: `2400×1600 px` = `24×16 wu`. |
| `Assets/Scripts/Core/GameEnums.cs` | `GameMode`, `CameraMode`, `ItemRarity`, `ItemShape`, `ShelfStyle` — verbatim source order (explicit int values) so they line up with the bible's data tables. |
| `Assets/Scripts/Core/GameManager.cs` | Run-owning MonoBehaviour **stub**: holds current `GameMode`/`CameraMode`, three serialized camera-rig slots, `SwitchCamera()`, and stubbed `StartRun`/`EndRun` lifecycle with `// TODO Phase N` markers. No gameplay yet. |

Namespace: `GroceryDash.Core`. Target: **Unity 6 (6000.x)**.

## How to use these

1. **Install Unity 6** (6000.x LTS) via Unity Hub. Create a **new 3D (URP)** project.
2. Copy this folder's **`Assets/Scripts`** into your project's `Assets/`.
3. In your scene, create an empty GameObject named **`GameManager`** and add the
   `GameManager` component (Add Component → GroceryDash → Game Manager).
4. Press Play — it compiles and runs (does nothing visible yet; that's Phase 1).

## What's code vs. what you do in the Editor

- **Code (done here):** the constants, enums, and the manager stub.
- **Editor (your hands):** creating the Unity project, scenes, and GameObjects;
  building the three **camera rigs** as GameObjects and dragging them into the
  `GameManager`'s rig slots; making prefabs/materials; baking lighting.

## Conventions baked in (don't re-derive)

- **Scale:** every source-pixel constant from the bible × `GameConstants.PX`. e.g.
  walk speed `260 px/s` → `2.6 wu/s`.
- **Coordinates:** always go through `GameConstants.ToWorld(...)` / `ToPixels(...)`.
  The `+y-south → +z-north` flip lives only in `ToWorldZ`; never flip again.
- **Headings:** `GameConstants.DartHeadingToYaw(h)` / `DartHeadingToRotation(h)`.
  (Spawn faces `-π/2` in Dart = **north** = Unity yaw 0.)

## Phase 1 — first-person walk + pushable cart ✅ (code)

In `Assets/Scripts/Gameplay/` (drop in alongside `Core/`):

| File | What it is |
|------|------------|
| `PlayerEnums.cs` | `PlayerMode` (pushing/onFoot/reaching/checkout) + `CartState` (attached/parked), verbatim order. |
| `MovementTuning.cs` | Every §3.3 movement constant, verbatim; px→units once via `GameConstants.PX` (walk 2.6, cart max 2.2, accel 9.0, frictions 5/14, icy 0.35, turn 2.6/2.8, deadzone 0.08, snap-behind 0.28, take-cart 0.60). |
| `CartController.cs` | Kinematic cart: accel-along-heading, brake/idle friction (`v -= v*min(1,rate*dt)`), speed clamp, icy hook, wall-slide via `CharacterController.Move` + contact-normal velocity cancel. |
| `PlayerController.cs` | Tank controls, pushing-vs-onFoot, snap-28px-behind-cart, park/take by 60px proximity. Only FirstPerson is fully wired; SideScroll/TopDown have clean (source-space-correct) hooks. |
| `IMovementInput.cs` / `KeyboardMovementInput.cs` | Input abstraction + a desktop keyboard impl (WASD/arrows, Space/Enter = interact, P = park) via the Input System's `Keyboard.current`. Swap in a touch joystick later without touching the controllers. |

**Package note:** `KeyboardMovementInput` needs the **Input System** package
(`com.unity.inputsystem`, default in Unity 6). If your project is legacy-Input-only,
either enable the Input System (Player → Active Input Handling) or swap that one file.

### Editor setup for the Phase 1 milestone
1. A floor plane + a few wall `BoxCollider`s (an empty room is fine for now).
2. **Player**: GameObject + `CharacterController` + `PlayerController`. **Cart**: GameObject
   + `CharacterController` + `CartController`. Drag the cart into the player's `cart` slot.
3. A camera (child of, or following, the player). Press Play.
4. **Milestone:** drive the cart around, press **P** to park, walk on foot, walk back
   within 0.6 wu, press **P** to pick it up again.

## Next: Phase 2

One shelf + reach-to-grab + stock depletion (bible §3.3 §4 / §3.4 §5). Ask Claude to
generate it once you've felt Phase 1 in the Editor.
