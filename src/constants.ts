// Mirrors the client's wall model so wall health can be shared between players.
// The server is intentionally self-contained (it does not import from the
// client package) -- keep this in sync BY HAND with:
//   client src/data/wallProps.js  -> WALLS order (stage 1..25)
//   client src/data/wallHealth.js -> STAGE_STRENGTH (each wall's full HP pool)
//
// Each wall's "strength" IS its full health pool. A client reports the pool's
// new value after every strike (`wallDamage`), the room clamps and stores it,
// and every other client adopts it -- no server-side hit validation, same
// client-trusted design as `move` and `username`.

// stage number -> full health pool. Ramps 10 -> 1,000,000,000 across 25 stages.
const STAGE_STRENGTH: Record<number, number> = {
  1: 10,
  2: 50,
  3: 250,
  4: 1_000,
  5: 5_000,
  6: 15_000,
  7: 50_000,
  8: 150_000,
  9: 500_000,
  10: 1_500_000,
  11: 4_500_000,
  12: 10_000_000,
  13: 25_000_000,
  14: 50_000_000,
  15: 100_000_000,
  16: 200_000_000,
  17: 300_000_000,
  18: 400_000_000,
  19: 500_000_000,
  20: 600_000_000,
  21: 700_000_000,
  22: 800_000_000,
  23: 850_000_000,
  24: 900_000_000,
  25: 1_000_000_000,
};

// Wall ids in stage order (client src/data/wallProps.js WALLS).
export const WALL_IDS = [
  "paper_wall",
  "cardboard_wall",
  "carpet_wall",
  "leather_wall",
  "rubber_wall",
  "grass_wall",
  "wood_wall",
  "glass_wall",
  "concrete_wall",
  "brick_wall",
  "limestone_wall",
  "stone_wall",
  "marble_wall",
  "iron_wall",
  "copper_wall",
  "granite_wall",
  "titanium_wall",
  "steel_wall",
  "metal_wall",
  "diamond_wall",
  "carbon_fiber_wall",
  "tungsten_wall",
  "void_wall",
  "magma_wall",
  "obsidian_wall",
];

// wallId -> full health pool, resolved through the stage order above.
export const WALL_STRENGTH: Record<string, number> = Object.fromEntries(
  WALL_IDS.map((id, i) => [id, STAGE_STRENGTH[i + 1]]),
);

export const TARGET_IDS = ["target-a", "target-b", "target-c"];
