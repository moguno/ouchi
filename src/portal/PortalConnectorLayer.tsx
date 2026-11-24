import "./styles/portal-connectors.css";
import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  routeConnectorLinks,
  type ConnectorLink,
  type ConnectorRect,
  type ConnectorSide,
} from "./connectors";
import type {
  PortalDataV2,
} from "./types";
import { relationTooltip } from "./portalPresentation";
import { displayRelationLabel } from "./relationLabels";

export interface RelationConnector {
  id: string;
  kind: "same-device" | "relation";
  color: string;
  tooltip: string;
  startLabel?: string;
  endLabel?: string;
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
  selectedDeviceId,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  data: PortalDataV2;
  layoutMode: string;
  selectedDeviceId?: string;
}) {
  const [relationConnectors, setRelationConnectors] = useState<
    RelationConnector[]
  >([]);
  const [connectorTooltip, setConnectorTooltip] =
    useState<ConnectorTooltip>();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedDeviceId) {
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
      const localRect = (card: HTMLElement): ConnectorRect => {
        const rect = card.getBoundingClientRect();
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

      const links: ConnectorLink[] = [];
      const metadata = new Map<
        string,
        Pick<
          RelationConnector,
          "kind" | "color" | "tooltip" | "startLabel" | "endLabel"
        >
      >();
      const selectedCards = cardsFor(selectedDeviceId);
      selectedCards.forEach((selectedCard, selectedIndex) => {
        const sameDeviceCard = selectedCards[selectedIndex + 1];
        if (!sameDeviceCard) {
          return;
        }
        const id = `same-device-${selectedIndex}-${selectedIndex + 1}`;
        links.push({
          id,
          from: selectedCard.node,
          to: sameDeviceCard.node,
        });
        metadata.set(id, {
          kind: "same-device",
          color: "#6259d8",
          tooltip: "同一デバイス",
        });
      });

      for (const relation of data.relations) {
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
        // A relation belongs to one interface on each side: draw it only
        // between the cards of those interfaces. When an endpoint
        // interface has no card on screen (e.g. it has no network), fall
        // back to the device's cards so the relation stays visible.
        const selectedInterfaceId = selectedIsFrom
          ? relation.fromInterfaceId
          : relation.toInterfaceId;
        const relatedInterfaceId = selectedIsFrom
          ? relation.toInterfaceId
          : relation.fromInterfaceId;
        const selectedEndpointCards = cardsFor(
          selectedDeviceId,
          selectedInterfaceId,
        );
        const selectedTargets =
          selectedEndpointCards.length > 0
            ? selectedEndpointCards
            : selectedCards;
        const relatedEndpointCards = cardsFor(
          relatedDeviceId,
          relatedInterfaceId,
        );
        const relatedTargets =
          relatedEndpointCards.length > 0
            ? relatedEndpointCards
            : cardsFor(relatedDeviceId);
        const startLabel = displayRelationLabel(
          selectedIsFrom ? relation.fromLabel : relation.toLabel,
        );
        const endLabel = displayRelationLabel(
          selectedIsFrom ? relation.toLabel : relation.fromLabel,
        );

        selectedTargets.forEach((selectedCard, selectedIndex) => {
          relatedTargets.forEach((relatedCard, relatedIndex) => {
            const id = `${relation.id}-${selectedIndex}-${relatedIndex}`;
            links.push({
              id,
              from: selectedCard.node,
              to: relatedCard.node,
            });
            metadata.set(id, {
              kind: "relation",
              color: relation.color,
              tooltip: relationTooltip(relation),
              startLabel,
              endLabel,
            });
          });
        });
      }
      setRelationConnectors(
        routeConnectorLinks(links).map((connector) => ({
          ...metadata.get(connector.id)!,
          ...connector,
        })),
      );
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
  }, [canvasRef, data, layoutMode, selectedDeviceId]);

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
  const endpointLabels =
    activeConnector?.kind === "relation"
      ? [
          {
            key: "start",
            label: activeConnector.startLabel,
            side: activeConnector.startSide,
            x: activeConnector.startX,
            y: activeConnector.startY,
          },
          {
            key: "end",
            label: activeConnector.endLabel,
            side: activeConnector.endSide,
            x: activeConnector.endX,
            y: activeConnector.endY,
          },
        ].filter((endpoint) => endpoint.label)
      : [];
  return (
    <>
      {connectors.length > 0 && (
        <svg
          aria-hidden="true"
          className="ouchi-relation-connectors"
          focusable="false"
        >
          {connectors.map((connector) => (
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
              <circle
                cx={connector.startX}
                cy={connector.startY}
                r="3.5"
              />
              <circle
                cx={connector.endX}
                cy={connector.endY}
                r="3.5"
              />
            </g>
          ))}
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
      {activeConnector &&
        endpointLabels.map((endpoint) => (
          <div
            className={`ouchi-relation-endpoint-label ouchi-relation-endpoint-label--${endpoint.side}`}
            key={endpoint.key}
            style={
              {
                left: endpoint.x,
                top: endpoint.y,
                "--ouchi-relation-color": activeConnector.color,
              } as CSSProperties
            }
          >
            {endpoint.label}
          </div>
        ))}
    </>
  );
}
