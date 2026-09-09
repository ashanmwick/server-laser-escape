import { Room, Client } from "colyseus";
import { ArenaState, PlayerState, WallState } from "./schema/ArenaState.js";
import { WALL_IDS, WALL_STRENGTH, TARGET_IDS } from "../constants.js";

// Cap on the JSON avatar blob (see ArenaState.ts PlayerState.avatar). A full
// equipped set + 7 proportions serialises to a few hundred bytes; 4 KB is
// generous headroom and still bounds a misbehaving client.
const AVATAR_MAX_LEN = 4096;

function sanitizeAvatar(raw: unknown): string {
  return typeof raw === "string" && raw.length <= AVATAR_MAX_LEN ? raw : "";
}

/**
 * Single global room every client joins via `client.joinOrCreate("arena")`.
 * No server-side hit validation -- clients report events (as they already do
 * locally), this room just relays/stores them so other clients see them too.
 */
export class ArenaRoom extends Room<{ state: ArenaState }> {
  state = new ArenaState();

  messages = {
    // Throttled client-side -- not sent every physics frame.
    move: (client: Client, msg: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.yaw = msg.yaw;
      p.speed = msg.speed;
      p.firing = !!msg.firing;
      p.beamToX = msg.beamToX;
      p.beamToY = msg.beamToY;
      p.beamToZ = msg.beamToZ;
    },
    // The player's Bloxity avatar (equipped cosmetics + proportions) as a JSON
    // string. Sent once on connect and again whenever the portal reports the
    // avatar changed -- a human-speed event, not a per-frame one. Stored as-is
    // so every other client can build the real character; never parsed here.
    setAvatar: (client: Client, msg: { avatar?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const avatar = sanitizeAvatar(msg?.avatar);
      if (avatar) p.avatar = avatar;
    },
    // A client reporting a wall's health pool after one of its own strikes
    // (client src/systems/wallHealth.js). Sent per discrete strike -- a click,
    // then one per hold interval -- not per frame. No validation: the value is
    // clamped to the wall's pool and stored, every other client adopts it.
    // Walls only ever lose health here; a full restore is `winPanelHit`.
    wallDamage: (client: Client, msg: { wallId: string; hp: number }) => {
      const w = this.state.walls.get(msg.wallId);
      if (!w || w.destroyed) return;
      if (typeof msg.hp !== "number" || !Number.isFinite(msg.hp)) return;
      w.hp = Math.max(0, Math.min(msg.hp, w.maxHp));
      if (w.hp === 0) w.destroyed = true;
    },
    wallDestroyed: (client: Client, msg: { wallId: string }) => {
      const w = this.state.walls.get(msg.wallId);
      if (!w) return;
      w.hp = 0;
      w.destroyed = true;
    },
    targetHit: (client: Client, msg: { targetId: string }) => {
      if (!TARGET_IDS.includes(msg.targetId)) return;
      this.state.targetsHit.set(msg.targetId, true);
    },
    // A client reached a win panel (client src/systems/glowFloorPanel.js ->
    // wallHealth.js resetWalls). Restore every wall to full for the whole room
    // and bump resetNonce -- the unambiguous "a reset happened" signal every
    // other client watches to run its own local wall reset.
    winPanelHit: (client: Client) => {
      for (const w of this.state.walls.values()) {
        w.hp = w.maxHp;
        w.destroyed = false;
      }
      this.state.resetNonce++;
    },
  };

  onCreate() {
    for (const id of WALL_IDS) {
      const w = new WallState();
      w.hp = WALL_STRENGTH[id];
      w.maxHp = WALL_STRENGTH[id];
      this.state.walls.set(id, w);
    }
  }

  onJoin(client: Client, options?: { username?: string; avatar?: string }) {
    // No spawn assignment -- the client already hardcodes spawnPosition
    // and reports its real position in its first "move" message.
    const p = new PlayerState();
    p.username = typeof options?.username === "string" ? options.username.slice(0, 64) : "";
    // Seed the avatar from the join options too, so a client that joins is
    // rendered as the right character even before its first `setAvatar`.
    p.avatar = sanitizeAvatar(options?.avatar);
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
