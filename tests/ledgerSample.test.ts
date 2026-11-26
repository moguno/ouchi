import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLedgerYaml } from "../server/ledgerTransfer";

describe("Pages sample ledger", () => {
  it("is accepted by the same parser used by the API import endpoint", () => {
    const yaml = readFileSync(
      resolve(process.cwd(), "public/ouchi-ledger.sample.yaml"),
      "utf8",
    );
    const ledger = parseLedgerYaml(yaml);

    expect(ledger.format).toBe("ouchi-ledger/13");
    expect(ledger.settings.title).toBe("あなたのおうち環境");
    expect(ledger.networks).toHaveLength(6);
    expect(ledger.networks.map((network) => network.name)).toEqual([
      "家族用LAN",
      "ホームラボ",
      "個人ネットワーク",
      "データ基盤",
      "アプリ基盤",
      "インターネット",
    ]);
    expect(ledger.networks.map((network) => network.cidr)).toEqual([
      "198.51.100.0/24",
      "203.0.113.0/24",
      "198.18.0.0/24",
      "198.18.1.0/24",
      "198.18.2.0/24",
      "192.0.2.0/24",
    ]);
    expect(ledger.settings.properties).toEqual({
      運用方針: "架空のサンプル台帳。実在の機器・アドレスは含まれない",
      バックアップ: "週1回、台帳YAMLをエクスポートして保管",
    });
    expect(
      ledger.networks.find((network) => network.name === "ホームラボ")
        ?.properties,
    ).toEqual({ 方針: "検証はステージングで先に試してから本番へ" });
    expect(ledger.devices).toHaveLength(25);
    expect(
      ledger.devices.flatMap((device) => device.interfaces),
    ).toHaveLength(29);
    expect(ledger.services).toHaveLength(23);
    expect(ledger.relations).toHaveLength(10);
    const postgres = ledger.services.find(
      (service) => service.subdomain === "basalt-pg",
    );
    expect(postgres).toMatchObject({
      port: 5432,
      protocol: "tcp",
      scheme: "none",
    });
    const dbRelations = ledger.relations.filter(
      (relation) => relation.relationName === "DB",
    );
    expect(dbRelations).toHaveLength(2);
    for (const relation of dbRelations) {
      expect(relation.port).toBe(5432);
      expect(relation.protocol).toBe("tcp");
      expect(relation.toLabel ?? "").toBe("");
    }
    expect(ledger.relationNames).toEqual([
      expect.objectContaining({
        name: "VM",
        color: "#d48a2f",
      }),
      expect.objectContaining({
        name: "レプリケーション",
        color: "#c2185b",
        lineStart: "none",
        lineEnd: "arrow",
      }),
      expect.objectContaining({
        name: "DB",
        color: "#0277bd",
        lineStart: "none",
        lineEnd: "arrow",
      }),
      expect.objectContaining({
        name: "Webhook",
        color: "#f4511e",
        lineStart: "none",
        lineEnd: "arrow",
      }),
      expect.objectContaining({
        name: "NFS",
        color: "#558b2f",
        lineStart: "none",
        lineEnd: "arrow",
      }),
    ]);
    expect(ledger.relations[0]).toEqual(
      expect.objectContaining({ fromLabel: "親ホスト", toLabel: "VM" }),
    );
    const devicePetnames = ledger.devices.map((device) => device.petname);
    const servicePetnames = ledger.services.map((service) => service.petname);
    expect(devicePetnames.every((petname) => Boolean(petname))).toBe(true);
    expect(
      devicePetnames.every(
        (petname) => petname !== null && [...petname].length <= 20,
      ),
    ).toBe(true);
    expect(
      devicePetnames.filter((petname) => servicePetnames.includes(petname)),
    ).toEqual(["Google Drive", "GitHub"]);
    expect(
      ledger.devices.find((device) => device.hostname === "l3-switch")?.petname,
    ).toBe("L3 Switch");
    expect(
      ledger.devices.filter((device) => device.category === "service"),
    ).toHaveLength(2);
    expect(
      ledger.devices.flatMap((device) => device.interfaces).every(
        (iface) =>
          iface.ip === null ||
          /^(?:192\.0\.2|198\.51\.100|203\.0\.113|198\.18)\./.test(
            iface.ip,
          ),
      ),
    ).toBe(true);
    const assignedIps = ledger.devices
      .flatMap((device) => device.interfaces)
      .flatMap((iface) => (iface.ip ? [iface.ip] : []));
    expect(new Set(assignedIps).size).toBe(assignedIps.length);
    const networkNames = new Set(
      ledger.networks.map((network) => network.name),
    );
    expect(
      ledger.devices
        .flatMap((device) => device.interfaces)
        .every(
          (iface) => iface.network === null || networkNames.has(iface.network),
        ),
    ).toBe(true);
    expect(
      ledger.services.every((service) =>
        ledger.devices.some(
          (device) =>
            device.hostname === service.device &&
            device.interfaces.some(
              (iface) => iface.name === service.interface,
            ),
        ),
      ),
    ).toBe(true);

    const expectedAdditions = [
      ["birch-print", "家族用LAN", "198.51.100.20"],
      ["maple-nas", "家族用LAN", "198.51.100.21"],
      ["willow-weather", "家族用LAN", "198.51.100.22"],
      ["clover-cam", "家族用LAN", "198.51.100.23"],
      ["granite-backup", "ホームラボ", "203.0.113.40"],
      ["slate-mail", "ホームラボ", "203.0.113.41"],
      ["juniper-dns", "ホームラボ", "203.0.113.42"],
      ["amber-vault", "ホームラボ", "203.0.113.43"],
    ] as const;
    for (const [hostname, network, ip] of expectedAdditions) {
      const device = ledger.devices.find(
        (candidate) => candidate.hostname === hostname,
      );
      expect(device).toEqual(
        expect.objectContaining({
          category: "physical",
          petname: expect.any(String),
          interfaces: [
            expect.objectContaining({
              network,
              ip,
            }),
          ],
        }),
      );
      expect(
        ledger.services.some((service) => service.device === hostname),
      ).toBe(true);
    }

    const physicalHostnames = new Set(
      ledger.devices
        .filter((device) => device.category === "physical")
        .map((device) => device.hostname),
    );
    expect(physicalHostnames.size).toBe(16);
    expect(
      ledger.devices
        .filter((device) =>
          device.interfaces.some(
            (iface) => iface.network === "家族用LAN",
          ),
        )
        .filter((device) => physicalHostnames.has(device.hostname)),
    ).toHaveLength(4);
    expect(
      ledger.devices
        .filter((device) =>
          device.interfaces.some(
            (iface) => iface.network === "ホームラボ",
          ),
        )
        .filter((device) => physicalHostnames.has(device.hostname)),
    ).toHaveLength(5);
    expect(
      [
        "インターネット",
        "家族用LAN",
        "ホームラボ",
        "個人ネットワーク",
        "データ基盤",
        "アプリ基盤",
      ].map(
        (network) =>
          ledger.devices.filter((device) =>
            device.interfaces.some(
              (iface) => iface.network === network,
            ),
          ).length,
      ),
    ).toEqual([2, 5, 9, 5, 4, 4]);

    const l3Switch = ledger.devices.find(
      (device) => device.hostname === "l3-switch",
    );
    expect(
      ledger.devices.find((device) => device.hostname === "aura-gw"),
    ).toBeUndefined();
    expect(
      l3Switch?.category,
    ).toBe("network");
    expect(
      l3Switch?.interfaces.map((iface) => ({
        network: iface.network,
        ip: iface.ip,
      })),
    ).toEqual([
      { network: "家族用LAN", ip: "198.51.100.1" },
      { network: "ホームラボ", ip: "203.0.113.1" },
      { network: "個人ネットワーク", ip: "198.18.0.1" },
      { network: "データ基盤", ip: "198.18.1.1" },
      { network: "アプリ基盤", ip: "198.18.2.1" },
    ]);
    expect(
      l3Switch?.interfaces.some(
        (iface) => iface.network === "インターネット",
      ),
    ).toBe(false);

    const host = ledger.devices.find(
      (device) => device.hostname === "cedar-host",
    );
    expect(host?.category).toBe("physical");
    expect(host?.interfaces).toEqual([
      expect.objectContaining({
        network: "ホームラボ",
        ip: "203.0.113.10",
        mac: null,
      }),
    ]);
    const vms = ledger.devices.filter(
      (device) => device.category === "vm",
    );
    expect(vms.map((device) => device.hostname)).toEqual([
      "harbor-core",
      "atlas-lab",
      "forge-ci",
      "acorn-notes",
      "fern-gallery",
    ]);
    expect(
      vms.slice(0, 3).every(
        (device) =>
          device.interfaces.length === 1 &&
          device.interfaces[0].network === "ホームラボ",
      ),
    ).toBe(true);
    expect(
      vms.slice(3).every(
        (device) =>
          device.category === "vm" &&
          device.interfaces.length === 1 &&
          device.interfaces[0].network === "個人ネットワーク",
      ),
    ).toBe(true);
    expect(
      ["l2-switch", "akari"].map((hostname) => {
        const device = ledger.devices.find(
          (candidate) => candidate.hostname === hostname,
        );
        return {
          hostname,
          category: device?.category,
          network: device?.interfaces[0]?.network,
          ip: device?.interfaces[0]?.ip,
        };
      }),
    ).toEqual([
      {
        hostname: "l2-switch",
        category: "network",
        network: "個人ネットワーク",
        ip: "198.18.0.2",
      },
      {
        hostname: "akari",
        category: "physical",
        network: "個人ネットワーク",
        ip: "198.18.0.10",
      },
    ]);
    expect(
      ["acorn-notes", "fern-gallery"].map((hostname) => {
        const device = ledger.devices.find(
          (candidate) => candidate.hostname === hostname,
        );
        return {
          hostname,
          category: device?.category,
          network: device?.interfaces[0]?.network,
          ip: device?.interfaces[0]?.ip,
        };
      }),
    ).toEqual([
      {
        hostname: "acorn-notes",
        category: "vm",
        network: "個人ネットワーク",
        ip: "198.18.0.31",
      },
      {
        hostname: "fern-gallery",
        category: "vm",
        network: "個人ネットワーク",
        ip: "198.18.0.32",
      },
    ]);
    const endpointLabel = (endpoint: { device: string } | { service: string }) =>
      "service" in endpoint ? `service:${endpoint.service}` : endpoint.device;
    expect(
      ledger.relations
        .filter(
          (relation) =>
            "device" in relation.to &&
            ["acorn-notes", "fern-gallery"].includes(relation.to.device),
        )
        .map((relation) =>
          "device" in relation.from ? relation.from.device : "",
        ),
    ).toEqual(["akari", "akari"]);
    expect(
      ledger.devices.find((device) => device.hostname === "spruce-host"),
    ).toBeUndefined();
    expect(
      ledger.relations.map((relation) => ({
        from: endpointLabel(relation.from),
        to: endpointLabel(relation.to),
        relationName: relation.relationName,
      })),
    ).toEqual([
      {
        from: "cedar-host",
        to: "harbor-core",
        relationName: "VM",
      },
      {
        from: "cedar-host",
        to: "atlas-lab",
        relationName: "VM",
      },
      {
        from: "cedar-host",
        to: "forge-ci",
        relationName: "VM",
      },
      {
        from: "akari",
        to: "acorn-notes",
        relationName: "VM",
      },
      {
        from: "akari",
        to: "fern-gallery",
        relationName: "VM",
      },
      {
        from: "basalt-db",
        to: "onyx-db",
        relationName: "レプリケーション",
      },
      {
        from: "service:app1",
        to: "basalt-db",
        relationName: "DB",
      },
      {
        from: "service:app2",
        to: "basalt-db",
        relationName: "DB",
      },
      {
        from: "service:app1",
        to: "service:app3",
        relationName: "Webhook",
      },
      {
        from: "quartz-nas",
        to: "app2",
        relationName: "NFS",
      },
    ]);

    const deviceByHostname = new Map(
      ledger.devices.map((device) => [device.hostname, device]),
    );
    const serviceDeviceBySubdomain = new Map(
      ledger.services.map((service) => [service.subdomain, service.device]),
    );
    const endpointHostname = (
      endpoint: { device: string } | { service: string },
    ) =>
      "service" in endpoint
        ? serviceDeviceBySubdomain.get(endpoint.service)
        : endpoint.device;
    const networksByHostname = new Map(
      ledger.devices.map((device) => [
        device.hostname,
        new Set(device.interfaces.map((iface) => iface.network)),
      ]),
    );
    for (const relation of ledger.relations) {
      const fromHostname = endpointHostname(relation.from);
      const toHostname = endpointHostname(relation.to);
      const from = deviceByHostname.get(fromHostname!);
      const to = deviceByHostname.get(toHostname!);
      expect(from).toEqual(
        expect.objectContaining({
          category: "physical",
        }),
      );
      if (relation.relationName === "VM") {
        expect(to).toEqual(
          expect.objectContaining({
            category: "vm",
          }),
        );
      }
      const sharedNetworks = [
        ...(networksByHostname.get(fromHostname!) ?? []),
      ].filter((network) =>
        networksByHostname.get(toHostname!)?.has(network),
      );
      if (relation.relationName === "DB" || relation.relationName === "NFS") {
        // Routed across the L3 switch: the two devices share no
        // network of their own.
        expect(sharedNetworks).toHaveLength(0);
        if (relation.relationName === "DB") {
          expect(to?.hostname).toBe("basalt-db");
        }
      } else {
        expect(sharedNetworks).toHaveLength(1);
        expect(sharedNetworks[0]).toBe(to?.interfaces[0]?.network);
      }
    }
    const replication = ledger.relations.find(
      (relation) => relation.relationName === "レプリケーション",
    );
    expect(replication).toEqual(
      expect.objectContaining({
        fromLabel: "プライマリ",
        toLabel: "レプリカ",
      }),
    );
    expect(
      deviceByHostname.get(endpointHostname(replication!.to) ?? "")?.category,
    ).toBe("physical");
    expect(
      ledger.services.filter((service) =>
        ["basalt-db", "onyx-db"].includes(service.device),
      ),
    ).toHaveLength(3);
    const webhook = ledger.relations.find(
      (relation) => relation.relationName === "Webhook",
    );
    expect(webhook).toEqual(
      expect.objectContaining({
        fromLabel: "データ到着",
        toLabel: "/api/v1/hook",
      }),
    );
    const nfs = ledger.relations.find(
      (relation) => relation.relationName === "NFS",
    );
    expect(nfs).toEqual(
      expect.objectContaining({
        fromLabel: "/var/exports/data",
        toLabel: "/mnt/data",
      }),
    );

    expect(
      ledger.services.find(
        (service) => service.subdomain === "ouchi-pages",
      ),
    ).toEqual(
      expect.objectContaining({
        device: "ouchi-pages",
        interface: "eth0",
        petname: "GitHub",
        description: "GitHub Pages で公開するこのポータル自身",
        serviceUrl: "https://moguno.github.io/ouchi/",
        iconKey:
          "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/github.svg",
      }),
    );
    expect(
      ledger.services.find(
        (service) => service.subdomain === "lumen-notes",
      ),
    ).toEqual(
      expect.objectContaining({
        device: "lumen-notes",
        interface: "eth0",
        petname: "Google Drive",
        description: "Google のクラウドストレージサービス",
        serviceUrl: "https://drive.google.com/",
        iconKey:
          "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/google-drive.svg",
      }),
    );
  });
});
