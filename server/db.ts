import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiMembership,
  PortalApiNetwork,
  PortalApiRelation,
  PortalApiRelationName,
  PortalApiService,
  PortalMembershipInput,
  PortalNetworkInput,
  PortalProperties,
  PortalRelationInput,
  PortalRelationNameInput,
  PortalServiceInput,
  PortalDeviceInput,
} from "../src/portal/types";
import { normalizeServiceIconReference } from "../src/portal/iconCatalog";
import { resolveRelationLabel } from "../src/portal/relationLabels";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";
import { normalizeProperties } from "../src/portal/validation";

type DbOptions = {
  filename?: string;
  schemaPath?: string;
  seedPath?: string;
  devicePetnameMigrationPath?: string;
  relationNamesMigrationPath?: string;
  relationPlaceholdersMigrationPath?: string;
};

type NetworkRow = {
  id: number;
  name: string;
  cidr: string | null;
  accent: string;
  note: string | null;
};

type DeviceRow = {
  id: number;
  hostname: string;
  petname: string | null;
  category: PortalApiDevice["category"];
  is_vm: number;
  ssh_user: string | null;
  ssh_port: number | null;
  meter_enabled: number;
  note: string | null;
  properties: string;
};

type MembershipRow = {
  id: number;
  device_id: number;
  network_id: number;
  ip: string | null;
  label: string | null;
};

type ServiceRow = {
  id: number;
  device_network_id: number;
  subdomain: string;
  petname: string | null;
  description: string | null;
  port: number;
  protocol: PortalApiService["protocol"];
  scheme: PortalApiService["scheme"];
  top_path: string | null;
  monitor_path: string | null;
  service_url: string | null;
  icon_key: string | null;
  favicon_url: string | null;
  enabled: number;
  ip: string | null;
  properties: string;
};

type RelationRow = {
  id: number;
  relation_name_id: number;
  relation_name: string;
  from_device_id: number;
  to_device_id: number;
  from_label: string | null;
  to_label: string | null;
  from_placeholder: string;
  to_placeholder: string;
  color: string;
};

type RelationNameRow = {
  id: number;
  name: string;
  color: string;
  from_label: string | null;
  to_label: string | null;
  relation_count: number;
};

function asNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function parseProperties(value: string | null): PortalProperties {
  if (!value) {
    return {};
  }
  try {
    return normalizeProperties(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

function serializeProperties(value: unknown): string {
  return JSON.stringify(normalizeProperties(value));
}

function toApiNetwork(row: NetworkRow): PortalApiNetwork {
  return {
    id: asNumber(row.id),
    name: row.name,
    cidr: row.cidr,
    accent: row.accent,
    note: row.note,
  };
}

function toApiMembership(row: MembershipRow): PortalApiMembership {
  return {
    id: asNumber(row.id),
    deviceId: asNumber(row.device_id),
    networkId: asNumber(row.network_id),
    ip: row.ip,
    label: row.label,
  };
}

function toApiDevice(
  row: DeviceRow,
  memberships: PortalApiMembership[],
): PortalApiDevice {
  return {
    id: asNumber(row.id),
    hostname: row.hostname,
    petname: row.petname,
    category: row.category,
    isVm: Boolean(row.is_vm),
    sshUser: row.ssh_user,
    sshPort: row.ssh_port === null ? null : asNumber(row.ssh_port),
    meterEnabled: Boolean(row.meter_enabled),
    note: row.note,
    properties: parseProperties(row.properties),
    memberships,
  };
}

function toApiService(row: ServiceRow): PortalApiService {
  const base = {
    scheme: row.scheme,
    port: row.port,
    topPath: row.top_path ?? "",
    monitorPath: row.monitor_path ?? "",
    serviceUrl: row.service_url ?? "",
  };
  return {
    id: asNumber(row.id),
    deviceNetworkId: asNumber(row.device_network_id),
    subdomain: row.subdomain,
    petname: row.petname,
    description: row.description,
    properties: parseProperties(row.properties),
    port: row.port,
    protocol: row.protocol,
    scheme: row.scheme,
    topPath: row.top_path,
    monitorPath: row.monitor_path,
    serviceUrl: row.service_url,
    iconKey: normalizeServiceIconReference(
      row.icon_key,
      row.favicon_url,
      "favicon",
    ),
    enabled: Boolean(row.enabled),
    url: buildServiceUrl(base, { ip: row.ip ?? "" }),
    monitorUrl: buildMonitorUrl(base, { ip: row.ip ?? "" }),
  };
}

function toApiRelation(row: RelationRow): PortalApiRelation {
  const relationName = row.relation_name;
  return {
    id: asNumber(row.id),
    relationNameId: asNumber(row.relation_name_id),
    relationName,
    fromDeviceId: asNumber(row.from_device_id),
    toDeviceId: asNumber(row.to_device_id),
    fromPlaceholder: row.from_placeholder,
    toPlaceholder: row.to_placeholder,
    fromLabel: resolveRelationLabel(
      row.from_label,
      row.from_placeholder,
      relationName,
    ),
    toLabel: resolveRelationLabel(
      row.to_label,
      row.to_placeholder,
      relationName,
    ),
    color: row.color,
  };
}

function toApiRelationName(row: RelationNameRow): PortalApiRelationName {
  return {
    id: asNumber(row.id),
    name: row.name,
    color: row.color,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    relationCount: asNumber(row.relation_count),
  };
}

const RELATION_SELECT = `
  SELECT r.id, n.id AS relation_name_id, n.name AS relation_name,
         n.color, n.from_label, n.to_label,
         r.from_device_id, r.to_device_id,
         r.from_placeholder, r.to_placeholder
  FROM relations r
  JOIN relation_names n ON n.id = r.relation_name_id
`;

const RELATION_NAME_SELECT = `
  SELECT n.id, n.name, n.color, n.from_label, n.to_label,
         COUNT(r.id) AS relation_count
  FROM relation_names n
  LEFT JOIN relations r ON r.relation_name_id = n.id
`;

export class PortalDatabase {
  readonly database: DatabaseSync;
  readonly filename: string;

  constructor(options: DbOptions = {}) {
    const root = process.cwd();
    const filename = options.filename ?? resolve(root, "data", "ouchi.sqlite");
    this.filename = filename;
    if (filename !== ":memory:") {
      mkdirSync(dirname(filename), { recursive: true });
    }

    this.database = new DatabaseSync(filename);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA busy_timeout = 5000");
    if (filename !== ":memory:") {
      this.database.exec("PRAGMA journal_mode = WAL");
      this.database.exec("PRAGMA synchronous = NORMAL");
    }

    const schemaPath =
      options.schemaPath ?? resolve(root, "contract-v1", "schema.sql");
    const seedPath =
      options.seedPath ?? resolve(root, "contract-v1", "seed.sql");
    this.database.exec(readFileSync(schemaPath, "utf8"));
    const devicePetnameMigrationPath =
      options.devicePetnameMigrationPath ??
      resolve(
        root,
        "contract-v1",
        "migrations",
        "001_add_device_petname.sql",
      );
    const deviceColumns = this.database
      .prepare("PRAGMA table_info(devices)")
      .all() as Array<{ name: string }>;
    if (!deviceColumns.some((column) => column.name === "petname")) {
      this.database.exec(readFileSync(devicePetnameMigrationPath, "utf8"));
    }
    const ensureColumn = (
      table: "devices" | "services",
      column: "properties",
      migrationFile: string,
    ) => {
      const columns = this.database
        .prepare(`PRAGMA table_info(${table})`)
        .all() as Array<{ name: string }>;
      if (!columns.some((item) => item.name === column)) {
        this.database.exec(
          readFileSync(
            resolve(root, "contract-v1", "migrations", migrationFile),
            "utf8",
          ),
        );
      }
    };
    ensureColumn("devices", "properties", "002_add_device_properties.sql");
    ensureColumn("services", "properties", "003_add_service_properties.sql");
    let relationColumns = this.database
      .prepare("PRAGMA table_info(relations)")
      .all() as Array<{ name: string }>;
    if (relationColumns.some((column) => column.name === "tag")) {
      const relationNamesMigrationPath =
        options.relationNamesMigrationPath ??
        resolve(
          root,
          "contract-v1",
          "migrations",
          "004_relation_names.sql",
        );
      this.database.exec(readFileSync(relationNamesMigrationPath, "utf8"));
      relationColumns = this.database
        .prepare("PRAGMA table_info(relations)")
        .all() as Array<{ name: string }>;
    }
    if (
      !relationColumns.some(
        (column) => column.name === "from_placeholder",
      ) ||
      !relationColumns.some(
        (column) => column.name === "to_placeholder",
      )
    ) {
      const relationPlaceholdersMigrationPath =
        options.relationPlaceholdersMigrationPath ??
        resolve(
          root,
          "contract-v1",
          "migrations",
          "005_relation_placeholders.sql",
        );
      this.database.exec(
        readFileSync(relationPlaceholdersMigrationPath, "utf8"),
      );
    }

    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM networks")
      .get() as { count: number };
    if (row.count === 0) {
      this.database.exec(readFileSync(seedPath, "utf8"));
    }
  }

  close() {
    this.database.close();
  }

  listNetworks(): PortalApiNetwork[] {
    return (
      this.database
        .prepare(
          "SELECT id, name, cidr, accent, note FROM networks ORDER BY id",
        )
        .all() as NetworkRow[]
    ).map(toApiNetwork);
  }

  getNetwork(id: number): PortalApiNetwork | undefined {
    const row = this.database
      .prepare(
        "SELECT id, name, cidr, accent, note FROM networks WHERE id = ?",
      )
      .get(id) as NetworkRow | undefined;
    return row ? toApiNetwork(row) : undefined;
  }

  createNetwork(input: PortalNetworkInput): PortalApiNetwork {
    const result = this.database
      .prepare(
        "INSERT INTO networks (name, cidr, accent, note) VALUES (?, ?, ?, ?)",
      )
      .run(
        input.name.trim(),
        nullableText(input.cidr),
        input.accent.trim(),
        nullableText(input.note),
      );
    return this.getNetwork(asNumber(result.lastInsertRowid))!;
  }

  updateNetwork(id: number, input: PortalNetworkInput): PortalApiNetwork | undefined {
    if (!this.getNetwork(id)) {
      return undefined;
    }
    this.database
      .prepare(
        "UPDATE networks SET name = ?, cidr = ?, accent = ?, note = ? WHERE id = ?",
      )
      .run(
        input.name.trim(),
        nullableText(input.cidr),
        input.accent.trim(),
        nullableText(input.note),
        id,
      );
    return this.getNetwork(id);
  }

  networkDeletionBlockers(id: number): { memberships: number } {
    const row = this.database
      .prepare(
        "SELECT COUNT(*) AS count FROM device_networks WHERE network_id = ?",
      )
      .get(id) as { count: number };
    return { memberships: row.count };
  }

  deleteNetwork(id: number): boolean {
    return asNumber(
      this.database.prepare("DELETE FROM networks WHERE id = ?").run(id).changes,
    ) > 0;
  }

  listDevices(): PortalApiDevice[] {
    const rows = this.database
      .prepare(
        `SELECT id, hostname, petname, category, is_vm, ssh_user, ssh_port,
                meter_enabled, note, properties
         FROM devices ORDER BY id`,
      )
      .all() as DeviceRow[];
    const memberships = this.database
      .prepare(
        `SELECT id, device_id, network_id, ip, label
         FROM device_networks ORDER BY id`,
      )
      .all() as MembershipRow[];
    const byDevice = new Map<number, PortalApiMembership[]>();
    for (const row of memberships) {
      const list = byDevice.get(asNumber(row.device_id)) ?? [];
      list.push(toApiMembership(row));
      byDevice.set(asNumber(row.device_id), list);
    }
    return rows.map((row) =>
      toApiDevice(row, byDevice.get(asNumber(row.id)) ?? []),
    );
  }

  getDevice(id: number): PortalApiDevice | undefined {
    return this.listDevices().find((device) => device.id === id);
  }

  createDevice(input: PortalDeviceInput): PortalApiDevice {
    const result = this.database
      .prepare(
        `INSERT INTO devices
          (hostname, petname, category, is_vm, ssh_user, ssh_port,
           meter_enabled, note, properties)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.hostname.trim(),
        nullableText(input.petname),
        input.category,
        input.isVm ? 1 : 0,
        nullableText(input.sshUser),
        input.sshPort ?? null,
        input.meterEnabled ? 1 : 0,
        nullableText(input.note),
        serializeProperties(input.properties),
      );
    return this.getDevice(asNumber(result.lastInsertRowid))!;
  }

  updateDevice(
    id: number,
    input: PortalDeviceInput,
  ): PortalApiDevice | undefined {
    if (!this.getDevice(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE devices
         SET hostname = ?, petname = ?, category = ?, is_vm = ?, ssh_user = ?,
             ssh_port = ?, meter_enabled = ?, note = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        input.hostname.trim(),
        nullableText(input.petname),
        input.category,
        input.isVm ? 1 : 0,
        nullableText(input.sshUser),
        input.sshPort ?? null,
        input.meterEnabled ? 1 : 0,
        nullableText(input.note),
        Object.hasOwn(input, "properties")
          ? serializeProperties(input.properties)
          : null,
        id,
      );
    return this.getDevice(id);
  }

  deviceCascadeCounts(
    id: number,
  ): { memberships: number; services: number; relations: number } {
    const membershipRow = this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM device_networks
         WHERE device_id = ?`,
      )
      .get(id) as { count: number };
    const serviceRow = this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM services s
         JOIN device_networks dn ON dn.id = s.device_network_id
         WHERE dn.device_id = ?`,
      )
      .get(id) as { count: number };
    const relationRow = this.database
      .prepare(
        `SELECT COUNT(*) AS count FROM relations
         WHERE from_device_id = ? OR to_device_id = ?`,
      )
      .get(id, id) as { count: number };
    return {
      memberships: asNumber(membershipRow.count),
      services: asNumber(serviceRow.count),
      relations: asNumber(relationRow.count),
    };
  }

  deleteDevice(id: number): boolean {
    let transactionOpen = false;
    this.database.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    try {
      const device = this.database
        .prepare("SELECT id FROM devices WHERE id = ?")
        .get(id);
      if (!device) {
        this.database.exec("COMMIT");
        transactionOpen = false;
        return false;
      }

      this.database
        .prepare(
          `DELETE FROM relations
           WHERE from_device_id = ? OR to_device_id = ?`,
        )
        .run(id, id);
      this.database
        .prepare(
          `DELETE FROM services
           WHERE device_network_id IN (
             SELECT id FROM device_networks WHERE device_id = ?
           )`,
        )
        .run(id);
      this.database
        .prepare("DELETE FROM device_networks WHERE device_id = ?")
        .run(id);
      this.database
        .prepare("DELETE FROM device_keys WHERE device_id = ?")
        .run(id);
      const result = this.database
        .prepare("DELETE FROM devices WHERE id = ?")
        .run(id);

      this.database.exec("COMMIT");
      transactionOpen = false;
      return asNumber(result.changes) > 0;
    } catch (error) {
      if (transactionOpen) {
        this.database.exec("ROLLBACK");
      }
      throw error;
    }
  }

  listMemberships(): PortalApiMembership[] {
    return (
      this.database
        .prepare(
          `SELECT id, device_id, network_id, ip, label
           FROM device_networks ORDER BY id`,
        )
        .all() as MembershipRow[]
    ).map(toApiMembership);
  }

  getMembership(id: number): PortalApiMembership | undefined {
    const row = this.database
      .prepare(
        `SELECT id, device_id, network_id, ip, label
         FROM device_networks WHERE id = ?`,
      )
      .get(id) as MembershipRow | undefined;
    return row ? toApiMembership(row) : undefined;
  }

  createMembership(input: PortalMembershipInput): PortalApiMembership {
    const result = this.database
      .prepare(
        `INSERT INTO device_networks (device_id, network_id, ip, label)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.deviceId,
        input.networkId,
        nullableText(input.ip),
        nullableText(input.label),
      );
    return this.getMembership(asNumber(result.lastInsertRowid))!;
  }

  updateMembership(
    id: number,
    input: PortalMembershipInput,
  ): PortalApiMembership | undefined {
    if (!this.getMembership(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE device_networks
         SET device_id = ?, network_id = ?, ip = ?, label = ?
         WHERE id = ?`,
      )
      .run(
        input.deviceId,
        input.networkId,
        nullableText(input.ip),
        nullableText(input.label),
        id,
      );
    return this.getMembership(id);
  }

  membershipServiceCount(id: number): number {
    return (
      this.database
        .prepare(
          "SELECT COUNT(*) AS count FROM services WHERE device_network_id = ?",
        )
        .get(id) as { count: number }
    ).count;
  }

  deleteMembership(id: number): boolean {
    return asNumber(
      this.database
        .prepare("DELETE FROM device_networks WHERE id = ?")
        .run(id).changes,
    ) > 0;
  }

  listServices(): PortalApiService[] {
    return (
      this.database
        .prepare(
          `SELECT s.id, s.device_network_id, s.subdomain, s.petname,
                  s.description, s.port, s.protocol, s.scheme, s.top_path,
                  s.monitor_path, s.service_url, s.icon_key, s.favicon_url,
                  s.properties, s.enabled,
                  dn.ip
           FROM services s
           JOIN device_networks dn ON dn.id = s.device_network_id
           ORDER BY s.id`,
        )
        .all() as ServiceRow[]
    ).map(toApiService);
  }

  getService(id: number): PortalApiService | undefined {
    return this.listServices().find((service) => service.id === id);
  }

  createService(input: PortalServiceInput): PortalApiService {
    const result = this.database
      .prepare(
        `INSERT INTO services
          (device_network_id, subdomain, petname, description, port, protocol,
           scheme, top_path, monitor_path, service_url, icon_key,
           favicon_url, properties, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.deviceNetworkId,
        input.subdomain.trim().toLowerCase(),
        nullableText(input.petname),
        nullableText(input.description),
        input.port,
        input.protocol,
        input.scheme,
        nullableText(input.topPath),
        nullableText(input.monitorPath),
        nullableText(input.serviceUrl),
        normalizeServiceIconReference(
          input.iconKey,
          undefined,
          "favicon",
        ),
        null,
        serializeProperties(input.properties),
        input.enabled ? 1 : 0,
      );
    return this.getService(asNumber(result.lastInsertRowid))!;
  }

  updateService(
    id: number,
    input: PortalServiceInput,
  ): PortalApiService | undefined {
    if (!this.getService(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE services
         SET device_network_id = ?, subdomain = ?, petname = ?,
             description = ?, port = ?, protocol = ?, scheme = ?,
             top_path = ?, monitor_path = ?, service_url = ?, icon_key = ?,
             favicon_url = ?, enabled = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        input.deviceNetworkId,
        input.subdomain.trim().toLowerCase(),
        nullableText(input.petname),
        nullableText(input.description),
        input.port,
        input.protocol,
        input.scheme,
        nullableText(input.topPath),
        nullableText(input.monitorPath),
        nullableText(input.serviceUrl),
        normalizeServiceIconReference(
          input.iconKey,
          undefined,
          "favicon",
        ),
        null,
        input.enabled ? 1 : 0,
        Object.hasOwn(input, "properties")
          ? serializeProperties(input.properties)
          : null,
        id,
      );
    return this.getService(id);
  }

  deleteService(id: number): boolean {
    return asNumber(
      this.database.prepare("DELETE FROM services WHERE id = ?").run(id).changes,
    ) > 0;
  }

  listRelations(): PortalApiRelation[] {
    return (
      this.database
        .prepare(
          `${RELATION_SELECT} ORDER BY r.id`,
        )
        .all() as RelationRow[]
    ).map(toApiRelation);
  }

  getRelation(id: number): PortalApiRelation | undefined {
    const row = this.database
      .prepare(
        `${RELATION_SELECT} WHERE r.id = ?`,
      )
      .get(id) as RelationRow | undefined;
    return row ? toApiRelation(row) : undefined;
  }

  listRelationNames(): PortalApiRelationName[] {
    return (
      this.database
        .prepare(
          `${RELATION_NAME_SELECT}
           GROUP BY n.id
           ORDER BY n.id`,
        )
        .all() as RelationNameRow[]
    ).map(toApiRelationName);
  }

  getRelationName(id: number): PortalApiRelationName | undefined {
    const row = this.database
      .prepare(
        `${RELATION_NAME_SELECT}
         WHERE n.id = ?
         GROUP BY n.id`,
      )
      .get(id) as RelationNameRow | undefined;
    return row ? toApiRelationName(row) : undefined;
  }

  findRelationName(name: string): PortalApiRelationName | undefined {
    const row = this.database
      .prepare(
        `${RELATION_NAME_SELECT}
         WHERE n.name = ?
         GROUP BY n.id`,
      )
      .get(name.trim()) as RelationNameRow | undefined;
    return row ? toApiRelationName(row) : undefined;
  }

  createRelationName(
    input: PortalRelationNameInput,
  ): PortalApiRelationName {
    const result = this.database
      .prepare(
        `INSERT INTO relation_names (name, color, from_label, to_label)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.name.trim(),
        input.color.trim(),
        nullableText(input.fromLabel),
        nullableText(input.toLabel),
      );
    return this.getRelationName(asNumber(result.lastInsertRowid))!;
  }

  updateRelationName(
    id: number,
    input: PortalRelationNameInput,
  ): PortalApiRelationName | undefined {
    if (!this.getRelationName(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE relation_names
         SET name = ?, color = ?, from_label = ?, to_label = ?
         WHERE id = ?`,
      )
      .run(
        input.name.trim(),
        input.color.trim(),
        nullableText(input.fromLabel),
        nullableText(input.toLabel),
        id,
      );
    return this.getRelationName(id);
  }

  relationNameDeletionBlocker(id: number): {
    relationCount: number;
  } {
    const row = this.database
      .prepare(
        `SELECT COUNT(*) AS count FROM relations
         WHERE relation_name_id = ?`,
      )
      .get(id) as { count: number };
    return { relationCount: row.count };
  }

  deleteRelationName(id: number): boolean {
    return asNumber(
      this.database
        .prepare("DELETE FROM relation_names WHERE id = ?")
        .run(id).changes,
    ) > 0;
  }

  createRelation(input: PortalRelationInput): PortalApiRelation {
    const relationName = this.findRelationName(input.relationName);
    if (!relationName) {
      throw new Error(`relation name not found: ${input.relationName}`);
    }
    const result = this.database
      .prepare(
        `INSERT INTO relations
          (relation_name_id, from_device_id, to_device_id,
           from_placeholder, to_placeholder)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        relationName.id,
        input.fromDeviceId,
        input.toDeviceId,
        input.fromPlaceholder?.trim() ?? "",
        input.toPlaceholder?.trim() ?? "",
      );
    return this.getRelation(asNumber(result.lastInsertRowid))!;
  }

  updateRelation(
    id: number,
    input: PortalRelationInput,
  ): PortalApiRelation | undefined {
    if (!this.getRelation(id)) {
      return undefined;
    }
    const relationName = this.findRelationName(input.relationName);
    if (!relationName) {
      throw new Error(`relation name not found: ${input.relationName}`);
    }
    this.database
      .prepare(
        `UPDATE relations
         SET relation_name_id = ?, from_device_id = ?, to_device_id = ?,
             from_placeholder = ?, to_placeholder = ?
         WHERE id = ?`,
      )
      .run(
        relationName.id,
        input.fromDeviceId,
        input.toDeviceId,
        input.fromPlaceholder?.trim() ?? "",
        input.toPlaceholder?.trim() ?? "",
        id,
      );
    return this.getRelation(id);
  }

  relationDuplicate(
    relationNameId: number,
    fromDeviceId: number,
    toDeviceId: number,
    fromPlaceholder: string,
    toPlaceholder: string,
    excludingId?: number,
  ): PortalApiRelation | undefined {
    const row = this.database
      .prepare(
        `${RELATION_SELECT}
         WHERE r.relation_name_id = ?
           AND r.from_device_id = ?
           AND r.to_device_id = ?
           AND r.from_placeholder = ?
           AND r.to_placeholder = ?
           ${excludingId === undefined ? "" : "AND r.id <> ?"}
         LIMIT 1`,
      )
      .get(
        relationNameId,
        fromDeviceId,
        toDeviceId,
        fromPlaceholder,
        toPlaceholder,
        ...(excludingId === undefined ? [] : [excludingId]),
      ) as RelationRow | undefined;
    return row ? toApiRelation(row) : undefined;
  }

  deleteRelation(id: number): boolean {
    return asNumber(
      this.database.prepare("DELETE FROM relations WHERE id = ?").run(id).changes,
    ) > 0;
  }

  traverseRelations(deviceId: number, depth: number) {
    const device = this.getDevice(deviceId);
    if (!device) {
      return undefined;
    }
    const rows = this.database
      .prepare(
        `${RELATION_SELECT}
         WHERE r.from_device_id = ? OR r.to_device_id = ?
         ORDER BY r.id`,
      )
      .all(deviceId, deviceId) as RelationRow[];
    const devices = this.listDevices();
    return {
      deviceId,
      depth,
      relations: rows.map((row) => {
        const relation = toApiRelation(row);
        const direction =
          relation.fromDeviceId === deviceId ? "outgoing" : "incoming";
        const relatedDeviceId =
          direction === "outgoing"
            ? relation.toDeviceId
            : relation.fromDeviceId;
        const label =
          direction === "outgoing"
            ? relation.fromLabel
            : relation.toLabel;
        return {
          ...relation,
          direction,
          label,
          relatedDevice:
            devices.find((candidate) => candidate.id === relatedDeviceId) ??
            null,
        };
      }),
    };
  }

  getSettings(): PortalApiData["settings"] {
    const row = this.database
      .prepare("SELECT domain, title FROM settings WHERE id = 1")
      .get() as { domain: string; title: string } | undefined;
    return {
      domain: row?.domain ?? "ouchi.local",
      title: row?.title ?? "あなたのホームラボ",
    };
  }

  updateSettings(title: string): PortalApiData["settings"] {
    this.database
      .prepare(
        `INSERT INTO settings (id, domain, title)
         VALUES (1, 'ouchi.local', ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title`,
      )
      .run(title.trim());
    return this.getSettings();
  }

  getPortalData(): PortalApiData {
    return {
      version: 2,
      networks: this.listNetworks(),
      devices: this.listDevices(),
      services: this.listServices(),
      relationNames: this.listRelationNames(),
      relations: this.listRelations(),
      settings: this.getSettings(),
    };
  }
}
