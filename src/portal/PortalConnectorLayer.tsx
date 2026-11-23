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
} from "./connectors";
import type {
  PortalDataV2,
} from "./types";
import { relationTooltip } from "./portalPresentation";

export interface RelationConnector {
  id: string;
  kind: "same-device" | "relation";
  color: string;
  tooltip: string;
  d: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
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
      const cardsFor = (deviceId: string) =>
        cards
          .map((card, index) => ({ card, node: cardNodes[index] }))
          .filter(({ card }) => card.dataset.deviceId === deviceId);

      const links: ConnectorLink[] = [];
      const metadata = new Map<
        string,
        Pick<RelationConnector, "kind" | "color" | "tooltip">
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
        const relatedCards = cardsFor(relatedDeviceId);

        selectedCards.forEach((selectedCard, selectedIndex) => {
          relatedCards.forEach((relatedCard, relatedIndex) => {
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
    </>
  );
}
