import { normalizeServiceIconReference } from "../src/portal/iconCatalog";
import { projectColorFromName } from "../src/portal/colorValue";
import { accentColorIssue } from "../src/portal/validationFormats";
import {
  isCidr,
  isIpWithinCidr,
  isLineEndpointShape,
  normalizeProperties,
  validateDevicePayload,
  validateInterfacePayload,
  validateNetworkPayload,
  validatePropertiesPayload,
  validateRelationNamePayload,
  validateRelationPayload,
  validateServicePayload,
  validateSettingsPayload,
} from "../src/portal/validation";
import type {
  PortalDeviceInput,
  PortalInterfaceInput,
  PortalProperties,
  PortalRelationInput,
  PortalServiceInput,
  PortalServiceProtocol,
  ValidationIssue,
} from "../src/portal/types";
import {
  DEFAULT_PROJECT_TITLE,
  LEDGER_FORMAT,
  LedgerValidationError,
} from "./ledgerTypes";
import type {
  LedgerDevice,
  LedgerDeviceKey,
  LedgerDocument,
  LedgerInterface,
  LedgerNetwork,
  LedgerRelation,
  LedgerRelationEndpoint,
  LedgerRelationName,
  LedgerService,
  LedgerSshKey,
  RecordValue,
} from "./ledgerTypes";
import {
  arrayValue,
  isRecord,
  nullablePetname,
  nullableText,
  textValue,
  uniqueMap,
} from "./ledgerValues";

function validateSshKey(
  input: unknown,
  index: number,
): LedgerSshKey | undefined {
  const path = `sshKeys[${index}]`;
  if (!isRecord(input)) {
    throw new LedgerValidationError([
      { path, message: "SSH公開鍵の形式が不正です" },
    ]);
  }

  const issues: ValidationIssue[] = [];
  for (const field of ["owner", "purpose", "keyType", "publicKey"] as const) {
    if (!textValue(input[field])) {
      issues.push({ path: `${path}.${field}`, message: `${field}は必須です` });
    }
  }
  for (const field of ["fingerprint", "expiresAt", "note"] as const) {
    if (
      input[field] !== undefined &&
      input[field] !== null &&
      typeof input[field] !== "string"
    ) {
      issues.push({ path: `${path}.${field}`, message: `${field}が不正です` });
    }
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({
      path: `${path}.enabled`,
      message: "enabledが不正です",
    });
  }
  if (issues.length > 0) {
    throw new LedgerValidationError(issues);
  }

  return {
    owner: textValue(input.owner),
    purpose: textValue(input.purpose),
    keyType: textValue(input.keyType),
    publicKey: textValue(input.publicKey),
    fingerprint: nullableText(input.fingerprint),
    expiresAt: nullableText(input.expiresAt),
    enabled: input.enabled as boolean,
    note: nullableText(input.note),
  };
}

export function validateDocument(root: RecordValue): LedgerDocument {
  const issues: ValidationIssue[] = [];
  if (root.format !== LEDGER_FORMAT) {
    issues.push({
      path: "format",
      message: `formatは「${LEDGER_FORMAT}」である必要があります`,
    });
  }
  if (
    typeof root.exportedAt !== "string" ||
    root.exportedAt.trim() === "" ||
    Number.isNaN(Date.parse(root.exportedAt))
  ) {
    issues.push({
      path: "exportedAt",
      message: "exportedAtはISO日時で指定してください",
    });
  }

  for (const field of [
    "networks",
    "devices",
    "relationNames",
    "relations",
    "services",
    "sshKeys",
    "deviceKeys",
  ] as const) {
    if (!Array.isArray(root[field])) {
      issues.push({
        path: field,
        message: `${field}は配列で指定してください`,
      });
    }
  }
  if (!isRecord(root.settings)) {
    issues.push({ path: "settings", message: "settingsは必須です" });
  } else if (!textValue(root.settings.domain)) {
    issues.push({
      path: "settings.domain",
      message: "domainは必須です",
    });
  } else if (
    (root.settings as RecordValue).title === undefined &&
    Object.hasOwn(root.settings, "properties")
  ) {
    // A document may omit the ouchi title (the default applies);
    // only the memo map needs validating then.
    issues.push(
      ...validatePropertiesPayload(
        (root.settings as RecordValue).properties,
      ).map((issue) => ({
        ...issue,
        path: `settings.${issue.path}`,
      })),
    );
  } else if ((root.settings as RecordValue).title !== undefined) {
    issues.push(
      ...validateSettingsPayload(root.settings).map((issue) => ({
        ...issue,
        path: `settings.${issue.path}`,
      })),
    );
  }

  if (isRecord(root.settings) && root.settings.color !== undefined) {
    const colorIssue = accentColorIssue(root.settings.color, "settings.color");
    if (colorIssue) {
      issues.push(colorIssue);
    }
  }

  // A /16 document is one project: the project name at the root and
  // the ouchi (title + global memo) inside its settings. Every entity
  // in the document belongs to that project.
  const projectName = textValue(root.project);
  if (!projectName) {
    issues.push({
      path: "project",
      message: "プロジェクト名は必須です",
    });
  }

  const networks: LedgerNetwork[] = [];
  arrayValue(root.networks).forEach((item, index) => {
    issues.push(...validateNetworkPayload(item).map((issue) => ({
      ...issue,
      path: `networks[${index}]${issue.path === "root" ? "" : `.${issue.path}`}`,
    })));
    if (!isRecord(item)) {
      return;
    }
    networks.push({
      name: textValue(item.name),
      cidr: nullableText(item.cidr),
      accent: textValue(item.accent),
      note: nullableText(item.note),
      properties: normalizeProperties(item.properties),
    });
  });

  const devices: LedgerDevice[] = [];
  arrayValue(root.devices).forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        path: `devices[${index}]`,
        message: "デバイスの形式が不正です",
      });
      return;
    }
    issues.push(...validateDevicePayload(item).map((issue) => ({
      ...issue,
      path: `devices[${index}]${issue.path === "root" ? "" : `.${issue.path}`}`,
    })));
    if (!Array.isArray(item.interfaces)) {
      issues.push({
        path: `devices[${index}].interfaces`,
        message: "interfacesは配列で指定してください",
      });
    }
    const interfaces: LedgerInterface[] = [];
    arrayValue(item.interfaces).forEach((iface, interfaceIndex) => {
      const interfacePath =
        `devices[${index}].interfaces[${interfaceIndex}]`;
      if (!isRecord(iface)) {
        issues.push({
          path: interfacePath,
          message: "インターフェースの形式が不正です",
        });
        return;
      }
      const synthetic: PortalInterfaceInput = {
        deviceId: index + 1,
        name: textValue(iface.name),
        networkId:
          nullableText(iface.network) === null ? null : interfaceIndex + 1,
        ip: nullableText(iface.ip),
        mac: nullableText(iface.mac),
        ...(iface.properties !== undefined
          ? { properties: iface.properties as PortalProperties }
          : {}),
      };
      issues.push(...validateInterfacePayload(synthetic).map((issue) => ({
        ...issue,
        path: `${interfacePath}.${issue.path}`,
      })));
      interfaces.push({
        name: textValue(iface.name),
        network: nullableText(iface.network),
        ip: nullableText(iface.ip),
        mac: nullableText(iface.mac),
        properties: normalizeProperties(iface.properties),
      });
    });
    devices.push({
      hostname: textValue(item.hostname),
      petname: nullablePetname(item.petname),
      category: item.category as PortalDeviceInput["category"],
      sshUser: nullableText(item.sshUser),
      sshPort:
        typeof item.sshPort === "number" ? item.sshPort : null,
      meterEnabled: item.meterEnabled as boolean,
      note: nullableText(item.note),
      properties: normalizeProperties(item.properties),
      interfaces,
    });
  });

  const relationNames: LedgerRelationName[] = [];
  arrayValue(root.relationNames).forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        path: `relationNames[${index}]`,
        message: "関係名の形式が不正です",
      });
      return;
    }
    issues.push(
      ...validateRelationNamePayload(item).map((issue) => ({
        ...issue,
        path: `relationNames[${index}].${issue.path}`,
      })),
    );
    relationNames.push({
      name: textValue(item.name),
      color: textValue(item.color),
      lineStart: isLineEndpointShape(item.lineStart)
        ? item.lineStart
        : "circle",
      lineEnd: isLineEndpointShape(item.lineEnd) ? item.lineEnd : "circle",
    });
  });

  const relations: LedgerRelation[] = [];
  arrayValue(root.relations).forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        path: `relations[${index}]`,
        message: "関係の形式が不正です",
      });
      return;
    }
    const endpoint = (value: unknown): LedgerRelationEndpoint =>
      isRecord(value) && textValue(value.service)
        ? { service: textValue(value.service) }
        : {
            device: isRecord(value) ? textValue(value.device) : "",
            interface: isRecord(value) ? textValue(value.interface) : "",
          };
    const from = endpoint(item.from);
    const to = endpoint(item.to);
    const synthetic: PortalRelationInput = {
      relationName: textValue(item.relationName),
      fromInterfaceId: "service" in from ? null : index + 1,
      fromServiceId: "service" in from ? index + 1 : null,
      toInterfaceId: "service" in to ? null : index + 2,
      toServiceId: "service" in to ? index + 2 : null,
      fromLabel: textValue(item.fromLabel),
      toLabel: textValue(item.toLabel),
      port: item.port as number | null | undefined,
      protocol: item.protocol as PortalServiceProtocol | null | undefined,
      properties: normalizeProperties(item.properties),
    };
    issues.push(...validateRelationPayload(synthetic).map((issue) => ({
      ...issue,
      path: `relations[${index}].${issue.path}`,
    })));
    for (const [field, value] of [
      ["from", from],
      ["to", to],
    ] as const) {
      if ("service" in value) {
        continue;
      }
      if (!value.device) {
        issues.push({
          path: `relations[${index}].${field}.device`,
          message: "deviceのホスト名は必須です",
        });
      }
      if (!value.interface) {
        issues.push({
          path: `relations[${index}].${field}.interface`,
          message: "interface名は必須です",
        });
      }
    }
    if (!textValue(item.relationName)) {
      issues.push({
        path: `relations[${index}].relationName`,
        message: "relationNameは必須です",
      });
    }
    relations.push({
      from,
      to,
      relationName: textValue(item.relationName),
      fromLabel: textValue(item.fromLabel),
      toLabel: textValue(item.toLabel),
      ...(typeof item.port === "number" ? { port: item.port } : {}),
      ...(item.protocol === "tcp" || item.protocol === "udp"
        ? { protocol: item.protocol }
        : {}),
      properties: normalizeProperties(item.properties),
    });
  });

  const services: LedgerService[] = [];
  arrayValue(root.services).forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        path: `services[${index}]`,
        message: "サービスの形式が不正です",
      });
      return;
    }
    const iconKey = normalizeServiceIconReference(
      item.iconKey,
      item.faviconUrl,
    );
    const synthetic: PortalServiceInput = {
      interfaceId: index + 1,
      subdomain: textValue(item.subdomain),
      petname: nullablePetname(item.petname),
      description: nullableText(item.description),
      port: item.port as number,
      protocol: item.protocol as PortalServiceInput["protocol"],
      scheme: item.scheme as PortalServiceInput["scheme"],
      topPath: nullableText(item.topPath),
      monitorPath: nullableText(item.monitorPath),
      serviceUrl: nullableText(item.serviceUrl),
      iconKey,
      properties: normalizeProperties(item.properties),
      enabled: item.enabled as boolean,
    };
    issues.push(...validateServicePayload(synthetic).map((issue) => ({
      ...issue,
      path: `services[${index}].${issue.path}`,
    })));
    for (const field of ["device", "interface"] as const) {
      if (!textValue(item[field])) {
        issues.push({
          path: `services[${index}].${field}`,
          message: `${field}の自然キーは必須です`,
        });
      }
    }
    if (
      item.faviconUrl !== undefined &&
      item.faviconUrl !== null &&
      typeof item.faviconUrl !== "string"
    ) {
      issues.push({
        path: `services[${index}].faviconUrl`,
        message: "faviconUrlが不正です",
      });
    }
    services.push({
      subdomain: textValue(item.subdomain).toLowerCase(),
      device: textValue(item.device),
      interface: textValue(item.interface),
      petname: nullablePetname(item.petname),
      description: nullableText(item.description),
      port: item.port as number,
      protocol: item.protocol as PortalServiceInput["protocol"],
      scheme: item.scheme as PortalServiceInput["scheme"],
      topPath: nullableText(item.topPath),
      monitorPath: nullableText(item.monitorPath),
      serviceUrl: nullableText(item.serviceUrl),
      iconKey,
      properties: normalizeProperties(item.properties),
      enabled: item.enabled as boolean,
    });
  });

  const sshKeys: LedgerSshKey[] = [];
  arrayValue(root.sshKeys).forEach((item, index) => {
    try {
      const key = validateSshKey(item, index);
      if (key) {
        sshKeys.push(key);
      }
    } catch (error) {
      if (error instanceof LedgerValidationError) {
        issues.push(...error.issues);
      } else {
        throw error;
      }
    }
  });

  const deviceKeys: LedgerDeviceKey[] = [];
  arrayValue(root.deviceKeys).forEach((item, index) => {
    const path = `deviceKeys[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path, message: "デバイス鍵の形式が不正です" });
      return;
    }
    if (!textValue(item.device)) {
      issues.push({
        path: `${path}.device`,
        message: "deviceのホスト名は必須です",
      });
    }
    if (!textValue(item.publicKey)) {
      issues.push({
        path: `${path}.publicKey`,
        message: "publicKeyは必須です",
      });
    }
    deviceKeys.push({
      device: textValue(item.device),
      publicKey: textValue(item.publicKey),
    });
  });

  if (issues.length > 0) {
    throw new LedgerValidationError(issues);
  }

  const networkByName = uniqueMap(
    networks,
    (network) => network.name,
    (network) => "networks",
    "ネットワーク名",
    issues,
  );
  const deviceByName = uniqueMap(
    devices,
    (device) => device.hostname,
    (device) => "devices",
    "ホスト名",
    issues,
  );
  uniqueMap(
    services,
    (service) => service.subdomain,
    (service) => "services",
    "サブドメイン",
    issues,
  );
  const sshKeyByPublicKey = uniqueMap(
    sshKeys,
    (key) => key.publicKey,
    (key) => "sshKeys",
    "公開鍵",
    issues,
  );
  const relationNameByName = uniqueMap(
    relationNames,
    (relationName) => relationName.name,
    (relationName) =>
      `relationNames.${relationNames.indexOf(relationName)}`,
    "関係名",
    issues,
  );

  const cidrs = new Set<string>();
  networks.forEach((network, index) => {
    if (!network.cidr) {
      return;
    }
    if (!isCidr(network.cidr)) {
      issues.push({
        path: `networks[${index}].cidr`,
        message: "CIDRの形式が不正です",
      });
    } else if (cidrs.has(network.cidr)) {
      issues.push({
        path: `networks[${index}].cidr`,
        message: `CIDR ${network.cidr} が重複しています`,
      });
    }
    cidrs.add(network.cidr);
  });

  const interfaceKeys = new Set<string>();
  const ipOwners = new Map<string, string>();
  devices.forEach((device, deviceIndex) => {
    device.interfaces.forEach((iface, interfaceIndex) => {
      const path =
        `devices[${deviceIndex}].interfaces[${interfaceIndex}]`;
      if (iface.network !== null) {
        const network = networkByName.get(iface.network);
        if (!network) {
          issues.push({
            path: `${path}.network`,
            message: `ネットワーク「${iface.network}」が存在しません`,
          });
        } else if (
          iface.ip &&
          network.cidr &&
          !isIpWithinCidr(iface.ip, network.cidr)
        ) {
          issues.push({
            path: `${path}.ip`,
            message: `IP ${iface.ip} は ${network.cidr} の範囲外です`,
          });
        }
      }

      if (device.category === "service" && iface.ip) {
        issues.push({
          path: `${path}.ip`,
          message: "サービスカテゴリーのインターフェースIPはnullにしてください",
        });
      }

      const interfaceKey = `${device.hostname}\u0000${iface.name}`;
      if (interfaceKeys.has(interfaceKey)) {
        issues.push({
          path,
          message: `${device.hostname} のインターフェース ${iface.name} が重複しています`,
        });
      }
      interfaceKeys.add(interfaceKey);

      if (iface.ip) {
        const owner = ipOwners.get(iface.ip);
        if (owner) {
          issues.push({
            path: `${path}.ip`,
            message: `IP ${iface.ip} は ${owner} と重複しています`,
          });
        } else {
          ipOwners.set(iface.ip, device.hostname);
        }
      }
    });
  });

  const serviceBySubdomain = new Map(
    services.map((service) => [service.subdomain, service] as const),
  );
  const endpointDevice = (endpoint: LedgerRelationEndpoint) =>
    "service" in endpoint
      ? serviceBySubdomain.get(endpoint.service)?.device
      : endpoint.device;
  const endpointKey = (endpoint: LedgerRelationEndpoint) =>
    "service" in endpoint
      ? `service:${endpoint.service}`
      : `interface:${endpoint.device}\u0000${endpoint.interface}`;
  const relationKeys = new Set<string>();
  relations.forEach((relation, index) => {
    if (!relationNameByName.has(relation.relationName)) {
      issues.push({
        path: `relations[${index}].relationName`,
        message: `関係名「${relation.relationName}」が存在しません`,
      });
    }
    for (const field of ["from", "to"] as const) {
      const endpoint = relation[field];
      if ("service" in endpoint) {
        if (!serviceBySubdomain.has(endpoint.service)) {
          issues.push({
            path: `relations[${index}].${field}.service`,
            message: `サービス「${endpoint.service}」が存在しません`,
          });
        }
        continue;
      }
      if (!deviceByName.has(endpoint.device)) {
        issues.push({
          path: `relations[${index}].${field}.device`,
          message: `デバイス「${endpoint.device}」が存在しません`,
        });
      } else if (
        !interfaceKeys.has(`${endpoint.device}\u0000${endpoint.interface}`)
      ) {
        issues.push({
          path: `relations[${index}].${field}.interface`,
          message: `インターフェース「${endpoint.device} / ${endpoint.interface}」が存在しません`,
        });
      }
    }
    if (
      !("service" in relation.from) &&
      !("service" in relation.to) &&
      relation.from.device === relation.to.device
    ) {
      issues.push({
        path: `relations[${index}].to.device`,
        message: "同じデバイス自身へ関係は定義できません",
      });
    }
    if (
      endpointDevice(relation.from) !== undefined &&
      endpointDevice(relation.from) === endpointDevice(relation.to) &&
      "service" in relation.from &&
      "service" in relation.to &&
      relation.from.service === relation.to.service
    ) {
      issues.push({
        path: `relations[${index}].to.service`,
        message: "同じサービス自身へ関係は定義できません",
      });
    }
    const key = [
      relation.relationName,
      endpointKey(relation.from),
      endpointKey(relation.to),
      relation.fromLabel ?? "",
      relation.toLabel ?? "",
      relation.port ?? "",
      relation.protocol ?? "",
    ].join("\u0000");
    if (relationKeys.has(key)) {
      issues.push({
        path: `relations[${index}]`,
        message:
          "同じ関係名・始点・終点・ラベル・ポートの関係が重複しています",
      });
    } else {
      relationKeys.add(key);
    }
  });

  services.forEach((service, index) => {
    if (!deviceByName.has(service.device)) {
      issues.push({
        path: `services[${index}].device`,
        message: `デバイス「${service.device}」が存在しません`,
      });
    }
    if (
      !interfaceKeys.has(
        `${service.device}\u0000${service.interface}`,
      )
    ) {
      issues.push({
        path: `services[${index}]`,
        message:
          `${service.device} のインターフェース ${service.interface} が存在しません`,
      });
    }
  });

  const deviceKeyPairs = new Set<string>();
  deviceKeys.forEach((deviceKey, index) => {
    if (!deviceByName.has(deviceKey.device)) {
      issues.push({
        path: `deviceKeys[${index}].device`,
        message: `デバイス「${deviceKey.device}」が存在しません`,
      });
    }
    if (!sshKeyByPublicKey.has(deviceKey.publicKey)) {
      issues.push({
        path: `deviceKeys[${index}].publicKey`,
        message: "sshKeysに存在しない公開鍵です",
      });
    }
    const pair = `${deviceKey.device}\u0000${deviceKey.publicKey}`;
    if (deviceKeyPairs.has(pair)) {
      issues.push({
        path: `deviceKeys[${index}]`,
        message: "同じデバイスと公開鍵の紐付けが重複しています",
      });
    }
    deviceKeyPairs.add(pair);
  });

  if (issues.length > 0) {
    throw new LedgerValidationError(issues);
  }

  return {
    format: LEDGER_FORMAT,
    exportedAt: root.exportedAt as string,
    project: projectName,
    settings: {
      domain: textValue((root.settings as RecordValue).domain),
      title:
        textValue((root.settings as RecordValue).title) ||
        DEFAULT_PROJECT_TITLE,
      color:
        textValue((root.settings as RecordValue).color) ||
        projectColorFromName(projectName),
      properties: normalizeProperties(
        (root.settings as RecordValue).properties,
      ),
    },
    networks,
    devices,
    relationNames,
    relations,
    services,
    sshKeys,
    deviceKeys,
  };
}
