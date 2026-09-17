import { Room, Client, CloseCode } from "colyseus";
import { ArenaState, PlayerState } from "./schema/ArenaState.js";
import { TARGET_IDS } from "../constants.js";

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
    // The player's own live stats (client store/useGameStore.js power/
    // rebirth/wins), so an in-world leaderboard (client components/
    // LeaderboardBoard.jsx) can rank currently-connected players. Sent
    // debounced on change (client systems/net.js scheduleStatsResend), not
    // per frame -- same "human-speed event" cadence as setAvatar above. No
    // validation beyond finite/non-negative, same trust model as every other
    // message here.
    stats: (client: Client, msg: { power?: number; rebirth?: number; wins?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg?.power === "number" && Number.isFinite(msg.power)) {
        p.power = Math.max(0, msg.power);
      }
      if (typeof msg?.rebirth === "number" && Number.isFinite(msg.rebirth)) {
        p.rebirth = Math.max(0, msg.rebirth);
      }
      if (typeof msg?.wins === "number" && Number.isFinite(msg.wins)) {
        p.wins = Math.max(0, msg.wins);
      }
    },
    targetHit: (client: Client, msg: { targetId: string }) => {
      if (!TARGET_IDS.includes(msg.targetId)) return;
      this.state.targetsHit.set(msg.targetId, true);
    },
    // A client reporting a PVP hit it landed on another player (client
    // src/systems/playerCombat.js strikeTarget()) -- client-trusted, same as
    // `move`/`username`. No self-damage, and a dead target stays dead until
    // its own client sends playerRespawn.
    playerDamage: (client: Client, msg: { targetId: string; hp: number }) => {
      if (!msg || msg.targetId === client.sessionId) return;
      const target = this.state.players.get(msg.targetId);
      if (!target || target.dead) return;
      if (typeof msg.hp !== "number" || !Number.isFinite(msg.hp)) return;
      target.hp = Math.max(0, Math.min(msg.hp, target.maxHp));
      if (target.hp === 0) target.dead = true;
    },
    // The dead player's own client, once its local respawn timer elapses
    // (client src/systems/playerHealth.js). Restores this one player to full
    // hp and clears `dead`.
    playerRespawn: (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.hp = p.maxHp;
      p.dead = false;
    },
  };

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

  // A deliberate `room.leave()` (client teardown()) closes with CONSENTED --
  // drop that player immediately, same as before. Anything else (WiFi blip,
  // backgrounded tab, mobile network switch) is exactly what the CLIENT's own
  // net.js already assumes rides out via "@colyseus/sdk's built-in Room
  // reconnection" (its own header comment) -- but that reconnection can only
  // succeed if THIS room still recognises the old session when the client
  // comes back. Without allowReconnection, every abnormal drop looked
  // consented to the room: the PlayerState was deleted on the spot, so a
  // client reconnecting moments later re-joined as a brand new player while
  // its OWN local remotePlayers bookkeeping (and everyone else's) still held
  // stale references to the old sessionId for a few seconds -- exactly the
  // kind of "some clients show a player, some don't" asymmetry that timing-
  // dependent double-bookkeeping produces. 20s matches the client's own
  // RETRY_BACKOFF_MS ceiling (data/net.js).
  async onLeave(client: Client, code?: number) {
    if (code === CloseCode.CONSENTED) {
      this.state.players.delete(client.sessionId);
      return;
    }
    try {
      await this.allowReconnection(client, 20);
      // Reconnected within the window -- same sessionId, PlayerState untouched.
    } catch {
      this.state.players.delete(client.sessionId);
    }
  }
}
