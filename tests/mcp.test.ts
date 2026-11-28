// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest, type OutgoingHttpHeaders } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Duplex } from "node:stream";
import { createAdaptorServer } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createApp } from "../server/app";
import { PortalDatabase } from "../server/db";
import type {
  PortalApiData,
  PortalApiService,
  PortalDeviceInput,
  PortalRelationInput,
  PortalServiceInput,
} from "../src/portal/types";
import { createMcpApp } from "../mcp/protocol";
import {
  LedgerRestClient,
  type FetchImplementation,
} from "../mcp/restClient";
import { callTool } from "../mcp/tools";
const fixtureSeedPath = fileURLToPath(
  new URL("./fixtures/home-lab-seed.sql", import.meta.url),
);

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: {
    protocolVersion?: string;
    tools?: Array<{ name: string }>;
    content?: Array<{ type: string; text: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  error?: { code: number; message: string };
};

function socketPair(): [Duplex, Duplex] {
  let client: Duplex;
  let server: Duplex;
  client = new Duplex({
    read() {},
    write(chunk, _encoding, callback) {
      server.push(chunk);
      callback();
    },
    final(callback) {
      server.push(null);
      callback();
    },
  });
  server = new Duplex({
    read() {},
    write(chunk, _encoding, callback) {
      client.push(chunk);
      callback();
    },
    final(callback) {
      client.push(null);
      callback();
    },
  });
  return [client, server];
}

async function httpRequestToApp(
  fetchApp: (request: Request) => Response | Promise<Response>,
  options: {
    path: string;
    method: string;
    headers?: OutgoingHttpHeaders;
    body?: string;
  },
): Promise<{ status: number; headers: Headers; body: string }> {
  const server = createAdaptorServer({ fetch: fetchApp });
  const [clientSocket, serverSocket] = socketPair();
  server.emit("connection", serverSocket);
  try {
    return await new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          method: options.method,
          path: options.path,
          headers: options.headers,
          createConnection: () => clientSocket,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => {
            const headers = new Headers();
            for (const [name, value] of Object.entries(response.headers)) {
              if (Array.isArray(value)) {
                for (const item of value) {
                  headers.append(name, item);
                }
              } else if (value !== undefined) {
                headers.set(name, value);
              }
            }
            resolve({
              status: response.statusCode ?? 0,
              headers,
              body: Buffer.concat(chunks).toString("utf8"),
            });
          });
        },
      );
      request.on("error", reject);
      request.end(options.body);
    });
  } finally {
    clientSocket.destroy();
    serverSocket.destroy();
  }
}

function actualHttpFetch(
  fetchApp: (request: Request) => Response | Promise<Response>,
): FetchImplementation {
  return async (input, init) => {
    const request =
      input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const headers: OutgoingHttpHeaders = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.text();
    const response = await httpRequestToApp(fetchApp, {
      path: `${url.pathname}${url.search}`,
      method: request.method,
      headers,
      body,
    });
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  };
}

describe("MCP block", () => {
  let directory: string;
  let database: PortalDatabase;
  let restApp: ReturnType<typeof createApp>;
  let restClient: LedgerRestClient;
  let mcpApp: ReturnType<typeof createMcpApp>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "ouchi-mcp-test-"));
    database = new PortalDatabase({ seedPath: fixtureSeedPath,
      filename: join(directory, "ledger.sqlite"),
    });
    restApp = createApp(database);
    const fetchRest: FetchImplementation = async (input, init) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      const sourceUrl = new URL(request.url);
      return restApp.fetch(
        new Request(
          `http://rest.test${sourceUrl.pathname}${sourceUrl.search}`,
          request,
        ),
      );
    };
    restClient = new LedgerRestClient("http://rest.test", fetchRest);
    mcpApp = createMcpApp(restClient);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  async function mcpRequest(
    method: string,
    params: unknown = {},
    id: number | string | null = 1,
  ): Promise<{ status: number; body: JsonRpcResponse }> {
    const response = await mcpApp.request("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }),
    });
    return {
      status: response.status,
      body: (await response.json()) as JsonRpcResponse,
    };
  }

  async function callMcpTool(
    name: string,
    args: object,
  ): Promise<NonNullable<JsonRpcResponse["result"]>> {
    const response = await mcpRequest("tools/call", {
      name,
      arguments: args as Record<string, unknown>,
    });
    expect(response.status).toBe(200);
    expect(response.body.error).toBeUndefined();
    return response.body.result!;
  }

  it("renders hierarchy and directed relation traversal in map text", async () => {
    const result = await callMcpTool("get_network_map", {
      deviceId: 4,
      depth: 2,
    });
    expect(result.isError).toBe(false);
    const text = result.content?.[0]?.text ?? "";
    expect(text).toContain("networks:");
    expect(text).toContain("devices:");
    expect(text).toContain("services:");
    expect(text).toContain("gitea");
    expect(text).toContain("relations:");
    expect(text).toContain("device neighborhood: omv");
    expect(text).toContain("traversed relations:");
    expect(text).toContain("direction=outgoing");
    expect(text).toContain("label=ホストOS");
    expect(text).toContain("relationName=ホストOS");
    expect(text).toContain("color=#d5a22b");
    expect(text).toContain("fromLabel=ホストOS");
    expect(text).toContain("toLabel=ホストOS");
  });

  it("creates service-endpoint relations and renders them in map text", async () => {
    await callMcpTool("create_relation_name", {
      name: "サービス連携",
      color: "#7c3aed",
    });
    const created = await callMcpTool("create_relation", {
      fromServiceId: 1,
      toInterfaceId: 2,
      relationName: "サービス連携",
      fromLabel: "Webhook",
      toLabel: "",
    });
    expect(created.isError).toBe(false);

    const map = await callMcpTool("get_network_map", {
      deviceId: 1,
      depth: 1,
    });
    const mapText = map.content?.[0]?.text ?? "";
    expect(mapText).toContain("nanopi-r2s:service:gitea");
    expect(mapText).toContain("relationName=サービス連携");
  });

  it("uses relation labels in map and neighborhood text", async () => {
    await callMcpTool("create_relation_name", {
      name: "ポート接続",
      color: "#0ea5e9",
    });
    const created = await callMcpTool("create_relation", {
      fromInterfaceId: 3,
      toInterfaceId: 1,
      relationName: "ポート接続",
      fromLabel: "始点LAN",
      toLabel: "ポート8",
    });
    expect(created.isError).toBe(false);
    const empty = await callMcpTool("create_relation", {
      fromInterfaceId: 3,
      toInterfaceId: 1,
      relationName: "ポート接続",
    });
    expect(empty.isError).toBe(false);

    const map = await callMcpTool("get_network_map", {
      deviceId: 3,
      depth: 1,
    });
    const mapText = map.content?.[0]?.text ?? "";
    expect(mapText).toContain("relationName=ポート接続");
    expect(mapText).toContain("fromLabel=始点LAN");
    expect(mapText).toContain("toLabel=ポート8");
    expect(mapText).toContain("fromLabel=ポート接続");
    expect(mapText).toContain("toLabel=ポート接続");

    const neighborhood = await callMcpTool("get_device_neighborhood", {
      deviceId: 3,
      depth: 1,
    });
    const neighborhoodText = neighborhood.content?.[0]?.text ?? "";
    expect(neighborhoodText).toContain("label=始点LAN");
    expect(neighborhoodText).toContain("toLabel=ポート8");
    expect(neighborhoodText).toContain("label=ポート接続");
  });

  it("includes properties in map, neighborhood, and search output", async () => {
    const nanopi = database
      .listDevices()
      .find((device) => device.hostname === "nanopi-r2s")!;
    const gitea = database
      .listServices()
      .find((service) => service.subdomain === "gitea")!;
    database.database
      .prepare("UPDATE devices SET properties = ? WHERE id = ?")
      .run(
        JSON.stringify({
          vault_path: "sops/devices/nanopi/monitor",
          ai_note: "門番の保守メモ",
        }),
        nanopi.id,
      );
    database.database
      .prepare("UPDATE services SET properties = ? WHERE id = ?")
      .run(
        JSON.stringify({
          ciphertext: "ENC[AES256_GCM,data:gitea]",
        }),
        gitea.id,
      );

    const map = await callMcpTool("get_network_map", {
      deviceId: nanopi.id,
      depth: 1,
    });
    const mapText = map.content?.[0]?.text ?? "";
    expect(mapText).toContain(
      'properties={"vault_path":"sops/devices/nanopi/monitor","ai_note":"門番の保守メモ"}',
    );
    expect(mapText).toContain(
      'properties={"ciphertext":"ENC[AES256_GCM,data:gitea]"}',
    );

    const neighborhood = await callMcpTool("get_device_neighborhood", {
      deviceId: nanopi.id,
      depth: 1,
    });
    expect(neighborhood.content?.[0]?.text).toContain(
      '"vault_path":"sops/devices/nanopi/monitor"',
    );

    const deviceSearch = await callMcpTool("search_devices", {
      query: "門番の保守メモ",
    });
    expect(deviceSearch.structuredContent).toMatchObject({
      devices: [
        expect.objectContaining({
          hostname: "nanopi-r2s",
          properties: {
            vault_path: "sops/devices/nanopi/monitor",
            ai_note: "門番の保守メモ",
          },
        }),
      ],
    });

    const serviceSearch = await callMcpTool("search_services", {
      query: "data:gitea",
    });
    expect(serviceSearch.structuredContent).toMatchObject({
      services: [
        expect.objectContaining({
          subdomain: "gitea",
          properties: {
            ciphertext: "ENC[AES256_GCM,data:gitea]",
          },
        }),
      ],
    });
  });

  it("resolves service and monitor URLs with the REST assembly rules", async () => {
    const data = (await restApp.request("/api/portal")).json() as Promise<
      PortalApiData
    >;
    const portal = await data;
    const gitea = portal.services.find(
      (service) => service.subdomain === "gitea",
    )!;

    const serviceResult = await callMcpTool("resolve_service_url", {
      serviceId: gitea.id,
    });
    expect(serviceResult.structuredContent).toEqual({
      serviceId: gitea.id,
      subdomain: "gitea",
      kind: "service",
      url: "http://192.168.0.19:3000/",
    });

    const monitorResult = await callMcpTool("resolve_service_url", {
      serviceId: gitea.id,
      monitor: true,
    });
    expect(monitorResult.structuredContent).toMatchObject({
      kind: "monitor",
      url: "http://192.168.0.19:3000/api/v1/version",
    });
  });

  it("searches devices and services by names, descriptions, and tags", async () => {
    const deviceResult = await callMcpTool("search_devices", {
      query: "ホストOS",
    });
    expect(deviceResult.isError).toBe(false);
    expect(deviceResult.structuredContent).toMatchObject({
      count: expect.any(Number),
      devices: expect.arrayContaining([
        expect.objectContaining({
          hostname: "omv",
          relationTags: expect.arrayContaining(["ホストOS"]),
        }),
      ]),
    });

    const serviceResult = await callMcpTool("search_services", {
      query: "おうちGit",
    });
    expect(serviceResult.isError).toBe(false);
    expect(serviceResult.structuredContent).toMatchObject({
      count: 1,
      services: [
        expect.objectContaining({
          subdomain: "gitea",
          petname: "おうちGit",
          device: expect.objectContaining({ hostname: "nanopi-r2s" }),
        }),
      ],
    });
  });

  it("manages projects and passes projectId through entity tools", async () => {
    const listed = (await callMcpTool("list_projects", {}))
      .structuredContent?.result as Array<{ id: number; name: string }>;
    expect(listed).toEqual([
      { id: 1, name: "デフォルト", title: "あなたのホームラボ", color: "#c0a359", properties: {} },
    ]);

    const project = (await callMcpTool("create_project", {
      name: "MCP実験",
      title: "実験用のおうち",
      properties: { 方針: "MCP" },
    })).structuredContent?.result as { id: number; name: string };
    expect(project).toEqual({
      id: 2,
      name: "MCP実験",
      title: "実験用のおうち",
      color: "#79c059",
      properties: { 方針: "MCP" },
    });

    const device = (await callMcpTool("create_device", {
      projectId: project.id,
      hostname: "mcp-exp",
      category: "vm",
      meterEnabled: false,
    })).structuredContent?.result as { id: number; projectId: number };
    expect(device.projectId).toBe(2);

    const fetched = (await callMcpTool("get_project", { id: project.id }))
      .structuredContent?.result as { id: number; name: string };
    expect(fetched.name).toBe("MCP実験");

    const renamed = (await callMcpTool("update_project", {
      id: project.id,
      name: "MCP実験2",
    })).structuredContent?.result as { id: number; name: string };
    expect(renamed.name).toBe("MCP実験2");
  });

  it("round-trips network, device, interface, service, and relation CRUD", async () => {
    const network = (await callMcpTool("create_network", {
      name: "MCP検証網",
      cidr: "10.44.0.0/24",
      accent: "green",
      note: "created through MCP",
    })).structuredContent?.result as {
      id: number;
      name: string;
    };
    expect(network.name).toBe("MCP検証網");

    const updatedNetwork = (await callMcpTool("update_network", {
      id: network.id,
      name: "MCP検証網 更新",
      cidr: "10.44.0.0/24",
      accent: "blue",
      note: null,
    })).structuredContent?.result as { name: string; accent: string };
    expect(updatedNetwork).toMatchObject({
      name: "MCP検証網 更新",
      accent: "blue",
    });
    expect(
      (await callMcpTool("get_network", { id: network.id }))
        .structuredContent?.result,
    ).toMatchObject({ id: network.id, name: "MCP検証網 更新" });

    const deviceInput: PortalDeviceInput = {
      hostname: "mcp-test",
      petname: "MCP検証機",
      properties: {
        source: "mcp-create",
      },
      category: "physical",
      sshUser: "monitor",
      sshPort: 22,
      meterEnabled: false,
      note: null,
    };
    const device = (await callMcpTool("create_device", deviceInput))
      .structuredContent?.result as {
        id: number;
        hostname: string;
        properties: Record<string, string>;
      };
    expect(device.hostname).toBe("mcp-test");
    expect(device.properties).toEqual({ source: "mcp-create" });
    const {
      properties: deviceProperties,
      ...deviceInputWithoutProperties
    } = deviceInput;
    void deviceProperties;
    expect(
      (await callMcpTool("update_device", {
        id: device.id,
        ...deviceInputWithoutProperties,
        petname: "MCP検証機 更新",
      })).structuredContent?.result,
    ).toMatchObject({
      id: device.id,
      petname: "MCP検証機 更新",
      properties: { source: "mcp-create" },
    });
    expect(
      (await callMcpTool("update_device", {
        id: device.id,
        ...deviceInputWithoutProperties,
        properties: { source: "mcp-update" },
      })).structuredContent?.result,
    ).toMatchObject({
      id: device.id,
      properties: { source: "mcp-update" },
    });

    const iface = (await callMcpTool("create_interface", {
      deviceId: device.id,
      name: "eth0",
      networkId: network.id,
      ip: "10.44.0.20",
      label: "mcp",
    })).structuredContent?.result as { id: number };
    expect(
      (await callMcpTool("get_interface", { id: iface.id }))
        .structuredContent?.result,
    ).toMatchObject({
      id: iface.id,
      deviceId: device.id,
      networkId: network.id,
    });

    const serviceInput: PortalServiceInput = {
      interfaceId: iface.id,
      subdomain: "mcp-test",
      petname: "MCP Test",
      description: "round trip",
      properties: { source: "mcp-service" },
      port: 8080,
      protocol: "tcp",
      scheme: "http",
      topPath: "/",
      monitorPath: "/health",
      serviceUrl: null,
      iconKey: "favicon",
      enabled: true,
    };
    const service = (await callMcpTool("create_service", serviceInput))
      .structuredContent?.result as PortalApiService;
    expect(service.url).toBe("http://10.44.0.20:8080/");
    expect(service.properties).toEqual({ source: "mcp-service" });
    expect(
      (await callMcpTool("get_service", { id: service.id }))
        .structuredContent?.result,
    ).toMatchObject({ id: service.id, subdomain: "mcp-test" });

    const updatedService = (await callMcpTool("update_service", {
      id: service.id,
      ...serviceInput,
      properties: { source: "mcp-service-updated" },
      petname: "MCP Test Updated",
      port: 9090,
    })).structuredContent?.result as PortalApiService;
    expect(updatedService).toMatchObject({
      id: service.id,
      petname: "MCP Test Updated",
      port: 9090,
      url: "http://10.44.0.20:9090/",
      properties: { source: "mcp-service-updated" },
    });
    const {
      properties: serviceProperties,
      ...serviceInputWithoutProperties
    } = serviceInput;
    void serviceProperties;
    expect(
      (await callMcpTool("update_service", {
        id: service.id,
        ...serviceInputWithoutProperties,
        petname: "MCP Test Preserved",
      })).structuredContent?.result,
    ).toMatchObject({
      id: service.id,
      petname: "MCP Test Preserved",
      properties: { source: "mcp-service-updated" },
    });

    const relationName = (await callMcpTool("create_relation_name", {
      name: "MCP検証関係",
      color: "#123456",
    })).structuredContent?.result as { id: number };
    expect(
      (await callMcpTool("get_relation_name", { id: relationName.id }))
        .structuredContent?.result,
    ).toMatchObject({ name: "MCP検証関係", relationCount: 0 });

    const relationInput: PortalRelationInput = {
      fromInterfaceId: iface.id,
      toInterfaceId: 1,
      relationName: "MCP検証関係",
      fromLabel: "検証元",
      toLabel: "検証先",
    };
    const relation = (await callMcpTool("create_relation", relationInput))
      .structuredContent?.result as { id: number };
    expect(
      (await callMcpTool("update_relation", {
        id: relation.id,
        ...relationInput,
        relationName: "MCP検証関係",
      })).structuredContent?.result,
    ).toMatchObject({
      id: relation.id,
      fromLabel: "検証元",
      toLabel: "検証先",
    });
    expect(
      (await callMcpTool("get_relation", { id: relation.id }))
        .structuredContent?.result,
    ).toMatchObject({ id: relation.id, relationName: "MCP検証関係" });
    expect(
      (await callMcpTool("get_device_relations", {
        deviceId: device.id,
      })).structuredContent?.result,
    ).toMatchObject({ deviceId: device.id });

    expect(
      (await callMcpTool("delete_relation", { id: relation.id }))
        .structuredContent?.result,
    ).toEqual({ ok: true });
    expect(
      (await callMcpTool("delete_relation_name", { id: relationName.id }))
        .structuredContent?.result,
    ).toEqual({ ok: true });
    expect(
      (await callMcpTool("delete_service", { id: service.id }))
        .structuredContent?.result,
    ).toEqual({ ok: true });
    expect(
      (await callMcpTool("delete_interface", { id: iface.id }))
        .structuredContent?.result,
    ).toEqual({ ok: true });
    expect(
      (await callMcpTool("delete_device", { id: device.id }))
        .structuredContent?.result,
    ).toEqual({ ok: true });
    expect(
      (await callMcpTool("delete_network", { id: network.id }))
        .structuredContent?.result,
    ).toEqual({ ok: true });
  });

  it("returns the same validation issues as REST", async () => {
    const invalidService = {
      interfaceId: 1,
      subdomain: "",
      port: 70_000,
      protocol: "smtp",
      scheme: "ftp",
      enabled: true,
    };
    const restResponse = await restApp.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidService),
    });
    expect(restResponse.status).toBe(400);
    const restBody = await restResponse.json();

    const mcpResult = await callMcpTool("create_service", invalidService);
    expect(mcpResult.isError).toBe(true);
    expect(mcpResult.structuredContent).toEqual({
      error: {
        status: 400,
        path: "/api/services",
        body: restBody,
      },
    });
  });

  it("carries interface properties through interface tools", async () => {
    const device = (await callMcpTool("create_device", {
      hostname: "mcp-iface-memo",
      petname: null,
      category: "physical",
      sshUser: null,
      sshPort: null,
      meterEnabled: false,
      note: null,
    })).structuredContent?.result as { id: number };
    const iface = (await callMcpTool("create_interface", {
      deviceId: device.id,
      name: "eth0",
      networkId: null,
      ip: null,
      mac: null,
      properties: { 役割: "管理用" },
    })).structuredContent?.result as {
      id: number;
      properties: Record<string, string>;
    };
    expect(iface.properties).toEqual({ 役割: "管理用" });

    const updated = (await callMcpTool("update_interface", {
      id: iface.id,
      deviceId: device.id,
      name: "eth0",
      networkId: null,
      ip: "192.168.0.99",
      mac: null,
    })).structuredContent?.result as {
      properties: Record<string, string>;
    };
    expect(updated.properties).toEqual({ 役割: "管理用" });
  });

  it("cascades device children through delete_device", async () => {
    const device = (await callMcpTool("create_device", {
      hostname: "mcp-delete-cascade",
      petname: "MCP削除回帰機",
      category: "physical",
      sshUser: null,
      sshPort: null,
      meterEnabled: false,
      note: null,
    })).structuredContent?.result as { id: number };
    const iface = (await callMcpTool("create_interface", {
      deviceId: device.id,
      name: "eth0",
      networkId: 1,
      ip: "192.168.0.251",
      label: "mcp-delete-regression",
    })).structuredContent?.result as { id: number };
    const relation = (await callMcpTool("create_relation", {
      fromInterfaceId: iface.id,
      toInterfaceId: 1,
      relationName: "ホストOS",
    })).structuredContent?.result as { id: number };
    const service = (await callMcpTool("create_service", {
      interfaceId: iface.id,
      subdomain: "mcp-delete-cascade-service",
      petname: "MCP削除回帰サービス",
      description: null,
      port: 8081,
      protocol: "tcp",
      scheme: "http",
      topPath: "/",
      monitorPath: "/",
      serviceUrl: null,
      iconKey: "favicon",
      enabled: true,
    })).structuredContent?.result as { id: number };

    expect(database.deviceCascadeCounts(device.id)).toEqual({
      interfaces: 1,
      services: 1,
      relations: 1,
    });
    expect(
      (await callMcpTool("delete_device", {
        id: device.id,
      })).structuredContent?.result,
    ).toEqual({ ok: true });
    expect(database.getDevice(device.id)).toBeUndefined();
    expect(database.getInterface(iface.id)).toBeUndefined();
    expect(database.getRelation(relation.id)).toBeUndefined();
    expect(database.getService(service.id)).toBeUndefined();
  });

  it("rejects duplicate and unresolved relation edges through REST", async () => {
    const before = database.listRelations().length;
    const createResult = await callMcpTool("create_relation", {
      fromInterfaceId: 3,
      toInterfaceId: 1,
      relationName: "ホストOS",
    });
    expect(createResult.isError).toBe(false);
    const duplicateResult = await callMcpTool("create_relation", {
      fromInterfaceId: 3,
      toInterfaceId: 1,
      relationName: "ホストOS",
    });
    expect(duplicateResult.isError).toBe(true);
    expect(duplicateResult.structuredContent).toMatchObject({
      error: {
        status: 400,
        body: {
          issues: [
            {
              path: "relationName",
              message:
                "同じ関係名・始点・終点・ラベル・ポートの関係はすでに登録されています",
            },
          ],
        },
      },
    });

    const updateResult = await callMcpTool("update_relation", {
      id: (createResult.structuredContent?.result as { id: number }).id,
      fromInterfaceId: 3,
      toInterfaceId: 1,
      relationName: "存在しない関係名",
    });
    expect(updateResult.isError).toBe(true);
    expect(updateResult.structuredContent).toMatchObject({
      error: {
        status: 400,
        body: {
          issues: [
            {
              path: "relationName",
              message: "関係名が存在しません",
            },
          ],
        },
      },
    });
    expect(database.listRelations()).toHaveLength(before + 1);
  });

  it("updates ouchi settings, network properties, and network order", async () => {
    const settings = (
      await callMcpTool("update_settings", {
        properties: { 運用: "MCPメモ" },
      })
    ).structuredContent?.result as {
      title: string;
      properties: Record<string, string>;
    };
    expect(settings.properties).toEqual({ 運用: "MCPメモ" });
    expect(settings.title).toBe(database.getSettings().title);
    expect(database.getSettings().properties).toEqual({ 運用: "MCPメモ" });

    const networks = database.listNetworks();
    const network = networks[0];
    const updated = (
      await callMcpTool("update_network", {
        id: network.id,
        name: network.name,
        cidr: network.cidr,
        accent: network.accent,
        note: network.note,
        properties: { 方針: "MCP" },
      })
    ).structuredContent?.result as {
      properties: Record<string, string>;
    };
    expect(updated.properties).toEqual({ 方針: "MCP" });

    const reversed = networks.map((item) => item.id).reverse();
    const reordered = (
      await callMcpTool("reorder_networks", { ids: reversed })
    ).structuredContent?.result as Array<{ id: number }>;
    expect(reordered.map((item) => item.id)).toEqual(reversed);
    expect(database.listNetworks().map((item) => item.id)).toEqual(reversed);

    const map = await callMcpTool("get_network_map", {});
    const mapText = map.content?.[0]?.text ?? "";
    expect(mapText).toContain("ouchi properties={\"運用\":\"MCPメモ\"}");
    expect(mapText).toContain("properties={\"方針\":\"MCP\"}");
  });

  it("enforces the service-category pseudo-device rules in REST", async () => {
    const invalidDevice = await callMcpTool("create_device", {
      hostname: "invalid-service-node",
      category: "service",
      meterEnabled: true,
    });
    expect(invalidDevice.isError).toBe(true);
    expect(invalidDevice.structuredContent).toMatchObject({
      error: {
        status: 400,
        body: {
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "category" }),
          ]),
        },
      },
    });

    const serviceDevice = (await callMcpTool("create_device", {
      hostname: "service-node",
      category: "service",
      meterEnabled: false,
    })).structuredContent?.result as { id: number };
    const invalidInterface = await callMcpTool("create_interface", {
      deviceId: serviceDevice.id,
      name: "eth0",
      networkId: 1,
      ip: "192.168.0.200",
      label: null,
    });
    expect(invalidInterface.isError).toBe(true);
    expect(invalidInterface.structuredContent).toMatchObject({
      error: {
        status: 400,
        body: {
          issues: [
            {
              path: "ip",
              message: "サービスカテゴリーのインターフェースIPはNULLにしてください",
            },
          ],
        },
      },
    });
  });

  it("exports and replaces one project through the YAML tools", async () => {
    const exported = await callMcpTool("export_ledger_yaml", {});
    expect(exported.isError).toBe(false);
    const yaml = exported.content?.[0]?.text;
    expect(typeof yaml).toBe("string");
    const document = parseYaml(yaml as string) as {
      exportedAt: string;
      settings: { domain: string; title: string };
    };
    expect(document.settings.domain).toBe("ouchi.local");
    document.settings.title = "MCPから置換";

    const imported = await callMcpTool("import_ledger_yaml", {
      yaml: stringifyYaml(document),
    });
    expect(imported.isError).toBe(false);
    expect(imported.structuredContent).toMatchObject({
      ok: true,
      imported: {
        networks: 3,
        devices: 16,
        interfaces: 17,
        relationNames: 2,
        relations: 5,
        services: 9,
      },
    });
    const portal = await restClient.getPortalData();
    expect(portal.settings.title).toBe("MCPから置換");
  });

  it("serves initialize, tools/list, and tools/call over real HTTP messages", async () => {
    const actualClient = new LedgerRestClient(
      "http://rest.test",
      actualHttpFetch(restApp.fetch),
    );
    const actualMcpApp = createMcpApp(actualClient);
    const initialize = await httpRequestToApp(actualMcpApp.fetch, {
      method: "POST",
      path: "/mcp",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "vitest-real-http", version: "1.0.0" },
          },
        }),
    });
    expect(initialize.status).toBe(200);
    const initialized = JSON.parse(initialize.body) as JsonRpcResponse;
    expect(initialized.result?.protocolVersion).toBe("2025-06-18");

    const notification = await httpRequestToApp(actualMcpApp.fetch, {
      method: "POST",
      path: "/mcp",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
    });
    expect(notification.status).toBe(202);

    const listResponse = await httpRequestToApp(actualMcpApp.fetch, {
      method: "POST",
      path: "/mcp",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
    });
    expect(listResponse.status).toBe(200);
    const listed = JSON.parse(listResponse.body) as JsonRpcResponse;
    expect(listed.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "get_network_map",
        "search_devices",
        "resolve_service_url",
        "create_service",
        "create_relation_name",
        "create_relation",
        "import_ledger_yaml",
      ]),
    );
    expect(listed.result?.tools).toHaveLength(44);

    const mapResponse = await httpRequestToApp(actualMcpApp.fetch, {
      method: "POST",
      path: "/mcp",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "get_network_map",
            arguments: { deviceId: 4, depth: 1 },
          },
        }),
    });
    expect(mapResponse.status).toBe(200);
    const mapResult = JSON.parse(mapResponse.body) as JsonRpcResponse;
    expect(mapResult.result?.isError).toBe(false);
    expect(mapResult.result?.content?.[0]?.text).toContain(
      "direction=outgoing",
    );
  });

  it("interoperates with the official MCP SDK client", async () => {
    const actualClient = new LedgerRestClient(
      "http://rest.test",
      actualHttpFetch(restApp.fetch),
    );
    const actualMcpApp = createMcpApp(actualClient);
    const transport = new StreamableHTTPClientTransport(
      new URL("http://mcp.test/mcp"),
      { fetch: actualHttpFetch(actualMcpApp.fetch) },
    );
    const client = new Client({
      name: "vitest-sdk-client",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(44);
      expect(tools.tools.map((tool) => tool.name)).toContain(
        "get_network_map",
      );

      const result = (await client.callTool({
        name: "get_network_map",
        arguments: { deviceId: 4, depth: 1 },
      })) as {
        content: Array<{ type: string; text?: string }>;
        isError?: boolean;
      };
      expect(result.isError).toBe(false);
      expect(result.content[0]?.text).toContain("direction=outgoing");
    } finally {
      await client.close();
    }
  });
});
