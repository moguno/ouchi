import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiMembership,
  PortalApiNetwork,
  PortalApiRelation,
  PortalApiService,
  PortalMembershipInput,
  PortalNetworkInput,
  PortalRelationInput,
  PortalServiceInput,
  PortalDeviceInput,
} from "../src/portal/types";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";

type DbOptions = {
  filename?: string;
  schemaPath?: string;
  seedPath?: string;
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
  category: PortalApiDevice["category"];
  is_vm: number;
  ssh_user: string | null;
  ssh_port: number | null;
  meter_enabled: number;
  note: string | null;
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
  enabled: number;
  ip: string | null;
};

type RelationRow = {
  id: number;
  from_device_id: number;
  to_device_id: number;
  tag: string | null;
  from_label: string | null;
  to_label: string | null;
  color: string;
};

function asNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
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
    category: row.category,
    isVm: Boolean(row.is_vm),
    sshUser: row.ssh_user,
    sshPort: row.ssh_port === null ? null : asNumber(row.ssh_port),
    meterEnabled: Boolean(row.meter_enabled),
    note: row.note,
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
    port: row.port,
    protocol: row.protocol,
    scheme: row.scheme,
    topPath: row.top_path,
    monitorPath: row.monitor_path,
    serviceUrl: row.service_url,
    iconKey: row.icon_key,
    enabled: Boolean(row.enabled),
    url: buildServiceUrl(base, { ip: row.ip ?? "" }),
    monitorUrl: buildMonitorUrl(base, { ip: row.ip ?? "" }),
  };
}

function toApiRelation(row: RelationRow): PortalApiRelation {
  return {
    id: asNumber(row.id),
    fromDeviceId: asNumber(row.from_device_id),
    toDeviceId: asNumber(row.to_device_id),
    tag: row.tag,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    color: row.color,
  };
}

export class PortalDatabase {
  readonly database: DatabaseSync;

  constructor(options: DbOptions = {}) {
    const root = process.cwd();
    const filename = options.filename ?? resolve(root, "data", "ouchi.sqlite");
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
        `SELECT id, hostname, category, is_vm, ssh_user, ssh_port,
                meter_enabled, note
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
          (hostname, category, is_vm, ssh_user, ssh_port, meter_enabled, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.hostname.trim(),
        input.category,
        input.isVm ? 1 : 0,
        nullableText(input.sshUser),
        input.sshPort ?? null,
        input.meterEnabled ? 1 : 0,
        nullableText(input.note),
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
         SET hostname = ?, category = ?, is_vm = ?, ssh_user = ?,
             ssh_port = ?, meter_enabled = ?, note = ?
         WHERE id = ?`,
      )
      .run(
        input.hostname.trim(),
        input.category,
        input.isVm ? 1 : 0,
        nullableText(input.sshUser),
        input.sshPort ?? null,
        input.meterEnabled ? 1 : 0,
        nullableText(input.note),
        id,
      );
    return this.getDevice(id);
  }

  deviceDeletionBlockers(
    id: number,
  ): { services: number; relations: number } {
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
      services: serviceRow.count,
      relations: relationRow.count,
    };
  }

  deleteDevice(id: number): boolean {
    return asNumber(
      this.database.prepare("DELETE FROM devices WHERE id = ?").run(id).changes,
    ) > 0;
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
                  s.monitor_path, s.service_url, s.icon_key, s.enabled,
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
           scheme, top_path, monitor_path, service_url, icon_key, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        nullableText(input.iconKey),
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
             enabled = ?
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
        nullableText(input.iconKey),
        input.enabled ? 1 : 0,
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
          `SELECT id, from_device_id, to_device_id, tag, from_label, to_label,
                  color
           FROM relations ORDER BY id`,
        )
        .all() as RelationRow[]
    ).map(toApiRelation);
  }

  createRelation(input: PortalRelationInput): PortalApiRelation {
    const result = this.database
      .prepare(
        `INSERT INTO relations
          (from_device_id, to_device_id, tag, from_label, to_label, color)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.fromDeviceId,
        input.toDeviceId,
        nullableText(input.tag),
        nullableText(input.fromLabel),
        nullableText(input.toLabel),
        input.color.trim(),
      );
    const row = this.database
      .prepare(
        `SELECT id, from_device_id, to_device_id, tag, from_label, to_label,
                color
         FROM relations WHERE id = ?`,
      )
      .get(asNumber(result.lastInsertRowid)) as RelationRow;
    return toApiRelation(row);
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
        `SELECT r.id, r.from_device_id, r.to_device_id, r.tag,
                r.from_label, r.to_label, r.color
         FROM relations r
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
            ? (relation.fromLabel ?? relation.tag)
            : (relation.toLabel ?? relation.tag);
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
      relations: this.listRelations(),
      settings: this.getSettings(),
    };
  }
}
