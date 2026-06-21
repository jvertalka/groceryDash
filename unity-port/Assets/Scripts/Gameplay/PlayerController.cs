// -----------------------------------------------------------------------------
// PlayerController.cs  —  Grocery Dash → Unity 6 port, Phase 1
//
// The player character + the PlayerMode/CartState coupling. Owns the input,
// drives the cart while pushing (and snaps the player 28px behind it), walks the
// player while on foot, and parks/takes the cart with the 60px proximity rule.
//
// Authority: docs/PORTING_TO_UNITY.md §3.3 §1 (state machines + transitions),
//   §3.3 §3 (first-person on-foot tank controls; cart-pushing attachment; analog
//   hook), §3.3 §12 (CameraMode selects the control scheme — only FirstPerson is
//   fully wired in Phase 1; SideScroll/TopDown have clean hooks).
//
// Control scheme is chosen from GameManager.CurrentCameraMode. On foot has NO
// inertia (velocity set/zeroed directly — bible §3.3 §3 "Note: on-foot has no
// friction/inertia"); only the cart has inertia (handled in CartController).
//
// SOURCE-SPACE convention is preserved (radians 0=east CW; forward=(cos,sin) in
// east/south). The single global Y-flip + px scale come ONLY from GameConstants;
// nothing is re-derived here.
// -----------------------------------------------------------------------------

using UnityEngine;

namespace GroceryDash.Core
{
    /// <summary>
    /// Player character controller + the player/cart state machines (bible
    /// §3.3 §1/§3). FirstPerson tank controls are fully wired for Phase 1;
    /// the analog (SideScroll/TopDown) branch is stubbed with a clean hook.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    [DisallowMultipleComponent]
    public sealed class PlayerController : MonoBehaviour
    {
        // ---------------------------------------------------------------------
        // Wiring
        // ---------------------------------------------------------------------

        [Header("Wiring")]
        [Tooltip("The cart this player pushes/parks. Required.")]
        [SerializeField] private CartController cart;

        [Tooltip("Optional. If unset, uses GameManager.Instance.CurrentCameraMode; " +
                 "if there is no GameManager, falls back to FirstPerson.")]
        [SerializeField] private GameManager gameManager;

        // ---------------------------------------------------------------------
        // State (source-space)
        // ---------------------------------------------------------------------

        [Header("State (read-only at runtime)")]
        [SerializeField] private PlayerMode mode = PlayerMode.Pushing;
        [SerializeField] private CartState cartState = CartState.Attached;

        /// <summary>Player facing in Dart radians (0 = east, CW). Source field <c>player.facing</c>.</summary>
        [SerializeField] private float facing = -Mathf.PI / 2f; // spawn faces "north"/up (§3.3 facing).

        /// <summary>Current player mode (§3.3 §1).</summary>
        public PlayerMode Mode => mode;

        /// <summary>Current cart attachment state (§3.3 §1).</summary>
        public CartState CartState => cartState;

        /// <summary>Player facing in Dart radians (0 = east, CW).</summary>
        public float Facing => facing;

        // Derived predicates (bible §3.3 §1, verbatim).
        /// <summary><c>mode == Reaching</c> (§3.3 §1). Driven in Phase 2.</summary>
        public bool IsReaching => mode == PlayerMode.Reaching;
        /// <summary><c>mode == Checkout</c> (§3.3 §1). Driven in Phase 4.</summary>
        public bool IsAtCheckout => mode == PlayerMode.Checkout;
        /// <summary><c>mode == Pushing || mode == OnFoot</c> (§3.3 §1).</summary>
        public bool CanSteer => mode == PlayerMode.Pushing || mode == PlayerMode.OnFoot;

        // ---------------------------------------------------------------------
        // Input layer (swap KeyboardMovementInput for a touch joystick later)
        // ---------------------------------------------------------------------

        private IMovementInput _input;
        private CharacterController _cc;

        /// <summary>
        /// Replace the input source (e.g. inject a touch-joystick implementation).
        /// Defaults to <see cref="KeyboardMovementInput"/> in Awake.
        /// </summary>
        public void SetInput(IMovementInput input) => _input = input;

        // ---------------------------------------------------------------------
        // Unity lifecycle
        // ---------------------------------------------------------------------

        private void Awake()
        {
            _cc = GetComponent<CharacterController>();
            // Match source body radius (bible §3.3 §2: _playerRadius = 14px).
            _cc.radius = MovementTuning.PlayerRadius;

            // Default desktop input; touch joystick can replace via SetInput.
            _input ??= new KeyboardMovementInput();

            if (gameManager == null)
                gameManager = GameManager.Instance;

            ApplyFacingToTransform();
        }

        private void Update()
        {
            // Gate gameplay behind the run state, mirroring GameManager.Update
            // (Dart: `if (!_worldReady || _runOver || paused) return`).
            // FIX #2: gate on BOTH the run being over AND not-yet-active — the
            // previous code only blocked on RunOver, so with a GameManager present
            // but no StartRun yet (RunActive=false, RunOver=false) input still
            // drove the cart, and RunActive is the real source of truth across
            // restarts. The no-manager case is still an explicit Phase-1 sandbox:
            // when gameManager == null, driving is allowed (no run to gate on).
            if (gameManager != null && (gameManager.RunOver || !gameManager.RunActive))
                return;

            float dt = Time.deltaTime;

            _input.Poll();

            // Park / take cart (one-shot). Guarded against reaching/checkout.
            if (_input.ParkPressed)
                ToggleCartAttached();

            // TODO Phase 2: interact -> begin reach (focused non-empty slot, §3.3 §4).
            // TODO Phase 4: interact -> begin checkout (allComplete && <80px, §3.3 §6).
            // For Phase 1 the interact edge is read but unused beyond steer modes.

            if (!CanSteer)
                return; // Reaching/Checkout freeze steering (Phase 2/4 own these).

            switch (mode)
            {
                case PlayerMode.Pushing:
                    UpdatePushingCart(dt);
                    break;
                case PlayerMode.OnFoot:
                    UpdateOnFoot(dt);
                    break;
            }
        }

        // ---------------------------------------------------------------------
        // §3.3 §3 — PUSHING the cart
        // ---------------------------------------------------------------------

        private void UpdatePushingCart(float dt)
        {
            Vector2 stick = _input.Move;
            float mag = stick.magnitude;

            if (ActiveCameraMode == CameraMode.FirstPerson)
            {
                // --- A. First-person (tank) ---------------------------------
                // Steer the CART: cart.heading += stick.x * 2.6 * dt; player.facing = cart.heading.
                cart.Steer(stick.x, dt);

                // forwardAmount = -joystick.dy (stick up = forward).
                float forwardAmount = -stick.y;

                // Cart integrates accel/brake/friction/clamp + wall-slide.
                cart.DrivePushingFirstPerson(forwardAmount, mag, dt);
            }
            else
            {
                // --- B. Analog (SideScroll / TopDown) — HOOK ONLY in Phase 1.
                // FIX #1/#5: IMovementInput.Move is +y=UP (stick-up = forward),
                // but the analog source path (DrivePushingAnalog) expects a
                // SOURCE-space stick where +y=SOUTH (Dart raw joystick.dy). Negate
                // y here to cross from input-space to source-space — mirroring the
                // FirstPerson path's `forwardAmount = -stick.y`. WITHOUT this flip,
                // pressing "up" would drive the cart SOUTH and compute an inverted
                // heading. (Not exercised in Phase 1; correctness trap for Phase 4.)
                Vector2 srcStick = new Vector2(stick.x, -stick.y);
                cart.DrivePushingAnalog(srcStick, dt);
            }

            // Cart-pushing player attachment (VERBATIM, §3.3 §3): the player is
            // snapped 28px BEHIND the cart along its heading every frame, and the
            // player's facing matches the cart heading.
            facing = cart.Heading;
            Vector3 cartPos = cart.transform.position;
            Vector3 behind = cart.WorldForward * MovementTuning.PlayerBehindCartOffset;
            // Position directly (procedural attachment) — keep the player's Y.
            Vector3 target = cartPos - behind;
            target.y = transform.position.y;
            // FIX #7: directly writing transform.position on a GameObject with an
            // ENABLED CharacterController is ignored/reverted by the controller in
            // some Unity 6 configs (the controller re-asserts its own internal
            // position), which makes the attachment visually lag. Disable the
            // controller around the teleport so the hard set sticks, then re-enable.
            bool ccWasEnabled = _cc.enabled;
            _cc.enabled = false;
            transform.position = target;
            _cc.enabled = ccWasEnabled;
            ApplyFacingToTransform();
        }

        // ---------------------------------------------------------------------
        // §3.3 §3 — ON FOOT (no inertia: velocity is set/zeroed directly)
        // ---------------------------------------------------------------------

        private void UpdateOnFoot(float dt)
        {
            Vector2 stick = _input.Move;
            float mag = stick.magnitude;

            Vector2 vel; // source-space (east, south), world units/sec.

            if (ActiveCameraMode == CameraMode.FirstPerson)
            {
                // First-person: turnRate = 2.8; facing += stick.x * 2.8 * dt;
                // forward = -stick.y; if mag>deadzone v = forwardUnit * 260 * forward, else 0.
                facing += stick.x * MovementTuning.OnFootTurnRate * dt;
                if (mag > MovementTuning.StickDeadzone)
                {
                    float forward = -stick.y;
                    Vector2 forwardUnit = new Vector2(Mathf.Cos(facing), Mathf.Sin(facing));
                    vel = forwardUnit * (MovementTuning.PlayerWalkSpeed * forward);
                }
                else
                {
                    vel = Vector2.zero;
                }
            }
            else
            {
                // Top-down / follow-cam (analog) — HOOK ONLY in Phase 1.
                // FIX #1/#5: cross from input-space (+y=UP) to source-space
                // (+y=SOUTH) before using the stick as a Dart joystick vector, so
                // velocity direction and atan2 heading are not mirrored about X.
                // Magnitude is preserved by the flip, so the deadzone test on the
                // original `mag` is unchanged. Mirrors Dart's raw joystick.dy
                // (south-positive) usage; matches the FirstPerson `-stick.y`.
                // if mag>deadzone v = src * 260 * mag; facing = atan2(src.y, src.x); else 0.
                if (mag > MovementTuning.StickDeadzone)
                {
                    Vector2 src = new Vector2(stick.x, -stick.y);
                    vel = src * (MovementTuning.PlayerWalkSpeed * mag);
                    facing = Mathf.Atan2(src.y, src.x);
                }
                else
                {
                    vel = Vector2.zero;
                }
            }

            // Move with native wall-slide (replaces slide() against _playerRadius).
            // Source -> world: east -> +X, south -> -Z (single global flip, dir form).
            if (vel != Vector2.zero)
            {
                Vector3 worldVel = new Vector3(vel.x, 0f, -vel.y);
                _cc.Move(worldVel * dt);
            }
            ApplyFacingToTransform();
        }

        // ---------------------------------------------------------------------
        // §3.3 §1 — toggleCartAttached (park / take) with the 60px rule
        // ---------------------------------------------------------------------

        /// <summary>
        /// Toggle the cart between attached and parked (bible §3.3 §1). No-op
        /// while reaching/checkout (those states guard it), or if there is no
        /// cart. Taking a parked cart back requires the player to be within
        /// <see cref="MovementTuning.TakeCartProximity"/> (60px) of it.
        /// </summary>
        public void ToggleCartAttached()
        {
            // Guarded: no-op while reaching or checkout (§3.3 §1).
            // (Source also no-ops if !_worldReady or _runOver — handled by the
            // Update gate above; calling this directly still respects the mode.)
            // FIX #8 (confirmation): this internal mode-guard MUST stay here.
            // ParkPressed is processed before the CanSteer gate in Update (faithful
            // to Dart, which routes park through the guarded toggle), so the guard
            // cannot be relied upon to live anywhere but inside this method.
            if (mode == PlayerMode.Reaching || mode == PlayerMode.Checkout)
                return;
            if (cart == null)
                return;

            if (cartState == CartState.Attached)
            {
                // attached -> parked: zero cart velocity, drop to onFoot.
                cart.ZeroVelocity();
                cartState = CartState.Parked;
                mode = PlayerMode.OnFoot;
                // TODO Phase 6: park clunk SFX + banner
                //   "Cart parked. Mind the aisle — and your stuff." (§3.3 §1).
                // TODO Phase 3: cartParkedNotifier=true; start unattendedTimer (§3.3 §9).
            }
            else // Parked
            {
                // parked -> attached: only if within 60px of the cart.
                float dist = Vector3.Distance(
                    Flatten(transform.position), Flatten(cart.transform.position));
                if (dist > MovementTuning.TakeCartProximity)
                {
                    // TODO Phase 6: banner "Walk back to your cart to take it." (§3.3 §1).
                    return; // abort.
                }

                cartState = CartState.Attached;
                mode = PlayerMode.Pushing;
                // TODO Phase 3: reset cart.unattendedTimer=0; cartParkedNotifier=false;
                //   unattendedNotifier=0; clear banner (§3.3 §1/§9).
            }
        }

        // ---------------------------------------------------------------------
        // Helpers
        // ---------------------------------------------------------------------

        /// <summary>
        /// The control scheme's camera mode: GameManager's current mode if a
        /// manager is present, else FirstPerson (Phase 1 sandbox default).
        /// Only FirstPerson is fully wired this phase (§3.3 §12).
        /// </summary>
        private CameraMode ActiveCameraMode =>
            gameManager != null ? gameManager.CurrentCameraMode : CameraMode.FirstPerson;

        /// <summary>Project a world position onto the ground plane (Y=0) for planar distance.</summary>
        private static Vector3 Flatten(Vector3 p) => new Vector3(p.x, 0f, p.z);

        /// <summary>Push the source facing onto the transform's Y rotation (single global flip via GameConstants).</summary>
        private void ApplyFacingToTransform()
        {
            transform.rotation = GameConstants.DartHeadingToRotation(facing);
        }

#if UNITY_EDITOR
        private void OnValidate()
        {
            // Keep the editor-visible rotation in sync with the serialized facing.
            if (!Application.isPlaying)
                transform.rotation = GameConstants.DartHeadingToRotation(facing);
        }
#endif
    }
}
