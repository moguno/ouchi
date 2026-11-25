import { parse } from "yaml";
import {
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalInterface,
  type PortalLineEndpointShape,
  type PortalNetwork,
  type PortalRelation,
  type PortalRelationName,
  type PortalService,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type ValidationIssue,
} from "./types";
import { normalizeServiceIconReference } from "./iconCatalog";
import {
  LEGACY_ACCENT_COLORS,
  normalizeNetworkAccent,
} from "./colorValue";
import { buildMonitorUrl, buildServiceUrl } from "./urls";
import {
  isLineEndpointShape,
  normalizeProperties,
  validatePortalData,
  validatePropertiesPayload,
} from "./validation";

export const LEDGER_FORMAT = "ouchi-ledger/9";
export const V8_LEDGER_FORMAT = "ouchi-ledger/8";
export const V7_LEDGER_FORMAT = "ouchi-ledger/7";
export const V6_LEDGER_FORMAT = "ouchi-ledger/6";
export const V5_LEDGER_FORMAT = "ouchi-ledger/5";
export const V4_LEDGER_FORMAT = "ouchi-ledger/4";
export const PREVIOUS_LEDGER_FORMAT = "ouchi-ledger/3";
export const V2_LEDGER_FORMAT = "ouchi-ledger/2";
export const LEGACY_LEDGER_FORMAT = "ouchi-ledger/1";

type RecordValue = Record<string, unknown>;

export class YAMLDataSourceError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = "YAMLDataSourceError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredArray(
  root: RecordValue,
  key: string,
  issues: ValidationIssue[],
): unknown[] {
  const value = root[key];
  if (Array.isArray(value)) {
    return value;
  }
  issues.push({ path: key, message: `${key}は配列で指定してください` });
  return [];
}

function requiredRecord(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): RecordValue {
  if (isRecord(value)) {
    return value;
  }
  issues.push({ path, message: `${path}はオブジェクトで指定してください` });
  return {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | undefined {
  const normalized = text(value);
  return normalized || undefined;
}

function normalizeAccent(value: unknown): string {
  return normalizeNetworkAccent(text(value));
}

function nullableNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function interfaceKey(device: string, name: string): string {
  return `${device}\u0000${name}`;
}

function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(" / ");
}

function upgradeLegacyDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== LEGACY_LEDGER_FORMAT) {
    return root;
  }
  const relationNames: RecordValue[] = [];
  const byName = new Map<string, RecordValue>();
  const relations = (Array.isArray(root.relations) ? root.relations : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const relationName = text(item.tag) || "未分類";
      if (!byName.has(relationName)) {
        const definition: RecordValue = {
          name: relationName,
          color: text(item.color),
        };
        byName.set(relationName, definition);
        relationNames.push(definition);
      }
      return {
        from: item.from,
        to: item.to,
        relationName,
        fromLabel: text(item.fromLabel),
        toLabel: text(item.toLabel),
      };
    },
  );
  return {
    ...root,
    format: PREVIOUS_LEDGER_FORMAT,
    relationNames,
    relations,
  };
}

function expandLegacyLabel(
  template: string | null | undefined,
  placeholder: unknown,
): string {
  const normalizedTemplate = template?.trim() ?? "";
  if (!normalizedTemplate) {
    return "";
  }
  const value = text(placeholder) || "-";
  return normalizedTemplate.split("{}").join(value);
}

/**
 * One-step upgrade from ouchi-ledger/2: relation-name label templates are
 * expanded into free-text labels on each relation.
 */
function upgradeV2Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V2_LEDGER_FORMAT) {
    return root;
  }
  const definitions = new Map<string, RecordValue>();
  const relationNames = (
    Array.isArray(root.relationNames) ? root.relationNames : []
  ).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const name = text(item.name);
    if (name && !definitions.has(name)) {
      definitions.set(name, item);
    }
    return {
      name: item.name,
      color: item.color,
    };
  });
  const relations = (Array.isArray(root.relations) ? root.relations : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const definition = definitions.get(text(item.relationName));
      return {
        from: item.from,
        to: item.to,
        relationName: item.relationName,
        fromLabel: expandLegacyLabel(
          definition ? nullableText(definition.fromLabel) : null,
          item.fromPlaceholder,
        ),
        toLabel: expandLegacyLabel(
          definition ? nullableText(definition.toLabel) : null,
          item.toPlaceholder,
        ),
      };
    },
  );
  return {
    ...root,
    format: PREVIOUS_LEDGER_FORMAT,
    relationNames,
    relations,
  };
}

/**
 * One-step upgrade from ouchi-ledger/3: memberships become named
 * interfaces (eth0, eth1, ... per device), relation endpoints resolve
 * to interfaces (shared-network heuristic, mirroring the server), and
 * services point at the interface on their network.
 */
function upgradeV3Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== PREVIOUS_LEDGER_FORMAT) {
    return root;
  }
  const interfacesByDevice = new Map<
    string,
    Array<{ name: string; network: string | null }>
  >();
  const devices = (Array.isArray(root.devices) ? root.devices : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const hostname = text(item.hostname);
      const memberships = Array.isArray(item.memberships)
        ? item.memberships
        : [];
      const interfaces = memberships.map((membership, index) => {
        if (!isRecord(membership)) {
          return membership;
        }
        return {
          name: `eth${index}`,
          network: nullableText(membership.network) ?? null,
          ip: membership.ip ?? null,
        };
      });
      interfacesByDevice.set(
        hostname,
        interfaces.map((iface) => ({
          name: text((iface as RecordValue).name),
          network:
            typeof (iface as RecordValue).network === "string"
              ? ((iface as RecordValue).network as string)
              : null,
        })),
      );
      const { memberships: _memberships, ...rest } = item;
      return { ...rest, interfaces };
    },
  );
  const resolveEndpoint = (
    hostname: string,
    otherHostname: string,
  ): string => {
    const own = interfacesByDevice.get(hostname) ?? [];
    if (own.length <= 1) {
      return own[0]?.name ?? "eth0";
    }
    const otherNetworks = new Set(
      (interfacesByDevice.get(otherHostname) ?? [])
        .map((iface) => iface.network)
        .filter((network) => network !== null),
    );
    const shared = own.find(
      (iface) => iface.network !== null && otherNetworks.has(iface.network),
    );
    return (shared ?? own[0]).name;
  };
  const relations = (Array.isArray(root.relations) ? root.relations : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const from = text(item.from);
      const to = text(item.to);
      return {
        from: { device: from, interface: resolveEndpoint(from, to) },
        to: { device: to, interface: resolveEndpoint(to, from) },
        relationName: item.relationName,
        ...(item.fromLabel ? { fromLabel: item.fromLabel } : {}),
        ...(item.toLabel ? { toLabel: item.toLabel } : {}),
      };
    },
  );
  const services = (Array.isArray(root.services) ? root.services : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const device = text(item.device);
      const network = text(item.network);
      const match = (interfacesByDevice.get(device) ?? []).find(
        (iface) => iface.network === network,
      );
      const { network: _network, ...rest } = item;
      return { ...rest, interface: match?.name ?? "" };
    },
  );
  return {
    ...root,
    format: V4_LEDGER_FORMAT,
    devices,
    relations,
    services,
  };
}

/**
 * One-step upgrade from ouchi-ledger/4: interfaces gain an optional
 * MAC address. /4 documents carry no MAC values, so the step only
 * advances the format marker.
 */
function upgradeV4Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V4_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V5_LEDGER_FORMAT,
  };
}

/**
 * One-step upgrade from ouchi-ledger/5: the interface label is
 * dropped (displayed nowhere; endpoint notes live on relations).
 * The step strips the field from every device's interfaces.
 */
function upgradeV5Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V5_LEDGER_FORMAT) {
    return root;
  }
  const devices = (Array.isArray(root.devices) ? root.devices : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const interfaces = (
        Array.isArray(item.interfaces) ? item.interfaces : []
      ).map((iface) => {
        if (!isRecord(iface)) {
          return iface;
        }
        const { label: _label, ...rest } = iface;
        return rest;
      });
      return { ...item, interfaces };
    },
  );
  return {
    ...root,
    format: V6_LEDGER_FORMAT,
    devices,
  };
}

/**
 * One-step upgrade from ouchi-ledger/6: the network accent becomes a
 * free CSS color, so the five legacy tone names convert to the palette
 * hex values they used to name. Other values pass through unchanged.
 */
function upgradeV6Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V6_LEDGER_FORMAT) {
    return root;
  }
  const networks = (Array.isArray(root.networks) ? root.networks : []).map(
    (item) => {
      if (!isRecord(item) || typeof item.accent !== "string") {
        return item;
      }
      const converted =
        LEGACY_ACCENT_COLORS[item.accent.trim().toLowerCase()];
      return converted ? { ...item, accent: converted } : item;
    },
  );
  return {
    ...root,
    format: V7_LEDGER_FORMAT,
    networks,
  };
}

/**
 * One-step upgrade from ouchi-ledger/7: devices drop the derived isVm
 * flag (the category alone says whether a device is a VM), so the key
 * is stripped from every device.
 */
/**
 * One-step upgrade from ouchi-ledger/8: relation names gain endpoint
 * shapes. Documents without them validate against the defaults, so
 * this step only advances the format.
 */
function upgradeV8Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V8_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: LEDGER_FORMAT,
  };
}

function lineEndpointShape(value: unknown): PortalLineEndpointShape {
  return isLineEndpointShape(value) ? value : "circle";
}

function upgradeV7Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V7_LEDGER_FORMAT) {
    return root;
  }
  const devices = (Array.isArray(root.devices) ? root.devices : []).map(
    (item) => {
      if (!isRecord(item)) {
        return item;
      }
      const { isVm: _isVm, ...rest } = item;
      return rest;
    },
  );
  return {
    ...root,
    format: LEDGER_FORMAT,
    devices,
  };
}

/**
 * Convert the natural-key `ouchi-ledger/6` export into the SPA display model.
 * Legacy `ouchi-ledger/1`, `/2`, `/3`, `/4` and `/5` documents are upgraded one
 * step at a time before validation.
 * This is the YAML counterpart to `normalizePortalData` in apiClient.ts.
 */
export function ledgerYamlToPortalData(input: string): PortalDataV2 {
  if (!input.trim()) {
    throw new YAMLDataSourceError("YAMLが空です");
  }

  let parsed: unknown;
  try {
    parsed = parse(input, {
      maxAliasCount: 100,
      uniqueKeys: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new YAMLDataSourceError(`YAMLを解析できません: ${message}`);
  }

  const issues: ValidationIssue[] = [];
  if (!isRecord(parsed)) {
    throw new YAMLDataSourceError(
      "YAMLのルートはオブジェクトである必要があります",
    );
  }

  const root = upgradeV8Document(
    upgradeV7Document(
    upgradeV6Document(
      upgradeV5Document(
        upgradeV4Document(
          upgradeV3Document(
            upgradeV2Document(upgradeLegacyDocument(parsed)),
          ),
        ),
      ),
      ),
    ),
  );

  if (root.format !== LEDGER_FORMAT) {
    issues.push({
      path: "format",
      message: `formatは「${LEDGER_FORMAT}」である必要があります`,
    });
  }

  const settings = requiredRecord(root.settings, "settings", issues);
  const networksRaw = requiredArray(root, "networks", issues);
  const devicesRaw = requiredArray(root, "devices", issues);
  const relationNamesRaw = requiredArray(root, "relationNames", issues);
  const relationsRaw = requiredArray(root, "relations", issues);
  const servicesRaw = requiredArray(root, "services", issues);
  requiredArray(root, "sshKeys", issues);
  requiredArray(root, "deviceKeys", issues);

  const networks: PortalNetwork[] = networksRaw.map((item, index) => {
    const network = requiredRecord(item, `networks[${index}]`, issues);
    const name = text(network.name);
    if (!name) {
      issues.push({
        path: `networks[${index}].name`,
        message: "ネットワーク名は必須です",
      });
    }
    return {
      id: `network-${index + 1}`,
      name,
      cidr: nullableText(network.cidr),
      accent: normalizeAccent(network.accent),
      note: nullableText(network.note),
    };
  });

  const networkByName = new Map<string, PortalNetwork>();
  for (const [index, network] of networks.entries()) {
    if (!network.name) {
      continue;
    }
    if (networkByName.has(network.name)) {
      issues.push({
        path: `networks[${index}].name`,
        message: `ネットワーク名「${network.name}」が重複しています`,
      });
      continue;
    }
    networkByName.set(network.name, network);
  }

  const devices: PortalDevice[] = [];
  const interfaces: PortalInterface[] = [];
  const deviceByName = new Map<string, PortalDevice>();
  const interfaceByNaturalKey = new Map<string, PortalInterface>();

  devicesRaw.forEach((item, index) => {
    const path = `devices[${index}]`;
    const device = requiredRecord(item, path, issues);
    const hostname = text(device.hostname);
    if (!hostname) {
      issues.push({
        path: `${path}.hostname`,
        message: "ホスト名は必須です",
      });
    }
    if (device.properties !== undefined) {
      issues.push(
        ...validatePropertiesPayload(
          device.properties,
          `${path}.properties`,
        ),
      );
    }

    const portalDevice: PortalDevice = {
      id: `device-${index + 1}`,
      name: hostname,
      petname: nullableText(device.petname),
      properties: normalizeProperties(device.properties),
      category: text(device.category) as PortalDeviceCategory,
      meterEnabled: device.meterEnabled === true,
      note: nullableText(device.note),
    };
    const sshUser = nullableText(device.sshUser);
    const sshPort = nullableNumber(device.sshPort);
    if (sshUser || sshPort) {
      portalDevice.ssh = {
        user: sshUser ?? "",
        port: sshPort ?? 22,
      };
    }
    devices.push(portalDevice);

    if (hostname) {
      if (deviceByName.has(hostname)) {
        issues.push({
          path: `${path}.hostname`,
          message: `ホスト名「${hostname}」が重複しています`,
        });
      } else {
        deviceByName.set(hostname, portalDevice);
      }
    }

    const rawInterfaces = Array.isArray(device.interfaces)
      ? device.interfaces
      : [];
    if (!Array.isArray(device.interfaces)) {
      issues.push({
        path: `${path}.interfaces`,
        message: "interfacesは配列で指定してください",
      });
    }
    for (const [interfaceIndex, interfaceItem] of rawInterfaces.entries()) {
      const interfacePath = `${path}.interfaces[${interfaceIndex}]`;
      const iface = requiredRecord(interfaceItem, interfacePath, issues);
      const interfaceName = text(iface.name);
      if (!interfaceName) {
        issues.push({
          path: `${interfacePath}.name`,
          message: "インターフェース名は必須です",
        });
      }
      const networkName = text(iface.network);
      const network = networkName
        ? networkByName.get(networkName)
        : undefined;
      if (networkName && !network) {
        issues.push({
          path: `${interfacePath}.network`,
          message: `ネットワーク「${networkName}」が存在しません`,
        });
      }

      const portalInterface: PortalInterface = {
        id: `interface-${interfaces.length + 1}`,
        deviceId: portalDevice.id,
        name: interfaceName,
        networkId: network?.id ?? null,
        ip: text(iface.ip),
        mac: nullableText(iface.mac),
      };
      interfaces.push(portalInterface);
      if (hostname && interfaceName) {
        const key = interfaceKey(hostname, interfaceName);
        if (interfaceByNaturalKey.has(key)) {
          issues.push({
            path: interfacePath,
            message: `${hostname} のインターフェース ${interfaceName} が重複しています`,
          });
        } else {
          interfaceByNaturalKey.set(key, portalInterface);
        }
      }
    }
  });

  const relationNameByName = new Map<string, PortalRelationName>();
  const relationNameCounts = new Map<string, number>();
  const relationNames: PortalRelationName[] = relationNamesRaw.map(
    (item, index) => {
      const path = `relationNames[${index}]`;
      const relationName = requiredRecord(item, path, issues);
      const name = text(relationName.name);
      if (!name) {
        issues.push({
          path: `${path}.name`,
          message: "関係名は必須です",
        });
      } else if (relationNameByName.has(name)) {
        issues.push({
          path: `${path}.name`,
          message: `関係名「${name}」が重複しています`,
        });
      }
      const portalRelationName: PortalRelationName = {
        id: `relation-name-${index + 1}`,
        name,
        color: text(relationName.color),
        lineStart: lineEndpointShape(relationName.lineStart),
        lineEnd: lineEndpointShape(relationName.lineEnd),
        relationCount: 0,
      };
      if (name && !relationNameByName.has(name)) {
        relationNameByName.set(name, portalRelationName);
      }
      relationNameCounts.set(name, 0);
      return portalRelationName;
    },
  );

  const relations: PortalRelation[] = relationsRaw.map((item, index) => {
    const path = `relations[${index}]`;
    const relation = requiredRecord(item, path, issues);
    const endpoint = (value: unknown) =>
      isRecord(value)
        ? { device: text(value.device), interface: text(value.interface) }
        : { device: "", interface: "" };
    const from = endpoint(relation.from);
    const to = endpoint(relation.to);
    const relationNameText = text(relation.relationName);
    const relationName = relationNameByName.get(relationNameText);
    const fromLabel = text(relation.fromLabel);
    const toLabel = text(relation.toLabel);
    const fromDevice = deviceByName.get(from.device);
    const toDevice = deviceByName.get(to.device);
    const fromInterface = interfaceByNaturalKey.get(
      interfaceKey(from.device, from.interface),
    );
    const toInterface = interfaceByNaturalKey.get(
      interfaceKey(to.device, to.interface),
    );
    if (!fromDevice) {
      issues.push({
        path: `${path}.from.device`,
        message: `デバイス「${from.device}」が存在しません`,
      });
    } else if (!fromInterface) {
      issues.push({
        path: `${path}.from.interface`,
        message: `インターフェース「${from.device} / ${from.interface}」が存在しません`,
      });
    }
    if (!toDevice) {
      issues.push({
        path: `${path}.to.device`,
        message: `デバイス「${to.device}」が存在しません`,
      });
    } else if (!toInterface) {
      issues.push({
        path: `${path}.to.interface`,
        message: `インターフェース「${to.device} / ${to.interface}」が存在しません`,
      });
    }
    if (!relationNameText) {
      issues.push({
        path: `${path}.relationName`,
        message: "関係名は必須です",
      });
    } else if (!relationName) {
      issues.push({
        path: `${path}.relationName`,
        message: `関係名「${relationNameText}」が存在しません`,
      });
    }
    if (relationNameText) {
      relationNameCounts.set(
        relationNameText,
        (relationNameCounts.get(relationNameText) ?? 0) + 1,
      );
    }
    return {
      id: `relation-${index + 1}`,
      relationNameId: relationName?.id ?? "",
      relationName: relationNameText,
      fromDeviceId: fromDevice?.id ?? "",
      toDeviceId: toDevice?.id ?? "",
      fromInterfaceId: fromInterface?.id ?? "",
      toInterfaceId: toInterface?.id ?? "",
      fromLabel,
      toLabel,
      color: relationName?.color ?? "",
      lineStart: relationName?.lineStart ?? "circle",
      lineEnd: relationName?.lineEnd ?? "circle",
    };
  });
  for (const relationName of relationNames) {
    relationName.relationCount =
      relationNameCounts.get(relationName.name) ?? 0;
  }

  const services: PortalService[] = servicesRaw.map((item, index) => {
    const path = `services[${index}]`;
    const service = requiredRecord(item, path, issues);
    const deviceName = text(service.device);
    const interfaceName = text(service.interface);
    const iface = interfaceByNaturalKey.get(
      interfaceKey(deviceName, interfaceName),
    );
    if (!deviceName) {
      issues.push({
        path: `${path}.device`,
        message: "deviceの自然キーは必須です",
      });
    }
    if (!interfaceName) {
      issues.push({
        path: `${path}.interface`,
        message: "interfaceの自然キーは必須です",
      });
    }
    if (deviceName && interfaceName && !iface) {
      issues.push({
        path,
        message: `${deviceName} のインターフェース ${interfaceName} が存在しません`,
      });
    }
    if (service.properties !== undefined) {
      issues.push(
        ...validatePropertiesPayload(
          service.properties,
          `${path}.properties`,
        ),
      );
    }

    const portalService: PortalService = {
      id: `service-${index + 1}`,
      interfaceId: iface?.id ?? "",
      subdomain: text(service.subdomain).toLowerCase(),
      petname: nullableText(service.petname),
      description: nullableText(service.description),
      properties: normalizeProperties(service.properties),
      scheme: text(service.scheme) as PortalServiceScheme,
      port: nullableNumber(service.port) ?? 0,
      protocol: text(service.protocol) as PortalServiceProtocol,
      topPath: text(service.topPath) || "/",
      monitorPath: text(service.monitorPath) || "/",
      serviceUrl: nullableText(service.serviceUrl),
      iconKey: normalizeServiceIconReference(
        service.iconKey,
        service.faviconUrl,
      ),
      enabled: service.enabled === true,
      url: null,
      monitorUrl: null,
    };
    if (iface) {
      portalService.url = buildServiceUrl(portalService, iface);
      portalService.monitorUrl = buildMonitorUrl(portalService, iface);
    }
    return portalService;
  });

  const data: PortalDataV2 = {
    version: 2,
    networks,
    devices,
    interfaces,
    relationNames,
    relations,
    services,
    settings: {
      domain: text(settings.domain),
      title: text(settings.title),
    },
  };

  if (issues.length === 0) {
    const validation = validatePortalData(data);
    issues.push(...validation.issues);
  }
  if (issues.length > 0) {
    throw new YAMLDataSourceError(
      `YAMLデータを検証できません。${formatIssues(issues)}`,
      issues,
    );
  }
  return data;
}

export async function fetchPortalFromYaml(
  yamlUrl: string,
): Promise<PortalDataV2> {
  return ledgerYamlToPortalData(await fetchDemoLedgerYaml(yamlUrl));
}

export async function fetchDemoLedgerYaml(yamlUrl: string): Promise<string> {
  const response = await fetch(yamlUrl, {
    headers: { Accept: "application/yaml" },
  });
  if (!response.ok) {
    throw new YAMLDataSourceError(
      `YAMLを取得できませんでした（HTTP ${response.status}）`,
    );
  }
  return response.text();
}
