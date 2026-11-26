import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiService,
  PortalDeviceInput,
  PortalInterfaceInput,
  PortalNetworkInput,
  PortalRelationInput,
  PortalRelationNameInput,
  PortalServiceInput,
  PortalSettingsInput,
} from "../src/portal/types";
import {
  deviceRelationTags,
  generateDeviceNeighborhoodText,
  generateNetworkMapText,
} from "./mapText";
import { LedgerRestClient, RestApiError } from "./restClient";

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
}

export interface McpToolResult {
  text: string;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

type ToolArguments = Record<string, unknown>;

const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

const updateAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const deleteAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

function withAnnotations(
  title: string,
  annotations: Omit<McpToolDefinition["annotations"], "title">,
): McpToolDefinition["annotations"] {
  return { title, ...annotations };
}

function objectSchema(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

const idSchema = {
  type: "integer",
  description: "REST API の正の整数ID",
};

const nullableStringSchema = {
  type: ["string", "null"],
};

const propertiesSchema = {
  type: "object",
  additionalProperties: { type: "string" },
  description:
    "任意の文字列プロパティ。更新時に指定すると全量置換し、省略すると既存値を保持します。",
};

const networkInputProperties = {
  name: { type: "string" },
  cidr: { type: ["string", "null"] },
  accent: { type: "string" },
  note: { type: ["string", "null"] },
  properties: propertiesSchema,
};

const deviceInputProperties = {
  hostname: { type: "string" },
  petname: { type: ["string", "null"] },
  category: {
    type: "string",
    description: "network / physical / vm / service",
  },
  sshUser: { type: ["string", "null"] },
  sshPort: { type: ["integer", "null"] },
  meterEnabled: { type: "boolean" },
  note: { type: ["string", "null"] },
  properties: propertiesSchema,
};

const interfaceInputProperties = {
  deviceId: idSchema,
  name: { type: "string" },
  networkId: { type: ["integer", "null"] },
  ip: { type: ["string", "null"] },
  mac: { type: ["string", "null"] },
};

const serviceInputProperties = {
  interfaceId: idSchema,
  subdomain: { type: "string" },
  petname: { type: ["string", "null"] },
  description: { type: ["string", "null"] },
  port: { type: "integer" },
  protocol: { type: "string", description: "tcp / udp" },
  scheme: { type: "string", description: "http / https / none（リンクなし）" },
  topPath: { type: ["string", "null"] },
  monitorPath: { type: ["string", "null"] },
  serviceUrl: { type: ["string", "null"] },
  iconKey: { type: ["string", "null"] },
  properties: propertiesSchema,
  enabled: { type: "boolean" },
};

const relationInputProperties = {
  fromInterfaceId: { type: ["integer", "null"] },
  toInterfaceId: { type: ["integer", "null"] },
  fromServiceId: { type: ["integer", "null"] },
  toServiceId: { type: ["integer", "null"] },
  relationName: { type: "string" },
  fromLabel: { type: "string" },
  toLabel: { type: "string" },
  port: {
    type: ["integer", "null"],
    description: "宛先ポート 1-65535（protocolとセット）",
  },
  protocol: {
    type: ["string", "null"],
    description: "tcp / udp（portとセット）",
  },
  properties: propertiesSchema,
};

const relationNameInputProperties = {
  name: { type: "string" },
  color: { type: "string" },
  lineStart: {
    type: "string",
    description: "始点の形: none / arrow / circle / square / diamond",
  },
  lineEnd: {
    type: "string",
    description: "終点の形: none / arrow / circle / square / diamond",
  },
};

function collectionTool(
  resource:
    | "networks"
    | "devices"
    | "interfaces"
    | "services"
    | "relation_names"
    | "relations",
  singular: string,
): McpToolDefinition {
  return {
    name: `list_${resource}`,
    title: `${singular}一覧`,
    description: `REST API から${singular}の一覧を取得します。`,
    inputSchema: objectSchema({}),
    annotations: withAnnotations(`${singular}一覧`, readAnnotations),
  };
}

function getTool(
  resource: string,
  singular: string,
): McpToolDefinition {
  return {
    name: `get_${resource}`,
    title: `${singular}取得`,
    description:
      `REST API の一覧から ID で${singular}を取得します。` +
      "存在しない場合は REST の 404 相当エラーを返します。",
    inputSchema: objectSchema({ id: idSchema }, ["id"]),
    annotations: withAnnotations(`${singular}取得`, readAnnotations),
  };
}

function createTool(
  resource: string,
  singular: string,
  properties: Record<string, unknown>,
  required: string[],
): McpToolDefinition {
  return {
    name: `create_${resource}`,
    title: `${singular}作成`,
    description: `REST API へ${singular}を作成します。検証は REST と共有です。`,
    inputSchema: objectSchema(properties, required),
    annotations: withAnnotations(`${singular}作成`, createAnnotations),
  };
}

function updateTool(
  resource: string,
  singular: string,
  properties: Record<string, unknown>,
  required: string[],
): McpToolDefinition {
  return {
    name: `update_${resource}`,
    title: `${singular}更新`,
    description:
      `REST API の PUT で${singular}を更新します。` +
      "通常項目は完全置換ですが、properties は省略すると既存値を保持します。",
    inputSchema: objectSchema({ id: idSchema, ...properties }, [
      "id",
      ...required,
    ]),
    annotations: withAnnotations(`${singular}更新`, updateAnnotations),
  };
}

function deleteTool(
  resource: string,
  singular: string,
  description?: string,
): McpToolDefinition {
  return {
    name: `delete_${resource}`,
    title: `${singular}削除`,
    description:
      description ??
      (`REST API から${singular}を削除します。` +
        "参照中データがある場合の 409 も REST の結果をそのまま返します。"),
    inputSchema: objectSchema({ id: idSchema }, ["id"]),
    annotations: withAnnotations(`${singular}削除`, deleteAnnotations),
  };
}

export const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "get_network_map",
    title: "ネットワーク地図",
    description:
      "ネットワーク→デバイス→サービスの階層、置換済み方向ラベル・" +
      "関係名・色を含む" +
      "関係一覧を構造化テキストで返します。deviceId を指定すると、その" +
      "デバイスから depth 段の関係トラバースと近傍ビューも含めます。",
    inputSchema: objectSchema({
      deviceId: idSchema,
      depth: {
        type: "integer",
        minimum: 0,
        default: 1,
        description: "近傍トラバースの深さ。0 は起点のみ。",
      },
    }),
    annotations: withAnnotations("ネットワーク地図", readAnnotations),
  },
  {
    name: "get_device_neighborhood",
    title: "デバイス近傍",
    description:
      "指定デバイスを起点に、関係を双方向へ depth 段たどり、" +
      "関連デバイス・サービス・置換済み関係ラベル・関係名・色を返します。",
    inputSchema: objectSchema(
      {
        deviceId: idSchema,
        depth: { type: "integer", minimum: 0, default: 1 },
      },
      ["deviceId"],
    ),
    annotations: withAnnotations("デバイス近傍", readAnnotations),
  },
  {
    name: "search_devices",
    title: "デバイス検索",
    description:
      "ホスト名・ペットネーム・カテゴリ・メモ・IP・所属ラベル・" +
      "ネットワーク名・関係タグ・プロパティのキーと値を対象に" +
      "デバイスを検索します。",
    inputSchema: objectSchema(
      {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, default: 50 },
      },
      ["query"],
    ),
    annotations: withAnnotations("デバイス検索", readAnnotations),
  },
  {
    name: "search_services",
    title: "サービス検索",
    description:
      "サブドメイン・ペットネーム・説明・URL・アイコン・所有デバイス・" +
      "ネットワーク・関係タグ・プロパティのキーと値を対象に" +
      "サービスを検索します。",
    inputSchema: objectSchema(
      {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, default: 50 },
      },
      ["query"],
    ),
    annotations: withAnnotations("サービス検索", readAnnotations),
  },
  {
    name: "resolve_service_url",
    title: "サービスURL解決",
    description:
      "REST API が台帳規則で組み立てた完全なサービスURLを返します。" +
      "monitor=true の場合は監視URLを返します。",
    inputSchema: objectSchema(
      {
        serviceId: idSchema,
        monitor: { type: "boolean", default: false },
      },
      ["serviceId"],
    ),
    annotations: withAnnotations("サービスURL解決", readAnnotations),
  },
  {
    name: "update_settings",
    title: "ouchi設定更新",
    description:
      "ouchi（この台帳インスタンス）自体の設定を更新します。" +
      "title は省略すると現在の値を保持し、properties（ouchiのメモ）は" +
      "指定すると全量置換、省略すると既存値を保持します。",
    inputSchema: objectSchema({
      title: { type: "string" },
      properties: propertiesSchema,
    }),
    annotations: withAnnotations("ouchi設定更新", updateAnnotations),
  },
  {
    name: "reorder_networks",
    title: "ネットワーク並び替え",
    description:
      "ネットワークの表示順を、ID の配列で指定した順に並び替えます。" +
      "全ネットワークの ID をちょうど一度ずつ含めてください。",
    inputSchema: objectSchema(
      {
        ids: {
          type: "array",
          items: { type: "integer" },
          description: "表示順に並べたネットワークIDの配列。",
        },
      },
      ["ids"],
    ),
    annotations: withAnnotations("ネットワーク並び替え", updateAnnotations),
  },
  collectionTool("networks", "ネットワーク"),
  getTool("network", "ネットワーク"),
  createTool(
    "network",
    "ネットワーク",
    networkInputProperties,
    ["name", "accent"],
  ),
  updateTool(
    "network",
    "ネットワーク",
    networkInputProperties,
    ["name", "cidr", "accent", "note"],
  ),
  deleteTool("network", "ネットワーク"),
  collectionTool("devices", "デバイス"),
  getTool("device", "デバイス"),
  createTool(
    "device",
    "デバイス",
    deviceInputProperties,
    ["hostname", "category", "meterEnabled"],
  ),
  updateTool(
    "device",
    "デバイス",
    deviceInputProperties,
    [
      "hostname",
      "petname",
      "category",
      "sshUser",
      "sshPort",
      "meterEnabled",
      "note",
    ],
  ),
  deleteTool(
    "device",
    "デバイス",
    "REST API からデバイスを削除します。デバイスを端点とする関係、" +
      "デバイスに属するサービスとインターフェースも同一トランザクションで" +
      "一緒に削除されます。",
  ),
  collectionTool("interfaces", "インターフェース"),
  getTool("interface", "インターフェース"),
  createTool(
    "interface",
    "インターフェース",
    interfaceInputProperties,
    ["deviceId", "name"],
  ),
  updateTool(
    "interface",
    "インターフェース",
    interfaceInputProperties,
    ["deviceId", "name"],
  ),
  deleteTool("interface", "インターフェース"),
  collectionTool("services", "サービス"),
  getTool("service", "サービス"),
  createTool(
    "service",
    "サービス",
    serviceInputProperties,
    [
      "interfaceId",
      "subdomain",
      "port",
      "protocol",
      "scheme",
      "enabled",
    ],
  ),
  updateTool(
    "service",
    "サービス",
    serviceInputProperties,
    [
      "interfaceId",
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
      "enabled",
    ],
  ),
  deleteTool("service", "サービス"),
  collectionTool("relation_names", "関係名"),
  getTool("relation_name", "関係名"),
  createTool(
    "relation_name",
    "関係名",
    relationNameInputProperties,
    ["name", "color"],
  ),
  updateTool(
    "relation_name",
    "関係名",
    relationNameInputProperties,
    ["name", "color"],
  ),
  deleteTool("relation_name", "関係名"),
  collectionTool("relations", "関係"),
  getTool("relation", "関係"),
  {
    name: "get_device_relations",
    title: "デバイス関係トラバース",
    description:
      "REST API の関係トラバースを使い、指定デバイスに直接つながる" +
      "関係名・方向ラベル・色・関連デバイスを返します。",
    inputSchema: objectSchema(
      {
        deviceId: idSchema,
        depth: { type: "integer", minimum: 1, default: 1 },
      },
      ["deviceId"],
    ),
    annotations: withAnnotations(
      "デバイス関係トラバース",
      readAnnotations,
    ),
  },
  createTool(
    "relation",
    "関係",
    relationInputProperties,
    ["relationName"],
  ),
  updateTool(
    "relation",
    "関係",
    relationInputProperties,
    ["relationName"],
  ),
  deleteTool("relation", "関係"),
  {
    name: "export_ledger_yaml",
    title: "YAMLエクスポート",
    description:
      "REST API から台帳全体の ouchi-ledger/3 YAML を取得します。",
    inputSchema: objectSchema({}),
    annotations: withAnnotations("YAMLエクスポート", readAnnotations),
  },
  {
    name: "import_ledger_yaml",
    title: "YAMLインポート",
    description:
      "REST API の置き換え型インポートへ YAML を送ります。" +
      "全件の形式・参照・自然キー・関係名を REST 側で検証します。",
    inputSchema: objectSchema({ yaml: { type: "string" } }, ["yaml"]),
    annotations: withAnnotations("YAMLインポート", {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    }),
  },
];

function jsonResult(
  value: unknown,
  structuredContent?: Record<string, unknown>,
): McpToolResult {
  return {
    text: JSON.stringify(value, null, 2),
    structuredContent: structuredContent ?? { result: value },
  };
}

function numberArgument(args: ToolArguments, key: string): number {
  return args[key] as number;
}

function stringArgument(args: ToolArguments, key: string): string {
  return args[key] as string;
}

function booleanArgument(
  args: ToolArguments,
  key: string,
  fallback: boolean,
): boolean {
  return typeof args[key] === "boolean" ? args[key] : fallback;
}

function normalizedLimit(args: ToolArguments): number {
  const value = args.limit;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.floor(value), 1), 500)
    : 50;
}

function normalizedDepth(
  args: ToolArguments,
  minimum: 0 | 1,
  fallback: number,
): number {
  const value = args.depth;
  return typeof value === "number" && Number.isInteger(value) && value >= minimum
    ? value
    : fallback;
}

function queryText(args: ToolArguments): string {
  const query = args.query;
  return typeof query === "string" ? query.trim().toLowerCase() : "";
}

function missingEntity(
  kind: string,
  id: number,
): RestApiError {
  return new RestApiError(
    `/api/${kind}/${id}`,
    404,
    { error: `${kind} ID ${id} が見つかりません` },
  );
}

function interfaceContext(data: PortalApiData): {
  interfaceById: Map<
    number,
    PortalApiData["devices"][number]["interfaces"][number]
  >;
  deviceById: Map<number, PortalApiDevice>;
  networkNameById: Map<number, string>;
} {
  return {
    interfaceById: new Map(
      data.devices.flatMap((device) =>
        device.interfaces.map((iface) => [iface.id, iface]),
      ),
    ),
    deviceById: new Map(data.devices.map((device) => [device.id, device])),
    networkNameById: new Map(
      data.networks.map((network) => [network.id, network.name]),
    ),
  };
}

function searchDeviceResults(
  data: PortalApiData,
  query: string,
  limit: number,
): Array<Record<string, unknown>> {
  const { networkNameById } = interfaceContext(data);
  return data.devices
    .map((device) => {
      const tags = deviceRelationTags(data.relations, device.id);
      const searchable = [
        device.hostname,
        device.petname ?? "",
        device.category,
        device.note ?? "",
        ...device.interfaces.flatMap((iface) => [
          iface.name,
          iface.ip ?? "",
          iface.mac ?? "",
          (iface.networkId !== null
            ? networkNameById.get(iface.networkId)
            : undefined) ?? "",
        ]),
        ...Object.entries(device.properties ?? {}).flat(),
        ...tags,
      ]
        .join("\n")
        .toLowerCase();
      return {
        device,
        tags,
        matches: query === "" || searchable.includes(query),
      };
    })
    .filter((item) => item.matches)
    .slice(0, limit)
    .map(({ device, tags }) => ({
      ...device,
      networkInterfaces: device.interfaces.map((iface) => ({
        ...iface,
        networkName:
          iface.networkId !== null
            ? (networkNameById.get(iface.networkId) ??
              String(iface.networkId))
            : null,
      })),
      relationTags: tags,
      relationNames: tags,
    }));
}

function serviceOwner(
  service: PortalApiService,
  data: PortalApiData,
): {
  interface?: PortalApiData["devices"][number]["interfaces"][number];
  device?: PortalApiDevice;
  networkName?: string;
} {
  const context = interfaceContext(data);
  const iface = context.interfaceById.get(service.interfaceId);
  const device = iface
    ? context.deviceById.get(iface.deviceId)
    : undefined;
  return {
    interface: iface,
    device,
    networkName:
      iface && iface.networkId !== null
        ? context.networkNameById.get(iface.networkId)
        : undefined,
  };
}

function searchServiceResults(
  data: PortalApiData,
  query: string,
  limit: number,
): Array<Record<string, unknown>> {
  return data.services
    .map((service) => {
      const owner = serviceOwner(service, data);
      const tags = owner.device
        ? deviceRelationTags(data.relations, owner.device.id)
        : [];
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
        ...Object.entries(service.properties ?? {}).flat(),
        ...tags,
      ]
        .join("\n")
        .toLowerCase();
      return {
        service,
        owner,
        tags,
        matches: query === "" || searchable.includes(query),
      };
    })
    .filter((item) => item.matches)
    .slice(0, limit)
    .map(({ service, owner, tags }) => ({
      ...service,
      device: owner.device
        ? {
            id: owner.device.id,
            hostname: owner.device.hostname,
            petname: owner.device.petname,
            category: owner.device.category,
          }
        : null,
      interface: owner.interface ?? null,
      networkName: owner.networkName ?? null,
      relationTags: tags,
      relationNames: tags,
    }));
}

function networkBody(args: ToolArguments): PortalNetworkInput {
  return {
    name: stringArgument(args, "name"),
    cidr: args.cidr as string | null | undefined,
    accent: stringArgument(args, "accent"),
    note: args.note as string | null | undefined,
    ...(Object.hasOwn(args, "properties")
      ? {
          properties:
            args.properties as PortalNetworkInput["properties"],
        }
      : {}),
  };
}

function deviceBody(args: ToolArguments): PortalDeviceInput {
  return {
    hostname: stringArgument(args, "hostname"),
    petname: args.petname as string | null | undefined,
    category:
      args.category as PortalDeviceInput["category"],
    sshUser: args.sshUser as string | null | undefined,
    sshPort: args.sshPort as number | null | undefined,
    meterEnabled: args.meterEnabled as boolean,
    note: args.note as string | null | undefined,
    ...(Object.hasOwn(args, "properties")
      ? {
          properties:
            args.properties as PortalDeviceInput["properties"],
        }
      : {}),
  };
}

function interfaceBody(args: ToolArguments): PortalInterfaceInput {
  return {
    deviceId: numberArgument(args, "deviceId"),
    name: stringArgument(args, "name"),
    networkId:
      typeof args.networkId === "number" ? args.networkId : null,
    ip: args.ip as string | null | undefined,
    mac: args.mac as string | null | undefined,
  };
}

function serviceBody(args: ToolArguments): PortalServiceInput {
  return {
    interfaceId: numberArgument(args, "interfaceId"),
    subdomain: stringArgument(args, "subdomain"),
    petname: args.petname as string | null | undefined,
    description: args.description as string | null | undefined,
    port: numberArgument(args, "port"),
    protocol: args.protocol as PortalServiceInput["protocol"],
    scheme: args.scheme as PortalServiceInput["scheme"],
    topPath: args.topPath as string | null | undefined,
    monitorPath: args.monitorPath as string | null | undefined,
    serviceUrl: args.serviceUrl as string | null | undefined,
    iconKey:
      args.iconKey as PortalServiceInput["iconKey"],
    ...(Object.hasOwn(args, "properties")
      ? {
          properties:
            args.properties as PortalServiceInput["properties"],
        }
      : {}),
    enabled: args.enabled as boolean,
  };
}

function relationBody(args: ToolArguments): PortalRelationInput {
  const endpoint = (
    interfaceKey: string,
    serviceKey: string,
  ): Record<string, number | null> => {
    const interfaceId = args[interfaceKey];
    const serviceId = args[serviceKey];
    return {
      [interfaceKey]:
        typeof interfaceId === "number" ? interfaceId : null,
      [serviceKey]: typeof serviceId === "number" ? serviceId : null,
    };
  };
  return {
    ...endpoint("fromInterfaceId", "fromServiceId"),
    ...endpoint("toInterfaceId", "toServiceId"),
    relationName: stringArgument(args, "relationName"),
    fromLabel:
      args.fromLabel as string | undefined,
    toLabel:
      args.toLabel as string | undefined,
    ...(Object.hasOwn(args, "port")
      ? { port: args.port as PortalRelationInput["port"] }
      : {}),
    ...(Object.hasOwn(args, "protocol")
      ? { protocol: args.protocol as PortalRelationInput["protocol"] }
      : {}),
    ...(Object.hasOwn(args, "properties")
      ? {
          properties:
            args.properties as PortalRelationInput["properties"],
        }
      : {}),
  };
}

function relationNameBody(args: ToolArguments): PortalRelationNameInput {
  return {
    name: stringArgument(args, "name"),
    color: stringArgument(args, "color"),
    lineStart: args.lineStart as PortalRelationNameInput["lineStart"],
    lineEnd: args.lineEnd as PortalRelationNameInput["lineEnd"],
  };
}

export async function callTool(
  name: string,
  args: ToolArguments,
  client: LedgerRestClient,
): Promise<McpToolResult> {
  switch (name) {
    case "get_network_map": {
      const data = await client.getPortalData();
      const focus =
        typeof args.deviceId === "number"
          ? {
              deviceId: args.deviceId,
              depth: normalizedDepth(args, 0, 1),
            }
          : undefined;
      return {
        text: generateNetworkMapText(data, focus),
        structuredContent: {
          focusDeviceId: focus?.deviceId ?? null,
          depth: focus?.depth ?? null,
          networks: data.networks.length,
          devices: data.devices.length,
          services: data.services.length,
          relationNames: data.relationNames.length,
          relations: data.relations.length,
        },
      };
    }
    case "get_device_neighborhood": {
      const data = await client.getPortalData();
      const deviceId = numberArgument(args, "deviceId");
      if (!data.devices.some((device) => device.id === deviceId)) {
        throw missingEntity("devices", deviceId);
      }
      const depth = normalizedDepth(args, 0, 1);
      return {
        text: generateDeviceNeighborhoodText(data, deviceId, depth),
        structuredContent: { deviceId, depth },
      };
    }
    case "search_devices": {
      const data = await client.getPortalData();
      const results = searchDeviceResults(
        data,
        queryText(args),
        normalizedLimit(args),
      );
      return jsonResult(
        { count: results.length, devices: results },
        { count: results.length, devices: results },
      );
    }
    case "search_services": {
      const data = await client.getPortalData();
      const results = searchServiceResults(
        data,
        queryText(args),
        normalizedLimit(args),
      );
      return jsonResult(
        { count: results.length, services: results },
        { count: results.length, services: results },
      );
    }
    case "resolve_service_url": {
      const serviceId = numberArgument(args, "serviceId");
      const service = await client.getService(serviceId);
      if (!service) {
        throw missingEntity("services", serviceId);
      }
      const monitor = booleanArgument(args, "monitor", false);
      const url = monitor ? service.monitorUrl : service.url;
      const result = {
        serviceId,
        subdomain: service.subdomain,
        kind: monitor ? "monitor" : "service",
        url,
      };
      return jsonResult(result, result);
    }
    case "update_settings": {
      const current = await client.getSettings();
      const title =
        typeof args.title === "string" ? args.title : current.title;
      return jsonResult(
        await client.updateSettings({
          title,
          ...(Object.hasOwn(args, "properties")
            ? {
                properties:
                  args.properties as PortalSettingsInput["properties"],
              }
            : {}),
        }),
      );
    }
    case "reorder_networks": {
      const ids = args.ids;
      if (
        !Array.isArray(ids) ||
        !ids.every((id) => typeof id === "number" && Number.isInteger(id))
      ) {
        throw new Error("idsにはネットワークIDの配列を指定してください");
      }
      return jsonResult(await client.reorderNetworks(ids as number[]));
    }
    case "list_networks":
      return jsonResult(await client.listNetworks());
    case "get_network": {
      const id = numberArgument(args, "id");
      const network = await client.getNetwork(id);
      if (!network) {
        throw missingEntity("networks", id);
      }
      return jsonResult(network);
    }
    case "create_network":
      return jsonResult(await client.createNetwork(networkBody(args)));
    case "update_network": {
      const id = numberArgument(args, "id");
      return jsonResult(await client.updateNetwork(id, networkBody(args)));
    }
    case "delete_network":
      return jsonResult(await client.deleteNetwork(numberArgument(args, "id")));
    case "list_devices":
      return jsonResult(await client.listDevices());
    case "get_device": {
      const id = numberArgument(args, "id");
      const device = await client.getDevice(id);
      if (!device) {
        throw missingEntity("devices", id);
      }
      return jsonResult(device);
    }
    case "create_device":
      return jsonResult(await client.createDevice(deviceBody(args)));
    case "update_device": {
      const id = numberArgument(args, "id");
      return jsonResult(await client.updateDevice(id, deviceBody(args)));
    }
    case "delete_device":
      return jsonResult(await client.deleteDevice(numberArgument(args, "id")));
    case "list_interfaces":
      return jsonResult(await client.listInterfaces());
    case "get_interface": {
      const id = numberArgument(args, "id");
      const iface = await client.getInterface(id);
      if (!iface) {
        throw missingEntity("interfaces", id);
      }
      return jsonResult(iface);
    }
    case "create_interface":
      return jsonResult(await client.createInterface(interfaceBody(args)));
    case "update_interface": {
      const id = numberArgument(args, "id");
      return jsonResult(
        await client.updateInterface(id, interfaceBody(args)),
      );
    }
    case "delete_interface":
      return jsonResult(
        await client.deleteInterface(numberArgument(args, "id")),
      );
    case "list_services":
      return jsonResult(await client.listServices());
    case "get_service": {
      const id = numberArgument(args, "id");
      const service = await client.getService(id);
      if (!service) {
        throw missingEntity("services", id);
      }
      return jsonResult(service);
    }
    case "create_service":
      return jsonResult(await client.createService(serviceBody(args)));
    case "update_service": {
      const id = numberArgument(args, "id");
      return jsonResult(await client.updateService(id, serviceBody(args)));
    }
    case "delete_service":
      return jsonResult(await client.deleteService(numberArgument(args, "id")));
    case "list_relation_names":
      return jsonResult(await client.listRelationNames());
    case "get_relation_name": {
      const id = numberArgument(args, "id");
      const relationName = await client.getRelationName(id);
      if (!relationName) {
        throw missingEntity("relation-names", id);
      }
      return jsonResult(relationName);
    }
    case "create_relation_name":
      return jsonResult(
        await client.createRelationName(relationNameBody(args)),
      );
    case "update_relation_name": {
      const id = numberArgument(args, "id");
      return jsonResult(
        await client.updateRelationName(id, relationNameBody(args)),
      );
    }
    case "delete_relation_name":
      return jsonResult(
        await client.deleteRelationName(numberArgument(args, "id")),
      );
    case "list_relations":
      return jsonResult(await client.listRelations());
    case "get_relation": {
      const id = numberArgument(args, "id");
      const relation = await client.getRelation(id);
      if (!relation) {
        throw missingEntity("relations", id);
      }
      return jsonResult(relation);
    }
    case "get_device_relations": {
      const deviceId = numberArgument(args, "deviceId");
      const depth = normalizedDepth(args, 1, 1);
      return jsonResult(
        await client.traverseDeviceRelations(deviceId, depth),
      );
    }
    case "create_relation":
      return jsonResult(await client.createRelation(relationBody(args)));
    case "update_relation": {
      const id = numberArgument(args, "id");
      return jsonResult(await client.updateRelation(id, relationBody(args)));
    }
    case "delete_relation":
      return jsonResult(await client.deleteRelation(numberArgument(args, "id")));
    case "export_ledger_yaml": {
      const yaml = await client.exportYaml();
      return {
        text: yaml,
        structuredContent: { yaml },
      };
    }
    case "import_ledger_yaml": {
      const result = await client.importYaml(stringArgument(args, "yaml"));
      return jsonResult(result, result);
    }
    default:
      throw new Error(`未知のMCPツールです: ${name}`);
  }
}
