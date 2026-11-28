import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiInterface,
  PortalApiNetwork,
  PortalApiProject,
  PortalApiRelation,
  PortalApiRelationName,
  PortalApiService,
  PortalInterfaceInput,
  PortalNetworkInput,
  PortalProjectInput,
  PortalProperties,
  PortalRelationInput,
  PortalRelationNameInput,
  PortalServiceInput,
  PortalServiceProtocol,
  PortalDeviceInput,
} from "../src/portal/types";
import { normalizeServiceIconReference } from "../src/portal/iconCatalog";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";
import { projectColorFromName } from "../src/portal/colorValue";
import { applySchemaAndMigrations, type DbOptions } from "./dbSchema";
import {
  asNumber,
  nullableText,
  parseProperties,
  RELATION_NAME_SELECT,
  RELATION_SELECT,
  serializeProperties,
  toApiDevice,
  toApiInterface,
  toApiNetwork,
  toApiProject,
  toApiRelation,
  toApiRelationName,
  toApiService,
} from "./dbRows";
import type {
  DeviceRow,
  InterfaceRow,
  NetworkRow,
  ProjectRow,
  RelationNameRow,
  RelationRow,
  ServiceRow,
} from "./dbRows";

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
    applySchemaAndMigrations(this.database, options);
  }

  close() {
    this.database.close();
  }

  listProjects(): PortalApiProject[] {
    return (
      this.database
        .prepare(`SELECT id, name, title, color, properties FROM projects ORDER BY id`)
        .all() as ProjectRow[]
    ).map(toApiProject);
  }

  getProject(id: number): PortalApiProject | undefined {
    const row = this.database
      .prepare(`SELECT id, name, title, color, properties FROM projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;
    return row ? toApiProject(row) : undefined;
  }

  findProject(name: string): PortalApiProject | undefined {
    const row = this.database
      .prepare(`SELECT id, name, title, color, properties FROM projects WHERE name = ?`)
      .get(name.trim()) as ProjectRow | undefined;
    return row ? toApiProject(row) : undefined;
  }

  createProject(input: PortalProjectInput): PortalApiProject {
    const result = this.database
      .prepare(
        `INSERT INTO projects (name, title, color, properties) VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.name.trim(),
        input.title?.trim() || "あなたのホームラボ",
        input.color?.trim() || projectColorFromName(input.name),
        serializeProperties(input.properties ?? {}),
      );
    return this.getProject(asNumber(result.lastInsertRowid))!;
  }

  updateProject(
    id: number,
    input: PortalProjectInput,
  ): PortalApiProject | undefined {
    if (!this.getProject(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE projects
         SET name = ?,
             title = COALESCE(?, title),
             color = COALESCE(?, color),
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        input.name.trim(),
        Object.hasOwn(input, "title")
          ? (input.title?.trim() ?? null)
          : null,
        Object.hasOwn(input, "color")
          ? (input.color?.trim() ?? null)
          : null,
        Object.hasOwn(input, "properties")
          ? serializeProperties(input.properties)
          : null,
        id,
      );
    return this.getProject(id);
  }

  firstProject(): PortalApiProject | undefined {
    return this.listProjects()[0];
  }

  /**
   * Deletes a project with everything it holds: a project is one
   * whole ouchi and shares nothing with the others, so the cascade
   * is exactly the set of rows stamped with its id (plus the device
   * key links of its devices). Deleting the last project is allowed
   * and leaves an empty ledger.
   */
  deleteProject(id: number): boolean {
    let transactionOpen = false;
    this.database.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    try {
      const project = this.database
        .prepare("SELECT id FROM projects WHERE id = ?")
        .get(id);
      if (!project) {
        this.database.exec("COMMIT");
        transactionOpen = false;
        return false;
      }

      this.database
        .prepare(
          `DELETE FROM relations
           WHERE project_id = ?
              OR from_interface_id IN (
                SELECT id FROM interfaces WHERE project_id = ?
              )
              OR to_interface_id IN (
                SELECT id FROM interfaces WHERE project_id = ?
              )
              OR from_service_id IN (
                SELECT id FROM services WHERE project_id = ?
              )
              OR to_service_id IN (
                SELECT id FROM services WHERE project_id = ?
              )`,
        )
        .run(id, id, id, id, id);
      this.database
        .prepare("DELETE FROM relation_names WHERE project_id = ?")
        .run(id);
      this.database
        .prepare("DELETE FROM services WHERE project_id = ?")
        .run(id);
      this.database
        .prepare("DELETE FROM interfaces WHERE project_id = ?")
        .run(id);
      this.database
        .prepare(
          `DELETE FROM device_keys
           WHERE device_id IN (SELECT id FROM devices WHERE project_id = ?)`,
        )
        .run(id);
      this.database
        .prepare("DELETE FROM devices WHERE project_id = ?")
        .run(id);
      this.database
        .prepare("DELETE FROM networks WHERE project_id = ?")
        .run(id);
      const result = this.database
        .prepare("DELETE FROM projects WHERE id = ?")
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

  listNetworks(): PortalApiNetwork[] {
    return (
      this.database
        .prepare(
          `SELECT id, project_id, name, cidr, accent, note, properties, sort_order
           FROM networks ORDER BY sort_order, id`,
        )
        .all() as NetworkRow[]
    ).map(toApiNetwork);
  }

  getNetwork(id: number): PortalApiNetwork | undefined {
    const row = this.database
      .prepare(
        `SELECT id, project_id, name, cidr, accent, note, properties, sort_order
         FROM networks WHERE id = ?`,
      )
      .get(id) as NetworkRow | undefined;
    return row ? toApiNetwork(row) : undefined;
  }

  createNetwork(input: PortalNetworkInput): PortalApiNetwork {
    const result = this.database
      .prepare(
        `INSERT INTO networks (project_id, name, cidr, accent, note, properties, sort_order)
         VALUES (?, ?, ?, ?, ?,
                 ?,
                 (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM networks))`,
      )
      .run(
        input.projectId ?? 1,
        input.name.trim(),
        nullableText(input.cidr),
        input.accent.trim(),
        nullableText(input.note),
        serializeProperties(input.properties ?? {}),
      );
    return this.getNetwork(asNumber(result.lastInsertRowid))!;
  }

  updateNetwork(id: number, input: PortalNetworkInput): PortalApiNetwork | undefined {
    if (!this.getNetwork(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE networks
         SET project_id = COALESCE(?, project_id),
             name = ?, cidr = ?, accent = ?, note = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        Object.hasOwn(input, "projectId") ? (input.projectId ?? null) : null,
        input.name.trim(),
        nullableText(input.cidr),
        input.accent.trim(),
        nullableText(input.note),
        Object.hasOwn(input, "properties")
          ? serializeProperties(input.properties)
          : null,
        id,
      );
    return this.getNetwork(id);
  }

  reorderNetworks(ids: number[]): PortalApiNetwork[] | undefined {
    const current = this.listNetworks();
    const currentIds = new Set(current.map((network) => network.id));
    if (
      ids.length !== currentIds.size ||
      !ids.every((id) => currentIds.has(id))
    ) {
      return undefined;
    }
    const update = this.database.prepare(
      "UPDATE networks SET sort_order = ? WHERE id = ?",
    );
    this.database.exec("BEGIN IMMEDIATE");
    try {
      ids.forEach((id, index) => {
        update.run((index + 1) * 10, id);
      });
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.listNetworks();
  }

  networkDeletionBlockers(id: number): { interfaces: number } {
    const row = this.database
      .prepare(
        "SELECT COUNT(*) AS count FROM interfaces WHERE network_id = ?",
      )
      .get(id) as { count: number };
    return { interfaces: row.count };
  }

  deleteNetwork(id: number): boolean {
    return asNumber(
      this.database.prepare("DELETE FROM networks WHERE id = ?").run(id).changes,
    ) > 0;
  }

  listDevices(): PortalApiDevice[] {
    const rows = this.database
      .prepare(
        `SELECT id, project_id, hostname, petname, category, ssh_user, ssh_port,
                meter_enabled, note, properties
         FROM devices ORDER BY id`,
      )
      .all() as DeviceRow[];
    const interfaceRows = this.database
      .prepare(
        `SELECT id, project_id, device_id, name, network_id, ip, mac, properties
         FROM interfaces ORDER BY id`,
      )
      .all() as InterfaceRow[];
    const byDevice = new Map<number, PortalApiInterface[]>();
    for (const row of interfaceRows) {
      const list = byDevice.get(asNumber(row.device_id)) ?? [];
      list.push(toApiInterface(row));
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
          (project_id, hostname, petname, category, ssh_user, ssh_port,
           meter_enabled, note, properties)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId ?? 1,
        input.hostname.trim(),
        nullableText(input.petname),
        input.category,
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
         SET project_id = COALESCE(?, project_id),
             hostname = ?, petname = ?, category = ?, ssh_user = ?,
             ssh_port = ?, meter_enabled = ?, note = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        Object.hasOwn(input, "projectId") ? (input.projectId ?? null) : null,
        input.hostname.trim(),
        nullableText(input.petname),
        input.category,
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
  ): { interfaces: number; services: number; relations: number } {
    const interfaceRow = this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM interfaces
         WHERE device_id = ?`,
      )
      .get(id) as { count: number };
    const serviceRow = this.database
      .prepare(
        `SELECT COUNT(*) AS count
         FROM services s
         JOIN interfaces i ON i.id = s.interface_id
         WHERE i.device_id = ?`,
      )
      .get(id) as { count: number };
    const relationRow = this.database
      .prepare(
        `SELECT COUNT(*) AS count FROM relations r
         JOIN interfaces fi ON fi.id = r.from_interface_id
         JOIN interfaces ti ON ti.id = r.to_interface_id
         WHERE fi.device_id = ? OR ti.device_id = ?`,
      )
      .get(id, id) as { count: number };
    return {
      interfaces: asNumber(interfaceRow.count),
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
           WHERE from_interface_id IN (
             SELECT id FROM interfaces WHERE device_id = ?
           )
           OR to_interface_id IN (
             SELECT id FROM interfaces WHERE device_id = ?
           )
           OR from_service_id IN (
             SELECT s.id FROM services s
             JOIN interfaces i ON i.id = s.interface_id
             WHERE i.device_id = ?
           )
           OR to_service_id IN (
             SELECT s.id FROM services s
             JOIN interfaces i ON i.id = s.interface_id
             WHERE i.device_id = ?
           )`,
        )
        .run(id, id, id, id);
      this.database
        .prepare(
          `DELETE FROM services
           WHERE interface_id IN (
             SELECT id FROM interfaces WHERE device_id = ?
           )`,
        )
        .run(id);
      this.database
        .prepare("DELETE FROM interfaces WHERE device_id = ?")
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

  listInterfaces(): PortalApiInterface[] {
    return (
      this.database
        .prepare(
          `SELECT id, project_id, device_id, name, network_id, ip, mac, properties
           FROM interfaces ORDER BY id`,
        )
        .all() as InterfaceRow[]
    ).map(toApiInterface);
  }

  getInterface(id: number): PortalApiInterface | undefined {
    const row = this.database
      .prepare(
        `SELECT id, project_id, device_id, name, network_id, ip, mac, properties
         FROM interfaces WHERE id = ?`,
      )
      .get(id) as InterfaceRow | undefined;
    return row ? toApiInterface(row) : undefined;
  }

  createInterface(input: PortalInterfaceInput): PortalApiInterface {
    // An interface is part of its device: without an explicit
    // projectId it inherits the device's project.
    const projectId =
      input.projectId ?? this.getDevice(input.deviceId)?.projectId ?? 1;
    const result = this.database
      .prepare(
        `INSERT INTO interfaces (project_id, device_id, name, network_id, ip, mac, properties)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        projectId,
        input.deviceId,
        input.name.trim(),
        input.networkId,
        nullableText(input.ip),
        nullableText(input.mac),
        serializeProperties(input.properties ?? {}),
      );
    return this.getInterface(asNumber(result.lastInsertRowid))!;
  }

  updateInterface(
    id: number,
    input: PortalInterfaceInput,
  ): PortalApiInterface | undefined {
    if (!this.getInterface(id)) {
      return undefined;
    }
    this.database
      .prepare(
        `UPDATE interfaces
         SET project_id = COALESCE(?, project_id),
             device_id = ?, name = ?, network_id = ?, ip = ?, mac = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        Object.hasOwn(input, "projectId") ? (input.projectId ?? null) : null,
        input.deviceId,
        input.name.trim(),
        input.networkId,
        nullableText(input.ip),
        nullableText(input.mac),
        Object.hasOwn(input, "properties")
          ? serializeProperties(input.properties)
          : null,
        id,
      );
    return this.getInterface(id);
  }

  interfaceServiceCount(id: number): number {
    return (
      this.database
        .prepare(
          "SELECT COUNT(*) AS count FROM services WHERE interface_id = ?",
        )
        .get(id) as { count: number }
    ).count;
  }

  interfaceRelationCount(id: number): number {
    return (
      this.database
        .prepare(
          `SELECT COUNT(*) AS count FROM relations
           WHERE from_interface_id = ? OR to_interface_id = ?`,
        )
        .get(id, id) as { count: number }
    ).count;
  }

  deleteInterface(id: number): boolean {
    return asNumber(
      this.database
        .prepare("DELETE FROM interfaces WHERE id = ?")
        .run(id).changes,
    ) > 0;
  }

  listServices(): PortalApiService[] {
    return (
      this.database
        .prepare(
          `SELECT s.id, s.project_id, s.interface_id, s.subdomain, s.petname,
                  s.description, s.port, s.protocol, s.scheme, s.top_path,
                  s.monitor_path, s.service_url, s.icon_key, s.favicon_url,
                  s.properties, s.enabled,
                  i.ip
           FROM services s
           JOIN interfaces i ON i.id = s.interface_id
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
          (project_id, interface_id, subdomain, petname, description, port, protocol,
           scheme, top_path, monitor_path, service_url, icon_key,
           favicon_url, properties, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId ?? 1,
        input.interfaceId,
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
         SET project_id = COALESCE(?, project_id),
             interface_id = ?, subdomain = ?, petname = ?,
             description = ?, port = ?, protocol = ?, scheme = ?,
             top_path = ?, monitor_path = ?, service_url = ?, icon_key = ?,
             favicon_url = ?, enabled = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        Object.hasOwn(input, "projectId") ? (input.projectId ?? null) : null,
        input.interfaceId,
        input.subdomain.trim().toLowerCase(),
        nullableText(input.petname),
        nullableText(input.description),
        input.port,
        input.protocol,
        input.scheme,
        nullableText(input.topPath),
        nullableText(input.monitorPath),
        nullableText(input.serviceUrl),
        normalizeServiceIconReference(input.iconKey, undefined),
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
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const service = this.database
        .prepare("SELECT id FROM services WHERE id = ?")
        .get(id);
      if (!service) {
        this.database.exec("COMMIT");
        return false;
      }
      this.database
        .prepare(
          "DELETE FROM relations WHERE from_service_id = ? OR to_service_id = ?",
        )
        .run(id, id);
      this.database.prepare("DELETE FROM services WHERE id = ?").run(id);
      this.database.exec("COMMIT");
      return true;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
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
        `INSERT INTO relation_names (project_id, name, color, line_start, line_end)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId ?? 1,
        input.name.trim(),
        input.color.trim(),
        input.lineStart ?? "circle",
        input.lineEnd ?? "circle",
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
         SET project_id = COALESCE(?, project_id),
             name = ?, color = ?,
             line_start = COALESCE(?, line_start),
             line_end = COALESCE(?, line_end)
         WHERE id = ?`,
      )
      .run(
        Object.hasOwn(input, "projectId") ? (input.projectId ?? null) : null,
        input.name.trim(),
        input.color.trim(),
        input.lineStart ?? null,
        input.lineEnd ?? null,
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
          (project_id, relation_name_id, from_interface_id, from_service_id,
           to_interface_id, to_service_id,
           from_label, to_label, port, protocol, properties)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId ?? 1,
        relationName.id,
        input.fromInterfaceId ?? null,
        input.fromServiceId ?? null,
        input.toInterfaceId ?? null,
        input.toServiceId ?? null,
        input.fromLabel?.trim() ?? "",
        input.toLabel?.trim() ?? "",
        input.port ?? null,
        input.protocol ?? null,
        serializeProperties(input.properties),
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
         SET project_id = COALESCE(?, project_id),
             relation_name_id = ?, from_interface_id = ?, from_service_id = ?,
             to_interface_id = ?, to_service_id = ?,
             from_label = ?, to_label = ?,
             port = ?, protocol = ?,
             properties = COALESCE(?, properties)
         WHERE id = ?`,
      )
      .run(
        Object.hasOwn(input, "projectId") ? (input.projectId ?? null) : null,
        relationName.id,
        input.fromInterfaceId ?? null,
        input.fromServiceId ?? null,
        input.toInterfaceId ?? null,
        input.toServiceId ?? null,
        input.fromLabel?.trim() ?? "",
        input.toLabel?.trim() ?? "",
        input.port ?? null,
        input.protocol ?? null,
        Object.hasOwn(input, "properties")
          ? serializeProperties(input.properties)
          : null,
        id,
      );
    return this.getRelation(id);
  }

  relationDuplicate(
    relationNameId: number,
    fromInterfaceId: number | null,
    fromServiceId: number | null,
    toInterfaceId: number | null,
    toServiceId: number | null,
    fromLabel: string,
    toLabel: string,
    port: number | null,
    protocol: PortalServiceProtocol | null,
    excludingId?: number,
  ): PortalApiRelation | undefined {
    const row = this.database
      .prepare(
        `${RELATION_SELECT}
         WHERE r.relation_name_id = ?
           AND r.from_interface_id IS ?
           AND r.from_service_id IS ?
           AND r.to_interface_id IS ?
           AND r.to_service_id IS ?
           AND r.from_label = ?
           AND r.to_label = ?
           AND r.port IS ?
           AND r.protocol IS ?
           ${excludingId === undefined ? "" : "AND r.id <> ?"}
         LIMIT 1`,
      )
      .get(
        relationNameId,
        fromInterfaceId,
        fromServiceId,
        toInterfaceId,
        toServiceId,
        fromLabel,
        toLabel,
        port,
        protocol,
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
        `SELECT * FROM (${RELATION_SELECT})
         WHERE from_device_id = ? OR to_device_id = ?
         ORDER BY id`,
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
          (direction === "outgoing"
            ? relation.fromLabel
            : relation.toLabel) || relation.relationName;
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

  // The settings view is the first project's ouchi (title + global
  // memo) plus the deployment-wide domain: since migration 021 each
  // project holds exactly one ouchi, and /api/settings keeps addressing
  // the default one.
  getSettings(): PortalApiData["settings"] {
    const row = this.database
      .prepare("SELECT domain FROM settings WHERE id = 1")
      .get() as { domain: string } | undefined;
    const project = this.firstProject();
    return {
      domain: row?.domain ?? "ouchi.local",
      title: project?.title ?? "あなたのホームラボ",
      properties: project?.properties ?? {},
    };
  }

  updateSettings(
    title: string,
    properties?: PortalProperties,
  ): PortalApiData["settings"] {
    const project = this.firstProject();
    if (project) {
      if (properties === undefined) {
        this.database
          .prepare(`UPDATE projects SET title = ? WHERE id = ?`)
          .run(title.trim(), project.id);
      } else {
        this.database
          .prepare(
            `UPDATE projects SET title = ?, properties = ? WHERE id = ?`,
          )
          .run(title.trim(), serializeProperties(properties), project.id);
      }
    }
    return this.getSettings();
  }

  getPortalData(): PortalApiData {
    return {
      version: 2,
      projects: this.listProjects(),
      networks: this.listNetworks(),
      devices: this.listDevices(),
      services: this.listServices(),
      relationNames: this.listRelationNames(),
      relations: this.listRelations(),
      settings: this.getSettings(),
    };
  }
}
