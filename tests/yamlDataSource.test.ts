import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import {
  YAMLDataSourceError,
  ledgerYamlToPortalData,
} from "../src/portal/yamlDataSource";

const sampleYaml = readFileSync(
  resolve(process.cwd(), "public/ouchi-ledger.sample.yaml"),
  "utf8",
);

describe("YAML data source", () => {
  it("converts the ouchi-ledger/1 natural-key export to portal data", () => {
    const data = ledgerYamlToPortalData(sampleYaml);

    expect(data.version).toBe(2);
    expect(data.settings).toEqual({
      domain: "ouchi.example",
      title: "あなたのおうち環境",
    });
    expect(data.networks).toHaveLength(4);
    expect(data.devices).toHaveLength(19);
    expect(data.deviceNetworks).toHaveLength(21);
    expect(data.relations).toHaveLength(5);
    expect(data.services).toHaveLength(16);
    expect(data.devices.every((device) => Boolean(device.petname))).toBe(true);
    expect(
      data.devices.find((device) => device.name === "cedar-host")?.petname,
    ).toBe("Alicia");
    expect(
      data.services.every((service) =>
        /^(?:generic:|url:|favicon$)/.test(service.iconKey),
      ),
    ).toBe(true);
    expect(data.networks.map((network) => network.id)).toEqual([
      "network-1",
      "network-2",
      "network-3",
      "network-4",
    ]);
    expect(data.networks.map((network) => network.name)).toEqual([
      "インターネット",
      "家族用LAN",
      "ホームラボ",
      "個人ネットワーク",
    ]);
    expect(data.devices.find((device) => device.name === "l3-switch")).toEqual(
      expect.objectContaining({
        category: "network",
        meterEnabled: false,
      }),
    );
    expect(
      data.devices
        .filter((device) => device.category === "service")
        .map((device) => device.name),
    ).toEqual(["lumen-notes", "ouchi-pages"]);
  });

  it("resolves services and relations through device and network names", () => {
    const data = ledgerYamlToPortalData(sampleYaml);
    const home = data.services.find(
      (service) => service.subdomain === "home",
    );
    const l3Switch = data.devices.find(
      (device) => device.name === "l3-switch",
    );
    const homeLanMembership = data.deviceNetworks.find(
      (membership) =>
        membership.deviceId === l3Switch?.id &&
        membership.networkId === "network-2",
    );
    const atlasLab = data.devices.find(
      (device) => device.name === "atlas-lab",
    );
    const atlasRelation = data.relations.find(
      (relation) => relation.toDeviceId === atlasLab?.id,
    );

    expect(home?.deviceNetworkId).toBe(homeLanMembership?.id);
    expect(home?.url).toBe("http://198.51.100.1:80/");
    expect(homeLanMembership?.ip).toBe("198.51.100.1");
    expect(atlasRelation).toEqual(
      expect.objectContaining({
        tag: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
      }),
    );
    expect(
      data.relations.map((relation) => relation.color),
    ).toEqual(Array.from({ length: 5 }, () => "#d48a2f"));
  });

  it("rejects conflicting colours for one tag in YAML", () => {
    const parsed = parse(sampleYaml) as {
      tags?: unknown;
      relations: Array<{ color: string }>;
    };
    expect(parsed).not.toHaveProperty("tags");
    parsed.relations[1].color = "#4d9b78";

    expect(() => ledgerYamlToPortalData(stringify(parsed))).toThrowError(
      YAMLDataSourceError,
    );
    try {
      ledgerYamlToPortalData(stringify(parsed));
    } catch (error) {
      expect(error).toBeInstanceOf(YAMLDataSourceError);
      expect((error as YAMLDataSourceError).issues).toContainEqual(
        expect.objectContaining({
          path: "relations.relation-2.color",
          message: expect.stringContaining("統一してください"),
        }),
      );
    }
  });

  it("resolves the personal network and its host-to-VM relations", () => {
    const data = ledgerYamlToPortalData(sampleYaml);
    const personalNetwork = data.networks.find(
      (network) => network.name === "個人ネットワーク",
    );
    const expectedIps = new Map([
      ["l3-switch", "198.18.0.1"],
      ["l2-switch", "198.18.0.2"],
      ["akari", "198.18.0.10"],
      ["acorn-notes", "198.18.0.31"],
      ["fern-gallery", "198.18.0.32"],
    ]);

    expect(personalNetwork).toEqual(
      expect.objectContaining({
        id: "network-4",
        cidr: "198.18.0.0/24",
      }),
    );
    for (const [deviceName, ip] of expectedIps) {
      const device = data.devices.find(
        (candidate) => candidate.name === deviceName,
      );
      const membership = data.deviceNetworks.find(
        (candidate) =>
          candidate.deviceId === device?.id &&
          candidate.networkId === personalNetwork?.id,
      );
      expect(membership?.ip).toBe(ip);
    }

    const host = data.devices.find(
      (device) => device.name === "akari",
    );
    const newVmIds = ["acorn-notes", "fern-gallery"].map(
      (name) => data.devices.find((device) => device.name === name)?.id,
    );
    expect(
      data.relations
        .filter(
          (relation) =>
            relation.fromDeviceId === host?.id &&
            newVmIds.includes(relation.toDeviceId),
        )
        .map((relation) => relation.toDeviceId),
    ).toEqual(newVmIds);
  });

  it("uses the Google Drive name, URL, and icon for the cloud storage sample", () => {
    const data = ledgerYamlToPortalData(sampleYaml);
    const external = data.services.find(
      (service) => service.subdomain === "lumen-notes",
    );

    expect(external).toEqual(
      expect.objectContaining({
        deviceNetworkId: expect.any(String),
        subdomain: "lumen-notes",
        petname: "Google Drive",
        description: "Google のクラウドストレージサービス",
        serviceUrl: "https://drive.google.com/",
        iconKey:
          "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/google-drive.svg",
        url: "https://drive.google.com/",
        monitorUrl: "https://drive.google.com/",
      }),
    );
    expect(
      data.deviceNetworks.find(
        (membership) => membership.id === external?.deviceNetworkId,
      )?.ip,
    ).toBe("");
  });

  it("links the Pages demo service to its own public URL", () => {
    const data = ledgerYamlToPortalData(sampleYaml);
    const pagesService = data.services.find(
      (service) => service.subdomain === "ouchi-pages",
    );
    const pagesDevice = data.devices.find(
      (device) => device.name === "ouchi-pages",
    );
    const pagesMembership = data.deviceNetworks.find(
      (membership) => membership.deviceId === pagesDevice?.id,
    );

    expect(pagesService).toEqual(
      expect.objectContaining({
        deviceNetworkId: pagesMembership?.id,
        subdomain: "ouchi-pages",
        petname: "GitHub",
        description: "GitHub Pages で公開するこのポータル自身",
        serviceUrl: "https://moguno.github.io/ouchi/",
        iconKey:
          "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/github.svg",
        url: "https://moguno.github.io/ouchi/",
        monitorUrl: "https://moguno.github.io/ouchi/",
      }),
    );
    expect(pagesMembership).toEqual(
      expect.objectContaining({
        networkId: "network-1",
        ip: "",
      }),
    );
  });

  it("treats a blank device petname as unset", () => {
    const data = ledgerYamlToPortalData(
      sampleYaml.replace("    petname: L3 Switch", "    petname: '   '"),
    );

    expect(
      data.devices.find((device) => device.name === "l3-switch")?.petname,
    ).toBeUndefined();
  });

  it("normalizes generic, favicon, URL, and legacy dashboard references", () => {
    const yaml = sampleYaml
      .replace("    iconKey: generic:server", "    iconKey: generic:mail")
      .replace("    iconKey: generic:gitea", "    iconKey: dashboard:gitea")
      .replace("    iconKey: generic:database", "    iconKey: favicon")
      .replace(
        "    iconKey: generic:proxmox",
        "    iconKey: url:https://icons.example/proxmox.svg",
      );
    const data = ledgerYamlToPortalData(yaml);

    expect(
      data.services.filter(
        (service) =>
          service.iconKey === "generic:mail" ||
          service.iconKey ===
            "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/gitea.svg" ||
          service.iconKey === "favicon" ||
          service.iconKey === "url:https://icons.example/proxmox.svg",
      ),
    ).toHaveLength(4);
    expect(
      data.services.every((service) =>
        /^(?:generic:|url:|favicon$)/.test(service.iconKey),
      ),
    ).toBe(true);
  });

  it("reports invalid natural-key references", () => {
    const invalid = sampleYaml.replace(
      "    device: harbor-core\n    network: ホームラボ\n    petname: 工房Git",
      "    device: missing-host\n    network: ホームラボ\n    petname: 工房Git",
    );

    expect(() => ledgerYamlToPortalData(invalid)).toThrow(
      YAMLDataSourceError,
    );
    try {
      ledgerYamlToPortalData(invalid);
    } catch (error) {
      const failure = error as YAMLDataSourceError;
      expect(failure.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "services[1]",
            message: "missing-host の ホームラボ 所属が存在しません",
          }),
        ]),
      );
    }
  });

  it("rejects documents that are not ouchi-ledger/1", () => {
    expect(() =>
      ledgerYamlToPortalData(
        sampleYaml.replace(
          "format: ouchi-ledger/1",
          "format: ouchi-ledger/2",
        ),
      ),
    ).toThrow(/formatは「ouchi-ledger\/1」/);
  });
});
