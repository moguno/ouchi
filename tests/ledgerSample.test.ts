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

    expect(ledger.format).toBe("ouchi-ledger/1");
    expect(ledger.settings.title).toBe("あなたのおうち環境");
    expect(ledger.networks).toHaveLength(4);
    expect(ledger.networks.map((network) => network.name)).toEqual([
      "インターネット",
      "家族用LAN",
      "ホームラボ",
      "個人ネットワーク",
    ]);
    expect(ledger.networks.map((network) => network.cidr)).toEqual([
      "192.0.2.0/24",
      "198.51.100.0/24",
      "203.0.113.0/24",
      "198.18.0.0/24",
    ]);
    expect(ledger.devices).toHaveLength(19);
    expect(
      ledger.devices.flatMap((device) => device.memberships),
    ).toHaveLength(21);
    expect(ledger.services).toHaveLength(16);
    expect(ledger.relations).toHaveLength(5);
    expect(ledger.relations.every((relation) => relation.color === "#d48a2f"))
      .toBe(true);
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
      ledger.devices.flatMap((device) => device.memberships).every(
        (membership) =>
          membership.ip === null ||
          /^(?:192\.0\.2|198\.51\.100|203\.0\.113|198\.18)\./.test(
            membership.ip,
          ),
      ),
    ).toBe(true);
    const assignedIps = ledger.devices
      .flatMap((device) => device.memberships)
      .flatMap((membership) => (membership.ip ? [membership.ip] : []));
    expect(new Set(assignedIps).size).toBe(assignedIps.length);
    const networkNames = new Set(
      ledger.networks.map((network) => network.name),
    );
    expect(
      ledger.devices
        .flatMap((device) => device.memberships)
        .every((membership) => networkNames.has(membership.network)),
    ).toBe(true);
    expect(
      ledger.services.every((service) =>
        ledger.devices.some(
          (device) =>
            device.hostname === service.device &&
            device.memberships.some(
              (membership) => membership.network === service.network,
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
          isVm: false,
          petname: expect.any(String),
          memberships: [
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
    expect(physicalHostnames.size).toBe(10);
    expect(
      ledger.devices
        .filter((device) =>
          device.memberships.some(
            (membership) => membership.network === "家族用LAN",
          ),
        )
        .filter((device) => physicalHostnames.has(device.hostname)),
    ).toHaveLength(4);
    expect(
      ledger.devices
        .filter((device) =>
          device.memberships.some(
            (membership) => membership.network === "ホームラボ",
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
      ].map(
        (network) =>
          ledger.devices.filter((device) =>
            device.memberships.some(
              (membership) => membership.network === network,
            ),
          ).length,
      ),
    ).toEqual([2, 5, 9, 5]);

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
      l3Switch?.memberships.map((membership) => ({
        network: membership.network,
        ip: membership.ip,
      })),
    ).toEqual([
      { network: "家族用LAN", ip: "198.51.100.1" },
      { network: "ホームラボ", ip: "203.0.113.1" },
      { network: "個人ネットワーク", ip: "198.18.0.1" },
    ]);
    expect(
      l3Switch?.memberships.some(
        (membership) => membership.network === "インターネット",
      ),
    ).toBe(false);

    const host = ledger.devices.find(
      (device) => device.hostname === "cedar-host",
    );
    expect(host?.category).toBe("physical");
    expect(host?.memberships).toEqual([
      expect.objectContaining({
        network: "ホームラボ",
        ip: "203.0.113.10",
        label: "VMホスト",
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
          device.memberships.length === 1 &&
          device.memberships[0].network === "ホームラボ",
      ),
    ).toBe(true);
    expect(
      vms.slice(3).every(
        (device) =>
          device.isVm &&
          device.memberships.length === 1 &&
          device.memberships[0].network === "個人ネットワーク",
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
          isVm: device?.isVm,
          network: device?.memberships[0]?.network,
          ip: device?.memberships[0]?.ip,
        };
      }),
    ).toEqual([
      {
        hostname: "l2-switch",
        category: "network",
        isVm: false,
        network: "個人ネットワーク",
        ip: "198.18.0.2",
      },
      {
        hostname: "akari",
        category: "physical",
        isVm: false,
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
          isVm: device?.isVm,
          network: device?.memberships[0]?.network,
          ip: device?.memberships[0]?.ip,
        };
      }),
    ).toEqual([
      {
        hostname: "acorn-notes",
        category: "vm",
        isVm: true,
        network: "個人ネットワーク",
        ip: "198.18.0.31",
      },
      {
        hostname: "fern-gallery",
        category: "vm",
        isVm: true,
        network: "個人ネットワーク",
        ip: "198.18.0.32",
      },
    ]);
    expect(
      ledger.relations
        .filter((relation) =>
          ["acorn-notes", "fern-gallery"].includes(relation.to),
        )
        .map((relation) => relation.from),
    ).toEqual(["akari", "akari"]);
    expect(
      ledger.devices.find((device) => device.hostname === "spruce-host"),
    ).toBeUndefined();
    expect(
      ledger.relations.map((relation) => ({
        from: relation.from,
        to: relation.to,
        tag: relation.tag,
        fromLabel: relation.fromLabel,
        toLabel: relation.toLabel,
        color: relation.color,
      })),
    ).toEqual([
      {
        from: "cedar-host",
        to: "harbor-core",
        tag: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
        color: "#d48a2f",
      },
      {
        from: "cedar-host",
        to: "atlas-lab",
        tag: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
        color: "#d48a2f",
      },
      {
        from: "cedar-host",
        to: "forge-ci",
        tag: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
        color: "#d48a2f",
      },
      {
        from: "akari",
        to: "acorn-notes",
        tag: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
        color: "#d48a2f",
      },
      {
        from: "akari",
        to: "fern-gallery",
        tag: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
        color: "#d48a2f",
      },
    ]);

    const deviceByHostname = new Map(
      ledger.devices.map((device) => [device.hostname, device]),
    );
    const networksByHostname = new Map(
      ledger.devices.map((device) => [
        device.hostname,
        new Set(device.memberships.map((membership) => membership.network)),
      ]),
    );
    for (const relation of ledger.relations) {
      const from = deviceByHostname.get(relation.from);
      const to = deviceByHostname.get(relation.to);
      expect(from).toEqual(
        expect.objectContaining({
          category: "physical",
          isVm: false,
        }),
      );
      expect(to).toEqual(
        expect.objectContaining({
          category: "vm",
          isVm: true,
        }),
      );
      const sharedNetworks = [
        ...(networksByHostname.get(relation.from) ?? []),
      ].filter((network) =>
        networksByHostname.get(relation.to)?.has(network),
      );
      expect(sharedNetworks).toHaveLength(1);
      expect(sharedNetworks[0]).toBe(to?.memberships[0]?.network);
    }

    expect(
      ledger.services.find(
        (service) => service.subdomain === "ouchi-pages",
      ),
    ).toEqual(
      expect.objectContaining({
        device: "ouchi-pages",
        network: "インターネット",
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
        network: "インターネット",
        petname: "Google Drive",
        description: "Google のクラウドストレージサービス",
        serviceUrl: "https://drive.google.com/",
        iconKey:
          "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/google-drive.svg",
      }),
    );
  });
});
