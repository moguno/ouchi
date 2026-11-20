import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OuchiPortal,
  portalDemoData,
} from "../src/portal";
import { EntityDialog } from "../src/portal/EntityDialog";

describe("OuchiPortal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("renders the current home network and service inventory", () => {
    const { container } = render(<OuchiPortal />);

    expect(
      screen.getByRole("heading", { name: "ouchi.local" }),
    ).toBeInTheDocument();
    expect(screen.getByText("インターネット")).toBeInTheDocument();
    expect(screen.getByText("おうちLAN")).toBeInTheDocument();
    expect(screen.getByText("FortiGate 50E")).toBeInTheDocument();
    expect(screen.getByText("NanoPi R2S")).toBeInTheDocument();
    expect(screen.getByText("OCI-Shiro")).toBeInTheDocument();
    expect(screen.getByText("Gitea")).toBeInTheDocument();
    expect(screen.getAllByText("openmediavault").length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll(".ouchi-node-card"),
    ).toHaveLength(11);
    expect(screen.queryByText("CPU")).not.toBeInTheDocument();

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
  });

  it("switches between icon and list views", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal />);

    expect(container.querySelector(".ouchi-network-stack")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "リスト表示" }),
    );
    expect(container.querySelector(".ouchi-list-stack")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "リスト表示" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("highlights all appearances of the selected device by device ID", async () => {
    const user = userEvent.setup();
    const duplicateData = structuredClone(portalDemoData);
    duplicateData.networks.push({
      id: "test-overlay",
      name: "テストオーバーレイ",
      cidr: "10.250.0.0/24",
      accent: "green",
    });
    duplicateData.deviceNetworks.push({
      id: "fortigate-overlay",
      deviceId: "fortigate",
      networkId: "test-overlay",
      ip: "10.250.0.1",
      label: "Overlay",
    });
    const { container } = render(
      <OuchiPortal data={duplicateData} storageKey="duplicate.portal" />,
    );

    const fortigateButtons = screen.getAllByRole("button", {
      name: "FortiGate 50Eを選択",
    });
    expect(fortigateButtons).toHaveLength(2);
    expect(
      container.querySelectorAll(".ouchi-same-device-badge"),
    ).toHaveLength(0);
    await user.click(fortigateButtons[0]);

    const cards = container.querySelectorAll('[data-device-id="fortigate"]');
    expect(cards).toHaveLength(2);
    cards.forEach((card) => {
      expect(card).toHaveClass("ouchi-device-card--selected");
    });
    expect(
      container.querySelectorAll(".ouchi-same-device-badge"),
    ).toHaveLength(2);
  });

  it("selects from the device area but keeps service links separate", () => {
    const { container } = render(<OuchiPortal />);
    const card = container.querySelector(
      '[data-device-id="nanopi-r2s"]',
    );
    expect(card).not.toBeNull();

    fireEvent.click(card as HTMLElement);
    expect(card).toHaveClass("ouchi-device-card--selected");

    const serviceLink = card?.querySelector(".ouchi-service-tile");
    expect(serviceLink).not.toBeNull();
    serviceLink?.addEventListener("click", (event) => {
      event.preventDefault();
    });
    fireEvent.click(serviceLink as Element);

    expect(card).toHaveClass("ouchi-device-card--selected");
  });

  it("clears the selected device when clicking outside a node", () => {
    const { container } = render(<OuchiPortal />);
    const card = container.querySelector(
      '[data-device-id="nanopi-r2s"]',
    );
    fireEvent.click(card as HTMLElement);
    expect(card).toHaveClass("ouchi-device-card--selected");

    const canvas = container.querySelector(".ouchi-canvas");
    fireEvent.click(canvas as HTMLElement);

    expect(card).not.toHaveClass("ouchi-device-card--selected");

    fireEvent.click(card as HTMLElement);
    expect(card).toHaveClass("ouchi-device-card--selected");

    fireEvent.pointerDown(document.body);
    expect(card).not.toHaveClass("ouchi-device-card--selected");
  });

  it("highlights a generic relation separately from same-device selection", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal />);

    await user.click(
      screen.getByRole("button", { name: "openmediavaultを選択" }),
    );

    const omv = container.querySelector('[data-device-id="omv-vm"]');
    const aceMagic = container.querySelector('[data-device-id="acemagic"]');
    expect(omv).toHaveClass("ouchi-device-card--selected");
    expect(aceMagic).toHaveClass("ouchi-device-card--related");
    expect(screen.getByText("親ホスト")).toBeInTheDocument();
    expect(screen.queryByText("選択中")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "ACEMAGICを選択" }),
    );
    expect(omv?.querySelector(".ouchi-relation-badge")).toHaveTextContent(
      "VM",
    );
    expect(screen.queryByText("親ホスト")).not.toBeInTheDocument();
  });

  it("renders a service only under its assigned device IP", () => {
    render(<OuchiPortal />);

    const internet = screen.getByRole("article", {
      name: "インターネット",
    });
    const homeLan = screen.getByRole("article", { name: "おうちLAN" });
    expect(within(internet).getByText("デバイス未登録")).toBeInTheDocument();
    expect(
      within(homeLan).getByText("FortiGate 管理"),
    ).toBeInTheDocument();
    expect(within(homeLan).getByText("Gitea")).toBeInTheDocument();
    expect(within(internet).queryByText("Gitea")).not.toBeInTheDocument();
  });

  it("adds and persists a network without a CIDR", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="test.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("button", { name: /追加/ }));
    await user.type(
      screen.getByRole("textbox", { name: "ネットワーク名" }),
      "ゲストWi-Fi",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "アクセント色" }),
      "green",
    );
    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(screen.getAllByText("ゲストWi-Fi").length).toBeGreaterThan(0);
    expect(window.localStorage.getItem("test.portal")).toContain("ゲストWi-Fi");
  });

  it("blocks deleting a network that still has device addresses", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(
      screen.getByRole("button", { name: "おうちLANを削除" }),
    );

    expect(
      screen.getByText(
        "所属IPが9件登録されています。先にデバイスを編集してください。",
      ),
    ).toBeInTheDocument();
  });

  it("adds a device and its first network address", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="device-crud.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "デバイス名" }),
      "web",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "所属ネットワーク 1" }),
      "home-lan",
    );
    await user.type(
      screen.getByRole("textbox", { name: "IPアドレス 1" }),
      "192.168.0.30",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "デバイスカテゴリー" }),
      "vm",
    );
    await user.click(screen.getByRole("button", { name: "追加する" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("device-crud.portal") ?? "{}",
    );
    expect(persisted.devices).toContainEqual(
      expect.objectContaining({
        name: "web",
        category: "vm",
        isVm: true,
      }),
    );
    expect(persisted.deviceNetworks).toContainEqual(
      expect.objectContaining({
        networkId: "home-lan",
        ip: "192.168.0.30",
      }),
    );
  });

  it("adds multiple network addresses to one device", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="multi-network.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "デバイス名" }),
      "edge",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "所属ネットワーク 1" }),
      "home-lan",
    );
    await user.type(
      screen.getByRole("textbox", { name: "IPアドレス 1" }),
      "192.168.0.40",
    );
    await user.click(screen.getByRole("button", { name: "所属を追加" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "所属ネットワーク 2" }),
      "oci-network",
    );
    await user.type(
      screen.getByRole("textbox", { name: "IPアドレス 2" }),
      "192.168.253.40",
    );
    await user.click(screen.getByRole("button", { name: "追加する" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("multi-network.portal") ?? "{}",
    );
    const device = persisted.devices.find(
      (item: { name: string }) => item.name === "edge",
    );
    expect(
      persisted.deviceNetworks.filter(
        (item: { deviceId: string }) => item.deviceId === device.id,
      ),
    ).toHaveLength(2);
  });

  it("keeps services when adding another network to an existing device", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="same-device.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(
      screen.getByRole("button", { name: "FortiGate 50Eを編集" }),
    );
    await user.click(screen.getByRole("button", { name: "所属を追加" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "所属ネットワーク 2" }),
      "internet",
    );
    await user.type(
      screen.getByRole("textbox", { name: "IPアドレス 2" }),
      "203.0.113.10",
    );
    await user.type(
      screen.getByRole("textbox", { name: "表示ラベル 2" }),
      "WAN",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("same-device.portal") ?? "{}",
    );
    expect(persisted.services).toHaveLength(10);
    expect(persisted.services).toContainEqual(
      expect.objectContaining({ id: "fortigate-management" }),
    );
    expect(persisted.services).toContainEqual(
      expect.objectContaining({ id: "gitea" }),
    );
    expect(persisted.services).toContainEqual(
      expect.objectContaining({ id: "omv" }),
    );
  });

  it("does not refocus the first field when the dialog parent rerenders", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <EntityDialog
        data={portalDemoData}
        editingId="fortigate"
        kind="device"
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );
    act(() => {
      vi.runOnlyPendingTimers();
    });

    const ipField = screen.getByRole("textbox", {
      name: "IPアドレス 1",
    });
    ipField.focus();
    expect(ipField).toHaveFocus();

    rerender(
      <EntityDialog
        data={portalDemoData}
        editingId="fortigate"
        kind="device"
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(ipField).toHaveFocus();
  });

  it("adds a service to a specific device IP", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="service-target.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /サービス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "サービス名" }),
      "vm-service",
    );
    await user.type(screen.getByRole("textbox", { name: "補足名" }), "VM上");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "配置先のデバイスIP" }),
      "omv-home",
    );
    await user.clear(screen.getByRole("textbox", { name: "ポート" }));
    await user.type(screen.getByRole("textbox", { name: "ポート" }), "9000");
    await user.click(screen.getByRole("button", { name: "追加する" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("service-target.portal") ?? "{}",
    );
    expect(persisted.services).toContainEqual(
      expect.objectContaining({
        name: "vm-service",
        deviceNetworkId: "omv-home",
        port: 9000,
        scheme: "http",
        topPath: "/",
        monitorPath: "/",
      }),
    );
  });

  it("adds, edits, and deletes a service", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="service-crud.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /サービス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "サービス名" }),
      "grafana",
    );
    await user.type(screen.getByRole("textbox", { name: "補足名" }), "可視化");
    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(screen.getAllByText("grafana").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "grafanaを編集" }),
    );
    const serviceName = screen.getByRole("textbox", { name: "サービス名" });
    await user.clear(serviceName);
    await user.type(serviceName, "grafana-ui");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getAllByText("grafana-ui").length).toBeGreaterThan(0);
    await user.click(
      screen.getByRole("button", { name: "grafana-uiを削除" }),
    );
    await user.click(screen.getByRole("button", { name: "削除する" }));

    expect(window.localStorage.getItem("service-crud.portal")).not.toContain(
      "grafana-ui",
    );
  });

  it("edits free-tag relations from a device", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="relation-crud.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(
      screen.getByRole("button", { name: "openmediavaultを編集" }),
    );
    await user.click(screen.getByRole("button", { name: "関係を追加" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "関係先 2" }),
      "nanopi-r2s",
    );
    await user.type(
      screen.getByRole("textbox", { name: "from側ラベル 2" }),
      "バックアップ元",
    );
    await user.type(
      screen.getByRole("textbox", { name: "to側ラベル 2" }),
      "バックアップ先",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("relation-crud.portal") ?? "{}",
    );
    expect(persisted.relations).toContainEqual(
      expect.objectContaining({
        fromDeviceId: "omv-vm",
        toDeviceId: "nanopi-r2s",
        fromLabel: "バックアップ元",
        toLabel: "バックアップ先",
      }),
    );
  });

  it("restores seed data when persisted data is invalid", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("invalid.portal", "{not-json");
    render(<OuchiPortal storageKey="invalid.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    const drawer = screen.getByRole("dialog", { name: "ポータルを管理" });
    expect(
      within(drawer).getByText(/保存データを読み込めなかったため/),
    ).toBeInTheDocument();
  });

  it("updates one service status on the mock interval", () => {
    vi.useFakeTimers();
    render(<OuchiPortal storageKey="timer.portal" />);

    const before = window.localStorage.getItem("timer.portal");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    const after = window.localStorage.getItem("timer.portal");

    expect(after).not.toBe(before);
    const parsedBefore = JSON.parse(before ?? "{}");
    const parsedAfter = JSON.parse(after ?? "{}");
    const changedServices = parsedAfter.services.filter(
      (service: { id: string; status: string }, index: number) =>
        service.status !== parsedBefore.services[index].status,
    );
    expect(changedServices).toHaveLength(1);
  });

  it("has no detectable structural accessibility violations", async () => {
    const { container } = render(<OuchiPortal />);
    const result = await axe.run(container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });

    expect(result.violations).toEqual([]);
  });
});
