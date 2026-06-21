// -----------------------------------------------------------------------------
// PlayerEnums.cs  —  Grocery Dash → Unity 6 port, Phase 1
//
// The player + cart state-machine enums from the porting bible, ported VERBATIM
// in declaration order so the default backing int values match the Dart source
// ordering (Dart enum index == C# enum int). C# PascalCase per convention; the
// order is the contract.
//
// Authority: docs/PORTING_TO_UNITY.md -> "### 3.3 Player, Cart, Interaction &
//   Scoring" / "#### 1. State machines" (PlayerMode + CartState verbatim tables).
//
// Phase 1 wires only PlayerMode.{Pushing, OnFoot} and CartState.{Attached,
// Parked}. PlayerMode.{Reaching, Checkout} are declared now (their int indices
// are load-bearing — derived predicates and transitions key off them) but are
// not driven until Phase 2 (reach, §3.3 §4) and Phase 4 (checkout, §3.3 §6).
//
// Do NOT reorder/insert/remove members without re-checking every transition and
// predicate that keys off these values.
// -----------------------------------------------------------------------------

namespace GroceryDash.Core
{
    /// <summary>
    /// Player character mode. Bible §3.3 §1 order: pushing, onFoot, reaching,
    /// checkout.
    /// Derived predicates (verbatim, see <c>PlayerController</c>):
    ///   isReaching   = mode == Reaching
    ///   isAtCheckout = mode == Checkout
    ///   canSteer     = mode == Pushing || mode == OnFoot
    /// </summary>
    public enum PlayerMode
    {
        /// <summary>Pushing the cart; input steers the CART. (Phase 1)</summary>
        Pushing = 0,   // pushing

        /// <summary>Walking without a cart; input steers the PERSON. (Phase 1)</summary>
        OnFoot = 1,    // onFoot

        /// <summary>Frozen at a shelf slot, reach animation running. (Phase 2 — §3.3 §4)</summary>
        Reaching = 2,  // reaching

        /// <summary>At the checkout, scan animation running. (Phase 4 — §3.3 §6)</summary>
        Checkout = 3,  // checkout
    }

    /// <summary>
    /// Shopping-cart attachment state. Bible §3.3 §1 order: attached, parked.
    /// </summary>
    public enum CartState
    {
        /// <summary>Moves with the player (snapped 28px behind the cart heading). (Phase 1)</summary>
        Attached = 0,  // attached

        /// <summary>Abandoned in the aisle; stays where it was left. (Phase 1)</summary>
        Parked = 1,    // parked
    }
}
