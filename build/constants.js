// Mirrors src/wallMaterials.js's WALL_NAMES and src/App.jsx's TARGETS ids on
// the client. Server is intentionally self-contained (not importing from the
// client package) -- keep these two lists in sync by hand if either changes.
export const WALL_TYPES = [
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
];
export const WALL_MAX_HEALTH = 100;
export const TARGET_IDS = ["target-a", "target-b", "target-c"];
