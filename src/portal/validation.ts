import {
  ACCENT_TONES,
  PORTAL_ICON_KEYS,
  PORTAL_SERVICE_SCHEMES,
  PORTAL_STATUSES,
  type AccentTone,
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceNetwork,
  type PortalIconKey,
  type PortalNetwork,
  type PortalRelation,
  type PortalService,
  type PortalServiceScheme,
  type PortalSshInfo,
  type PortalStatus,
  type ValidationIssue,
  type ValidationResult,
} from "./types";

interface Ipv4Parts {
  octets: [number, number, number, number];
  value: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function parseIpv4(value: string): Ipv4Parts | undefined {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    return undefined;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return undefined;
    }

    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return undefined;
    }
    octets.push(octet);
  }

  const typedOctets = octets as [number, number, number, number];
  const valueAsNumber =
    (((typedOctets[0] << 24) >>> 0) +
      (typedOctets[1] << 16) +
      (typedOctets[2] << 8) +
      typedOctets[3]) >>>
    0;

  return { octets: typedOctets, value: valueAsNumber };
}

export function isIpv4(value: string): boolean {
  return parseIpv4(value) !== undefined;
}

export function parseCidr(
  value: string,
): { address: Ipv4Parts; prefix: number; networkValue: number } | undefined {
  const [addressText, prefixText, ...rest] = value.trim().split("/");
  if (rest.length > 0 || !addressText || !prefixText) {
    return undefined;
  }

  if (!/^\d{1,2}$/.test(prefixText)) {
    return undefined;
  }

  const prefix = Number(prefixText);
  const address = parseIpv4(addressText);
  if (!address || prefix < 0 || prefix > 32) {
    return undefined;
  }

  const mask =
    prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const networkValue = (address.value & mask) >>> 0;

  return { address, prefix, networkValue };
}

export function isCidr(value: string): boolean {
  return parseCidr(value) !== undefined;
}

export function isIpWithinCidr(ip: string, cidr: string): boolean {
  const ipAddress = parseIpv4(ip);
  const parsedCidr = parseCidr(cidr);
  if (!ipAddress || !parsedCidr) {
    return false;
  }

  const mask =
    parsedCidr.prefix === 0
      ? 0
      : (0xffffffff << (32 - parsedCidr.prefix)) >>> 0;
  return ((ipAddress.value & mask) >>> 0) === parsedCidr.networkValue;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHttpPath(value: string): boolean {
  return value.trim().startsWith("/");
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function isAccent(value: unknown): value is AccentTone {
  return typeof value === "string" && ACCENT_TONES.includes(value as AccentTone);
}

function isIconKey(value: unknown): value is PortalIconKey {
  return (
    typeof value === "string" &&
    PORTAL_ICON_KEYS.includes(value as PortalIconKey)
  );
}

function isStatus(value: unknown): value is PortalStatus {
  return (
    typeof value === "string" &&
    PORTAL_STATUSES.includes(value as PortalStatus)
  );
}

function isScheme(value: unknown): value is PortalServiceScheme {
  return (
    typeof value === "string" &&
    PORTAL_SERVICE_SCHEMES.includes(value as PortalServiceScheme)
  );
}

function isPort(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65_535
  );
}

function isPercent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function validateNetwork(
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
  if (!isAccent(input.accent)) {
    issues.push({ path: `${path}.accent`, message: "アクセント色が不正です" });
  }
  return issues;
}

function validateDevice(
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
  if (typeof input.isVm !== "boolean") {
    issues.push({ path: `${path}.isVm`, message: "VMフラグが不正です" });
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
  return issues;
}

function validateDeviceNetwork(
  input: unknown,
  index: number,
): ValidationIssue[] {
  const path = `deviceNetworks[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "ネットワーク所属の形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.deviceId)) {
    issues.push({ path: `${path}.deviceId`, message: "デバイスIDは必須です" });
  }
  if (!isNonEmptyString(input.networkId)) {
    issues.push({
      path: `${path}.networkId`,
      message: "ネットワークIDは必須です",
    });
  }
  if (!isNonEmptyString(input.ip) || !isIpv4(input.ip)) {
    issues.push({ path: `${path}.ip`, message: "IPv4アドレスの形式が不正です" });
  }
  if (!isOptionalString(input.label)) {
    issues.push({ path: `${path}.label`, message: "ラベルが不正です" });
  }
  return issues;
}

function validateRelation(
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
  if (!isNonEmptyString(input.fromDeviceId)) {
    issues.push({
      path: `${path}.fromDeviceId`,
      message: "関係元デバイスIDは必須です",
    });
  }
  if (!isNonEmptyString(input.toDeviceId)) {
    issues.push({
      path: `${path}.toDeviceId`,
      message: "関係先デバイスIDは必須です",
    });
  }
  if (!isNonEmptyString(input.fromLabel)) {
    issues.push({
      path: `${path}.fromLabel`,
      message: "from側ラベルは必須です",
    });
  }
  if (!isNonEmptyString(input.toLabel)) {
    issues.push({
      path: `${path}.toLabel`,
      message: "to側ラベルは必須です",
    });
  }
  if (!isNonEmptyString(input.color) || !isHexColor(input.color)) {
    issues.push({
      path: `${path}.color`,
      message: "色は #RRGGBB 形式で指定してください",
    });
  }
  return issues;
}

function validateService(
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
  if (!isNonEmptyString(input.deviceNetworkId)) {
    issues.push({
      path: `${path}.deviceNetworkId`,
      message: "配置先IPは必須です",
    });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: `${path}.name`, message: "サービス名は必須です" });
  }
  if (typeof input.subtitle !== "string") {
    issues.push({ path: `${path}.subtitle`, message: "補足名が不正です" });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: `${path}.scheme`, message: "スキームが不正です" });
  }
  if (!isPort(input.port)) {
    issues.push({ path: `${path}.port`, message: "ポートが不正です" });
  }
  if (!isNonEmptyString(input.topPath) || !isHttpPath(input.topPath)) {
    issues.push({
      path: `${path}.topPath`,
      message: "トップパスは / から入力してください",
    });
  }
  if (
    !isNonEmptyString(input.monitorPath) ||
    !isHttpPath(input.monitorPath)
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
  if (!isStatus(input.status)) {
    issues.push({ path: `${path}.status`, message: "状態が不正です" });
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
    "deviceNetworks",
    "relations",
    "services",
  ]) {
    if (!Array.isArray(input[key])) {
      issues.push({ path: key, message: `${key}は配列で指定してください` });
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  const networks = input.networks as unknown[];
  const devices = input.devices as unknown[];
  const deviceNetworks = input.deviceNetworks as unknown[];
  const relations = input.relations as unknown[];
  const services = input.services as unknown[];

  networks.forEach((network, index) =>
    issues.push(...validateNetwork(network, index)),
  );
  devices.forEach((device, index) =>
    issues.push(...validateDevice(device, index)),
  );
  deviceNetworks.forEach((deviceNetwork, index) =>
    issues.push(...validateDeviceNetwork(deviceNetwork, index)),
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
    deviceNetworks: deviceNetworks as PortalDeviceNetwork[],
    relations: relations as PortalRelation[],
    services: services as PortalService[],
  };
  issues.push(...duplicateIssues(data.networks, "networks"));
  issues.push(...duplicateIssues(data.devices, "devices"));
  issues.push(...duplicateIssues(data.deviceNetworks, "deviceNetworks"));
  issues.push(...duplicateIssues(data.relations, "relations"));
  issues.push(...duplicateIssues(data.services, "services"));

  const networkById = new Map(
    data.networks.map((network) => [network.id, network]),
  );
  const deviceById = new Map(
    data.devices.map((device) => [device.id, device]),
  );
  const membershipById = new Map(
    data.deviceNetworks.map((membership) => [membership.id, membership]),
  );

  for (const membership of data.deviceNetworks) {
    const device = deviceById.get(membership.deviceId);
    if (!device) {
      issues.push({
        path: `deviceNetworks.${membership.id}.deviceId`,
        message: `デバイス「${membership.deviceId}」が存在しません`,
      });
    }

    const network = networkById.get(membership.networkId);
    if (!network) {
      issues.push({
        path: `deviceNetworks.${membership.id}.networkId`,
        message: `ネットワーク「${membership.networkId}」が存在しません`,
      });
      continue;
    }
    if (network.cidr && !isIpWithinCidr(membership.ip, network.cidr)) {
      issues.push({
        path: `deviceNetworks.${membership.id}.ip`,
        message: `IP ${membership.ip} は ${network.cidr} の範囲外です`,
      });
    }
  }

  const ipOwner = new Map<string, string>();
  for (const membership of data.deviceNetworks) {
    const owner = ipOwner.get(membership.ip);
    if (owner) {
      issues.push({
        path: `deviceNetworks.${membership.id}.ip`,
        message: `IP ${membership.ip} は ${owner} と重複しています`,
      });
    } else {
      ipOwner.set(membership.ip, membership.id);
    }
  }

  for (const device of data.devices) {
    if (
      !data.deviceNetworks.some(
        (membership) => membership.deviceId === device.id,
      )
    ) {
      issues.push({
        path: `devices.${device.id}.deviceNetworks`,
        message: "デバイスには1つ以上のネットワーク所属IPが必要です",
      });
    }
  }

  for (const relation of data.relations) {
    if (!deviceById.has(relation.fromDeviceId)) {
      issues.push({
        path: `relations.${relation.id}.fromDeviceId`,
        message: `デバイス「${relation.fromDeviceId}」が存在しません`,
      });
    }
    if (!deviceById.has(relation.toDeviceId)) {
      issues.push({
        path: `relations.${relation.id}.toDeviceId`,
        message: `デバイス「${relation.toDeviceId}」が存在しません`,
      });
    }
    if (relation.fromDeviceId === relation.toDeviceId) {
      issues.push({
        path: `relations.${relation.id}.toDeviceId`,
        message: "同じデバイス自身へ関係は定義できません",
      });
    }
  }

  for (const service of data.services) {
    if (!membershipById.has(service.deviceNetworkId)) {
      issues.push({
        path: `services.${service.id}.deviceNetworkId`,
        message: `配置先IP「${service.deviceNetworkId}」が存在しません`,
      });
    }
  }

  return issues.length > 0 ? { issues } : { value: data, issues: [] };
}

export function validateNetworkInput(
  input: Pick<PortalNetwork, "name" | "cidr" | "accent">,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "ネットワーク名を入力してください" });
  }

  const cidr = input.cidr?.trim();
  if (cidr && !isCidr(cidr)) {
    issues.push({ path: "cidr", message: "CIDRの形式が不正です" });
  }

  if (
    data.networks.some(
      (network) =>
        network.id !== editingId &&
        cidr &&
        network.cidr?.trim() === cidr,
    )
  ) {
    issues.push({ path: "cidr", message: "同じCIDRが登録されています" });
  }

  if (cidr && isCidr(cidr)) {
    const invalidMembership = data.deviceNetworks.find(
      (membership) =>
        membership.networkId === editingId &&
        !isIpWithinCidr(membership.ip, cidr),
    );
    if (invalidMembership) {
      issues.push({
        path: "cidr",
        message: `既存IP ${invalidMembership.ip} が範囲外になります`,
      });
    }
  }

  return issues;
}

export function validateDeviceInput(
  input: Pick<PortalDevice, "name" | "isVm" | "ssh" | "resources">,
  editingId: string | undefined,
  data: PortalDataV2,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "デバイス名を入力してください" });
  }

  const candidate = {
    id: editingId ?? "__candidate__",
    ...input,
  };
  issues.push(...validateDevice(candidate, 0).filter((issue) =>
    !issue.message.includes("ID"),
  ));

  if (
    data.devices.some(
      (device) =>
        device.id !== editingId &&
        device.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    )
  ) {
    issues.push({
      path: "name",
      message: "同じ名前のデバイスが登録されています",
    });
  }
  return issues;
}

export function validateDeviceNetworkInput(
  input: Pick<PortalDeviceNetwork, "networkId" | "ip">,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const network = data.networks.find(
    (item) => item.id === input.networkId,
  );
  if (!network) {
    issues.push({
      path: "networkId",
      message: "所属ネットワークを選択してください",
    });
  }
  if (!isIpv4(input.ip)) {
    issues.push({ path: "ip", message: "IPv4アドレスの形式が不正です" });
  }
  if (
    data.deviceNetworks.some(
      (membership) =>
        membership.id !== editingId && membership.ip === input.ip.trim(),
    )
  ) {
    issues.push({ path: "ip", message: "同じIPが登録されています" });
  }
  if (
    network?.cidr &&
    isIpv4(input.ip) &&
    !isIpWithinCidr(input.ip, network.cidr)
  ) {
    issues.push({
      path: "ip",
      message: `IPは ${network.cidr} の範囲内で入力してください`,
    });
  }
  return issues;
}

export function validateRelationInput(
  input: Pick<
    PortalRelation,
    "fromDeviceId" | "toDeviceId" | "fromLabel" | "toLabel" | "color"
  >,
  data: PortalDataV2,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!data.devices.some((device) => device.id === input.fromDeviceId)) {
    issues.push({
      path: "fromDeviceId",
      message: "関係元デバイスを選択してください",
    });
  }
  if (!data.devices.some((device) => device.id === input.toDeviceId)) {
    issues.push({
      path: "toDeviceId",
      message: "関係先デバイスを選択してください",
    });
  }
  if (input.fromDeviceId === input.toDeviceId) {
    issues.push({
      path: "toDeviceId",
      message: "同じデバイス自身へ関係は定義できません",
    });
  }
  if (!input.fromLabel.trim()) {
    issues.push({
      path: "fromLabel",
      message: "from側ラベルを入力してください",
    });
  }
  if (!input.toLabel.trim()) {
    issues.push({
      path: "toLabel",
      message: "to側ラベルを入力してください",
    });
  }
  if (!isHexColor(input.color)) {
    issues.push({
      path: "color",
      message: "関係色は #RRGGBB 形式で指定してください",
    });
  }
  return issues;
}

export function validateServiceInput(
  input: Pick<
    PortalService,
    | "name"
    | "deviceNetworkId"
    | "scheme"
    | "port"
    | "topPath"
    | "monitorPath"
    | "serviceUrl"
    | "iconKey"
    | "status"
  >,
  data: PortalDataV2,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "サービス名を入力してください" });
  }
  if (
    !data.deviceNetworks.some(
      (membership) => membership.id === input.deviceNetworkId,
    )
  ) {
    issues.push({
      path: "deviceNetworkId",
      message: "配置先のデバイスIPを選択してください",
    });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: "scheme", message: "スキームを選択してください" });
  }
  if (!isPort(input.port)) {
    issues.push({
      path: "port",
      message: "ポートは1〜65535で入力してください",
    });
  }
  if (!isHttpPath(input.topPath)) {
    issues.push({
      path: "topPath",
      message: "トップパスは / から入力してください",
    });
  }
  if (!isHttpPath(input.monitorPath)) {
    issues.push({
      path: "monitorPath",
      message: "監視パスは / から入力してください",
    });
  }
  if (input.serviceUrl && !isHttpUrl(input.serviceUrl)) {
    issues.push({
      path: "serviceUrl",
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
  }
  if (!isIconKey(input.iconKey)) {
    issues.push({ path: "iconKey", message: "アイコンを選択してください" });
  }
  if (!isStatus(input.status)) {
    issues.push({ path: "status", message: "状態を選択してください" });
  }
  return issues;
}

export function issuesToRecord(
  issues: ValidationIssue[],
): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [issue.path, issue.message]));
}

export function generateId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}
