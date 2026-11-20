import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 1100 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "tablet-768", width: 768, height: 1000 },
  { name: "mobile-390", width: 390, height: 1100 },
];

for (const viewport of viewports) {
  test(`portal layout at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ouchi.local" }),
    ).toBeVisible();
    await page.screenshot({
      path: `成果物/screenshots/portal-${viewport.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

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

test("relation highlight is visible on the portal", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.getByText("親ホスト")).toBeVisible();
  await page.screenshot({
    path: "成果物/screenshots/portal-relations.png",
    fullPage: true,
    animations: "disabled",
  });
});
