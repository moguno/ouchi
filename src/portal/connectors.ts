export interface ConnectorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export type ConnectorSide = "top" | "right" | "bottom" | "left";

/**
 * Card anchors retreat from the card border to the inner edge of the
 * card's padding (the content edge). The device card's padding is
 * 12px vertical / 13px horizontal, so a line between adjacent cards
 * spans padding + gap + padding instead of the gap alone and stays
 * visible. Side selection and opponent ordering keep using the real
 * card rect; only the anchor placement uses the inset rect.
 */
export const CARD_ANCHOR_INSET_X = 13;
export const CARD_ANCHOR_INSET_Y = 12;

export function insetConnectorRect(rect: ConnectorRect): ConnectorRect {
  return {
    left: rect.left + CARD_ANCHOR_INSET_X,
    right: rect.right - CARD_ANCHOR_INSET_X,
    top: rect.top + CARD_ANCHOR_INSET_Y,
    bottom: rect.bottom - CARD_ANCHOR_INSET_Y,
    width: rect.width - CARD_ANCHOR_INSET_X * 2,
    height: rect.height - CARD_ANCHOR_INSET_Y * 2,
  };
}

/**
 * Service-tile anchors sit this far OUTSIDE the tile's icon frame, so
 * the endpoint mark floats just off the icon instead of touching it.
 * Expanding the rect before the edge intersection moves the anchor
 * out along the line by exactly this amount.
 */
export const TILE_ANCHOR_GAP = 8;

export function expandConnectorRect(
  rect: ConnectorRect,
  gap: number,
): ConnectorRect {
  return {
    left: rect.left - gap,
    right: rect.right + gap,
    top: rect.top - gap,
    bottom: rect.bottom + gap,
    width: rect.width + gap * 2,
    height: rect.height + gap * 2,
  };
}

export interface ConnectorNode {
  id: string;
  rect: ConnectorRect;
}

export interface ConnectorLink {
  id: string;
  from: ConnectorNode;
  to: ConnectorNode;
}

export interface ConnectorGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  d: string;
}

export interface RoutedConnectorGeometry extends ConnectorGeometry {
  id: string;
  startSide: ConnectorSide;
  endSide: ConnectorSide;
}

interface ConnectorEndpointPlan {
  link: ConnectorLink;
  side: ConnectorSide;
  node: ConnectorNode;
  opponent: ConnectorNode;
  coordinate?: number;
}

/**
 * Cards share a horizontal line when their vertical ranges overlap. A zero
 * overlap (touching edges) remains an above/below relationship.
 */
export function cardsShareHorizontalLine(
  from: ConnectorRect,
  to: ConnectorRect,
): boolean {
  return Math.min(from.bottom, to.bottom) > Math.max(from.top, to.top);
}

export function connectorSides(
  from: ConnectorRect,
  to: ConnectorRect,
): { startSide: ConnectorSide; endSide: ConnectorSide } {
  const fromCenterX = from.left + from.width / 2;
  const fromCenterY = from.top + from.height / 2;
  const toCenterX = to.left + to.width / 2;
  const toCenterY = to.top + to.height / 2;

  if (cardsShareHorizontalLine(from, to)) {
    return toCenterX >= fromCenterX
      ? { startSide: "right", endSide: "left" }
      : { startSide: "left", endSide: "right" };
  }

  return toCenterY < fromCenterY
    ? { startSide: "top", endSide: "bottom" }
    : { startSide: "bottom", endSide: "top" };
}

/**
 * Returns the i-th point on an edge divided into (count + 1) equal segments.
 * count=1 therefore keeps the established center point.
 */
export function connectorEdgeCoordinate(
  rect: ConnectorRect,
  side: ConnectorSide,
  index: number,
  count: number,
): number {
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(count) ||
    index < 0 ||
    count < 1 ||
    index >= count
  ) {
    throw new RangeError("Invalid connector point index or count");
  }

  const ratio = (index + 1) / (count + 1);
  return side === "top" || side === "bottom"
    ? rect.left + rect.width * ratio
    : rect.top + rect.height * ratio;
}

function endpointCoordinates(
  rect: ConnectorRect,
  side: ConnectorSide,
  coordinate: number,
): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: coordinate, y: rect.top };
    case "right":
      return { x: rect.right, y: coordinate };
    case "bottom":
      return { x: coordinate, y: rect.bottom };
    case "left":
      return { x: rect.left, y: coordinate };
  }
}

function nodeCenter(node: ConnectorNode): { x: number; y: number } {
  return {
    x: node.rect.left + node.rect.width / 2,
    y: node.rect.top + node.rect.height / 2,
  };
}

function planComparator(
  horizontalSide: boolean,
): (left: ConnectorEndpointPlan, right: ConnectorEndpointPlan) => number {
  return (left, right) => {
    const leftCenter = nodeCenter(left.opponent);
    const rightCenter = nodeCenter(right.opponent);
    const primary = horizontalSide
      ? leftCenter.x - rightCenter.x
      : leftCenter.y - rightCenter.y;
    if (primary !== 0) {
      return primary;
    }
    const secondary = horizontalSide
      ? leftCenter.y - rightCenter.y
      : leftCenter.x - rightCenter.x;
    return (
      secondary ||
      left.opponent.id.localeCompare(right.opponent.id) ||
      left.link.id.localeCompare(right.link.id)
    );
  };
}

/**
 * Routes every link after grouping endpoints by their owning card and edge.
 * This keeps each card independent and assigns edge points in opponent order.
 */
export function routeConnectorLinks(
  links: readonly ConnectorLink[],
): RoutedConnectorGeometry[] {
  const started: ConnectorEndpointPlan[] = [];
  const ended: ConnectorEndpointPlan[] = [];
  const groups = new Map<string, Map<ConnectorSide, ConnectorEndpointPlan[]>>();

  const addToGroup = (plan: ConnectorEndpointPlan) => {
    let nodeGroups = groups.get(plan.node.id);
    if (!nodeGroups) {
      nodeGroups = new Map();
      groups.set(plan.node.id, nodeGroups);
    }
    const plans = nodeGroups.get(plan.side) ?? [];
    plans.push(plan);
    nodeGroups.set(plan.side, plans);
  };

  for (const link of links) {
    const { startSide, endSide } = connectorSides(
      link.from.rect,
      link.to.rect,
    );
    const startPlan: ConnectorEndpointPlan = {
      link,
      side: startSide,
      node: link.from,
      opponent: link.to,
    };
    const endPlan: ConnectorEndpointPlan = {
      link,
      side: endSide,
      node: link.to,
      opponent: link.from,
    };
    started.push(startPlan);
    ended.push(endPlan);
    addToGroup(startPlan);
    addToGroup(endPlan);
  }

  for (const nodeGroups of groups.values()) {
    for (const [side, plans] of nodeGroups) {
      plans.sort(planComparator(side === "top" || side === "bottom"));
      plans.forEach((plan, index) => {
        plan.coordinate = connectorEdgeCoordinate(
          insetConnectorRect(plan.node.rect),
          side,
          index,
          plans.length,
        );
      });
    }
  }

  return links.map((link, index) => {
    const startPlan = started[index];
    const endPlan = ended[index];
    const start = endpointCoordinates(
      insetConnectorRect(link.from.rect),
      startPlan.side,
      startPlan.coordinate as number,
    );
    const end = endpointCoordinates(
      insetConnectorRect(link.to.rect),
      endPlan.side,
      endPlan.coordinate as number,
    );
    return {
      id: link.id,
      startSide: startPlan.side,
      endSide: endPlan.side,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    };
  });
}

export interface ConnectorPoint {
  x: number;
  y: number;
  side: ConnectorSide;
}

/**
 * The point where the ray from a rect's centre toward a target point
 * crosses the rect's edge. Service-tile endpoints anchor this way: the
 * line between two tile centres lands exactly on each icon's frame.
 */
export function rectEdgeIntersection(
  rect: ConnectorRect,
  toward: { x: number; y: number },
): ConnectorPoint {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = toward.x - centerX;
  const dy = toward.y - centerY;
  if (dx === 0 && dy === 0) {
    return { x: centerX, y: rect.top, side: "top" };
  }
  const scaleX =
    dx !== 0 ? rect.width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const scaleY =
    dy !== 0 ? rect.height / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);
  const side: ConnectorSide =
    scaleX < scaleY
      ? dx > 0
        ? "right"
        : "left"
      : dy > 0
        ? "bottom"
        : "top";
  return { x: centerX + dx * scale, y: centerY + dy * scale, side };
}

export function connectorAnchors(
  from: ConnectorRect,
  to: ConnectorRect,
): ConnectorGeometry {
  const { startSide, endSide } = connectorSides(from, to);
  const insetFrom = insetConnectorRect(from);
  const insetTo = insetConnectorRect(to);
  const start = endpointCoordinates(
    insetFrom,
    startSide,
    connectorEdgeCoordinate(insetFrom, startSide, 0, 1),
  );
  const end = endpointCoordinates(
    insetTo,
    endSide,
    connectorEdgeCoordinate(insetTo, endSide, 0, 1),
  );
  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
  };
}
