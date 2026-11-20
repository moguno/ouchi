import { describe, expect, it } from "vitest";
import type { PortalDataV1 } from "../src/portal/types";
import {
  isCidr,
  isHttpUrl,
  isIpv4,
  isIpWithinCidr,
  validateDeviceInput,
  validateNetworkInput,
  validatePortalData,
  validateServiceInput,
} from "../src/portal/validation";

const data: PortalDataV1 = {
  version: 1,
  networks: [
    { id: "internet", name: "インターネット", accent: "violet" },
    {
      id: "home",
      name: "おうちLAN",
      cidr: "192.168.0.0/24",
      accent: "blue",
    },
  ],
  devices: [
    {
      id: "nanopi",
      networkId: "home",
      name: "nanopi",
      ip: "192.168.0.19",
      isVm: false,
    },
    {
      id: "omv-vm",
      networkId: "home",
      name: "omv",
      ip: "192.168.0.21",
      isVm: true,
    },
  ],
  services: [
    {
      id: "gitea",
      deviceId: "nanopi",
      name: "gitea",
      subtitle: "おうちGit",
      url: "http://192.168.0.19:3000",
      iconKey: "gitea",
      status: "up",
    },
  ],
};

describe("network validation", () => {
  it("validates IPv4 and CIDR values", () => {
    expect(isIpv4("192.168.0.19")).toBe(true);
    expect(isIpv4("192.168.0.999")).toBe(false);
    expect(isCidr("192.168.0.0/24")).toBe(true);
    expect(isCidr("192.168.0.0/33")).toBe(false);
    expect(isIpWithinCidr("192.168.0.19", "192.168.0.0/24")).toBe(true);
    expect(isIpWithinCidr("192.168.1.19", "192.168.0.0/24")).toBe(false);
  });

  it("accepts a CIDR-less Internet network", () => {
    const result = validatePortalData(data);
    expect(result.value).toEqual(data);
    expect(result.issues).toEqual([]);
  });

  it("rejects a device outside its CIDR", () => {
    const invalid: PortalDataV1 = {
      ...data,
      devices: [
        {
          ...data.devices[0],
          ip: "192.168.1.19",
        },
      ],
    };
    const result = validatePortalData(invalid);
    expect(result.issues).toContainEqual({
      path: "devices.nanopi.ip",
      message: "IP 192.168.1.19 は 192.168.0.0/24 の範囲外です",
    });
  });

  it("rejects duplicate and missing references", () => {
    const invalid = {
      ...data,
      networks: [data.networks[0], data.networks[0]],
      devices: [{ ...data.devices[0], networkId: "missing" }],
      services: [{ ...data.services[0], deviceId: "missing-device" }],
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
  it("allows an Internet network without CIDR", () => {
    expect(
      validateNetworkInput(
        { name: "インターネット", cidr: undefined, accent: "violet" },
        data,
      ),
    ).toEqual([]);
  });

  it("allows a device in a network without CIDR", () => {
    expect(
      validateDeviceInput(
        {
          name: "public",
          ip: "203.0.113.10",
          networkId: "internet",
          isVm: false,
        },
        data,
      ),
    ).toEqual([]);
  });

  it("rejects duplicate device IP addresses", () => {
    expect(
      validateDeviceInput(
        {
          name: "duplicate",
          ip: "192.168.0.19",
          networkId: "home",
          isVm: false,
        },
        data,
      ),
    ).toContainEqual({
      path: "ip",
      message: "同じIPが登録されています",
    });
  });

  it("validates a VM using its network and IP", () => {
    expect(
      validateDeviceInput(
        {
          name: "web",
          ip: "192.168.0.30",
          networkId: "home",
          isVm: true,
        },
        data,
      ),
    ).toEqual([]);
    expect(
      validateDeviceInput(
        {
          name: "outside",
          ip: "192.168.1.30",
          networkId: "home",
          isVm: true,
        },
        data,
      ),
    ).toContainEqual({
      path: "ip",
      message: "IPは 192.168.0.0/24 の範囲内で入力してください",
    });
  });

  it("allows a VM to join a different network independently", () => {
    const dataWithOci: PortalDataV1 = {
      ...data,
      networks: [
        ...data.networks,
        {
          id: "oci",
          name: "OCI",
          cidr: "192.168.253.0/24",
          accent: "orange",
        },
      ],
    };

    expect(
      validateDeviceInput(
        {
          name: "nat-vm",
          ip: "192.168.253.20",
          networkId: "oci",
          isVm: true,
        },
        dataWithOci,
      ),
    ).toEqual([]);
  });

  it("accepts a service placed on a VM", () => {
    expect(
      validateServiceInput(
        {
          name: "omv-web",
          url: "http://192.168.0.21",
          deviceId: "omv-vm",
          iconKey: "omv",
          status: "up",
        },
        data,
      ),
    ).toEqual([]);
  });

  it("accepts only HTTP and HTTPS service URLs", () => {
    const base = {
      name: "service",
      deviceId: "nanopi",
      iconKey: "monitor" as const,
      status: "up" as const,
    };

    expect(
      validateServiceInput({ ...base, url: "https://example.com" }, data),
    ).toEqual([]);
    expect(
      validateServiceInput({ ...base, url: "javascript:alert(1)" }, data),
    ).toContainEqual({
      path: "url",
      message: "HTTPまたはHTTPSのURLを入力してください",
    });
    expect(isHttpUrl("ftp://example.com")).toBe(false);
  });
});
