import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OuchiPortal } from "../src/portal";
import type {
  PortalApiData,
  PortalDataV2,
  PortalService,
} from "../src/portal/types";
import { EntityDialog } from "../src/portal/EntityDialog";
import { ledgerYamlToPortalData } from "../src/portal/yamlDataSource";

const sampleYaml = readFileSync(
  resolve(process.cwd(), "public/ouchi-ledger.sample.yaml"),
  "utf8",
);

const service = (
  overrides: Partial<PortalService> = {},
): PortalService => ({
  id: "1",
  deviceNetworkId: "11",
  subdomain: "gitea",
  petname: "おうちGit",
  description: "Gitサーバ",
  scheme: "http",
  port: 3000,
  protocol: "tcp",
  topPath: "/",
  monitorPath: "/api/v1/version",
  iconKey: "gitea",
  enabled: true,
  url: "http://192.168.0.19:3000/",
  monitorUrl: "http://192.168.0.19:3000/api/v1/version",
  ...overrides,
});

const portalData: PortalDataV2 = {
  version: 2,
  networks: [
    { id: "1", name: "インターネット", accent: "violet" },
    {
      id: "2",
      name: "おうちLAN",
      cidr: "192.168.0.0/24",
      accent: "blue",
    },
    {
      id: "3",
      name: "OCIネットワーク",
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
      name: "openmediavault",
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
      networkId: "2",
      ip: "192.168.0.1",
      label: "管理",
    },
    {
      id: "11",
      deviceId: "2",
      networkId: "2",
      ip: "192.168.0.19",
    },
    {
      id: "12",
      deviceId: "3",
      networkId: "2",
      ip: "192.168.0.21",
    },
    {
      id: "13",
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
    service(),
    service({
      id: "2",
      deviceNetworkId: "13",
      subdomain: "notion",
      petname: "Notion",
      description: "外部SaaS",
      scheme: "https",
      port: 443,
      serviceUrl: "https://www.notion.so/",
      iconKey: "globe",
      url: "https://www.notion.so/",
      monitorUrl: "https://www.notion.so/",
    }),
  ],
  settings: {
    domain: "ouchi.local",
    title: "あなたのホームラボ",
  },
};

const apiData: PortalApiData = {
  version: 2,
  networks: portalData.networks.map((network, index) => ({
    id: index + 1,
    name: network.name,
    cidr: network.cidr ?? null,
    accent: network.accent,
    note: null,
  })),
  devices: portalData.devices.map((device, index) => ({
    id: index + 1,
    hostname: device.name,
    category: device.category,
    isVm: device.isVm,
    sshUser: device.ssh?.user ?? null,
    sshPort: device.ssh?.port ?? null,
    meterEnabled: device.meterEnabled ?? false,
    note: null,
    memberships: portalData.deviceNetworks
      .filter((membership) => membership.deviceId === device.id)
      .map((membership) => ({
        id: Number(membership.id),
        deviceId: index + 1,
        networkId:
          Number(
            portalData.networks.find(
              (network) => network.id === membership.networkId,
            )?.id ?? 1,
          ),
        ip: membership.ip || null,
        label: membership.label ?? null,
      })),
  })),
  services: portalData.services.map((item, index) => ({
    id: index + 1,
    deviceNetworkId: Number(item.deviceNetworkId),
    subdomain: item.subdomain,
    petname: item.petname ?? null,
    description: item.description ?? null,
    port: item.port,
    protocol: item.protocol,
    scheme: item.scheme,
    topPath: item.topPath,
    monitorPath: item.monitorPath,
    serviceUrl: item.serviceUrl ?? null,
    iconKey: item.iconKey,
    enabled: item.enabled,
    url: item.url ?? null,
    monitorUrl: item.monitorUrl ?? null,
  })),
  relations: portalData.relations.map((relation, index) => ({
    id: index + 1,
    fromDeviceId: Number(relation.fromDeviceId),
    toDeviceId: Number(relation.toDeviceId),
    tag: relation.tag ?? null,
    fromLabel: relation.fromLabel ?? null,
    toLabel: relation.toLabel ?? null,
    color: relation.color,
  })),
  settings: {
    domain: "ouchi.local",
    title: "あなたのホームラボ",
  },
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("OuchiPortal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the initial snapshot from the REST API", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => jsonResponse(apiData));
    vi.stubGlobal("fetch", fetchMock);

    render(<OuchiPortal />);

    expect(screen.getByText(/台帳を読み込んでいます/)).toBeInTheDocument();
    expect(await screen.findByText("nanopi-r2s")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portal",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("loads a relative YAML source as a read-only portal", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(sampleYaml, {
          headers: { "Content-Type": "application/yaml" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <OuchiPortal
        showTitle={false}
        yamlUrl="ouchi-ledger.sample.yaml"
      />,
    );

    expect(
      await screen.findByText("ホームダッシュボード", { exact: true }),
    ).toBeVisible();
    expect(screen.getByText("表示専用デモ")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "管理" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "ポータルを管理" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "ouchi-ledger.sample.yaml",
      expect.objectContaining({
        headers: { Accept: "application/yaml" },
      }),
    );
  });

  it("renders API data and category headings only when non-empty", () => {
    const { container } = render(<OuchiPortal data={portalData} />);
    const networks = container.querySelectorAll(".ouchi-network-card");

    expect(networks[networks.length - 1]).toHaveAttribute(
      "aria-labelledby",
      "network-1",
    );
    const homeLan = screen.getByRole("article", { name: "おうちLAN" });
    expect(
      within(homeLan).getByRole("heading", { name: "ネットワーク機器" }),
    ).toBeInTheDocument();
    expect(
      within(homeLan).getByRole("heading", { name: "物理マシン" }),
    ).toBeInTheDocument();
    expect(
      within(homeLan).getByRole("heading", { name: "VM" }),
    ).toBeInTheDocument();
    expect(
      within(homeLan).queryByRole("heading", { name: "サービス" }),
    ).not.toBeInTheDocument();
  });

  it("does not render service status UI even when a provider returns state", () => {
    const providerData: PortalDataV2 = {
      ...portalData,
      services: portalData.services.map((item, index) => ({
        ...item,
        status: index === 0 ? "up" : "down",
      })),
    };
    const { container } = render(<OuchiPortal data={providerData} />);

    expect(
      container.querySelector(".ouchi-service-status"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".ouchi-status-legend"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".ouchi-status-dot"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("稼働中")).not.toBeInTheDocument();
    expect(screen.queryByText("停止")).not.toBeInTheDocument();
  });

  it("does not render meter UI even when device resources are present", () => {
    const meterData: PortalDataV2 = {
      ...portalData,
      devices: portalData.devices.map((device) =>
        device.id === "2"
          ? {
              ...device,
              resources: {
                memoryPercent: 42,
                diskPercent: 68,
              },
            }
          : device,
      ),
    };
    const { container } = render(<OuchiPortal data={meterData} />);
    const nanopi = container.querySelector('[data-device-id="2"]');

    expect(nanopi).not.toBeNull();
    expect(
      (nanopi as HTMLElement).querySelector(".ouchi-resource-meters"),
    ).not.toBeInTheDocument();
    expect(
      (nanopi as HTMLElement).querySelector(".ouchi-resource-meter"),
    ).not.toBeInTheDocument();
    expect(within(nanopi as HTMLElement).queryByText("未取得")).not.toBeInTheDocument();
    expect(within(nanopi as HTMLElement).queryByText("42%")).not.toBeInTheDocument();
  });

  it("switches between icon and list views", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "リスト表示" }));
    expect(container.querySelector(".ouchi-list-stack")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "リスト表示" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("resolves relation labels from tag and keeps unrelated devices neutral", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal data={portalData} />);

    await user.click(
      screen.getByRole("button", { name: "openmediavaultを選択" }),
    );
    expect(screen.getByText("バックアップ先")).toBeInTheDocument();
    expect(
      container.querySelector('[data-device-id="2"]'),
    ).toHaveClass("ouchi-device-card--related");
    expect(
      container.querySelector('[data-device-id="1"]'),
    ).toHaveClass("ouchi-device-card--neutral");
  });

  it("draws adjacent pairs between duplicate device displays", async () => {
    const user = userEvent.setup();
    const duplicateData: PortalDataV2 = {
      ...portalData,
      deviceNetworks: [
        ...portalData.deviceNetworks,
        {
          id: "14",
          deviceId: "1",
          networkId: "3",
          ip: "192.168.253.1",
          label: "OCI",
        },
        {
          id: "15",
          deviceId: "1",
          networkId: "1",
          ip: "10.0.0.1",
          label: "WAN",
        },
      ],
      relations: [],
      services: [],
    };
    const rect = (
      left: number,
      top: number,
      width: number,
      height: number,
    ): DOMRect =>
      ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this instanceof HTMLElement) {
          if (this.classList.contains("ouchi-canvas")) {
            return rect(0, 0, 1200, 1000);
          }
          const membershipId = this
            .getAttribute("aria-labelledby")
            ?.replace("device-", "");
          if (this.dataset.deviceId && membershipId) {
            const top =
              membershipId === "14"
                ? 40
                : membershipId === "10"
                  ? 220
                  : membershipId === "15"
                    ? 420
                    : 700;
            return rect(20, top, 240, 160);
          }
        }
        return rect(0, 0, 0, 0);
      },
    );
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
      function (this: Element) {
        return [this.getBoundingClientRect()] as unknown as DOMRectList;
      },
    );

    const { container } = render(<OuchiPortal data={duplicateData} />);
    await user.click(
      screen.getAllByRole("button", { name: "fortigateを選択" })[0],
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll(".ouchi-relation-connector--same-device"),
      ).toHaveLength(2);
    });
    const circles = container.querySelectorAll(
      ".ouchi-relation-connector--same-device circle",
    );
    expect(Array.from(circles, (circle) => circle.getAttribute("cx"))).toEqual(
      ["140", "100", "180", "140"],
    );
    expect(
      Array.from(
        circles,
        (circle) => circle.getAttribute("cy"),
      ).sort(),
    ).toEqual(["200", "200", "220", "420"]);
    expect(
      Array.from(
        container.querySelectorAll(
          ".ouchi-relation-connector--same-device .ouchi-relation-visible",
        ),
        (path) => path.getAttribute("d"),
      ),
    ).toEqual(["M 140 220 L 100 200", "M 180 200 L 140 420"]);
    expect(
      container.querySelector(".ouchi-relation-card-mask"),
    ).not.toBeInTheDocument();
  });

  it("draws the aura-gw demo chain between adjacent top and bottom points", async () => {
    const user = userEvent.setup();
    const demoData = ledgerYamlToPortalData(sampleYaml);
    const rect = (
      left: number,
      top: number,
      width: number,
      height: number,
    ): DOMRect =>
      ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this instanceof HTMLElement && this.classList.contains("ouchi-canvas")) {
          return rect(0, 0, 1200, 1600);
        }
        if (this instanceof HTMLElement && this.dataset.deviceId === "device-1") {
          const membershipId = this
            .getAttribute("aria-labelledby")
            ?.replace("device-", "");
          const top =
            membershipId === "membership-2"
              ? 100
              : membershipId === "membership-3"
                ? 400
                : 700;
          return rect(20, top, 240, 160);
        }
        return rect(20, 1200, 240, 160);
      },
    );
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
      function (this: Element) {
        return [
          this.getBoundingClientRect(),
        ] as unknown as DOMRectList;
      },
    );

    const { container } = render(
      <OuchiPortal data={demoData} showTitle={false} />,
    );
    await user.click(
      screen.getAllByRole("button", { name: "aura-gwを選択" })[0],
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll(
          ".ouchi-relation-connector--same-device .ouchi-relation-visible",
        ),
      ).toHaveLength(2);
    });
    const paths = Array.from(
      container.querySelectorAll<SVGPathElement>(
        ".ouchi-relation-connector--same-device .ouchi-relation-visible",
      ),
      (path) => path.getAttribute("d"),
    );
    expect(paths).toEqual([
      "M 140 260 L 140 400",
      "M 140 560 L 140 700",
    ]);
    expect(paths.every((path) => path?.includes(" L "))).toBe(true);
    expect(paths.every((path) => !path?.includes(" C "))).toBe(true);
  });

  it("draws cedar-host's three VM relations from separate bottom points", async () => {
    const user = userEvent.setup();
    const demoData = ledgerYamlToPortalData(sampleYaml);
    const rect = (
      left: number,
      top: number,
      width: number,
      height: number,
    ): DOMRect =>
      ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this instanceof HTMLElement && this.classList.contains("ouchi-canvas")) {
          return rect(0, 0, 1200, 1600);
        }
        if (this instanceof HTMLElement && this.dataset.deviceId) {
          const membershipId = this
            .getAttribute("aria-labelledby")
            ?.replace("device-", "");
          if (membershipId === "membership-4") {
            return rect(20, 200, 240, 160);
          }
          if (membershipId === "membership-14") {
            return rect(20, 500, 240, 160);
          }
          if (membershipId === "membership-13") {
            return rect(300, 500, 240, 160);
          }
          if (membershipId === "membership-15") {
            return rect(580, 500, 240, 160);
          }
        }
        return rect(20, 1200, 240, 160);
      },
    );
    vi.spyOn(Element.prototype, "getClientRects").mockImplementation(
      function (this: Element) {
        return [
          this.getBoundingClientRect(),
        ] as unknown as DOMRectList;
      },
    );

    const { container } = render(
      <OuchiPortal data={demoData} showTitle={false} />,
    );
    await user.click(
      screen.getByRole("button", { name: "cedar-hostを選択" }),
    );

    const relationPaths = await waitFor(() => {
      const paths = Array.from(
        container.querySelectorAll<SVGPathElement>(
          ".ouchi-relation-connector--relation .ouchi-relation-visible",
        ),
        (path) => path.getAttribute("d"),
      );
      expect(paths).toHaveLength(3);
      return paths;
    });
    expect(relationPaths).toEqual([
      "M 140 360 L 420 500",
      "M 80 360 L 140 500",
      "M 200 360 L 700 500",
    ]);
    expect(
      container.querySelector(".ouchi-relation-card-mask"),
    ).not.toBeInTheDocument();
  });

  it("clears selection when clicking outside a device", () => {
    const { container } = render(<OuchiPortal data={portalData} />);
    const card = container.querySelector('[data-device-id="2"]');
    fireEvent.click(card as HTMLElement);
    expect(card).toHaveClass("ouchi-device-card--selected");
    fireEvent.click(container.querySelector(".ouchi-canvas") as HTMLElement);
    expect(card).not.toHaveClass("ouchi-device-card--selected");
  });

  it("shows API-backed management text and no localStorage copy", async () => {
    const user = userEvent.setup();
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const drawer = screen.getByRole("dialog", { name: "ポータルを管理" });
    expect(within(drawer).getByText("SQLite台帳（API）へ保存")).toBeVisible();
    expect(within(drawer).queryByText(/localStorage/)).not.toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("displays settings.title and saves changes through the API", async () => {
    const user = userEvent.setup();
    let currentTitle = "あなたのホームラボ";
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/settings") && init?.method === "PUT") {
          currentTitle = JSON.parse(String(init.body)).title;
          return jsonResponse({
            domain: "ouchi.local",
            title: currentTitle,
          });
        }
        return jsonResponse({
          ...structuredClone(apiData),
          settings: {
            domain: "ouchi.local",
            title: currentTitle,
          },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal showTitle={false} />);

    expect(
      await screen.findByRole("heading", {
        name: "あなたのホームラボ",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "管理" }));
    expect(
      screen.getByRole("textbox", { name: "ポータルドメイン" }),
    ).toHaveValue("ouchi.local");
    const input = screen.getByRole("textbox", {
      name: "ポータルタイトル",
    });
    await user.clear(input);
    await user.type(input, "我が家のポータル");
    await user.click(
      screen.getByRole("button", { name: "タイトルを保存" }),
    );

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([request, init]) =>
          String(request).endsWith("/api/settings") &&
          init?.method === "PUT",
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        title: "我が家のポータル",
      });
    });
    expect(
      await screen.findByRole("heading", { name: "我が家のポータル" }),
    ).toBeVisible();
    expect(
      screen.getByText("ポータルタイトルを保存しました。"),
    ).toBeVisible();
  });

  it("downloads YAML and requires a visible content check before importing", async () => {
    const user = userEvent.setup();
    const yaml = [
      "format: ouchi-ledger/1",
      "exportedAt: 2026-11-21T00:00:00.000Z",
      "settings:",
      "  domain: ouchi.local",
      "  title: あなたのホームラボ",
      "networks: []",
      "devices: []",
      "relations: []",
      "services: []",
      "sshKeys: []",
      "deviceKeys: []",
      "",
    ].join("\n");
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/export")) {
          return Promise.resolve(
            new Response(yaml, {
              headers: {
                "Content-Disposition":
                  'attachment; filename="ouchi-ledger-test.yaml"',
                "Content-Type": "application/yaml",
              },
            }),
          );
        }
        if (url.endsWith("/api/import") && init?.method === "POST") {
          return jsonResponse({
            ok: true,
            imported: {
              networks: 0,
              devices: 0,
              memberships: 0,
              relations: 0,
              services: 0,
              sshKeys: 0,
              deviceKeys: 0,
            },
          });
        }
        return jsonResponse(apiData);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(
      screen.getByRole("button", { name: "YAMLをエクスポート" }),
    );
    expect(
      await screen.findByText(
        "ouchi-ledger-test.yaml をダウンロードしました。",
      ),
    ).toBeVisible();

    const file = new File([yaml], "ledger.yaml", {
      type: "application/yaml",
    });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: () => Promise.resolve(yaml),
    });
    await user.upload(
      screen.getByLabelText("インポートするYAMLファイル"),
      file,
    );
    expect(await screen.findByText("ledger.yaml")).toBeVisible();
    expect(
      screen.getByRole("alert").textContent,
    ).toContain("現在のネットワーク");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/import"),
      expect.anything(),
    );

    await user.click(
      screen.getByRole("button", {
        name: "内容を確認して全置き換え",
      }),
    );
    await waitFor(() => {
      const importCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith("/api/import") &&
          init?.method === "POST",
      );
      expect(importCall?.[1]?.body).toBe(yaml);
    });
    expect(
      await screen.findByText(/全置き換えが完了しました/),
    ).toBeVisible();
  });

  it("adds a service without a status input", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /サービス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    const dialog = screen.getByRole("dialog", { name: "サービスを追加" });

    expect(
      within(dialog).getByRole("textbox", { name: "サブドメイン" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("combobox", { name: "プロトコル" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: "初期状態" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/状態プロバイダ|稼働状態/),
    ).not.toBeInTheDocument();
  });

  it("keeps SSH metadata editable without exposing meter controls", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(
      screen.getByRole("button", { name: "nanopi-r2sを編集" }),
    );
    const dialog = screen.getByRole("dialog", { name: "デバイスを編集" });

    expect(within(dialog).getByText("SSH接続情報")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("textbox", { name: "SSHユーザー" }),
    ).toHaveValue("monitor");
    expect(
      within(dialog).queryByText(/メモリ|ディスク|使用率|SSHリソース収集/),
    ).not.toBeInTheDocument();
  });

  it("sends a network create request and reloads the API snapshot", async () => {
    const user = userEvent.setup();
    let portalReadCount = 0;
    const fetchMock = vi.fn(
      (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/networks")) {
        return jsonResponse(
          {
            id: 4,
            name: "ゲストWi-Fi",
            cidr: null,
            accent: "green",
            note: null,
          },
          201,
        );
      }
      portalReadCount += 1;
      const next = structuredClone(apiData);
      if (portalReadCount > 1) {
        next.networks.push({
          id: 4,
          name: "ゲストWi-Fi",
          cidr: null,
          accent: "green",
          note: null,
        });
      }
        return jsonResponse(next);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal />);
    await screen.findByText("nanopi-r2s");

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "ネットワーク名" }),
      "ゲストWi-Fi",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "アクセント色" }),
      "green",
    );
    await user.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() =>
      expect(screen.getAllByText("ゲストWi-Fi").length).toBeGreaterThan(0),
    );
    const postCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/api/networks") &&
        init?.method === "POST",
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      name: "ゲストWi-Fi",
      cidr: null,
      accent: "green",
      note: null,
    });
  });

  it("blocks deleting a network with memberships before calling the API", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);
    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(
      screen.getByRole("button", { name: "おうちLANを削除" }),
    );
    expect(screen.getByText(/所属IPが3件登録されています/)).toBeVisible();
  });

  it("does not refocus the first field on parent rerenders", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <EntityDialog
        data={portalData}
        editingId="2"
        kind="device"
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    vi.runOnlyPendingTimers();
    const ipField = screen.getByRole("textbox", { name: "IPアドレス 1" });
    ipField.focus();
    rerender(
      <EntityDialog
        data={portalData}
        editingId="2"
        kind="device"
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    expect(ipField).toHaveFocus();
    vi.useRealTimers();
  });

  it("has no detectable structural accessibility violations", async () => {
    const { container } = render(<OuchiPortal data={portalData} />);
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
