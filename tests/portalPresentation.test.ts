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

describe("deviceVisual", () => {
  const relations = [
    relation({ id: "1" }),
    relation({ id: "2", relationName: "L2", color: "green" }),
  ];

  it("marks devices related to the selection with the first relation color", () => {
    const visual = deviceVisual("20", "10", relations);
    expect(visual.mode).toBe("related");
    expect(visual.color).toBe("red");
  });

  it("marks the selected device itself and unrelated devices", () => {
    expect(deviceVisual("10", "10", relations).mode).toBe("selected");
    expect(deviceVisual("30", "10", relations).mode).toBe("neutral");
    expect(deviceVisual("20", undefined, relations).mode).toBe("neutral");
  });
});
