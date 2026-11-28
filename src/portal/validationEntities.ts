import type {
  PortalDataV2,
  PortalDevice,
  PortalInterface,
  PortalNetwork,
  PortalProject,
  PortalRelation,
  PortalRelationName,
  PortalService,
  PortalSettings,
  ValidationIssue,
  ValidationResult,
} from "./types";
import {
  isDeviceCategory,
  isIconKey,
  isNonEmptyString,
  isOptionalString,
  isPercent,
  isPort,
  isProtocol,
  isRecord,
  isScheme,
  isStatus,
  MAX_RELATION_LABEL_LENGTH,
  relationPortIssues,
} from "./validationCore";
import {
  accentColorIssue,
  isCidr,
  isHttpPath,
  isHttpUrl,
  isIpWithinCidr,
  isIpv4,
  isLineEndpointShape,
  relationColorIssue,
} from "./validationFormats";
import {
  validatePropertiesPayload,
  validateSettingsTitle,
} from "./validationProperties";

export function validateNetwork(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `networks[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "ネットワークの形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: `${path}.name`, message: "ネットワーク名は必須です" });
  }
  if (input.cidr !== undefined && input.cidr !== "") {
    if (!isNonEmptyString(input.cidr) || !isCidr(input.cidr)) {
      issues.push({ path: `${path}.cidr`, message: "CIDRの形式が不正です" });
    }
  }
  const accentIssue = accentColorIssue(input.accent, `${path}.accent`);
  if (accentIssue) {
    issues.push(accentIssue);
  }
  if (input.properties !== undefined) {
    issues.push(
      ...validatePropertiesPayload(input.properties, `${path}.properties`),
    );
  }
  return issues;
}

export function validateDevice(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `devices[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "デバイスの形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: `${path}.name`, message: "デバイス名は必須です" });
  }
  if (
    input.petname !== undefined &&
    input.petname !== null &&
    typeof input.petname !== "string"
  ) {
    issues.push({ path: `${path}.petname`, message: "名前が不正です" });
  }
  if (!isDeviceCategory(input.category)) {
    issues.push({
      path: `${path}.category`,
      message: "デバイスカテゴリーが不正です",
    });
  }
  if (input.ssh !== undefined) {
    if (!isRecord(input.ssh) || !isNonEmptyString(input.ssh.user)) {
      issues.push({ path: `${path}.ssh.user`, message: "SSHユーザーが不正です" });
    }
    if (!isRecord(input.ssh) || !isPort(input.ssh.port)) {
      issues.push({ path: `${path}.ssh.port`, message: "SSHポートが不正です" });
    }
  }
  if (input.resources !== undefined) {
    if (
      !isRecord(input.resources) ||
      !isPercent(input.resources.memoryPercent)
    ) {
      issues.push({
        path: `${path}.resources.memoryPercent`,
        message: "メモリ使用率は0〜100で指定してください",
      });
    }
    if (
      !isRecord(input.resources) ||
      !isPercent(input.resources.diskPercent)
    ) {
      issues.push({
        path: `${path}.resources.diskPercent`,
        message: "ディスク使用率は0〜100で指定してください",
      });
    }
  }
  if (input.properties !== undefined) {
    issues.push(
      ...validatePropertiesPayload(input.properties, `${path}.properties`),
    );
  }
  return issues;
}

export function validateInterface(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `interfaces[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "インターフェースの形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.deviceId)) {
    issues.push({ path: `${path}.deviceId`, message: "デバイスIDは必須です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({
      path: `${path}.name`,
      message: "インターフェース名は必須です",
    });
  }
  if (
    input.networkId !== null &&
    input.networkId !== undefined &&
    !isNonEmptyString(input.networkId)
  ) {
    issues.push({
      path: `${path}.networkId`,
      message: "ネットワークIDが不正です",
    });
  }
  if (
    typeof input.ip !== "string" ||
    (input.ip.trim() !== "" && !isIpv4(input.ip))
  ) {
    issues.push({ path: `${path}.ip`, message: "IPv4アドレスの形式が不正です" });
  }
  if (!isOptionalString(input.label)) {
    issues.push({ path: `${path}.label`, message: "ラベルが不正です" });
  }
  return issues;
}

export function validateRelation(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `relations[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "関係の形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  for (const side of ["from", "to"] as const) {
    const sideLabel = side === "from" ? "関係元" : "関係先";
    const interfaceId = input[`${side}InterfaceId`];
    const serviceId = input[`${side}ServiceId`];
    const hasInterface = interfaceId !== undefined && interfaceId !== null;
    const hasService = serviceId !== undefined && serviceId !== null;
    if (hasInterface && !isNonEmptyString(interfaceId)) {
      issues.push({
        path: `${path}.${side}InterfaceId`,
        message: `${sideLabel}インターフェースIDが不正です`,
      });
    }
    if (hasService && !isNonEmptyString(serviceId)) {
      issues.push({
        path: `${path}.${side}ServiceId`,
        message: `${sideLabel}サービスIDが不正です`,
      });
    }
    if (hasInterface && hasService) {
      issues.push({
        path: `${path}.${side}ServiceId`,
        message: `${sideLabel}の端点はインターフェースかサービスのどちらか一方です`,
      });
    }
    if (!hasInterface && !hasService) {
      issues.push({
        path: `${path}.${side}InterfaceId`,
        message: `${sideLabel}の端点は必須です`,
      });
    }
  }
  if (!isNonEmptyString(input.relationName)) {
    issues.push({
      path: `${path}.relationName`,
      message: "関係名は必須です",
    });
  }
  if (typeof input.fromLabel !== "string") {
    issues.push({ path: `${path}.fromLabel`, message: "始点ラベルが不正です" });
  } else if ([...input.fromLabel.trim()].length > MAX_RELATION_LABEL_LENGTH) {
    issues.push({
      path: `${path}.fromLabel`,
      message: `ラベルは${MAX_RELATION_LABEL_LENGTH}文字以内で入力してください`,
    });
  }
  if (typeof input.toLabel !== "string") {
    issues.push({ path: `${path}.toLabel`, message: "終点ラベルが不正です" });
  } else if ([...input.toLabel.trim()].length > MAX_RELATION_LABEL_LENGTH) {
    issues.push({
      path: `${path}.toLabel`,
      message: `ラベルは${MAX_RELATION_LABEL_LENGTH}文字以内で入力してください`,
    });
  }
  const colorIssue = relationColorIssue(input.color, `${path}.color`);
  if (colorIssue) {
    issues.push(colorIssue);
  }
  issues.push(
    ...relationPortIssues(
      input.port,
      input.protocol,
      `${path}.port`,
      `${path}.protocol`,
    ),
  );
  if (input.properties !== undefined) {
    issues.push(
      ...validatePropertiesPayload(input.properties, `${path}.properties`),
    );
  }
  return issues;
}

export function validateRelationName(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `relationNames[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "関係名の形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: `${path}.name`, message: "関係名は必須です" });
  }
  const colorIssue = relationColorIssue(input.color, `${path}.color`);
  if (colorIssue) {
    issues.push(colorIssue);
  }
  if (!isLineEndpointShape(input.lineStart)) {
    issues.push({
      path: `${path}.lineStart`,
      message: "始点の形が不正です",
    });
  }
  if (!isLineEndpointShape(input.lineEnd)) {
    issues.push({
      path: `${path}.lineEnd`,
      message: "終点の形が不正です",
    });
  }
  if (
    typeof input.relationCount !== "number" ||
    !Number.isInteger(input.relationCount) ||
    input.relationCount < 0
  ) {
    issues.push({
      path: `${path}.relationCount`,
      message: "使用件数が不正です",
    });
  }
  return issues;
}

export function validateService(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `services[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "サービスの形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.interfaceId)) {
    issues.push({
      path: `${path}.interfaceId`,
      message: "配置先インターフェースは必須です",
    });
  }
  if (!isNonEmptyString(input.subdomain)) {
    issues.push({
      path: `${path}.subdomain`,
      message: "サブドメインは必須です",
    });
  }
  if (input.petname !== undefined && input.petname !== null && typeof input.petname !== "string") {
    issues.push({ path: `${path}.petname`, message: "名前が不正です" });
  }
  if (
    input.description !== undefined &&
    input.description !== null &&
    typeof input.description !== "string"
  ) {
    issues.push({ path: `${path}.description`, message: "説明が不正です" });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: `${path}.scheme`, message: "スキームが不正です" });
  }
  if (!isPort(input.port)) {
    issues.push({ path: `${path}.port`, message: "ポートが不正です" });
  }
  if (!isProtocol(input.protocol)) {
    issues.push({ path: `${path}.protocol`, message: "プロトコルが不正です" });
  }
  if (
    typeof input.topPath !== "string" ||
    (input.topPath.trim() !== "" && !isHttpPath(input.topPath))
  ) {
    issues.push({
      path: `${path}.topPath`,
      message: "トップパスは / から入力してください",
    });
  }
  if (
    typeof input.monitorPath !== "string" ||
    (input.monitorPath.trim() !== "" && !isHttpPath(input.monitorPath))
  ) {
    issues.push({
      path: `${path}.monitorPath`,
      message: "監視パスは / から入力してください",
    });
  }
  if (
    input.serviceUrl !== undefined &&
    input.serviceUrl !== "" &&
    (!isNonEmptyString(input.serviceUrl) || !isHttpUrl(input.serviceUrl))
  ) {
    issues.push({
      path: `${path}.serviceUrl`,
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
  }
  if (!isIconKey(input.iconKey)) {
    issues.push({ path: `${path}.iconKey`, message: "アイコンが不正です" });
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({ path: `${path}.enabled`, message: "有効フラグが不正です" });
  }
  if (input.properties !== undefined) {
    issues.push(
      ...validatePropertiesPayload(input.properties, `${path}.properties`),
    );
  }
  return issues;
}

function duplicateIssues(
  items: Array<{ id: string }>,
  collection: string,
): ValidationIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }
    seen.add(item.id);
  }

  return [...duplicates].map((id) => ({
    path: collection,
    message: `ID「${id}」が重複しています`,
  }));
}

export function validatePortalData(
  input: unknown,
): ValidationResult<PortalDataV2> {
  if (!isRecord(input)) {
    return {
      issues: [{ path: "root", message: "ポータルデータがオブジェクトではありません" }],
    };
  }

  const issues: ValidationIssue[] = [];
  if (input.version !== 2) {
    issues.push({ path: "version", message: "versionは2である必要があります" });
  }
  for (const key of [
    "networks",
    "devices",
    "interfaces",
    "relationNames",
    "relations",
    "services",
  ]) {
    if (!Array.isArray(input[key])) {
      issues.push({ path: key, message: `${key}は配列で指定してください` });
    }
  }
  if (input.settings !== undefined) {
    if (!isRecord(input.settings)) {
      issues.push({
        path: "settings",
        message: "settingsはオブジェクトで指定してください",
      });
    } else {
      if (!isNonEmptyString(input.settings.domain)) {
        issues.push({
          path: "settings.domain",
          message: "ドメイン名を入力してください",
        });
      }
      if (typeof input.settings.title !== "string") {
        issues.push({
          path: "settings.title",
          message: "ポータルタイトルを文字列で入力してください",
        });
      } else {
        issues.push(
          ...validateSettingsTitle(input.settings.title).map((issue) => ({
            ...issue,
            path: `settings.${issue.path}`,
          })),
        );
      }
    }
  }

  if (input.projects !== undefined) {
    if (!Array.isArray(input.projects)) {
      issues.push({
        path: "projects",
        message: "projectsは配列で指定してください",
      });
    } else {
      input.projects.forEach((project, index) => {
        const path = `projects[${index}]`;
        if (!isRecord(project)) {
          issues.push({ path, message: "プロジェクトの形式が不正です" });
          return;
        }
        if (!isNonEmptyString(project.id)) {
          issues.push({ path: `${path}.id`, message: "IDは必須です" });
        }
        if (!isNonEmptyString(project.name)) {
          issues.push({
            path: `${path}.name`,
            message: "プロジェクト名は必須です",
          });
        }
        if (typeof project.title !== "string") {
          issues.push({
            path: `${path}.title`,
            message: "タイトルが不正です",
          });
        }
        const colorIssue = accentColorIssue(project.color, `${path}.color`);
        if (colorIssue) {
          issues.push({
            path: `${path}.color`,
            message: "プロジェクトの色が不正です",
          });
        }
        if (project.properties !== undefined) {
          issues.push(
            ...validatePropertiesPayload(
              project.properties,
              `${path}.properties`,
            ),
          );
        }
      });
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  const networks = input.networks as unknown[];
  const devices = input.devices as unknown[];
  const interfaces = input.interfaces as unknown[];
  const relationNames = input.relationNames as unknown[];
  const relations = input.relations as unknown[];
  const services = input.services as unknown[];

  networks.forEach((network, index) =>
    issues.push(...validateNetwork(network, index)),
  );
  devices.forEach((device, index) =>
    issues.push(...validateDevice(device, index)),
  );
  interfaces.forEach((iface, index) =>
    issues.push(...validateInterface(iface, index)),
  );
  relationNames.forEach((relationName, index) =>
    issues.push(...validateRelationName(relationName, index)),
  );
  relations.forEach((relation, index) =>
    issues.push(...validateRelation(relation, index)),
  );
  services.forEach((service, index) =>
    issues.push(...validateService(service, index)),
  );

  if (issues.length > 0) {
    return { issues };
  }

  const data: PortalDataV2 = {
    version: 2,
    networks: networks as PortalNetwork[],
    devices: devices as PortalDevice[],
    interfaces: interfaces as PortalInterface[],
    relationNames: relationNames as PortalRelationName[],
    relations: relations as PortalRelation[],
    services: services as PortalService[],
    ...(input.settings !== undefined
      ? { settings: input.settings as unknown as PortalSettings }
      : {}),
    ...(Array.isArray(input.projects)
      ? { projects: input.projects as PortalProject[] }
      : {}),
  };
  issues.push(...duplicateIssues(data.networks, "networks"));
  issues.push(...duplicateIssues(data.devices, "devices"));
  issues.push(...duplicateIssues(data.interfaces, "interfaces"));
  issues.push(...duplicateIssues(data.relationNames, "relationNames"));
  issues.push(...duplicateIssues(data.relations, "relations"));
  issues.push(...duplicateIssues(data.services, "services"));

  const networkById = new Map(
    data.networks.map((network) => [network.id, network]),
  );
  const deviceById = new Map(
    data.devices.map((device) => [device.id, device]),
  );
  const interfaceById = new Map(
    data.interfaces.map((iface) => [iface.id, iface]),
  );
  for (const iface of data.interfaces) {
    const device = deviceById.get(iface.deviceId);
    if (!device) {
      issues.push({
        path: `interfaces.${iface.id}.deviceId`,
        message: `デバイス「${iface.deviceId}」が存在しません`,
      });
    }

    if (iface.networkId !== null && iface.networkId !== undefined) {
      const network = networkById.get(iface.networkId);
      if (!network) {
        issues.push({
          path: `interfaces.${iface.id}.networkId`,
          message: `ネットワーク「${iface.networkId}」が存在しません`,
        });
      } else if (
        network.cidr &&
        iface.ip &&
        !isIpWithinCidr(iface.ip, network.cidr)
      ) {
        issues.push({
          path: `interfaces.${iface.id}.ip`,
          message: `IP ${iface.ip} は ${network.cidr} の範囲外です`,
        });
      }
    }
  }

  const ipOwner = new Map<string, string>();
  for (const iface of data.interfaces) {
    if (!iface.ip) {
      continue;
    }
    const owner = ipOwner.get(iface.ip);
    if (owner) {
      issues.push({
        path: `interfaces.${iface.id}.ip`,
        message: `IP ${iface.ip} は ${owner} と重複しています`,
      });
    } else {
      ipOwner.set(iface.ip, iface.id);
    }
  }

  for (const device of data.devices) {
    if (!data.interfaces.some((iface) => iface.deviceId === device.id)) {
      issues.push({
        path: `devices.${device.id}.interfaces`,
        message: "デバイスには1つ以上のインターフェースが必要です",
      });
    }
  }

  const relationNameIds = new Set<string>();
  const relationNameNames = new Set<string>();
  for (const relationName of data.relationNames) {
    if (relationNameNames.has(relationName.name)) {
      issues.push({
        path: `relationNames.${relationName.id}.name`,
        message: `関係名「${relationName.name}」が重複しています`,
      });
    }
    relationNameIds.add(relationName.id);
    relationNameNames.add(relationName.name);
  }
  const serviceById = new Map(
    data.services.map((service) => [service.id, service] as const),
  );
  const relationKeys = new Set<string>();
  for (const relation of data.relations) {
    if (!relationNameIds.has(relation.relationNameId)) {
      issues.push({
        path: `relations.${relation.id}.relationName`,
        message: `関係名「${relation.relationName}」が存在しません`,
      });
    } else if (!relationNameNames.has(relation.relationName)) {
      issues.push({
        path: `relations.${relation.id}.relationName`,
        message: "関係名の参照と名前が一致しません",
      });
    }
    const endpointKey = (
      interfaceId: string | null,
      serviceId: string | null,
    ) => (serviceId ? `service:${serviceId}` : `interface:${interfaceId}`);
    const key = [
      relation.relationNameId,
      endpointKey(relation.fromInterfaceId, relation.fromServiceId),
      endpointKey(relation.toInterfaceId, relation.toServiceId),
      (relation.fromLabel ?? "").trim(),
      (relation.toLabel ?? "").trim(),
      relation.port ?? "",
      relation.protocol ?? "",
    ].join("\u0000");
    if (relationKeys.has(key)) {
      issues.push({
        path: `relations.${relation.id}`,
        message:
          "同じ関係名・始点・終点・ラベル・ポートの関係が重複しています",
      });
    } else {
      relationKeys.add(key);
    }

    const resolveEndpoint = (
      side: "from" | "to",
    ): { deviceId?: string; isInterface: boolean } => {
      const interfaceId = relation[`${side}InterfaceId`];
      const serviceId = relation[`${side}ServiceId`];
      if (serviceId) {
        const service = serviceById.get(serviceId);
        if (!service) {
          issues.push({
            path: `relations.${relation.id}.${side}ServiceId`,
            message: `サービス「${serviceId}」が存在しません`,
          });
          return { isInterface: false };
        }
        return {
          deviceId: interfaceById.get(service.interfaceId)?.deviceId,
          isInterface: false,
        };
      }
      const iface = interfaceId ? interfaceById.get(interfaceId) : undefined;
      if (!iface) {
        issues.push({
          path: `relations.${relation.id}.${side}InterfaceId`,
          message: `インターフェース「${interfaceId}」が存在しません`,
        });
        return { isInterface: true };
      }
      return { deviceId: iface.deviceId, isInterface: true };
    };
    const fromEndpoint = resolveEndpoint("from");
    const toEndpoint = resolveEndpoint("to");
    if (
      fromEndpoint.isInterface &&
      toEndpoint.isInterface &&
      fromEndpoint.deviceId !== undefined &&
      fromEndpoint.deviceId === toEndpoint.deviceId
    ) {
      issues.push({
        path: `relations.${relation.id}.toInterfaceId`,
        message: "同じデバイス自身へ関係は定義できません",
      });
    }
  }

  for (const service of data.services) {
    if (!interfaceById.has(service.interfaceId)) {
      issues.push({
        path: `services.${service.id}.interfaceId`,
        message: `配置先インターフェース「${service.interfaceId}」が存在しません`,
      });
    }
  }

  return issues.length > 0 ? { issues } : { value: data, issues: [] };
}
