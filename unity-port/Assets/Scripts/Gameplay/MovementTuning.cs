// -----------------------------------------------------------------------------
// MovementTuning.cs  —  Grocery Dash → Unity 6 port, Phase 1
//
// The complete §3.3 §2 movement/physics tuning, captured VERBATIM from the
// porting bible. These numbers are playtested — transfer unchanged (bible §1:
// "Resist 'improving' tuning during the port").
//
// Authority: docs/PORTING_TO_UNITY.md
//   §3.3 §2  "Movement / physics constants (VERBATIM)"
//   §3.3 §3  "Control modes" (turn rates, deadzone, heading lerp, 28px snap)
//   §3.3 §1  "State machines" (60px re-attach proximity, 80px checkout proximity)
//   §3.3 (Misc logic constants worth carrying over)
//
// ============================ PX -> WORLD-UNITS POLICY =========================
// Every SOURCE constant below is in PIXELS (px, px/s, px/s^2) per the bible.
// They are converted to world units ONCE here, via GameConstants.PX (= 0.01,
// i.e. 100px = 1 wu), and ONLY for the dimensional quantities (speeds, accel,
// radii, distances). The raw px value is documented in a comment next to each
// converted constant so the source is traceable.
//
// UNITLESS quantities — friction RATES, the icy multiplier, turn RATES (rad/s),
// the stick deadzone, the heading-lerp factor, and the brake-detection
// thresholds — are NOT scaled; they stay exactly as authored (bible: "Frictions/
// turn-rates/deadzone are unitless and stay as-is").
//
// NOTE: friction decay is applied per-frame as  v -= v * min(1, rate*mult*dt)
// (exponential-ish decay, NOT constant deceleration), so the friction RATE is
// dimensionally 1/s and is scale-invariant — do not multiply it by PX.
// =============================================================================

using UnityEngine;

namespace GroceryDash.Core
{
    /// <summary>
    /// Static holder for all Phase 1 movement tuning (bible §3.3 §2/§3). Pure
    /// constants; no scene dependencies. World-unit values are derived once from
    /// the px source via <see cref="GameConstants.PX"/>; the px source is noted
    /// in each comment. Unitless rates/factors are left as-authored.
    /// </summary>
    public static class MovementTuning
    {
        // =====================================================================
        // §3.3 §2 — Speeds / acceleration  (px[/s][/s^2] -> world units; * PX)
        // =====================================================================

        /// <summary>On-foot walk speed. Source: <c>_playerWalkSpeed = 260</c> px/s.</summary>
        public const float PlayerWalkSpeed = 260f * GameConstants.PX;        // 2.60 wu/s

        /// <summary>Hard speed clamp on the cart when pushing. Source: <c>_cartMaxSpeed = 220</c> px/s.</summary>
        public const float CartMaxSpeed = 220f * GameConstants.PX;           // 2.20 wu/s

        /// <summary>Cart acceleration along heading. Source: <c>_cartAccel = 900</c> px/s^2.</summary>
        public const float CartAccel = 900f * GameConstants.PX;              // 9.00 wu/s^2

        // =====================================================================
        // §3.3 §2 — Friction RATES  (UNITLESS decay rates, 1/s; NOT scaled)
        //
        // Applied as: v -= v * min(1.0, rate * frictionMult * dt). Snap v to 0
        // when |v| < SpeedSnapToZero. Preserve the min(1.0, ...) clamp — it
        // prevents friction from overshooting and reversing velocity at large dt.
        // =====================================================================

        /// <summary>Idle velocity-decay rate. Source: <c>_cartFriction = 5.0</c> (unitless).</summary>
        public const float CartFriction = 5.0f;

        /// <summary>Extra decay rate while braking. Source: <c>_cartBrakeFriction = 14.0</c> (unitless).</summary>
        public const float CartBrakeFriction = 14.0f;

        /// <summary>
        /// Friction multiplier inside the 'frozen' aisle (slippery; less decay).
        /// Source: <c>_icyFrictionMult = 0.35</c> (unitless). Phase 1 exposes the
        /// hook; the 'frozen' trigger volume that toggles it is wired in Phase 4.
        /// </summary>
        public const float IcyFrictionMult = 0.35f;

        /// <summary>Default (non-icy) friction multiplier.</summary>
        public const float NormalFrictionMult = 1.0f;

        // =====================================================================
        // §3.3 §2 — Body radii  (px -> world units; * PX)
        //
        // Used as CharacterController radius and for the (later) bump/overlap
        // queries. The Dart slide() modelled the body as a circle of this radius.
        // =====================================================================

        /// <summary>Player body radius. Source: <c>_playerRadius = 14</c> px.</summary>
        public const float PlayerRadius = 14f * GameConstants.PX;            // 0.14 wu

        /// <summary>Cart body radius. Source: <c>_cartRadius = 22</c> px.</summary>
        public const float CartRadius = 22f * GameConstants.PX;              // 0.22 wu

        // =====================================================================
        // §3.3 §3 — First-person (tank) turn RATES  (UNITLESS, rad/s; NOT scaled)
        //
        // heading += stick.x * turnRate * dt. Only CameraMode.FirstPerson uses
        // these tank/turn controls (§3.3 §12; load-bearing).
        // =====================================================================

        /// <summary>Cart turn rate when pushing (first-person). Source: <c>turnRate = 2.6</c> rad/s.</summary>
        public const float CartTurnRate = 2.6f;

        /// <summary>Player turn rate on foot (first-person). Source: <c>turnRate = 2.8</c> rad/s.</summary>
        public const float OnFootTurnRate = 2.8f;

        // =====================================================================
        // §3.3 §3 — Analog (top-down/follow-cam) heading lerp  (UNITLESS factor)
        //
        // Used by SideScroll/TopDown control branch (not driven in Phase 1, hook
        // only): cart.heading = lerpAngle(heading, targetHeading, dt * 5).
        // Source: heading lerp rate "dt*5". (Visual-only display-heading lags
        // dt*7 and cart pitch dt*8 are render polish — out of Phase 1 scope.)
        // =====================================================================

        /// <summary>Analog-mode cart heading lerp factor. Source: <c>lerpAngle(..., dt*5)</c>.</summary>
        public const float AnalogHeadingLerpRate = 5f;

        // =====================================================================
        // §3.3 §2/§3 — Input deadzone + brake detection  (UNITLESS; NOT scaled)
        // =====================================================================

        /// <summary>
        /// Stick deadzone: movement only applies when stick magnitude > this.
        /// Source: <c>joystick.distance > 0.08</c>. Stick magnitude is clamped to [0,1].
        /// </summary>
        public const float StickDeadzone = 0.08f;

        /// <summary>
        /// Brake detection: braking when current speed > this (and forwardAmount
        /// < <see cref="BrakeForwardThreshold"/> and the velocity opposes the
        /// requested forward). Source: <c>vSpeed > 20</c> (px/s) -> world units.
        /// </summary>
        public const float BrakeSpeedThreshold = 20f * GameConstants.PX;     // 0.20 wu/s

        /// <summary>
        /// Brake detection: the requested forward amount must be below this
        /// (i.e. clearly reversing). Source: <c>forwardAmount < -0.2</c> (unitless).
        /// </summary>
        public const float BrakeForwardThreshold = -0.2f;

        // =====================================================================
        // §3.3 §2 — Velocity snap-to-zero threshold  (px/s -> world units; * PX)
        // =====================================================================

        /// <summary>
        /// Below this speed, velocity snaps to exactly 0 (stops creeping).
        /// Source: "Velocity snaps to 0 when |v| < 1" (px/s) -> world units.
        /// </summary>
        public const float SpeedSnapToZero = 1f * GameConstants.PX;          // 0.01 wu/s

        // =====================================================================
        // §3.3 §3 — Player "snap behind cart" offset  (px -> world units; * PX)
        //
        // While pushing, every frame: player is placed at
        //   player.pos = cart.pos - forward(cart.heading) * PlayerBehindCartOffset
        //   player.facing = cart.heading
        // =====================================================================

        /// <summary>Distance the player is snapped BEHIND the cart heading. Source: <c>28</c> px.</summary>
        public const float PlayerBehindCartOffset = 28f * GameConstants.PX;  // 0.28 wu

        // =====================================================================
        // §3.3 §1 — Interaction proximities  (px -> world units; * PX)
        // =====================================================================

        /// <summary>
        /// Max distance to take a parked cart back (onFoot -> pushing). Source:
        /// re-attach proximity <c>dist(player, cart) <= 60</c> px. (Phase 1.)
        /// </summary>
        public const float TakeCartProximity = 60f * GameConstants.PX;       // 0.60 wu

        /// <summary>
        /// Max distance to a checkout interact point to begin checkout. Source:
        /// checkout proximity <c>d < 80</c> px. (Hook only; Phase 4 — §3.3 §6.)
        /// </summary>
        public const float CheckoutProximity = 80f * GameConstants.PX;       // 0.80 wu

        // =====================================================================
        // §3.3 §4 — Reach focus + cancel  (Phase 2 hooks; captured now)
        // =====================================================================

        /// <summary>
        /// Shelf-slot focus search radius (the game's override of the 46px
        /// default). Source: <c>nearest(..., within: 60)</c> px. (Phase 2.)
        /// </summary>
        public const float FocusSearchRadius = 60f * GameConstants.PX;       // 0.60 wu

        /// <summary>
        /// Stick magnitude above which an in-progress reach is cancelled.
        /// Source: <c>joystick.distance > 0.5</c> (unitless). (Phase 2.)
        /// </summary>
        public const float ReachCancelStickThreshold = 0.5f;
    }
}
