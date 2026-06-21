// -----------------------------------------------------------------------------
// IMovementInput.cs  —  Grocery Dash → Unity 6 port, Phase 1
//
// The minimal input abstraction for the player/cart controllers. Decouples the
// movement logic from the input source so a touch joystick (mobile, the Flutter
// original's input) can replace the desktop keyboard later without touching the
// controllers.
//
// Authority: docs/PORTING_TO_UNITY.md
//   §3.3 §2/§3 — the source "joystick" is a 2D stick (magnitude clamped [0,1],
//     deadzone 0.08). Move maps to that stick: Move.x = joystick.dx (turn /
//     strafe), Move.y = joystick.dy where stick-UP must read as forward and the
//     controller applies forwardAmount = -Move.y (§3.3 §3 "stick up = forward").
//   §3.3 §1 — interact (begin reach / begin checkout) and park/take cart.
// -----------------------------------------------------------------------------

using UnityEngine;

namespace GroceryDash.Core
{
    /// <summary>
    /// Per-frame movement + interaction input, source-agnostic. The Dart
    /// "joystick" becomes <see cref="Move"/>: a 2D stick vector with magnitude
    /// clamped to [0,1]. By source convention stick-UP = forward, so consumers
    /// use <c>forwardAmount = -Move.y</c> (see PlayerController / §3.3 §3) and
    /// gate motion on <c>Move.magnitude > MovementTuning.StickDeadzone</c>.
    ///
    /// <para><see cref="InteractPressed"/> / <see cref="ParkPressed"/> are EDGE
    /// signals (true for the single frame the button went down), matching the
    /// Dart one-shot calls <c>onInteractPressed</c> / <c>toggleCartAttached</c>.</para>
    /// </summary>
    public interface IMovementInput
    {
        /// <summary>
        /// 2D stick. <c>x</c> = turn (first-person) / horizontal (analog);
        /// <c>y</c> = forward axis where stick-UP is positive (consumer negates).
        /// Magnitude is clamped to [0,1] by the implementation.
        /// </summary>
        Vector2 Move { get; }

        /// <summary>True only on the frame the interact button went down (reach/checkout).</summary>
        bool InteractPressed { get; }

        /// <summary>True only on the frame the park/take-cart button went down.</summary>
        bool ParkPressed { get; }

        /// <summary>
        /// Poll the input source once for this frame. Call exactly once per
        /// frame (e.g. from the controller's Update) BEFORE reading the
        /// properties so the edge signals are computed against the prior frame.
        /// </summary>
        void Poll();
    }
}
