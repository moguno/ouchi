import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 1100 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "tablet-768", width: 768, height: 1000 },
  { name: "mobile-390", width: 390, height: 1100 },
  { name: "mobile-320", width: 320, height: 1200 },
];

async function openPortal(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByText("門番", { exact: true })).toBeVisible();
}

for (const viewport of viewports) {
  test(`portal layout at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await openPortal(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "ouchi.local" }),
    ).toBeVisible();
    await expect(page.locator(".demo-portal-subtitle")).toHaveText(
      "AIと創る、おうちネットワーク",
    );
    await expect(page.getByText("おうちGit", { exact: true })).toBeVisible();
    await expect(page.getByText("Notion", { exact: true })).toBeVisible();
    await expect(page.getByText("pCloud", { exact: true })).toBeVisible();
    await expect(page.locator(".ouchi-service-status")).toHaveCount(0);
    await expect(page.locator(".ouchi-status-legend")).toHaveCount(0);
    await expect(page.locator(".ouchi-relation-legend")).toHaveCount(0);
    await expect(page.locator(".ouchi-portal-footer")).toHaveCount(0);
    await expect(page.locator(".ouchi-status-dot")).toHaveCount(0);
    await expect(page.locator(".ouchi-resource-meters")).toHaveCount(0);
    await expect(page.locator(".ouchi-resource-meter")).toHaveCount(0);
    await expect(page.getByText("未取得", { exact: true })).toHaveCount(0);
    await expect(page.locator(".ouchi-device-card--selected")).toHaveCount(0);
    await expect(page.locator(".ouchi-device-card--related")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);

    await page.screenshot({
      path: `test-results/portal-v1-${viewport.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("API data survives localStorage removal", async ({ page }) => {
  await openPortal(page);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByText("門番", { exact: true })).toBeVisible();
  await expect(page.getByText("おうちGit", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => window.localStorage.length),
  ).toBe(0);
});

test("management edit is persisted through the REST API", async ({ page }) => {
  await openPortal(page);
  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("button", { name: "ネットワークを追加" }).click();
  await page
    .getByRole("textbox", { name: "ネットワーク名" })
    .fill("E2Eネットワーク");
  await page.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByText("E2Eネットワーク").first()).toBeVisible();
  await page.getByRole("button", { name: "ポータルに戻る" }).click();
  await expect(
    page.getByRole("article", { name: "E2Eネットワーク" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("article", { name: "E2Eネットワーク" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "管理" }).click();
  await page
    .getByRole("button", { name: "E2Eネットワークを削除" })
    .click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByText("E2Eネットワーク")).toHaveCount(0);
});

test("portal title is persisted through the REST API", async ({ page }) => {
  await openPortal(page);
  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("tab", { name: "共通設定" }).click();
  const titleInput = page.getByRole("textbox", {
    name: "ポータルタイトル",
  });
  await titleInput.fill("E2Eポータル");
  await page.getByRole("button", { name: "タイトルを保存" }).click();
  await page.getByRole("button", { name: "ポータルに戻る" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "E2Eポータル" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 2, name: "E2Eポータル" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("tab", { name: "共通設定" }).click();
  await page
    .getByRole("textbox", { name: "ポータルタイトル" })
    .fill("あなたのホームラボ");
  await page.getByRole("button", { name: "タイトルを保存" }).click();
  await page.getByRole("button", { name: "ポータルに戻る" }).click();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "あなたのホームラボ",
    }),
  ).toBeVisible();
});

test("full-screen management and service form expose v1 fields", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPortal(page);
  await page.getByRole("button", { name: "管理" }).click();
  const view = page.getByRole("region", { name: "ポータルを管理" });
  await expect(view.getByText("SQLite台帳（API）へ保存")).toBeVisible();
  await expect(view.getByText(/localStorage/)).toHaveCount(0);

  await page.getByRole("tab", { name: /サービス/ }).click();
  await page.getByRole("button", { name: "サービスを追加" }).click();
  const dialog = page.getByRole("dialog", { name: "サービスを追加" });
  await expect(
    dialog.getByRole("textbox", { name: "サブドメイン" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "プロトコル" }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/状態プロバイダ|稼働状態/),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("combobox", { name: "初期状態" }),
  ).toHaveCount(0);

  await page.screenshot({
    path: "test-results/portal-v1-service-form.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("device management keeps SSH metadata without meter controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPortal(page);
  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("tab", { name: /デバイス/ }).click();
  await page.getByRole("button", { name: "関所を編集" }).click();
  const dialog = page.getByRole("dialog", { name: "デバイスを編集" });
  await expect(
    dialog.getByRole("textbox", { name: "名前" }),
  ).toHaveValue("関所");
  await expect(
    dialog.getByRole("combobox", { name: "所属ネットワーク 2" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "IPアドレス 2" }),
  ).toHaveValue("");
  await expect(
    dialog.getByText("SSH接続情報", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/メモリ|ディスク|使用率/)).toHaveCount(0);
  await page.screenshot({
    path: "test-results/portal-v1-device-form.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("same-device connector is drawn from seeded memberships", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await openPortal(page);
  const deviceButtons = page.getByRole("button", {
    name: "関所を選択",
  });
  await expect(deviceButtons).toHaveCount(2);
  await deviceButtons.first().click();
  await expect(
    page.locator(".ouchi-relation-connector--same-device"),
  ).toHaveCount(1);
  await expect(page.locator(".ouchi-relation-connectors")).toHaveCSS(
    "z-index",
    "2",
  );
  const sameDeviceLine = page
    .locator(
      ".ouchi-relation-connector--same-device .ouchi-relation-visible",
    )
    .first();
  await expect(sameDeviceLine).toHaveCSS("stroke-width", "2px");
  await expect(sameDeviceLine).toHaveCSS("opacity", "0.62");
  await page.screenshot({
    path: "test-results/portal-v1-same-device-line.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("duplicate 関所 displays draw adjacent-point connectors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  await openPortal(page);
  const homeLan = page
    .locator(".ouchi-network-card")
    .filter({ has: page.getByText("おうちLAN", { exact: true }) });
  const gateButtons = page.getByRole("button", { name: "関所を選択" });
  await expect(gateButtons).toHaveCount(2);
  await homeLan
    .getByRole("button", { name: "関所を選択" })
    .click();

  await expect(
    page.locator(".ouchi-relation-connector--same-device"),
  ).toHaveCount(1);
  await expect(page.locator(".ouchi-relation-card-mask")).toHaveCount(0);
  await expect(
    page.locator(".ouchi-relation-connector--same-device circle"),
  ).toHaveCount(2);
  await expect(
    page.locator(".ouchi-device-card--selected").first(),
  ).toHaveCSS("border-top-width", "3px");

  await expect(page.locator(".ouchi-relation-connectors")).toHaveCSS(
    "z-index",
    "2",
  );

  await page
    .locator(".ouchi-relation-connector--same-device .ouchi-relation-hit-area")
    .first()
    .hover({ force: true });
  await expect(page.getByRole("tooltip")).toHaveText("同一デバイス");
  await expect(page.getByRole("tooltip")).toHaveCSS("z-index", "3");

  await page.screenshot({
    path: "test-results/portal-v1-multi-membership-connectors-after.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("relation labels and connectors use seeded tag fallbacks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await openPortal(page);
  await page
    .getByRole("button", { name: "蔵を選択" })
    .click();
  await expect(page.getByText("ホストOS", { exact: true })).toBeVisible();
  await expect(
    page.getByText("バックアップ先", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ouchi-relation-connector--relation")).toHaveCount(
    2,
  );
  const relationLine = page
    .locator(".ouchi-relation-connector--relation .ouchi-relation-visible")
    .first();
  await expect(relationLine).toHaveCSS("stroke-width", "2.5px");
  await expect(relationLine).toHaveCSS("opacity", "0.82");
  await page.screenshot({
    path: "test-results/portal-v1-relations.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("list view keeps category headings for populated categories only", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await openPortal(page);
  await page.getByRole("button", { name: "リスト表示" }).click();
  const networks = page.locator(".ouchi-list-network");
  await expect(networks.first()).toContainText("おうちLAN");
  await expect(networks.last()).toContainText("インターネット");
  await expect(networks.first()).not.toContainText("登録なし");
  await expect(networks.last()).toContainText("サービス");
  await page.screenshot({
    path: "test-results/portal-v1-list.png",
    fullPage: true,
    animations: "disabled",
  });
});
