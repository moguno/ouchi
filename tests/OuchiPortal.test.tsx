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
import { ServiceIconDialog } from "../src/portal/ServiceIconDialog";
import { ServiceIcon } from "../src/portal/icons";
import { colorValueForInput } from "../src/portal/colorValue";
import { ledgerYamlToPortalData } from "../src/portal/yamlDataSource";

const sampleYaml = readFileSync(
  resolve(process.cwd(), "public/ouchi-ledger.sample.yaml"),
  "utf8",
);
const portalStyleFiles = [
  "base.css",
  "portal-shell.css",
  "portal-board.css",
  "entity-dialog.css",
  "portal-motion.css",
  "portal.css",
  "portal-connectors.css",
  "portal-board-v2.css",
  "portal-responsive.css",
  "manage-simple.css",
];
const portalStyles = portalStyleFiles
  .map((file) =>
    readFileSync(resolve(process.cwd(), "src/portal/styles", file), "utf8"),
  )
  .join("\n");
const demoServiceLinkMessage =
  "ここをクリックすると設定したURLにジャンプします";

const service = (
  overrides: Partial<PortalService> = {},
): PortalService => ({
  id: "1",
  interfaceId: "11",
  subdomain: "gitea",
  petname: "おうちGit",
  description: "Gitサーバ",
  scheme: "http",
  port: 3000,
  protocol: "tcp",
  topPath: "/",
  monitorPath: "/api/v1/version",
  iconKey: "favicon",
  enabled: true,
  url: "http://192.168.0.19:3000/",
  monitorUrl: "http://192.168.0.19:3000/api/v1/version",
  ...overrides,
});

const portalData: PortalDataV2 = {
  version: 2,
  networks: [
    { id: "1", name: "インターネット", accent: "violet", sortOrder: 30 },
    {
      id: "2",
      name: "おうちLAN",
      cidr: "192.168.0.0/24",
      accent: "blue",
      sortOrder: 10,
    },
    {
      id: "3",
      name: "OCIネットワーク",
      cidr: "192.168.253.0/24",
      accent: "orange",
      sortOrder: 20,
    },
  ],
  devices: [
    {
      id: "1",
      name: "fortigate",
      category: "network",
      meterEnabled: false,
    },
    {
      id: "2",
      name: "nanopi-r2s",
      category: "physical",
      meterEnabled: true,
      ssh: { user: "monitor", port: 22 },
    },
    {
      id: "3",
      name: "openmediavault",
      category: "vm",
      meterEnabled: true,
    },
    {
      id: "4",
      name: "notion",
      category: "service",
      meterEnabled: false,
    },
  ],
  interfaces: [
    {
      id: "10",
      deviceId: "1",
      name: "lan",
      networkId: "2",
      ip: "192.168.0.1",
    },
    {
      id: "11",
      deviceId: "2",
      name: "eth0",
      networkId: "2",
      ip: "192.168.0.19",
    },
    {
      id: "12",
      deviceId: "3",
      name: "eth0",
      networkId: "2",
      ip: "192.168.0.21",
    },
    {
      id: "13",
      deviceId: "4",
      name: "eth0",
      networkId: "1",
      ip: "",
    },
  ],
  relationNames: [
    {
      id: "relation-name-1",
      name: "バックアップ先",
      color: "#3b82f6",
      lineStart: "circle",
      lineEnd: "circle",
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
      fromInterfaceId: "12",
      toInterfaceId: "11",
      fromServiceId: null,
      toServiceId: null,
      fromLabel: "VM",
      toLabel: "親ホスト",
      port: null,
      protocol: null,
      color: "#3b82f6",
      lineStart: "circle",
      lineEnd: "circle",
    },
  ],
  services: [
    service(),
    service({
      id: "2",
      interfaceId: "13",
      subdomain: "notion",
      petname: "Notion",
      description: "外部SaaS",
      scheme: "https",
      port: 443,
      serviceUrl: "https://www.notion.so/",
      iconKey: "url:https://icons.example/notion.svg",
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
  projects: [
    { id: 1, name: "デフォルト", title: "あなたのホームラボ", color: "#c39a4a", properties: {} },
  ],
  networks: portalData.networks.map((network, index) => ({
    id: index + 1,
    projectId: 1,
    name: network.name,
    cidr: network.cidr ?? null,
    accent: network.accent,
    note: null,
    properties: {},
    sortOrder: (index + 1) * 10,
  })),
  devices: portalData.devices.map((device, index) => ({
    id: index + 1,
    projectId: 1,
    hostname: device.name,
    petname: device.petname ?? null,
    properties: device.properties ?? {},
    category: device.category,
    sshUser: device.ssh?.user ?? null,
    sshPort: device.ssh?.port ?? null,
    meterEnabled: device.meterEnabled ?? false,
    note: null,
    interfaces: portalData.interfaces
      .filter((iface) => iface.deviceId === device.id)
      .map((iface) => ({
        id: Number(iface.id),
        projectId: 1,
        deviceId: index + 1,
        name: iface.name,
        networkId: iface.networkId ? Number(iface.networkId) : null,
        ip: iface.ip || null,
        mac: iface.mac ?? null,
        properties: iface.properties ?? {},
      })),
  })),
  services: portalData.services.map((item, index) => ({
    id: index + 1,
    projectId: 1,
    interfaceId: Number(item.interfaceId),
    subdomain: item.subdomain,
    petname: item.petname ?? null,
    description: item.description ?? null,
    properties: item.properties ?? {},
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
  relationNames: portalData.relationNames.map((relationName, index) => ({
    id: index + 1,
    projectId: 1,
    name: relationName.name,
    color: relationName.color,
    lineStart: relationName.lineStart,
    lineEnd: relationName.lineEnd,
    relationCount: relationName.relationCount,
  })),
  relations: portalData.relations.map((relation, index) => ({
    id: index + 1,
    projectId: 1,
    relationNameId: Number(relation.relationNameId),
    relationName: relation.relationName,
    fromDeviceId: Number(relation.fromDeviceId),
    toDeviceId: Number(relation.toDeviceId),
    fromInterfaceId:
      relation.fromInterfaceId === null
        ? null
        : Number(relation.fromInterfaceId),
    toInterfaceId:
      relation.toInterfaceId === null ? null : Number(relation.toInterfaceId),
    fromInterfaceName:
      portalData.interfaces.find(
        (iface) => iface.id === relation.fromInterfaceId,
      )?.name ?? null,
    toInterfaceName:
      portalData.interfaces.find((iface) => iface.id === relation.toInterfaceId)
        ?.name ?? null,
    fromServiceId:
      relation.fromServiceId === null ? null : Number(relation.fromServiceId),
    toServiceId:
      relation.toServiceId === null ? null : Number(relation.toServiceId),
    fromServiceName: null,
    toServiceName: null,
    fromServiceSubdomain: null,
    toServiceSubdomain: null,
    fromLabel: relation.fromLabel,
    toLabel: relation.toLabel,
    port: relation.port,
    protocol: relation.protocol,
    properties: relation.properties ?? {},
    color: relation.color,
    lineStart: relation.lineStart,
    lineEnd: relation.lineEnd,
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

    const { container } = render(<OuchiPortal />);

    expect(screen.getByText(/台帳を読み込んでいます/)).toBeInTheDocument();
    expect(await screen.findByText("nanopi-r2s")).toBeInTheDocument();
    expect(
      container.querySelector(".ouchi-relation-legend"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".ouchi-portal-footer"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("関係先はタグ色")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/portal",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("opens management from a relative YAML demo source", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(sampleYaml, {
          headers: { "Content-Type": "application/yaml" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <OuchiPortal
        showTitle={false}
        yamlUrl="ouchi-ledger.sample.yaml"
      />,
    );

    expect(
      await screen.findByText("ホームダッシュボード", { exact: true }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "あなたのおうち環境" }),
    ).toBeVisible();
    expect(screen.queryByText("表示専用デモ")).not.toBeInTheDocument();
    expect(
      container.querySelector(".ouchi-relation-legend"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".ouchi-portal-footer"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "管理" }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    expect(
      within(view).getByText(/デモモードでは保存されません/),
    ).toBeVisible();
    expect(
      within(view).getByText("デモモード: 保存無効"),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "ouchi-ledger.sample.yaml",
      expect.objectContaining({
        headers: { Accept: "application/yaml" },
      }),
    );
  });

  it("opens every management tab in YAML demo mode", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(sampleYaml, {
            headers: { "Content-Type": "application/yaml" },
          }),
        ),
      ),
    );

    render(
      <OuchiPortal
        showTitle={false}
        yamlUrl="ouchi-ledger.sample.yaml"
      />,
    );
    await screen.findByText("ホームダッシュボード", { exact: true });
    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });

    expect(
      within(view).getByRole("heading", { name: "ネットワーク" }),
    ).toBeVisible();

    await user.click(within(view).getByRole("tab", { name: /デバイス/ }));
    expect(
      within(view).getByRole("heading", { name: "デバイス" }),
    ).toBeVisible();

    await user.click(within(view).getByRole("tab", { name: /サービス/ }));
    expect(
      within(view).getByRole("heading", { name: "サービス" }),
    ).toBeVisible();

    await user.click(within(view).getByRole("tab", { name: "関係" }));
    expect(
      within(view).getByRole("heading", { name: "関係名" }),
    ).toBeVisible();
    expect(
      within(view).getByRole("heading", { name: "関係" }),
    ).toBeVisible();

    await user.click(within(view).getByRole("tab", { name: "共通設定" }));
    expect(
      within(view).getByRole("heading", {
        name: "ポータルのタイトル",
      }),
    ).toBeVisible();
  });

  it("keeps demo dialogs editable but disables every save action except export", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          new Response(sampleYaml, {
            headers: { "Content-Type": "application/yaml" },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    render(
      <OuchiPortal
        showTitle={false}
        yamlUrl="ouchi-ledger.sample.yaml"
      />,
    );
    await screen.findByText("ホームダッシュボード", { exact: true });
    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });

    within(view)
      .getAllByRole("button", { name: /を削除$/ })
      .forEach((button) => expect(button).toBeDisabled());

    await user.click(
      within(view).getByRole("button", { name: "ネットワークを追加" }),
    );
    let dialog = screen.getByRole("dialog", {
      name: "ネットワークを追加",
    });
    expect(
      within(dialog).getByRole("textbox", { name: "ネットワーク名" }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "追加する" }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await user.click(within(view).getByRole("tab", { name: /デバイス/ }));
    await user.click(
      within(view).getByRole("button", { name: "L3 Switchを編集" }),
    );
    dialog = screen.getByRole("dialog", { name: "デバイスを編集" });
    expect(
      within(dialog).getByRole("button", { name: "保存" }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await user.click(
      within(view).getByRole("button", { name: "L3 Switchのメモ" }),
    );
    dialog = screen.getByRole("dialog", { name: "L3 Switchのメモ" });
    expect(
      within(dialog).getByRole("button", { name: "プロパティを追加" }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "保存" }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await user.click(within(view).getByRole("tab", { name: /サービス/ }));
    await user.click(
      within(view).getByRole("button", {
        name: "ホームダッシュボードのアイコン",
      }),
    );
    dialog = screen.getByRole("dialog", {
      name: "ホームダッシュボードのアイコン",
    });
    expect(
      within(dialog).getByRole("radio", { name: /未設定/ }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "保存" }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await user.click(within(view).getByRole("tab", { name: "関係" }));
    await user.click(
      within(view).getByRole("button", { name: "VMを編集" }),
    );
    dialog = screen.getByRole("dialog", { name: "関係名を編集" });
    expect(
      within(dialog).getByRole("textbox", { name: "関係名" }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "保存" }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await user.click(
      within(view).getAllByRole("button", {
        name: "cedar-host / eth0からharbor-core / eth0への関係を編集",
      })[0],
    );
    dialog = screen.getByRole("dialog", { name: "関係を編集" });
    expect(
      within(dialog).getByRole("combobox", { name: "始点インターフェース 1" }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "保存" }),
    ).toBeDisabled();
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );

    await user.click(within(view).getByRole("tab", { name: "共通設定" }));
    const titleInput = within(view).getByRole("textbox", {
      name: "ポータルタイトル",
    });
    expect(titleInput).toBeEnabled();
    await user.clear(titleInput);
    await user.type(titleInput, "デモで編集したタイトル");
    expect(
      within(view).getByRole("button", { name: "タイトルを保存" }),
    ).toBeDisabled();
    expect(
      within(view).getByLabelText("インポートするYAMLファイル"),
    ).toBeDisabled();
    const exportButton = within(view).getByRole("button", {
      name: "YAMLをエクスポート",
    });
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);
    expect(
      await within(view).findByText(
        "ouchi-ledger-demo.yaml をダウンロードしました。",
      ),
    ).toBeVisible();
    expect(
      fetchMock.mock.calls.every(
        ([input]) => String(input) === "ouchi-ledger.sample.yaml",
      ),
    ).toBe(true);
  });

  it("keeps API mode service tiles as external links", () => {
    render(<OuchiPortal data={portalData} />);

    expect(
      screen.getByRole("link", { name: /おうちGit/ }),
    ).toHaveAttribute("href", "http://192.168.0.19:3000/");
    expect(
      screen.queryByRole("alertdialog"),
    ).not.toBeInTheDocument();
  });

  it("shows the exact in-app alert without navigating for demo service tiles", async () => {
    const user = userEvent.setup();
    let currentYaml = sampleYaml;
    const fetchMock = vi.fn(
      () =>
        Promise.resolve(
          new Response(currentYaml, {
            headers: { "Content-Type": "application/yaml" },
          }),
        ),
    );
    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    vi.stubGlobal("fetch", fetchMock);
    const initialLocation = window.location.href;

    const firstRender = render(
      <OuchiPortal
        showTitle={false}
        yamlUrl="ouchi-ledger.sample.yaml"
      />,
    );
    const configuredTile = await screen.findByRole("button", {
      name: /ホームダッシュボード/,
    });
    expect(configuredTile).not.toHaveAttribute("href");

    await user.click(configuredTile);
    let alertDialog = await screen.findByRole("alertdialog");
    expect(
      within(alertDialog).getByText(demoServiceLinkMessage, {
        exact: true,
      }),
    ).toBeVisible();
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialLocation);

    await user.click(
      within(alertDialog).getByRole("button", { name: "閉じる" }),
    );
    expect(
      screen.queryByRole("alertdialog"),
    ).not.toBeInTheDocument();
    firstRender.unmount();

    currentYaml = sampleYaml.replace(
      "    serviceUrl: https://drive.google.com/",
      "    serviceUrl: null",
    );
    render(
      <OuchiPortal
        showTitle={false}
        yamlUrl="ouchi-ledger.sample.yaml"
      />,
    );
    const missingUrlTile = await screen.findByRole("button", {
      name: "Google Driveを開く",
    });
    expect(missingUrlTile).not.toHaveAttribute("href");

    await user.click(missingUrlTile);
    alertDialog = await screen.findByRole("alertdialog");
    expect(
      within(alertDialog).getByText(demoServiceLinkMessage, {
        exact: true,
      }),
    ).toBeVisible();
    expect(openSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(initialLocation);
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
    const categoryIcons = Array.from(
      homeLan.querySelectorAll(".ouchi-device-category-icon"),
    );
    expect(categoryIcons).toHaveLength(3);
    expect(
      homeLan.querySelector(
        ".ouchi-device-category-icon--network svg",
      ),
    ).toBeInTheDocument();
    expect(
      homeLan.querySelector(
        ".ouchi-device-category-icon--physical svg",
      ),
    ).toBeInTheDocument();
    expect(
      homeLan.querySelector(
        ".ouchi-device-category-icon--vm svg",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to the hostname without duplicating it in the card subline", () => {
    const { container } = render(<OuchiPortal data={portalData} />);
    const card = container.querySelector('[data-device-id="2"]') as HTMLElement;

    expect(within(card).getAllByText("nanopi-r2s", { exact: true })).toHaveLength(
      1,
    );
    expect(card.querySelector(".ouchi-node-address")?.textContent).toBe(
      "192.168.0.19 / eth0",
    );
  });

  it("uses a device petname as the card title and keeps hostname in the subline", () => {
    const namedData: PortalDataV2 = {
      ...portalData,
      devices: portalData.devices.map((device) =>
        device.id === "2" ? { ...device, petname: "門番" } : device,
      ),
    };
    const { container } = render(<OuchiPortal data={namedData} />);
    const card = container.querySelector('[data-device-id="2"]') as HTMLElement;

    expect(within(card).getByText("門番", { exact: true })).toBeVisible();
    expect(card.querySelector(".ouchi-node-address")?.textContent).toBe(
      "192.168.0.19 / nanopi-r2s / eth0",
    );
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

  it("highlights related devices without putting endpoint labels on cards", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal data={portalData} />);

    await user.click(
      screen.getByRole("button", { name: "openmediavaultを選択" }),
    );
    // Endpoint labels live on the line hover chips, not on the cards.
    expect(screen.queryByText("親ホスト")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-device-id="2"]'),
    ).toHaveClass("ouchi-device-card--related");
    expect(
      container.querySelector('[data-device-id="1"]'),
    ).toHaveClass("ouchi-device-card--neutral");
  });

  it("shows the relation's endpoint labels as chips while a device is selected", async () => {
    const user = userEvent.setup();
    const templated = structuredClone(portalData);
    templated.relations[0].fromLabel = "VMhost";
    templated.relations[0].toLabel = "親ホスト8";

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
          if (this.dataset.deviceId === "3") {
            return rect(20, 40, 240, 160);
          }
          if (this.dataset.deviceId === "2") {
            return rect(20, 400, 240, 160);
          }
          if (this.dataset.deviceId) {
            return rect(900, 40, 240, 160);
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

    const { container } = render(<OuchiPortal data={templated} />);
    await user.click(
      screen.getByRole("button", { name: "openmediavaultを選択" }),
    );
    // The labels appear as endpoint chips in the connector layer,
    // never as content inside a device card.
    const chips = await waitFor(() => {
      const found = container.querySelectorAll(
        ".ouchi-relation-endpoint-label",
      );
      expect(found).toHaveLength(2);
      return found;
    });
    expect(Array.from(chips, (chip) => chip.textContent)).toEqual([
      "VMhost",
      "親ホスト8",
    ]);
    expect(
      container.querySelector('[data-device-id] .ouchi-relation-endpoint-label'),
    ).toBeNull();

    fireEvent.click(container.querySelector(".ouchi-canvas") as HTMLElement);
    expect(
      container.querySelectorAll(".ouchi-relation-endpoint-label"),
    ).toHaveLength(0);
  });

  it("cycles relation display modes on the portal filter and persists them locally", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    render(<OuchiPortal data={portalData} />);

    const chip = screen.getByRole("button", {
      name: "関係フィルター バックアップ先（選択時のみ）",
    });
    // The mode is shown by appearance (chip class) only: no state label
    // text ever appears, so the chip width never changes with the mode.
    expect(chip).toHaveClass("ouchi-relation-filter-chip--selected");
    expect(chip.textContent).toBe("バックアップ先");
    await user.click(chip);
    const alwaysChip = screen.getByRole("button", {
      name: "関係フィルター バックアップ先（常時表示）",
    });
    expect(alwaysChip).toHaveClass("ouchi-relation-filter-chip--always");
    expect(alwaysChip.textContent).toBe("バックアップ先");
    expect(window.localStorage.getItem("ouchi.relationDisplayModes.v1")).toBe(
      JSON.stringify({ "バックアップ先": "always" }),
    );

    await user.click(alwaysChip);
    const hiddenChip = screen.getByRole("button", {
      name: "関係フィルター バックアップ先（表示しない）",
    });
    expect(hiddenChip).toHaveClass("ouchi-relation-filter-chip--hidden");
    expect(hiddenChip.textContent).toBe("バックアップ先");

    await user.click(hiddenChip);
    expect(
      screen.getByRole("button", {
        name: "関係フィルター バックアップ先（選択時のみ）",
      }),
    ).toHaveClass("ouchi-relation-filter-chip--selected");
    window.localStorage.clear();
  });

  it("uses a relation-name selector in the shared relation editor", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));
    await user.click(
      within(view).getByRole("button", {
        name: "openmediavault / eth0からnanopi-r2s / eth0への関係を編集",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "関係を編集",
    });
    expect(
      within(dialog).getByRole("combobox", { name: "関係名 1" }),
    ).toHaveValue("バックアップ先");
    expect(
      within(dialog).getByText(
        /色は関係名「バックアップ先」の定義を使います。/,
      ),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("textbox", { name: "関係色 1" }),
    ).not.toBeInTheDocument();
    const route = dialog.querySelector(".ouchi-relation-row-route");
    expect(route?.textContent).toContain("openmediavault");
    expect(route?.textContent).toContain("VM");
    expect(route?.textContent).toContain("→");
    expect(route?.textContent).toContain("nanopi-r2s");
    expect(route?.textContent).toContain("親ホスト");
  });

  it("always shows label inputs and keeps labels across relation names", async () => {
    const user = userEvent.setup();
    const templated = structuredClone(portalData);
    templated.relationNames.push({
      id: "relation-name-2",
      name: "固定ラベル",
      color: "#22c55e",
      lineStart: "circle",
      lineEnd: "circle",
      relationCount: 0,
    });
    render(<OuchiPortal data={templated} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));
    await user.click(
      within(view).getByRole("button", {
        name: "openmediavault / eth0からnanopi-r2s / eth0への関係を編集",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "関係を編集",
    });
    const fromInput = within(dialog).getByRole("textbox", {
      name: "始点ラベル 1",
    });
    const toInput = within(dialog).getByRole("textbox", {
      name: "終点ラベル 1",
    });
    expect(fromInput).toBeVisible();
    expect(toInput).toBeVisible();
    expect(fromInput).toHaveValue("VM");
    expect(toInput).toHaveValue("親ホスト");

    await user.clear(fromInput);
    await user.type(fromInput, "host");
    await user.clear(toInput);
    await user.type(toInput, "8");
    expect(
      dialog.querySelector(".ouchi-relation-row-route")?.textContent,
    ).toContain("openmediavault / eth0host→nanopi-r2s / eth08");

    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "関係名 1" }),
      "固定ラベル",
    );
    expect(
      within(dialog).getByRole("textbox", { name: "始点ラベル 1" }),
    ).toHaveValue("host");
    expect(
      within(dialog).getByRole("textbox", { name: "終点ラベル 1" }),
    ).toHaveValue("8");
  });

  it("lists every relation and edits it through the shared relation editor", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        if (
          String(input).endsWith("/api/relations/20") &&
          init?.method === "PUT"
        ) {
          return jsonResponse({ ok: true });
        }
        return jsonResponse({ ok: true });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));

    const editButton = within(view).getByRole("button", {
      name: "openmediavault / eth0からnanopi-r2s / eth0への関係を編集",
    });
    const row = editButton.closest("tr") as HTMLElement;
    expect(row).not.toBeNull();
    const cells = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells.slice(0, 5)).toEqual([
      "バックアップ先",
      "openmediavault / eth0",
      "VM",
      "nanopi-r2s / eth0",
      "親ホスト",
    ]);
    expect(
      within(view)
        .getByRole("button", { name: "バックアップ先を編集" })
        .closest("tr")?.textContent,
    ).toContain("1");

    await user.click(editButton);
    const dialog = screen.getByRole("dialog", { name: "関係を編集" });
    expect(
      within(dialog).getByRole("combobox", { name: "始点インターフェース 1" }),
    ).toHaveValue("12");
    expect(
      within(dialog).getByRole("combobox", { name: "終点インターフェース 1" }),
    ).toHaveValue("11");
    expect(
      within(dialog).getByRole("combobox", { name: "関係名 1" }),
    ).toHaveValue("バックアップ先");
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith("/api/relations/20") &&
          init?.method === "PUT",
      );
      expect(updateCall).toBeDefined();
      expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
        fromInterfaceId: 12,
        toInterfaceId: 11,
        fromServiceId: null,
        toServiceId: null,
        relationName: "バックアップ先",
        fromLabel: "VM",
        toLabel: "親ホスト",
        port: null,
        protocol: null,
      });
    });
  });

  it("shows the relation's labels in the management relation row", async () => {
    const user = userEvent.setup();
    const templated = structuredClone(portalData);
    templated.relations[0].fromLabel = "VMhost";
    templated.relations[0].toLabel = "親ホスト8";
    render(<OuchiPortal data={templated} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));
    const row = within(view)
      .getByRole("button", {
        name: "openmediavault / eth0からnanopi-r2s / eth0への関係を編集",
      })
      .closest("tr") as HTMLElement;

    const cells = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells.slice(0, 5)).toEqual([
      "バックアップ先",
      "openmediavault / eth0",
      "VMhost",
      "nanopi-r2s / eth0",
      "親ホスト8",
    ]);
  });

  it("shows a dash for empty endpoint labels in the management relation row", async () => {
    const user = userEvent.setup();
    const unlabeled = structuredClone(portalData);
    unlabeled.relations[0].fromLabel = "";
    unlabeled.relations[0].toLabel = "";
    render(<OuchiPortal data={unlabeled} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));
    const row = within(view)
      .getByRole("button", {
        name: "openmediavault / eth0からnanopi-r2s / eth0への関係を編集",
      })
      .closest("tr") as HTMLElement;

    const cells = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells.slice(0, 5)).toEqual([
      "バックアップ先",
      "openmediavault / eth0",
      "-",
      "nanopi-r2s / eth0",
      "-",
    ]);
  });

  it("adds and deletes relations from the relations tab", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        jsonResponse({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));
    await user.click(
      within(view).getByRole("button", { name: "関係を追加" }),
    );

    const addDialog = screen.getByRole("dialog", { name: "関係を追加" });
    expect(
      within(addDialog).getByRole("combobox", { name: "始点インターフェース 1" }),
    ).toHaveValue("10");
    expect(
      within(addDialog).getByRole("combobox", { name: "終点インターフェース 1" }),
    ).toHaveValue("11");
    expect(
      within(addDialog).getByRole("combobox", { name: "関係名 1" }),
    ).toHaveValue("バックアップ先");
    await user.click(
      within(addDialog).getByRole("button", { name: "追加する" }),
    );

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith("/api/relations") &&
          init?.method === "POST",
      );
      expect(createCall).toBeDefined();
      expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
        fromInterfaceId: 10,
        toInterfaceId: 11,
        fromServiceId: null,
        toServiceId: null,
        relationName: "バックアップ先",
        fromLabel: "",
        toLabel: "",
        port: null,
        protocol: null,
      });
    });

    await user.click(
      within(view).getByRole("button", {
        name: "openmediavault / eth0からnanopi-r2s / eth0への関係を削除",
      }),
    );
    const confirm = screen.getByRole("alertdialog", {
      name: "関係を削除しますか？",
    });
    await user.click(within(confirm).getByRole("button", { name: "削除する" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/relations/20",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("creates, edits, counts, and deletes unused relation names", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      (_input: string | URL | Request, _init?: RequestInit) =>
        jsonResponse({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: "関係" }));
    await user.click(
      within(view).getByRole("button", {
        name: "関係名を追加",
      }),
    );
    const addRelationNameDialog = screen.getByRole("dialog", {
      name: "関係名を追加",
    });
    await user.type(
      within(addRelationNameDialog).getByRole("textbox", {
        name: "関係名",
      }),
      "監視",
    );
    await user.clear(
      within(addRelationNameDialog).getByRole("textbox", {
        name: "関係名の色コード",
      }),
    );
    await user.type(
      within(addRelationNameDialog).getByRole("textbox", {
        name: "関係名の色コード",
      }),
      "#22c55e",
    );
    await user.click(
      within(addRelationNameDialog).getByRole("button", {
        name: "追加する",
      }),
    );

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith("/api/relation-names") &&
          init?.method === "POST",
      );
      expect(updateCall).toBeDefined();
      expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({
        name: "監視",
        color: "#22c55e",
        lineStart: "circle",
        lineEnd: "circle",
      });
    });

    await user.click(
      within(view).getByRole("button", {
        name: "バックアップ先を編集",
      }),
    );
    const editRelationNameDialog = screen.getByRole("dialog", {
      name: "関係名を編集",
    });
    expect(
      within(editRelationNameDialog).queryByRole("textbox", {
        name: "始点の名前",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(editRelationNameDialog).queryByRole("textbox", {
        name: "終点の名前",
      }),
    ).not.toBeInTheDocument();
    await user.clear(
      within(editRelationNameDialog).getByRole("textbox", {
        name: "関係名の色コード",
      }),
    );
    await user.type(
      within(editRelationNameDialog).getByRole("textbox", {
        name: "関係名の色コード",
      }),
      "#ef4444",
    );
    await user.click(
      within(editRelationNameDialog).getByRole("button", { name: "保存" }),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/relation-names/relation-name-1",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    expect(
      within(view).getByRole("button", {
        name: "バックアップ先は使用中のため削除できません",
      }),
    ).toBeDisabled();
  });

  it("normalizes relation-name colors for the native color input", async () => {
    const user = userEvent.setup();
    const namedColorData = structuredClone(portalData);
    namedColorData.relationNames[0].color = "blue";
    render(<OuchiPortal data={namedColorData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: "関係" }));
    await user.click(
      screen.getByRole("button", { name: "バックアップ先を編集" }),
    );
    const dialog = screen.getByRole("dialog", { name: "関係名を編集" });

    expect(
      within(dialog).getByRole("textbox", { name: "関係名の色コード" }),
    ).toHaveValue("blue");
    expect(
      within(dialog).getByLabelText("関係名の色"),
    ).toHaveValue("#0000ff");
    expect(colorValueForInput("rebeccapurple")).toBe("#663399");
  });

  it("draws adjacent pairs between duplicate device displays", async () => {
    const user = userEvent.setup();
    const duplicateData: PortalDataV2 = {
      ...portalData,
      interfaces: [
        ...portalData.interfaces,
        {
          id: "14",
          deviceId: "1",
          name: "oci",
          networkId: "3",
          ip: "192.168.253.1",
        },
        {
          id: "15",
          deviceId: "1",
          name: "wan1",
          networkId: "1",
          ip: "10.0.0.1",
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
          const interfaceId = this
            .getAttribute("aria-labelledby")
            ?.replace("device-", "");
          if (this.dataset.deviceId && interfaceId) {
            const top =
              interfaceId === "14"
                ? 40
                : interfaceId === "10"
                  ? 220
                  : interfaceId === "15"
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
      ["140", "104.33333333333333", "175.66666666666666", "140"],
    );
    expect(
      Array.from(
        circles,
        (circle) => circle.getAttribute("cy"),
      ).sort(),
    ).toEqual(["188", "188", "232", "432"]);
    expect(
      Array.from(
        container.querySelectorAll(
          ".ouchi-relation-connector--same-device .ouchi-relation-visible",
        ),
        (path) => path.getAttribute("d"),
      ),
    ).toEqual([
      "M 140 232 L 104.33333333333333 188",
      "M 175.66666666666666 188 L 140 432",
    ]);
    expect(
      container.querySelector(".ouchi-relation-card-mask"),
    ).not.toBeInTheDocument();
  });

  it("draws service-endpoint relations from tile icon to tile icon", async () => {
    const user = userEvent.setup();
    const tileData: PortalDataV2 = {
      version: 2,
      networks: [
        { id: "1", name: "おうちLAN", accent: "blue", sortOrder: 10 },
      ],
      devices: [
        { id: "1", name: "app-a", category: "physical", meterEnabled: false },
        { id: "2", name: "app-b", category: "physical", meterEnabled: false },
      ],
      interfaces: [
        {
          id: "11",
          deviceId: "1",
          name: "eth0",
          networkId: "1",
          ip: "192.168.0.51",
        },
        {
          id: "12",
          deviceId: "2",
          name: "eth0",
          networkId: "1",
          ip: "192.168.0.52",
        },
      ],
      relationNames: [
        {
          id: "rn1",
          name: "Webhook",
          color: "#7c3aed",
          lineStart: "circle",
          lineEnd: "circle",
          relationCount: 1,
        },
      ],
      relations: [
        {
          id: "r1",
          relationNameId: "rn1",
          relationName: "Webhook",
          fromDeviceId: "1",
          toDeviceId: "2",
          fromInterfaceId: null,
          toInterfaceId: null,
          fromServiceId: "s1",
          toServiceId: "s2",
          fromLabel: "",
          toLabel: "",
          port: null,
          protocol: null,
          color: "#7c3aed",
          lineStart: "circle",
          lineEnd: "circle",
        },
      ],
      services: [
        service({ id: "s1", interfaceId: "11", subdomain: "appa" }),
        service({ id: "s2", interfaceId: "12", subdomain: "appb" }),
      ],
      settings: { domain: "ouchi.local", title: "タイル確認" },
    };
    const rect = (
      left: number,
      top: number,
      width: number,
      height: number,
    ): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (this instanceof HTMLElement) {
          if (this.classList.contains("ouchi-canvas")) {
            return rect(0, 0, 1200, 1000);
          }
          if (this.classList.contains("ouchi-service-icon-wrap")) {
            const serviceId =
              this.closest("[data-service-id]")?.getAttribute(
                "data-service-id",
              );
            if (serviceId === "s1") {
              return rect(40, 100, 50, 50);
            }
            if (serviceId === "s2") {
              return rect(420, 100, 50, 50);
            }
          }
          if (this.dataset.deviceId === "1") {
            return rect(20, 40, 240, 300);
          }
          if (this.dataset.deviceId === "2") {
            return rect(400, 40, 240, 300);
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

    const { container } = render(<OuchiPortal data={tileData} />);
    // Device selection alone never draws a tile relation.
    await user.click(screen.getByRole("button", { name: "app-aを選択" }));
    await waitFor(() => {
      expect(
        container.querySelectorAll(
          ".ouchi-relation-connector .ouchi-relation-visible",
        ),
      ).toHaveLength(0);
    });

    // Selecting the tile draws its relations.
    await user.click(container.querySelector('[data-service-id="s1"]')!);
    const lines = await waitFor(() => {
      const found = container.querySelectorAll(
        ".ouchi-relation-connector .ouchi-relation-visible",
      );
      expect(found).toHaveLength(1);
      return found;
    });
    // Icon centres are (65, 125) and (445, 125); the line runs from
    // 8px outside the first icon's right edge to 8px outside the
    // second icon's left edge.
    expect(lines[0].getAttribute("d")).toBe("M 98 125 L 412 125");
    // Only the selected tile carries a selection frame; the
    // counterpart tile is never highlighted in conjunction.
    expect(
      container.querySelector(
        '[data-service-id="s1"]',
      )?.classList.contains("ouchi-service-tile--selected"),
    ).toBe(true);
    expect(
      container.querySelector(
        '[data-service-id="s2"]',
      )?.classList.contains("ouchi-service-tile--selected"),
    ).toBe(false);
    expect(
      container.querySelector(".ouchi-service-tile--related"),
    ).toBeNull();

    // Selecting a card clears the tile selection and its lines.
    await user.click(screen.getByRole("button", { name: "app-bを選択" }));
    await waitFor(() => {
      expect(
        container.querySelectorAll(
          ".ouchi-relation-connector .ouchi-relation-visible",
        ),
      ).toHaveLength(0);
    });
    expect(
      container.querySelector(
        '[data-service-id="s1"]',
      )?.classList.contains("ouchi-service-tile--selected"),
    ).toBe(false);
  });

  it("draws the l3-switch demo chain between adjacent top and bottom points", async () => {
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
          const interfaceId = this
            .getAttribute("aria-labelledby")
            ?.replace("device-", "");
          const top =
            interfaceId === "interface-1"
              ? 100
              : interfaceId === "interface-2"
                ? 400
                : interfaceId === "interface-3"
                  ? 700
                  : interfaceId === "interface-4"
                    ? 1000
                    : 1300;
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
      screen.getAllByRole("button", { name: "L3 Switchを選択" })[0],
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll(
          ".ouchi-relation-connector--same-device .ouchi-relation-visible",
        ),
      ).toHaveLength(4);
    });
    const paths = Array.from(
      container.querySelectorAll<SVGPathElement>(
        ".ouchi-relation-connector--same-device .ouchi-relation-visible",
      ),
      (path) => path.getAttribute("d"),
    );
    expect(paths).toEqual([
      "M 140 248 L 140 412",
      "M 140 548 L 140 712",
      "M 140 848 L 140 1012",
      "M 140 1148 L 140 1312",
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
          const interfaceId = this
            .getAttribute("aria-labelledby")
            ?.replace("device-", "");
          if (interfaceId === "interface-6") {
            return rect(20, 200, 240, 160);
          }
          if (interfaceId === "interface-16") {
            return rect(20, 500, 240, 160);
          }
          if (interfaceId === "interface-15") {
            return rect(300, 500, 240, 160);
          }
          if (interfaceId === "interface-17") {
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
      screen.getByRole("button", { name: "Aliciaを選択" }),
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
      "M 140 348 L 420 512",
      "M 86.5 348 L 140 512",
      "M 193.5 348 L 700 512",
    ]);
    expect(
      container.querySelector(".ouchi-relation-card-mask"),
    ).not.toBeInTheDocument();
  });

  it("shows endpoint labels at both ends while a device is selected", async () => {
    const user = userEvent.setup();
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
          if (this.dataset.deviceId === "3") {
            return rect(20, 40, 240, 160);
          }
          if (this.dataset.deviceId === "2") {
            return rect(20, 400, 240, 160);
          }
          if (this.dataset.deviceId) {
            return rect(900, 40, 240, 160);
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

    const { container } = render(<OuchiPortal data={portalData} />);
    await user.click(
      screen.getByRole("button", { name: "openmediavaultを選択" }),
    );

    const group = await waitFor(() => {
      const found = container.querySelector(
        ".ouchi-relation-connector--relation",
      );
      expect(found).not.toBeNull();
      return found as Element;
    });
    // Selecting the device already shows both endpoint labels.
    const labels = await waitFor(() => {
      const found = container.querySelectorAll(
        ".ouchi-relation-endpoint-label",
      );
      expect(found).toHaveLength(2);
      return found;
    });
    expect(Array.from(labels, (label) => label.textContent)).toEqual([
      "VM",
      "親ホスト",
    ]);
    expect(labels[0]).toHaveClass("ouchi-relation-endpoint-label--bottom");
    expect((labels[0] as HTMLElement).style.left).toBe("140px");
    expect((labels[0] as HTMLElement).style.top).toBe("188px");
    expect(labels[1]).toHaveClass("ouchi-relation-endpoint-label--top");
    expect((labels[1] as HTMLElement).style.left).toBe("140px");
    expect((labels[1] as HTMLElement).style.top).toBe("412px");

    fireEvent.pointerEnter(group, { clientX: 140, clientY: 300 });
    fireEvent.pointerMove(group, { clientX: 140, clientY: 300 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("バックアップ先");

    // Leaving the line keeps the labels: the selection still holds.
    fireEvent.pointerLeave(group);
    expect(
      container.querySelectorAll(".ouchi-relation-endpoint-label"),
    ).toHaveLength(2);
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
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    expect(within(view).getByText("SQLite台帳（API）へ保存")).toBeVisible();
    expect(within(view).queryByText(/localStorage/)).not.toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("shows device cascade counts in the deletion confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        if (
          String(input).endsWith("/api/devices/2") &&
          init?.method === "DELETE"
        ) {
          return jsonResponse({ ok: true });
        }
        return jsonResponse({ ok: true });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(
      screen.getByRole("button", { name: "nanopi-r2sを削除" }),
    );
    const confirm = screen.getByRole("alertdialog", {
      name: "デバイスを削除しますか？",
    });
    expect(
      within(confirm).getByText(
        /サービス1件・関係1件も一緒に削除されます。/,
      ),
    ).toBeVisible();
    await user.click(
      within(confirm).getByRole("button", { name: "削除する" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/devices/2",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(
      screen.queryByRole("alertdialog", { name: "デバイスを削除しますか？" }),
    ).not.toBeInTheDocument();
  });

  it("switches to a full-screen five-tab management view and preserves portal state", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal data={portalData} />);

    await user.click(
      screen.getByRole("button", { name: "nanopi-r2sを選択" }),
    );
    expect(container.querySelector('[data-device-id="2"]')).toHaveClass(
      "ouchi-device-card--selected",
    );

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    expect(view).toHaveClass("ouchi-manage-view");
    expect(
      screen.queryByRole("dialog", { name: "ポータルを管理" }),
    ).not.toBeInTheDocument();

    const tabs = within(view).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "ネットワーク (3)",
      "デバイス (4)",
      "サービス (2)",
      "関係",
      "共通設定",
    ]);
    expect(
      within(view).getByRole("tab", { name: /ネットワーク/ }),
    ).toHaveAttribute("aria-selected", "true");

    await user.click(within(view).getByRole("tab", { name: /デバイス/ }));
    expect(
      within(view).getByRole("tab", { name: /デバイス/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(view).getByRole("columnheader", { name: "ホスト名" }),
    ).toBeVisible();
    const deviceTable = within(view).getByRole("table");
    expect(
      within(deviceTable)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["名前", "ホスト名", "IP", "カテゴリ", "操作"]);
    expect(
      within(deviceTable).queryByRole("columnheader", { name: "サービス" }),
    ).not.toBeInTheDocument();
    expect(
      within(deviceTable).queryByRole("columnheader", { name: "関係" }),
    ).not.toBeInTheDocument();

    await user.click(within(view).getByRole("tab", { name: "関係" }));
    const relationNameTable = within(view).getAllByRole("table")[0];
    expect(
      within(relationNameTable).getByRole("columnheader", {
        name: "使用数",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "ポータルに戻る" }),
    );
    expect(container.querySelector('[data-device-id="2"]')).toHaveClass(
      "ouchi-device-card--selected",
    );
  });

  it("uses the shared table structure and opens entity edits in a native dialog", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    expect(within(view).getAllByRole("table")).toHaveLength(1);
    expect(view.querySelector("article, .ouchi-manage-row")).toBeNull();

    await user.click(
      within(view).getByRole("button", { name: "ネットワークを追加" }),
    );
    const dialog = screen.getByRole("dialog", { name: "ネットワークを追加" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );
    expect(
      screen.queryByRole("dialog", { name: "ネットワークを追加" }),
    ).not.toBeInTheDocument();
  });

  it("shows petname as the management device title and keeps the hostname beside it", async () => {
    const user = userEvent.setup();
    const namedData: PortalDataV2 = {
      ...portalData,
      devices: portalData.devices.map((device) =>
        device.id === "2" ? { ...device, petname: "門番" } : device,
      ),
    };
    render(<OuchiPortal data={namedData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: /デバイス/ }));

    const row = within(view)
      .getByText("門番", { exact: true })
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("nanopi-r2s", { exact: true })).toBeVisible();
  });

  it("labels the device display name as name and places it before the hostname", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: /デバイス/ }));
    await user.click(
      within(view).getByRole("button", { name: "nanopi-r2sを編集" }),
    );
    const dialog = screen.getByRole("dialog", { name: "デバイスを編集" });
    const nameInput = within(dialog).getByRole("textbox", { name: "名前" });
    const hostnameInput = within(dialog).getByRole("textbox", {
      name: "ホスト名",
    });

    expect(nameInput).toHaveAccessibleDescription(
      "未入力ならホスト名を表示します。",
    );
    expect(
      nameInput.compareDocumentPosition(hostnameInput) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses plain service tables and keeps icon selection in the dialog", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const view = screen.getByRole("region", { name: "ポータルを管理" });
    await user.click(within(view).getByRole("tab", { name: /デバイス/ }));
    expect(
      view.querySelector(".ouchi-manage-device-mark, .ouchi-manage-vm-mark"),
    ).toBeNull();

    await user.click(within(view).getByRole("tab", { name: /サービス/ }));
    const giteaRow = within(view)
      .getByText("おうちGit", { exact: true })
      .closest("tr") as HTMLElement;
    const giteaCells = within(giteaRow).getAllByRole("cell");
    expect(giteaCells[1]).toHaveTextContent(/^gitea$/);
    expect(giteaCells[2]).toHaveTextContent(/^nanopi-r2s$/);
    expect(giteaCells[2]).not.toHaveTextContent("192.168.0.19");
    expect(giteaCells[3]).toHaveTextContent("http://192.168.0.19:3000/");

    const serviceRow = within(view)
      .getByText("Notion", { exact: true })
      .closest("tr") as HTMLElement;
    expect(serviceRow.querySelector(".ouchi-service-mark")).toBeNull();

    await user.click(
      within(view).getByRole("button", { name: "Notionのアイコン" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Notionのアイコン" });
    expect(
      dialog.querySelector(
        ".ouchi-icon-picker-current .ouchi-service-mark--url",
      ),
    ).toBeInTheDocument();
  });

  it("keeps management styling to plain tables, borders, and native dialogs", () => {
    const manageStyles = readFileSync(
      resolve(process.cwd(), "src/portal/styles/manage-simple.css"),
      "utf8",
    );
    expect(manageStyles).toContain("font-family: system-ui");
    expect(manageStyles).toMatch(/\.ouchi-manage-table \{/);
    expect(manageStyles).toMatch(/\.ouchi-manage-dialog::backdrop/);
    expect(manageStyles).not.toMatch(/linear-gradient|radial-gradient/);
    expect(manageStyles).not.toMatch(/box-shadow/);
  });

  it("displays settings.title and saves changes through the API", async () => {
    const user = userEvent.setup();
    let currentTitle = "あなたのホームラボ";
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/projects/1") && init?.method === "PUT") {
          currentTitle = JSON.parse(String(init.body)).title;
          return jsonResponse({
            id: 1,
            name: "デフォルト",
            title: currentTitle,
            color: "#c0a359",
            properties: {},
          });
        }
        const snapshot = structuredClone(apiData);
        snapshot.projects[0].title = currentTitle;
        snapshot.settings.title = currentTitle;
        return jsonResponse(snapshot);
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
    await user.click(screen.getByRole("tab", { name: "共通設定" }));
    expect(
      screen.queryByRole("textbox", { name: "ポータルドメイン" }),
    ).not.toBeInTheDocument();
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
          String(request).endsWith("/api/projects/1") &&
          init?.method === "PUT",
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        name: "デフォルト",
        title: "我が家のポータル",
      });
    });
    expect(
      screen.getByText("ポータルタイトルを保存しました。"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "ポータルに戻る" }));
    expect(
      await screen.findByRole("heading", { name: "我が家のポータル" }),
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
              relationNames: 0,
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
    await user.click(screen.getByRole("tab", { name: "共通設定" }));
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

  it("adds a service with basic fields only and no status input", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /サービス/ }));
    await user.click(
      screen.getByRole("button", { name: "サービスを追加" }),
    );
    const dialog = screen.getByRole("dialog", { name: "サービスを追加" });

    expect(
      within(dialog).getByRole("textbox", { name: "サブドメイン" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: "プロトコル" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("searchbox", { name: "アイコンを検索" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: "初期状態" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/状態プロバイダ|稼働状態/),
    ).not.toBeInTheDocument();
  });

  it("can unset the icon from the icon dialog", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ServiceIconDialog
        data={portalData}
        onClose={() => undefined}
        onSave={onSave}
        service={portalData.services[0]}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "おうちGitのアイコン" });

    await user.click(
      within(dialog).getByRole("radio", { name: /未設定/ }),
    );
    expect(within(dialog).getByText("選択中: 未設定")).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "保存" }),
    );
    expect(onSave).toHaveBeenCalledWith(portalData.services[0].id, null);
  });

  it("can select favicon or enter an explicit image URL", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ServiceIconDialog
        data={portalData}
        onClose={() => undefined}
        onSave={onSave}
        service={portalData.services[1]}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Notionのアイコン" });

    await user.click(
      within(dialog).getByRole("radio", { name: /favicon/ }),
    );
    expect(within(dialog).getByText("選択中: favicon")).toBeVisible();

    await user.click(
      within(dialog).getByRole("radio", { name: /^URL/ }),
    );
    await user.clear(
      within(dialog).getByRole("textbox", { name: "アイコン画像URL" }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "アイコン画像URL" }),
      "https://icons.example/service.svg",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "保存" }),
    );
    expect(onSave).toHaveBeenCalledWith(
      portalData.services[1].id,
      "url:https://icons.example/service.svg",
    );
  });

  it("renders favicon and URL references, falling back on load errors", () => {
    const { container, rerender } = render(
      <ServiceIcon
        iconKey="favicon"
        serviceUrl="http://192.168.0.19:3000/some/path"
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "http://192.168.0.19:3000/favicon.ico",
    );

    fireEvent.error(container.querySelector("img")!);
    expect(
      container.querySelector(".ouchi-service-mark--favicon svg"),
    ).toBeInTheDocument();

    rerender(
      <ServiceIcon iconKey="url:https://icons.example/service.svg" />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://icons.example/service.svg",
    );
    fireEvent.error(container.querySelector("img")!);
    expect(
      container.querySelector(".ouchi-service-mark > svg"),
    ).toBeInTheDocument();
  });

  it("uses only bundled assets for remote references in read-only mode", () => {
    const remoteIconData: PortalDataV2 = {
      ...portalData,
      services: [
        service({
          iconKey:
            "url:https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/plex.svg",
        }),
      ],
    };
    const { container } = render(
      <OuchiPortal data={remoteIconData} readOnly showTitle={false} />,
    );

    expect(container.querySelector(".ouchi-remote-icon")).toBeNull();
    expect(
      container.querySelector(".ouchi-service-tile .ouchi-service-mark > svg"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "管理" }),
    ).not.toBeInTheDocument();
  });

  it("omits SSH and meter controls from the device dialog and places category under hostname", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(
      screen.getByRole("button", { name: "nanopi-r2sを編集" }),
    );
    const dialog = screen.getByRole("dialog", { name: "デバイスを編集" });

    expect(within(dialog).queryByText("SSH接続情報")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("textbox", { name: "SSHユーザー" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText(/メモリ|ディスク|使用率|SSHリソース収集/),
    ).not.toBeInTheDocument();

    const hostnameInput = within(dialog).getByRole("textbox", {
      name: "ホスト名",
    });
    const categorySelect = within(dialog).getByRole("combobox", {
      name: "デバイスカテゴリー",
    });
    expect(
      hostnameInput.compareDocumentPosition(categorySelect) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const membershipHeading = within(dialog).getByText("インターフェース");
    expect(
      categorySelect.compareDocumentPosition(membershipHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("loads every device property in the memo dialog and sends the complete map on save", async () => {
    const user = userEvent.setup();
    const propertyData: PortalDataV2 = {
      ...portalData,
      devices: portalData.devices.map((device) =>
        device.id === "2"
          ? {
              ...device,
              properties: {
                vault_path: "sops/devices/nanopi",
                note: "HDD SMART怪しい",
              },
            }
          : device,
      ),
    };
    const fetchMock = vi.fn(
      (input: string | URL | Request, _init?: RequestInit) =>
        String(input).endsWith("/api/portal")
          ? jsonResponse(apiData)
          : jsonResponse({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal data={propertyData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(
      screen.getByRole("button", { name: "nanopi-r2sのメモ" }),
    );
    const dialog = screen.getByRole("dialog", { name: "nanopi-r2sのメモ" });
    expect(
      within(dialog).getByRole("textbox", { name: "プロパティキー 1" }),
    ).toHaveValue("vault_path");
    expect(
      within(dialog).getByRole("textbox", { name: "プロパティ値 1" }),
    ).toHaveValue("sops/devices/nanopi");
    expect(
      within(dialog).getByText(
        /平文の秘密情報は入力しないこと。必要な場合は SOPS などで暗号化した文字列を入れること/,
      ),
    ).toBeVisible();

    await user.click(
      within(dialog).getByRole("button", { name: "プロパティを追加" }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "プロパティキー 3" }),
      "maintenance_owner",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "プロパティ値 3" }),
      "kyle",
    );
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith("/api/devices/2") &&
          init?.method === "PUT",
      );
      expect(updateCall).toBeDefined();
      expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
        properties: {
          vault_path: "sops/devices/nanopi",
          note: "HDD SMART怪しい",
          maintenance_owner: "kyle",
        },
      });
    });
  });

  it("loads every service property in the memo dialog and sends the complete map on save", async () => {
    const user = userEvent.setup();
    const propertyData: PortalDataV2 = {
      ...portalData,
      services: portalData.services.map((item) =>
        item.id === "1"
          ? {
              ...item,
              properties: {
                sops_key: "services/gitea",
                ai_note: "共有Git",
              },
            }
          : item,
      ),
    };
    const fetchMock = vi.fn(
      (input: string | URL | Request, _init?: RequestInit) =>
        String(input).endsWith("/api/portal")
          ? jsonResponse(apiData)
          : jsonResponse({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal data={propertyData} />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /サービス/ }));
    await user.click(
      screen.getByRole("button", { name: "おうちGitのメモ" }),
    );
    const dialog = screen.getByRole("dialog", { name: "おうちGitのメモ" });
    expect(
      within(dialog).getByRole("textbox", { name: "プロパティキー 1" }),
    ).toHaveValue("sops_key");
    expect(
      within(dialog).getByRole("textbox", { name: "プロパティ値 2" }),
    ).toHaveValue("共有Git");
    await user.click(
      within(dialog).getByRole("button", { name: "プロパティ 1を削除" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "プロパティを追加" }),
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "プロパティキー 2" }),
      "owner",
    );
    await user.type(
      within(dialog).getByRole("textbox", { name: "プロパティ値 2" }),
      "kyle",
    );
    await user.click(within(dialog).getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input).endsWith("/api/services/1") &&
          init?.method === "PUT",
      );
      expect(updateCall).toBeDefined();
      expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
        properties: {
          ai_note: "共有Git",
          owner: "kyle",
        },
      });
    });
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
            accent: "#4ba755",
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
          projectId: 1,
          name: "ゲストWi-Fi",
          cidr: null,
          accent: "#4ba755",
          note: null,
          properties: {},
          sortOrder: 40,
        });
      }
        return jsonResponse(next);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal />);
    await screen.findByText("nanopi-r2s");

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(
      screen.getByRole("button", { name: "ネットワークを追加" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "ネットワーク名" }),
      "ゲストWi-Fi",
    );
    const accentInput = screen.getByRole("textbox", {
      name: "ネットワークのアクセント色コード",
    });
    await user.clear(accentInput);
    await user.type(accentInput, "#4ba755");
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
      accent: "#4ba755",
      note: null,
      projectId: 1,
    });
  });

  it("blocks deleting a network with memberships before calling the API", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal data={portalData} />);
    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(
      screen.getByRole("button", { name: "おうちLANを削除" }),
    );
    expect(screen.getByText(/インターフェースが3件登録されています/)).toBeVisible();
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

  it("starts with the project side menu collapsed by default", () => {
    window.localStorage.clear();
    const { container } = render(
      <OuchiPortal
        data={{
          ...portalData,
          projects: [
            {
              id: "1",
              name: "自宅",
              title: "自宅のおうち",
              color: "#b3543f",
              properties: {},
            },
          ],
        }}
      />,
    );
    expect(
      container.querySelector(".ouchi-project-sidebar.is-collapsed"),
    ).not.toBeNull();
    expect(screen.queryByText("自宅")).not.toBeInTheDocument();
  });

  it("switches the whole board when another project is picked in the side menu", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const twoProjects: PortalDataV2 = {
      ...portalData,
      projects: [
        {
          id: "1",
          name: "自宅",
          title: "自宅のおうち",
          color: "#b3543f",
          properties: {},
        },
        {
          id: "2",
          name: "実家",
          title: "実家のおうち",
          color: "#3f6fb5",
          properties: {},
        },
      ],
      networks: [
        {
          id: "1",
          projectId: "1",
          name: "自宅LAN",
          cidr: "192.168.0.0/24",
          accent: "blue",
          sortOrder: 10,
        },
        {
          id: "2",
          projectId: "2",
          name: "実家LAN",
          cidr: "192.168.1.0/24",
          accent: "green",
          sortOrder: 10,
        },
      ],
      devices: [
        {
          id: "1",
          projectId: "1",
          name: "home-box",
          category: "physical",
          meterEnabled: false,
        },
        {
          id: "2",
          projectId: "2",
          name: "jikka-box",
          category: "physical",
          meterEnabled: false,
        },
      ],
      interfaces: [
        {
          id: "10",
          projectId: "1",
          deviceId: "1",
          name: "eth0",
          networkId: "1",
          ip: "192.168.0.2",
        },
        {
          id: "11",
          projectId: "2",
          deviceId: "2",
          name: "eth0",
          networkId: "2",
          ip: "192.168.1.2",
        },
      ],
      relationNames: [],
      relations: [],
      services: [],
    };
    render(<OuchiPortal data={twoProjects} />);
    expect(screen.getByText("自宅LAN")).toBeVisible();
    expect(screen.queryByText("実家LAN")).not.toBeInTheDocument();

    // The side menu always starts collapsed; open it to pick a row.
    await user.click(
      screen.getByRole("button", { name: "サイドメニューを開く" }),
    );
    await user.click(screen.getByText("実家"));

    expect(screen.getByText("実家LAN")).toBeVisible();
    expect(screen.queryByText("自宅LAN")).not.toBeInTheDocument();
  });

  it("deletes a project from the side menu after a confirmation", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const remaining = structuredClone(apiData);
    const twoProjects = structuredClone(apiData);
    twoProjects.projects.push({
      id: 2,
      name: "実家",
      title: "実家のおうち",
      color: "#3f6fb5",
      properties: {},
    });
    let deleted = false;
    const fetchMock = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/projects/2") && init?.method === "DELETE") {
          deleted = true;
          return jsonResponse({ ok: true });
        }
        return jsonResponse(deleted ? remaining : twoProjects);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<OuchiPortal />);

    // The side menu always starts collapsed; open it to reach the row.
    await user.click(
      await screen.findByRole("button", { name: "サイドメニューを開く" }),
    );
    expect(await screen.findByText("実家")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "実家のメニュー" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "削除" }));
    expect(
      screen.getByText(/中のネットワーク・デバイス・サービス・関係もすべて削除されます/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => {
      expect(deleted).toBe(true);
      expect(screen.queryByText("実家")).not.toBeInTheDocument();
    });
  });

  it("shows a blank pane inviting a new project when no projects exist", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    render(
      <OuchiPortal
        data={{
          ...portalData,
          projects: [],
          networks: [],
          devices: [],
          interfaces: [],
          relationNames: [],
          relations: [],
          services: [],
        }}
      />,
    );
    expect(
      screen.getByText("プロジェクトを追加してください"),
    ).toBeVisible();
    // The side menu always starts collapsed; open it for the labeled
    // add button.
    await user.click(
      screen.getByRole("button", { name: "サイドメニューを開く" }),
    );
    expect(
      screen.getByRole("button", { name: "＋ プロジェクトを追加" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "管理" }),
    ).not.toBeInTheDocument();
  });

  it("shows the getting-started tutorial while the project is empty", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const emptyProject: PortalDataV2 = {
      ...portalData,
      projects: [
        {
          id: "1",
          name: "プロジェクト2",
          title: "あなたのホームラボ",
          color: "#79c059",
          properties: {},
        },
      ],
      networks: [],
      devices: [],
      interfaces: [],
      services: [],
      relationNames: [],
      relations: [],
    };
    render(<OuchiPortal data={emptyProject} />);

    expect(screen.getByText("さぁ、はじめよう！")).toBeVisible();
    expect(screen.getByText("自分で描く")).toBeVisible();
    expect(
      screen.getByText("まずはネットワークを作りましょう。"),
    ).toBeVisible();
    expect(screen.getByText("AIに描いてもらう")).toBeVisible();
    // The MCP settings are always visible, no toggle.
    expect(screen.getByText("http://localhost:3333/mcp")).toBeVisible();
    expect(screen.getByText(/"mcpServers"/)).toBeVisible();

    // The add button opens the management screen (networks tab).
    await user.click(
      screen.getByRole("button", { name: "ネットワークを追加" }),
    );
    expect(
      await screen.findByRole("tab", { name: /ネットワーク/ }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("has no detectable structural accessibility violations", async () => {
    const { container } = render(<OuchiPortal data={portalData} />);
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
