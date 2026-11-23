import { describe, expect, it } from "vitest";
import type { PortalDataV2 } from "../src/portal/types";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";
import {
  isCidr,
  isHttpUrl,
  isIpv4,
  isIpWithinCidr,
  normalizeProperties,
  validatePropertiesPayload,
  validateDeviceInput,
  validateDevicePayload,
  validateDeviceNetworkInput,
  validateMembershipPayload,
  validateNetworkInput,
  validatePortalData,
  validateRelationInput,
  validateRelationNameInput,
  validateRelationNamePayload,
  validateRelationPayload,
  validateServiceInput,
  validateServicePayload,
  validateSettingsPayload,
  validateSettingsTitle,
} from "../src/portal/validation";

const data: PortalDataV2 = {
  version: 2,
  networks: [
    {
      id: "1",
      name: "インターネット",
      accent: "violet",
    },
    {
      id: "2",
      name: "おうちLAN",
      cidr: "192.168.0.0/24",
      accent: "blue",
    },
    {
      id: "3",
      name: "OCI",
      cidr: "192.168.253.0/24",
      accent: "orange",
    },
  ],
  devices: [
    {
      id: "1",
      name: "fortigate",
      category: "network",
      isVm: false,
      meterEnabled: false,
    },
    {
      id: "2",
      name: "nanopi-r2s",
      category: "physical",
      isVm: false,
      meterEnabled: true,
      ssh: { user: "monitor", port: 22 },
    },
    {
      id: "3",
      name: "omv",
      category: "vm",
      isVm: true,
      meterEnabled: true,
    },
    {
      id: "4",
      name: "notion",
      category: "service",
      isVm: false,
      meterEnabled: false,
    },
  ],
  deviceNetworks: [
    {
      id: "10",
      deviceId: "1",
      networkId: "1",
      ip: "",
      label: "WAN",
    },
    {
      id: "11",
      deviceId: "1",
      networkId: "2",
      ip: "192.168.0.1",
      label: "LAN",
    },
    {
      id: "12",
      deviceId: "2",
      networkId: "2",
      ip: "192.168.0.19",
    },
    {
      id: "13",
      deviceId: "3",
      networkId: "2",
      ip: "192.168.0.21",
    },
    {
      id: "14",
      deviceId: "4",
      networkId: "1",
      ip: "",
    },
  ],
  relationNames: [
    {
      id: "relation-name-1",
      name: "バックアップ先",
      color: "#3b82f6",
      relationCount: 1,
    },
  ],
  relations: [
    {
      id: "20",
      relationNameId: "relation-name-1",
      relationName: "バックアップ先",
      fromDeviceId: "3",
      toDeviceId: "2",
      fromLabel: "バックアップ先",
      toLabel: "バックアップ先",
      color: "#3b82f6",
    },
  ],
  services: [
    {
      id: "30",
      deviceNetworkId: "12",
      subdomain: "gitea",
      petname: "おうちGit",
      description: "Gitサーバ",
      scheme: "http",
      port: 3000,
      protocol: "tcp",
      topPath: "",
      monitorPath: "/api/v1/version",
      iconKey: "generic:gitea",
      enabled: true,
    },
    {
      id: "31",
      deviceNetworkId: "14",
      subdomain: "notion",
      petname: "Notion",
      scheme: "https",
      port: 443,
      protocol: "tcp",
      topPath: "",
      monitorPath: "/",
      serviceUrl: "https://www.notion.so/",
      iconKey: "generic:globe",
      enabled: true,
    },
  ],
};

describe("v0.4 data and address validation", () => {
  it("accepts nullable membership IPs, free tags, and category service", () => {
    expect(validatePortalData(data)).toEqual({ value: data, issues: [] });
  });

  it("validates IPv4 and CIDR values per membership", () => {
    expect(isIpv4("192.168.0.19")).toBe(true);
    expect(isIpv4("192.168.0.999")).toBe(false);
    expect(isCidr("192.168.0.0/24")).toBe(true);
    expect(isCidr("192.168.0.0/33")).toBe(false);
    expect(isIpWithinCidr("192.168.0.19", "192.168.0.0/24")).toBe(true);
    expect(isIpWithinCidr("192.168.1.19", "192.168.0.0/24")).toBe(false);
  });

  it("allows an empty IP but rejects one outside the network CIDR", () => {
    expect(
      validateDeviceNetworkInput({ networkId: "1", ip: "" }, data),
    ).toEqual([]);
    expect(
      validateDeviceNetworkInput(
        { networkId: "2", ip: "192.168.1.20" },
        data,
      ),
    ).toContainEqual({
      path: "ip",
      message: "IPは 192.168.0.0/24 の範囲内で入力してください",
    });
  });

  it("rejects duplicate non-null IP addresses", () => {
    const invalid = structuredClone(data);
    invalid.deviceNetworks[2].ip = "192.168.0.21";
    const result = validatePortalData(invalid);
    expect(
      result.issues.some((issue) => issue.message.includes("重複")),
    ).toBe(true);
  });
});

describe("shared REST validation", () => {
  it("validates portal titles as non-empty single-line text up to 100 characters", () => {
    expect(validateSettingsTitle("我が家のポータル")).toEqual([]);
    expect(validateSettingsTitle("a".repeat(100))).toEqual([]);
    expect(validateSettingsTitle("   ")).toContainEqual({
      path: "title",
      message: "ポータルタイトルを入力してください",
    });
    expect(validateSettingsTitle("1行目\n2行目")).toContainEqual({
      path: "title",
      message: "ポータルタイトルに改行は使用できません",
    });
    expect(validateSettingsPayload({ title: "a".repeat(101) })).toContainEqual({
      path: "title",
      message: "ポータルタイトルは100文字以内で入力してください",
    });
  });

  it("accepts nullable API membership IPs", () => {
    expect(
      validateMembershipPayload({
        deviceId: 4,
        networkId: 1,
        ip: null,
      }),
    ).toEqual([]);
  });

  it("validates relation edges and relation-name definitions separately", () => {
    expect(
      validateRelationPayload({
        relationName: "夜間バックアップ",
        fromDeviceId: 3,
        toDeviceId: 2,
      }),
    ).toEqual([]);
    expect(
      validateRelationPayload({
        relationName: "",
        fromDeviceId: 3,
        toDeviceId: 2,
      }),
    ).toContainEqual({ path: "relationName", message: "関係名は必須です" });
    expect(
      validateRelationNamePayload({
        name: "ホストOS",
        color: "#d5a22b",
        fromLabel: "親ホスト",
        toLabel: "VM",
      }),
    ).toEqual([]);
    expect(
      validateRelationNamePayload({
        name: "ホストOS",
        color: "",
      }),
    ).toContainEqual({
      path: "color",
      message: "関係色は必須です",
    });
  });

  it("does not accept service status as an input field", () => {
    const serviceInput = {
      deviceNetworkId: 12,
      subdomain: "health",
      port: 8080,
      protocol: "tcp",
      scheme: "http",
      topPath: "",
      monitorPath: "/health",
      enabled: true,
    };
    expect(validateServicePayload(serviceInput)).toEqual([]);
    expect(
      validateServicePayload({ ...serviceInput, serviceUrl: "ftp://bad" }),
    ).toContainEqual({
      path: "serviceUrl",
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
  });

  it("keeps device category and VM flag consistent", () => {
    expect(
      validateDeviceInput(
        {
          name: "bad",
          category: "service",
          isVm: false,
          meterEnabled: true,
        },
        undefined,
        data,
      ),
    ).toContainEqual({
      path: "meterEnabled",
      message: "サービスカテゴリーではSSHメーターを有効にできません",
    });
  });

  it("accepts optional device petnames and rejects non-string values", () => {
    const device = {
      hostname: "petname-test",
      category: "physical",
      isVm: false,
      meterEnabled: false,
    };
    expect(
      validateDevicePayload({ ...device, petname: "  門番  " }),
    ).toEqual([]);
    expect(validateDevicePayload({ ...device, petname: null })).toEqual([]);
    expect(
      validateDevicePayload({ ...device, petname: 18 }),
    ).toContainEqual({
      path: "petname",
      message: "名前が不正です",
    });
  });

  it("validates and normalizes shared entity properties", () => {
    expect(
      validatePropertiesPayload({
        " vault_path ": "sops/devices/omv",
        note: "HDD SMART怪しい",
      }),
    ).toEqual([]);
    expect(
      normalizeProperties({
        " vault_path ": "sops/devices/omv",
        note: "HDD SMART怪しい",
      }),
    ).toEqual({
      vault_path: "sops/devices/omv",
      note: "HDD SMART怪しい",
    });

    expect(validatePropertiesPayload({ "   ": "value" })).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("空白除去後に必須"),
      }),
    );
    expect(
      validatePropertiesPayload({ ["k".repeat(129)]: "value" }),
    ).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("128文字以内"),
      }),
    );
    expect(
      validatePropertiesPayload({ value: "x".repeat(64 * 1024 + 1) }),
    ).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("64KiB以内"),
      }),
    );
    expect(
      validatePropertiesPayload({ value: "x".repeat(64 * 1024) }),
    ).toEqual([]);
    expect(
      validatePropertiesPayload({ value: "あ".repeat(21_846) }),
    ).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("64KiB以内"),
      }),
    );
    expect(validatePropertiesPayload({ value: 42 })).toContainEqual(
      expect.objectContaining({
        message: "プロパティ値は文字列で入力してください",
      }),
    );
    expect(
      validatePropertiesPayload({ " same ": "one", same: "two" }),
    ).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("が重複しています"),
      }),
    );
  });

  it("validates relation-name selection and duplicate triples", () => {
    expect(
      validateRelationInput(
        {
          relationName: "バックアップ先",
          fromDeviceId: "3",
          toDeviceId: "2",
        },
        data,
        "20",
      ),
    ).toEqual([]);
    expect(
      validateRelationInput(
        {
          relationName: "バックアップ先",
          fromDeviceId: "3",
          toDeviceId: "2",
          fromPlaceholder: "host",
          toPlaceholder: "8",
        },
        data,
        "99",
      ),
    ).toEqual([]);
    expect(
      validateRelationInput(
        {
          relationName: "バックアップ先",
          fromDeviceId: "3",
          toDeviceId: "2",
        },
        data,
        "99",
      ),
    ).toContainEqual({
      path: "relationName",
      message:
        "同じ関係名・始点・終点・プレースホルダーの関係はすでに登録されています",
    });
  });

  it("allows multiple relation names for one pair but rejects duplicate triples", () => {
    const invalid = structuredClone(data);
    invalid.relationNames.push({
      id: "relation-name-2",
      name: "監視",
      color: "#22c55e",
      fromLabel: "監視元",
      toLabel: "監視先",
      relationCount: 1,
    });
    invalid.relations.push({
      id: "21",
      relationNameId: "relation-name-2",
      relationName: "監視",
      fromDeviceId: "4",
      toDeviceId: "2",
      fromLabel: "監視元",
      toLabel: "監視先",
      color: "#22c55e",
    });
    expect(validatePortalData(invalid).issues).toEqual([]);

    invalid.relations.push({
      id: "22",
      relationNameId: "relation-name-1",
      relationName: "バックアップ先",
      fromDeviceId: "3",
      toDeviceId: "2",
      fromLabel: "バックアップ先",
      toLabel: "バックアップ先",
      color: "#3b82f6",
    });
    expect(validatePortalData(invalid).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "relations.22",
          message: expect.stringContaining("重複"),
        }),
      ]),
    );
    expect(
      validateRelationNameInput(
        {
          name: "バックアップ先",
          color: "#3b82f6",
        },
        data,
      ),
    ).toContainEqual({
      path: "name",
      message: "同じ関係名が登録されています",
    });
  });

  it("allows placeholder variants and rejects only an exact five-part duplicate", () => {
    const templated = structuredClone(data);
    templated.relations[0].fromPlaceholder = "8";
    templated.relations[0].toPlaceholder = "443";
    templated.relations.push({
      ...structuredClone(templated.relations[0]),
      id: "21",
      fromPlaceholder: "9",
      toPlaceholder: "443",
    });
    expect(validatePortalData(templated).issues).toEqual([]);

    templated.relations.push({
      ...structuredClone(templated.relations[1]),
      id: "22",
    });
    expect(validatePortalData(templated).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "relations.22",
          message: expect.stringContaining("プレースホルダー"),
        }),
      ]),
    );
  });

  it("validates the v0.4 service form", () => {
    for (const iconKey of [
      "generic:monitor",
      "favicon",
      "url:https://icons.example/service.svg",
    ] as const) {
      expect(
        validateServiceInput(
          {
          subdomain: "health",
          deviceNetworkId: "12",
          scheme: "http",
          port: 8080,
          protocol: "tcp",
          topPath: "/",
          monitorPath: "/health",
          iconKey,
          enabled: true,
          },
          data,
        ),
      ).toEqual([]);
    }
    expect(
      validateServiceInput(
        {
          subdomain: "health",
          deviceNetworkId: "12",
          scheme: "http",
          port: 8080,
          protocol: "tcp",
          topPath: "/",
          monitorPath: "/health",
          iconKey: "url:not-a-url" as never,
          enabled: true,
        },
        data,
      ),
    ).toContainEqual({ path: "iconKey", message: "アイコンを選択してください" });
  });

  it("accepts CIDR-less networks", () => {
    expect(
      validateNetworkInput(
        { name: "ゲスト", accent: "green" },
        data,
      ),
    ).toEqual([]);
  });
});

describe("URL assembly", () => {
  it("always includes the port and uses monitor_path fallback", () => {
    const service = data.services[0];
    const membership = data.deviceNetworks[2];
    expect(buildServiceUrl(service, membership)).toBe(
      "http://192.168.0.19:3000/",
    );
    expect(buildMonitorUrl(service, membership)).toBe(
      "http://192.168.0.19:3000/api/v1/version",
    );
  });

  it("returns null when an IP and explicit URL are both absent", () => {
    expect(
      buildServiceUrl(
        {
          scheme: "http",
          port: 80,
          topPath: "/",
        },
        { ip: "" },
      ),
    ).toBeNull();
  });

  it("uses an explicit URL for redirect and monitor URLs", () => {
    const service = data.services[1];
    expect(
      buildServiceUrl(service, data.deviceNetworks[4]),
    ).toBe("https://www.notion.so/");
    expect(
      buildMonitorUrl(service, data.deviceNetworks[4]),
    ).toBe("https://www.notion.so/");
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
