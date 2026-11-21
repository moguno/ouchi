import type { DatabaseSync } from "node:sqlite";
import { parse, stringify } from "yaml";
import type {
  PortalDeviceInput,
  PortalMembershipInput,
  PortalNetworkInput,
  PortalRelationInput,
  PortalServiceInput,
  ValidationIssue,
} from "../src/portal/types";
import {
  isCidr,
  isIpWithinCidr,
  validateDevicePayload,
  validateMembershipPayload,
  validateNetworkPayload,
  validateRelationPayload,
  validateServicePayload,
  validateSettingsPayload,
} from "../src/portal/validation";
import { normalizeServiceIconReference } from "../src/portal/iconCatalog";

export const LEDGER_FORMAT = "ouchi-ledger/1";

export interface LedgerMembership {
  network: string;
  ip: string | null;
  label: string | null;
}

export interface LedgerDevice {
  hostname: string;
  petname: string | null;
  category: PortalDeviceInput["category"];
  isVm: boolean;
  sshUser: string | null;
  sshPort: number | null;
  meterEnabled: boolean;
  note: string | null;
  memberships: LedgerMembership[];
}

export interface LedgerNetwork {
  name: string;
  cidr: string | null;
  accent: string;
  note: string | null;
}

export interface LedgerRelation {
  from: string;
  to: string;
  tag: string;
  fromLabel: string | null;
  toLabel: string | null;
  color: string;
}

export interface LedgerService {
  subdomain: string;
  device: string;
  network: string;
  petname: string | null;
  description: string | null;
  port: number;
  protocol: PortalServiceInput["protocol"];
  scheme: PortalServiceInput["scheme"];
  topPath: string | null;
  monitorPath: string | null;
  serviceUrl: string | null;
  iconKey: string | null;
  enabled: boolean;
}

export interface LedgerSshKey {
  owner: string;
  purpose: string;
  keyType: string;
  publicKey: string;
  fingerprint: string | null;
  expiresAt: string | null;
  enabled: boolean;
  note: string | null;
}

export interface LedgerDeviceKey {
  device: string;
  publicKey: string;
}

export interface LedgerDocument {
  format: typeof LEDGER_FORMAT;
  exportedAt: string;
  settings: {
    domain: string;
    title: string;
  };
  networks: LedgerNetwork[];
  devices: LedgerDevice[];
  relations: LedgerRelation[];
  services: LedgerService[];
  sshKeys: LedgerSshKey[];
  deviceKeys: LedgerDeviceKey[];
}

export interface LedgerImportCounts {
  networks: number;
  devices: number;
  memberships: number;
  relations: number;
  services: number;
  sshKeys: number;
  deviceKeys: number;
}

export class LedgerValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("YAMLの検証に失敗しました");
    this.name = "LedgerValidationError";
    this.issues = issues;
  }
}

type RecordValue = Record<string, unknown>;

type NetworkRow = {
  name: string;
  cidr: string | null;
  accent: string | null;
  note: string | null;
};

type DeviceRow = {
  id: number;
  hostname: string;
  petname: string | null;
  category: PortalDeviceInput["category"];
  is_vm: number;
  ssh_user: string | null;
  ssh_port: number | null;
  meter_enabled: number;
  note: string | null;
};

type MembershipRow = {
  device_id: number;
  network_name: string;
  ip: string | null;
  label: string | null;
};

type RelationRow = {
  from_hostname: string;
  to_hostname: string;
  tag: string;
  from_label: string | null;
  to_label: string | null;
  color: string;
};

type ServiceRow = {
  subdomain: string;
  hostname: string;
  network_name: string;
  petname: string | null;
  description: string | null;
  port: number;
  protocol: PortalServiceInput["protocol"];
  scheme: PortalServiceInput["scheme"];
  top_path: string | null;
  monitor_path: string | null;
  service_url: string | null;
  icon_key: string | null;
  favicon_url: string | null;
  enabled: number;
};

type SshKeyRow = {
  owner: string;
  purpose: string;
  key_type: string;
  public_key: string;
  fingerprint: string | null;
  expires_at: string | null;
  enabled: number;
  note: string | null;
};

type DeviceKeyRow = {
  hostname: string;
  public_key: string;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? "" : normalized;
}

function nullablePetname(value: unknown): string | null {
  const normalized = nullableText(value);
  return normalized || null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function uniqueMap<T>(
  items: T[],
  keyOf: (item: T) => string,
  pathOf: (item: T) => string,
  collectionLabel: string,
  issues: ValidationIssue[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) {
      continue;
    }
    if (result.has(key)) {
      issues.push({
        path: pathOf(item),
        message: `${collectionLabel}「${key}」が重複しています`,
      });
      continue;
    }
    result.set(key, item);
  }
  return result;
}

function parseYamlRoot(text: string): RecordValue {
  if (text.trim() === "") {
    throw new LedgerValidationError([
      { path: "root", message: "YAMLが空です" },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = parse(text, {
      maxAliasCount: 100,
      uniqueKeys: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LedgerValidationError([
      {
        path: "root",
        message: `YAMLを解析できません: ${message}`,
      },
    ]);
  }

  if (!isRecord(parsed)) {
    throw new LedgerValidationError([
      {
        path: "root",
        message: "YAMLのルートはオブジェクトである必要があります",
      },
    ]);
  }
  return parsed;
}

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

function validateDocument(root: RecordValue): LedgerDocument {
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
  } else {
    issues.push(
      ...validateSettingsPayload(root.settings).map((issue) => ({
        ...issue,
        path: `settings.${issue.path}`,
      })),
    );
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
    if (!Array.isArray(item.memberships)) {
      issues.push({
        path: `devices[${index}].memberships`,
        message: "membershipsは配列で指定してください",
      });
    }
    const memberships: LedgerMembership[] = [];
    arrayValue(item.memberships).forEach((membership, membershipIndex) => {
      const membershipPath =
        `devices[${index}].memberships[${membershipIndex}]`;
      if (!isRecord(membership)) {
        issues.push({
          path: membershipPath,
          message: "所属の形式が不正です",
        });
        return;
      }
      const synthetic: PortalMembershipInput = {
        deviceId: index + 1,
        networkId: membershipIndex + 1,
        ip: nullableText(membership.ip),
        label: nullableText(membership.label),
      };
      issues.push(...validateMembershipPayload(synthetic).map((issue) => ({
        ...issue,
        path: `${membershipPath}.${issue.path}`,
      })));
      if (!textValue(membership.network)) {
        issues.push({
          path: `${membershipPath}.network`,
          message: "所属ネットワーク名は必須です",
        });
      }
      memberships.push({
        network: textValue(membership.network),
        ip: nullableText(membership.ip),
        label: nullableText(membership.label),
      });
    });
    devices.push({
      hostname: textValue(item.hostname),
      petname: nullablePetname(item.petname),
      category: item.category as PortalDeviceInput["category"],
      isVm: item.isVm as boolean,
      sshUser: nullableText(item.sshUser),
      sshPort:
        typeof item.sshPort === "number" ? item.sshPort : null,
      meterEnabled: item.meterEnabled as boolean,
      note: nullableText(item.note),
      memberships,
    });
  });

  const relations: LedgerRelation[] = [];
  const relationTagColors = new Map<string, string>();
  arrayValue(root.relations).forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({
        path: `relations[${index}]`,
        message: "関係の形式が不正です",
      });
      return;
    }
    const tagName = textValue(item.tag);
    const relationColor = textValue(item.color);
    const synthetic: PortalRelationInput = {
      fromDeviceId: index + 1,
      toDeviceId: index + 2,
      tag: tagName,
      fromLabel: nullableText(item.fromLabel),
      toLabel: nullableText(item.toLabel),
      color: relationColor,
    };
    issues.push(...validateRelationPayload(synthetic).map((issue) => ({
      ...issue,
      path: `relations[${index}].${issue.path}`,
    })));
    const canonicalColor = relationTagColors.get(tagName);
    if (canonicalColor && relationColor !== canonicalColor) {
      issues.push({
        path: `relations[${index}].color`,
        message:
          `タグ「${tagName}」の色は「${canonicalColor}」に統一してください`,
      });
    } else if (tagName && relationColor && !canonicalColor) {
      relationTagColors.set(tagName, relationColor);
    }
    for (const field of ["from", "to"] as const) {
      if (!textValue(item[field])) {
        issues.push({
          path: `relations[${index}].${field}`,
          message: `${field}のホスト名は必須です`,
        });
      }
    }
    relations.push({
      from: textValue(item.from),
      to: textValue(item.to),
      tag: tagName,
      fromLabel: nullableText(item.fromLabel),
      toLabel: nullableText(item.toLabel),
      color: relationColor,
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
      "generic:monitor",
    );
    const synthetic: PortalServiceInput = {
      deviceNetworkId: index + 1,
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
      enabled: item.enabled as boolean,
    };
    issues.push(...validateServicePayload(synthetic).map((issue) => ({
      ...issue,
      path: `services[${index}].${issue.path}`,
    })));
    for (const field of ["device", "network"] as const) {
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
      network: textValue(item.network),
      petname: nullablePetname(item.petname),
      description: nullableText(item.description),
      port: item.port as number,
      protocol: item.protocol as PortalServiceInput["protocol"],
      scheme: item.scheme as PortalServiceInput["scheme"],
      topPath: nullableText(item.topPath),
      monitorPath: nullableText(item.monitorPath),
      serviceUrl: nullableText(item.serviceUrl),
      iconKey,
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

  const membershipKeys = new Set<string>();
  const ipOwners = new Map<string, string>();
  devices.forEach((device, deviceIndex) => {
    device.memberships.forEach((membership, membershipIndex) => {
      const path =
        `devices[${deviceIndex}].memberships[${membershipIndex}]`;
      const network = networkByName.get(membership.network);
      if (!network) {
        issues.push({
          path: `${path}.network`,
          message: `ネットワーク「${membership.network}」が存在しません`,
        });
      } else if (
        membership.ip &&
        network.cidr &&
        !isIpWithinCidr(membership.ip, network.cidr)
      ) {
        issues.push({
          path: `${path}.ip`,
          message: `IP ${membership.ip} は ${network.cidr} の範囲外です`,
        });
      }

      if (device.category === "service" && membership.ip) {
        issues.push({
          path: `${path}.ip`,
          message: "サービスカテゴリーの所属IPはnullにしてください",
        });
      }

      const membershipKey = `${device.hostname}\u0000${membership.network}`;
      if (membershipKeys.has(membershipKey)) {
        issues.push({
          path,
          message: `${device.hostname} の ${membership.network} 所属が重複しています`,
        });
      }
      membershipKeys.add(membershipKey);

      if (membership.ip) {
        const owner = ipOwners.get(membership.ip);
        if (owner) {
          issues.push({
            path: `${path}.ip`,
            message: `IP ${membership.ip} は ${owner} と重複しています`,
          });
        } else {
          ipOwners.set(membership.ip, device.hostname);
        }
      }
    });
  });

  relations.forEach((relation, index) => {
    if (!deviceByName.has(relation.from)) {
      issues.push({
        path: `relations[${index}].from`,
        message: `デバイス「${relation.from}」が存在しません`,
      });
    }
    if (!deviceByName.has(relation.to)) {
      issues.push({
        path: `relations[${index}].to`,
        message: `デバイス「${relation.to}」が存在しません`,
      });
    }
    if (relation.from === relation.to) {
      issues.push({
        path: `relations[${index}].to`,
        message: "同じデバイス自身へ関係は定義できません",
      });
    }
  });

  services.forEach((service, index) => {
    if (!deviceByName.has(service.device)) {
      issues.push({
        path: `services[${index}].device`,
        message: `デバイス「${service.device}」が存在しません`,
      });
    }
    if (!networkByName.has(service.network)) {
      issues.push({
        path: `services[${index}].network`,
        message: `ネットワーク「${service.network}」が存在しません`,
      });
    }
    if (
      !membershipKeys.has(
        `${service.device}\u0000${service.network}`,
      )
    ) {
      issues.push({
        path: `services[${index}]`,
        message:
          `${service.device} の ${service.network} 所属が存在しません`,
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
    settings: {
      domain: textValue((root.settings as RecordValue).domain),
      title: textValue((root.settings as RecordValue).title),
    },
    networks,
    devices,
    relations,
    services,
    sshKeys,
    deviceKeys,
  };
}

export function parseLedgerYaml(input: string): LedgerDocument {
  return validateDocument(parseYamlRoot(input));
}

export function createLedgerDocument(
  database: DatabaseSync,
  exportedAt = new Date(),
): LedgerDocument {
  const settings = database
    .prepare("SELECT domain, title FROM settings WHERE id = 1")
    .get() as { domain: string; title: string } | undefined;
  const networks = database
    .prepare(
      "SELECT name, cidr, accent, note FROM networks ORDER BY id",
    )
    .all() as NetworkRow[];
  const devices = database
    .prepare(
      `SELECT id, hostname, petname, category, is_vm, ssh_user, ssh_port,
              meter_enabled, note
       FROM devices ORDER BY id`,
    )
    .all() as DeviceRow[];
  const memberships = database
    .prepare(
      `SELECT dn.device_id, n.name AS network_name, dn.ip, dn.label
       FROM device_networks dn
       JOIN networks n ON n.id = dn.network_id
       ORDER BY dn.id`,
    )
    .all() as MembershipRow[];
  const relations = database
    .prepare(
      `SELECT fd.hostname AS from_hostname, td.hostname AS to_hostname,
              r.tag, r.from_label, r.to_label, r.color
       FROM relations r
       JOIN devices fd ON fd.id = r.from_device_id
       JOIN devices td ON td.id = r.to_device_id
       ORDER BY r.id`,
    )
    .all() as RelationRow[];
  const services = database
    .prepare(
      `SELECT s.subdomain, d.hostname, n.name AS network_name,
              s.petname, s.description, s.port, s.protocol, s.scheme,
              s.top_path, s.monitor_path, s.service_url, s.icon_key,
              s.favicon_url, s.enabled
       FROM services s
       JOIN device_networks dn ON dn.id = s.device_network_id
       JOIN devices d ON d.id = dn.device_id
       JOIN networks n ON n.id = dn.network_id
       ORDER BY s.id`,
    )
    .all() as ServiceRow[];
  const sshKeys = database
    .prepare(
      `SELECT owner, purpose, key_type, public_key, fingerprint,
              expires_at, enabled, note
       FROM ssh_keys ORDER BY id`,
    )
    .all() as SshKeyRow[];
  const deviceKeys = database
    .prepare(
      `SELECT d.hostname, k.public_key
       FROM device_keys dk
       JOIN devices d ON d.id = dk.device_id
       JOIN ssh_keys k ON k.id = dk.key_id
       ORDER BY dk.device_id, dk.key_id`,
    )
    .all() as DeviceKeyRow[];

  const membershipsByDevice = new Map<number, LedgerMembership[]>();
  for (const membership of memberships) {
    const list = membershipsByDevice.get(membership.device_id) ?? [];
    list.push({
      network: membership.network_name,
      ip: membership.ip,
      label: membership.label,
    });
    membershipsByDevice.set(membership.device_id, list);
  }

  return {
    format: LEDGER_FORMAT,
    exportedAt: exportedAt.toISOString(),
    settings: {
      domain: settings?.domain ?? "ouchi.local",
      title: settings?.title ?? "あなたのホームラボ",
    },
    networks: networks.map((network) => ({
      name: network.name,
      cidr: network.cidr,
      accent: network.accent ?? "",
      note: network.note,
    })),
    devices: devices.map((device) => ({
      hostname: device.hostname,
      petname: device.petname,
      category: device.category,
      isVm: Boolean(device.is_vm),
      sshUser: device.ssh_user,
      sshPort: device.ssh_port,
      meterEnabled: Boolean(device.meter_enabled),
      note: device.note,
      memberships: membershipsByDevice.get(device.id) ?? [],
    })),
    relations: relations.map((relation) => ({
      from: relation.from_hostname,
      to: relation.to_hostname,
      tag: relation.tag,
      fromLabel: relation.from_label,
      toLabel: relation.to_label,
      color: relation.color,
    })),
    services: services.map((service) => ({
      subdomain: service.subdomain,
      device: service.hostname,
      network: service.network_name,
      petname: service.petname,
      description: service.description,
      port: service.port,
      protocol: service.protocol,
      scheme: service.scheme,
      topPath: service.top_path,
      monitorPath: service.monitor_path,
      serviceUrl: service.service_url,
      iconKey: normalizeServiceIconReference(
        service.icon_key,
        service.favicon_url,
        "generic:monitor",
      ),
      enabled: Boolean(service.enabled),
    })),
    sshKeys: sshKeys.map((key) => ({
      owner: key.owner,
      purpose: key.purpose,
      keyType: key.key_type,
      publicKey: key.public_key,
      fingerprint: key.fingerprint,
      expiresAt: key.expires_at,
      enabled: Boolean(key.enabled),
      note: key.note,
    })),
    deviceKeys: deviceKeys.map((deviceKey) => ({
      device: deviceKey.hostname,
      publicKey: deviceKey.public_key,
    })),
  };
}

export function serializeLedgerDocument(document: LedgerDocument): string {
  return stringify(document, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  });
}

export function exportLedgerYaml(
  database: DatabaseSync,
  exportedAt = new Date(),
): string {
  return serializeLedgerDocument(
    createLedgerDocument(database, exportedAt),
  );
}

function asNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

export function importLedgerYaml(
  database: DatabaseSync,
  yaml: string,
): LedgerImportCounts {
  const document = parseLedgerYaml(yaml);
  const counts: LedgerImportCounts = {
    networks: document.networks.length,
    devices: document.devices.length,
    memberships: document.devices.reduce(
      (count, device) => count + device.memberships.length,
      0,
    ),
    relations: document.relations.length,
    services: document.services.length,
    sshKeys: document.sshKeys.length,
    deviceKeys: document.deviceKeys.length,
  };

  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      DELETE FROM device_keys;
      DELETE FROM ssh_keys;
      DELETE FROM services;
      DELETE FROM relations;
      DELETE FROM device_networks;
      DELETE FROM devices;
      DELETE FROM networks;
      DELETE FROM settings;
    `);

    database
      .prepare("INSERT INTO settings (id, domain, title) VALUES (1, ?, ?)")
      .run(document.settings.domain, document.settings.title);

    const networkIds = new Map<string, number>();
    const insertNetwork = database.prepare(
      `INSERT INTO networks (name, cidr, accent, note)
       VALUES (?, ?, ?, ?)`,
    );
    for (const network of document.networks) {
      const result = insertNetwork.run(
        network.name,
        network.cidr,
        network.accent,
        network.note,
      );
      networkIds.set(network.name, asNumber(result.lastInsertRowid));
    }

    const deviceIds = new Map<string, number>();
    const insertDevice = database.prepare(
      `INSERT INTO devices
        (hostname, petname, category, is_vm, ssh_user, ssh_port,
         meter_enabled, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const device of document.devices) {
      const result = insertDevice.run(
        device.hostname,
        device.petname,
        device.category,
        device.isVm ? 1 : 0,
        device.sshUser,
        device.sshPort,
        device.meterEnabled ? 1 : 0,
        device.note,
      );
      deviceIds.set(device.hostname, asNumber(result.lastInsertRowid));
    }

    const membershipIds = new Map<string, number>();
    const insertMembership = database.prepare(
      `INSERT INTO device_networks (device_id, network_id, ip, label)
       VALUES (?, ?, ?, ?)`,
    );
    for (const device of document.devices) {
      for (const membership of device.memberships) {
        const result = insertMembership.run(
          deviceIds.get(device.hostname)!,
          networkIds.get(membership.network)!,
          membership.ip,
          membership.label,
        );
        membershipIds.set(
          `${device.hostname}\u0000${membership.network}`,
          asNumber(result.lastInsertRowid),
        );
      }
    }

    const insertRelation = database.prepare(
      `INSERT INTO relations
        (from_device_id, to_device_id, tag, from_label, to_label, color)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const relation of document.relations) {
      insertRelation.run(
        deviceIds.get(relation.from)!,
        deviceIds.get(relation.to)!,
        relation.tag,
        relation.fromLabel,
        relation.toLabel,
        relation.color,
      );
    }

    const insertService = database.prepare(
      `INSERT INTO services
        (device_network_id, subdomain, petname, description, port, protocol,
         scheme, top_path, monitor_path, service_url, icon_key, favicon_url,
         enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const service of document.services) {
      insertService.run(
        membershipIds.get(
          `${service.device}\u0000${service.network}`,
        )!,
        service.subdomain,
        service.petname,
        service.description,
        service.port,
        service.protocol,
        service.scheme,
        service.topPath,
        service.monitorPath,
        service.serviceUrl,
        service.iconKey,
        null,
        service.enabled ? 1 : 0,
      );
    }

    const sshKeyIds = new Map<string, number>();
    const insertSshKey = database.prepare(
      `INSERT INTO ssh_keys
        (owner, purpose, key_type, public_key, fingerprint, expires_at,
         enabled, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const key of document.sshKeys) {
      const result = insertSshKey.run(
        key.owner,
        key.purpose,
        key.keyType,
        key.publicKey,
        key.fingerprint,
        key.expiresAt,
        key.enabled ? 1 : 0,
        key.note,
      );
      sshKeyIds.set(key.publicKey, asNumber(result.lastInsertRowid));
    }

    const insertDeviceKey = database.prepare(
      "INSERT INTO device_keys (device_id, key_id) VALUES (?, ?)",
    );
    for (const deviceKey of document.deviceKeys) {
      insertDeviceKey.run(
        deviceIds.get(deviceKey.device)!,
        sshKeyIds.get(deviceKey.publicKey)!,
      );
    }

    database.exec("COMMIT");
    return counts;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original import failure.
    }
    throw error;
  }
}
