// -----------------------------------------------------------------------------
// KeyboardMovementInput.cs  —  Grocery Dash → Unity 6 port, Phase 1
//
// Desktop keyboard implementation of IMovementInput, for testing the core feel
// before a touch joystick exists. Uses Unity 6's Input System LOW-LEVEL POLLING
// (UnityEngine.InputSystem.Keyboard.current) so NO .inputactions asset and no
// PlayerInput component are required — pure code.
//
// PACKAGE DEPENDENCY: requires com.unity.inputsystem (the Input System package;
// shipped with / installable in Unity 6). Add it via Package Manager if not
// present. If the project is on the legacy Input Manager only, this file will
// not compile — swap to UnityEngine.Input, or (preferred) enable the new Input
// System (Project Settings > Player > Active Input Handling = "Input System" or
// "Both").
//
// Controls:
//   Move      : WASD / Arrow keys   (up = forward; left/right = turn)
//   Interact  : Space / Enter       (begin reach / begin checkout — later phases)
//   Park/Take : P                   (toggle cart attached/parked)
//
// This is NOT a MonoBehaviour — it is a plain class the controller owns and
// Poll()s each frame. Replace with a TouchJoystickMovementInput later by
// constructing a different IMovementInput; the controllers never change.
//
// Authority: docs/PORTING_TO_UNITY.md §3.3 §2/§3 (stick + deadzone + edges).
// -----------------------------------------------------------------------------

using UnityEngine;
using UnityEngine.InputSystem;   // com.unity.inputsystem — see header note.

namespace GroceryDash.Core
{
    /// <summary>
    /// Keyboard-driven <see cref="IMovementInput"/> using the Input System's
    /// low-level <see cref="Keyboard.current"/> polling (no input-actions asset).
    /// Intended for desktop playtesting in Phase 1; a touch joystick replaces it
    /// later by swapping the <see cref="IMovementInput"/> the controller holds.
    /// </summary>
    public sealed class KeyboardMovementInput : IMovementInput
    {
        public Vector2 Move { get; private set; }
        public bool InteractPressed { get; private set; }
        public bool ParkPressed { get; private set; }

        /// <inheritdoc/>
        public void Poll()
        {
            var kb = Keyboard.current;
            if (kb == null)
            {
                // No keyboard device (e.g. headless / device unplugged): no input.
                Move = Vector2.zero;
                InteractPressed = false;
                ParkPressed = false;
                return;
            }

            // --- Move stick (WASD / arrows). Up = forward (+y). -------------
            float x = 0f;
            float y = 0f;
            if (kb.aKey.isPressed || kb.leftArrowKey.isPressed) x -= 1f;
            if (kb.dKey.isPressed || kb.rightArrowKey.isPressed) x += 1f;
            if (kb.wKey.isPressed || kb.upArrowKey.isPressed) y += 1f;   // up = forward
            if (kb.sKey.isPressed || kb.downArrowKey.isPressed) y -= 1f;

            // Clamp stick magnitude to [0,1] (bible §3.3 §2: "Stick magnitude is
            // clamped to [0,1]."). Vector2.ClampMagnitude preserves direction and
            // normalises a diagonal (|(1,1)| = 1.41 -> 1.0) so diagonal isn't
            // faster than cardinal — matching a real analog stick.
            Move = Vector2.ClampMagnitude(new Vector2(x, y), 1f);

            // --- Edge-triggered buttons (wasPressedThisFrame) ---------------
            // Interact: Space OR Enter.
            InteractPressed = kb.spaceKey.wasPressedThisFrame
                              || kb.enterKey.wasPressedThisFrame;

            // Park / take cart: P.
            ParkPressed = kb.pKey.wasPressedThisFrame;
        }
    }
}
