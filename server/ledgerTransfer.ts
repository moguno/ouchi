import type { DatabaseSync } from "node:sqlite";
import { parse, stringify } from "yaml";
import type {
  PortalDeviceInput,
  PortalInterfaceInput,
  PortalLineEndpointShape,
  PortalNetworkInput,
  PortalProperties,
  PortalRelationInput,
  PortalRelationNameInput,
  PortalServiceInput,
  ValidationIssue,
} from "../src/portal/types";
import {
  isCidr,
  isIpWithinCidr,
  isLineEndpointShape,
  normalizeProperties,
  validateDevicePayload,
  validateInterfacePayload,
  validateNetworkPayload,
  validateRelationPayload,
  validateRelationNamePayload,
  validateServicePayload,
  validateSettingsPayload,
} from "../src/portal/validation";
import { normalizeServiceIconReference } from "../src/portal/iconCatalog";
import { LEGACY_ACCENT_COLORS } from "../src/portal/colorValue";

export const LEDGER_FORMAT = "ouchi-ledger/9";
export const V8_LEDGER_FORMAT = "ouchi-ledger/8";
export const V7_LEDGER_FORMAT = "ouchi-ledger/7";
export const V6_LEDGER_FORMAT = "ouchi-ledger/6";
export const V5_LEDGER_FORMAT = "ouchi-ledger/5";
export const V4_LEDGER_FORMAT = "ouchi-ledger/4";
export const PREVIOUS_LEDGER_FORMAT = "ouchi-ledger/3";
export const V2_LEDGER_FORMAT = "ouchi-ledger/2";
export const LEGACY_LEDGER_FORMAT = "ouchi-ledger/1";

export interface LedgerInterface {
  name: string;
  network: string | null;
  ip: string | null;
  mac: string | null;
}

export interface LedgerDevice {
  hostname: string;
  petname: string | null;
  category: PortalDeviceInput["category"];
  sshUser: string | null;
  sshPort: number | null;
  meterEnabled: boolean;
  note: string | null;
  properties: PortalProperties;
  interfaces: LedgerInterface[];
}

export interface LedgerNetwork {
  name: string;
  cidr: string | null;
  accent: string;
  note: string | null;
}

export interface LedgerRelationEndpoint {
  device: string;
  interface: string;
}

export interface LedgerRelation {
  from: LedgerRelationEndpoint;
  to: LedgerRelationEndpoint;
  relationName: string;
  fromLabel?: string;
  toLabel?: string;
}

export interface LedgerRelationName {
  name: string;
  color: string;
  lineStart?: PortalLineEndpointShape;
  lineEnd?: PortalLineEndpointShape;
}

export interface LedgerService {
  subdomain: string;
  device: string;
  interface: string;
  petname: string | null;
  description: string | null;
  port: number;
  protocol: PortalServiceInput["protocol"];
  scheme: PortalServiceInput["scheme"];
  topPath: string | null;
  monitorPath: string | null;
  serviceUrl: string | null;
  iconKey: string | null;
  properties: PortalProperties;
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
  relationNames: LedgerRelationName[];
  relations: LedgerRelation[];
  services: LedgerService[];
  sshKeys: LedgerSshKey[];
  deviceKeys: LedgerDeviceKey[];
}

export interface LedgerImportCounts {
  networks: number;
  devices: number;
  interfaces: number;
  relationNames: number;
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
  ssh_user: string | null;
  ssh_port: number | null;
  meter_enabled: number;
  note: string | null;
  properties: string;
};

type InterfaceRow = {
  device_id: number;
  name: string;
  network_name: string | null;
  ip: string | null;
  mac: string | null;
};

type RelationNameRow = {
  name: string;
  color: string;
  line_start: PortalLineEndpointShape;
  line_end: PortalLineEndpointShape;
};

type RelationRow = {
  from_hostname: string;
  from_interface: string;
  to_hostname: string;
  to_interface: string;
  relation_name: string;
  from_label: string;
  to_label: string;
};

type ServiceRow = {
  subdomain: string;
  hostname: string;
  interface_name: string;
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
  properties: string;
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

function parseStoredProperties(value: string | null): PortalProperties {
  if (!value) {
    return {};
  }
  try {
    return normalizeProperties(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
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

/**
 * One-step YAML migration from ouchi-ledger/1 to ouchi-ledger/2.
 *
 * Legacy rows own their tag/colour/labels. Grouping them by tag yields the
 * same definitions as DB migration 004, including first-row-wins metadata.
 */
export function upgradeLegacyLedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== LEGACY_LEDGER_FORMAT) {
    return root;
  }
  const relationNames: Array<RecordValue> = [];
  const byName = new Map<string, RecordValue>();
  const relations = arrayValue(root.relations).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const name =
      textValue(item.tag) || "未分類";
    if (!byName.has(name)) {
      const relationName: RecordValue = {
        name,
        color: textValue(item.color),
        fromLabel: nullableText(item.fromLabel),
        toLabel: nullableText(item.toLabel),
      };
      byName.set(name, relationName);
      relationNames.push(relationName);
    }
    return {
      from: item.from,
      to: item.to,
      relationName: name,
      fromPlaceholder: nullableText(item.fromPlaceholder),
      toPlaceholder: nullableText(item.toPlaceholder),
    };
  });
  return {
    ...root,
    format: V2_LEDGER_FORMAT,
    relationNames,
    relations,
  };
}

/**
 * Expand a /2 relation-name label template into a per-relation label,
 * mirroring the API's resolution rule: every {} receives the trimmed
 * placeholder value, an empty value becomes "-", and an empty template
 * yields an empty label (the display falls back to the relation name).
 */
function expandLegacyLabel(
  template: string | null,
  placeholder: unknown,
): string {
  const normalizedTemplate = template?.trim() ?? "";
  if (!normalizedTemplate) {
    return "";
  }
  const value = textValue(placeholder) || "-";
  return normalizedTemplate.split("{}").join(value);
}

/**
 * One-step YAML migration from ouchi-ledger/2 to ouchi-ledger/3.
 *
 * Relation names become pure categories (name + colour); their label
 * templates are expanded into free-text labels on each relation, and the
 * placeholder values are dropped.
 */
export function upgradeV2LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== V2_LEDGER_FORMAT) {
    return root;
  }
  const definitions = new Map<string, RecordValue>();
  const relationNames = arrayValue(root.relationNames).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const name = textValue(item.name);
    if (name && !definitions.has(name)) {
      definitions.set(name, item);
    }
    return {
      name: item.name,
      color: item.color,
    };
  });
  const relations = arrayValue(root.relations).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const definition = definitions.get(textValue(item.relationName));
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
  });
  return {
    ...root,
    format: PREVIOUS_LEDGER_FORMAT,
    relationNames,
    relations,
  };
}

/**
 * One-step YAML migration from ouchi-ledger/3 to ouchi-ledger/4.
 *
 * Memberships become interfaces: each device's memberships are named
 * eth0, eth1, ... in order, keeping network, IP and label. Relation
 * endpoints (device hostnames in /3) are resolved to interfaces: a
 * device with a single interface uses it; otherwise the pair sharing a
 * network wins (the shared-segment heuristic, mirroring DB migration
 * 007); otherwise the first interface. Services referenced their
 * membership by (device, network) and now reference the interface that
 * sits on that network.
 */
export function upgradeV3LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== PREVIOUS_LEDGER_FORMAT) {
    return root;
  }
  const interfacesByDevice = new Map<
    string,
    Array<{ name: string; network: string | null }>
  >();
  const devices = arrayValue(root.devices).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const hostname = textValue(item.hostname);
    const interfaces = arrayValue(item.memberships).map(
      (membership, index) => {
        if (!isRecord(membership)) {
          return membership;
        }
        return {
          name: `eth${index}`,
          network: nullableText(membership.network),
          ip: membership.ip ?? null,
        };
      },
    );
    interfacesByDevice.set(
      hostname,
      interfaces.map((iface) => ({
        name: textValue((iface as RecordValue).name),
        network: nullableText((iface as RecordValue).network),
      })),
    );
    const { memberships: _memberships, ...rest } = item;
    return { ...rest, interfaces };
  });
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
  const relations = arrayValue(root.relations).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const from = textValue(item.from);
    const to = textValue(item.to);
    return {
      from: { device: from, interface: resolveEndpoint(from, to) },
      to: { device: to, interface: resolveEndpoint(to, from) },
      relationName: item.relationName,
      ...(item.fromLabel ? { fromLabel: item.fromLabel } : {}),
      ...(item.toLabel ? { toLabel: item.toLabel } : {}),
    };
  });
  const services = arrayValue(root.services).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const device = textValue(item.device);
    const network = textValue(item.network);
    const match = (interfacesByDevice.get(device) ?? []).find(
      (iface) => iface.network === network,
    );
    const { network: _network, ...rest } = item;
    return {
      ...rest,
      interface: match?.name ?? "",
    };
  });
  return {
    ...root,
    format: V4_LEDGER_FORMAT,
    devices,
    relations,
    services,
  };
}

/**
 * One-step YAML migration from ouchi-ledger/4 to ouchi-ledger/5.
 *
 * Interfaces gain an optional MAC address. /4 documents carry no MAC
 * values, so the step only advances the format marker; parsing fills
 * the missing field with null.
 */
export function upgradeV4LedgerDocument(
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
 * One-step YAML migration from ouchi-ledger/5 to ouchi-ledger/6.
 *
 * The interface label is dropped: it was displayed nowhere, and
 * endpoint notes belong to relation labels. The step strips the
 * field from every device's interfaces.
 */
export function upgradeV5LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== V5_LEDGER_FORMAT) {
    return root;
  }
  const devices = arrayValue(root.devices).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const interfaces = arrayValue(item.interfaces).map((iface) => {
      if (!isRecord(iface)) {
        return iface;
      }
      const { label: _label, ...rest } = iface;
      return rest;
    });
    return { ...item, interfaces };
  });
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
export function upgradeV6LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== V6_LEDGER_FORMAT) {
    return root;
  }
  const networks = arrayValue(root.networks).map((item) => {
    if (!isRecord(item) || typeof item.accent !== "string") {
      return item;
    }
    const converted =
      LEGACY_ACCENT_COLORS[item.accent.trim().toLowerCase()];
    return converted ? { ...item, accent: converted } : item;
  });
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
export function upgradeV7LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== V7_LEDGER_FORMAT) {
    return root;
  }
  const devices = arrayValue(root.devices).map((item) => {
    if (!isRecord(item)) {
      return item;
    }
    const { isVm: _isVm, ...rest } = item;
    return rest;
  });
  return {
    ...root,
    format: LEDGER_FORMAT,
    devices,
  };
}

/**
 * One-step upgrade from ouchi-ledger/8: relation names gain endpoint
 * shapes. Documents without them validate against the defaults, so
 * this step only advances the format.
 */
export function upgradeV8LedgerDocument(
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
    const endpoint = (value: unknown) =>
      isRecord(value)
        ? {
            device: textValue(value.device),
            interface: textValue(value.interface),
          }
        : { device: "", interface: "" };
    const from = endpoint(item.from);
    const to = endpoint(item.to);
    const synthetic: PortalRelationInput = {
      relationName: textValue(item.relationName),
      fromInterfaceId: index + 1,
      toInterfaceId: index + 2,
      fromLabel: textValue(item.fromLabel),
      toLabel: textValue(item.toLabel),
    };
    issues.push(...validateRelationPayload(synthetic).map((issue) => ({
      ...issue,
      path: `relations[${index}].${issue.path}`,
    })));
    for (const [field, value] of [
      ["from", from],
      ["to", to],
    ] as const) {
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
    if (relation.from.device === relation.to.device) {
      issues.push({
        path: `relations[${index}].to.device`,
        message: "同じデバイス自身へ関係は定義できません",
      });
    }
    const key = [
      relation.relationName,
      relation.from.device,
      relation.from.interface,
      relation.to.device,
      relation.to.interface,
      relation.fromLabel ?? "",
      relation.toLabel ?? "",
    ].join("\u0000");
    if (relationKeys.has(key)) {
      issues.push({
        path: `relations[${index}]`,
        message:
          "同じ関係名・始点・終点・ラベルの関係が重複しています",
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
    settings: {
      domain: textValue((root.settings as RecordValue).domain),
      title: textValue((root.settings as RecordValue).title),
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

export function parseLedgerYaml(input: string): LedgerDocument {
  return validateDocument(
    upgradeV8LedgerDocument(
      upgradeV7LedgerDocument(
        upgradeV6LedgerDocument(
          upgradeV5LedgerDocument(
            upgradeV4LedgerDocument(
              upgradeV3LedgerDocument(
                upgradeV2LedgerDocument(
                  upgradeLegacyLedgerDocument(parseYamlRoot(input)),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
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
      `SELECT id, hostname, petname, category, ssh_user, ssh_port,
              meter_enabled, note, properties
       FROM devices ORDER BY id`,
    )
    .all() as DeviceRow[];
  const interfaces = database
    .prepare(
      `SELECT i.device_id, i.name, n.name AS network_name, i.ip, i.mac
       FROM interfaces i
       LEFT JOIN networks n ON n.id = i.network_id
       ORDER BY i.id`,
    )
    .all() as InterfaceRow[];
  const relationNames = database
    .prepare(
      `SELECT name, color, line_start, line_end
       FROM relation_names ORDER BY id`,
    )
    .all() as RelationNameRow[];
  const relations = database
    .prepare(
      `SELECT fd.hostname AS from_hostname, fi.name AS from_interface,
              td.hostname AS to_hostname, ti.name AS to_interface,
              n.name AS relation_name,
              r.from_label, r.to_label
       FROM relations r
       JOIN relation_names n ON n.id = r.relation_name_id
       JOIN interfaces fi ON fi.id = r.from_interface_id
       JOIN devices fd ON fd.id = fi.device_id
       JOIN interfaces ti ON ti.id = r.to_interface_id
       JOIN devices td ON td.id = ti.device_id
       ORDER BY r.id`,
    )
    .all() as RelationRow[];
  const services = database
    .prepare(
      `SELECT s.subdomain, d.hostname, i.name AS interface_name,
              s.petname, s.description, s.port, s.protocol, s.scheme,
              s.top_path, s.monitor_path, s.service_url, s.icon_key,
              s.favicon_url, s.properties, s.enabled
       FROM services s
       JOIN interfaces i ON i.id = s.interface_id
       JOIN devices d ON d.id = i.device_id
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

  const interfacesByDevice = new Map<number, LedgerInterface[]>();
  for (const iface of interfaces) {
    const list = interfacesByDevice.get(iface.device_id) ?? [];
    list.push({
      name: iface.name,
      network: iface.network_name,
      ip: iface.ip,
      mac: iface.mac,
    });
    interfacesByDevice.set(iface.device_id, list);
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
      sshUser: device.ssh_user,
      sshPort: device.ssh_port,
      meterEnabled: Boolean(device.meter_enabled),
      note: device.note,
      properties: parseStoredProperties(device.properties),
      interfaces: interfacesByDevice.get(device.id) ?? [],
    })),
    relationNames: relationNames.map((relationName) => ({
      name: relationName.name,
      color: relationName.color,
      ...(relationName.line_start !== "circle"
        ? { lineStart: relationName.line_start }
        : {}),
      ...(relationName.line_end !== "circle"
        ? { lineEnd: relationName.line_end }
        : {}),
    })),
    relations: relations.map((relation) => ({
      from: {
        device: relation.from_hostname,
        interface: relation.from_interface,
      },
      to: {
        device: relation.to_hostname,
        interface: relation.to_interface,
      },
      relationName: relation.relation_name,
      ...(relation.from_label
        ? { fromLabel: relation.from_label }
        : {}),
      ...(relation.to_label
        ? { toLabel: relation.to_label }
        : {}),
    })),
    services: services.map((service) => ({
      subdomain: service.subdomain,
      device: service.hostname,
      interface: service.interface_name,
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
      ),
      properties: parseStoredProperties(service.properties),
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
    interfaces: document.devices.reduce(
      (count, device) => count + device.interfaces.length,
      0,
    ),
    relationNames: document.relationNames.length,
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
      DELETE FROM relation_names;
      DELETE FROM interfaces;
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
        (hostname, petname, category, ssh_user, ssh_port,
         meter_enabled, note, properties)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const device of document.devices) {
      const result = insertDevice.run(
        device.hostname,
        device.petname,
        device.category,
        device.sshUser,
        device.sshPort,
        device.meterEnabled ? 1 : 0,
        device.note,
        JSON.stringify(device.properties),
      );
      deviceIds.set(device.hostname, asNumber(result.lastInsertRowid));
    }

    const interfaceIds = new Map<string, number>();
    const insertInterface = database.prepare(
      `INSERT INTO interfaces (device_id, name, network_id, ip, mac)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const device of document.devices) {
      for (const iface of device.interfaces) {
        const result = insertInterface.run(
          deviceIds.get(device.hostname)!,
          iface.name,
          iface.network === null
            ? null
            : networkIds.get(iface.network)!,
          iface.ip,
          iface.mac,
        );
        interfaceIds.set(
          `${device.hostname}\u0000${iface.name}`,
          asNumber(result.lastInsertRowid),
        );
      }
    }

    const relationNameIds = new Map<string, number>();
    const insertRelationName = database.prepare(
      `INSERT INTO relation_names (name, color, line_start, line_end)
       VALUES (?, ?, ?, ?)`,
    );
    for (const relationName of document.relationNames) {
      const result = insertRelationName.run(
        relationName.name,
        relationName.color,
        relationName.lineStart ?? "circle",
        relationName.lineEnd ?? "circle",
      );
      relationNameIds.set(
        relationName.name,
        asNumber(result.lastInsertRowid),
      );
    }

    const insertRelation = database.prepare(
      `INSERT INTO relations
        (relation_name_id, from_interface_id, to_interface_id,
         from_label, to_label)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const relation of document.relations) {
      insertRelation.run(
        relationNameIds.get(relation.relationName)!,
        interfaceIds.get(
          `${relation.from.device}\u0000${relation.from.interface}`,
        )!,
        interfaceIds.get(
          `${relation.to.device}\u0000${relation.to.interface}`,
        )!,
        relation.fromLabel ?? "",
        relation.toLabel ?? "",
      );
    }

    const insertService = database.prepare(
      `INSERT INTO services
        (interface_id, subdomain, petname, description, port, protocol,
         scheme, top_path, monitor_path, service_url, icon_key, favicon_url,
         properties, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const service of document.services) {
      insertService.run(
        interfaceIds.get(
          `${service.device}\u0000${service.interface}`,
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
        JSON.stringify(service.properties),
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
