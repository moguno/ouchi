import {
  ACCENT_TONES,
  PORTAL_DEVICE_CATEGORIES,
  PORTAL_SERVICE_SCHEMES,
  PORTAL_STATUSES,
  type AccentTone,
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalDeviceNetwork,
  type PortalNetwork,
  type PortalProperties,
  type PortalRelation,
  type PortalRelationName,
  type PortalRelationNameInput,
  type PortalService,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type PortalSettings,
  type PortalSshInfo,
  type PortalStatus,
  type ValidationIssue,
  type ValidationResult,
} from "./types";
import { isIconReference } from "./iconCatalog";

export const DEFAULT_PORTAL_TITLE = "あなたのホームラボ";
export const MAX_PORTAL_TITLE_LENGTH = 100;
export const MAX_RELATION_PLACEHOLDER_LENGTH = 100;
export const MAX_PROPERTY_KEY_LENGTH = 128;
export const MAX_PROPERTY_VALUE_BYTES = 64 * 1024;
export const PLAINTEXT_SECRET_WARNING =
  "平文の秘密情報は入力しないこと。必要な場合は SOPS などで暗号化した文字列を入れること";

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

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Shared validation for device/service property maps. The REST boundary,
 * YAML import and GUI all use this function so their limits stay aligned.
 */
export function validatePropertiesPayload(
  value: unknown,
  path = "properties",
): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: "プロパティは文字列マップで指定してください" }];
  }
  return validatePropertyEntries(Object.entries(value), path);
}

export function validatePropertyEntries(
  entries: Iterable<readonly [string, unknown]>,
  path = "properties",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const normalizedKeys = new Map<string, string>();
  for (const [rawKey, propertyValue] of entries) {
    const key = rawKey.trim();
    if (!key) {
      issues.push({
        path: `${path}.${rawKey}`,
        message: "プロパティキーは空白除去後に必須です",
      });
    } else if ([...key].length > MAX_PROPERTY_KEY_LENGTH) {
      issues.push({
        path: `${path}.${rawKey}`,
        message:
          `プロパティキーは${MAX_PROPERTY_KEY_LENGTH}文字以内で入力してください`,
      });
    }

    const previousKey = normalizedKeys.get(key);
    if (key && previousKey !== undefined) {
      issues.push({
        path: `${path}.${rawKey}`,
        message:
          `プロパティキー「${key}」が重複しています` +
          `（前後の空白を除去すると同じキー: ${previousKey}）`,
      });
    } else if (key) {
      normalizedKeys.set(key, rawKey);
    }

    if (typeof propertyValue !== "string") {
      issues.push({
        path: `${path}.${rawKey}`,
        message: "プロパティ値は文字列で入力してください",
      });
    } else if (utf8ByteLength(propertyValue) > MAX_PROPERTY_VALUE_BYTES) {
      issues.push({
        path: `${path}.${rawKey}`,
        message: "プロパティ値は64KiB以内で入力してください",
      });
    }
  }
  return issues;
}

/**
 * Return a detached, key-trimmed string map. Validation must run before using
 * this function; invalid/non-string entries are ignored defensively here.
 */
export function normalizeProperties(value: unknown): PortalProperties {
  if (!isRecord(value)) {
    return {};
  }
  const entries: Array<[string, string]> = [];
  for (const [rawKey, propertyValue] of Object.entries(value)) {
    const key = rawKey.trim();
    if (key && typeof propertyValue === "string") {
      entries.push([key, propertyValue]);
    }
  }
  return Object.fromEntries(entries);
}

export function validateSettingsTitle(title: string): ValidationIssue[] {
  const normalized = title.trim();
  const issues: ValidationIssue[] = [];
  if (!normalized) {
    issues.push({ path: "title", message: "ポータルタイトルを入力してください" });
  }
  if (/[\r\n]/.test(title)) {
    issues.push({
      path: "title",
      message: "ポータルタイトルに改行は使用できません",
    });
  }
  if ([...normalized].length > MAX_PORTAL_TITLE_LENGTH) {
    issues.push({
      path: "title",
      message: `ポータルタイトルは${MAX_PORTAL_TITLE_LENGTH}文字以内で入力してください`,
    });
  }
  return issues;
}

export function validateSettingsPayload(
  input: unknown,
): ValidationIssue[] {
  if (!isRecord(input) || typeof input.title !== "string") {
    return [
      {
        path: "title",
        message: "ポータルタイトルを文字列で入力してください",
      },
    ];
  }
  return validateSettingsTitle(input.title);
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

function relationColorIssue(
  value: unknown,
  path: string,
): ValidationIssue | undefined {
  if (!isNonEmptyString(value)) {
    return { path, message: "関係色は必須です" };
  }
  if ([...value.trim()].length > 100) {
    return { path, message: "関係色は100文字以内で入力してください" };
  }
  return undefined;
}

function relationPlaceholderIssues(
  input: Record<string, unknown>,
  path = "",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of ["fromPlaceholder", "toPlaceholder"] as const) {
    const value = input[field];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "string") {
      issues.push({
        path: `${path}${field}`,
        message:
          field === "fromPlaceholder"
            ? "始点プレースホルダーが不正です"
            : "終点プレースホルダーが不正です",
      });
    } else if ([...value.trim()].length > MAX_RELATION_PLACEHOLDER_LENGTH) {
      issues.push({
        path: `${path}${field}`,
        message:
          `プレースホルダーは${MAX_RELATION_PLACEHOLDER_LENGTH}文字以内で` +
          "入力してください",
      });
    }
  }
  return issues;
}

export function isAccent(value: unknown): value is AccentTone {
  return typeof value === "string" && ACCENT_TONES.includes(value as AccentTone);
}

export function isIconKey(value: unknown): value is string {
  return isIconReference(value);
}

export function isStatus(value: unknown): value is PortalStatus {
  return (
    typeof value === "string" &&
    PORTAL_STATUSES.includes(value as PortalStatus)
  );
}

export function isDeviceCategory(
  value: unknown,
): value is PortalDeviceCategory {
  return (
    typeof value === "string" &&
    PORTAL_DEVICE_CATEGORIES.includes(value as PortalDeviceCategory)
  );
}

export function isScheme(value: unknown): value is PortalServiceScheme {
  return (
    typeof value === "string" &&
    PORTAL_SERVICE_SCHEMES.includes(value as PortalServiceScheme)
  );
}

export function isPort(value: unknown): value is number {
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

export function isProtocol(value: unknown): value is PortalServiceProtocol {
  return value === "tcp" || value === "udp";
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
  if (
    input.petname !== undefined &&
    input.petname !== null &&
    typeof input.petname !== "string"
  ) {
    issues.push({ path: `${path}.petname`, message: "名前が不正です" });
  }
  if (typeof input.isVm !== "boolean") {
    issues.push({ path: `${path}.isVm`, message: "VMフラグが不正です" });
  }
  if (!isDeviceCategory(input.category)) {
    issues.push({
      path: `${path}.category`,
      message: "デバイスカテゴリーが不正です",
    });
  } else if (
    typeof input.isVm === "boolean" &&
    input.isVm !== (input.category === "vm")
  ) {
    issues.push({
      path: `${path}.category`,
      message: "カテゴリーとVMフラグが一致していません",
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
  if (!isNonEmptyString(input.relationName)) {
    issues.push({
      path: `${path}.relationName`,
      message: "関係名は必須です",
    });
  }
  if (typeof input.fromLabel !== "string") {
    issues.push({ path: `${path}.fromLabel`, message: "始点ラベルが不正です" });
  }
  if (typeof input.toLabel !== "string") {
    issues.push({ path: `${path}.toLabel`, message: "終点ラベルが不正です" });
  }
  issues.push(
    ...relationPlaceholderIssues(input, `${path}.`),
  );
  const colorIssue = relationColorIssue(input.color, `${path}.color`);
  if (colorIssue) {
    issues.push(colorIssue);
  }
  return issues;
}

function validateRelationName(
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
  for (const field of ["fromLabel", "toLabel"] as const) {
    if (!isOptionalString(input[field])) {
      issues.push({
        path: `${path}.${field}`,
        message: field === "fromLabel" ? "始点ラベルが不正です" : "終点ラベルが不正です",
      });
    }
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
    "deviceNetworks",
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

  if (issues.length > 0) {
    return { issues };
  }

  const networks = input.networks as unknown[];
  const devices = input.devices as unknown[];
  const deviceNetworks = input.deviceNetworks as unknown[];
  const relationNames = input.relationNames as unknown[];
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
    deviceNetworks: deviceNetworks as PortalDeviceNetwork[],
    relationNames: relationNames as PortalRelationName[],
    relations: relations as PortalRelation[],
    services: services as PortalService[],
    ...(input.settings !== undefined
      ? { settings: input.settings as unknown as PortalSettings }
      : {}),
  };
  issues.push(...duplicateIssues(data.networks, "networks"));
  issues.push(...duplicateIssues(data.devices, "devices"));
  issues.push(...duplicateIssues(data.deviceNetworks, "deviceNetworks"));
  issues.push(...duplicateIssues(data.relationNames, "relationNames"));
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
    if (
      network.cidr &&
      membership.ip &&
      !isIpWithinCidr(membership.ip, network.cidr)
    ) {
      issues.push({
        path: `deviceNetworks.${membership.id}.ip`,
        message: `IP ${membership.ip} は ${network.cidr} の範囲外です`,
      });
    }
  }

  const ipOwner = new Map<string, string>();
  for (const membership of data.deviceNetworks) {
    if (!membership.ip) {
      continue;
    }
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
    const key = [
      relation.relationNameId,
      relation.fromDeviceId,
      relation.toDeviceId,
      (relation.fromPlaceholder ?? "").trim(),
      (relation.toPlaceholder ?? "").trim(),
    ].join("\u0000");
    if (relationKeys.has(key)) {
      issues.push({
        path: `relations.${relation.id}`,
        message:
          "同じ関係名・始点・終点・プレースホルダーの関係が重複しています",
      });
    } else {
      relationKeys.add(key);
    }

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
  input: Pick<
    PortalDevice,
    | "name"
    | "petname"
    | "category"
    | "isVm"
    | "ssh"
    | "resources"
    | "meterEnabled"
    | "properties"
  >,
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
  if (input.category === "service" && input.meterEnabled) {
    issues.push({
      path: "meterEnabled",
      message: "サービスカテゴリーではSSHメーターを有効にできません",
    });
  }

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
  const normalizedIp = input.ip.trim();
  if (normalizedIp && !isIpv4(normalizedIp)) {
    issues.push({ path: "ip", message: "IPv4アドレスの形式が不正です" });
  }
  if (
    normalizedIp &&
    data.deviceNetworks.some(
      (membership) =>
        membership.id !== editingId && membership.ip === normalizedIp,
    )
  ) {
    issues.push({ path: "ip", message: "同じIPが登録されています" });
  }
  if (
    network?.cidr &&
    normalizedIp &&
    isIpv4(normalizedIp) &&
    !isIpWithinCidr(normalizedIp, network.cidr)
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
    | "relationName"
    | "fromDeviceId"
    | "toDeviceId"
    | "fromPlaceholder"
    | "toPlaceholder"
  >,
  data: PortalDataV2,
  editingId?: string,
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
  if (!input.relationName.trim()) {
    issues.push({
      path: "relationName",
      message: "関係名を選択してください",
    });
  }
  const relationName = data.relationNames.find(
    (candidate) => candidate.name === input.relationName.trim(),
  );
  if (input.relationName.trim() && !relationName) {
    issues.push({
      path: "relationName",
      message: "選択した関係名が存在しません",
    });
  }
  issues.push(...relationPlaceholderIssues(input));
  const fromPlaceholder = (input.fromPlaceholder ?? "").trim();
  const toPlaceholder = (input.toPlaceholder ?? "").trim();
  const duplicate = data.relations.find(
    (relation) =>
      relation.id !== editingId &&
      relation.relationNameId === relationName?.id &&
      relation.fromDeviceId === input.fromDeviceId &&
      relation.toDeviceId === input.toDeviceId &&
      (relation.fromPlaceholder ?? "").trim() === fromPlaceholder &&
      (relation.toPlaceholder ?? "").trim() === toPlaceholder,
  );
  if (duplicate) {
    issues.push({
      path: "relationName",
      message:
        "同じ関係名・始点・終点・プレースホルダーの関係はすでに登録されています",
    });
  }
  return issues;
}

export function validateRelationNameInput(
  input: Pick<PortalRelationNameInput, "name" | "color">,
  data: PortalDataV2,
  editingId?: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = input.name.trim();
  if (!name) {
    issues.push({ path: "name", message: "関係名を入力してください" });
  } else if (
    data.relationNames.some(
      (relationName) =>
        relationName.id !== editingId && relationName.name === name,
    )
  ) {
    issues.push({ path: "name", message: "同じ関係名が登録されています" });
  }
  const colorIssue = relationColorIssue(input.color, "color");
  if (colorIssue) issues.push(colorIssue);
  return issues;
}

export function validateServiceInput(
  input: Pick<
    PortalService,
    | "subdomain"
    | "petname"
    | "description"
    | "deviceNetworkId"
    | "scheme"
    | "port"
    | "protocol"
    | "topPath"
    | "monitorPath"
    | "serviceUrl"
    | "iconKey"
    | "enabled"
    | "properties"
  >,
  data: PortalDataV2,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input.subdomain.trim()) {
    issues.push({
      path: "subdomain",
      message: "サブドメインを入力してください",
    });
  } else if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
      input.subdomain.trim(),
    )
  ) {
    issues.push({
      path: "subdomain",
      message: "サブドメインは英数字とハイフンで入力してください",
    });
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
  if (!isProtocol(input.protocol)) {
    issues.push({ path: "protocol", message: "プロトコルを選択してください" });
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
  if (typeof input.enabled !== "boolean") {
    issues.push({ path: "enabled", message: "有効状態が不正です" });
  }
  if (input.properties !== undefined) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateNetworkPayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "ネットワークの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: "name", message: "ネットワーク名は必須です" });
  }
  if (
    input.cidr !== undefined &&
    input.cidr !== null &&
    input.cidr !== "" &&
    (!isNonEmptyString(input.cidr) || !isCidr(input.cidr))
  ) {
    issues.push({ path: "cidr", message: "CIDRの形式が不正です" });
  }
  if (!isNonEmptyString(input.accent)) {
    issues.push({ path: "accent", message: "アクセント色は必須です" });
  }
  if (input.note !== undefined && !isNullableString(input.note)) {
    issues.push({ path: "note", message: "メモが不正です" });
  }
  return issues;
}

export function validateDevicePayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "デバイスの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.hostname)) {
    issues.push({ path: "hostname", message: "ホスト名は必須です" });
  }
  if (input.petname !== undefined && !isNullableString(input.petname)) {
    issues.push({ path: "petname", message: "名前が不正です" });
  }
  if (!isDeviceCategory(input.category)) {
    issues.push({ path: "category", message: "デバイスカテゴリーが不正です" });
  }
  if (typeof input.isVm !== "boolean") {
    issues.push({ path: "isVm", message: "VMフラグが不正です" });
  } else if (
    isDeviceCategory(input.category) &&
    input.isVm !== (input.category === "vm")
  ) {
    issues.push({
      path: "category",
      message: "カテゴリーとVMフラグが一致していません",
    });
  }
  if (input.sshUser !== undefined && !isNullableString(input.sshUser)) {
    issues.push({ path: "sshUser", message: "SSHユーザーが不正です" });
  }
  if (
    input.sshPort !== undefined &&
    input.sshPort !== null &&
    !isPort(input.sshPort)
  ) {
    issues.push({ path: "sshPort", message: "SSHポートが不正です" });
  }
  if (typeof input.meterEnabled !== "boolean") {
    issues.push({ path: "meterEnabled", message: "メーター設定が不正です" });
  }
  if (input.note !== undefined && !isNullableString(input.note)) {
    issues.push({ path: "note", message: "メモが不正です" });
  }
  if (
    input.category === "service" &&
    (input.isVm === true || input.meterEnabled === true)
  ) {
    issues.push({
      path: "category",
      message: "サービスカテゴリーはVM・メーターを有効にできません",
    });
  }
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}

export function validateMembershipPayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "所属の形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isPositiveInteger(input.deviceId)) {
    issues.push({ path: "deviceId", message: "デバイスIDが不正です" });
  }
  if (!isPositiveInteger(input.networkId)) {
    issues.push({ path: "networkId", message: "ネットワークIDが不正です" });
  }
  if (
    input.ip !== undefined &&
    input.ip !== null &&
    input.ip !== "" &&
    (!isNonEmptyString(input.ip) || !isIpv4(input.ip))
  ) {
    issues.push({ path: "ip", message: "IPv4アドレスの形式が不正です" });
  }
  if (input.label !== undefined && !isNullableString(input.label)) {
    issues.push({ path: "label", message: "所属ラベルが不正です" });
  }
  return issues;
}

export function validateRelationPayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "関係の形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isPositiveInteger(input.fromDeviceId)) {
    issues.push({ path: "fromDeviceId", message: "関係元IDが不正です" });
  }
  if (!isPositiveInteger(input.toDeviceId)) {
    issues.push({ path: "toDeviceId", message: "関係先IDが不正です" });
  }
  if (
    isPositiveInteger(input.fromDeviceId) &&
    input.fromDeviceId === input.toDeviceId
  ) {
    issues.push({
      path: "toDeviceId",
      message: "同じデバイス自身へ関係は定義できません",
    });
  }
  if (!isNonEmptyString(input.relationName)) {
    issues.push({ path: "relationName", message: "関係名は必須です" });
  }
  issues.push(...relationPlaceholderIssues(input));
  return issues;
}

export function validateRelationNamePayload(
  input: unknown,
): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "関係名の形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: "name", message: "関係名は必須です" });
  }
  const colorIssue = relationColorIssue(input.color, "color");
  if (colorIssue) {
    issues.push(colorIssue);
  }
  for (const field of ["fromLabel", "toLabel"] as const) {
    if (input[field] !== undefined && !isNullableString(input[field])) {
      issues.push({
        path: field,
        message: field === "fromLabel" ? "始点ラベルが不正です" : "終点ラベルが不正です",
      });
    }
  }
  return issues;
}

export function validateServicePayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "サービスの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isPositiveInteger(input.deviceNetworkId)) {
    issues.push({
      path: "deviceNetworkId",
      message: "所属IDが不正です",
    });
  }
  if (!isNonEmptyString(input.subdomain)) {
    issues.push({ path: "subdomain", message: "サブドメインは必須です" });
  } else if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(input.subdomain.trim())
  ) {
    issues.push({
      path: "subdomain",
      message: "サブドメインは英数字とハイフンで入力してください",
    });
  }
  for (const field of ["petname", "description", "iconKey"] as const) {
    if (input[field] !== undefined && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}が不正です` });
    }
  }
  for (const field of ["topPath", "monitorPath", "serviceUrl"] as const) {
    if (input[field] !== undefined && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}が不正です` });
    }
  }
  if (!isPort(input.port)) {
    issues.push({ path: "port", message: "ポートは1〜65535で入力してください" });
  }
  if (!isProtocol(input.protocol)) {
    issues.push({ path: "protocol", message: "プロトコルが不正です" });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: "scheme", message: "スキームが不正です" });
  }
  for (const field of ["topPath", "monitorPath"] as const) {
    const value = input[field];
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !isHttpPath(value)
    ) {
      issues.push({ path: field, message: `${field}は / から入力してください` });
    }
  }
  if (
    typeof input.serviceUrl === "string" &&
    input.serviceUrl.trim() !== "" &&
    !isHttpUrl(input.serviceUrl)
  ) {
    issues.push({
      path: "serviceUrl",
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({ path: "enabled", message: "有効フラグが不正です" });
  }
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
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
