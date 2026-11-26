import { describe, expect, it } from "vitest";
import {
  cardsShareHorizontalLine,
  connectorAnchors,
  routeConnectorLinks,
  type ConnectorNode,
  type ConnectorRect,
} from "../src/portal/connectors";

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): ConnectorRect => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
});

const node = (id: string, rectValue: ConnectorRect): ConnectorNode => ({
  id,
  rect: rectValue,
});

describe("connectorAnchors", () => {
  it("uses top and bottom points when the other card is above", () => {
    const from = rect(100, 200, 200, 100);
    const to = rect(400, 20, 200, 100);

    expect(cardsShareHorizontalLine(from, to)).toBe(false);
    expect(connectorAnchors(from, to)).toEqual({
      startX: 200,
      startY: 212,
      endX: 500,
      endY: 108,
      d: "M 200 212 L 500 108",
    });
  });

  it("uses bottom and top points when the other card is below", () => {
    const from = rect(100, 20, 200, 100);
    const to = rect(400, 200, 200, 100);

    expect(cardsShareHorizontalLine(from, to)).toBe(false);
    expect(connectorAnchors(from, to)).toEqual({
      startX: 200,
      startY: 108,
      endX: 500,
      endY: 212,
      d: "M 200 108 L 500 212",
    });
  });

  it("uses facing side points when the vertical ranges overlap", () => {
    const from = rect(100, 20, 200, 100);
    const to = rect(400, 40, 200, 100);

    expect(cardsShareHorizontalLine(from, to)).toBe(true);
    expect(connectorAnchors(from, to)).toEqual({
      startX: 287,
      startY: 70,
      endX: 413,
      endY: 90,
      d: "M 287 70 L 413 90",
    });
  });

  it("uses facing side points when the other card is on the left", () => {
    const from = rect(400, 20, 200, 100);
    const to = rect(100, 40, 200, 100);

    expect(cardsShareHorizontalLine(from, to)).toBe(true);
    expect(connectorAnchors(from, to)).toEqual({
      startX: 413,
      startY: 70,
      endX: 287,
      endY: 90,
      d: "M 413 70 L 287 90",
    });
  });

  it("does not treat touching vertical edges as the same line", () => {
    const from = rect(100, 20, 200, 100);
    const to = rect(400, 120, 200, 100);

    expect(cardsShareHorizontalLine(from, to)).toBe(false);
    expect(connectorAnchors(from, to)).toMatchObject({
      startX: 200,
      startY: 108,
      endX: 500,
      endY: 132,
    });
  });
});

describe("routeConnectorLinks edge distribution", () => {
  it("keeps a single link on the center of each selected edge", () => {
    const from = node("from", rect(100, 20, 200, 100));
    const to = node("to", rect(100, 200, 200, 100));

    expect(
      routeConnectorLinks([{ id: "link", from, to }]),
    ).toEqual([
      {
        id: "link",
        startSide: "bottom",
        endSide: "top",
        startX: 200,
        startY: 108,
        endX: 200,
        endY: 212,
        d: "M 200 108 L 200 212",
      },
    ]);
  });

  it("places two points at one-third and two-thirds in opponent X order", () => {
    const from = node("from", rect(100, 20, 300, 100));
    const left = node("left", rect(200, 300, 100, 100));
    const right = node("right", rect(500, 300, 100, 100));

    const byId = new Map(
      routeConnectorLinks([
        { id: "right-link", from, to: right },
        { id: "left-link", from, to: left },
      ]).map((link) => [link.id, link]),
    );

    expect(byId.get("left-link")).toMatchObject({
      startX: expect.closeTo(204.33, 1),
      startY: 108,
      endX: 250,
      endY: 312,
    });
    expect(byId.get("right-link")).toMatchObject({
      startX: expect.closeTo(295.67, 1),
      startY: 108,
      endX: 550,
      endY: 312,
    });
  });

  it("places three points at quarters in opponent X order", () => {
    const from = node("from", rect(100, 20, 300, 100));
    const opponents = [
      node("middle", rect(200, 300, 100, 100)),
      node("right", rect(550, 300, 100, 100)),
      node("left", rect(20, 300, 100, 100)),
    ];

    const routed = routeConnectorLinks(
      opponents.map((opponent, index) => ({
        id: `link-${index}`,
        from,
        to: opponent,
      })),
    );

    expect(
      routed.map((link) => ({
        id: link.id,
        startX: link.startX,
        endX: link.endX,
      })),
    ).toEqual([
      { id: "link-0", startX: 250, endX: 250 },
      { id: "link-1", startX: 318.5, endX: 600 },
      { id: "link-2", startX: 181.5, endX: 70 },
    ]);
  });

  it("assigns vertical edge points from top to bottom in opponent Y order", () => {
    const from = node("from", rect(500, 20, 200, 300));
    const opponents = [
      node("bottom", rect(100, 250, 100, 100)),
      node("top", rect(100, 50, 100, 100)),
      node("middle", rect(100, 150, 100, 100)),
    ];

    const byId = new Map(
      routeConnectorLinks(
        opponents.map((opponent, index) => ({
          id: `link-${index}`,
          from,
          to: opponent,
        })),
      ).map((link) => [link.id, link]),
    );

    expect(byId.get("link-1")).toMatchObject({
      startSide: "left",
      startX: 513,
      startY: 101,
      endX: 187,
      endY: 100,
    });
    expect(byId.get("link-2")).toMatchObject({
      startSide: "left",
      startX: 513,
      startY: 170,
      endX: 187,
      endY: 200,
    });
    expect(byId.get("link-0")).toMatchObject({
      startSide: "left",
      startX: 513,
      startY: 239,
      endX: 187,
      endY: 300,
    });
  });
});

