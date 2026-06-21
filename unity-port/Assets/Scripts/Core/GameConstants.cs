// -----------------------------------------------------------------------------
// GameConstants.cs  —  Grocery Dash → Unity 6 port, Phase 0
//
// Global pixels->world-units scale and Dart/Flutter <-> Unity coordinate helpers.
//
// Authority: docs/PORTING_TO_UNITY.md
//   - "## 2. Porting conventions"            (the px->units scale + the radians note)
//   - "### 3.2 Store Floor Plan" / "Overview & units"  (the Y-flip mapping)
//   - "## 4. Recommended port order" / Phase 0          (adopt PX = 0.01f globally)
//
// ============================ THE SINGLE GLOBAL Y-FLIP ========================
// The Dart/Flame source world is 2D with:
//     origin (0,0) at the TOP-LEFT (north-west) corner,
//     +X = east  (right),
//     +Y = SOUTH (down)   <-- screen-space, +y points downward.
//     headings: radians, 0 = east, increasing CLOCKWISE (because +y is down).
//
// Unity is a 3D engine; we lay the store flat on the XZ ground plane:
//     X = east  (right),
//     Z = north (away),
//     Y = up.
//
// Because Dart's +Y is SOUTH but Unity's +Z is NORTH, the two vertical axes
// point in OPPOSITE directions. We resolve this with ONE flip, applied here and
// NOWHERE ELSE (bible §2: "convert the +y-down handedness exactly once, globally"):
//
//     Z_unity = (STORE_HEIGHT_PX - px_y) * PX
//
// i.e. a Dart point at the top of the store (small y, north) maps to a large Z
// (far/north in Unity), and the bottom of the store (large y, south, the
// entrance) maps to small Z. Every fixture, spawn point, NPC position, and
// heading MUST go through these helpers so the flip is consistent everywhere.
// Do not re-derive the flip anywhere else; call ToWorld / DartHeadingToYaw.
// =============================================================================

using UnityEngine;

namespace GroceryDash.Core
{
    /// <summary>
    /// Global constants and Dart(px, +y-down) -> Unity(XZ ground plane) conversion
    /// helpers. Pure static math; no scene dependencies.
    /// </summary>
    public static class GameConstants
    {
        // ---------------------------------------------------------------------
        // Scale  (bible §2 / Phase 0: "100 px = 1 world unit")
        // ---------------------------------------------------------------------

        /// <summary>
        /// Pixels -> world-units scale. 100 source px = 1 Unity world unit, so
        /// PX = 1/100 = 0.01. Multiply any source-pixel value by PX to get world
        /// units (e.g. 260f * PX = 2.6 wu/s). This is the ONE global scale —
        /// divide/multiply every source constant by it exactly once.
        /// </summary>
        public const float PX = 0.01f;

        /// <summary>Inverse of <see cref="PX"/> (world units -> pixels = *100).</summary>
        public const float PX_INV = 100f;

        // ---------------------------------------------------------------------
        // Store dimensions  (bible §3.2: "Store size: 2400 (w) x 1600 (h) px")
        // ---------------------------------------------------------------------

        /// <summary>Store width in source pixels.</summary>
        public const float STORE_WIDTH_PX = 2400f;

        /// <summary>Store height in source pixels.</summary>
        public const float STORE_HEIGHT_PX = 1600f;

        /// <summary>Store width in world units (24).</summary>
        public const float STORE_WIDTH_WU = STORE_WIDTH_PX * PX;

        /// <summary>Store height/depth in world units (16).</summary>
        public const float STORE_HEIGHT_WU = STORE_HEIGHT_PX * PX;

        // ---------------------------------------------------------------------
        // Scalar conversions
        // ---------------------------------------------------------------------

        /// <summary>Convert a pixel length/distance/speed to world units.</summary>
        public static float ToWorldUnits(float px) => px * PX;

        /// <summary>Convert a world-unit length back to source pixels.</summary>
        public static float ToPixels(float worldUnits) => worldUnits * PX_INV;

        /// <summary>
        /// Map a Dart X pixel coordinate (east) to a Unity world X. East is the
        /// same direction in both spaces, so this is a straight scale (no flip).
        /// </summary>
        public static float ToWorldX(float pxX) => pxX * PX;

        /// <summary>
        /// Map a Dart Y pixel coordinate (south, +y-down) to a Unity world Z
        /// (north). THIS is where the single global Y-flip lives:
        /// Z = (height - y) * PX. See the header comment.
        /// </summary>
        public static float ToWorldZ(float pxY) => (STORE_HEIGHT_PX - pxY) * PX;

        // ---------------------------------------------------------------------
        // Point conversions
        // ---------------------------------------------------------------------

        /// <summary>
        /// Convert a Dart/Flutter Offset(x, y) (x=east, y=south, +y-down) into a
        /// Unity world position on the ground plane (Y = 0). Applies the single
        /// global Y-flip. The 2D px point becomes (X=east, Y=0=floor, Z=north).
        /// </summary>
        public static Vector3 ToWorld(Vector2 px) => ToWorld(px.x, px.y);

        /// <summary>
        /// Convert raw Dart pixel coordinates (x=east, y=south) to a ground-plane
        /// world position (Y = 0). Applies the single global Y-flip.
        /// </summary>
        public static Vector3 ToWorld(float pxX, float pxY)
            => new Vector3(ToWorldX(pxX), 0f, ToWorldZ(pxY));

        /// <summary>
        /// Convert raw Dart pixel coordinates to a ground-plane world position at
        /// an explicit height <paramref name="worldY"/> (e.g. to stand a fixture's
        /// pivot above the floor). Applies the single global Y-flip on Z.
        /// </summary>
        public static Vector3 ToWorld(float pxX, float pxY, float worldY)
            => new Vector3(ToWorldX(pxX), worldY, ToWorldZ(pxY));

        /// <summary>
        /// Convert a Unity ground-plane world position back to Dart pixel space
        /// (Offset(x, y), +y-down). Inverse of <see cref="ToWorld(Vector2)"/>;
        /// the Y-flip is undone here. The world position's Y (height) is ignored.
        /// </summary>
        public static Vector2 ToPixels(Vector3 world)
            => new Vector2(world.x * PX_INV, STORE_HEIGHT_PX - world.z * PX_INV);

        // ---------------------------------------------------------------------
        // Heading conversions
        //
        // Dart heading: radians, 0 = east, increases CLOCKWISE (because +y down).
        //   forward_dart = (cos h, sin h)  in (east, south) axes.
        //
        // We must reflect the south axis to Unity's north (+Z) axis (the same
        // single Y-flip, in direction form), giving the Unity forward vector:
        //   forward_unity = (cos h, 0, -sin h)     // east -> +X, south -> -Z
        //
        // A Unity Y-axis rotation of theta maps (0,0,1) -> (sin theta, 0, cos theta).
        // Matching components: sin(theta) = cos(h), cos(theta) = -sin(h)
        //   => theta = h + pi/2   (radians)   =>   yawDeg = 90 + h * Rad2Deg.
        // Convert the +y-down handedness here, once — same as the positional flip.
        // ---------------------------------------------------------------------

        /// <summary>
        /// Convert a Dart heading (radians, 0 = east, clockwise) to a Unity
        /// forward unit vector on the XZ ground plane. east -> +X, south -> -Z.
        /// Returns (cos h, 0, -sin h).
        /// </summary>
        public static Vector3 DartHeadingToForward(float dartRadians)
            => new Vector3(Mathf.Cos(dartRadians), 0f, -Mathf.Sin(dartRadians));

        /// <summary>
        /// Convert a Dart heading (radians, 0 = east, clockwise) to a Unity
        /// Y-axis rotation in DEGREES (yaw): yaw = 90 + h * Rad2Deg. Assign to
        /// e.g. transform.eulerAngles.y or Quaternion.Euler(0, yaw, 0).
        /// </summary>
        public static float DartHeadingToYaw(float dartRadians)
            => 90f + dartRadians * Mathf.Rad2Deg;

        /// <summary>
        /// Convert a Dart heading (radians) directly to a Unity rotation that
        /// faces the corresponding forward direction on the ground plane.
        /// </summary>
        public static Quaternion DartHeadingToRotation(float dartRadians)
            => Quaternion.Euler(0f, DartHeadingToYaw(dartRadians), 0f);

        /// <summary>
        /// Inverse of <see cref="DartHeadingToYaw"/>: convert a Unity yaw (degrees,
        /// rotation about +Y) back to a Dart heading in radians (0 = east, CW).
        /// h = (yaw - 90) * Deg2Rad.
        /// </summary>
        public static float YawToDartHeading(float yawDegrees)
            => (yawDegrees - 90f) * Mathf.Deg2Rad;

        /// <summary>
        /// Convert a Unity forward vector on the XZ plane back to a Dart heading
        /// (radians, 0 = east, CW). Undoes the Z-flip: h = atan2(-z, x).
        /// </summary>
        public static float ForwardToDartHeading(Vector3 forward)
            => Mathf.Atan2(-forward.z, forward.x);
    }
}
