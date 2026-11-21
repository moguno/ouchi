import { describe, expect, it } from "vitest";
import type { PortalDataV2 } from "../src/portal/types";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";
import {
  isCidr,
  isHttpUrl,
  isIpv4,
  isIpWithinCidr,
  validateDeviceInput,
  validateDevicePayload,
  validateDeviceNetworkInput,
  validateMembershipPayload,
  validateNetworkInput,
  validatePortalData,
  validateRelationInput,
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
  relations: [
    {
      id: "20",
      fromDeviceId: "3",
      toDeviceId: "2",
      tag: "バックアップ先",
      color: "blue",
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

  it("treats relation colors and tags as free strings", () => {
    expect(
      validateRelationPayload({
        fromDeviceId: 3,
        toDeviceId: 2,
        tag: "夜間バックアップ",
        color: "blue",
      }),
    ).toEqual([]);
    expect(
      validateRelationPayload({
        fromDeviceId: 3,
        toDeviceId: 2,
        tag: "tag",
        color: "",
      }),
    ).toContainEqual({ path: "color", message: "関係色は必須です" });
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
      message: "ペットネームが不正です",
    });
  });

  it("validates free-tag relations using the label fallback", () => {
    expect(
      validateRelationInput(
        {
          fromDeviceId: "3",
          toDeviceId: "2",
          tag: "バックアップ",
          color: "blue",
        },
        data,
      ),
    ).toEqual([]);
  });

  it("requires one colour for every tag across relations", () => {
    const invalid = structuredClone(data);
    invalid.relations.push({
      id: "21",
      fromDeviceId: "4",
      toDeviceId: "2",
      tag: " バックアップ先 ",
      color: "green",
    });

    expect(validatePortalData(invalid).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "relations.21.color",
          message: expect.stringContaining("統一してください"),
        }),
      ]),
    );
    expect(
      validateRelationInput(
        {
          fromDeviceId: "3",
          toDeviceId: "2",
          tag: "バックアップ先",
          color: "green",
        },
        data,
      ),
    ).toContainEqual({
      path: "color",
      message: "タグ「バックアップ先」の色は「blue」に固定されています",
    });
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
