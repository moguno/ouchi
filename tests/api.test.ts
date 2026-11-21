// @vitest-environment node

import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createApp } from "../server/app";
import { PortalDatabase } from "../server/db";
import type { PortalApiData, PortalApiService } from "../src/portal/types";

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
    expect(data.devices.flatMap((device) => device.memberships)).toHaveLength(
      17,
    );
    expect(data.relations).toHaveLength(5);
    expect(data.services).toHaveLength(9);
    expect(
      Object.hasOwn(data.services[0] as object, "status"),
    ).toBe(false);
    expect(
      data.devices.find((device) => device.hostname === "notion")?.category,
    ).toBe("service");
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
        category: "vm",
        isVm: true,
        sshUser: "monitor",
        sshPort: 22,
        meterEnabled: true,
        note: null,
      }),
    });
    expect(deviceResponse.status).toBe(201);
    const device = await json<{ id: number }>(deviceResponse);

    const membershipResponse = await app.request("/api/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: device.id,
        networkId: network.id,
        ip: "10.44.0.20",
        label: "test",
      }),
    });
    expect(membershipResponse.status).toBe(201);
    const membership = await json<{ id: number }>(membershipResponse);

    const serviceResponse = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceNetworkId: membership.id,
        subdomain: "api-test",
        petname: "API Test",
        description: "CRUD test",
        port: 8080,
        protocol: "tcp",
        scheme: "http",
        topPath: "/",
        monitorPath: "/health",
        serviceUrl: null,
        iconKey: "monitor",
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
          deviceNetworkId: membership.id,
          subdomain: "api-test",
          petname: "API Test Updated",
          description: "updated",
          port: 9090,
          protocol: "tcp",
          scheme: "http",
          topPath: "/",
          monitorPath: "/",
          serviceUrl: null,
          iconKey: "monitor",
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
        await app.request(`/api/devices/${device.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request(`/api/networks/${network.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(409);

    expect(
      (
        await app.request(`/api/services/${createdService.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/memberships/${membership.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/devices/${device.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request(`/api/networks/${network.id}`, {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);
  });

  it("returns ValidationIssue arrays for API input failures", async () => {
    const response = await app.request("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceNetworkId: 1,
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
        memberships: Array<Record<string, unknown>>;
      }>;
      relations: Array<Record<string, unknown>>;
      services: Array<Record<string, unknown>>;
      sshKeys: unknown[];
      deviceKeys: unknown[];
    };

    expect(document.format).toBe("ouchi-ledger/1");
    expect(Number.isNaN(Date.parse(document.exportedAt))).toBe(false);
    expect(document.settings).toEqual({
      domain: "ouchi.local",
      title: "あなたのホームラボ",
    });
    expect(document.networks[0]).not.toHaveProperty("id");
    expect(document.devices[0]).not.toHaveProperty("id");
    expect(document.devices[0].memberships[0]).not.toHaveProperty(
      "networkId",
    );
    expect(document.services[0]).toHaveProperty("device");
    expect(document.services[0]).toHaveProperty("network");
    expect(document.services[0]).not.toHaveProperty("deviceNetworkId");
    expect(document.services[0]).not.toHaveProperty("url");
    expect(document.relations[0]).toHaveProperty("from");
    expect(document.relations[0]).toHaveProperty("to");
    expect(document.sshKeys).toEqual([]);
    expect(document.deviceKeys).toEqual([]);
  });

  it("round-trips all ledger data, including public-key links, without internal IDs", async () => {
    database.database.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN IMMEDIATE;
      UPDATE networks SET id = id + 100;
      UPDATE devices SET id = id + 100;
      UPDATE device_networks
      SET id = id + 100, device_id = device_id + 100,
          network_id = network_id + 100;
      UPDATE relations
      SET id = id + 100, from_device_id = from_device_id + 100,
          to_device_id = to_device_id + 100;
      UPDATE services
      SET id = id + 100, device_network_id = device_network_id + 100;
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
          memberships: 17,
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
      delete first.exportedAt;
      delete second.exportedAt;
      expect(second).toEqual(first);

      const importedPortal = await json<PortalApiData>(
        await roundTripApp.request("/api/portal"),
      );
      expect(importedPortal.settings.title).toBe("移行先ポータル");
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
});
