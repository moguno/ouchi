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

// The /4 sample converted back to the /3 shape (memberships, string
// relation endpoints, service network names) for legacy-format tests.
function downgradeToV3(doc: Record<string, any>): Record<string, any> {
  const networkByInterface = new Map<string, string>();
  for (const device of doc.devices ?? []) {
    for (const iface of device.interfaces ?? []) {
      networkByInterface.set(
        `${device.hostname}\u0000${iface.name}`,
        iface.network,
      );
    }
  }
  for (const device of doc.devices ?? []) {
    device.memberships = (device.interfaces ?? []).map(
      (iface: Record<string, unknown>) => {
        const { name, ...rest } = iface;
        return rest;
      },
    );
    delete device.interfaces;
  }
  for (const relation of doc.relations ?? []) {
    if (typeof relation.from === "object") {
      relation.from = relation.from.device;
    }
    if (typeof relation.to === "object") {
      relation.to = relation.to.device;
    }
  }
  for (const service of doc.services ?? []) {
    service.network = networkByInterface.get(
      `${service.device}\u0000${service.interface}`,
    );
    delete service.interface;
  }
  return doc;
}

describe("YAML data source", () => {
  it("converts the ouchi-ledger/4 natural-key export to portal data", () => {
    const data = ledgerYamlToPortalData(sampleYaml);

    expect(data.version).toBe(2);
    expect(data.settings).toEqual({
      domain: "ouchi.example",
      title: "あなたのおうち環境",
    });
    expect(data.networks).toHaveLength(4);
    expect(data.devices).toHaveLength(19);
    expect(data.interfaces).toHaveLength(21);
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
    const homeLanInterface = data.interfaces.find(
      (iface) =>
        iface.deviceId === l3Switch?.id && iface.networkId === "network-2",
    );
    const atlasLab = data.devices.find(
      (device) => device.name === "atlas-lab",
    );
    const atlasRelation = data.relations.find(
      (relation) => relation.toDeviceId === atlasLab?.id,
    );

    expect(home?.interfaceId).toBe(homeLanInterface?.id);
    expect(home?.url).toBe("http://198.51.100.1:80/");
    expect(homeLanInterface?.ip).toBe("198.51.100.1");
    expect(atlasRelation).toEqual(
      expect.objectContaining({
        relationName: "VM",
        fromLabel: "親ホスト",
        toLabel: "VM",
      }),
    );
    expect(
      data.relationNames.map((relationName) => relationName.color),
    ).toEqual(["#d48a2f"]);
  });

  it("upgrades ouchi-ledger/2 documents by expanding label templates", () => {
    const document = downgradeToV3(parse(sampleYaml)) as {
      format: string;
      relationNames: Array<Record<string, unknown>>;
      relations: Array<Record<string, unknown>>;
    };
    document.format = "ouchi-ledger/2";
    document.relationNames[0].fromLabel = "ホスト{}";
    document.relationNames[0].toLabel = "VM{}";
    for (const relation of document.relations) {
      delete relation.fromLabel;
      delete relation.toLabel;
    }
    document.relations[0].fromPlaceholder = "cedar";
    document.relations[0].toPlaceholder = "01";
    document.relations[1].fromPlaceholder = "cedar";
    document.relations[1].toPlaceholder = "02";

    const data = ledgerYamlToPortalData(stringify(document));
    expect(data.relationNames[0]).toEqual(
      expect.objectContaining({ name: "VM", color: "#d48a2f" }),
    );
    expect(data.relations[0]).toEqual(
      expect.objectContaining({
        fromLabel: "ホストcedar",
        toLabel: "VM01",
      }),
    );
    expect(data.relations[1]).toEqual(
      expect.objectContaining({
        toLabel: "VM02",
      }),
    );
    expect(data.relations[2]).toEqual(
      expect.objectContaining({
        fromLabel: "ホスト-",
        toLabel: "VM-",
      }),
    );
  });

  it("loads properties and treats missing properties as an empty map", () => {
    const document = parse(sampleYaml) as {
      devices: Array<Record<string, unknown>>;
      services: Array<Record<string, unknown>>;
    };
    const device = document.devices.find(
      (item) => item.hostname === "l3-switch",
    )!;
    const service = document.services.find(
      (item) => item.subdomain === "home",
    )!;
    device.properties = {
      vault_path: "sops/devices/l3-switch",
      note: "設定メモ",
    };
    service.properties = {
      ciphertext: "ENC[AES256_GCM,data:home]",
    };

    const data = ledgerYamlToPortalData(stringify(document));
    expect(
      data.devices.find((item) => item.name === "l3-switch")?.properties,
    ).toEqual({
      vault_path: "sops/devices/l3-switch",
      note: "設定メモ",
    });
    expect(
      data.services.find((item) => item.subdomain === "home")?.properties,
    ).toEqual({
      ciphertext: "ENC[AES256_GCM,data:home]",
    });
    expect(
      data.devices
        .filter((item) => item.name !== "l3-switch")
        .every((item) => Object.keys(item.properties ?? {}).length === 0),
    ).toBe(true);
  });

  it("rejects invalid properties in the static YAML data source", () => {
    const document = parse(sampleYaml) as {
      devices: Array<Record<string, unknown>>;
    };
    document.devices[0].properties = {
      numeric_value: 42,
    };

    expect(() => ledgerYamlToPortalData(stringify(document))).toThrow(
      YAMLDataSourceError,
    );
    try {
      ledgerYamlToPortalData(stringify(document));
    } catch (error) {
      expect((error as YAMLDataSourceError).issues).toContainEqual(
        expect.objectContaining({
          path: "devices[0].properties.numeric_value",
          message: "プロパティ値は文字列で入力してください",
        }),
      );
    }
  });

  it("rejects duplicate relation triples and unknown relation names in YAML", () => {
    const parsed = parse(sampleYaml) as {
      relations: Array<Record<string, unknown>>;
    };
    parsed.relations.push({
      ...parsed.relations[0],
    });

    expect(() => ledgerYamlToPortalData(stringify(parsed))).toThrowError(
      YAMLDataSourceError,
    );
    try {
      ledgerYamlToPortalData(stringify(parsed));
    } catch (error) {
      expect(error).toBeInstanceOf(YAMLDataSourceError);
      expect((error as YAMLDataSourceError).issues).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("重複"),
        }),
      );
    }
  });

  it("allows distinct label pairs and rejects an exact duplicate", () => {
    const document = parse(sampleYaml) as {
      relations: Array<Record<string, unknown>>;
    };
    const base = {
      from: document.relations[0].from,
      to: document.relations[0].to,
      relationName: document.relations[0].relationName,
      fromLabel: "別ホスト",
      toLabel: "8",
    };
    document.relations.push(base);
    expect(() =>
      ledgerYamlToPortalData(stringify(document)),
    ).not.toThrow();

    document.relations.push({ ...base });
    expect(() =>
      ledgerYamlToPortalData(stringify(document)),
    ).toThrow(YAMLDataSourceError);
  });

  it("converts legacy tagged relations in one YAML migration step", () => {
    const parsed = downgradeToV3(parse(sampleYaml)) as Record<
      string,
      unknown
    > & {
      relationNames?: unknown;
      relations: Array<Record<string, unknown>>;
    };
    delete parsed.relationNames;
    parsed.format = "ouchi-ledger/1";
    parsed.relations = [
      {
        from: "cedar-host",
        to: "harbor-core",
        tag: "旧VM",
        fromLabel: "旧ホスト",
        toLabel: "旧VM",
        color: "#112233",
      },
      {
        from: "cedar-host",
        to: "atlas-lab",
        tag: "旧VM",
        fromLabel: "無視されるラベル",
        toLabel: "無視されるVM",
        color: "#445566",
      },
    ];

    const data = ledgerYamlToPortalData(stringify(parsed));
    expect(data.relationNames).toEqual([
      expect.objectContaining({
        name: "旧VM",
        color: "#112233",
        relationCount: 2,
      }),
    ]);
    expect(data.relations[0]).toEqual(
      expect.objectContaining({ fromLabel: "旧ホスト", toLabel: "旧VM" }),
    );
    expect(data.relations[1]).toEqual(
      expect.objectContaining({
        fromLabel: "無視されるラベル",
        toLabel: "無視されるVM",
      }),
    );
    expect(data.relations.every((relation) => relation.relationName === "旧VM"))
      .toBe(true);
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
      const iface = data.interfaces.find(
        (candidate) =>
          candidate.deviceId === device?.id &&
          candidate.networkId === personalNetwork?.id,
      );
      expect(iface?.ip).toBe(ip);
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
        interfaceId: expect.any(String),
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
      data.interfaces.find((iface) => iface.id === external?.interfaceId)?.ip,
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
    const pagesInterface = data.interfaces.find(
      (iface) => iface.deviceId === pagesDevice?.id,
    );

    expect(pagesService).toEqual(
      expect.objectContaining({
        interfaceId: pagesInterface?.id,
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
    expect(pagesInterface).toEqual(
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
      "    device: harbor-core\n    interface: eth0\n    petname: 工房Git",
      "    device: missing-host\n    interface: eth0\n    petname: 工房Git",
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
            message: "missing-host のインターフェース eth0 が存在しません",
          }),
        ]),
      );
    }
  });

  it("converts legacy accent tone names when upgrading from /6", () => {
    const data = ledgerYamlToPortalData(
      sampleYaml
        .replace("format: ouchi-ledger/7", "format: ouchi-ledger/6")
        .replace('accent: "#5b9bd6"', "accent: blue"),
    );
    expect(
      data.networks.find((network) => network.name === "家族用LAN")?.accent,
    ).toBe("#5b9bd6");
  });

  it("rejects unknown ledger format versions", () => {
    expect(() =>
      ledgerYamlToPortalData(
        sampleYaml.replace(
          "format: ouchi-ledger/7",
          "format: ouchi-ledger/9",
        ),
      ),
    ).toThrow(/formatは「ouchi-ledger\/7」/);
  });
});
