// -----------------------------------------------------------------------------
// GameEnums.cs  —  Grocery Dash → Unity 6 port, Phase 0
//
// The enums from the porting bible, ported VERBATIM in declaration order so the
// default backing int values match the Dart source ordering (Dart enum index ==
// C# enum int). C# PascalCase per convention; the order is the contract.
//
// Authority: docs/PORTING_TO_UNITY.md  -> "### 3.1 Data & Content" / "#### Enums"
//
// Do NOT reorder, insert, or remove members without re-checking every table that
// keys off these values — the integer index is data (e.g. section order 0..6,
// camera-mode selection, item rarity gating).
// -----------------------------------------------------------------------------

namespace GroceryDash.Core
{
    /// <summary>
    /// Top-level game mode. Bible §3.1 order: endless, shoppingList.
    /// (endless = "Endless Dash"; shoppingList = "Shopping List".)
    /// </summary>
    public enum GameMode
    {
        Endless = 0,       // endless
        ShoppingList = 1,  // shoppingList
    }

    /// <summary>
    /// Camera / view mode. Bible §3.1 order: firstPerson, sideScroll, topDown.
    /// Note enum names differ from UI labels (First Person / Follow Cam / Store
    /// Map). LOAD-BEARING: only FirstPerson uses tank/turn controls and the
    /// icy-friction path; SideScroll and TopDown use analog controls (§3.3 §3).
    /// </summary>
    public enum CameraMode
    {
        FirstPerson = 0,  // firstPerson  -> "First Person"
        SideScroll = 1,   // sideScroll   -> "Follow Cam"
        TopDown = 2,      // topDown      -> "Store Map"
    }

    /// <summary>
    /// Item rarity. Bible §3.1 order: common, rare, fragile, utility.
    /// (utility is declared but unused by the 30 MVP items; kept for completeness.)
    /// </summary>
    public enum ItemRarity
    {
        Common = 0,   // common
        Rare = 1,     // rare
        Fragile = 2,  // fragile
        Utility = 3,  // utility (declared, currently unused)
    }

    /// <summary>
    /// Visual silhouette category for an item (drives sprite/prefab variant).
    /// Bible §3.1 order:
    /// bottle, carton, can, box, bag, tray, produce, round, bouquet, wedge.
    /// </summary>
    public enum ItemShape
    {
        Bottle = 0,   // bottle  - tall, domed cap + label band
        Carton = 1,   // carton  - milk/oj carton with slanted top
        Can = 2,      // can     - short cylinder with rim
        Box = 3,      // box     - chunky rectangle with big label
        Bag = 4,      // bag     - rounded squashy shape with zig-zag top
        Tray = 5,     // tray    - flat meat/deli tray
        Produce = 6,  // produce - fruit/veg, emoji-first soft round shape
        Round = 7,    // round   - cake/pizza, circle from side
        Bouquet = 8,  // bouquet - flowers, triangle of colour
        Wedge = 9,    // wedge   - cheese, triangle block
    }

    /// <summary>
    /// Visual + behavioural style for a shelf row within a section (drives shelf
    /// prefab selection). Bible §3.1 order:
    /// woodenCrates, bakeryShelf, deliCounter, coolerFridge, freezerCase,
    /// snackRack, warehouseShelf.
    /// </summary>
    public enum ShelfStyle
    {
        WoodenCrates = 0,    // woodenCrates   - produce
        BakeryShelf = 1,     // bakeryShelf    - bakery, warm brown with bread
        DeliCounter = 2,     // deliCounter    - deli, glass front with meats/cheeses
        CoolerFridge = 3,    // coolerFridge   - dairy, white fridge
        FreezerCase = 4,     // freezerCase    - frozen, white/blue with frost
        SnackRack = 5,       // snackRack      - snacks & drinks, colourful rack
        WarehouseShelf = 6,  // warehouseShelf - household, tall grey shelving
    }
}
