import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    username: t.string().default(""), // client-reported Bloxity displayName/username, not validated
    x: t.number().default(0),
    y: t.number().default(0),
    z: t.number().default(0),
    yaw: t.number().default(0),
    speed: t.number().default(0), // 0..1 eased gait factor (Player.jsx's wishSpeed / SPEED)
    firing: t.boolean().default(false),
    beamToX: t.number().default(0), // world-space beam endpoint, so remote clients don't re-raycast
    beamToY: t.number().default(0),
    beamToZ: t.number().default(0),
    // The player's Bloxity avatar, so remote clients render the real character
    // (equipped cosmetics + proportions) instead of a capsule. A JSON string:
    // {"e": <equipped ids object>, "p": <proportions object>}. Client-reported,
    // never validated -- same trust model as `username`; only length-capped
    // (see ArenaRoom.ts AVATAR_MAX_LEN).
    avatar: t.string().default(""),
    // Live client-reported gameplay stats (client store/useGameStore.js
    // power/rebirth/wins), so an in-world leaderboard (client components/
    // LeaderboardBoard.jsx) can rank currently-connected players. Client-
    // reported, never validated beyond a finite/non-negative check
    // (ArenaRoom.ts's `stats` handler) -- same trust model as `username`/
    // `avatar`. No persistence: like every other field here, these reset to
    // 0 for a player on rejoin and the whole room resets on server restart.
    power: t.number().default(0),
    rebirth: t.number().default(0),
    wins: t.number().default(0),
    // PVP health (client src/systems/playerCombat.js / playerHealth.js). The
    // attacker's client computes and reports the target's next hp (client-
    // trusted, same as `move`/`username`); `dead` flips true the instant hp
    // hits 0 and stays true until the dead player's own client sends
    // `playerRespawn`. Default matches client src/data/playerHealth.js's
    // PLAYER_MAX_HP.
    hp: t.number().default(100),
    maxHp: t.number().default(100),
    dead: t.boolean().default(false),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const ArenaState = schema(
  {
    players: t.map(PlayerState), // keyed by sessionId
    targetsHit: t.map("boolean"), // keyed by target id ("target-a" | "target-b" | "target-c")
  },
  "ArenaState",
);
export type ArenaState = SchemaType<typeof ArenaState>;
