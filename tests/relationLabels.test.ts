import { describe, expect, it } from "vitest";
import {
  hasRelationPlaceholder,
  resolveRelationLabel,
} from "../src/portal/relationLabels";

describe("relation label templates", () => {
  it("replaces every placeholder with the edge value", () => {
    expect(resolveRelationLabel("ポート{}", "8", "接続")).toBe("ポート8");
    expect(resolveRelationLabel("{}番→{}番", "8", "接続")).toBe(
      "8番→8番",
    );
  });

  it("renders an empty edge value as a hyphen", () => {
    expect(resolveRelationLabel("ポート{}", "", "接続")).toBe("ポート-");
    expect(resolveRelationLabel("ポート{}", undefined, "接続")).toBe(
      "ポート-",
    );
  });

  it("ignores the value when the template has no placeholder", () => {
    expect(resolveRelationLabel("固定ラベル", "8", "接続")).toBe(
      "固定ラベル",
    );
  });

  it("falls back to the relation name when the template is empty", () => {
    expect(resolveRelationLabel("", "8", "接続")).toBe("接続");
    expect(resolveRelationLabel("   ", "8", "接続")).toBe("接続");
    expect(resolveRelationLabel(undefined, "8", "接続")).toBe("接続");
  });

  it("detects templates that need an input", () => {
    expect(hasRelationPlaceholder("ポート{}")).toBe(true);
    expect(hasRelationPlaceholder("ポート")).toBe(false);
    expect(hasRelationPlaceholder(undefined)).toBe(false);
  });
});
