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
    expect(ledger.networks).toHaveLength(3);
    expect(ledger.networks.map((network) => network.cidr)).toEqual([
      "192.0.2.0/24",
      "198.51.100.0/24",
      "203.0.113.0/24",
    ]);
    expect(ledger.devices).toHaveLength(15);
    expect(
      ledger.devices.flatMap((device) => device.memberships),
    ).toHaveLength(17);
    expect(ledger.services).toHaveLength(16);
    expect(ledger.relations).toHaveLength(3);
    expect(
      ledger.devices.filter((device) => device.category === "service"),
    ).toHaveLength(2);
    expect(
      ledger.devices.flatMap((device) => device.memberships).every(
        (membership) =>
          membership.ip === null ||
          /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./.test(membership.ip),
      ),
    ).toBe(true);
    const assignedIps = ledger.devices
      .flatMap((device) => device.memberships)
      .flatMap((membership) => (membership.ip ? [membership.ip] : []));
    expect(new Set(assignedIps).size).toBe(assignedIps.length);

    const expectedAdditions = [
      ["birch-print", "自宅 LAN", "198.51.100.20"],
      ["maple-nas", "自宅 LAN", "198.51.100.21"],
      ["willow-weather", "自宅 LAN", "198.51.100.22"],
      ["clover-cam", "自宅 LAN", "198.51.100.23"],
      ["granite-backup", "サーバーセグメント", "203.0.113.40"],
      ["slate-mail", "サーバーセグメント", "203.0.113.41"],
      ["juniper-dns", "サーバーセグメント", "203.0.113.42"],
      ["amber-vault", "サーバーセグメント", "203.0.113.43"],
    ] as const;
    for (const [hostname, network, ip] of expectedAdditions) {
      const device = ledger.devices.find(
        (candidate) => candidate.hostname === hostname,
      );
      expect(device).toEqual(
        expect.objectContaining({
          category: "physical",
          isVm: false,
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
    expect(physicalHostnames.size).toBe(9);
    expect(
      ledger.devices
        .filter((device) =>
          device.memberships.some(
            (membership) => membership.network === "自宅 LAN",
          ),
        )
        .filter((device) => physicalHostnames.has(device.hostname)),
    ).toHaveLength(4);
    expect(
      ledger.devices
        .filter((device) =>
          device.memberships.some(
            (membership) => membership.network === "サーバーセグメント",
          ),
        )
        .filter((device) => physicalHostnames.has(device.hostname)),
    ).toHaveLength(5);
    expect(
      [
        "インターネット",
        "自宅 LAN",
        "サーバーセグメント",
      ].map(
        (network) =>
          ledger.devices.filter((device) =>
            device.memberships.some(
              (membership) => membership.network === network,
            ),
          ).length,
      ),
    ).toEqual([3, 5, 9]);

    const gateway = ledger.devices.find(
      (device) => device.hostname === "aura-gw",
    );
    expect(
      gateway?.memberships.map((membership) => ({
        network: membership.network,
        ip: membership.ip,
      })),
    ).toEqual([
      { network: "インターネット", ip: "192.0.2.1" },
      { network: "自宅 LAN", ip: "198.51.100.1" },
      { network: "サーバーセグメント", ip: "203.0.113.1" },
    ]);

    const host = ledger.devices.find(
      (device) => device.hostname === "cedar-host",
    );
    expect(host?.category).toBe("physical");
    expect(host?.memberships).toEqual([
      expect.objectContaining({
        network: "サーバーセグメント",
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
    ]);
    expect(
      vms.every(
        (device) =>
          device.memberships.length === 1 &&
          device.memberships[0].network === "サーバーセグメント",
      ),
    ).toBe(true);
    expect(
      ledger.relations.map((relation) => ({
        from: relation.from,
        to: relation.to,
        tag: relation.tag,
        fromLabel: relation.fromLabel,
        toLabel: relation.toLabel,
      })),
    ).toEqual([
      {
        from: "cedar-host",
        to: "harbor-core",
        tag: "VM",
        fromLabel: "VMホスト",
        toLabel: "親ホスト",
      },
      {
        from: "cedar-host",
        to: "atlas-lab",
        tag: "VM",
        fromLabel: "VMホスト",
        toLabel: "親ホスト",
      },
      {
        from: "cedar-host",
        to: "forge-ci",
        tag: "VM",
        fromLabel: "VMホスト",
        toLabel: "親ホスト",
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
      expect(sharedNetworks).toEqual(["サーバーセグメント"]);
    }

    expect(
      ledger.services.find(
        (service) => service.subdomain === "ouchi-pages",
      ),
    ).toEqual(
      expect.objectContaining({
        device: "ouchi-pages",
        network: "インターネット",
        serviceUrl: "https://moguno.github.io/ouchi/",
      }),
    );
  });
});
