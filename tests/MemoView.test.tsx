import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoView } from "../src/portal/MemoView";
import type { PortalDataV2 } from "../src/portal/types";

const data: PortalDataV2 = {
  version: 2,
  networks: [{ id: "n1", name: "データ基盤", accent: "#b0483e" }],
  devices: [
    {
      id: "d1",
      name: "basalt-db",
      petname: "DB1",
      category: "physical",
      properties: { 役割: "プライマリ", バックアップ: "毎日 03:00" },
    },
    {
      id: "d2",
      name: "onyx-db",
      petname: "DB2",
      category: "physical",
      properties: {},
    },
  ],
  interfaces: [
    { id: "i1", deviceId: "d1", name: "eth0", networkId: "n1", ip: "198.18.1.11" },
    { id: "i2", deviceId: "d2", name: "eth0", networkId: "n1", ip: "198.18.1.12" },
  ],
  relationNames: [
    {
      id: "rn1",
      name: "レプリケーション",
      color: "#c2185b",
      lineStart: "none",
      lineEnd: "arrow",
      relationCount: 1,
    },
  ],
  relations: [
    {
      id: "r1",
      relationNameId: "rn1",
      relationName: "レプリケーション",
      fromDeviceId: "d1",
      toDeviceId: "d2",
      fromInterfaceId: "i1",
      toInterfaceId: "i2",
      fromServiceId: null,
      toServiceId: null,
      fromLabel: "プライマリ",
      toLabel: "レプリカ",
      port: null,
      protocol: null,
      properties: { 方式: "ストリーミング" },
      color: "#c2185b",
      lineStart: "none",
      lineEnd: "arrow",
    },
  ],
  services: [
    {
      id: "s1",
      interfaceId: "i1",
      subdomain: "pgadmin",
      petname: "pgAdmin",
      properties: { 使い方: "参照専用" },
      scheme: "http",
      port: 5050,
      protocol: "tcp",
      topPath: "/",
      monitorPath: "",
      iconKey: "favicon",
      enabled: true,
      url: "http://198.18.1.11:5050",
    },
  ],
  settings: { domain: "ouchi.local", title: "テスト" },
};

function treeItem(container: HTMLElement, title: string): HTMLElement {
  const el = [...container.querySelectorAll(".ouchi-memo-iname")].find(
    (n) => n.textContent === title,
  );
  if (!el) throw new Error(`tree item not found: ${title}`);
  return el.closest(".ouchi-memo-item") as HTMLElement;
}

function keyItem(container: HTMLElement, key: string): HTMLElement {
  const el = [...container.querySelectorAll(".ouchi-memo-key-name")].find(
    (n) => n.textContent === key,
  );
  if (!el) throw new Error(`key not found: ${key}`);
  return el.closest(".ouchi-memo-key") as HTMLElement;
}

function renderView(saveDisabled = false) {
  const onSaveMemo = vi.fn(async () => true);
  const onBack = vi.fn();
  const utils = render(
    <MemoView
      data={data}
      onBack={onBack}
      onSaveMemo={onSaveMemo}
      saveDisabled={saveDisabled}
    />,
  );
  return { ...utils, onSaveMemo, onBack };
}

describe("MemoView", () => {
  it("ツリーはメモのある対象だけを既定で出し、件数バッジを付ける", () => {
    const { container } = renderView();
    expect(treeItem(container, "DB1")).toBeTruthy();
    expect(
      [...container.querySelectorAll(".ouchi-memo-iname")].map(
        (n) => n.textContent,
      ),
    ).not.toContain("DB2");
    fireEvent.click(screen.getByLabelText(/メモがあるものだけ/));
    expect(treeItem(container, "DB2")).toBeTruthy();
  });

  it("既定で最初のメモ対象とキーを選び、値をテキストボックスに出す", () => {
    const { container } = renderView();
    expect(keyItem(container, "役割")).toBeTruthy();
    expect(keyItem(container, "バックアップ")).toBeTruthy();
    expect(
      (screen.getByLabelText("役割の値") as HTMLTextAreaElement).value,
    ).toBe("プライマリ");
    fireEvent.click(keyItem(container, "バックアップ"));
    expect(
      (screen.getByLabelText("バックアップの値") as HTMLTextAreaElement)
        .value,
    ).toBe("毎日 03:00");
  });

  it("値を編集して保存すると properties 全体で onSaveMemo を呼ぶ", async () => {
    const { onSaveMemo } = renderView();
    const textarea = screen.getByLabelText(
      "役割の値",
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "プライマリ（更新）" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(onSaveMemo).toHaveBeenCalledWith("device", "d1", {
        役割: "プライマリ（更新）",
        バックアップ: "毎日 03:00",
      }),
    );
    expect(await screen.findByText("保存しました")).toBeTruthy();
  });

  it("関係のメモもツリーから選んで保存できる", async () => {
    const { container, onSaveMemo } = renderView();
    fireEvent.click(treeItem(container, "DB1 → DB2"));
    const textarea = screen.getByLabelText(
      "方式の値",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("ストリーミング");
    fireEvent.change(textarea, { target: { value: "同期" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(onSaveMemo).toHaveBeenCalledWith("relation", "r1", {
        方式: "同期",
      }),
    );
  });

  it("ouchi とネットワークのメモもツリーから選んで保存できる", async () => {
    const extended: PortalDataV2 = {
      ...data,
      networks: [
        {
          id: "n1",
          name: "データ基盤",
          accent: "#b0483e",
          properties: { 方針: "DB専用" },
        },
      ],
      settings: {
        domain: "ouchi.local",
        title: "テスト",
        properties: { 運用: "週次バックアップ" },
      },
    };
    const onSaveMemo = vi.fn(async () => true);
    const { container } = render(
      <MemoView data={extended} onBack={vi.fn()} onSaveMemo={onSaveMemo} />,
    );

    fireEvent.click(treeItem(container, "データ基盤"));
    expect(keyItem(container, "方針")).toBeTruthy();
    const networkValue = screen.getByLabelText(
      "方針の値",
    ) as HTMLTextAreaElement;
    fireEvent.change(networkValue, { target: { value: "DB専用・冗長化" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(onSaveMemo).toHaveBeenCalledWith("network", "n1", {
        方針: "DB専用・冗長化",
      }),
    );

    fireEvent.click(treeItem(container, "テスト"));
    expect(keyItem(container, "運用")).toBeTruthy();
    const globalValue = screen.getByLabelText(
      "運用の値",
    ) as HTMLTextAreaElement;
    fireEvent.change(globalValue, { target: { value: "月次バックアップ" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(onSaveMemo).toHaveBeenCalledWith("global", "global", {
        運用: "月次バックアップ",
      }),
    );
  });

  it("キーを追加すると空の値で保存し、選んだ状態になる", async () => {
    const { container, onSaveMemo, rerender } = renderView();
    fireEvent.click(container.querySelector(".ouchi-memo-keyadd")!);
    fireEvent.change(screen.getByLabelText("新しいキー"), {
      target: { value: "連絡先" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() =>
      expect(onSaveMemo).toHaveBeenCalledWith("device", "d1", {
        役割: "プライマリ",
        バックアップ: "毎日 03:00",
        連絡先: "",
      }),
    );
    // 親が保存後のデータで再描画すると、新しいキーが選ばれた状態で出る
    const updated: PortalDataV2 = {
      ...data,
      devices: data.devices.map((d) =>
        d.id === "d1"
          ? {
              ...d,
              properties: {
                役割: "プライマリ",
                バックアップ: "毎日 03:00",
                連絡先: "",
              },
            }
          : d,
      ),
    };
    rerender(
      <MemoView data={updated} onBack={vi.fn()} onSaveMemo={onSaveMemo} />,
    );
    expect(keyItem(container, "連絡先")).toBeTruthy();
    expect(
      (screen.getByLabelText("連絡先の値") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("キーの削除は確認を挟んで保存する", async () => {
    const { onSaveMemo } = renderView();
    fireEvent.click(screen.getByRole("button", { name: "このキーを削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() =>
      expect(onSaveMemo).toHaveBeenCalledWith("device", "d1", {
        バックアップ: "毎日 03:00",
      }),
    );
  });

  it("検索はキーと値でも絞り込める", () => {
    const { container } = renderView();
    fireEvent.change(screen.getByLabelText("メモを検索"), {
      target: { value: "ストリーミング" },
    });
    const titles = [...container.querySelectorAll(".ouchi-memo-iname")].map(
      (n) => n.textContent,
    );
    expect(titles).toEqual(["DB1 → DB2"]);
  });

  it("saveDisabled ではテキストボックスが読み取り専用で保存ボタンがない", () => {
    renderView(true);
    const textarea = screen.getByLabelText(
      "役割の値",
    ) as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    expect(screen.getByText(/デモモードでは保存されません/)).toBeTruthy();
  });
});
