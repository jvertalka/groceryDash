# Grocery Dash → Unity 6 port (staging)

C# scripts for the Unity rebuild, generated from [`../docs/PORTING_TO_UNITY.md`](../docs/PORTING_TO_UNITY.md)
(the porting bible). This folder is a **staging area** — Unity isn't run here; you
copy these scripts into a real Unity project's `Assets/`.

## Status: Phase 0 — project skeleton ✅ (code parts)

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

## Next: Phase 1

Player `CharacterController` + pushable cart with the verbatim movement constants
(bible §3.3). Ask Claude to generate it when your Unity project is standing.
