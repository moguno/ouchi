import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OuchiPortal } from "../src/portal";

describe("OuchiPortal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("renders the Internet network and the network hierarchy", () => {
    render(<OuchiPortal />);

    expect(
      screen.getByRole("heading", { name: "ポータル" }),
    ).toBeInTheDocument();
    expect(screen.getByText("インターネット")).toBeInTheDocument();
    expect(screen.getByText("おうちLAN")).toBeInTheDocument();
    expect(screen.getByText("nanopi-r2s")).toBeInTheDocument();
    expect(screen.getByText("gitea")).toBeInTheDocument();
    expect(screen.getByText("デバイス未登録")).toBeInTheDocument();
    expect(screen.getAllByText("VM").length).toBeGreaterThan(0);
    expect(screen.getByText("192.168.0.21")).toBeInTheDocument();
  });

  it("switches between icon and list views", async () => {
    const user = userEvent.setup();
    const { container } = render(<OuchiPortal />);

    expect(container.querySelector(".ouchi-network-stack")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "リスト" }));
    expect(container.querySelector(".ouchi-list-stack")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "リスト" }),
    ).toHaveAttribute("aria-pressed", "true");
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

  it("blocks deleting a network that still has devices", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(
      screen.getByRole("button", { name: "おうちLANを削除" }),
    );

    expect(
      screen.getByText(
        "デバイスが3件登録されています。先にデバイスを削除または移動してください。",
      ),
    ).toBeInTheDocument();
  });

  it("adds a device to the Internet network without CIDR validation", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="internet-node.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "デバイス名" }),
      "public",
    );
    await user.type(
      screen.getByRole("textbox", { name: "IPv4アドレス" }),
      "203.0.113.10",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "所属ネットワーク" }),
      "internet",
    );
    await user.click(screen.getByRole("button", { name: "追加する" }));

    expect(window.localStorage.getItem("internet-node.portal")).toContain(
      "203.0.113.10",
    );
  });

  it("adds a device with the VM flag", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="vm-crud.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /デバイス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "デバイス名" }),
      "web",
    );
    await user.type(
      screen.getByRole("textbox", { name: "IPv4アドレス" }),
      "192.168.0.30",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "所属ネットワーク" }),
      "home-lan",
    );
    await user.click(screen.getByRole("checkbox", { name: /VMとして登録/ }));
    await user.click(screen.getByRole("button", { name: "追加する" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("vm-crud.portal") ?? "{}",
    );
    expect(persisted.devices).toContainEqual(
      expect.objectContaining({
        name: "web",
        ip: "192.168.0.30",
        networkId: "home-lan",
        isVm: true,
      }),
    );
  });

  it("places a service on a VM", async () => {
    const user = userEvent.setup();
    render(<OuchiPortal storageKey="vm-service.portal" />);

    await user.click(screen.getByRole("button", { name: "管理" }));
    await user.click(screen.getByRole("tab", { name: /サービス/ }));
    await user.click(screen.getByRole("button", { name: "追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "サービス名" }),
      "vm-service",
    );
    await user.type(screen.getByRole("textbox", { name: "補足名" }), "VM上");
    await user.type(
      screen.getByRole("textbox", { name: "URL" }),
      "http://192.168.0.21:9000",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "配置先" }),
      "omv-vm",
    );
    await user.click(screen.getByRole("button", { name: "追加する" }));

    const persisted = JSON.parse(
      window.localStorage.getItem("vm-service.portal") ?? "{}",
    );
    expect(persisted.services).toContainEqual(
      expect.objectContaining({
        name: "vm-service",
        deviceId: "omv-vm",
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
    await user.type(
      screen.getByRole("textbox", { name: "補足名" }),
      "可視化",
    );
    await user.type(
      screen.getByRole("textbox", { name: "URL" }),
      "https://grafana.example.com",
    );
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
