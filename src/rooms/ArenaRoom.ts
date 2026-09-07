import { Room, Client } from "colyseus";
import { ArenaState, PlayerState, WallState } from "./schema/ArenaState.js";
import { WALL_TYPES, WALL_MAX_HEALTH, TARGET_IDS } from "../constants.js";

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
    // Throttled client-side. No validation -- client-trusted design, matches
    // the existing local-only damage model.
    wallDamage: (client: Client, msg: { wallType: string; hp: number }) => {
      const w = this.state.walls.get(msg.wallType);
      if (!w || w.destroyed) return;
      w.hp = Math.max(0, Math.min(msg.hp, w.maxHp));
    },
    wallDestroyed: (client: Client, msg: { wallType: string }) => {
      const w = this.state.walls.get(msg.wallType);
      if (!w) return;
      w.hp = 0;
      w.destroyed = true;
    },
    targetHit: (client: Client, msg: { targetId: string }) => {
      if (!TARGET_IDS.includes(msg.targetId)) return;
      this.state.targetsHit.set(msg.targetId, true);
    },
    // Mirrors App.jsx's handleWinPanelHit exactly: resets every wall's
    // hp/destroyed, does NOT touch targetsHit.
    winPanelHit: (client: Client) => {
      for (const w of this.state.walls.values()) {
        w.hp = w.maxHp;
        w.destroyed = false;
      }
      this.state.resetNonce++;
    },
  };

  onCreate() {
    for (const wallType of WALL_TYPES) {
      const w = new WallState();
      w.hp = WALL_MAX_HEALTH;
      w.maxHp = WALL_MAX_HEALTH;
      this.state.walls.set(wallType, w);
    }
  }

  onJoin(client: Client) {
    // No spawn assignment -- the client already hardcodes spawnPosition
    // and reports its real position in its first "move" message.
    this.state.players.set(client.sessionId, new PlayerState());
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
