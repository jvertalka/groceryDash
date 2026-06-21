// -----------------------------------------------------------------------------
// GameManager.cs  —  Grocery Dash → Unity 6 port, Phase 0
//
// SCAFFOLDING ONLY. The run-owning MonoBehaviour stub: the Dart `GroceryDashGame
// extends FlameGame` class maps to this top-level GameManager (bible §2, §3.3).
// It holds the current GameMode + CameraMode, switches between three (empty for
// now) camera rigs, and exposes a stubbed run lifecycle. NO gameplay is
// implemented here — every real behavior is deferred to a later phase with a
// `// TODO Phase N` marker pointing back at the bible.
//
// Authority: docs/PORTING_TO_UNITY.md
//   §2 (FlameGame -> GameManager MonoBehaviour; ChangeNotifier -> C# events)
//   §3.1 (GameMode / CameraMode enums + UI strings)
//   §3.3 §11 (run-end flow), §3.3 §10 (scoring -> RunResult)
//   §4 Phase 0 ("Stub the GameManager... a CameraMode enum field switching three
//      (empty for now) camera rigs.")
// -----------------------------------------------------------------------------

using UnityEngine;

namespace GroceryDash.Core
{
    /// <summary>
    /// Owns a single play session ("run"). Phase 0 stub: state holders, camera-rig
    /// switching, and empty lifecycle methods. Singleton-ish via <see cref="Instance"/>
    /// (not a hard enforced singleton — there should be exactly one in a scene).
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class GameManager : MonoBehaviour
    {
        // ---------------------------------------------------------------------
        // Singleton-ish access
        // ---------------------------------------------------------------------

        /// <summary>
        /// The active GameManager. Set in Awake; cleared in OnDestroy. Not a
        /// hard singleton (no auto-create, no DontDestroyOnLoad yet) — that
        /// policy is a later decision.
        /// </summary>
        public static GameManager Instance { get; private set; }

        // ---------------------------------------------------------------------
        // Run configuration / state
        // ---------------------------------------------------------------------

        [Header("Run Configuration")]
        [SerializeField] private GameMode currentMode = GameMode.Endless;
        [SerializeField] private CameraMode currentCameraMode = CameraMode.FirstPerson;

        /// <summary>Current game mode for this run (§3.1).</summary>
        public GameMode CurrentMode => currentMode;

        /// <summary>Current camera/view mode. Drives the active rig and the control scheme (§3.3 §3).</summary>
        public CameraMode CurrentCameraMode => currentCameraMode;

        /// <summary>True once <see cref="StartRun"/> has begun and before the run ends.</summary>
        public bool RunActive { get; private set; }

        /// <summary>
        /// True after <see cref="EndRun"/> — gates all per-frame gameplay logic.
        /// Mirrors Dart's `_runOver`; the bible's update guard is
        /// `if (!_worldReady || _runOver || paused) return` (§3.3 §11).
        /// </summary>
        public bool RunOver { get; private set; }

        // ---------------------------------------------------------------------
        // Camera rigs  (Phase 0: empty references; rigs built in Phase 1/4)
        //
        // Three rig roots, one per CameraMode. SwitchCamera enables the matching
        // one and disables the others. Bible §3.1 / §3.3 §12: three camera-rig
        // setups selected by CameraMode; only FirstPerson uses tank controls +
        // the icy-friction path.
        // ---------------------------------------------------------------------

        [Header("Camera Rigs (assign in Inspector; empty in Phase 0)")]
        [Tooltip("First-person rig root. CameraMode.FirstPerson -> 'First Person'. Tank controls + icy path live here later.")]
        [SerializeField] private GameObject firstPersonRig;

        [Tooltip("Follow-cam / side-scroll rig root. CameraMode.SideScroll -> 'Follow Cam'. Analog controls.")]
        [SerializeField] private GameObject sideScrollRig;

        [Tooltip("Top-down / store-map rig root. CameraMode.TopDown -> 'Store Map'. Analog controls.")]
        [SerializeField] private GameObject topDownRig;

        // ---------------------------------------------------------------------
        // Events  (Dart ChangeNotifier/ValueNotifier -> C# events, bible §2)
        //
        // HUD/UI subscribes to these; they are fired AFTER logic updates, never
        // mid-layout (avoids the Flutter "setState during build" bug — §2).
        // ---------------------------------------------------------------------

        /// <summary>Raised when a run starts. Payload: the chosen GameMode.</summary>
        public event System.Action<GameMode> RunStarted;

        /// <summary>
        /// Raised when a run ends. Payload: whether the run was cleared (true =
        /// reached checkout). In Phase 4 this carries a RunResult (§3.3 §10).
        /// </summary>
        public event System.Action<bool> RunEnded;

        /// <summary>Raised when the active camera mode changes.</summary>
        public event System.Action<CameraMode> CameraModeChanged;

        // ---------------------------------------------------------------------
        // Unity lifecycle
        // ---------------------------------------------------------------------

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning($"[GameManager] A second instance was created on '{name}'. Destroying it.", this);
                Destroy(gameObject);
                return;
            }
            Instance = this;

            // Apply the serialized starting camera mode so exactly one rig is
            // active from the first frame.
            ApplyCameraRig(currentCameraMode);
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        private void Update()
        {
            // The run-active / run-over gate that all gameplay ticks will sit
            // behind (Dart: `if (!_worldReady || _runOver || paused) return`).
            if (!RunActive || RunOver)
                return;

            // TODO Phase 1: player + cart movement state machines (bible §3.3 §1-§3).
            // TODO Phase 2: shelf focus + reach-to-grab timer (bible §3.3 §4).
            // TODO Phase 3: NPC tick pipeline + thief lifecycle (bible §3.4).
            // TODO Phase 4: checkout scan + scoring + run-end trigger (bible §3.3 §6, §10, §11).
        }

        // ---------------------------------------------------------------------
        // Camera switching
        // ---------------------------------------------------------------------

        /// <summary>
        /// Switch the active camera mode and enable the matching rig (disabling
        /// the others). Safe to call before rigs are assigned — null rigs are
        /// skipped. Fires <see cref="CameraModeChanged"/>.
        /// </summary>
        public void SwitchCamera(CameraMode mode)
        {
            currentCameraMode = mode;
            ApplyCameraRig(mode);

            // TODO Phase 4: this also selects the control scheme — FirstPerson =
            // tank/turn controls + icy-friction path; SideScroll/TopDown = analog
            // (bible §3.3 §3, §3.3 §12). Phase 0 only toggles the rig GameObjects.

            CameraModeChanged?.Invoke(mode);
        }

        /// <summary>
        /// Enable exactly the rig for <paramref name="mode"/> and disable the
        /// other two. Null rigs (Phase 0: all of them) are ignored.
        /// </summary>
        private void ApplyCameraRig(CameraMode mode)
        {
            SetRigActive(firstPersonRig, mode == CameraMode.FirstPerson);
            SetRigActive(sideScrollRig, mode == CameraMode.SideScroll);
            SetRigActive(topDownRig, mode == CameraMode.TopDown);
        }

        private static void SetRigActive(GameObject rig, bool active)
        {
            if (rig != null && rig.activeSelf != active)
                rig.SetActive(active);
        }

        // ---------------------------------------------------------------------
        // Run lifecycle  (STUBBED — bible §3.3 §11)
        // ---------------------------------------------------------------------

        /// <summary>
        /// Begin a run in the given mode. Phase 0 stub: sets state flags and
        /// fires <see cref="RunStarted"/>. World build, spawn, and gameplay
        /// wiring come later.
        /// </summary>
        public void StartRun(GameMode mode)
        {
            if (RunActive && !RunOver)
            {
                Debug.LogWarning("[GameManager] StartRun called while a run is already active. Ignoring.", this);
                return;
            }

            currentMode = mode;
            RunActive = true;
            RunOver = false;

            // TODO Phase 5: build the store from the greybox spec (bible §3.2).
            // TODO Phase 3: spawn the 12 NPCs via the weighted pool (bible §3.4 §8).
            // TODO Phase 2/3: populate shelf slots (bible §3.4 §5).
            // TODO Phase 4 (ShoppingList mode): generate the shopping list (bible §3.4 §10)
            //   and start its timer ("before the timer runs out" — §3.1 GameMode tagline).
            // TODO Phase 1: place the player + cart at the spawn point (1260,1500) (bible §3.2).

            RunStarted?.Invoke(mode);
        }

        /// <summary>
        /// End the current run. Idempotent (mirrors Dart `_endRun`'s `_runOver`
        /// guard, §3.3 §11). Phase 0 stub: flips state flags and fires
        /// <see cref="RunEnded"/>. <paramref name="cleared"/> is true only when
        /// the player reached and finished checkout.
        /// </summary>
        public void EndRun(bool cleared)
        {
            if (RunOver)
                return; // already ended — idempotent.

            RunOver = true;
            RunActive = false;

            // TODO Phase 4: compute RunResult — score = sum(item.score) + (cleared?300:0)
            //   - itemsStolen*20; coins = sum(item.coin) + (cleared?20:0); clamp [0, 1<<30];
            //   basketIdentity = List Crusher / Light Shopper / Walked Out (bible §3.3 §10).
            //   Pass that struct through RunEnded instead of the bare bool.

            RunEnded?.Invoke(cleared);
        }
    }
}
