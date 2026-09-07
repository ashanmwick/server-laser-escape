import { schema, t, type SchemaType } from "@colyseus/schema";

export const PlayerState = schema(
  {
    x: t.number().default(0),
    y: t.number().default(0),
    z: t.number().default(0),
    yaw: t.number().default(0),
    speed: t.number().default(0), // 0..1 eased gait factor (Player.jsx's wishSpeed / SPEED)
    firing: t.boolean().default(false),
    beamToX: t.number().default(0), // world-space beam endpoint, so remote clients don't re-raycast
    beamToY: t.number().default(0),
    beamToZ: t.number().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const WallState = schema(
  {
    hp: t.number().default(100),
    maxHp: t.number().default(100),
    destroyed: t.boolean().default(false),
  },
  "WallState",
);
export type WallState = SchemaType<typeof WallState>;

export const ArenaState = schema(
  {
    players: t.map(PlayerState), // keyed by sessionId
    walls: t.map(WallState), // keyed by wallType string (matches wallHealth Map keys, e.g. "brick_wall")
    targetsHit: t.map("boolean"), // keyed by target id ("target-a" | "target-b" | "target-c")
    resetNonce: t.number().default(0), // incremented on every winPanelHit -- unambiguous room-wide "reset happened" signal
  },
  "ArenaState",
);
export type ArenaState = SchemaType<typeof ArenaState>;
