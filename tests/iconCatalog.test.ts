import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ICON_INDEX,
  dashboardIconReference,
  dashboardIconCount,
  iconReferenceId,
  iconReferenceKind,
  iconReferenceLabel,
  isIconReference,
  normalizeIconReference,
  normalizeServiceIconReference,
  searchBuiltInIcons,
  searchDashboardIcons,
} from "../src/portal/iconCatalog";

describe("icon catalog", () => {
  it("bundles an offline dashboard-icons index with slug and display name", () => {
    expect(dashboardIconCount()).toBeGreaterThanOrEqual(200);
    expect(DASHBOARD_ICON_INDEX.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "grafana", name: "Grafana" }),
        expect.objectContaining({ slug: "plex", name: "Plex" }),
      ]),
    );
  });

  it("searches the bundled dashboard index without network access", () => {
    expect(searchDashboardIcons("grafana")).toEqual([
      expect.objectContaining({ slug: "grafana", name: "Grafana" }),
    ]);
    expect(searchDashboardIcons("home assistant")).toEqual([
      expect.objectContaining({
        slug: "home-assistant",
        name: "Home Assistant",
      }),
    ]);
    expect(searchDashboardIcons("does-not-exist")).toEqual([]);
  });

  it("filters all bundled generic icons in one group", () => {
    expect(searchBuiltInIcons("メール")).toEqual([
      expect.objectContaining({
        reference: "generic:mail",
        kind: "generic",
      }),
    ]);
    expect(searchBuiltInIcons("proxmox")).toEqual([
      expect.objectContaining({
        reference: "generic:proxmox",
        kind: "generic",
      }),
    ]);
  });

  it("keeps all legacy preset keys in the generic catalog", () => {
    const options = searchBuiltInIcons("");
    for (const key of [
      "gitea",
      "gatus",
      "proxmox",
      "omv",
      "server",
      "database",
      "monitor",
      "container",
      "globe",
    ]) {
      expect(normalizeIconReference(key)).toBe(`generic:${key}`);
      expect(options).toContainEqual(
        expect.objectContaining({
          reference: `generic:${key}`,
          kind: "generic",
        }),
      );
    }
  });

  it("normalizes generic, favicon, URL, and legacy references", () => {
    expect(normalizeIconReference("gitea")).toBe("generic:gitea");
    expect(normalizeIconReference("preset:gitea")).toBe("generic:gitea");
    expect(normalizeIconReference("generic:mail")).toBe("generic:mail");
    expect(normalizeIconReference("favicon")).toBe("favicon");
    expect(
      normalizeIconReference("url:https://example.com/icon.svg"),
    ).toBe("url:https://example.com/icon.svg");
    expect(normalizeIconReference("dashboard:Plex")).toBe(
      dashboardIconReference("plex"),
    );
    expect(iconReferenceKind("dashboard:plex")).toBe("url");
    expect(iconReferenceLabel("dashboard:plex")).toBe("Plex");
    expect(iconReferenceKind("favicon")).toBe("favicon");
    expect(iconReferenceId("url:https://example.com/icon.svg")).toBe(
      "https://example.com/icon.svg",
    );
    expect(normalizeIconReference("not-valid")).toBe(
      "generic:applications",
    );
    expect(isIconReference("favicon")).toBe(true);
    expect(isIconReference("url:https://example.com/a:b.svg")).toBe(true);
    expect(isIconReference("url:not-a-url")).toBe(false);
  });

  it("uses a legacy faviconUrl only when no icon reference exists", () => {
    expect(
      normalizeServiceIconReference(
        null,
        "https://service.example/icon.png",
        "generic:applications",
      ),
    ).toBe("url:https://service.example/icon.png");
    expect(
      normalizeServiceIconReference(
        "generic:mail",
        "https://service.example/icon.png",
        "generic:applications",
      ),
    ).toBe("generic:mail");
  });
});
