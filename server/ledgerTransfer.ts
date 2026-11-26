import type { DatabaseSync } from "node:sqlite";
import { stringify } from "yaml";
import { normalizeServiceIconReference } from "../src/portal/iconCatalog";
import type {
  PortalDeviceInput,
  PortalLineEndpointShape,
  PortalServiceInput,
} from "../src/portal/types";
import { LEDGER_FORMAT } from "./ledgerTypes";
import type {
  LedgerDocument,
  LedgerImportCounts,
  LedgerInterface,
  LedgerRelationEndpoint,
} from "./ledgerTypes";
import { parseStoredProperties, parseYamlRoot } from "./ledgerValues";
import {
  upgradeLegacyLedgerDocument,
  upgradeV10LedgerDocument,
  upgradeV11LedgerDocument,
  upgradeV12LedgerDocument,
  upgradeV2LedgerDocument,
  upgradeV3LedgerDocument,
  upgradeV4LedgerDocument,
  upgradeV5LedgerDocument,
  upgradeV6LedgerDocument,
  upgradeV7LedgerDocument,
  upgradeV8LedgerDocument,
  upgradeV9LedgerDocument,
} from "./ledgerUpgrade";
import { validateDocument } from "./ledgerValidate";

export * from "./ledgerTypes";
export * from "./ledgerUpgrade";

type NetworkRow = {
  name: string;
  cidr: string | null;
  accent: string | null;
  note: string | null;
  properties: string;
  sort_order: number;
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
  from_hostname: string | null;
  from_interface: string | null;
  from_service: string | null;
  to_hostname: string | null;
  to_interface: string | null;
  to_service: string | null;
  relation_name: string;
  from_label: string;
  to_label: string;
  port: number | null;
  protocol: PortalServiceInput["protocol"] | null;
  properties: string;
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

export function parseLedgerYaml(input: string): LedgerDocument {
  return validateDocument(
    upgradeV12LedgerDocument(
    upgradeV11LedgerDocument(
    upgradeV10LedgerDocument(
      upgradeV9LedgerDocument(
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
    .prepare("SELECT domain, title, properties FROM settings WHERE id = 1")
    .get() as
    | { domain: string; title: string; properties: string }
    | undefined;
  const networks = database
    .prepare(
      `SELECT name, cidr, accent, note, properties, sort_order
       FROM networks ORDER BY sort_order, id`,
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
              fs.subdomain AS from_service,
              td.hostname AS to_hostname, ti.name AS to_interface,
              ts.subdomain AS to_service,
              n.name AS relation_name,
              r.from_label, r.to_label, r.port, r.protocol, r.properties
       FROM relations r
       JOIN relation_names n ON n.id = r.relation_name_id
       LEFT JOIN interfaces fi ON fi.id = r.from_interface_id
       LEFT JOIN devices fd ON fd.id = fi.device_id
       LEFT JOIN services fs ON fs.id = r.from_service_id
       LEFT JOIN interfaces ti ON ti.id = r.to_interface_id
       LEFT JOIN devices td ON td.id = ti.device_id
       LEFT JOIN services ts ON ts.id = r.to_service_id
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
      properties: parseStoredProperties(settings?.properties ?? "{}"),
    },
    networks: networks.map((network) => ({
      name: network.name,
      cidr: network.cidr,
      accent: network.accent ?? "",
      note: network.note,
      properties: parseStoredProperties(network.properties),
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
      from: relation.from_service
        ? { service: relation.from_service }
        : {
            device: relation.from_hostname!,
            interface: relation.from_interface!,
          },
      to: relation.to_service
        ? { service: relation.to_service }
        : {
            device: relation.to_hostname!,
            interface: relation.to_interface!,
          },
      relationName: relation.relation_name,
      ...(relation.from_label
        ? { fromLabel: relation.from_label }
        : {}),
      ...(relation.to_label
        ? { toLabel: relation.to_label }
        : {}),
      ...(relation.port !== null
        ? { port: relation.port, protocol: relation.protocol! }
        : {}),
      properties: parseStoredProperties(relation.properties),
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
      .prepare(
        "INSERT INTO settings (id, domain, title, properties) VALUES (1, ?, ?, ?)",
      )
      .run(
        document.settings.domain,
        document.settings.title,
        JSON.stringify(document.settings.properties),
      );

    const networkIds = new Map<string, number>();
    const insertNetwork = database.prepare(
      `INSERT INTO networks (name, cidr, accent, note, properties, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    document.networks.forEach((network, index) => {
      const result = insertNetwork.run(
        network.name,
        network.cidr,
        network.accent,
        network.note,
        JSON.stringify(network.properties),
        (index + 1) * 10,
      );
      networkIds.set(network.name, asNumber(result.lastInsertRowid));
    });

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

    const insertService = database.prepare(
      `INSERT INTO services
        (interface_id, subdomain, petname, description, port, protocol,
         scheme, top_path, monitor_path, service_url, icon_key, favicon_url,
         properties, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const serviceIds = new Map<string, number>();
    for (const service of document.services) {
      const result = insertService.run(
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
      serviceIds.set(service.subdomain, asNumber(result.lastInsertRowid));
    }

    const insertRelation = database.prepare(
      `INSERT INTO relations
        (relation_name_id, from_interface_id, from_service_id,
         to_interface_id, to_service_id,
         from_label, to_label, port, protocol, properties)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const endpointIds = (endpoint: LedgerRelationEndpoint) =>
      "service" in endpoint
        ? {
            interfaceId: null,
            serviceId: serviceIds.get(endpoint.service)!,
          }
        : {
            interfaceId: interfaceIds.get(
              `${endpoint.device}\u0000${endpoint.interface}`,
            )!,
            serviceId: null,
          };
    for (const relation of document.relations) {
      const from = endpointIds(relation.from);
      const to = endpointIds(relation.to);
      insertRelation.run(
        relationNameIds.get(relation.relationName)!,
        from.interfaceId,
        from.serviceId,
        to.interfaceId,
        to.serviceId,
        relation.fromLabel ?? "",
        relation.toLabel ?? "",
        relation.port ?? null,
        relation.protocol ?? null,
        JSON.stringify(relation.properties),
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
