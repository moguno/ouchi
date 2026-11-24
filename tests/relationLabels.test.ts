import { describe, expect, it } from "vitest";
import { displayRelationLabel } from "../src/portal/relationLabels";

describe("relation labels", () => {
  it("shows the relation's own label as-is", () => {
    expect(displayRelationLabel("ポート8")).toBe("ポート8");
    expect(displayRelationLabel("VM")).toBe("VM");
  });

  it("stays empty when the label is empty (not displayed)", () => {
    expect(displayRelationLabel("")).toBe("");
    expect(displayRelationLabel("   ")).toBe("");
    expect(displayRelationLabel(undefined)).toBe("");
    expect(displayRelationLabel(null)).toBe("");
  });
});
