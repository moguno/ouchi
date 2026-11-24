import { describe, expect, it } from "vitest";
import { deviceVisual } from "../src/portal/portalPresentation";
import type { PortalRelation } from "../src/portal/types";

function relation(partial: Partial<PortalRelation>): PortalRelation {
  return {
    id: "1",
    relationNameId: "1",
    relationName: "PoE",
    color: "red",
    fromDeviceId: "10",
    toDeviceId: "20",
    fromInterfaceId: "100",
    toInterfaceId: "200",
    fromLabel: "PSE",
    toLabel: "PD",
    ...partial,
  } as PortalRelation;
}

describe("deviceVisual endpoint tags", () => {
  // Device 10 is selected; device 20 has two interfaces (200, 201) and
  // one relation each. A card must show only its own interface's tag.
  const relations = [
    relation({ id: "1", toInterfaceId: "200", toLabel: "PD" }),
    relation({
      id: "2",
      toInterfaceId: "201",
      toLabel: "PD2",
      relationName: "L2",
      color: "green",
    }),
  ];

  it("shows every tag when no interface is given", () => {
    const visual = deviceVisual("20", "10", relations);
    expect(visual.mode).toBe("related");
    expect(visual.tags.map((tag) => tag.label)).toEqual(["PD", "PD2"]);
  });

  it("filters tags to the card's interface", () => {
    expect(
      deviceVisual("20", "10", relations, "200").tags.map((t) => t.label),
    ).toEqual(["PD"]);
    expect(
      deviceVisual("20", "10", relations, "201").tags.map((t) => t.label),
    ).toEqual(["PD2"]);
  });

  it("keeps the related highlight even when the card has no tag", () => {
    const visual = deviceVisual("20", "10", relations, "999");
    expect(visual.mode).toBe("related");
    expect(visual.tags).toEqual([]);
  });
});
