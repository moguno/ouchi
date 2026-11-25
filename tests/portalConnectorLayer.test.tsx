import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PortalConnectorLayer,
  type RelationConnector,
} from "../src/portal/PortalConnectorLayer";

const handlers = {
  onPointerEnter: vi.fn(),
  onPointerLeave: vi.fn(),
  onPointerMove: vi.fn(),
};

function connector(overrides: Partial<RelationConnector>): RelationConnector {
  return {
    id: "r1-0-0",
    kind: "relation",
    color: "#d63a2f",
    tooltip: "PoE",
    startLabel: "PSE",
    endLabel: "PD",
    d: "M 0 0 L 100 0",
    startX: 0,
    startY: 0,
    endX: 100,
    endY: 0,
    startSide: "right",
    endSide: "left",
    ...overrides,
  };
}

describe("PortalConnectorLayer endpoint labels", () => {
  it("shows endpoint labels permanently for always-mode connectors", () => {
    render(
      <PortalConnectorLayer
        connectors={[connector({ always: true })]}
        handlers={handlers}
      />,
    );
    expect(screen.getByText("PSE")).toBeInTheDocument();
    expect(screen.getByText("PD")).toBeInTheDocument();
  });

  it("keeps endpoint labels hover-only for selected-mode connectors", () => {
    render(
      <PortalConnectorLayer
        connectors={[connector({})]}
        handlers={handlers}
      />,
    );
    expect(screen.queryByText("PSE")).not.toBeInTheDocument();
    expect(screen.queryByText("PD")).not.toBeInTheDocument();
  });

  it("shows endpoint labels while the connector's device is selected", () => {
    render(
      <PortalConnectorLayer
        connectors={[connector({ selected: true })]}
        handlers={handlers}
      />,
    );
    expect(screen.getByText("PSE")).toBeInTheDocument();
    expect(screen.getByText("PD")).toBeInTheDocument();
  });
});
