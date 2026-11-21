import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { resolve } from "node:path";
import { createApp } from "./app";
import { PortalDatabase } from "./db";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";
const database = new PortalDatabase({
  filename: process.env.OUCHI_DB_PATH
    ? resolve(process.env.OUCHI_DB_PATH)
    : undefined,
});
const app = createApp(database);

app.get("/api/*", (context) =>
  context.json({ error: "APIエンドポイントが見つかりません" }, 404),
);
app.use(
  "/*",
  serveStatic({
    root: "./demo-dist",
  }),
);
app.get(
  "*",
  serveStatic({
    path: "./index.html",
    root: "./demo-dist",
  }),
);

const server = serve(
  {
    fetch: app.fetch,
    hostname,
    port,
  },
  (info) => {
    console.log(
      `ouchi.local v1 listening on http://${hostname}:${info.port}`,
    );
    console.log(
      `SQLite ledger: ${
        process.env.OUCHI_DB_PATH
          ? resolve(process.env.OUCHI_DB_PATH)
          : resolve(process.cwd(), "data", "ouchi.sqlite")
      }`,
    );
  },
);

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
