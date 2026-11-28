import type {
  PortalLineEndpointShape,
  ValidationIssue,
} from "./types";
import {
  LEGACY_ACCENT_COLORS,
  normalizeNetworkAccent,
} from "./colorValue";
import { isLineEndpointShape } from "./validation";

export const LEDGER_FORMAT = "ouchi-ledger/17";
export const V16_LEDGER_FORMAT = "ouchi-ledger/16";
export const V15_LEDGER_FORMAT = "ouchi-ledger/15";
export const V14_LEDGER_FORMAT = "ouchi-ledger/14";
export const V13_LEDGER_FORMAT = "ouchi-ledger/13";
export const V12_LEDGER_FORMAT = "ouchi-ledger/12";
export const V11_LEDGER_FORMAT = "ouchi-ledger/11";
export const V10_LEDGER_FORMAT = "ouchi-ledger/10";
export const V9_LEDGER_FORMAT = "ouchi-ledger/9";
export const V8_LEDGER_FORMAT = "ouchi-ledger/8";
export const V7_LEDGER_FORMAT = "ouchi-ledger/7";
export const V6_LEDGER_FORMAT = "ouchi-ledger/6";
export const V5_LEDGER_FORMAT = "ouchi-ledger/5";
export const V4_LEDGER_FORMAT = "ouchi-ledger/4";
export const PREVIOUS_LEDGER_FORMAT = "ouchi-ledger/3";
export const V2_LEDGER_FORMAT = "ouchi-ledger/2";
export const LEGACY_LEDGER_FORMAT = "ouchi-ledger/1";

export type RecordValue = Record<string, unknown>;

export class YAMLDataSourceError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = "YAMLDataSourceError";
    this.issues = issues;
  }
}

export function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requiredArray(
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

export function requiredRecord(
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

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function nullableText(value: unknown): string | undefined {
  const normalized = text(value);
  return normalized || undefined;
}

export function normalizeAccent(value: unknown): string {
  return normalizeNetworkAccent(text(value));
}

export function nullableNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function interfaceKey(device: string, name: string): string {
  return `${device}\u0000${name}`;
}

export function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(" / ");
}

export function upgradeLegacyDocument(
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
export function upgradeV2Document(
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
export function upgradeV3Document(
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
export function upgradeV4Document(
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
export function upgradeV5Document(
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
export function upgradeV6Document(
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
export function upgradeV8Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V8_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V9_LEDGER_FORMAT,
  };
}

/**
 * One-step upgrade from ouchi-ledger/9: relations gain an optional
 * properties map (the device/service memo). Documents without it
 * validate against the empty default, so this step only advances
 * the format.
 */
export function upgradeV9Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V9_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V10_LEDGER_FORMAT,
  };
}

/**
 * One-step upgrade from ouchi-ledger/10: networks and settings gain an
 * optional properties map (the network memo and the ouchi memo), and
 * the network array order becomes the display order. Documents
 * without the new keys validate against the empty defaults, so this
 * step only advances the format.
 */
export function upgradeV10Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V10_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V11_LEDGER_FORMAT,
  };
}

export function upgradeV11Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V11_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V12_LEDGER_FORMAT,
  };
}

/**
 * One-step upgrade from ouchi-ledger/12: relations gain an optional
 * structured destination port and protocol (a pair; both absent means
 * unspecified). Existing documents carry neither key, which /13 reads
 * unchanged, so this step only advances the format.
 */
export function upgradeV12Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V12_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V13_LEDGER_FORMAT,
  };
}

/**
 * One-step upgrade from ouchi-ledger/13: the ledger gains projects.
 * A projects list appears holding the single default project, and
 * every entity implicitly belongs to it (an entity names its project
 * with an optional project key only when it is not the first project
 * in the list), so this step only adds the list and advances the
 * format. The demo data source ignores project assignments; they
 * matter to the server import.
 */
export function upgradeV13Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V13_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V14_LEDGER_FORMAT,
    projects: [{ name: "デフォルト" }],
  };
}

/**
 * One-step upgrade from ouchi-ledger/14: interfaces gain an optional
 * properties memo map. Existing documents carry no such key, which
 * /15 reads as an empty map, so this step only advances the format.
 */
export function upgradeV14Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V14_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V15_LEDGER_FORMAT,
  };
}

export function upgradeV15Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V15_LEDGER_FORMAT) {
    return root;
  }
  // /16 is one document per project. The demo renders a single
  // board, so the first project becomes the document's project and
  // everything else carries over (per-entity project keys, when
  // present, are ignored by the demo parser).
  const projects = Array.isArray(root.projects) ? root.projects : [];
  const first = isRecord(projects[0]) ? projects[0] : {};
  const { projects: _projects, ...rest } = root;
  return {
    ...rest,
    format: LEDGER_FORMAT,
    project: text(first.name) || "デフォルト",
  };
}

/**
 * /17 adds the project color (settings.color). /16 documents carry
 * none; the parser derives it from the project name, so this step
 * only advances the format.
 */
export function upgradeV16Document(
  root: RecordValue,
): RecordValue {
  if (root.format !== V16_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: LEDGER_FORMAT,
  };
}

export function lineEndpointShape(value: unknown): PortalLineEndpointShape {
  return isLineEndpointShape(value) ? value : "circle";
}

export function upgradeV7Document(
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
    format: V8_LEDGER_FORMAT,
    devices,
  };
}
