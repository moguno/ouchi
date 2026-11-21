// mcp/index.ts
import { serve } from "@hono/node-server";

// mcp/protocol.ts
import { Hono } from "hono";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// mcp/restClient.ts
var RestApiError = class extends Error {
  status;
  body;
  path;
  constructor(path, status, body) {
    super(`REST API ${status}: ${path}`);
    this.name = "RestApiError";
    this.path = path;
    this.status = status;
    this.body = body;
  }
};
async function responseBody(response) {
  const text = await response.text();
  if (text === "") {
    return null;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}
function withoutTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
var LedgerRestClient = class {
  baseUrl;
  fetchImpl;
  constructor(baseUrl, fetchImpl = globalThis.fetch) {
    this.baseUrl = withoutTrailingSlash(baseUrl);
    this.fetchImpl = fetchImpl;
  }
  async request(path, init) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json, application/yaml, text/yaml",
        ...init?.headers
      }
    });
    const body = await responseBody(response);
    if (!response.ok) {
      throw new RestApiError(path, response.status, body);
    }
    return body;
  }
  async write(method, path, body) {
    return this.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  getPortalData() {
    return this.request("/api/portal");
  }
  listNetworks() {
    return this.request("/api/networks");
  }
  async getNetwork(id) {
    return (await this.listNetworks()).find((network) => network.id === id);
  }
  createNetwork(input) {
    return this.write("POST", "/api/networks", input);
  }
  updateNetwork(id, input) {
    return this.write("PUT", `/api/networks/${id}`, input);
  }
  deleteNetwork(id) {
    return this.request(`/api/networks/${id}`, { method: "DELETE" });
  }
  listDevices() {
    return this.request("/api/devices");
  }
  async getDevice(id) {
    return (await this.listDevices()).find((device) => device.id === id);
  }
  createDevice(input) {
    return this.write("POST", "/api/devices", input);
  }
  updateDevice(id, input) {
    return this.write("PUT", `/api/devices/${id}`, input);
  }
  deleteDevice(id) {
    return this.request(`/api/devices/${id}`, { method: "DELETE" });
  }
  listMemberships() {
    return this.request("/api/memberships");
  }
  async getMembership(id) {
    return (await this.listMemberships()).find(
      (membership) => membership.id === id
    );
  }
  createMembership(input) {
    return this.write("POST", "/api/memberships", input);
  }
  updateMembership(id, input) {
    return this.write("PUT", `/api/memberships/${id}`, input);
  }
  deleteMembership(id) {
    return this.request(`/api/memberships/${id}`, { method: "DELETE" });
  }
  listServices() {
    return this.request("/api/services");
  }
  async getService(id) {
    return (await this.listServices()).find((service) => service.id === id);
  }
  createService(input) {
    return this.write("POST", "/api/services", input);
  }
  updateService(id, input) {
    return this.write("PUT", `/api/services/${id}`, input);
  }
  deleteService(id) {
    return this.request(`/api/services/${id}`, { method: "DELETE" });
  }
  listRelations() {
    return this.request("/api/relations");
  }
  async getRelation(id) {
    return (await this.listRelations()).find(
      (relation) => relation.id === id
    );
  }
  createRelation(input) {
    return this.write("POST", "/api/relations", input);
  }
  updateRelation(id, input) {
    return this.write("PUT", `/api/relations/${id}`, input);
  }
  deleteRelation(id) {
    return this.request(`/api/relations/${id}`, { method: "DELETE" });
  }
  traverseDeviceRelations(id, depth) {
    return this.request(
      `/api/devices/${id}/relations?depth=${encodeURIComponent(depth)}`
    );
  }
  exportYaml() {
    return this.request("/api/export");
  }
  importYaml(yaml) {
    return this.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: yaml
    });
  }
};

// mcp/mapText.ts
function deviceLabel(device) {
  const petname = device.petname ? ` / ${device.petname}` : "";
  return `${device.hostname}${petname} (id=${device.id}, category=${device.category})`;
}
function networkLabel(network) {
  const cidr = network.cidr ? `, ${network.cidr}` : "";
  return `${network.name} (id=${network.id}, accent=${network.accent}${cidr})`;
}
function membershipSuffix(membership) {
  const ip = membership.ip ? membership.ip : "(IP\u306A\u3057)";
  const label = membership.label ? `, label=${membership.label}` : "";
  return `${ip}${label}, membershipId=${membership.id}`;
}
function serviceLine(service) {
  const petname = service.petname ? ` / ${service.petname}` : "";
  const description = service.description ? ` \u2014 ${service.description}` : "";
  const url = service.url ?? "(URL\u672A\u89E3\u6C7A)";
  return `${service.subdomain}${petname} (id=${service.id}, ${service.scheme}:${service.port}${service.topPath ?? ""}, url=${url})${description}`;
}
function relationLine(data, relation) {
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const from = deviceById.get(relation.fromDeviceId)?.hostname ?? "?";
  const to = deviceById.get(relation.toDeviceId)?.hostname ?? "?";
  const fromLabel = relation.fromLabel ?? relation.tag;
  const toLabel = relation.toLabel ?? relation.tag;
  return `${from} --[${fromLabel}]--> ${to} [tag=${relation.tag}, color=${relation.color}, fromLabel=${fromLabel}, toLabel=${toLabel}, id=${relation.id}]`;
}
function relatedServiceMap(memberships, services) {
  const servicesByMembership = /* @__PURE__ */ new Map();
  for (const service of services) {
    const list = servicesByMembership.get(service.deviceNetworkId) ?? [];
    list.push(service);
    servicesByMembership.set(service.deviceNetworkId, list);
  }
  return servicesByMembership;
}
function hierarchyLines(data) {
  const membershipsByNetwork = /* @__PURE__ */ new Map();
  for (const membership of data.devices.flatMap(
    (device) => device.memberships
  )) {
    const list = membershipsByNetwork.get(membership.networkId) ?? [];
    list.push(membership);
    membershipsByNetwork.set(membership.networkId, list);
  }
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const servicesByMembership = relatedServiceMap(
    data.devices.flatMap((device) => device.memberships),
    data.services
  );
  const lines = ["networks:"];
  for (const network of data.networks) {
    lines.push(`- ${networkLabel(network)}`);
    const memberships = membershipsByNetwork.get(network.id) ?? [];
    if (memberships.length === 0) {
      lines.push("  devices: (\u306A\u3057)");
      continue;
    }
    lines.push("  devices:");
    for (const membership of memberships) {
      const device = deviceById.get(membership.deviceId);
      if (!device) {
        continue;
      }
      lines.push(
        `  - ${deviceLabel(device)} [interface: ${membershipSuffix(membership)}]`
      );
      const services = servicesByMembership.get(membership.id) ?? [];
      if (services.length === 0) {
        lines.push("    services: (\u306A\u3057)");
      } else {
        lines.push("    services:");
        for (const service of services) {
          lines.push(`    - ${serviceLine(service)}`);
        }
      }
    }
  }
  return lines;
}
function collectRelationTraversal(data, startDeviceId, depth) {
  const normalizedDepth2 = Number.isInteger(depth) && depth >= 0 ? depth : 1;
  const relations = data.relations;
  const deviceDepths = /* @__PURE__ */ new Map([[startDeviceId, 0]]);
  const traversals = /* @__PURE__ */ new Map();
  const queue = [
    { deviceId: startDeviceId, currentDepth: 0 }
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.currentDepth >= normalizedDepth2) {
      continue;
    }
    for (const relation of relations) {
      const isOutgoing = relation.fromDeviceId === current.deviceId;
      const isIncoming = relation.toDeviceId === current.deviceId;
      if (!isOutgoing && !isIncoming) {
        continue;
      }
      const relatedDeviceId = isOutgoing ? relation.toDeviceId : relation.fromDeviceId;
      const direction = isOutgoing ? "outgoing" : "incoming";
      const directionLabel = isOutgoing ? relation.fromLabel ?? relation.tag : relation.toLabel ?? relation.tag;
      const existingTraversal = traversals.get(relation.id);
      const traversalDepth = current.currentDepth + 1;
      if (!existingTraversal || traversalDepth < existingTraversal.traversalDepth) {
        traversals.set(relation.id, {
          relation,
          traversalDepth,
          viaDeviceId: current.deviceId,
          direction,
          directionLabel
        });
      }
      if (!deviceDepths.has(relatedDeviceId)) {
        deviceDepths.set(relatedDeviceId, traversalDepth);
        queue.push({
          deviceId: relatedDeviceId,
          currentDepth: traversalDepth
        });
      }
    }
  }
  return {
    deviceDepths,
    traversals: [...traversals.values()].sort(
      (left, right) => left.traversalDepth - right.traversalDepth || left.relation.id - right.relation.id
    )
  };
}
function neighborhoodLines(data, startDeviceId, depth) {
  const startDevice = data.devices.find(
    (device) => device.id === startDeviceId
  );
  if (!startDevice) {
    throw new Error(`\u30C7\u30D0\u30A4\u30B9ID ${startDeviceId} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`);
  }
  const deviceById = new Map(data.devices.map((device) => [device.id, device]));
  const traversal = collectRelationTraversal(data, startDeviceId, depth);
  const deviceServices = data.services.filter((service) => {
    const membership = data.devices.flatMap((device) => device.memberships).find((item) => item.id === service.deviceNetworkId);
    return membership !== void 0 && traversal.deviceDepths.has(membership.deviceId);
  });
  const lines = [
    `device neighborhood: ${deviceLabel(startDevice)}`,
    `depth: ${depth}`,
    "devices:"
  ];
  for (const [deviceId, deviceDepth] of [...traversal.deviceDepths.entries()].sort((left, right) => left[1] - right[1] || left[0] - right[0])) {
    const device = deviceById.get(deviceId);
    if (device) {
      lines.push(`- depth=${deviceDepth}: ${deviceLabel(device)}`);
    }
  }
  lines.push("services:");
  if (deviceServices.length === 0) {
    lines.push("- (\u306A\u3057)");
  } else {
    for (const service of deviceServices) {
      lines.push(`- ${serviceLine(service)}`);
    }
  }
  lines.push("traversed relations:");
  if (traversal.traversals.length === 0) {
    lines.push("- (\u306A\u3057)");
  } else {
    for (const item of traversal.traversals) {
      const via = deviceById.get(item.viaDeviceId)?.hostname ?? String(item.viaDeviceId);
      lines.push(
        `- depth=${item.traversalDepth} from=${via} direction=${item.direction} label=${item.directionLabel} ` + relationLine(data, item.relation)
      );
    }
  }
  return lines;
}
function generateNetworkMapText(data, focus) {
  const lines = [
    `ouchi.local ledger: ${data.settings.title}`,
    `format-version: ${data.version}`,
    ...hierarchyLines(data),
    "relations:"
  ];
  if (data.relations.length === 0) {
    lines.push("- (\u306A\u3057)");
  } else {
    for (const relation of data.relations) {
      lines.push(`- ${relationLine(data, relation)}`);
    }
  }
  if (focus) {
    lines.push("", ...neighborhoodLines(data, focus.deviceId, focus.depth));
  }
  return lines.join("\n");
}
function generateDeviceNeighborhoodText(data, deviceId, depth) {
  return neighborhoodLines(data, deviceId, depth).join("\n");
}
function deviceRelationTags(relations, deviceId) {
  return [
    ...new Set(
      relations.filter(
        (relation) => relation.fromDeviceId === deviceId || relation.toDeviceId === deviceId
      ).map((relation) => relation.tag)
    )
  ];
}

// mcp/tools.ts
var readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
var createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
};
var updateAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
var deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false
};
function withAnnotations(title, annotations) {
  return { title, ...annotations };
}
function objectSchema(properties, required = []) {
  return {
    type: "object",
    properties,
    ...required.length > 0 ? { required } : {},
    additionalProperties: false
  };
}
var idSchema = {
  type: "integer",
  description: "REST API \u306E\u6B63\u306E\u6574\u6570ID"
};
var networkInputProperties = {
  name: { type: "string" },
  cidr: { type: ["string", "null"] },
  accent: { type: "string" },
  note: { type: ["string", "null"] }
};
var deviceInputProperties = {
  hostname: { type: "string" },
  petname: { type: ["string", "null"] },
  category: {
    type: "string",
    description: "network / physical / vm / service"
  },
  isVm: { type: "boolean" },
  sshUser: { type: ["string", "null"] },
  sshPort: { type: ["integer", "null"] },
  meterEnabled: { type: "boolean" },
  note: { type: ["string", "null"] }
};
var membershipInputProperties = {
  deviceId: idSchema,
  networkId: idSchema,
  ip: { type: ["string", "null"] },
  label: { type: ["string", "null"] }
};
var serviceInputProperties = {
  deviceNetworkId: idSchema,
  subdomain: { type: "string" },
  petname: { type: ["string", "null"] },
  description: { type: ["string", "null"] },
  port: { type: "integer" },
  protocol: { type: "string", description: "tcp / udp" },
  scheme: { type: "string", description: "http / https" },
  topPath: { type: ["string", "null"] },
  monitorPath: { type: ["string", "null"] },
  serviceUrl: { type: ["string", "null"] },
  iconKey: { type: ["string", "null"] },
  enabled: { type: "boolean" }
};
var relationInputProperties = {
  fromDeviceId: idSchema,
  toDeviceId: idSchema,
  tag: { type: "string" },
  fromLabel: { type: ["string", "null"] },
  toLabel: { type: ["string", "null"] },
  color: { type: "string" }
};
function collectionTool(resource, singular) {
  return {
    name: `list_${resource}`,
    title: `${singular}\u4E00\u89A7`,
    description: `REST API \u304B\u3089${singular}\u306E\u4E00\u89A7\u3092\u53D6\u5F97\u3057\u307E\u3059\u3002`,
    inputSchema: objectSchema({}),
    annotations: withAnnotations(`${singular}\u4E00\u89A7`, readAnnotations)
  };
}
function getTool(resource, singular) {
  return {
    name: `get_${resource}`,
    title: `${singular}\u53D6\u5F97`,
    description: `REST API \u306E\u4E00\u89A7\u304B\u3089 ID \u3067${singular}\u3092\u53D6\u5F97\u3057\u307E\u3059\u3002\u5B58\u5728\u3057\u306A\u3044\u5834\u5408\u306F REST \u306E 404 \u76F8\u5F53\u30A8\u30E9\u30FC\u3092\u8FD4\u3057\u307E\u3059\u3002`,
    inputSchema: objectSchema({ id: idSchema }, ["id"]),
    annotations: withAnnotations(`${singular}\u53D6\u5F97`, readAnnotations)
  };
}
function createTool(resource, singular, properties, required) {
  return {
    name: `create_${resource}`,
    title: `${singular}\u4F5C\u6210`,
    description: `REST API \u3078${singular}\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002\u691C\u8A3C\u306F REST \u3068\u5171\u6709\u3067\u3059\u3002`,
    inputSchema: objectSchema(properties, required),
    annotations: withAnnotations(`${singular}\u4F5C\u6210`, createAnnotations)
  };
}
function updateTool(resource, singular, properties, required) {
  return {
    name: `update_${resource}`,
    title: `${singular}\u66F4\u65B0`,
    description: `REST API \u306E PUT \u3067${singular}\u3092\u66F4\u65B0\u3057\u307E\u3059\u3002\u5B8C\u5168\u7F6E\u63DB\u306A\u306E\u3067\u65E2\u5B58\u5024\u3092\u542B\u3081\u3066\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002`,
    inputSchema: objectSchema({ id: idSchema, ...properties }, [
      "id",
      ...required
    ]),
    annotations: withAnnotations(`${singular}\u66F4\u65B0`, updateAnnotations)
  };
}
function deleteTool(resource, singular) {
  return {
    name: `delete_${resource}`,
    title: `${singular}\u524A\u9664`,
    description: `REST API \u304B\u3089${singular}\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u53C2\u7167\u4E2D\u30C7\u30FC\u30BF\u304C\u3042\u308B\u5834\u5408\u306E 409 \u3082 REST \u306E\u7D50\u679C\u3092\u305D\u306E\u307E\u307E\u8FD4\u3057\u307E\u3059\u3002`,
    inputSchema: objectSchema({ id: idSchema }, ["id"]),
    annotations: withAnnotations(`${singular}\u524A\u9664`, deleteAnnotations)
  };
}
var TOOL_DEFINITIONS = [
  {
    name: "get_network_map",
    title: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u5730\u56F3",
    description: "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u2192\u30C7\u30D0\u30A4\u30B9\u2192\u30B5\u30FC\u30D3\u30B9\u306E\u968E\u5C64\u3001\u65B9\u5411\u30E9\u30D9\u30EB\u30FB\u30BF\u30B0\u30FB\u8272\u3092\u542B\u3080\u95A2\u4FC2\u4E00\u89A7\u3092\u69CB\u9020\u5316\u30C6\u30AD\u30B9\u30C8\u3067\u8FD4\u3057\u307E\u3059\u3002deviceId \u3092\u6307\u5B9A\u3059\u308B\u3068\u3001\u305D\u306E\u30C7\u30D0\u30A4\u30B9\u304B\u3089 depth \u6BB5\u306E\u95A2\u4FC2\u30C8\u30E9\u30D0\u30FC\u30B9\u3068\u8FD1\u508D\u30D3\u30E5\u30FC\u3082\u542B\u3081\u307E\u3059\u3002",
    inputSchema: objectSchema({
      deviceId: idSchema,
      depth: {
        type: "integer",
        minimum: 0,
        default: 1,
        description: "\u8FD1\u508D\u30C8\u30E9\u30D0\u30FC\u30B9\u306E\u6DF1\u3055\u30020 \u306F\u8D77\u70B9\u306E\u307F\u3002"
      }
    }),
    annotations: withAnnotations("\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u5730\u56F3", readAnnotations)
  },
  {
    name: "get_device_neighborhood",
    title: "\u30C7\u30D0\u30A4\u30B9\u8FD1\u508D",
    description: "\u6307\u5B9A\u30C7\u30D0\u30A4\u30B9\u3092\u8D77\u70B9\u306B\u3001\u95A2\u4FC2\u3092\u53CC\u65B9\u5411\u3078 depth \u6BB5\u305F\u3069\u308A\u3001\u95A2\u9023\u30C7\u30D0\u30A4\u30B9\u30FB\u30B5\u30FC\u30D3\u30B9\u30FB\u95A2\u4FC2\u30E9\u30D9\u30EB\u30FB\u30BF\u30B0\u30FB\u8272\u3092\u8FD4\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema(
      {
        deviceId: idSchema,
        depth: { type: "integer", minimum: 0, default: 1 }
      },
      ["deviceId"]
    ),
    annotations: withAnnotations("\u30C7\u30D0\u30A4\u30B9\u8FD1\u508D", readAnnotations)
  },
  {
    name: "search_devices",
    title: "\u30C7\u30D0\u30A4\u30B9\u691C\u7D22",
    description: "\u30DB\u30B9\u30C8\u540D\u30FB\u30DA\u30C3\u30C8\u30CD\u30FC\u30E0\u30FB\u30AB\u30C6\u30B4\u30EA\u30FB\u30E1\u30E2\u30FBIP\u30FB\u6240\u5C5E\u30E9\u30D9\u30EB\u30FB\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u540D\u30FB\u95A2\u4FC2\u30BF\u30B0\u3092\u5BFE\u8C61\u306B\u30C7\u30D0\u30A4\u30B9\u3092\u691C\u7D22\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema(
      {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, default: 50 }
      },
      ["query"]
    ),
    annotations: withAnnotations("\u30C7\u30D0\u30A4\u30B9\u691C\u7D22", readAnnotations)
  },
  {
    name: "search_services",
    title: "\u30B5\u30FC\u30D3\u30B9\u691C\u7D22",
    description: "\u30B5\u30D6\u30C9\u30E1\u30A4\u30F3\u30FB\u30DA\u30C3\u30C8\u30CD\u30FC\u30E0\u30FB\u8AAC\u660E\u30FBURL\u30FB\u30A2\u30A4\u30B3\u30F3\u30FB\u6240\u6709\u30C7\u30D0\u30A4\u30B9\u30FB\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u30FB\u95A2\u4FC2\u30BF\u30B0\u3092\u5BFE\u8C61\u306B\u30B5\u30FC\u30D3\u30B9\u3092\u691C\u7D22\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema(
      {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, default: 50 }
      },
      ["query"]
    ),
    annotations: withAnnotations("\u30B5\u30FC\u30D3\u30B9\u691C\u7D22", readAnnotations)
  },
  {
    name: "resolve_service_url",
    title: "\u30B5\u30FC\u30D3\u30B9URL\u89E3\u6C7A",
    description: "REST API \u304C\u53F0\u5E33\u898F\u5247\u3067\u7D44\u307F\u7ACB\u3066\u305F\u5B8C\u5168\u306A\u30B5\u30FC\u30D3\u30B9URL\u3092\u8FD4\u3057\u307E\u3059\u3002monitor=true \u306E\u5834\u5408\u306F\u76E3\u8996URL\u3092\u8FD4\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema(
      {
        serviceId: idSchema,
        monitor: { type: "boolean", default: false }
      },
      ["serviceId"]
    ),
    annotations: withAnnotations("\u30B5\u30FC\u30D3\u30B9URL\u89E3\u6C7A", readAnnotations)
  },
  collectionTool("networks", "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF"),
  getTool("network", "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF"),
  createTool(
    "network",
    "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF",
    networkInputProperties,
    ["name", "accent"]
  ),
  updateTool(
    "network",
    "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF",
    networkInputProperties,
    ["name", "cidr", "accent", "note"]
  ),
  deleteTool("network", "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF"),
  collectionTool("devices", "\u30C7\u30D0\u30A4\u30B9"),
  getTool("device", "\u30C7\u30D0\u30A4\u30B9"),
  createTool(
    "device",
    "\u30C7\u30D0\u30A4\u30B9",
    deviceInputProperties,
    ["hostname", "category", "isVm", "meterEnabled"]
  ),
  updateTool(
    "device",
    "\u30C7\u30D0\u30A4\u30B9",
    deviceInputProperties,
    [
      "hostname",
      "petname",
      "category",
      "isVm",
      "sshUser",
      "sshPort",
      "meterEnabled",
      "note"
    ]
  ),
  deleteTool("device", "\u30C7\u30D0\u30A4\u30B9"),
  collectionTool("memberships", "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u6240\u5C5E"),
  getTool("membership", "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u6240\u5C5E"),
  createTool(
    "membership",
    "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u6240\u5C5E",
    membershipInputProperties,
    ["deviceId", "networkId"]
  ),
  updateTool(
    "membership",
    "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u6240\u5C5E",
    membershipInputProperties,
    ["deviceId", "networkId"]
  ),
  deleteTool("membership", "\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u6240\u5C5E"),
  collectionTool("services", "\u30B5\u30FC\u30D3\u30B9"),
  getTool("service", "\u30B5\u30FC\u30D3\u30B9"),
  createTool(
    "service",
    "\u30B5\u30FC\u30D3\u30B9",
    serviceInputProperties,
    [
      "deviceNetworkId",
      "subdomain",
      "port",
      "protocol",
      "scheme",
      "enabled"
    ]
  ),
  updateTool(
    "service",
    "\u30B5\u30FC\u30D3\u30B9",
    serviceInputProperties,
    [
      "deviceNetworkId",
      "subdomain",
      "petname",
      "description",
      "port",
      "protocol",
      "scheme",
      "topPath",
      "monitorPath",
      "serviceUrl",
      "iconKey",
      "enabled"
    ]
  ),
  deleteTool("service", "\u30B5\u30FC\u30D3\u30B9"),
  collectionTool("relations", "\u95A2\u4FC2"),
  getTool("relation", "\u95A2\u4FC2"),
  {
    name: "get_device_relations",
    title: "\u30C7\u30D0\u30A4\u30B9\u95A2\u4FC2\u30C8\u30E9\u30D0\u30FC\u30B9",
    description: "REST API \u306E\u95A2\u4FC2\u30C8\u30E9\u30D0\u30FC\u30B9\u3092\u4F7F\u3044\u3001\u6307\u5B9A\u30C7\u30D0\u30A4\u30B9\u306B\u76F4\u63A5\u3064\u306A\u304C\u308B\u65B9\u5411\u30FB\u30E9\u30D9\u30EB\u30FB\u30BF\u30B0\u30FB\u8272\u30FB\u95A2\u9023\u30C7\u30D0\u30A4\u30B9\u3092\u8FD4\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema(
      {
        deviceId: idSchema,
        depth: { type: "integer", minimum: 1, default: 1 }
      },
      ["deviceId"]
    ),
    annotations: withAnnotations(
      "\u30C7\u30D0\u30A4\u30B9\u95A2\u4FC2\u30C8\u30E9\u30D0\u30FC\u30B9",
      readAnnotations
    )
  },
  createTool(
    "relation",
    "\u95A2\u4FC2",
    relationInputProperties,
    ["fromDeviceId", "toDeviceId", "tag", "color"]
  ),
  updateTool(
    "relation",
    "\u95A2\u4FC2",
    relationInputProperties,
    [
      "fromDeviceId",
      "toDeviceId",
      "tag",
      "fromLabel",
      "toLabel",
      "color"
    ]
  ),
  deleteTool("relation", "\u95A2\u4FC2"),
  {
    name: "export_ledger_yaml",
    title: "YAML\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8",
    description: "REST API \u304B\u3089\u53F0\u5E33\u5168\u4F53\u306E ouchi-ledger/1 YAML \u3092\u53D6\u5F97\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema({}),
    annotations: withAnnotations("YAML\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8", readAnnotations)
  },
  {
    name: "import_ledger_yaml",
    title: "YAML\u30A4\u30F3\u30DD\u30FC\u30C8",
    description: "REST API \u306E\u7F6E\u304D\u63DB\u3048\u578B\u30A4\u30F3\u30DD\u30FC\u30C8\u3078 YAML \u3092\u9001\u308A\u307E\u3059\u3002\u5168\u4EF6\u306E\u5F62\u5F0F\u30FB\u53C2\u7167\u30FB\u81EA\u7136\u30AD\u30FC\u30FB\u30BF\u30B0\u8272\u3092 REST \u5074\u3067\u691C\u8A3C\u3057\u307E\u3059\u3002",
    inputSchema: objectSchema({ yaml: { type: "string" } }, ["yaml"]),
    annotations: withAnnotations("YAML\u30A4\u30F3\u30DD\u30FC\u30C8", {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    })
  }
];
function jsonResult(value, structuredContent) {
  return {
    text: JSON.stringify(value, null, 2),
    structuredContent: structuredContent ?? { result: value }
  };
}
function numberArgument(args, key) {
  return args[key];
}
function stringArgument(args, key) {
  return args[key];
}
function booleanArgument(args, key, fallback) {
  return typeof args[key] === "boolean" ? args[key] : fallback;
}
function normalizedLimit(args) {
  const value = args.limit;
  return typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1), 500) : 50;
}
function normalizedDepth(args, minimum, fallback) {
  const value = args.depth;
  return typeof value === "number" && Number.isInteger(value) && value >= minimum ? value : fallback;
}
function queryText(args) {
  const query = args.query;
  return typeof query === "string" ? query.trim().toLowerCase() : "";
}
function missingEntity(kind, id) {
  return new RestApiError(
    `/api/${kind}/${id}`,
    404,
    { error: `${kind} ID ${id} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093` }
  );
}
function membershipContext(data) {
  return {
    membershipById: new Map(
      data.devices.flatMap(
        (device) => device.memberships.map((membership) => [membership.id, membership])
      )
    ),
    deviceById: new Map(data.devices.map((device) => [device.id, device])),
    networkNameById: new Map(
      data.networks.map((network) => [network.id, network.name])
    )
  };
}
function searchDeviceResults(data, query, limit) {
  const { networkNameById } = membershipContext(data);
  return data.devices.map((device) => {
    const tags = deviceRelationTags(data.relations, device.id);
    const searchable = [
      device.hostname,
      device.petname ?? "",
      device.category,
      device.note ?? "",
      ...device.memberships.flatMap((membership) => [
        membership.ip ?? "",
        membership.label ?? "",
        networkNameById.get(membership.networkId) ?? ""
      ]),
      ...tags
    ].join("\n").toLowerCase();
    return {
      device,
      tags,
      matches: query === "" || searchable.includes(query)
    };
  }).filter((item) => item.matches).slice(0, limit).map(({ device, tags }) => ({
    ...device,
    networkMemberships: device.memberships.map((membership) => ({
      ...membership,
      networkName: networkNameById.get(membership.networkId) ?? String(membership.networkId)
    })),
    relationTags: tags
  }));
}
function serviceOwner(service, data) {
  const context = membershipContext(data);
  const membership = context.membershipById.get(service.deviceNetworkId);
  const device = membership ? context.deviceById.get(membership.deviceId) : void 0;
  return {
    membership,
    device,
    networkName: membership ? context.networkNameById.get(membership.networkId) : void 0
  };
}
function searchServiceResults(data, query, limit) {
  return data.services.map((service) => {
    const owner = serviceOwner(service, data);
    const tags = owner.device ? deviceRelationTags(data.relations, owner.device.id) : [];
    const searchable = [
      service.subdomain,
      service.petname ?? "",
      service.description ?? "",
      service.url ?? "",
      service.monitorUrl ?? "",
      service.iconKey ?? "",
      owner.device?.hostname ?? "",
      owner.device?.petname ?? "",
      owner.networkName ?? "",
      owner.membership?.label ?? "",
      ...tags
    ].join("\n").toLowerCase();
    return {
      service,
      owner,
      tags,
      matches: query === "" || searchable.includes(query)
    };
  }).filter((item) => item.matches).slice(0, limit).map(({ service, owner, tags }) => ({
    ...service,
    device: owner.device ? {
      id: owner.device.id,
      hostname: owner.device.hostname,
      petname: owner.device.petname,
      category: owner.device.category
    } : null,
    membership: owner.membership ?? null,
    networkName: owner.networkName ?? null,
    relationTags: tags
  }));
}
function networkBody(args) {
  return {
    name: stringArgument(args, "name"),
    cidr: args.cidr,
    accent: stringArgument(args, "accent"),
    note: args.note
  };
}
function deviceBody(args) {
  return {
    hostname: stringArgument(args, "hostname"),
    petname: args.petname,
    category: args.category,
    isVm: args.isVm,
    sshUser: args.sshUser,
    sshPort: args.sshPort,
    meterEnabled: args.meterEnabled,
    note: args.note
  };
}
function membershipBody(args) {
  return {
    deviceId: numberArgument(args, "deviceId"),
    networkId: numberArgument(args, "networkId"),
    ip: args.ip,
    label: args.label
  };
}
function serviceBody(args) {
  return {
    deviceNetworkId: numberArgument(args, "deviceNetworkId"),
    subdomain: stringArgument(args, "subdomain"),
    petname: args.petname,
    description: args.description,
    port: numberArgument(args, "port"),
    protocol: args.protocol,
    scheme: args.scheme,
    topPath: args.topPath,
    monitorPath: args.monitorPath,
    serviceUrl: args.serviceUrl,
    iconKey: args.iconKey,
    enabled: args.enabled
  };
}
function relationBody(args) {
  return {
    fromDeviceId: numberArgument(args, "fromDeviceId"),
    toDeviceId: numberArgument(args, "toDeviceId"),
    tag: stringArgument(args, "tag"),
    fromLabel: args.fromLabel,
    toLabel: args.toLabel,
    color: stringArgument(args, "color")
  };
}
async function callTool(name, args, client2) {
  switch (name) {
    case "get_network_map": {
      const data = await client2.getPortalData();
      const focus = typeof args.deviceId === "number" ? {
        deviceId: args.deviceId,
        depth: normalizedDepth(args, 0, 1)
      } : void 0;
      return {
        text: generateNetworkMapText(data, focus),
        structuredContent: {
          focusDeviceId: focus?.deviceId ?? null,
          depth: focus?.depth ?? null,
          networks: data.networks.length,
          devices: data.devices.length,
          services: data.services.length,
          relations: data.relations.length
        }
      };
    }
    case "get_device_neighborhood": {
      const data = await client2.getPortalData();
      const deviceId = numberArgument(args, "deviceId");
      if (!data.devices.some((device) => device.id === deviceId)) {
        throw missingEntity("devices", deviceId);
      }
      const depth = normalizedDepth(args, 0, 1);
      return {
        text: generateDeviceNeighborhoodText(data, deviceId, depth),
        structuredContent: { deviceId, depth }
      };
    }
    case "search_devices": {
      const data = await client2.getPortalData();
      const results = searchDeviceResults(
        data,
        queryText(args),
        normalizedLimit(args)
      );
      return jsonResult(
        { count: results.length, devices: results },
        { count: results.length, devices: results }
      );
    }
    case "search_services": {
      const data = await client2.getPortalData();
      const results = searchServiceResults(
        data,
        queryText(args),
        normalizedLimit(args)
      );
      return jsonResult(
        { count: results.length, services: results },
        { count: results.length, services: results }
      );
    }
    case "resolve_service_url": {
      const serviceId = numberArgument(args, "serviceId");
      const service = await client2.getService(serviceId);
      if (!service) {
        throw missingEntity("services", serviceId);
      }
      const monitor = booleanArgument(args, "monitor", false);
      const url = monitor ? service.monitorUrl : service.url;
      const result = {
        serviceId,
        subdomain: service.subdomain,
        kind: monitor ? "monitor" : "service",
        url
      };
      return jsonResult(result, result);
    }
    case "list_networks":
      return jsonResult(await client2.listNetworks());
    case "get_network": {
      const id = numberArgument(args, "id");
      const network = await client2.getNetwork(id);
      if (!network) {
        throw missingEntity("networks", id);
      }
      return jsonResult(network);
    }
    case "create_network":
      return jsonResult(await client2.createNetwork(networkBody(args)));
    case "update_network": {
      const id = numberArgument(args, "id");
      return jsonResult(await client2.updateNetwork(id, networkBody(args)));
    }
    case "delete_network":
      return jsonResult(await client2.deleteNetwork(numberArgument(args, "id")));
    case "list_devices":
      return jsonResult(await client2.listDevices());
    case "get_device": {
      const id = numberArgument(args, "id");
      const device = await client2.getDevice(id);
      if (!device) {
        throw missingEntity("devices", id);
      }
      return jsonResult(device);
    }
    case "create_device":
      return jsonResult(await client2.createDevice(deviceBody(args)));
    case "update_device": {
      const id = numberArgument(args, "id");
      return jsonResult(await client2.updateDevice(id, deviceBody(args)));
    }
    case "delete_device":
      return jsonResult(await client2.deleteDevice(numberArgument(args, "id")));
    case "list_memberships":
      return jsonResult(await client2.listMemberships());
    case "get_membership": {
      const id = numberArgument(args, "id");
      const membership = await client2.getMembership(id);
      if (!membership) {
        throw missingEntity("memberships", id);
      }
      return jsonResult(membership);
    }
    case "create_membership":
      return jsonResult(await client2.createMembership(membershipBody(args)));
    case "update_membership": {
      const id = numberArgument(args, "id");
      return jsonResult(
        await client2.updateMembership(id, membershipBody(args))
      );
    }
    case "delete_membership":
      return jsonResult(
        await client2.deleteMembership(numberArgument(args, "id"))
      );
    case "list_services":
      return jsonResult(await client2.listServices());
    case "get_service": {
      const id = numberArgument(args, "id");
      const service = await client2.getService(id);
      if (!service) {
        throw missingEntity("services", id);
      }
      return jsonResult(service);
    }
    case "create_service":
      return jsonResult(await client2.createService(serviceBody(args)));
    case "update_service": {
      const id = numberArgument(args, "id");
      return jsonResult(await client2.updateService(id, serviceBody(args)));
    }
    case "delete_service":
      return jsonResult(await client2.deleteService(numberArgument(args, "id")));
    case "list_relations":
      return jsonResult(await client2.listRelations());
    case "get_relation": {
      const id = numberArgument(args, "id");
      const relation = await client2.getRelation(id);
      if (!relation) {
        throw missingEntity("relations", id);
      }
      return jsonResult(relation);
    }
    case "get_device_relations": {
      const deviceId = numberArgument(args, "deviceId");
      const depth = normalizedDepth(args, 1, 1);
      return jsonResult(
        await client2.traverseDeviceRelations(deviceId, depth)
      );
    }
    case "create_relation":
      return jsonResult(await client2.createRelation(relationBody(args)));
    case "update_relation": {
      const id = numberArgument(args, "id");
      return jsonResult(await client2.updateRelation(id, relationBody(args)));
    }
    case "delete_relation":
      return jsonResult(await client2.deleteRelation(numberArgument(args, "id")));
    case "export_ledger_yaml": {
      const yaml = await client2.exportYaml();
      return {
        text: yaml,
        structuredContent: { yaml }
      };
    }
    case "import_ledger_yaml": {
      const result = await client2.importYaml(stringArgument(args, "yaml"));
      return jsonResult(result, result);
    }
    default:
      throw new Error(`\u672A\u77E5\u306EMCP\u30C4\u30FC\u30EB\u3067\u3059: ${name}`);
  }
}

// mcp/protocol.ts
var MCP_SERVER_NAME = "ouchi-ledger-mcp";
var MCP_SERVER_VERSION = "1.0.0";
var MCP_INSTRUCTIONS = "ouchi.local \u306E\u53F0\u5E33 REST API \u3092\u8AAD\u307F\u66F8\u304D\u3059\u308B LAN \u7528 MCP \u30B5\u30FC\u30D0\u30FC\u3067\u3059\u3002\u8A8D\u8A3C\u306F\u3042\u308A\u307E\u305B\u3093\u3002WAN \u3078\u516C\u958B\u305B\u305A\u3001LAN \u5185\u304B\u3089\u306E\u307F\u5229\u7528\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u66F8\u304D\u8FBC\u307F\u306F REST API \u3068\u540C\u3058\u691C\u8A3C\u3092\u901A\u308A\u3001\u62D2\u5426\u6642\u306F issues \u3092\u305D\u306E\u307E\u307E\u8FD4\u3057\u307E\u3059\u3002";
function errorResult(error) {
  if (error instanceof RestApiError) {
    const details = {
      status: error.status,
      path: error.path,
      body: error.body
    };
    return {
      content: [
        {
          type: "text",
          text: `REST API ${error.status} (${error.path})
` + JSON.stringify(error.body, null, 2)
        }
      ],
      structuredContent: { error: details },
      isError: true
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: message }],
    structuredContent: { error: { message } },
    isError: true
  };
}
function createMcpServer(client2) {
  const server2 = new Server(
    {
      name: MCP_SERVER_NAME,
      title: "ouchi.local AI\u7528\u30CD\u30C3\u30C8\u30EF\u30FC\u30AF\u5730\u56F3",
      version: MCP_SERVER_VERSION
    },
    {
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      instructions: MCP_INSTRUCTIONS
    }
  );
  server2.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS
  }));
  server2.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await callTool(
        request.params.name,
        request.params.arguments ?? {},
        client2
      );
      return {
        content: [{ type: "text", text: result.text }],
        ...result.structuredContent ? { structuredContent: result.structuredContent } : {},
        isError: result.isError === true
      };
    } catch (error) {
      return errorResult(error);
    }
  });
  return server2;
}
function methodNotAllowed() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32e3,
        message: "\u3053\u306E\u30B5\u30FC\u30D0\u30FC\u306F\u30B9\u30C6\u30FC\u30C8\u30EC\u30B9 Streamable HTTP POST \u306E\u307F\u5BFE\u5FDC\u3057\u307E\u3059"
      }
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST"
      }
    }
  );
}
function createMcpApp(client2) {
  const app2 = new Hono();
  app2.get(
    "/health",
    (context) => context.json({
      ok: true,
      service: MCP_SERVER_NAME,
      transport: "streamable-http",
      authentication: "none-lan-only",
      restApi: client2.baseUrl,
      sdk: "@modelcontextprotocol/sdk"
    })
  );
  app2.post("/mcp", async (context) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: void 0,
      enableJsonResponse: true
    });
    const server2 = createMcpServer(client2);
    await server2.connect(transport);
    try {
      return await transport.handleRequest(context.req.raw);
    } finally {
      await server2.close();
    }
  });
  app2.get("/mcp", methodNotAllowed);
  app2.delete("/mcp", methodNotAllowed);
  app2.notFound(
    (context) => context.json({ error: "MCP\u30A8\u30F3\u30C9\u30DD\u30A4\u30F3\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093" }, 404)
  );
  return app2;
}

// mcp/index.ts
var port = Number(process.env.MCP_PORT ?? 3333);
var hostname = process.env.MCP_HOST ?? "0.0.0.0";
var restApiUrl = process.env.OUCHI_REST_URL?.trim() || "http://127.0.0.1:3000";
var client = new LedgerRestClient(restApiUrl);
var app = createMcpApp(client);
var server = serve(
  {
    fetch: app.fetch,
    hostname,
    port
  },
  (info) => {
    console.log(
      `${MCP_SERVER_NAME} listening on http://${hostname}:${info.port}/mcp`
    );
    console.log(`REST API upstream: ${restApiUrl}`);
    console.log(
      "WARNING: authentication is disabled. Keep this endpoint on the LAN; never expose it to the WAN."
    );
  }
);
function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
