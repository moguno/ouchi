import { LEGACY_ACCENT_COLORS } from "../src/portal/colorValue";
import {
  DEFAULT_PROJECT_NAME,
  LEDGER_FORMAT,
  LEGACY_LEDGER_FORMAT,
  PREVIOUS_LEDGER_FORMAT,
  V10_LEDGER_FORMAT,
  V11_LEDGER_FORMAT,
  V12_LEDGER_FORMAT,
  V13_LEDGER_FORMAT,
  V14_LEDGER_FORMAT,
  V16_LEDGER_FORMAT,
  V15_LEDGER_FORMAT,
  V2_LEDGER_FORMAT,
  V4_LEDGER_FORMAT,
  V5_LEDGER_FORMAT,
  V6_LEDGER_FORMAT,
  V7_LEDGER_FORMAT,
  V8_LEDGER_FORMAT,
  V9_LEDGER_FORMAT,
} from "./ledgerTypes";
import type {
  LedgerDevice,
  LedgerDocument,
  LedgerInterface,
  LedgerNetwork,
  LedgerRelation,
  LedgerRelationName,
  LedgerService,
  RecordValue,
} from "./ledgerTypes";
import {
  arrayValue,
  isRecord,
  nullableText,
  textValue,
} from "./ledgerValues";

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
    format: V8_LEDGER_FORMAT,
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
    format: V9_LEDGER_FORMAT,
  };
}

/**
 * One-step upgrade from ouchi-ledger/9: relations gain an optional
 * properties map (the device/service memo). Documents without it
 * validate against the empty default, so this step only advances
 * the format.
 */
export function upgradeV9LedgerDocument(
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
export function upgradeV10LedgerDocument(
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

/**
 * One-step upgrade from ouchi-ledger/11: relation endpoints may be
 * services ({ service: subdomain }) as well as interfaces
 * ({ device, interface }). Existing documents name only interfaces,
 * which /12 reads unchanged, so this step only advances the format.
 */
export function upgradeV11LedgerDocument(
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
export function upgradeV12LedgerDocument(
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
 * format.
 */
export function upgradeV13LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== V13_LEDGER_FORMAT) {
    return root;
  }
  return {
    ...root,
    format: V14_LEDGER_FORMAT,
    projects: [{ name: DEFAULT_PROJECT_NAME }],
  };
}

export function upgradeV14LedgerDocument(
  root: RecordValue,
): RecordValue {
  if (root.format !== V14_LEDGER_FORMAT) {
    return root;
  }
  // /15 only adds the optional interface properties key; documents
  // without it parse with empty properties, so nothing to rewrite.
  return {
    ...root,
    format: V15_LEDGER_FORMAT,
  };
}

const PROJECT_COLLECTIONS = [
  "networks",
  "devices",
  "relationNames",
  "relations",
  "services",
] as const;

/**
 * Splits a flat /15 document into one /16 document per project.
 * /15 keeps every project in a single document; /16 gives each
 * project its own document so projects stay maximally independent.
 * The settings ouchi (title + global memo) belongs to the first
 * project, the domain is shared, and entities name their project
 * with the project key (absent = the first project). Documents of
 * any other format pass through as a single-element list.
 */
/**
 * /17 gives each project's document its color (settings.color,
 * decided at the project's creation from its name). /16 documents
 * carry no color; the value is derived from the project name when
 * the document is validated, so nothing needs rewriting here.
 */
export function upgradeV16LedgerDocument(
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

export function splitV15LedgerDocuments(
  root: RecordValue,
): RecordValue[] {
  if (root.format !== V15_LEDGER_FORMAT) {
    return [root];
  }
  const settings = isRecord(root.settings) ? root.settings : {};
  const projectList =
    Array.isArray(root.projects) && root.projects.length > 0
      ? root.projects
      : [{ name: DEFAULT_PROJECT_NAME }];
  const names = projectList.map((item) =>
    isRecord(item)
      ? textValue(item.name) || DEFAULT_PROJECT_NAME
      : DEFAULT_PROJECT_NAME,
  );
  const firstName = names[0];
  const projectOf = (entity: unknown): string => {
    if (!isRecord(entity)) {
      return firstName;
    }
    const name = textValue(entity.project);
    return name && names.includes(name) ? name : firstName;
  };
  const strip = (entity: unknown): unknown => {
    if (!isRecord(entity)) {
      return entity;
    }
    const { project, ...rest } = entity;
    return rest;
  };
  const deviceProject = new Map<string, string>();
  for (const device of arrayValue(root.devices)) {
    if (isRecord(device)) {
      deviceProject.set(textValue(device.hostname), projectOf(device));
    }
  }
  return projectList.map((item, index) => {
    const name = names[index];
    const record = isRecord(item) ? item : {};
    const title = record.title ?? (index === 0 ? settings.title : undefined);
    const properties =
      record.properties ?? (index === 0 ? settings.properties : undefined);
    const doc: RecordValue = {
      format: LEDGER_FORMAT,
      exportedAt: root.exportedAt,
      project: name,
      settings: {
        domain: settings.domain,
        ...(title !== undefined ? { title } : {}),
        ...(properties !== undefined ? { properties } : {}),
      },
      sshKeys: [],
      deviceKeys: [],
    };
    for (const field of PROJECT_COLLECTIONS) {
      doc[field] = arrayValue(root[field])
        .filter((entity) => projectOf(entity) === name)
        .map(strip);
    }
    const deviceKeys = arrayValue(root.deviceKeys).filter(
      (deviceKey) =>
        isRecord(deviceKey) &&
        deviceProject.get(textValue(deviceKey.device)) === name,
    );
    doc.deviceKeys = deviceKeys;
    const usedKeys = new Set(
      deviceKeys.map((deviceKey) =>
        isRecord(deviceKey) ? textValue(deviceKey.publicKey) : "",
      ),
    );
    doc.sshKeys = arrayValue(root.sshKeys).filter(
      (key) => isRecord(key) && usedKeys.has(textValue(key.publicKey)),
    );
    return doc;
  });
}
