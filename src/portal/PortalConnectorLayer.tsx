import "./styles/portal-connectors.css";
import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  expandConnectorRect,
  insetConnectorRect,
  rectEdgeIntersection,
  routeConnectorLinks,
  TILE_ANCHOR_GAP,
  type ConnectorLink,
  type ConnectorNode,
  type ConnectorRect,
  type ConnectorSide,
} from "./connectors";
import type {
  PortalDataV2,
  PortalLineEndpointShape,
} from "./types";
import { relationTooltip } from "./portalPresentation";
import { displayRelationLabel } from "./relationLabels";
import {
  relationDisplayMode,
  type RelationDisplayModes,
} from "./relationDisplay";

export interface RelationConnector {
  id: string;
  kind: "same-device" | "relation";
  color: string;
  tooltip: string;
  /** Drawn because its relation name is in "always" display mode:
   * its endpoint labels stay visible without hovering. */
  always?: boolean;
  /** Drawn because one of its endpoints is the selected device:
   * its endpoint labels stay visible while the selection lasts. */
  selected?: boolean;
  startLabel?: string;
  endLabel?: string;
  startShape?: PortalLineEndpointShape;
  endShape?: PortalLineEndpointShape;
  d: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startSide: ConnectorSide;
  endSide: ConnectorSide;
}

export interface ConnectorTooltip {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface PortalConnectorHandlers {
  onPointerEnter: (
    event: PointerEvent<SVGGElement>,
    connector: RelationConnector,
  ) => void;
  onPointerLeave: () => void;
  onPointerMove: (
    event: PointerEvent<SVGGElement>,
    connector: RelationConnector,
  ) => void;
}

export function usePortalConnectors({
  canvasRef,
  data,
  layoutMode,
  relationModes,
  selectedDeviceId,
  selectedServiceId,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  data: PortalDataV2;
  layoutMode: string;
  relationModes?: RelationDisplayModes;
  selectedDeviceId?: string;
  selectedServiceId?: string;
}) {
  const [relationConnectors, setRelationConnectors] = useState<
    RelationConnector[]
  >([]);
  const [connectorTooltip, setConnectorTooltip] =
    useState<ConnectorTooltip>();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setRelationConnectors([]);
      return;
    }

    let animationFrame = 0;
    const updateConnectors = () => {
      const canvasRect = canvas.getBoundingClientRect();
      if (canvasRect.width === 0 || canvasRect.height === 0) {
        setRelationConnectors([]);
        return;
      }

      const cards = Array.from(
        canvas.querySelectorAll<HTMLElement>("[data-device-id]"),
      ).filter((card) => card.getClientRects().length > 0);
      const localRect = (element: HTMLElement): ConnectorRect => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left - canvasRect.left,
          right: rect.right - canvasRect.left,
          top: rect.top - canvasRect.top,
          bottom: rect.bottom - canvasRect.top,
          width: rect.width,
          height: rect.height,
        };
      };
      const cardNodes = cards.map((card, index) => ({
        id: `card-${index}`,
        rect: localRect(card),
      }));
      const cardsFor = (deviceId: string, interfaceId?: string) =>
        cards
          .map((card, index) => ({ card, node: cardNodes[index] }))
          .filter(
            ({ card }) =>
              card.dataset.deviceId === deviceId &&
              (interfaceId === undefined ||
                card.dataset.interfaceId === interfaceId),
          );

      // Service tiles anchor on their icon frame: map each rendered
      // service to the local rect of its icon wrap.
      const tileRects = new Map<string, ConnectorRect>();
      canvas
        .querySelectorAll<HTMLElement>("[data-service-id]")
        .forEach((tile) => {
          const serviceId = tile.dataset.serviceId;
          if (!serviceId || tileRects.has(serviceId)) {
            return;
          }
          const icon =
            tile.querySelector<HTMLElement>(".ouchi-service-icon-wrap") ??
            tile;
          tileRects.set(serviceId, localRect(icon));
        });

      type ResolvedEndpoint =
        | { kind: "card"; node: ConnectorNode }
        | { kind: "tile"; rect: ConnectorRect };
      const endpointsFor = (
        deviceId: string,
        interfaceId: string | null,
        serviceId: string | null,
      ): ResolvedEndpoint[] => {
        if (serviceId) {
          const tile = tileRects.get(serviceId);
          if (tile) {
            return [{ kind: "tile", rect: tile }];
          }
          return cardsFor(deviceId).map(({ node }) => ({
            kind: "card" as const,
            node,
          }));
        }
        const specific = interfaceId
          ? cardsFor(deviceId, interfaceId)
          : [];
        const targets =
          specific.length > 0 ? specific : cardsFor(deviceId);
        return targets.map(({ node }) => ({ kind: "card" as const, node }));
      };

      const links: ConnectorLink[] = [];
      const directConnectors: RelationConnector[] = [];
      type ConnectorMeta = Pick<
        RelationConnector,
        | "kind"
        | "color"
        | "tooltip"
        | "always"
        | "selected"
        | "startLabel"
        | "endLabel"
        | "startShape"
        | "endShape"
      >;
      const metadata = new Map<string, ConnectorMeta>();
      // Card endpoints anchor on the inner edge of the card's
      // padding, matching the routed card-to-card geometry; tile
      // endpoints anchor TILE_ANCHOR_GAP outside their icon frame.
      const endpointRect = (endpoint: ResolvedEndpoint): ConnectorRect =>
        endpoint.kind === "tile"
          ? expandConnectorRect(endpoint.rect, TILE_ANCHOR_GAP)
          : insetConnectorRect(endpoint.node.rect);
      const addLink = (
        id: string,
        from: ResolvedEndpoint,
        to: ResolvedEndpoint,
        meta: ConnectorMeta,
      ) => {
        if (from.kind === "card" && to.kind === "card") {
          links.push({ id, from: from.node, to: to.node });
          metadata.set(id, meta);
          return;
        }
        const fromRect = endpointRect(from);
        const toRect = endpointRect(to);
        const center = (rect: ConnectorRect) => ({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        const start = rectEdgeIntersection(fromRect, center(toRect));
        const end = rectEdgeIntersection(toRect, center(fromRect));
        directConnectors.push({
          ...meta,
          id,
          d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          startSide: start.side,
          endSide: end.side,
        });
      };
      const selectedCards = selectedDeviceId
        ? cardsFor(selectedDeviceId)
        : [];
      selectedCards.forEach((selectedCard, selectedIndex) => {
        const sameDeviceCard = selectedCards[selectedIndex + 1];
        if (!sameDeviceCard) {
          return;
        }
        const id = `same-device-${selectedIndex}-${selectedIndex + 1}`;
        addLink(
          id,
          { kind: "card", node: selectedCard.node },
          { kind: "card", node: sameDeviceCard.node },
          {
            kind: "same-device",
            color: "#6259d8",
            tooltip: "同一デバイス",
          },
        );
      });

      for (const relation of data.relations) {
        if (
          relationDisplayMode(relationModes, relation.relationName) ===
          "hidden"
        ) {
          continue;
        }
        // A relation with a service endpoint is a tile relation: it
        // is drawn on tile selection (or in always mode), never on
        // device selection.
        if (relation.fromServiceId || relation.toServiceId) {
          continue;
        }
        if (
          relation.fromDeviceId !== selectedDeviceId &&
          relation.toDeviceId !== selectedDeviceId
        ) {
          continue;
        }
        const relatedDeviceId =
          relation.fromDeviceId === selectedDeviceId
            ? relation.toDeviceId
            : relation.fromDeviceId;
        // Connector start points sit on the selected device's card, so map
        // the relation's endpoint labels onto start/end by which side of
        // the relation the selected device is.
        const selectedIsFrom = relation.fromDeviceId === selectedDeviceId;
        // A relation belongs to one endpoint on each side: draw it only
        // between the cards of those interfaces, or on the service tile
        // for a service endpoint. When an endpoint has no card or tile
        // on screen (e.g. its interface has no network), fall back to
        // the device's cards so the relation stays visible.
        const selectedTargets = endpointsFor(
          selectedDeviceId!,
          selectedIsFrom
            ? relation.fromInterfaceId
            : relation.toInterfaceId,
          selectedIsFrom ? relation.fromServiceId : relation.toServiceId,
        );
        const relatedTargets = endpointsFor(
          relatedDeviceId,
          selectedIsFrom
            ? relation.toInterfaceId
            : relation.fromInterfaceId,
          selectedIsFrom ? relation.toServiceId : relation.fromServiceId,
        );
        const startLabel = displayRelationLabel(
          selectedIsFrom ? relation.fromLabel : relation.toLabel,
        );
        const endLabel = displayRelationLabel(
          selectedIsFrom ? relation.toLabel : relation.fromLabel,
        );

        selectedTargets.forEach((selectedEndpoint, selectedIndex) => {
          relatedTargets.forEach((relatedEndpoint, relatedIndex) => {
            const id = `${relation.id}-${selectedIndex}-${relatedIndex}`;
            addLink(id, selectedEndpoint, relatedEndpoint, {
              kind: "relation",
              color: relation.color,
              tooltip: relationTooltip(relation),
              always:
                relationDisplayMode(relationModes, relation.relationName) ===
                "always",
              selected: true,
              startLabel,
              endLabel,
              startShape: selectedIsFrom
                ? relation.lineStart
                : relation.lineEnd,
              endShape: selectedIsFrom
                ? relation.lineEnd
                : relation.lineStart,
            });
          });
        });
      }
      // Tile relations are drawn when one of their endpoint services
      // is the selected tile, oriented from the selected service.
      if (selectedServiceId) {
        for (const relation of data.relations) {
          if (
            relationDisplayMode(relationModes, relation.relationName) ===
            "hidden"
          ) {
            continue;
          }
          const selectedIsFrom =
            relation.fromServiceId === selectedServiceId;
          const selectedIsTo = relation.toServiceId === selectedServiceId;
          if (!selectedIsFrom && !selectedIsTo) {
            continue;
          }
          const selectedTargets = endpointsFor(
            selectedIsFrom ? relation.fromDeviceId : relation.toDeviceId,
            selectedIsFrom
              ? relation.fromInterfaceId
              : relation.toInterfaceId,
            selectedServiceId,
          );
          const relatedTargets = endpointsFor(
            selectedIsFrom ? relation.toDeviceId : relation.fromDeviceId,
            selectedIsFrom
              ? relation.toInterfaceId
              : relation.fromInterfaceId,
            selectedIsFrom ? relation.toServiceId : relation.fromServiceId,
          );
          const startLabel = displayRelationLabel(
            selectedIsFrom ? relation.fromLabel : relation.toLabel,
          );
          const endLabel = displayRelationLabel(
            selectedIsFrom ? relation.toLabel : relation.fromLabel,
          );
          selectedTargets.forEach((selectedEndpoint, selectedIndex) => {
            relatedTargets.forEach((relatedEndpoint, relatedIndex) => {
              const id = `service-${relation.id}-${selectedIndex}-${relatedIndex}`;
              addLink(id, selectedEndpoint, relatedEndpoint, {
                kind: "relation",
                color: relation.color,
                tooltip: relationTooltip(relation),
                always:
                  relationDisplayMode(
                    relationModes,
                    relation.relationName,
                  ) === "always",
                selected: true,
                startLabel,
                endLabel,
                startShape: selectedIsFrom
                  ? relation.lineStart
                  : relation.lineEnd,
                endShape: selectedIsFrom
                  ? relation.lineEnd
                  : relation.lineStart,
              });
            });
          });
        }
      }
      // Relations whose display mode is "always" are drawn even with
      // no selection (and for endpoints the selection does not touch),
      // oriented from the relation's start to its end as stored.
      // Always mode is a guard: it applies to tile relations too,
      // regardless of the current selection.
      for (const relation of data.relations) {
        if (
          relationDisplayMode(relationModes, relation.relationName) !==
          "always"
        ) {
          continue;
        }
        if (
          selectedDeviceId &&
          (relation.fromDeviceId === selectedDeviceId ||
            relation.toDeviceId === selectedDeviceId) &&
          !relation.fromServiceId &&
          !relation.toServiceId
        ) {
          continue;
        }
        if (
          selectedServiceId &&
          (relation.fromServiceId === selectedServiceId ||
            relation.toServiceId === selectedServiceId)
        ) {
          continue;
        }
        const fromTargets = endpointsFor(
          relation.fromDeviceId,
          relation.fromInterfaceId,
          relation.fromServiceId,
        );
        const toTargets = endpointsFor(
          relation.toDeviceId,
          relation.toInterfaceId,
          relation.toServiceId,
        );
        const startLabel = displayRelationLabel(relation.fromLabel);
        const endLabel = displayRelationLabel(relation.toLabel);
        fromTargets.forEach((fromEndpoint, fromIndex) => {
          toTargets.forEach((toEndpoint, toIndex) => {
            const id = `always-${relation.id}-${fromIndex}-${toIndex}`;
            addLink(id, fromEndpoint, toEndpoint, {
              kind: "relation",
              color: relation.color,
              tooltip: relationTooltip(relation),
              always: true,
              startLabel,
              endLabel,
              startShape: relation.lineStart,
              endShape: relation.lineEnd,
            });
          });
        });
      }
      setRelationConnectors([
        ...routeConnectorLinks(links).map((connector) => ({
          ...metadata.get(connector.id)!,
          ...connector,
        })),
        ...directConnectors,
      ]);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateConnectors);
    };

    updateConnectors();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [
    canvasRef,
    data,
    layoutMode,
    relationModes,
    selectedDeviceId,
    selectedServiceId,
  ]);

  function updateConnectorTooltip(
    event: PointerEvent<SVGGElement>,
    connector: RelationConnector,
  ) {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) {
      return;
    }
    setConnectorTooltip({
      id: connector.id,
      text: connector.tooltip,
      x: event.clientX - canvasRect.left + 12,
      y: event.clientY - canvasRect.top,
    });
  }

  const handlers: PortalConnectorHandlers = {
    onPointerEnter: updateConnectorTooltip,
    onPointerLeave: () => setConnectorTooltip(undefined),
    onPointerMove: updateConnectorTooltip,
  };

  return {
    connectorHandlers: handlers,
    connectorTooltip,
    relationConnectors,
  };
}

/** One line endpoint, drawn in the relation name's shape. (ux, uy) is
 * the unit vector pointing INTO the endpoint along the line, so an
 * arrow's tip lands on the endpoint with its base inside the line. */
function EndpointMark({
  shape,
  x,
  y,
  ux,
  uy,
}: {
  shape: PortalLineEndpointShape;
  x: number;
  y: number;
  ux: number;
  uy: number;
}) {
  if (shape === "none") {
    return null;
  }
  if (shape === "circle") {
    return <circle cx={x} cy={y} r="5" />;
  }
  if (shape === "square") {
    return (
      <rect
        className="ouchi-relation-endpoint"
        height="10"
        width="10"
        x={x - 5}
        y={y - 5}
      />
    );
  }
  if (shape === "diamond") {
    return (
      <polygon
        className="ouchi-relation-endpoint"
        points={`${x},${y - 8} ${x + 8},${y} ${x},${y + 8} ${x - 8},${y}`}
      />
    );
  }
  const baseX = x - ux * 16;
  const baseY = y - uy * 16;
  const perpX = -uy;
  const perpY = ux;
  return (
    <polygon
      className="ouchi-relation-endpoint"
      points={`${x},${y} ${baseX + perpX * 7.5},${baseY + perpY * 7.5} ${baseX - perpX * 7.5},${baseY - perpY * 7.5}`}
    />
  );
}

export function PortalConnectorLayer({
  connectors,
  handlers,
  tooltip,
}: {
  connectors: RelationConnector[];
  handlers: PortalConnectorHandlers;
  tooltip?: ConnectorTooltip;
}) {
  const activeConnector = tooltip
    ? connectors.find((connector) => connector.id === tooltip.id)
    : undefined;
  // Endpoint labels show for the hovered connector, and stay visible
  // for connectors touching the selected device and for connectors
  // whose relation name is in "always" display mode.
  const labelConnectors = connectors.filter(
    (connector) =>
      connector.kind === "relation" &&
      (connector.always ||
        connector.selected ||
        connector.id === activeConnector?.id),
  );
  const endpointLabels = labelConnectors.flatMap((connector) =>
    [
      {
        key: `${connector.id}-start`,
        label: connector.startLabel,
        side: connector.startSide,
        x: connector.startX,
        y: connector.startY,
        color: connector.color,
      },
      {
        key: `${connector.id}-end`,
        label: connector.endLabel,
        side: connector.endSide,
        x: connector.endX,
        y: connector.endY,
        color: connector.color,
      },
    ].filter((endpoint) => endpoint.label),
  );
  return (
    <>
      {connectors.length > 0 && (
        <svg
          aria-hidden="true"
          className="ouchi-relation-connectors"
          focusable="false"
        >
          {connectors.map((connector) => {
            const dx = connector.endX - connector.startX;
            const dy = connector.endY - connector.startY;
            const length = Math.hypot(dx, dy) || 1;
            const ux = dx / length;
            const uy = dy / length;
            return (
            <g
              className={`ouchi-relation-connector ouchi-relation-connector--${connector.kind}`}
              key={connector.id}
              onPointerEnter={(event) =>
                handlers.onPointerEnter(event, connector)
              }
              onPointerLeave={handlers.onPointerLeave}
              onPointerMove={(event) =>
                handlers.onPointerMove(event, connector)
              }
              style={
                {
                  "--ouchi-relation-color": connector.color,
                } as CSSProperties
              }
            >
              <path
                className="ouchi-relation-hit-area"
                d={connector.d}
              />
              <path
                className="ouchi-relation-visible"
                d={connector.d}
              />
              <EndpointMark
                shape={connector.startShape ?? "circle"}
                ux={-ux}
                uy={-uy}
                x={connector.startX}
                y={connector.startY}
              />
              <EndpointMark
                shape={connector.endShape ?? "circle"}
                ux={ux}
                uy={uy}
                x={connector.endX}
                y={connector.endY}
              />
            </g>
            );
          })}
        </svg>
      )}
      {tooltip && (
        <div
          className="ouchi-relation-tooltip"
          role="tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          {tooltip.text}
        </div>
      )}
      {endpointLabels.map((endpoint) => (
        <div
          className={`ouchi-relation-endpoint-label ouchi-relation-endpoint-label--${endpoint.side}`}
          key={endpoint.key}
          style={
            {
              left: endpoint.x,
              top: endpoint.y,
              "--ouchi-relation-color": endpoint.color,
            } as CSSProperties
          }
        >
          {endpoint.label}
        </div>
      ))}
    </>
  );
}
