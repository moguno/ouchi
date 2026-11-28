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
import { projectColorFromName } from "./colorValue";
import { buildMonitorUrl, buildServiceUrl } from "./urls";
import {
  normalizeProperties,
  validatePortalData,
  validatePropertiesPayload,
} from "./validation";
import {
  formatIssues,
  interfaceKey,
  isRecord,
  LEDGER_FORMAT,
  lineEndpointShape,
  normalizeAccent,
  nullableNumber,
  nullableText,
  requiredArray,
  requiredRecord,
  text,
  upgradeLegacyDocument,
  upgradeV10Document,
  upgradeV11Document,
  upgradeV12Document,
  upgradeV13Document,
  upgradeV14Document,
  upgradeV15Document,
  upgradeV16Document,
  upgradeV2Document,
  upgradeV3Document,
  upgradeV4Document,
  upgradeV5Document,
  upgradeV6Document,
  upgradeV7Document,
  upgradeV8Document,
  upgradeV9Document,
  YAMLDataSourceError,
} from "./yamlUpgrade";

export { YAMLDataSourceError } from "./yamlUpgrade";

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

  const root = upgradeV16Document(
    upgradeV15Document(
    upgradeV14Document(
    upgradeV13Document(
    upgradeV12Document(
    upgradeV11Document(
    upgradeV10Document(
    upgradeV9Document(
      upgradeV8Document(
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
      ),
    ),
    ),
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
      projectId: "project-1",
      name,
      cidr: nullableText(network.cidr),
      accent: normalizeAccent(network.accent),
      note: nullableText(network.note),
      properties: normalizeProperties(network.properties),
      sortOrder: (index + 1) * 10,
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
      projectId: "project-1",
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
      if (iface.properties !== undefined) {
        issues.push(
          ...validatePropertiesPayload(
            iface.properties,
            `${interfacePath}.properties`,
          ),
        );
      }

      const portalInterface: PortalInterface = {
        id: `interface-${interfaces.length + 1}`,
        projectId: "project-1",
        deviceId: portalDevice.id,
        name: interfaceName,
        networkId: network?.id ?? null,
        ip: text(iface.ip),
        mac: nullableText(iface.mac),
        properties: normalizeProperties(iface.properties),
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
        projectId: "project-1",
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

  const serviceBySubdomain = new Map<
    string,
    { id: string; deviceId: string }
  >();
  servicesRaw.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }
    const subdomain = text(item.subdomain);
    const hostInterface = interfaceByNaturalKey.get(
      interfaceKey(text(item.device), text(item.interface)),
    );
    if (subdomain && hostInterface && !serviceBySubdomain.has(subdomain)) {
      serviceBySubdomain.set(subdomain, {
        id: `service-${index + 1}`,
        deviceId: hostInterface.deviceId,
      });
    }
  });

  const relations: PortalRelation[] = relationsRaw.map((item, index) => {
    const path = `relations[${index}]`;
    const relation = requiredRecord(item, path, issues);
    type YamlRelationEndpoint =
      | { service: string }
      | { device: string; interface: string };
    const endpoint = (value: unknown): YamlRelationEndpoint =>
      isRecord(value) && text(value.service)
        ? { service: text(value.service) }
        : {
            device: isRecord(value) ? text(value.device) : "",
            interface: isRecord(value) ? text(value.interface) : "",
          };
    const from = endpoint(relation.from);
    const to = endpoint(relation.to);
    const relationNameText = text(relation.relationName);
    const relationName = relationNameByName.get(relationNameText);
    const fromLabel = text(relation.fromLabel);
    const toLabel = text(relation.toLabel);
    const resolveEndpoint = (
      value: typeof from,
      side: "from" | "to",
    ): { deviceId: string; interfaceId: string | null; serviceId: string | null } => {
      if ("service" in value) {
        const service = serviceBySubdomain.get(value.service);
        if (!service) {
          issues.push({
            path: `${path}.${side}.service`,
            message: `サービス「${value.service}」が存在しません`,
          });
          return { deviceId: "", interfaceId: null, serviceId: null };
        }
        return {
          deviceId: service.deviceId,
          interfaceId: null,
          serviceId: service.id,
        };
      }
      const device = deviceByName.get(value.device);
      const iface = interfaceByNaturalKey.get(
        interfaceKey(value.device, value.interface),
      );
      if (!device) {
        issues.push({
          path: `${path}.${side}.device`,
          message: `デバイス「${value.device}」が存在しません`,
        });
      } else if (!iface) {
        issues.push({
          path: `${path}.${side}.interface`,
          message: `インターフェース「${value.device} / ${value.interface}」が存在しません`,
        });
      }
      return {
        deviceId: device?.id ?? "",
        interfaceId: iface?.id ?? null,
        serviceId: null,
      };
    };
    const fromResolved = resolveEndpoint(from, "from");
    const toResolved = resolveEndpoint(to, "to");
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
    if (relation.properties !== undefined) {
      issues.push(
        ...validatePropertiesPayload(
          relation.properties,
          `${path}.properties`,
        ),
      );
    }
    return {
      id: `relation-${index + 1}`,
      projectId: "project-1",
      relationNameId: relationName?.id ?? "",
      relationName: relationNameText,
      fromDeviceId: fromResolved.deviceId,
      toDeviceId: toResolved.deviceId,
      fromInterfaceId: fromResolved.interfaceId,
      toInterfaceId: toResolved.interfaceId,
      fromServiceId: fromResolved.serviceId,
      toServiceId: toResolved.serviceId,
      fromLabel,
      toLabel,
      port: nullableNumber(relation.port) ?? null,
      protocol:
        relation.protocol === "tcp" || relation.protocol === "udp"
          ? relation.protocol
          : null,
      properties: normalizeProperties(relation.properties),
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
      projectId: "project-1",
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

  // A /16 document describes exactly one project; its settings
  // carry that project's ouchi (title + global memo).
  const projectName = text(root.project) || "デフォルト";
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
      title: text(settings.title) || "あなたのホームラボ",
      properties: normalizeProperties(settings.properties),
    },
    projects: [
      {
        id: "project-1",
        name: projectName,
        title: text(settings.title) || "あなたのホームラボ",
        color: text(settings.color) || projectColorFromName(projectName),
        properties: normalizeProperties(settings.properties),
      },
    ],
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
