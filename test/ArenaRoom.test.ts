import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

import appConfig from "../src/app.config.js";
import { ArenaState } from "../src/rooms/schema/ArenaState.js";
import { WALL_IDS, WALL_STRENGTH } from "../src/constants.js";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer<typeof appConfig>;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("connecting into a room", async () => {
    // `room` is the server-side Room instance reference.
    const room = await colyseus.createRoom<ArenaState>("arena", {});

    // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
    const client1 = await colyseus.connectTo(room);

    // make your assertions
    assert.strictEqual(client1.sessionId, room.clients[0].sessionId);
    assert.strictEqual(Object.keys(client1.state.toJSON().walls ?? {}).length, WALL_IDS.length);
    assert.strictEqual(client1.state.walls.get("brick_wall").hp, WALL_STRENGTH["brick_wall"]);
  });

  // Exercises the exact message shapes src/network/NetworkContext.jsx and
  // Player.jsx send from the client, end-to-end against the real room --
  // catches a field-name mismatch between client and server that a
  // TypeScript-only check on the server side can't.
  it("relays move/wallDamage/targetHit/winPanelHit between two clients", async () => {
    const room = await colyseus.createRoom<ArenaState>("arena", {});
    const client1 = await colyseus.connectTo(room);
    const client2 = await colyseus.connectTo(room);

    client1.send("move", {
      x: 1, y: 2, z: 3, yaw: 0.5, speed: 0.75, firing: true,
      beamToX: 4, beamToY: 5, beamToZ: 6,
    });
    await room.waitForNextPatch();

    const p1FromClient2 = client2.state.players.get(client1.sessionId);
    assert.strictEqual(p1FromClient2.x, 1);
    assert.strictEqual(p1FromClient2.speed, 0.75);
    assert.strictEqual(p1FromClient2.firing, true);
    assert.strictEqual(p1FromClient2.beamToZ, 6);

    client1.send("wallDamage", { wallId: "brick_wall", hp: 42 });
    await room.waitForNextPatch();
    assert.strictEqual(client2.state.walls.get("brick_wall").hp, 42);

    client1.send("wallDestroyed", { wallId: "brick_wall" });
    await room.waitForNextPatch();
    assert.strictEqual(client2.state.walls.get("brick_wall").destroyed, true);

    client1.send("targetHit", { targetId: "target-a" });
    await room.waitForNextPatch();
    assert.strictEqual(client2.state.targetsHit.get("target-a"), true);

    // Avatar blob relays verbatim, so client2 can rebuild client1's real
    // Bloxity character (equipped cosmetics + proportions).
    const avatar = JSON.stringify({ e: { headId: "42" }, p: { height: 1.2 } });
    client1.send("setAvatar", { avatar });
    await room.waitForNextPatch();
    assert.strictEqual(client2.state.players.get(client1.sessionId).avatar, avatar);

    const nonceBefore = client2.state.resetNonce;
    client1.send("winPanelHit", {});
    await room.waitForNextPatch();
    assert.strictEqual(
      client2.state.walls.get("brick_wall").hp,
      WALL_STRENGTH["brick_wall"],
    );
    assert.strictEqual(client2.state.walls.get("brick_wall").destroyed, false);
    assert.strictEqual(client2.state.resetNonce, nonceBefore + 1);
  });
});
