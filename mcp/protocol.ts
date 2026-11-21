import { Hono } from "hono";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { LedgerRestClient, RestApiError } from "./restClient";
import { callTool, TOOL_DEFINITIONS } from "./tools";

export const MCP_SERVER_NAME = "ouchi-ledger-mcp";
export const MCP_SERVER_VERSION = "1.0.0";
export const MCP_LATEST_PROTOCOL_VERSION = "2025-11-25";

const MCP_INSTRUCTIONS =
  "ouchi.local の台帳 REST API を読み書きする LAN 用 MCP サーバーです。" +
  "認証はありません。WAN へ公開せず、LAN 内からのみ利用してください。" +
  "書き込みは REST API と同じ検証を通り、拒否時は issues をそのまま返します。";

function errorResult(error: unknown): CallToolResult {
  if (error instanceof RestApiError) {
    const details = {
      status: error.status,
      path: error.path,
      body: error.body,
    };
    return {
      content: [
        {
          type: "text",
          text:
            `REST API ${error.status} (${error.path})\n` +
            JSON.stringify(error.body, null, 2),
        },
      ],
      structuredContent: { error: details },
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { error: { message } },
    isError: true,
  };
}

export function createMcpServer(client: LedgerRestClient): Server {
  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      title: "ouchi.local AI用ネットワーク地図",
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      instructions: MCP_INSTRUCTIONS,
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS as Tool[],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await callTool(
        request.params.name,
        request.params.arguments ?? {},
        client,
      );
      return {
        content: [{ type: "text", text: result.text }],
        ...(result.structuredContent
          ? { structuredContent: result.structuredContent }
          : {}),
        isError: result.isError === true,
      } satisfies CallToolResult;
    } catch (error) {
      return errorResult(error);
    }
  });

  return server;
}

function methodNotAllowed() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message:
          "このサーバーはステートレス Streamable HTTP POST のみ対応します",
      },
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST",
      },
    },
  );
}

export function createMcpApp(client: LedgerRestClient): Hono {
  const app = new Hono();

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: MCP_SERVER_NAME,
      transport: "streamable-http",
      authentication: "none-lan-only",
      restApi: client.baseUrl,
      sdk: "@modelcontextprotocol/sdk",
    }),
  );

  app.post("/mcp", async (context) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createMcpServer(client);
    await server.connect(transport);
    try {
      return await transport.handleRequest(context.req.raw);
    } finally {
      await server.close();
    }
  });

  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  app.notFound((context) =>
    context.json({ error: "MCPエンドポイントが見つかりません" }, 404),
  );

  return app;
}
