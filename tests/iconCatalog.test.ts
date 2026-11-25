import { describe, expect, it } from "vitest";
import {
  iconReferenceId,
  iconReferenceKind,
  iconReferenceLabel,
  isIconReference,
  isLegacyGenericIconReference,
  normalizeServiceIconReference,
  parseIconReference,
  tryNormalizeIconReference,
} from "../src/portal/iconCatalog";

const DASHBOARD_CDN =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg";

describe("icon catalog", () => {
  it("accepts exactly favicon and URL references", () => {
    expect(tryNormalizeIconReference("favicon")).toBe("favicon");
    expect(tryNormalizeIconReference("https://example.com/icon.svg")).toBe(
      "url:https://example.com/icon.svg",
    );
    expect(
      tryNormalizeIconReference("url:https://example.com/icon.svg"),
    ).toBe("url:https://example.com/icon.svg");
    expect(isIconReference("favicon")).toBe(true);
    expect(isIconReference("url:https://example.com/a:b.svg")).toBe(true);
    expect(isIconReference("url:not-a-url")).toBe(false);
    expect(isIconReference(null)).toBe(false);
    expect(isIconReference("not-valid")).toBe(false);
  });

  it("converts legacy dashboard references to their CDN image URL", () => {
    expect(tryNormalizeIconReference("dashboard:Plex")).toBe(
      `url:${DASHBOARD_CDN}/plex.svg`,
    );
    expect(normalizeServiceIconReference("dashboard:grafana")).toBe(
      `url:${DASHBOARD_CDN}/grafana.svg`,
    );
    expect(iconReferenceKind("dashboard:plex")).toBe("url");
  });

  it("retires generic and preset references to unset", () => {
    for (const legacy of [
      "generic:mail",
      "generic:gitea",
      "preset:gitea",
      "gitea",
      "globe",
    ]) {
      expect(isLegacyGenericIconReference(legacy)).toBe(true);
      expect(tryNormalizeIconReference(legacy)).toBeUndefined();
      expect(isIconReference(legacy)).toBe(false);
      expect(normalizeServiceIconReference(legacy)).toBeNull();
      expect(iconReferenceKind(legacy)).toBe("unset");
    }
    expect(isLegacyGenericIconReference("favicon")).toBe(false);
    expect(isLegacyGenericIconReference("url:https://example.com/x.svg")).toBe(
      false,
    );
    expect(isLegacyGenericIconReference(null)).toBe(false);
  });

  it("parses kinds, ids, and labels for the three choices", () => {
    expect(parseIconReference(null)).toEqual({
      kind: "unset",
      id: "",
      reference: null,
    });
    expect(parseIconReference("favicon")).toEqual({
      kind: "favicon",
      id: "",
      reference: "favicon",
    });
    expect(parseIconReference("url:https://example.com/icon.svg")).toEqual({
      kind: "url",
      id: "https://example.com/icon.svg",
      reference: "url:https://example.com/icon.svg",
    });
    expect(iconReferenceId("url:https://example.com/icon.svg")).toBe(
      "https://example.com/icon.svg",
    );
    expect(iconReferenceId("favicon")).toBe("");
    expect(iconReferenceId(null)).toBe("");
    expect(iconReferenceLabel("favicon")).toBe("favicon");
    expect(iconReferenceLabel("url:https://example.com/icon.svg")).toBe(
      "URLアイコン",
    );
    expect(iconReferenceLabel(null)).toBe("未設定");
    expect(iconReferenceLabel("generic:mail")).toBe("未設定");
  });

  it("uses a legacy faviconUrl only when no icon reference exists", () => {
    expect(
      normalizeServiceIconReference(
        undefined,
        "https://service.example/icon.png",
      ),
    ).toBe("url:https://service.example/icon.png");
    // An explicit unset wins over the legacy URL.
    expect(
      normalizeServiceIconReference(null, "https://service.example/icon.png"),
    ).toBeNull();
    // A retired generic reference becomes unset, not the legacy URL.
    expect(
      normalizeServiceIconReference(
        "generic:mail",
        "https://service.example/icon.png",
      ),
    ).toBeNull();
    // A valid reference wins over the legacy URL.
    expect(
      normalizeServiceIconReference(
        "favicon",
        "https://service.example/icon.png",
      ),
    ).toBe("favicon");
  });

  it("falls back only for absent or unknown values", () => {
    expect(normalizeServiceIconReference(undefined)).toBeNull();
    expect(normalizeServiceIconReference("not-valid")).toBeNull();
    expect(normalizeServiceIconReference(undefined, undefined, "favicon")).toBe(
      "favicon",
    );
    expect(normalizeServiceIconReference(null, undefined, "favicon")).toBeNull();
  });
});
