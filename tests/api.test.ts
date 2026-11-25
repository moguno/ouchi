// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createApp } from "../server/app";
import { PortalDatabase } from "../server/db";
import type {
  PortalApiData,
  PortalApiDevice,
  PortalApiService,
} from "../src/portal/types";

describe("REST API v1", () => {
  let directory: string;
  let database: PortalDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "ouchi-api-test-"));
    database = new PortalDatabase({
      filename: join(directory, "ledger.sqlite"),
    });
    app = createApp(database);
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  async function json<T>(response: Response): Promise<T> {
    return (await response.json()) as T;
  }

  it("returns the v0.4 seed as a PortalDataV2-shaped snapshot", async () => {
    const response = await app.request("/api/portal");
    expect(response.status).toBe(200);
    const data = await json<PortalApiData>(response);

    expect(data.version).toBe(2);
    expect(data.settings.domain).toBe("ouchi.local");
    expect(data.settings.title).toBe("あなたのホームラボ");
    expect(data.networks).toHaveLength(3);
    expect(data.devices).toHaveLength(16);
    expect(data.devices.flatMap((device) => device.interfaces)).toHaveLength(
      17,
    );
    expect(data.relations).toHaveLength(5);
    expect(data.relationNames).toHaveLength(2);
    expect(
      data.relationNames.map((relationName) => ({
        name: relationName.name,
        relationCount: relationName.relationCount,
      })),
    ).toEqual([
      { name: "ホストOS", relationCount: 4 },
      { name: "バックアップ先", relationCount: 1 },
    ]);
    expect(data.services).toHaveLength(9);
    expect(
      data.devices.find((device) => device.hostname === "nanopi-r2s")?.petname,
    ).toBe("門番");
    expect(data.devices.every((device) => device.petname)).toBe(true);
    const servicePetnames = new Set(
      data.services.map((service) => service.petname),
    );
    expect(
      data.devices.filter((device) =>
        servicePetnames.has(device.petname),
      ),
    ).toEqual([]);
    expect(
      Object.hasOwn(data.services[0] as object, "status"),
    ).toBe(false);
    expect(
      data.devices.find((device) => device.hostname === "notion")?.category,
    ).toBe("service");
  });

  it("migrates pre-properties databases without changing existing rows", async () => {
    database.close();
    const legacyFilename = join(directory, "legacy-ledger.sqlite");
    const legacyDatabase = new DatabaseSync(legacyFilename);
    const legacySchema = readFileSync(
      resolve(process.cwd(), "contract-v1/schema.sql"),
      "utf8",
    )
      .replace(/,\n  properties TEXT NOT NULL DEFAULT '\{\}'\n/g, "\n")
      .replace(/  properties TEXT NOT NULL DEFAULT '\{\}',\n/g, "");
    expect(legacySchema).not.toContain("properties TEXT");
    legacyDatabase.exec(legacySchema);
    legacyDatabase.exec(
      "ALTER TABLE devices ADD COLUMN is_vm INTEGER NOT NULL DEFAULT 0",
    );
    legacyDatabase.exec(`
      INSERT INTO networks (id, name, cidr, accent, note)
      VALUES (1, '既存LAN', '192.168.77.0/24', 'blue', 'legacy');
      INSERT INTO devices
        (id, hostname, petname, category, is_vm, meter_enabled, note)
      VALUES (1, 'legacy-host', '旧ホスト', 'physical', 0, 0, 'preserve me');
      INSERT INTO interfaces
        (id, device_id, name, network_id, ip, mac)
      VALUES (1, 1, 'eth0', 1, '192.168.77.10', NULL);
      INSERT INTO services
        (id, interface_id, subdomain, port, protocol, scheme, enabled)
      VALUES (1, 1, 'legacy-service', 8080, 'tcp', 'http', 1);
    `);
    legacyDatabase.close();

    database = new PortalDatabase({ filename: legacyFilename });
    app = createApp(database);
    const migrated = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(migrated.networks).toEqual([
      expect.objectContaining({ name: "既存LAN", note: "legacy" }),
    ]);
    expect(migrated.devices).toEqual([
      expect.objectContaining({
        hostname: "legacy-host",
        petname: "旧ホスト",
        note: "preserve me",
        properties: {},
      }),
    ]);
    expect(migrated.services).toEqual([
      expect.objectContaining({
        subdomain: "legacy-service",
        properties: {},
      }),
    ]);

    const deviceColumns = database.database
      .prepare("PRAGMA table_info(devices)")
      .all() as Array<{ name: string }>;
    const serviceColumns = database.database
      .prepare("PRAGMA table_info(services)")
      .all() as Array<{ name: string }>;
    expect(deviceColumns.map((column) => column.name)).toContain("properties");
    expect(serviceColumns.map((column) => column.name)).toContain("properties");

    const update = await app.request("/api/devices/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "legacy-host",
        petname: "旧ホスト",
        category: "physical",
        sshUser: null,
        sshPort: null,
        meterEnabled: false,
        note: "preserve me",
        properties: { migrated: "yes" },
      }),
    });
    expect(update.status).toBe(200);
    expect(
      (await json<PortalApiDevice>(update)).properties,
    ).toEqual({ migrated: "yes" });
  });

  it("migrates five tagged relations from the legacy schema into two relation names", async () => {
    database.close();
    const legacyFilename = join(directory, "legacy-relations.sqlite");
    const legacyDatabase = new DatabaseSync(legacyFilename);
    const currentSchema = readFileSync(
      resolve(process.cwd(), "contract-v1/schema.sql"),
      "utf8",
    );
    const legacySchema = currentSchema
      .replace(
        /CREATE TABLE IF NOT EXISTS interfaces \([\s\S]*?\n\);\n/,
        "CREATE TABLE IF NOT EXISTS device_networks (\n  id INTEGER PRIMARY KEY,\n  device_id INTEGER NOT NULL REFERENCES devices(id),\n  network_id INTEGER NOT NULL REFERENCES networks(id),\n  ip TEXT,\n  label TEXT,\n  UNIQUE (device_id, network_id)\n);\n",
      )
      .replace(
        "  interface_id INTEGER NOT NULL REFERENCES interfaces(id),\n",
        "  device_network_id INTEGER NOT NULL REFERENCES device_networks(id),\n",
      )
      .replace(
        /CREATE TABLE IF NOT EXISTS relation_names \([\s\S]*?\n\);\n/,
        "",
      )
      .replace(
        /CREATE TABLE IF NOT EXISTS relations \([\s\S]*?\n\);\n/,
        `CREATE TABLE IF NOT EXISTS relations (
          id INTEGER PRIMARY KEY,
          from_device_id INTEGER NOT NULL REFERENCES devices(id),
          to_device_id INTEGER NOT NULL REFERENCES devices(id),
          tag TEXT,
          from_label TEXT,
          to_label TEXT,
          color TEXT NOT NULL,
          CHECK (from_device_id <> to_device_id)
        );\n`,
      );
    legacyDatabase.exec(legacySchema);
    legacyDatabase.exec(
      "ALTER TABLE devices ADD COLUMN is_vm INTEGER NOT NULL DEFAULT 0",
    );
    legacyDatabase.exec(`
      INSERT INTO networks (id, name, accent)
      VALUES (1, '旧LAN', 'blue');
      INSERT INTO devices (id, hostname, category, is_vm)
      VALUES
        (1, 'legacy-host-a', 'physical', 0),
        (2, 'legacy-host-b', 'physical', 0),
        (3, 'legacy-host-c', 'physical', 0),
        (4, 'legacy-vm-a', 'vm', 1),
        (5, 'legacy-vm-b', 'vm', 1),
        (6, 'legacy-vm-c', 'vm', 1);
      INSERT INTO relations
        (from_device_id, to_device_id, tag, from_label, to_label, color)
      VALUES
        (4, 1, 'ホストOS', '親ホスト', 'VM', 'yellow'),
        (4, 2, 'ホストOS', '別ラベル', '別VM', 'green'),
        (5, 2, 'ホストOS', NULL, NULL, 'yellow'),
        (6, 3, 'ホストOS', NULL, NULL, 'yellow'),
        (1, 2, 'バックアップ先', 'バックアップ元', '保存先', 'blue');
    `);
    legacyDatabase.close();

    database = new PortalDatabase({ filename: legacyFilename });
    app = createApp(database);
    const migrated = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(migrated.devices).toHaveLength(6);
    expect(migrated.relationNames).toEqual([
      expect.objectContaining({
        name: "ホストOS",
        color: "yellow",
        relationCount: 4,
      }),
      expect.objectContaining({
        name: "バックアップ先",
        color: "blue",
        relationCount: 1,
      }),
    ]);
    expect(migrated.relations).toHaveLength(5);
    expect(migrated.relations[0]).toEqual(
      expect.objectContaining({ fromLabel: "親ホスト", toLabel: "VM" }),
    );
    const relationColumns = database.database
      .prepare("PRAGMA table_info(relations)")
      .all() as Array<{ name: string }>;
    expect(relationColumns.map((column) => column.name)).toEqual([
      "id",
      "relation_name_id",
      "from_interface_id",
      "to_interface_id",
      "from_label",
      "to_label",
    ]);
  });

  it("migrates a v0.5 relation table by expanding label templates", async () => {
    database.close();
    const legacyFilename = join(directory, "legacy-placeholders.sqlite");
    const legacyDatabase = new DatabaseSync(legacyFilename);
    const currentSchema = readFileSync(
      resolve(process.cwd(), "contract-v1/schema.sql"),
      "utf8",
    );
    const prePlaceholderSchema = currentSchema
      .replace(
        /CREATE TABLE IF NOT EXISTS interfaces \([\s\S]*?\n\);\n/,
        "CREATE TABLE IF NOT EXISTS device_networks (\n  id INTEGER PRIMARY KEY,\n  device_id INTEGER NOT NULL REFERENCES devices(id),\n  network_id INTEGER NOT NULL REFERENCES networks(id),\n  ip TEXT,\n  label TEXT,\n  UNIQUE (device_id, network_id)\n);\n",
      )
      .replace(
        "  interface_id INTEGER NOT NULL REFERENCES interfaces(id),\n",
        "  device_network_id INTEGER NOT NULL REFERENCES device_networks(id),\n",
      )
      .replace(
        /CREATE TABLE IF NOT EXISTS relation_names \([\s\S]*?\n\);\n/,
        `CREATE TABLE IF NOT EXISTS relation_names (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT NOT NULL,
        from_label TEXT,
        to_label TEXT
      );\n`,
      )
      .replace(
        /CREATE TABLE IF NOT EXISTS relations \([\s\S]*?\n\);\n/,
        `CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY,
        relation_name_id INTEGER NOT NULL REFERENCES relation_names(id),
        from_device_id INTEGER NOT NULL REFERENCES devices(id),
        to_device_id INTEGER NOT NULL REFERENCES devices(id),
        CHECK (from_device_id <> to_device_id),
        UNIQUE (relation_name_id, from_device_id, to_device_id)
      );\n`,
      );
    legacyDatabase.exec(prePlaceholderSchema);
    legacyDatabase.exec(
      "ALTER TABLE devices ADD COLUMN is_vm INTEGER NOT NULL DEFAULT 0",
    );
    legacyDatabase.exec(`
      INSERT INTO networks (id, name, accent)
      VALUES (1, '既存LAN', 'blue');
      INSERT INTO devices (id, hostname, category, is_vm)
      VALUES
        (1, 'legacy-a', 'physical', 0),
        (2, 'legacy-b', 'physical', 0);
      INSERT INTO relation_names (id, name, color, from_label, to_label)
      VALUES (1, '既存関係', '#123456', '始点{}', '終点{}');
      INSERT INTO relations
        (id, relation_name_id, from_device_id, to_device_id)
      VALUES (7, 1, 1, 2);
    `);
    legacyDatabase.close();

    database = new PortalDatabase({ filename: legacyFilename });
    app = createApp(database);
    const migrated = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    const columns = database.database
      .prepare("PRAGMA table_info(relations)")
      .all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["from_label", "to_label"]),
    );
    expect(
      columns.map((column) => column.name),
    ).not.toContain("from_placeholder");
    const relationNameColumns = database.database
      .prepare("PRAGMA table_info(relation_names)")
      .all() as Array<{ name: string }>;
    expect(
      relationNameColumns.map((column) => column.name),
    ).toEqual(["id", "name", "color", "line_start", "line_end"]);
    expect(migrated.relations).toEqual([
      expect.objectContaining({
        id: 7,
        fromLabel: "始点-",
        toLabel: "終点-",
      }),
    ]);
    expect(() =>
      database.database
        .prepare(
          `INSERT INTO relations
            (relation_name_id, from_interface_id, to_interface_id,
             from_label, to_label)
           VALUES (1, 1, 2, '始点-', '終点-')`,
        )
        .run(),
    ).toThrow();
  });

  it("assembles all redirect and monitor URLs like verify.py", async () => {
    const data = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    const bySubdomain = Object.fromEntries(
      data.services.map((service) => [service.subdomain, service]),
    ) as Record<string, PortalApiService>;

    expect(
      Object.fromEntries(
        data.services.map((service) => [
          service.subdomain,
          [service.url, service.monitorUrl],
        ]),
      ),
    ).toEqual({
      gitea: [
        "http://192.168.0.19:3000/",
        "http://192.168.0.19:3000/api/v1/version",
      ],
      gatus: [
        "http://192.168.0.19:8080/",
        "http://192.168.0.19:8080/",
      ],
      homepage: [
        "http://192.168.0.19:80/",
        "http://192.168.0.19:80/",
      ],
      proxmox: [
        "https://192.168.0.11:8006/",
        "https://192.168.0.11:8006/",
      ],
      omv: [
        "http://192.168.0.21:80/",
        "http://192.168.0.21:80/",
      ],
      fortigate: [
        "https://192.168.0.1:443/",
        "https://192.168.0.1:443/",
      ],
      "gatus-oci": [
        "http://192.168.253.1:8080/",
        "http://192.168.253.1:8080/",
      ],
      notion: ["https://www.notion.so/", "https://www.notion.so/"],
      pcloud: ["https://my.pcloud.com/", "https://my.pcloud.com/"],
    });
  });

  it("traverses omv relations in both directions with fallback labels", async () => {
    const outbound = await json<{
      relations: Array<{
        direction: string;
        label: string;
        relatedDevice: { hostname: string };
      }>;
    }>(await app.request("/api/devices/4/relations?depth=1"));
    expect(outbound.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "outgoing",
          label: "ホストOS",
          relatedDevice: expect.objectContaining({ hostname: "acemagic" }),
        }),
        expect.objectContaining({
          direction: "outgoing",
          label: "バックアップ先",
          relatedDevice: expect.objectContaining({
            hostname: "nanopi-r2s",
          }),
        }),
      ]),
    );

    const inbound = await json<{
      relations: Array<{
        direction: string;
        relatedDevice: { hostname: string };
      }>;
    }>(await app.request("/api/devices/2/relations?depth=1"));
    expect(inbound.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "incoming",
          relatedDevice: expect.objectContaining({ hostname: "omv" }),
        }),
      ]),
    );
  });

  it("stores relation-name endpoint shapes and exports them to YAML", async () => {
    const created = await app.request("/api/relation-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "マウント",
        color: "#0ea5e9",
        lineStart: "square",
        lineEnd: "arrow",
      }),
    });
    expect(created.status).toBe(201);
    const portal = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(
      portal.relationNames.find((item) => item.name === "マウント"),
    ).toEqual(
      expect.objectContaining({ lineStart: "square", lineEnd: "arrow" }),
    );

    const exported = await app.request("/api/export");
    const document = parseYaml(await exported.text()) as {
      relationNames: Array<Record<string, unknown>>;
    };
    expect(
      document.relationNames.find((item) => item.name === "マウント"),
    ).toEqual({
      name: "マウント",
      color: "#0ea5e9",
      lineStart: "square",
      lineEnd: "arrow",
    });
    // Default-shaped names stay out of the YAML, as before.
    expect(
      document.relationNames.find((item) => item.name === "ホストOS"),
    ).toEqual({ name: "ホストOS", color: expect.any(String) });

    const invalid = await app.request("/api/relation-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "不正な形",
        color: "#0ea5e9",
        lineEnd: "star",
      }),
    });
    expect(invalid.status).toBe(400);
  });

  it("supports relation-name CRUD and relation edges with their own labels", async () => {
    const duplicateName = await app.request("/api/relation-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ホストOS",
        color: "#123456",
      }),
    });
    expect(duplicateName.status).toBe(400);

    const createName = await app.request("/api/relation-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "監視",
        color: "#22c55e",
      }),
    });
    expect(createName.status).toBe(201);
    const relationName = await json<{
      id: number;
      relationCount: number;
    }>(createName);
    expect(relationName.relationCount).toBe(0);

    const first = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "監視",
        fromInterfaceId: 3,
        toInterfaceId: 1,
        fromLabel: "監視元",
        toLabel: "監視先",
      }),
    });
    expect(first.status).toBe(201);
    const createdRelation = await json<{ id: number }>(first);
    expect(createdRelation).toEqual(
      expect.objectContaining({
        relationNameId: relationName.id,
        relationName: "監視",
        fromLabel: "監視元",
        toLabel: "監視先",
        color: "#22c55e",
      }),
    );

    const second = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ホストOS",
        fromInterfaceId: 3,
        toInterfaceId: 1,
      }),
    });
    expect(second.status).toBe(201);
    expect((await json<{ relationName: string }>(second)).relationName).toBe(
      "ホストOS",
    );

    const duplicate = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "監視",
        fromInterfaceId: 3,
        toInterfaceId: 1,
        fromLabel: "監視元",
        toLabel: "監視先",
      }),
    });
    expect(duplicate.status).toBe(400);
    expect(
      (await json<{ issues: Array<{ path: string }> }>(duplicate)).issues,
    ).toContainEqual(
      expect.objectContaining({ path: "relationName" }),
    );

    const updateName = await app.request(
      `/api/relation-names/${relationName.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "監視",
          color: "#ef4444",
        }),
      },
    );
    expect(updateName.status).toBe(200);
    const portal = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(
      portal.relationNames.find((item) => item.id === relationName.id),
    ).toEqual(
      expect.objectContaining({
        relationCount: 1,
        color: "#ef4444",
      }),
    );
    expect(
      portal.relations.find(
        (relation) => relation.relationName === "監視",
      ),
    ).toEqual(
      expect.objectContaining({
        color: "#ef4444",
        fromLabel: "監視元",
        toLabel: "監視先",
      }),
    );

    const blockedDelete = await app.request(
      `/api/relation-names/${relationName.id}`,
      { method: "DELETE" },
    );
    expect(blockedDelete.status).toBe(409);

    expect(
      (
        await app.request(
          `/api/relations/${createdRelation.id}`,
          { method: "DELETE" },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(
          `/api/relation-names/${relationName.id}`,
          { method: "DELETE" },
        )
      ).status,
    ).toBe(200);

    const retiredEndpoint = await app.request(
      `/api/relations/tags/${encodeURIComponent("ホストOS")}/color`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: "#ffffff" }),
      },
    );
    expect(retiredEndpoint.status).toBe(404);
  });

  it("stores free-text labels on relations and allows labels in the unique key", async () => {
    const createName = await app.request("/api/relation-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ポート接続",
        color: "#0ea5e9",
      }),
    });
    expect(createName.status).toBe(201);

    const first = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ポート接続",
        fromInterfaceId: 3,
        toInterfaceId: 1,
        fromLabel: "始点LAN",
        toLabel: "ポート8",
      }),
    });
    expect(first.status).toBe(201);

    const second = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ポート接続",
        fromInterfaceId: 3,
        toInterfaceId: 1,
        fromLabel: "始点LAN",
        toLabel: "ポート9",
      }),
    });
    expect(second.status).toBe(201);

    const duplicate = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ポート接続",
        fromInterfaceId: 3,
        toInterfaceId: 1,
        fromLabel: "始点LAN",
        toLabel: "ポート8",
      }),
    });
    expect(duplicate.status).toBe(400);

    const emptyLabel = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ポート接続",
        fromInterfaceId: 3,
        toInterfaceId: 1,
      }),
    });
    expect(emptyLabel.status).toBe(201);

    const portal = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    const labels = portal.relations
      .filter((relation) => relation.relationName === "ポート接続")
      .map((relation) => ({
        fromLabel: relation.fromLabel,
        toLabel: relation.toLabel,
      }));
    expect(labels).toEqual([
      { fromLabel: "始点LAN", toLabel: "ポート8" },
      { fromLabel: "始点LAN", toLabel: "ポート9" },
      { fromLabel: "", toLabel: "" },
    ]);

    const indexes = database.database
      .prepare("PRAGMA index_list(relations)")
      .all() as Array<{ name: string; unique: number }>;
    const uniqueIndex = indexes.find((index) => index.unique === 1);
    expect(uniqueIndex).toBeDefined();
    const indexColumns = database.database
      .prepare(`PRAGMA index_info("${uniqueIndex!.name}")`)
      .all() as Array<{ name: string }>;
    expect(indexColumns.map((column) => column.name)).toEqual([
      "relation_name_id",
      "from_interface_id",
      "to_interface_id",
      "from_label",
      "to_label",
    ]);
  });

  it("round-trips relation labels through YAML", async () => {
    await app.request("/api/relation-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "ポート接続",
        color: "#0ea5e9",
      }),
    });
    await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ポート接続",
        fromInterfaceId: 3,
        toInterfaceId: 1,
        fromLabel: "始点lan",
        toLabel: "ポート8",
      }),
    });

    const exported = await app.request("/api/export");
    expect(exported.status).toBe(200);
    const yaml = await exported.text();
    const document = parseYaml(yaml) as {
      format: string;
      relations: Array<Record<string, unknown>>;
    };
    expect(document.format).toBe("ouchi-ledger/9");
    expect(document.relations).toContainEqual(
      expect.objectContaining({
        relationName: "ポート接続",
        fromLabel: "始点lan",
        toLabel: "ポート8",
      }),
    );

    const importedFilename = join(directory, "label-import.sqlite");
    const importedDatabase = new PortalDatabase({
      filename: importedFilename,
    });
    try {
      importedDatabase.database.exec(`
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
      const importedApp = createApp(importedDatabase);
      const response = await importedApp.request("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/yaml" },
        body: yaml,
      });
      expect(response.status).toBe(200);
      const portal = await json<PortalApiData>(
        await importedApp.request("/api/portal"),
      );
      expect(
        portal.relations.find(
          (relation) => relation.relationName === "ポート接続",
        ),
      ).toEqual(
        expect.objectContaining({
          fromLabel: "始点lan",
          toLabel: "ポート8",
        }),
      );
    } finally {
      importedDatabase.close();
    }
  });

  it("returns null meters until the SSH collector is configured", async () => {
    const response = await app.request("/api/devices/4/meters");
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      deviceId: 4,
      memoryPercent: null,
      diskPercent: null,
      collectedAt: null,
      available: false,
    });
  });

  it("reads and persists settings.title through the API", async () => {
    expect(await json(await app.request("/api/settings"))).toEqual({
      domain: "ouchi.local",
      title: "あなたのホームラボ",
    });

    const update = await app.request("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  我が家のポータル  " }),
    });
    expect(update.status).toBe(200);
    expect(await json(update)).toEqual({
      domain: "ouchi.local",
      title: "我が家のポータル",
    });

    const portal = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(portal.settings.title).toBe("我が家のポータル");

    database.close();
    database = new PortalDatabase({
      filename: join(directory, "ledger.sqlite"),
    });
    app = createApp(database);
    expect(await json(await app.request("/api/settings"))).toEqual({
      domain: "ouchi.local",
      title: "我が家のポータル",
    });
  });

  it("rejects invalid settings.title without changing the database", async () => {
    const before = await json(await app.request("/api/settings"));
    for (const title of ["   ", "a".repeat(101), "1行目\n2行目"]) {
      const response = await app.request("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      expect(response.status).toBe(400);
      expect(
        await json<{ issues: Array<{ path: string }> }>(response),
      ).toEqual(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ path: "title" }),
          ]),
        }),
      );
    }
    expect(await json(await app.request("/api/settings"))).toEqual(before);
  });

  it("cascades device relations, services, and interfaces atomically", async () => {
    const deviceResponse = await app.request("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "delete-cascade-device",
        petname: "削除回帰機",
        category: "physical",
        sshUser: null,
        sshPort: null,
        meterEnabled: false,
        note: null,
      }),
    });
    expect(deviceResponse.status).toBe(201);
    const device = await json<PortalApiDevice>(deviceResponse);

    const interfaceResponse = await app.request("/api/interfaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.id,
        name: "eth0",
        networkId: 1,
        ip: "192.168.0.250",
        mac: "02:00:00:00:00:01",
      }),
    });
    expect(interfaceResponse.status).toBe(201);
    const iface = await json<{ id: number }>(interfaceResponse);
    const interfaceList = await json<
      Array<{ id: number; mac: string | null }>
    >(await app.request("/api/interfaces"));
    expect(interfaceList.find((item) => item.id === iface.id)?.mac).toBe(
      "02:00:00:00:00:01",
    );

    const relationResponse = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "ホストOS",
        fromInterfaceId: iface.id,
        toInterfaceId: 1,
      }),
    });
    expect(relationResponse.status).toBe(201);
    const relation = await json<{ id: number }>(relationResponse);
    const inboundRelationResponse = await app.request("/api/relations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationName: "バックアップ先",
        fromInterfaceId: 1,
        toInterfaceId: iface.id,
      }),
    });
    expect(inboundRelationResponse.status).toBe(201);
    const inboundRelation = await json<{ id: number }>(
      inboundRelationResponse,
    );

    const serviceResponse = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interfaceId: iface.id,
        subdomain: "delete-cascade-service",
        petname: "削除回帰サービス",
        description: null,
        port: 8080,
        protocol: "tcp",
        scheme: "http",
        topPath: "/",
        monitorPath: "/",
        serviceUrl: null,
        iconKey: "generic:monitor",
        enabled: true,
      }),
    });
    expect(serviceResponse.status).toBe(201);
    const service = await json<PortalApiService>(serviceResponse);
    database.database.exec(`
      INSERT INTO ssh_keys
        (owner, purpose, key_type, public_key)
      VALUES
        ('delete-cascade-device', 'test', 'ed25519', 'ssh-ed25519 test');
      INSERT INTO device_keys (device_id, key_id)
      VALUES (${device.id}, last_insert_rowid());
    `);

    expect(database.deviceCascadeCounts(device.id)).toEqual({
      interfaces: 1,
      services: 1,
      relations: 2,
    });

    database.database.exec(`
      CREATE TRIGGER fail_device_cascade
      BEFORE DELETE ON services
      BEGIN
        SELECT RAISE(ABORT, 'forced service cascade failure');
      END;
    `);
    expect(() => database.deleteDevice(device.id)).toThrow(
      /forced service cascade failure/,
    );
    expect(database.getDevice(device.id)).toBeDefined();
    expect(database.getRelation(relation.id)).toBeDefined();
    expect(database.getRelation(inboundRelation.id)).toBeDefined();
    expect(database.getService(service.id)).toBeDefined();
    expect(database.getInterface(iface.id)).toBeDefined();
    expect(
      database.database
        .prepare("SELECT COUNT(*) AS count FROM device_keys WHERE device_id = ?")
        .get(device.id),
    ).toEqual({ count: 1 });
    database.database.exec("DROP TRIGGER fail_device_cascade");

    const deleted = await app.request(`/api/devices/${device.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect(await json(deleted)).toEqual({ ok: true });
    expect(
      (await app.request(`/api/devices/${device.id}`)).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/relations/${relation.id}`)).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/relations/${inboundRelation.id}`)).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/services/${service.id}`)).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/interfaces/${iface.id}`)).status,
    ).toBe(404);
    expect(
      database.database
        .prepare("SELECT COUNT(*) AS count FROM device_keys WHERE device_id = ?")
        .get(device.id),
    ).toEqual({ count: 0 });
    const relationNames = await json<
      Array<{ name: string; relationCount: number }>
    >(await app.request("/api/relation-names"));
    expect(
      relationNames.find((relationName) => relationName.name === "ホストOS"),
    ).toMatchObject({ relationCount: 4 });
    expect(
      relationNames.find(
        (relationName) => relationName.name === "バックアップ先",
      ),
    ).toMatchObject({ relationCount: 1 });

    const childlessResponse = await app.request("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "delete-childless-device",
        petname: "子要素なし",
        category: "physical",
        sshUser: null,
        sshPort: null,
        meterEnabled: false,
        note: null,
      }),
    });
    expect(childlessResponse.status).toBe(201);
    const childlessDevice = await json<PortalApiDevice>(childlessResponse);
    expect(
      (
        await app.request(`/api/devices/${childlessDevice.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
  });

  it("supports create, read, update, and guarded deletes", async () => {
    const networkResponse = await app.request("/api/networks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "検証ネットワーク",
        cidr: "10.44.0.0/24",
        accent: "green",
        note: "CRUD",
      }),
    });
    expect(networkResponse.status).toBe(201);
    const network = await json<{ id: number }>(networkResponse);

    const deviceResponse = await app.request("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "api-test",
        petname: "  API 検証機  ",
        category: "vm",
        sshUser: "monitor",
        sshPort: 22,
        meterEnabled: true,
        note: null,
      }),
    });
    expect(deviceResponse.status).toBe(201);
    const device = await json<PortalApiDevice>(deviceResponse);
    expect(device.petname).toBe("API 検証機");

    const deviceUpdate = await app.request(`/api/devices/${device.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "api-test",
        petname: "  更新後  ",
        category: "vm",
        sshUser: "monitor",
        sshPort: 22,
        meterEnabled: true,
        note: null,
      }),
    });
    expect(deviceUpdate.status).toBe(200);
    expect((await json<PortalApiDevice>(deviceUpdate)).petname).toBe(
      "更新後",
    );

    const clearPetname = await app.request(`/api/devices/${device.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname: "api-test",
        petname: "   ",
        category: "vm",
        sshUser: "monitor",
        sshPort: 22,
        meterEnabled: true,
        note: null,
      }),
    });
    expect(clearPetname.status).toBe(200);
    expect((await json<PortalApiDevice>(clearPetname)).petname).toBeNull();

    const interfaceResponse = await app.request("/api/interfaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.id,
        name: "eth0",
        networkId: network.id,
        ip: "10.44.0.20",
        label: "test",
      }),
    });
    expect(interfaceResponse.status).toBe(201);
    const iface = await json<{ id: number }>(interfaceResponse);

    const serviceResponse = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interfaceId: iface.id,
        subdomain: "api-test",
        petname: "API Test",
        description: "CRUD test",
        port: 8080,
        protocol: "tcp",
        scheme: "http",
        topPath: "/",
        monitorPath: "/health",
        serviceUrl: null,
        iconKey: "generic:monitor",
        enabled: true,
      }),
    });
    expect(serviceResponse.status).toBe(201);
    const createdService = await json<PortalApiService>(serviceResponse);
    expect(createdService.url).toBe("http://10.44.0.20:8080/");
    expect(createdService.monitorUrl).toBe(
      "http://10.44.0.20:8080/health",
    );

    const serviceUpdate = await app.request(
      `/api/services/${createdService.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfaceId: iface.id,
          subdomain: "api-test",
          petname: "API Test Updated",
          description: "updated",
          port: 9090,
          protocol: "tcp",
          scheme: "http",
          topPath: "/",
          monitorPath: "/",
          serviceUrl: null,
          iconKey: "generic:monitor",
          enabled: true,
        }),
      },
    );
    expect(serviceUpdate.status).toBe(200);
    expect(
      (await json<PortalApiService>(serviceUpdate)).url,
    ).toBe("http://10.44.0.20:9090/");

    expect(
      (
        await app.request(`/api/networks/${network.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request(`/api/devices/${device.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);

    expect(
      (await app.request(`/api/services/${createdService.id}`)).status,
    ).toBe(404);
    expect(
      (await app.request(`/api/interfaces/${iface.id}`)).status,
    ).toBe(404);
    expect(
      (
        await app.request(`/api/networks/${network.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
  });

  it("reads and writes property maps while preserving omitted updates", async () => {
    const deviceInput = {
      hostname: "properties-device",
      petname: "プロパティ検証機",
      category: "physical",
      sshUser: null,
      sshPort: null,
      meterEnabled: false,
      note: null,
    };
    const createDeviceResponse = await app.request("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...deviceInput,
        properties: {
          " vault_path ": " sops/devices/properties-device ",
          "hdd_note": "SMARTを確認中",
        },
      }),
    });
    expect(createDeviceResponse.status).toBe(201);
    const createdDevice = await json<PortalApiDevice>(createDeviceResponse);
    expect(createdDevice.properties).toEqual({
      vault_path: " sops/devices/properties-device ",
      hdd_note: "SMARTを確認中",
    });

    expect(
      await json<PortalApiDevice>(
        await app.request(`/api/devices/${createdDevice.id}`),
      ),
    ).toMatchObject({
      id: createdDevice.id,
      properties: createdDevice.properties,
    });
    expect(
      (await json<PortalApiDevice[]>(await app.request("/api/devices")))
        .find((device) => device.id === createdDevice.id)?.properties,
    ).toEqual(createdDevice.properties);
    expect(
      (await json<PortalApiData>(await app.request("/api/portal")))
        .devices.find((device) => device.id === createdDevice.id)?.properties,
    ).toEqual(createdDevice.properties);

    const replaceDeviceResponse = await app.request(
      `/api/devices/${createdDevice.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deviceInput,
          properties: { replacement: "only" },
        }),
      },
    );
    expect(replaceDeviceResponse.status).toBe(200);
    expect(
      (await json<PortalApiDevice>(replaceDeviceResponse)).properties,
    ).toEqual({ replacement: "only" });

    const omittedDeviceResponse = await app.request(
      `/api/devices/${createdDevice.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...deviceInput,
          petname: "プロパティ保持確認",
        }),
      },
    );
    expect(omittedDeviceResponse.status).toBe(200);
    expect(
      (await json<PortalApiDevice>(omittedDeviceResponse)).properties,
    ).toEqual({ replacement: "only" });

    const serviceInput = {
      interfaceId: 1,
      subdomain: "properties-service",
      petname: "Properties Service",
      description: null,
      port: 8080,
      protocol: "tcp",
      scheme: "http",
      topPath: "/",
      monitorPath: "/",
      serviceUrl: null,
      iconKey: "generic:monitor",
      enabled: true,
    };
    const createServiceResponse = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...serviceInput,
        properties: {
          " sops_key ": "service/ciphertext",
          owner_note: "AI向け注釈",
        },
      }),
    });
    expect(createServiceResponse.status).toBe(201);
    const createdService = await json<PortalApiService>(
      createServiceResponse,
    );
    expect(createdService.properties).toEqual({
      sops_key: "service/ciphertext",
      owner_note: "AI向け注釈",
    });
    expect(
      await json<PortalApiService>(
        await app.request(`/api/services/${createdService.id}`),
      ),
    ).toMatchObject({
      id: createdService.id,
      properties: createdService.properties,
    });
    expect(
      (await json<PortalApiService[]>(await app.request("/api/services")))
        .find((service) => service.id === createdService.id)?.properties,
    ).toEqual(createdService.properties);

    const replaceServiceResponse = await app.request(
      `/api/services/${createdService.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...serviceInput,
          properties: { retained: "yes" },
        }),
      },
    );
    expect(replaceServiceResponse.status).toBe(200);
    expect(
      (await json<PortalApiService>(replaceServiceResponse)).properties,
    ).toEqual({ retained: "yes" });

    const omittedServiceResponse = await app.request(
      `/api/services/${createdService.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...serviceInput,
          petname: "Properties Service Updated",
        }),
      },
    );
    expect(omittedServiceResponse.status).toBe(200);
    expect(
      (await json<PortalApiService>(omittedServiceResponse)).properties,
    ).toEqual({ retained: "yes" });
    expect(
      await json<PortalApiService>(
        await app.request(`/api/services/${createdService.id}`),
      ),
    ).toMatchObject({
      properties: { retained: "yes" },
    });
  });

  it("rejects invalid property maps and removes them with their entity", async () => {
    const validDevice = {
      hostname: "invalid-properties-device",
      petname: null,
      category: "physical",
      sshUser: null,
      sshPort: null,
      meterEnabled: false,
      note: null,
    };
    const invalidPropertyCases = [
      { "   ": "value" },
      { ["k".repeat(129)]: "value" },
      { oversized: "x".repeat(64 * 1024 + 1) },
      { non_string: 42 },
    ];
    for (const properties of invalidPropertyCases) {
      const response = await app.request("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validDevice, properties }),
      });
      expect(response.status).toBe(400);
      expect(
        (await json<{ issues: Array<{ path: string }> }>(response)).issues,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringContaining("properties"),
          }),
        ]),
      );
    }

    const createResponse = await app.request("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validDevice,
        hostname: "delete-properties-device",
        properties: { delete_me: "value" },
      }),
    });
    const device = await json<PortalApiDevice>(createResponse);
    expect(
      database.database
        .prepare("SELECT properties FROM devices WHERE id = ?")
        .get(device.id),
    ).toEqual({ properties: JSON.stringify({ delete_me: "value" }) });
    expect(
      (
        await app.request(`/api/devices/${device.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
    expect(
      database.database
        .prepare("SELECT properties FROM devices WHERE id = ?")
        .get(device.id),
    ).toBeUndefined();

    const service = database.listServices()[0];
    expect(
      (
        await app.request(`/api/services/${service.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interfaceId: service.interfaceId,
            subdomain: service.subdomain,
            petname: service.petname,
            description: service.description,
            port: service.port,
            protocol: service.protocol,
            scheme: service.scheme,
            topPath: service.topPath,
            monitorPath: service.monitorPath,
            serviceUrl: service.serviceUrl,
            iconKey: service.iconKey,
            enabled: service.enabled,
            properties: { delete_me: "service" },
          }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/services/${service.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
    expect(
      database.database
        .prepare("SELECT properties FROM services WHERE id = ?")
        .get(service.id),
    ).toBeUndefined();
  });

  it("returns ValidationIssue arrays for API input failures", async () => {
    const response = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interfaceId: 1,
        subdomain: "",
        port: 70_000,
        protocol: "smtp",
        scheme: "ftp",
        enabled: true,
      }),
    });
    expect(response.status).toBe(400);
    const body = await json<{
      issues: Array<{ path: string; message: string }>;
    }>(response);
    expect(body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "subdomain" }),
        expect.objectContaining({ path: "port" }),
        expect.objectContaining({ path: "protocol" }),
        expect.objectContaining({ path: "scheme" }),
      ]),
    );
  });

  it("exports the complete ledger as YAML with natural-key references", async () => {
    const response = await app.request("/api/export");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/yaml",
    );
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="ouchi-ledger-.*\.yaml"$/,
    );

    const yaml = await response.text();
    const document = parseYaml(yaml) as {
      format: string;
      exportedAt: string;
      settings: { domain: string; title: string };
      networks: Array<Record<string, unknown>>;
      devices: Array<{
        hostname: string;
        petname: string | null;
        interfaces: Array<Record<string, unknown>>;
      }>;
      relationNames: Array<Record<string, unknown>>;
      relations: Array<Record<string, unknown>>;
      services: Array<Record<string, unknown>>;
      sshKeys: unknown[];
      deviceKeys: unknown[];
    };

    expect(document.format).toBe("ouchi-ledger/9");
    expect(document.relationNames).toHaveLength(2);
    expect(document.relationNames[0]).toEqual(
      expect.objectContaining({
        name: "ホストOS",
        color: "#d5a22b",
      }),
    );
    expect(Number.isNaN(Date.parse(document.exportedAt))).toBe(false);
    expect(document.settings).toEqual({
      domain: "ouchi.local",
      title: "あなたのホームラボ",
    });
    expect(document.networks[0]).not.toHaveProperty("id");
    expect(document.devices[0]).not.toHaveProperty("id");
    expect(
      document.devices.find((device) => device.hostname === "nanopi-r2s")
        ?.petname,
    ).toBe("門番");
    expect(document.devices[0].interfaces[0]).not.toHaveProperty(
      "networkId",
    );
    expect(document.devices[0].interfaces[0]).toHaveProperty("name");
    expect(document.services[0]).toHaveProperty("device");
    expect(document.services[0]).toHaveProperty("interface");
    expect(document.services[0]).not.toHaveProperty("network");
    expect(document.services[0]).not.toHaveProperty("deviceNetworkId");
    expect(document.services[0]).not.toHaveProperty("url");
    expect(document.relations[0]).toHaveProperty("from");
    expect(document.relations[0]).toHaveProperty("to");
    expect(document.relations[0]).toHaveProperty("relationName");
    expect(document.relations[0]).not.toHaveProperty("tag");
    expect(document.relations[0]).not.toHaveProperty("color");
    expect(document.sshKeys).toEqual([]);
    expect(document.deviceKeys).toEqual([]);
  });

  it("round-trips all ledger data, including public-key links, without internal IDs", async () => {
    database.database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      UPDATE networks SET id = id + 100;
      UPDATE devices SET id = id + 100;
      UPDATE interfaces
      SET id = id + 100, device_id = device_id + 100,
          network_id = network_id + 100;
      UPDATE relations
      SET id = id + 100, from_interface_id = from_interface_id + 100,
          to_interface_id = to_interface_id + 100;
      UPDATE services
      SET id = id + 100, interface_id = interface_id + 100;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    const device = database
      .database.prepare("SELECT id FROM devices WHERE hostname = ?")
      .get("acemagic") as { id: number };
    const sourceOmv = database.database
      .prepare("SELECT id FROM devices WHERE hostname = ?")
      .get("omv") as { id: number };
    const keyResult = database.database
      .prepare(
        `INSERT INTO ssh_keys
          (owner, purpose, key_type, public_key, fingerprint, expires_at,
           enabled, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "kyle",
        "meter",
        "ssh-ed25519",
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestRoundTripKey",
        "SHA256:roundtrip",
        null,
        1,
        "export test",
      );
    database.database
      .prepare("INSERT INTO device_keys (device_id, key_id) VALUES (?, ?)")
      .run(device.id, Number(keyResult.lastInsertRowid));
    database.database
      .prepare("UPDATE settings SET title = ? WHERE id = 1")
      .run("移行先ポータル");
    database.database
      .prepare("UPDATE devices SET properties = ? WHERE hostname = ?")
      .run(
        JSON.stringify({
          vault_path: "sops/devices/nanopi/monitor",
          maintenance_note: "HDD SMART怪しい",
        }),
        "nanopi-r2s",
      );
    database.database
      .prepare("UPDATE services SET properties = ? WHERE subdomain = ?")
      .run(
        JSON.stringify({
          sops_ciphertext: "ENC[AES256_GCM,data:round-trip]",
          ai_note: "Gitサーバ",
        }),
        "gitea",
      );

    const firstExport = await app.request("/api/export");
    const firstYaml = await firstExport.text();

    const roundTripDatabase = new PortalDatabase({
      filename: join(directory, "round-trip.sqlite"),
    });
    const roundTripApp = createApp(roundTripDatabase);
    try {
      const importResponse = await roundTripApp.request("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/yaml" },
        body: firstYaml,
      });
      expect(importResponse.status).toBe(200);
      expect(await json(importResponse)).toMatchObject({
        ok: true,
        imported: {
          networks: 3,
          devices: 16,
          interfaces: 17,
          relationNames: 2,
          relations: 5,
          services: 9,
          sshKeys: 1,
          deviceKeys: 1,
        },
      });

      const secondYaml = await (
        await roundTripApp.request("/api/export")
      ).text();
      const first = parseYaml(firstYaml) as Record<string, unknown>;
      const second = parseYaml(secondYaml) as Record<string, unknown>;
      expect(first).not.toHaveProperty("tags");
      expect(second).not.toHaveProperty("tags");
      expect(first).toHaveProperty("relationNames");
      expect(second).toHaveProperty("relationNames");
      delete first.exportedAt;
      delete second.exportedAt;
      expect(second).toEqual(first);

      const importedPortal = await json<PortalApiData>(
        await roundTripApp.request("/api/portal"),
      );
      expect(importedPortal.settings.title).toBe("移行先ポータル");
      expect(
        importedPortal.devices.find((item) => item.hostname === "nanopi-r2s")
          ?.petname,
      ).toBe("門番");
      expect(
        importedPortal.devices.find((item) => item.hostname === "nanopi-r2s")
          ?.properties,
      ).toEqual({
        vault_path: "sops/devices/nanopi/monitor",
        maintenance_note: "HDD SMART怪しい",
      });
      expect(
        importedPortal.services.find((item) => item.subdomain === "gitea")
          ?.properties,
      ).toEqual({
        sops_ciphertext: "ENC[AES256_GCM,data:round-trip]",
        ai_note: "Gitサーバ",
      });
      const omv = importedPortal.devices.find(
        (item) => item.hostname === "omv",
      );
      const acmagic = importedPortal.devices.find(
        (item) => item.hostname === "acemagic",
      );
      expect(omv?.id).not.toBe(sourceOmv.id);
      expect(
        importedPortal.relations.some(
          (relation) =>
            relation.fromDeviceId === omv?.id &&
            relation.toDeviceId === acmagic?.id,
        ),
      ).toBe(true);
    } finally {
      roundTripDatabase.close();
    }
  });

  it("rejects duplicate relation triples and missing relation names in YAML", async () => {
    const before = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    const exported = parseYaml(
      await (await app.request("/api/export")).text(),
    ) as {
      relationNames: Array<Record<string, unknown>>;
      relations: Array<{
        from: { device: string; interface: string };
        to: { device: string; interface: string };
        relationName: string;
      }>;
    };
    exported.relations.push({ ...exported.relations[0] });

    const response = await app.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: stringifyYaml(exported),
    });
    expect(response.status).toBe(400);
    expect(
      (await json<{ issues: Array<{ path: string; message: string }> }>(
        response,
      )).issues,
    ).toContainEqual(
      expect.objectContaining({
        path: expect.stringContaining("relations[5]"),
        message: expect.stringContaining("重複"),
      }),
    );
    expect(
      await json<PortalApiData>(await app.request("/api/portal")),
    ).toEqual(before);
  });

  it("upgrades legacy relation YAML before import", async () => {
    const exported = parseYaml(
      await (await app.request("/api/export")).text(),
    ) as {
      format: string;
      relationNames?: unknown;
      relations: Array<Record<string, unknown>>;
    };
    delete exported.relationNames;
    exported.format = "ouchi-ledger/1";
    // Bring the /4 export back to the /1-era shape: memberships on
    // devices, network names on services, device names on relations.
    const legacyDoc = exported as unknown as {
      devices: Array<Record<string, any>>;
      services: Array<Record<string, any>>;
    };
    const networkByInterface = new Map<string, string>();
    for (const device of legacyDoc.devices) {
      for (const iface of device.interfaces ?? []) {
        networkByInterface.set(
          `${device.hostname} ${iface.name}`,
          iface.network as string,
        );
      }
    }
    for (const device of legacyDoc.devices) {
      device.memberships = (device.interfaces ?? []).map(
        (iface: Record<string, unknown>) => {
          const { name, ...rest } = iface;
          return rest;
        },
      );
      delete device.interfaces;
    }
    for (const service of legacyDoc.services) {
      service.network = networkByInterface.get(
        `${service.device} ${service.interface}`,
      );
      delete service.interface;
    }
    exported.relations = exported.relations.map((relation, index) => ({
      from: (relation.from as unknown as { device: string }).device,
      to: (relation.to as unknown as { device: string }).device,
      tag: index === 0 ? "旧タグA" : "旧タグB",
      fromLabel: index === 0 ? "旧始点" : null,
      toLabel: index === 0 ? "旧終点" : null,
      color: index === 0 ? "#112233" : "#445566",
    }));

    const response = await app.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: stringifyYaml(exported),
    });
    expect(response.status).toBe(200);
    const portal = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(portal.relationNames).toHaveLength(2);
    expect(
      portal.relationNames.find((relationName) => relationName.name === "旧タグA"),
    ).toEqual(
      expect.objectContaining({
        color: "#112233",
        relationCount: 1,
      }),
    );
    expect(
      portal.relations.find(
        (relation) => relation.relationName === "旧タグA",
      ),
    ).toEqual(
      expect.objectContaining({
        fromLabel: "旧始点",
        toLabel: "旧終点",
      }),
    );
  });

  it("accepts legacy YAML without properties and rejects duplicate property keys", async () => {
    const exportedYaml = await (await app.request("/api/export")).text();
    const legacyDocument = parseYaml(exportedYaml) as {
      devices: Array<Record<string, unknown>>;
      services: Array<Record<string, unknown>>;
    };
    for (const item of [
      ...legacyDocument.devices,
      ...legacyDocument.services,
    ]) {
      delete item.properties;
    }

    const legacyImport = await app.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: stringifyYaml(legacyDocument),
    });
    expect(legacyImport.status).toBe(200);
    const legacyPortal = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    expect(
      legacyPortal.devices.every(
        (device) => Object.keys(device.properties).length === 0,
      ),
    ).toBe(true);
    expect(
      legacyPortal.services.every(
        (service) => Object.keys(service.properties).length === 0,
      ),
    ).toBe(true);

    const duplicateYaml = exportedYaml.replace(
      "    properties: {}\n",
      "    properties:\n      duplicate_key: one\n      duplicate_key: two\n",
    );
    expect(duplicateYaml).not.toBe(exportedYaml);
    const before = await json<PortalApiData>(
      await app.request("/api/portal"),
    );
    const duplicateImport = await app.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: duplicateYaml,
    });
    expect(duplicateImport.status).toBe(400);
    expect(
      (await json<{ issues: Array<{ message: string }> }>(duplicateImport))
        .issues,
    ).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("Map keys must be unique"),
      }),
    );
    expect(
      await json<PortalApiData>(await app.request("/api/portal")),
    ).toEqual(before);
  });

  it("leaves the database unchanged for malformed YAML and invalid references", async () => {
    const before = await json<PortalApiData>(
      await app.request("/api/portal"),
    );

    const malformed = await app.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: "format: [broken",
    });
    expect(malformed.status).toBe(400);
    expect(
      (await json<{ issues: unknown[] }>(malformed)).issues.length,
    ).toBeGreaterThan(0);
    expect(
      await json<PortalApiData>(await app.request("/api/portal")),
    ).toEqual(before);

    const exported = parseYaml(
      await (await app.request("/api/export")).text(),
    ) as {
      services: Array<{ device: string }>;
    };
    exported.services[0].device = "missing-device";
    const invalid = await app.request("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/yaml" },
      body: stringifyYaml(exported),
    });
    expect(invalid.status).toBe(400);
    const invalidBody = await json<{
      issues: Array<{ path: string; message: string }>;
    }>(invalid);
    expect(invalidBody.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining("services[0].device"),
        }),
      ]),
    );
    expect(
      await json<PortalApiData>(await app.request("/api/portal")),
    ).toEqual(before);
  });

  it("migrates an existing pre-petname database with ALTER TABLE", () => {
    const legacyPath = join(directory, "legacy.sqlite");
    const legacySchema = readFileSync(
      resolve(process.cwd(), "contract-v1/schema.sql"),
      "utf8",
    ).replace("  petname TEXT,\n", "");
    const legacyDatabase = new DatabaseSync(legacyPath);
    legacyDatabase.exec(legacySchema);
    legacyDatabase.close();

    database.close();
    database = new PortalDatabase({ filename: legacyPath });
    app = createApp(database);

    const columns = database.database
      .prepare("PRAGMA table_info(devices)")
      .all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain("petname");
    expect(
      database
        .listDevices()
        .find((device) => device.hostname === "nanopi-r2s")?.petname,
    ).toBe("門番");
  });

  it("stores dashboard and legacy icon references as canonical references", async () => {
    const iface = database.listInterfaces()[0];
    for (const [subdomain, iconKey, expected] of [
      [
        "dashboard-icon",
        "dashboard:plex",
        "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
      ],
      ["favicon-icon", "favicon", "favicon"],
      ["unset-icon", null, null],
      [
        "url-icon",
        "url:https://icons.example/custom.svg",
        "url:https://icons.example/custom.svg",
      ],
    ] as const) {
      const response = await app.request("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfaceId: iface.id,
          subdomain,
          petname: subdomain,
          description: null,
          port: 8080,
          protocol: "tcp",
          scheme: "http",
          topPath: "/",
          monitorPath: "/",
          serviceUrl: null,
          iconKey,
          enabled: true,
        }),
      });
      expect(response.status).toBe(201);
      expect(await json<PortalApiService>(response)).toEqual(
        expect.objectContaining({ iconKey: expected }),
      );
    }
    // Retired generic / preset references canonicalize to unset on write.
    const legacy = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interfaceId: iface.id,
        subdomain: "legacy-preset",
        petname: "legacy-preset",
        description: null,
        port: 8080,
        protocol: "tcp",
        scheme: "http",
        topPath: "/",
        monitorPath: "/",
        serviceUrl: null,
        iconKey: "preset:gitea",
        enabled: true,
      }),
    });
    expect(legacy.status).toBe(201);
    expect(await json<PortalApiService>(legacy)).toEqual(
      expect.objectContaining({ iconKey: null }),
    );
    expect(
      (await app.request("/api/icons/dashboard/plex")).status,
    ).toBe(404);
  });

  it("round-trips unset, favicon, and URL references through YAML", async () => {
    const services = database.listServices();
    database.database
      .prepare("UPDATE services SET icon_key = ? WHERE id = ?")
      .run("dashboard:plex", services[0].id);
    database.database
      .prepare("UPDATE services SET icon_key = ? WHERE id = ?")
      .run("generic:mail", services[1].id);
    database.database
      .prepare("UPDATE services SET icon_key = ? WHERE id = ?")
      .run("preset:gitea", services[2].id);
    database.database
      .prepare("UPDATE services SET icon_key = ? WHERE id = ?")
      .run("favicon", services[3].id);
    database.database
      .prepare(
        "UPDATE services SET icon_key = ?, favicon_url = NULL WHERE id = ?",
      )
      .run("url:https://icons.example/custom.svg", services[4].id);

    const exported = parseYaml(
      await (await app.request("/api/export")).text(),
    ) as {
      services: Array<{ iconKey: string | null }>;
    };
    expect(exported.services.map((service) => service.iconKey)).toEqual(
      expect.arrayContaining([
        "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
        null,
        null,
        "favicon",
        "url:https://icons.example/custom.svg",
      ]),
    );
    expect(
      exported.services.every(
        (service) =>
          service.iconKey === null ||
          /^(?:url:|favicon$)/.test(service.iconKey),
      ),
    ).toBe(true);

    const targetDatabase = new PortalDatabase({
      filename: join(directory, "icon-round-trip.sqlite"),
    });
    const targetApp = createApp(targetDatabase);
    const legacyImport = structuredClone(exported) as {
      services: Array<{
        iconKey: string | null;
        faviconUrl?: string | null;
      }>;
    };
    legacyImport.services[0].iconKey = "dashboard:plex";
    legacyImport.services[1].iconKey = "preset:gitea";
    legacyImport.services[2].iconKey = "generic:mail";
    legacyImport.services[3].iconKey = "favicon";
    // A legacy file carries only faviconUrl, with no iconKey field at all.
    delete (legacyImport.services[4] as { iconKey?: string | null }).iconKey;
    legacyImport.services[4].faviconUrl =
      "https://icons.example/legacy-favicon.png";
    try {
      const imported = await targetApp.request("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/yaml" },
        body: stringifyYaml(legacyImport),
      });
      expect(imported.status).toBe(200);

      const reExported = parseYaml(
        await (await targetApp.request("/api/export")).text(),
      ) as {
        exportedAt?: string;
        services: Array<{ iconKey: string | null }>;
      };
      expect(reExported.services.map((service) => service.iconKey)).toEqual(
        expect.arrayContaining([
          "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
          null,
          null,
          "favicon",
          "url:https://icons.example/legacy-favicon.png",
        ]),
      );
      expect(
        reExported.services.every(
          (service) =>
            service.iconKey === null ||
            /^(?:url:|favicon$)/.test(service.iconKey),
        ),
      ).toBe(true);
      expect(
        targetDatabase
          .listServices()
          .find((service) => service.subdomain === services[0].subdomain)
          ?.iconKey,
      ).toBe(
        "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
      );
    } finally {
      targetDatabase.close();
    }
  });
});
