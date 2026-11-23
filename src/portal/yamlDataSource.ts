import { parse } from "yaml";
import {
  ACCENT_TONES,
  type AccentTone,
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalDeviceNetwork,
  type PortalNetwork,
  type PortalRelation,
  type PortalRelationName,
  type PortalService,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type ValidationIssue,
} from "./types";
import { normalizeServiceIconReference } from "./iconCatalog";
import { resolveRelationLabel } from "./relationLabels";
import { buildMonitorUrl, buildServiceUrl } from "./urls";
import {
  normalizeProperties,
  validatePortalData,
  validatePropertiesPayload,
} from "./validation";

export const LEDGER_FORMAT = "ouchi-ledger/2";
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

function normalizeAccent(value: unknown): AccentTone {
  const accent = text(value);
  return ACCENT_TONES.includes(accent as AccentTone)
    ? (accent as AccentTone)
    : "slate";
}

function nullableNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function membershipKey(device: string, network: string): string {
  return `${device}\u0000${network}`;
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
          fromLabel: nullableText(item.fromLabel),
          toLabel: nullableText(item.toLabel),
        };
        byName.set(relationName, definition);
        relationNames.push(definition);
      }
      return {
        from: item.from,
        to: item.to,
        relationName,
      };
    },
  );
  return {
    ...root,
    format: LEDGER_FORMAT,
    relationNames,
    relations,
  };
}

/**
 * Convert the natural-key `ouchi-ledger/2` export into the SPA display model.
 * Legacy `ouchi-ledger/1` relation rows are upgraded before validation.
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

  const root = upgradeLegacyDocument(parsed);

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
  const deviceNetworks: PortalDeviceNetwork[] = [];
  const deviceByName = new Map<string, PortalDevice>();
  const membershipByNaturalKey = new Map<string, PortalDeviceNetwork>();

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
      isVm: device.isVm === true,
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

    const memberships = Array.isArray(device.memberships)
      ? device.memberships
      : [];
    if (!Array.isArray(device.memberships)) {
      issues.push({
        path: `${path}.memberships`,
        message: "membershipsは配列で指定してください",
      });
    }
    for (const [membershipIndex, membershipItem] of memberships.entries()) {
      const membershipPath = `${path}.memberships[${membershipIndex}]`;
      const membership = requiredRecord(
        membershipItem,
        membershipPath,
        issues,
      );
      const networkName = text(membership.network);
      const network = networkByName.get(networkName);
      if (!networkName) {
        issues.push({
          path: `${membershipPath}.network`,
          message: "所属ネットワーク名は必須です",
        });
      } else if (!network) {
        issues.push({
          path: `${membershipPath}.network`,
          message: `ネットワーク「${networkName}」が存在しません`,
        });
      }

      const portalMembership: PortalDeviceNetwork = {
        id: `membership-${deviceNetworks.length + 1}`,
        deviceId: portalDevice.id,
        networkId:
          network?.id ?? `missing-network-${membershipIndex + 1}`,
        ip: text(membership.ip),
        label: nullableText(membership.label),
      };
      deviceNetworks.push(portalMembership);
      if (hostname && networkName) {
        const key = membershipKey(hostname, networkName);
        if (membershipByNaturalKey.has(key)) {
          issues.push({
            path: membershipPath,
            message: `${hostname} の ${networkName} 所属が重複しています`,
          });
        } else {
          membershipByNaturalKey.set(key, portalMembership);
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
        fromLabel: nullableText(relationName.fromLabel),
        toLabel: nullableText(relationName.toLabel),
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
    const from = text(relation.from);
    const to = text(relation.to);
    const relationNameText = text(relation.relationName);
    const relationName = relationNameByName.get(relationNameText);
    const fromPlaceholder = text(relation.fromPlaceholder);
    const toPlaceholder = text(relation.toPlaceholder);
    const fromDevice = deviceByName.get(from);
    const toDevice = deviceByName.get(to);
    if (!fromDevice) {
      issues.push({
        path: `${path}.from`,
        message: `デバイス「${from}」が存在しません`,
      });
    }
    if (!toDevice) {
      issues.push({
        path: `${path}.to`,
        message: `デバイス「${to}」が存在しません`,
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
      fromPlaceholder,
      toPlaceholder,
      fromLabel: resolveRelationLabel(
        relationName?.fromLabel,
        fromPlaceholder,
        relationNameText,
      ),
      toLabel: resolveRelationLabel(
        relationName?.toLabel,
        toPlaceholder,
        relationNameText,
      ),
      color: relationName?.color ?? "",
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
    const networkName = text(service.network);
    const membership = membershipByNaturalKey.get(
      membershipKey(deviceName, networkName),
    );
    if (!deviceName) {
      issues.push({
        path: `${path}.device`,
        message: "deviceの自然キーは必須です",
      });
    }
    if (!networkName) {
      issues.push({
        path: `${path}.network`,
        message: "networkの自然キーは必須です",
      });
    }
    if (deviceName && networkName && !membership) {
      issues.push({
        path,
        message: `${deviceName} の ${networkName} 所属が存在しません`,
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
      deviceNetworkId: membership?.id ?? "",
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
        "favicon",
      ),
      enabled: service.enabled === true,
      url: null,
      monitorUrl: null,
    };
    if (membership) {
      portalService.url = buildServiceUrl(portalService, membership);
      portalService.monitorUrl = buildMonitorUrl(portalService, membership);
    }
    return portalService;
  });

  const data: PortalDataV2 = {
    version: 2,
    networks,
    devices,
    deviceNetworks,
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
