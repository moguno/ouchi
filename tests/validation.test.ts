import { describe, expect, it } from "vitest";
import type { PortalDataV2 } from "../src/portal/types";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";
import {
  isCidr,
  isHttpUrl,
  isIpv4,
  isIpWithinCidr,
  validateDeviceInput,
  validateDeviceNetworkInput,
  validateNetworkInput,
  validatePortalData,
  validateRelationInput,
  validateServiceInput,
} from "../src/portal/validation";

const data: PortalDataV2 = {
  version: 2,
  networks: [
    { id: "internet", name: "インターネット", accent: "violet" },
    {
      id: "home",
      name: "おうちLAN",
      cidr: "192.168.0.0/24",
      accent: "blue",
    },
    {
      id: "oci",
      name: "OCI",
      cidr: "192.168.253.0/24",
      accent: "orange",
    },
  ],
  devices: [
    {
      id: "fortigate",
      name: "fortigate",
      isVm: false,
    },
    {
      id: "nanopi",
      name: "nanopi",
      isVm: false,
      ssh: { user: "admin", port: 22 },
      resources: { memoryPercent: 38, diskPercent: 57 },
    },
    {
      id: "omv-vm",
      name: "omv",
      isVm: true,
      resources: { memoryPercent: 52, diskPercent: 81 },
    },
  ],
  deviceNetworks: [
    {
      id: "fortigate-wan",
      deviceId: "fortigate",
      networkId: "internet",
      ip: "203.0.113.254",
      label: "WAN",
    },
    {
      id: "fortigate-lan",
      deviceId: "fortigate",
      networkId: "home",
      ip: "192.168.0.1",
      label: "LAN",
    },
    {
      id: "nanopi-home",
      deviceId: "nanopi",
      networkId: "home",
      ip: "192.168.0.19",
    },
    {
      id: "omv-home",
      deviceId: "omv-vm",
      networkId: "home",
      ip: "192.168.0.21",
    },
  ],
  relations: [
    {
      id: "omv-to-fortigate",
      fromDeviceId: "omv-vm",
      toDeviceId: "fortigate",
      fromLabel: "VM",
      toLabel: "親ホスト",
      color: "#d5a22b",
    },
  ],
  services: [
    {
      id: "gitea",
      deviceNetworkId: "nanopi-home",
      name: "gitea",
      subtitle: "おうちGit",
      scheme: "http",
      port: 3000,
      topPath: "/",
      monitorPath: "/explore/repos",
      iconKey: "gitea",
      status: "up",
    },
  ],
};

describe("network and address validation", () => {
  it("validates IPv4 and CIDR values", () => {
    expect(isIpv4("192.168.0.19")).toBe(true);
    expect(isIpv4("192.168.0.999")).toBe(false);
    expect(isCidr("192.168.0.0/24")).toBe(true);
    expect(isCidr("192.168.0.0/33")).toBe(false);
    expect(isIpWithinCidr("192.168.0.19", "192.168.0.0/24")).toBe(true);
    expect(isIpWithinCidr("192.168.1.19", "192.168.0.0/24")).toBe(false);
  });

  it("accepts the v2 model with multi-network devices and relations", () => {
    const result = validatePortalData(data);
    expect(result.value).toEqual(data);
    expect(result.issues).toEqual([]);
  });

  it("rejects an address outside its network CIDR", () => {
    const invalid: PortalDataV2 = {
      ...data,
      deviceNetworks: data.deviceNetworks.map((membership) =>
        membership.id === "nanopi-home"
          ? { ...membership, ip: "192.168.1.19" }
          : membership,
      ),
    };
    expect(validatePortalData(invalid).issues).toContainEqual({
      path: "deviceNetworks.nanopi-home.ip",
      message: "IP 192.168.1.19 は 192.168.0.0/24 の範囲外です",
    });
  });

  it("rejects duplicate and missing references", () => {
    const invalid = {
      ...data,
      networks: [data.networks[0], data.networks[0]],
      deviceNetworks: [
        { ...data.deviceNetworks[0], networkId: "missing" },
      ],
      relations: [
        { ...data.relations[0], toDeviceId: "missing-device" },
      ],
      services: [
        { ...data.services[0], deviceNetworkId: "missing-network" },
      ],
    };
    const result = validatePortalData(invalid);
    expect(result.issues.some((issue) => issue.message.includes("重複"))).toBe(
      true,
    );
    expect(
      result.issues.some((issue) => issue.message.includes("存在しません")),
    ).toBe(true);
  });
});

describe("form validation", () => {
  it("allows a CIDR-less Internet network", () => {
    expect(
      validateNetworkInput(
        { name: "インターネット", cidr: undefined, accent: "violet" },
        data,
      ),
    ).toEqual([]);
  });

  it("allows a device address in a network without CIDR", () => {
    expect(
      validateDeviceNetworkInput(
        {
          networkId: "internet",
          ip: "198.51.100.10",
        },
        data,
      ),
    ).toEqual([]);
  });

  it("rejects duplicate device IP addresses", () => {
    expect(
      validateDeviceNetworkInput(
        {
          networkId: "home",
          ip: "192.168.0.19",
        },
        data,
      ),
    ).toContainEqual({
      path: "ip",
      message: "同じIPが登録されています",
    });
  });

  it("validates device resources and SSH metadata", () => {
    expect(
      validateDeviceInput(
        {
          name: "web",
          isVm: true,
          ssh: { user: "monitor", port: 22 },
          resources: { memoryPercent: 40, diskPercent: 60 },
        },
        undefined,
        data,
      ),
    ).toEqual([]);
    expect(
      validateDeviceInput(
        {
          name: "broken",
          isVm: false,
          ssh: { user: "", port: 70_000 },
          resources: { memoryPercent: 120, diskPercent: -1 },
        },
        undefined,
        data,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("allows one device to use addresses in different networks", () => {
    expect(
      validateDeviceNetworkInput(
        {
          networkId: "oci",
          ip: "192.168.253.20",
        },
        data,
        "fortigate-wan",
      ),
    ).toEqual([]);
  });

  it("validates a free-tag relation", () => {
    expect(
      validateRelationInput(
        {
          fromDeviceId: "omv-vm",
          toDeviceId: "nanopi",
          fromLabel: "バックアップ元",
          toLabel: "バックアップ先",
          color: "#3988c7",
        },
        data,
      ),
    ).toEqual([]);
    expect(
      validateRelationInput(
        {
          fromDeviceId: "omv-vm",
          toDeviceId: "omv-vm",
          fromLabel: "",
          toLabel: "",
          color: "yellow",
        },
        data,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("accepts a service assigned to a specific device IP", () => {
    expect(
      validateServiceInput(
        {
          name: "omv-web",
          deviceNetworkId: "omv-home",
          scheme: "http",
          port: 80,
          topPath: "/",
          monitorPath: "/health",
          iconKey: "omv",
          status: "up",
        },
        data,
      ),
    ).toEqual([]);
  });

  it("generates redirect and Gatus monitor URLs from the selected IP", () => {
    const service = data.services[0];
    const membership = data.deviceNetworks[2];
    expect(buildServiceUrl(service, membership)).toBe(
      "http://192.168.0.19:3000/",
    );
    expect(buildMonitorUrl(service, membership)).toBe(
      "http://192.168.0.19:3000/explore/repos",
    );
  });

  it("accepts only HTTP and HTTPS explicit service URLs", () => {
    const base = {
      name: "service",
      deviceNetworkId: "nanopi-home",
      scheme: "http" as const,
      port: 80,
      topPath: "/",
      monitorPath: "/",
      iconKey: "monitor" as const,
      status: "up" as const,
    };

    expect(
      validateServiceInput(
        { ...base, serviceUrl: "https://example.com" },
        data,
      ),
    ).toEqual([]);
    expect(
      validateServiceInput(
        { ...base, serviceUrl: "javascript:alert(1)" },
        data,
      ),
    ).toContainEqual({
      path: "serviceUrl",
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
    expect(isHttpUrl("ftp://example.com")).toBe(false);
  });
});
