// -----------------------------------------------------------------------------
// CartController.cs  —  Grocery Dash → Unity 6 port, Phase 1
//
// The shopping cart: a kinematic body driven by MANUAL velocity integration that
// matches the bible's pushing-cart pipeline VERBATIM, moved via a
// CharacterController so wall-sliding is native (this REPLACES the Dart slide()).
//
// Authority: docs/PORTING_TO_UNITY.md
//   §3.3 §2  friction model (exponential decay with the min(1.0, ...) clamp,
//            snap-to-0, hard speed clamp), radii.
//   §3.3 §3  control mode A (first-person tank): accelerate along heading,
//            brake decay, icy mult; control mode B (analog) hook; then
//            "wall-slide movement" via CharacterController.Move.
//
// =============================== STATE CONVENTION =============================
// The bible keeps motion in the SOURCE convention: heading in radians (0=east,
// CW), forward = (cos h, sin h) in (east, south). We preserve that EXACTLY:
//   - Heading is a Dart heading (radians); steering changes it directly.
//   - Velocity is stored as a Dart-space Vector2 (vx=east, vy=south), so the
//     friction/accel/brake/clamp math is line-for-line the source.
// Only at the final move do we convert displacement to Unity world units + the
// single global Y-flip, via GameConstants. NO scale or flip is re-derived here.
//
// The PlayerController OWNS steering+throttle while pushing and calls the public
// drive methods below; the CartController itself only integrates + moves. While
// parked it is inert (velocity zeroed, no integration).
// -----------------------------------------------------------------------------

using UnityEngine;

namespace GroceryDash.Core
{
    /// <summary>
    /// Kinematic shopping cart. Manual velocity integration (bible §3.3 §2/§3)
    /// in source space; movement committed via <see cref="CharacterController"/>
    /// for native wall-sliding (replaces the Dart <c>slide()</c>). Steering and
    /// throttle are pushed in by <see cref="PlayerController"/> while pushing; an
    /// analog hook is provided for the SideScroll/TopDown camera modes (§3.3 §3
    /// branch B), not driven in Phase 1.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [DisallowMultipleComponent]
    public sealed class CartController : MonoBehaviour
    {
        // ---------------------------------------------------------------------
        // Source-space state (Dart convention: radians 0=east CW; vel east/south)
        // ---------------------------------------------------------------------

        /// <summary>
        /// Cart heading in Dart radians (0 = east, increasing clockwise).
        /// Source field: <c>cart.heading</c> (spawns at <c>pi/2</c> = south, but
        /// the spawner sets it; this component only integrates/steers it).
        /// </summary>
        [SerializeField] private float heading = Mathf.PI / 2f;

        /// <summary>
        /// Velocity in SOURCE space (x = east, y = south), world-units/sec.
        /// Source fields: <c>cart.vx, cart.vy</c>.
        /// </summary>
        private Vector2 velocity = Vector2.zero;

        // ---------------------------------------------------------------------
        // Icy floor hook (§3.3 §3: sectionAtPoint(cart) == 'frozen')
        // ---------------------------------------------------------------------

        /// <summary>
        /// Set true while the cart is inside the 'frozen' aisle trigger volume
        /// (slippery). Phase 1 leaves this false; Phase 4 wires the trigger
        /// (§3.3 §3 icy path). When true, friction is multiplied by
        /// <see cref="MovementTuning.IcyFrictionMult"/>.
        /// </summary>
        public bool OnIcyFloor { get; set; }

        private CharacterController _cc;

        // FIX #6: contact normal captured from CharacterController collision
        // callbacks during a single Move(), then consumed by ClampAndMove to
        // cancel the velocity component that rammed the wall. Replaces the old
        // per-world-axis displacement-ratio heuristic.
        private Vector3 _lastHitNormal;
        private bool _hitThisMove;

        // ---------------------------------------------------------------------
        // Public read/zero API (used by PlayerController + park/take + later bumps)
        // ---------------------------------------------------------------------

        /// <summary>Cart heading in Dart radians (0 = east, CW). Read-only; steer via <see cref="Steer"/>.</summary>
        public float Heading => heading;

        /// <summary>Current speed magnitude (world units/sec).</summary>
        public float Speed => velocity.magnitude;

        /// <summary>Current source-space velocity (x=east, y=south), world units/sec.</summary>
        public Vector2 Velocity => velocity;

        /// <summary>Unity world-space forward unit vector for the current heading (east->+X, south->-Z).</summary>
        public Vector3 WorldForward => GameConstants.DartHeadingToForward(heading);

        /// <summary>
        /// Zero the cart's velocity. Source: park sets <c>cart.vx = cart.vy = 0</c>
        /// (§3.3 §1); also used by the (later) bump response. Does not move the cart.
        /// </summary>
        public void ZeroVelocity() => velocity = Vector2.zero;

        /// <summary>
        /// Hard-set the heading (Dart radians). Used by the spawner to face the
        /// cart "north" (<c>-pi/2</c>) at the entrance (§3.2 spawn / §3.3 facing).
        /// </summary>
        public void SetHeading(float dartRadians)
        {
            heading = dartRadians;
            ApplyHeadingToTransform();
        }

        // ---------------------------------------------------------------------
        // Unity lifecycle
        // ---------------------------------------------------------------------

        private void Awake()
        {
            _cc = GetComponent<CharacterController>();
            // Match the source body radius (bible §3.3 §2: _cartRadius = 22px).
            _cc.radius = MovementTuning.CartRadius;
            ApplyHeadingToTransform();
        }

        // ---------------------------------------------------------------------
        // §3.3 §3 control mode A — first-person tank (PUSHING). Called by the
        // PlayerController each frame while PlayerMode.Pushing in FirstPerson.
        // ---------------------------------------------------------------------

        /// <summary>
        /// Steer the cart heading (first-person tank). Source:
        /// <c>cart.heading += joystick.dx * 2.6 * dt</c> (§3.3 §3 A).
        /// </summary>
        /// <param name="stickX">Stick x (turn). Magnitude already clamped [0,1].</param>
        public void Steer(float stickX, float dt)
        {
            heading += stickX * MovementTuning.CartTurnRate * dt;
            ApplyHeadingToTransform();
        }

        /// <summary>
        /// Integrate one frame of first-person pushing physics, then move with
        /// wall-sliding. VERBATIM pipeline from §3.3 §3 branch A + the post-branch
        /// "clamp + wall-slide" step.
        /// </summary>
        /// <param name="forwardAmount">
        /// Source <c>forwardAmount = -joystick.dy</c> (stick up = forward). The
        /// PlayerController computes the sign; pass it through unchanged.
        /// </param>
        /// <param name="stickMagnitude">Stick magnitude (clamped [0,1]); gates accel via the deadzone.</param>
        public void DrivePushingFirstPerson(float forwardAmount, float stickMagnitude, float dt)
        {
            // forwardUnit = forward(heading) in source (east/south) space.
            Vector2 forwardUnit = new Vector2(Mathf.Cos(heading), Mathf.Sin(heading));

            float frictionMult = OnIcyFloor
                ? MovementTuning.IcyFrictionMult
                : MovementTuning.NormalFrictionMult;

            float vSpeed = velocity.magnitude;

            if (stickMagnitude > MovementTuning.StickDeadzone)
            {
                // Accelerate along heading: cart.v += forwardUnit * forwardAmount * 900 * dt.
                velocity += forwardUnit * (forwardAmount * MovementTuning.CartAccel * dt);

                // Brake detection: vSpeed > 20 && forwardAmount < -0.2 && (v . forwardUnit) > 0.
                bool isBraking = vSpeed > MovementTuning.BrakeSpeedThreshold
                                 && forwardAmount < MovementTuning.BrakeForwardThreshold
                                 && Vector2.Dot(velocity, forwardUnit) > 0f;
                if (isBraking)
                {
                    // Additional brake decay (exponential, with icy mult).
                    // FIX #3: NO snap-to-zero here — Dart's accelerate branch
                    // (with or without braking, lines 526-537) never snaps that
                    // frame; only the idle else-branch does.
                    ApplyFriction(MovementTuning.CartBrakeFriction, frictionMult, dt);
                }
                // FIX #4 (guard): when accelerating WITHOUT braking, apply NO
                // friction at all — Dart applies none in that sub-case. (Do not
                // move idle friction into this branch.)
                // (Wheel-squeak SFX trigger here — audio, Phase 7.)
            }
            else
            {
                // Idle friction (with icy mult), then snap to 0 below threshold.
                // FIX #3: snap is applied HERE ONLY (Dart idle else-branch, 539-542).
                ApplyFriction(MovementTuning.CartFriction, frictionMult, dt);
                SnapToZeroIfTiny();
            }

            ClampAndMove(dt);
        }

        // ---------------------------------------------------------------------
        // §3.3 §3 control mode B — analog (top-down / follow-cam). HOOK ONLY for
        // Phase 1 (only FirstPerson is fully wired); kept faithful for Phase 4.
        // ---------------------------------------------------------------------

        /// <summary>
        /// Integrate one frame of ANALOG pushing physics, then move. Source
        /// §3.3 §3 branch B: accelerate in the raw stick direction and lerp the
        /// heading toward the stick angle; idle friction has NO icy mult in this
        /// branch. Not driven in Phase 1 (FirstPerson only) — provided so the
        /// SideScroll/TopDown control scheme is a clean drop-in later (§3.3 §12).
        ///
        /// FIX #1/#5 (source-space contract — READ BEFORE WIRING ANALOG IN PHASE 4):
        /// <paramref name="stick"/> MUST already be in SOURCE space (x=east,
        /// y=SOUTH). The input layer's <c>IMovementInput.Move</c> is +y=UP
        /// (stick-up = forward, see KeyboardMovementInput); callers MUST negate y
        /// before calling — i.e. pass <c>new Vector2(Move.x, -Move.y)</c>. The
        /// PlayerController does this at its analog hook. Dart's analog branch uses
        /// the raw <c>joystick.dy</c> which is +y=south (grocery_dash_game.dart
        /// lines 555-559); skipping the flip would send "up" SOUTH (inverted).
        /// </summary>
        /// <param name="stick">SOURCE-space stick (x=east, y=SOUTH), magnitude [0,1].</param>
        public void DrivePushingAnalog(Vector2 stick, float dt)
        {
            float mag = stick.magnitude;
            if (mag > MovementTuning.StickDeadzone)
            {
                // cart.v += joystick * 900 * dt.
                velocity += stick * (MovementTuning.CartAccel * dt);

                // targetHeading = atan2(joystick.dy, joystick.dx);
                // cart.heading = lerpAngle(cart.heading, targetHeading, dt*5).
                float targetHeading = Mathf.Atan2(stick.y, stick.x);
                heading = Mathf.LerpAngle(
                    heading * Mathf.Rad2Deg,
                    targetHeading * Mathf.Rad2Deg,
                    dt * MovementTuning.AnalogHeadingLerpRate) * Mathf.Deg2Rad;
                ApplyHeadingToTransform();
                // FIX #3: accelerate branch never snaps (matches Dart analog
                // mag>deadzone branch — no snap there).
            }
            else
            {
                // Idle friction (NO icy mult in this branch — bible §3.3 §3 B),
                // then snap to 0 below threshold (Dart analog idle else, 562-565).
                ApplyFriction(MovementTuning.CartFriction, MovementTuning.NormalFrictionMult, dt);
                SnapToZeroIfTiny();
            }

            ClampAndMove(dt);
        }

        // ---------------------------------------------------------------------
        // Shared integration helpers (VERBATIM friction + clamp + slide)
        // ---------------------------------------------------------------------

        /// <summary>
        /// Exponential-ish per-frame velocity DECAY (bible §3.3 §2):
        /// <c>v -= v * min(1.0, rate * mult * dt)</c>. The min(1.0, …) clamp is
        /// LOAD-BEARING — it stops friction overshooting/reversing v at large dt;
        /// do not remove it.
        ///
        /// FIX #3 (constant-fidelity): this method does DECAY ONLY. In the Dart
        /// source the snap-to-zero (<c>if (cart.vx.abs() < 1) cart.vx = 0</c>)
        /// lives ONLY in the idle-friction else-branch (grocery_dash_game.dart
        /// lines 541-542 / 564-565) — it is NOT applied after acceleration and NOT
        /// in the braking branch (lines 531-536). The snap is therefore factored
        /// out into <see cref="SnapToZeroIfTiny"/>, which only the idle paths call.
        /// </summary>
        private void ApplyFriction(float rate, float mult, float dt)
        {
            float decay = Mathf.Min(1.0f, rate * mult * dt);
            velocity -= velocity * decay;
        }

        /// <summary>
        /// Snap velocity to exactly zero below
        /// <see cref="MovementTuning.SpeedSnapToZero"/>, PER AXIS — matching Dart's
        /// independent <c>if (vx.abs() < 1) vx = 0; if (vy.abs() < 1) vy = 0</c>.
        /// FIX #3: called ONLY from the idle-friction branches (never after accel
        /// or brake), exactly as the source does.
        /// </summary>
        private void SnapToZeroIfTiny()
        {
            if (Mathf.Abs(velocity.x) < MovementTuning.SpeedSnapToZero) velocity.x = 0f;
            if (Mathf.Abs(velocity.y) < MovementTuning.SpeedSnapToZero) velocity.y = 0f;
        }

        /// <summary>
        /// Hard-clamp speed to <see cref="MovementTuning.CartMaxSpeed"/>, then
        /// commit the move through the CharacterController (native wall-slide,
        /// replacing Dart slide()).
        ///
        /// FIX #6 (integration): the previous per-world-axis "expected vs actual
        /// displacement ratio (1% tolerance)" blocked-axis test is REMOVED. That
        /// heuristic was framerate/diagonal-fragile — because CharacterController
        /// resolves diagonals and corners (not an independent per-axis sweep like
        /// Dart's slide()), a diagonal push into a wall could leave a residual on
        /// the blocked axis exceeding the 1% threshold, FAIL to zero, and let the
        /// cart keep ramming and accumulate speed up to the clamp. Instead, native
        /// sliding is authoritative and, on a side collision, we cancel the
        /// velocity COMPONENT directed into the contact normal (captured from
        /// <see cref="OnControllerColliderHit"/>). This expresses Dart's intent
        /// ("zero the blocked velocity component") against the real contact normal.
        /// The bible (§3.2/§3.3) explicitly sanctions CharacterController.Move
        /// replacing slide(), accepting native-slide divergence.
        /// </summary>
        private void ClampAndMove(float dt)
        {
            // Hard speed clamp to cart max.
            if (velocity.magnitude > MovementTuning.CartMaxSpeed)
                velocity = velocity.normalized * MovementTuning.CartMaxSpeed;

            if (velocity == Vector2.zero)
                return;

            // Convert source-space velocity (east, south) -> Unity world (X, Z)
            // using the single global Y-flip in direction form (south -> -Z):
            // east -> +X, south -> -Z. (Mirrors GameConstants.DartHeadingToForward.)
            Vector3 worldVel = new Vector3(velocity.x, 0f, -velocity.y);

            // Reset per-move collision capture, then move (native wall-slide).
            _hitThisMove = false;
            _lastHitNormal = Vector3.zero;
            CollisionFlags flags = _cc.Move(worldVel * dt);

            // If we hit a side wall this frame, cancel the inbound velocity
            // component along the contact normal so we stop ramming (and don't
            // accumulate speed into the wall up to the clamp).
            if ((flags & CollisionFlags.Sides) != 0 && _hitThisMove)
                CancelVelocityIntoContact(_lastHitNormal);
        }

        /// <summary>
        /// Cancel the part of the (source-space) velocity that points INTO a world
        /// contact normal. Converts the world normal back to source space
        /// (X->east, -Z->south — the same single Y-flip as the velocity map)
        /// and subtracts the inbound component. Faithful to Dart's "zero the
        /// blocked velocity component" without the brittle per-axis ratio test
        /// (FIX #6).
        /// </summary>
        private void CancelVelocityIntoContact(Vector3 worldNormal)
        {
            // World (X, _, Z) normal -> source (east, south): east = X, south = -Z.
            Vector2 srcNormal = new Vector2(worldNormal.x, -worldNormal.z);
            float mag = srcNormal.magnitude;
            if (mag < 1e-6f)
                return;
            srcNormal /= mag;

            // Only cancel velocity heading INTO the wall (against the outward normal).
            float into = Vector2.Dot(velocity, srcNormal);
            if (into < 0f)
                velocity -= into * srcNormal;
        }

        /// <summary>
        /// CharacterController collision callback (FIX #6): capture the contact
        /// normal of a blocking hit so <see cref="ClampAndMove"/> can cancel the
        /// velocity directed into it. On a multi-contact (corner) move, keep the
        /// most head-on normal (the one most anti-parallel to the move).
        /// </summary>
        private void OnControllerColliderHit(ControllerColliderHit hit)
        {
            // hit.normal points outward from the surface we hit.
            if (!_hitThisMove)
            {
                _lastHitNormal = hit.normal;
                _hitThisMove = true;
            }
            else
            {
                // Prefer the most opposing normal (corner case): the one most
                // anti-parallel to our world-space velocity dominates the stop.
                Vector3 worldVel = new Vector3(velocity.x, 0f, -velocity.y);
                if (Vector3.Dot(hit.normal, worldVel) < Vector3.Dot(_lastHitNormal, worldVel))
                    _lastHitNormal = hit.normal;
            }
        }

        /// <summary>Push the source heading onto the transform's Y rotation (single global flip via GameConstants).</summary>
        private void ApplyHeadingToTransform()
        {
            transform.rotation = GameConstants.DartHeadingToRotation(heading);
        }
    }
}
