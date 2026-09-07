import cors from "cors";
import {
  defineServer,
  defineRoom,
  monitor,
  playground,
} from "colyseus";

/**
 * Import your Room files
 */
import { ArenaRoom } from "./rooms/ArenaRoom.js";

const server = defineServer({

  /**
   * Define your room handlers:
   */
  rooms: {
    arena: defineRoom(ArenaRoom),
  },

  /**
   * Bind your custom express routes here:
   * Read more: https://expressjs.com/en/starter/basic-routing.html
   */
  express: (app) => {

    // Wildcard origin is fine for local dev only -- this has no deploy
    // target yet; add a real allowlist before deploying anywhere.
    app.use(cors());

    /**
     * Use @colyseus/monitor
     * If you expose it in production, make sure to protect it with a password:
     * https://docs.colyseus.io/tools/monitoring#password-protection
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== "production") {
      app.use("/", playground());
    }
  }
});

export default server;

