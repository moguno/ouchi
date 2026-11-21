import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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
      title: "Aoba Home Lab",
    });
    expect(data.networks).toHaveLength(3);
    expect(data.devices).toHaveLength(15);
    expect(data.deviceNetworks).toHaveLength(17);
    expect(data.relations).toHaveLength(3);
    expect(data.services).toHaveLength(16);
    expect(data.networks.map((network) => network.id)).toEqual([
      "network-1",
      "network-2",
      "network-3",
    ]);
    expect(data.devices.find((device) => device.name === "aura-gw")).toEqual(
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
    const gateway = data.devices.find(
      (device) => device.name === "aura-gw",
    );
    const homeLanMembership = data.deviceNetworks.find(
      (membership) =>
        membership.deviceId === gateway?.id &&
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
        fromLabel: "VMホスト",
        toLabel: "親ホスト",
      }),
    );
  });

  it("uses a full serviceUrl for the fictional external SaaS", () => {
    const data = ledgerYamlToPortalData(sampleYaml);
    const external = data.services.find(
      (service) => service.subdomain === "lumen-notes",
    );

    expect(external).toEqual(
      expect.objectContaining({
        url: "https://notes.example.com/",
        monitorUrl: "https://notes.example.com/",
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

  it("reports invalid natural-key references", () => {
    const invalid = sampleYaml.replace(
      "    device: harbor-core\n    network: サーバーセグメント\n    petname: 工房Git",
      "    device: missing-host\n    network: サーバーセグメント\n    petname: 工房Git",
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
            message: "missing-host の サーバーセグメント 所属が存在しません",
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
