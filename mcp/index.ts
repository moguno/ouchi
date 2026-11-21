import { serve } from "@hono/node-server";
import { createMcpApp, MCP_SERVER_NAME } from "./protocol";
import { LedgerRestClient } from "./restClient";

const port = Number(process.env.MCP_PORT ?? 3333);
const hostname = process.env.MCP_HOST ?? "0.0.0.0";
const restApiUrl =
  process.env.OUCHI_REST_URL?.trim() || "http://127.0.0.1:3000";
const client = new LedgerRestClient(restApiUrl);
const app = createMcpApp(client);

const server = serve(
  {
    fetch: app.fetch,
    hostname,
    port,
  },
  (info) => {
    console.log(
      `${MCP_SERVER_NAME} listening on http://${hostname}:${info.port}/mcp`,
    );
    console.log(`REST API upstream: ${restApiUrl}`);
    console.log(
      "WARNING: authentication is disabled. Keep this endpoint on the LAN; never expose it to the WAN.",
    );
  },
);

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
