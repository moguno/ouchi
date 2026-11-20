import {
  ACCENT_TONES,
  PORTAL_ICON_KEYS,
  PORTAL_STATUSES,
  type AccentTone,
  type PortalDataV1,
  type PortalIconKey,
  type PortalDevice,
  type PortalNetwork,
  type PortalService,
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

function validateDevice(input: unknown, index: number): ValidationIssue[] {
  const path = `devices[${index}]`;
  if (!isRecord(input)) {
    return [{ path, message: "デバイスの形式が不正です" }];
  }

  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.id)) {
    issues.push({ path: `${path}.id`, message: "IDは必須です" });
  }
  if (!isNonEmptyString(input.networkId)) {
    issues.push({ path: `${path}.networkId`, message: "ネットワークは必須です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: `${path}.name`, message: "デバイス名は必須です" });
  }
  if (!isNonEmptyString(input.ip) || !isIpv4(input.ip)) {
    issues.push({ path: `${path}.ip`, message: "IPv4アドレスの形式が不正です" });
  }
  if (typeof input.isVm !== "boolean") {
    issues.push({ path: `${path}.isVm`, message: "VMフラグが不正です" });
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
  if (!isNonEmptyString(input.deviceId)) {
    issues.push({ path: `${path}.deviceId`, message: "デバイスは必須です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: `${path}.name`, message: "サービス名は必須です" });
  }
  if (typeof input.subtitle !== "string") {
    issues.push({ path: `${path}.subtitle`, message: "補足名が不正です" });
  }
  if (!isNonEmptyString(input.url) || !isHttpUrl(input.url)) {
    issues.push({
      path: `${path}.url`,
      message: "HTTPまたはHTTPSのURLを入力してください",
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
): ValidationResult<PortalDataV1> {
  if (!isRecord(input)) {
    return {
      issues: [{ path: "root", message: "ポータルデータがオブジェクトではありません" }],
    };
  }

  const issues: ValidationIssue[] = [];
  if (input.version !== 1) {
    issues.push({ path: "version", message: "versionは1である必要があります" });
  }
  if (!Array.isArray(input.networks)) {
    issues.push({ path: "networks", message: "networksは配列で指定してください" });
  }
  if (!Array.isArray(input.devices)) {
    issues.push({
      path: "devices",
      message: "devicesは配列で指定してください",
    });
  }
  if (!Array.isArray(input.services)) {
    issues.push({ path: "services", message: "servicesは配列で指定してください" });
  }

  if (issues.length > 0) {
    return { issues };
  }

  const networks = input.networks as unknown[];
  const devices = input.devices as unknown[];
  const services = input.services as unknown[];

  networks.forEach((network, index) =>
    issues.push(...validateNetwork(network, index)),
  );
  devices.forEach((device, index) =>
    issues.push(...validateDevice(device, index)),
  );
  services.forEach((service, index) =>
    issues.push(...validateService(service, index)),
  );

  if (issues.length > 0) {
    return { issues };
  }

  const data: PortalDataV1 = {
    version: 1,
    networks: networks as PortalNetwork[],
    devices: devices as PortalDevice[],
    services: services as PortalService[],
  };
  issues.push(...duplicateIssues(data.networks, "networks"));
  issues.push(...duplicateIssues(data.devices, "devices"));
  issues.push(...duplicateIssues(data.services, "services"));

  const networkById = new Map(data.networks.map((network) => [network.id, network]));
  for (const device of data.devices) {
    const network = networkById.get(device.networkId);
    if (!network) {
      issues.push({
        path: `devices.${device.id}.networkId`,
        message: `ネットワーク「${device.networkId}」が存在しません`,
      });
      continue;
    }

    if (network.cidr && !isIpWithinCidr(device.ip, network.cidr)) {
      issues.push({
        path: `devices.${device.id}.ip`,
        message: `IP ${device.ip} は ${network.cidr} の範囲外です`,
      });
    }
  }

  const ipOwner = new Map<string, string>();
  for (const device of data.devices) {
    const owner = ipOwner.get(device.ip);
    if (owner) {
      issues.push({
        path: `devices.${device.id}.ip`,
        message: `IP ${device.ip} は ${owner} と重複しています`,
      });
    } else {
      ipOwner.set(device.ip, device.name);
    }
  }

  const deviceIds = new Set(data.devices.map((device) => device.id));
  for (const service of data.services) {
    if (!deviceIds.has(service.deviceId)) {
      issues.push({
        path: `services.${service.id}.deviceId`,
        message: `デバイス「${service.deviceId}」が存在しません`,
      });
    }
  }

  return issues.length > 0 ? { issues } : { value: data, issues: [] };
}

export function validateNetworkInput(
  input: Pick<PortalNetwork, "name" | "cidr" | "accent">,
  data: PortalDataV1,
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
    const invalidDevice = data.devices.find(
      (device) =>
        device.networkId === editingId &&
        !isIpWithinCidr(device.ip, cidr),
    );
    if (invalidDevice) {
      issues.push({
        path: "cidr",
        message: `既存のデバイス ${invalidDevice.name}（${invalidDevice.ip}）が範囲外になります`,
      });
    }
  }

  return issues;
}

export function validateDeviceInput(
  input: Pick<PortalDevice, "name" | "ip" | "networkId" | "isVm">,
  data: PortalDataV1,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "デバイス名を入力してください" });
  }

  if (!isIpv4(input.ip)) {
    issues.push({ path: "ip", message: "IPv4アドレスの形式が不正です" });
  }

  if (
    data.devices.some(
      (device) =>
        device.id !== editingId && device.ip === input.ip.trim(),
    )
  ) {
    issues.push({ path: "ip", message: "同じIPが登録されています" });
  }

  const network = data.networks.find((item) => item.id === input.networkId);
  if (!network) {
    issues.push({
      path: "networkId",
      message: "所属ネットワークを選択してください",
    });
  } else if (
    network.cidr &&
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

export function validateServiceInput(
  input: Pick<
    PortalService,
    "name" | "url" | "deviceId" | "iconKey" | "status"
  >,
  data: PortalDataV1,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.name.trim()) {
    issues.push({ path: "name", message: "サービス名を入力してください" });
  }
  if (!isHttpUrl(input.url)) {
    issues.push({
      path: "url",
      message: "HTTPまたはHTTPSのURLを入力してください",
    });
  }
  if (!data.devices.some((device) => device.id === input.deviceId)) {
    issues.push({
      path: "deviceId",
      message: "配置先のデバイスを選択してください",
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
