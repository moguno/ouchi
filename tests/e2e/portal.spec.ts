import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 1100 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "tablet-768", width: 768, height: 1000 },
  { name: "mobile-390", width: 390, height: 1100 },
  { name: "mobile-320", width: 320, height: 1200 },
];

for (const viewport of viewports) {
  test(`portal layout at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "ouchi.local" }),
    ).toBeVisible();
    await expect(
      page.locator(".demo-portal-subtitle"),
    ).toHaveText(
      /^(これがあなたのホームラボです|AIと創る、おうちネットワーク)$/,
    );
    await expect(
      page.getByText(
        "ネットワークとデバイスを整理し、日々使うサービスへすぐ移動できるポータルです。",
        { exact: true },
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "ouchi.local",
      }),
    ).toHaveCount(0);
    await expect(page.locator(".ouchi-device-card--selected")).toHaveCount(0);
    await expect(page.locator(".ouchi-device-card--related")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `成果物/screenshots/portal-${viewport.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("portal subtitle alternates on each page load", async ({ page }) => {
  await page.goto("/");
  const subtitle = page.locator(".demo-portal-subtitle");
  const first = await subtitle.textContent();
  await page.reload();
  const second = await subtitle.textContent();

  expect([
    "これがあなたのホームラボです",
    "AIと創る、おうちネットワーク",
  ]).toContain(first);
  expect([
    "これがあなたのホームラボです",
    "AIと創る、おうちネットワーク",
  ]).toContain(second);
  expect(second).not.toBe(first);
});

test("user-defined portal title can be changed and persisted", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "あなたのホームラボ",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "管理" }).click();
  await page
    .getByRole("textbox", { name: "ポータルタイトル" })
    .fill("我が家のネットワーク");
  await page.getByRole("button", { name: "タイトルを保存" }).click();
  await page.getByRole("button", { name: "管理画面を閉じる" }).click();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "我が家のネットワーク",
    }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "我が家のネットワーク",
    }),
  ).toBeVisible();
});

test("management drawer renders without overlap", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "管理" }).click();
  await expect(
    page.getByRole("dialog", { name: "ポータルを管理" }),
  ).toBeVisible();
  await page.screenshot({
    path: "成果物/screenshots/portal-management.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("list view keeps the network hierarchy readable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "リスト表示" }).click();
  await expect(page.getByText("192.168.0.0/24")).toBeVisible();
  const networks = page.locator(".ouchi-list-network");
  await expect(networks.first()).toContainText("おうちLAN");
  await expect(networks.last()).toContainText("インターネット");
  await page.screenshot({
    path: "成果物/screenshots/portal-list.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("service form is usable from the management drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("tab", { name: /サービス/ }).click();
  await page.getByRole("button", { name: "追加" }).click();
  await expect(
    page.getByRole("dialog", { name: "サービスを追加" }),
  ).toBeVisible();
  await page.screenshot({
    path: "成果物/screenshots/portal-service-form.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("device management exposes network addresses and SSH settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("tab", { name: /デバイス/ }).click();
  const drawer = page.getByRole("dialog", { name: "ポータルを管理" });
  await expect(drawer.getByText("VM", { exact: true }).first()).toBeVisible();
  await drawer
    .getByRole("button", { name: "FortiGate 50Eを編集" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "デバイスを編集" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "所属ネットワーク 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "所属を追加" }),
  ).toBeVisible();
  await page.screenshot({
    path: "成果物/screenshots/portal-device-vm-management.png",
    fullPage: false,
    animations: "disabled",
  });
});

test("connects duplicate device displays with a same-device line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  await page.getByRole("button", { name: "管理" }).click();
  await page.getByRole("tab", { name: /デバイス/ }).click();
  await page
    .getByRole("button", { name: "FortiGate 50Eを編集" })
    .click();
  await page.getByRole("button", { name: "所属を追加" }).click();
  await page
    .getByRole("combobox", { name: "所属ネットワーク 2" })
    .selectOption("internet");
  await page
    .getByRole("textbox", { name: "IPアドレス 2" })
    .fill("203.0.113.10");
  await page
    .getByRole("textbox", { name: "表示ラベル 2" })
    .fill("WAN");
  await page
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await page.getByRole("button", { name: "管理画面を閉じる" }).click();

  const deviceButtons = page.getByRole("button", {
    name: "FortiGate 50Eを選択",
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
  await page
    .locator(
      ".ouchi-relation-connector--same-device .ouchi-relation-hit-area",
    )
    .hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "同一デバイス: FortiGate 50E",
  );
  await page.screenshot({
    path: "成果物/screenshots/portal-same-device-line.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("relation highlight is visible on the portal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "openmediavaultを選択" })
    .click();
  await expect(
    page.getByText("親ホスト", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ouchi-relation-connector")).toHaveCount(1);
  const relationHitArea = page.locator(
    ".ouchi-relation-connector--relation .ouchi-relation-hit-area",
  );
  const hoverPoint = await relationHitArea.evaluate((path) => {
    const svgPath = path as SVGPathElement;
    const localPoint = svgPath.getPointAtLength(
      svgPath.getTotalLength() / 2,
    );
    const svgPoint = svgPath.ownerSVGElement!.createSVGPoint();
    svgPoint.x = localPoint.x;
    svgPoint.y = localPoint.y;
    const screenPoint = svgPoint.matrixTransform(
      svgPath.getScreenCTM()!,
    );
    return { x: screenPoint.x, y: screenPoint.y };
  });
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(page.getByRole("tooltip")).toContainText(
    "openmediavault [VM] ↔ [親ホスト] ACEMAGIC",
  );
  await page.screenshot({
    path: "成果物/screenshots/portal-relations.png",
    fullPage: true,
    animations: "disabled",
  });
});
