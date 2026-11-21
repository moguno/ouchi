import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { portalDemoData } from "./demoData";
import {
  ConfirmDialog,
  EntityDialog,
  type DeviceMutation,
  type PortalEntity,
} from "./EntityDialog";
import {
  ExternalLinkIcon,
  GridIcon,
  ListIcon,
  LockIcon,
  ServiceIcon,
  SettingsIcon,
} from "./icons";
import {
  ManageDrawer,
  type EntityKind,
  type ManageTab,
} from "./ManageDrawer";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  DEVICE_CATEGORY_LABELS,
  PORTAL_DEVICE_CATEGORIES,
  STATUS_LABELS,
  type OuchiPortalProps,
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceNetwork,
  type PortalDeviceResources,
  type PortalNetwork,
  type PortalRelation,
  type PortalService,
  type PortalStatus,
} from "./types";
import { buildServiceUrl } from "./urls";
import { usePortalData } from "./usePortalData";
import { validatePortalData } from "./validation";
import "./styles.css";

type ViewMode = "icons" | "list";

interface DialogState {
  kind: EntityKind;
  editingId?: string;
}

type ConfirmState =
  | { type: "delete"; kind: EntityKind; id: string }
  | { type: "reset" };

interface DeviceVisual {
  mode: "neutral" | "selected" | "related" | "muted";
  tags: Array<{ label: string; color: string }>;
  color?: string;
}

interface RelationConnector {
  id: string;
  kind: "same-device" | "relation";
  color: string;
  d: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

type ConnectorRect = Pick<
  DOMRect,
  "left" | "right" | "top" | "bottom" | "width" | "height"
>;

const EMPTY_DATA: PortalDataV2 = {
  version: 2,
  networks: [],
  devices: [],
  deviceNetworks: [],
  relations: [],
  services: [],
};

const KIND_LABELS: Record<EntityKind, string> = {
  network: "ネットワーク",
  device: "デバイス",
  service: "サービス",
};

function aggregateStatus(
  services: PortalService[],
): PortalStatus | "unknown" {
  if (services.length === 0) {
    return "unknown";
  }
  if (services.some((service) => service.status === "down")) {
    return "down";
  }
  if (services.some((service) => service.status === "maintenance")) {
    return "maintenance";
  }
  return "up";
}

function StatusDot({
  status,
  withLabel = false,
}: {
  status: PortalStatus | "unknown";
  withLabel?: boolean;
}) {
  const label = status === "unknown" ? "状態なし" : STATUS_LABELS[status];
  return (
    <span className="ouchi-status-wrap">
      <span
        aria-hidden="true"
        className={`ouchi-status-dot ouchi-status--${status}`}
      />
      {withLabel && <span className="ouchi-visually-hidden">{label}</span>}
    </span>
  );
}

function deviceVisual(
  deviceId: string,
  selectedDeviceId: string | undefined,
  relations: PortalRelation[],
): DeviceVisual {
  if (!selectedDeviceId) {
    return { mode: "neutral", tags: [] };
  }
  if (deviceId === selectedDeviceId) {
    return { mode: "selected", tags: [] };
  }

  const related = relations.filter(
    (relation) =>
      (relation.fromDeviceId === selectedDeviceId &&
        relation.toDeviceId === deviceId) ||
      (relation.toDeviceId === selectedDeviceId &&
        relation.fromDeviceId === deviceId),
  );
  if (related.length > 0) {
    const viewingFrom = related.some(
      (relation) => relation.fromDeviceId === selectedDeviceId,
    );
    return {
      mode: "related",
      tags: related.map((relation) => ({
        label: viewingFrom
          ? relation.toLabel
          : relation.fromLabel,
        color: relation.color,
      })),
      color: related[0].color,
    };
  }
  return { mode: "muted", tags: [] };
}

function connectorAnchors(
  from: ConnectorRect,
  to: ConnectorRect,
): {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  d: string;
} {
  const fromCenterX = from.left + from.width / 2;
  const fromCenterY = from.top + from.height / 2;
  const toCenterX = to.left + to.width / 2;
  const toCenterY = to.top + to.height / 2;
  const deltaX = toCenterX - fromCenterX;
  const deltaY = toCenterY - fromCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    const direction = deltaX >= 0 ? 1 : -1;
    const startX = direction > 0 ? from.right : from.left;
    const endX = direction > 0 ? to.left : to.right;
    const startY = fromCenterY;
    const endY = toCenterY;
    const curve = Math.max(28, Math.abs(endX - startX) * 0.45);
    return {
      startX,
      startY,
      endX,
      endY,
      d: `M ${startX} ${startY} C ${startX + direction * curve} ${startY}, ${endX - direction * curve} ${endY}, ${endX} ${endY}`,
    };
  }

  const direction = deltaY >= 0 ? 1 : -1;
  const startX = fromCenterX;
  const endX = toCenterX;
  const startY = direction > 0 ? from.bottom : from.top;
  const endY = direction > 0 ? to.top : to.bottom;
  const curve = Math.max(24, Math.abs(endY - startY) * 0.42);
  return {
    startX,
    startY,
    endX,
    endY,
    d: `M ${startX} ${startY} C ${startX} ${startY + direction * curve}, ${endX} ${endY - direction * curve}, ${endX} ${endY}`,
  };
}

function ResourceMeter({
  label,
  value,
}: {
  label: "メモリ" | "ディスク";
  value: number;
}) {
  const tone = value <= 60 ? "low" : value <= 85 ? "medium" : "high";
  return (
    <div
      aria-label={`${label}使用率 ${value}%`}
      className="ouchi-resource-meter"
    >
      <span>{label}</span>
      <span className="ouchi-resource-track" aria-hidden="true">
        <i
          className={`ouchi-resource-fill ouchi-resource-fill--${tone}`}
          style={{ width: `${value}%` }}
        />
      </span>
      <strong>{value}%</strong>
    </div>
  );
}

function ResourceMeters({
  resources,
}: {
  resources?: PortalDeviceResources;
}) {
  if (!resources) {
    return null;
  }

  return (
    <div className="ouchi-resource-meters">
      <ResourceMeter label="メモリ" value={resources.memoryPercent} />
      <ResourceMeter label="ディスク" value={resources.diskPercent} />
    </div>
  );
}

function RelationBadges({ visual }: { visual: DeviceVisual }) {
  if (visual.mode === "related") {
    return (
      <div className="ouchi-relation-badges">
        {visual.tags.map((tag, index) => (
          <span
            className="ouchi-relation-badge"
            key={`${tag.label}-${index}`}
            style={
              {
                "--ouchi-relation-color": tag.color,
              } as CSSProperties
            }
          >
            {tag.label}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function ServiceTile({
  service,
  membership,
}: {
  service: PortalService;
  membership: PortalDeviceNetwork;
}) {
  const href = buildServiceUrl(service, membership);
  return (
    <a
      className="ouchi-service-tile"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <span className="ouchi-service-icon-wrap">
        <ServiceIcon iconKey={service.iconKey} size={50} />
        <span
          aria-label={STATUS_LABELS[service.status]}
          className={`ouchi-service-status ouchi-status--${service.status}`}
          role="img"
          title={STATUS_LABELS[service.status]}
        />
      </span>
      <span className="ouchi-service-copy">
        <strong>{service.name}</strong>
        <small>{service.subtitle || "サービス"}</small>
      </span>
    </a>
  );
}

function DeviceCard({
  membership,
  device,
  services,
  visual,
  sameDevice,
  selectedDeviceId,
  onSelect,
}: {
  membership: PortalDeviceNetwork;
  device: PortalDevice;
  services: PortalService[];
  visual: DeviceVisual;
  sameDevice: boolean;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
}) {
  const selected = device.id === selectedDeviceId;
  const style =
    visual.mode === "related" && visual.color
      ? ({ "--ouchi-relation-color": visual.color } as CSSProperties)
      : undefined;

  return (
    <article
      aria-labelledby={`device-${membership.id}`}
      className={[
        "ouchi-node-card",
        device.isVm ? "ouchi-device-card--vm" : "",
        `ouchi-device-card--${visual.mode}`,
      ]
        .filter(Boolean)
        .join(" ")}
      data-device-id={device.id}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("a, button")
        ) {
          return;
        }
        onSelect(device.id);
      }}
      style={style}
    >
      <header className="ouchi-node-header">
        <button
          aria-label={`${device.name}を${selected ? "選択解除" : "選択"}`}
          aria-pressed={selected}
          className="ouchi-node-select-button"
          onClick={() => onSelect(device.id)}
          type="button"
        >
          <span className="ouchi-node-radio" aria-hidden="true" />
          <span className="ouchi-device-title">
            <span id={`device-${membership.id}`}>{device.name}</span>
            {device.isVm && <span className="ouchi-vm-badge">VM</span>}
            {sameDevice && selected && (
              <span className="ouchi-same-device-badge">同一デバイス</span>
            )}
          </span>
          <span className="ouchi-node-address">
            {membership.ip}
            {membership.label ? ` / ${membership.label}` : ""}
          </span>
        </button>
        <div className="ouchi-node-header-side">
          <RelationBadges visual={visual} />
          <StatusDot status={aggregateStatus(services)} withLabel />
        </div>
      </header>

      {services.length === 0 ? (
        <p className="ouchi-node-empty">サービス未登録</p>
      ) : (
        <div className="ouchi-service-grid">
          {services.map((service) => (
            <ServiceTile
              key={service.id}
              membership={membership}
              service={service}
            />
          ))}
        </div>
      )}

      <ResourceMeters resources={device.resources} />
    </article>
  );
}

function NetworkCard({
  network,
  data,
  selectedDeviceId,
  onSelect,
}: {
  network: PortalNetwork;
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
}) {
  const memberships = data.deviceNetworks.filter(
    (membership) => membership.networkId === network.id,
  );
  const membershipCounts = new Map<string, number>();
  for (const membership of data.deviceNetworks) {
    membershipCounts.set(
      membership.deviceId,
      (membershipCounts.get(membership.deviceId) ?? 0) + 1,
    );
  }

  return (
    <article
      aria-labelledby={`network-${network.id}`}
      className={`ouchi-network-card ouchi-accent-scope--${network.accent}`}
    >
      <header className="ouchi-network-header">
        <span className="ouchi-network-label">
          <span className="ouchi-network-glyph" aria-hidden="true">
            {network.name.slice(0, 1)}
          </span>
          <span id={`network-${network.id}`}>{network.name}</span>
        </span>
        <span className="ouchi-network-meta">
          {network.cidr && <code>{network.cidr}</code>}
          <small>
            {new Set(memberships.map((item) => item.deviceId)).size}台 / IP{" "}
            {memberships.length}件
          </small>
        </span>
      </header>

      {memberships.length === 0 ? (
        <div className="ouchi-empty-network">
          <strong>デバイス未登録</strong>
          <p>管理画面から、このネットワークへデバイスを追加できます。</p>
        </div>
      ) : (
        <div className="ouchi-device-category-stack">
          {PORTAL_DEVICE_CATEGORIES.map((category) => {
            const categoryMemberships = memberships.filter(
              (membership) =>
                data.devices.find(
                  (device) => device.id === membership.deviceId,
                )?.category === category,
            );
            return (
              <div
                className={`ouchi-device-category ouchi-device-category--${category}`}
                key={category}
              >
                <header className="ouchi-device-category-header">
                  <h3 id={`category-${network.id}-${category}`}>
                    {DEVICE_CATEGORY_LABELS[category]}
                  </h3>
                  <span>{categoryMemberships.length}</span>
                </header>
                {categoryMemberships.length === 0 ? (
                  <p className="ouchi-device-category-empty">登録なし</p>
                ) : (
                  <div className="ouchi-node-grid">
                    {categoryMemberships.map((membership) => {
                      const device = data.devices.find(
                        (item) => item.id === membership.deviceId,
                      );
                      if (!device) {
                        return null;
                      }
                      const services = data.services.filter(
                        (service) =>
                          service.deviceNetworkId === membership.id,
                      );
                      return (
                        <DeviceCard
                          key={membership.id}
                          device={device}
                          membership={membership}
                          onSelect={onSelect}
                          sameDevice={
                            (membershipCounts.get(device.id) ?? 0) > 1
                          }
                          selectedDeviceId={selectedDeviceId}
                          services={services}
                          visual={deviceVisual(
                            device.id,
                            selectedDeviceId,
                            data.relations,
                          )}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function IconBoard({
  data,
  selectedDeviceId,
  onSelect,
}: {
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
}) {
  return (
    <div className="ouchi-network-stack">
      {sortNetworksForDisplay(data.networks).map((network) => (
        <NetworkCard
          data={data}
          key={network.id}
          network={network}
          onSelect={onSelect}
          selectedDeviceId={selectedDeviceId}
        />
      ))}
    </div>
  );
}

function ListService({
  service,
  membership,
}: {
  service: PortalService;
  membership: PortalDeviceNetwork;
}) {
  return (
    <a
      className="ouchi-list-service"
      href={buildServiceUrl(service, membership)}
      rel="noreferrer"
      target="_blank"
    >
      <span
        aria-hidden="true"
        className={`ouchi-status-dot ouchi-status--${service.status}`}
      />
      <span>{service.name}</span>
      <small>{service.subtitle}</small>
      <ExternalLinkIcon size={14} />
    </a>
  );
}

function ListBoard({
  data,
  selectedDeviceId,
  onSelect,
}: {
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
}) {
  const membershipCounts = new Map<string, number>();
  for (const membership of data.deviceNetworks) {
    membershipCounts.set(
      membership.deviceId,
      (membershipCounts.get(membership.deviceId) ?? 0) + 1,
    );
  }

  return (
    <div className="ouchi-list-stack">
      {sortNetworksForDisplay(data.networks).map((network) => {
        const memberships = data.deviceNetworks.filter(
          (membership) => membership.networkId === network.id,
        );

        return (
          <section
            className={`ouchi-list-network ouchi-accent-scope--${network.accent}`}
            key={network.id}
          >
            <header className="ouchi-list-network-header">
              <div>
                <span className="ouchi-network-label">
                  <span className="ouchi-network-glyph" aria-hidden="true">
                    {network.name.slice(0, 1)}
                  </span>
                  <strong>{network.name}</strong>
                </span>
                <p>{network.cidr || "CIDRなし"}</p>
              </div>
              <span className="ouchi-list-count">
                デバイス{" "}
                {new Set(memberships.map((item) => item.deviceId)).size}台 / IP{" "}
                {memberships.length}件
              </span>
            </header>

            {memberships.length === 0 ? (
              <p className="ouchi-list-empty">デバイス未登録</p>
            ) : (
              <div className="ouchi-list-category-stack">
                {PORTAL_DEVICE_CATEGORIES.map((category) => {
                  const categoryMemberships = memberships.filter(
                    (membership) =>
                      data.devices.find(
                        (device) => device.id === membership.deviceId,
                      )?.category === category,
                  );
                  return (
                    <section
                      className={`ouchi-list-category ouchi-list-category--${category}`}
                      key={category}
                    >
                      <header className="ouchi-list-category-header">
                        <strong>{DEVICE_CATEGORY_LABELS[category]}</strong>
                        <span>{categoryMemberships.length}</span>
                      </header>
                      {categoryMemberships.length === 0 ? (
                        <p className="ouchi-list-category-empty">登録なし</p>
                      ) : (
                        <div className="ouchi-list-node-list">
                          {categoryMemberships.map((membership) => {
                            const device = data.devices.find(
                              (item) => item.id === membership.deviceId,
                            );
                            if (!device) {
                              return null;
                            }
                            const visual = deviceVisual(
                              device.id,
                              selectedDeviceId,
                              data.relations,
                            );
                            const services = data.services.filter(
                              (service) =>
                                service.deviceNetworkId === membership.id,
                            );
                            const selected =
                              device.id === selectedDeviceId;
                            return (
                              <div
                                className={[
                                  "ouchi-list-node",
                                  device.isVm ? "ouchi-list-node--vm" : "",
                                  `ouchi-list-node--${visual.mode}`,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                data-device-id={device.id}
                                key={membership.id}
                                onClick={(event) => {
                                  if (
                                    event.target instanceof Element &&
                                    event.target.closest("a, button")
                                  ) {
                                    return;
                                  }
                                  onSelect(device.id);
                                }}
                                style={
                                  visual.mode === "related" &&
                                  visual.color
                                    ? ({
                                        "--ouchi-relation-color":
                                          visual.color,
                                      } as CSSProperties)
                                    : undefined
                                }
                              >
                                <div className="ouchi-list-node-summary">
                                  <div className="ouchi-list-node-meta">
                                    <button
                                      aria-label={`${device.name}を${selected ? "選択解除" : "選択"}`}
                                      aria-pressed={selected}
                                      className="ouchi-list-select-button"
                                      onClick={() => onSelect(device.id)}
                                      type="button"
                                    >
                                      <span
                                        className="ouchi-status-dot"
                                        aria-hidden="true"
                                      />
                                      <strong>{device.name}</strong>
                                    </button>
                                    {device.isVm && (
                                      <span className="ouchi-vm-badge">
                                        VM
                                      </span>
                                    )}
                                    {selected &&
                                      (membershipCounts.get(device.id) ?? 0) >
                                        1 && (
                                        <span className="ouchi-same-device-badge">
                                          同一デバイス
                                        </span>
                                      )}
                                    <code>{membership.ip}</code>
                                    {membership.label && (
                                      <small>{membership.label}</small>
                                    )}
                                    {visual.mode === "related" &&
                                      visual.tags.map((tag, index) => (
                                        <span
                                          className="ouchi-relation-badge"
                                          key={`${tag.label}-${index}`}
                                          style={
                                            {
                                              "--ouchi-relation-color":
                                                tag.color,
                                            } as CSSProperties
                                          }
                                        >
                                          {tag.label}
                                        </span>
                                      ))}
                                  </div>
                                  <div className="ouchi-list-services">
                                    {services.length === 0 ? (
                                      <span className="ouchi-list-service-empty">
                                        サービス未登録
                                      </span>
                                    ) : (
                                      services.map((service) => (
                                        <ListService
                                          key={service.id}
                                          membership={membership}
                                          service={service}
                                        />
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function OuchiPortal({
  data,
  storageKey = "ouchi.local.portal.v11",
  showTitle = true,
  portalTitle,
  onPortalTitleChange,
  initialSelectedDeviceId,
  onDataChange,
  className,
}: OuchiPortalProps) {
  const seedResult = useMemo(
    () => validatePortalData(data ?? portalDemoData),
    [data],
  );
  const seed = seedResult.value ?? EMPTY_DATA;
  const seedWarning =
    seedResult.issues.length > 0
      ? "初期データの形式に問題があります。管理画面からデータを修正してください。"
      : undefined;
  const { data: portalData, storageWarning, updateData, resetData } =
    usePortalData({ seed, storageKey, onDataChange });

  const [viewMode, setViewMode] = useState<ViewMode>("icons");
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>("networks");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [message, setMessage] = useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    initialSelectedDeviceId,
  );
  const portalRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [relationConnectors, setRelationConnectors] = useState<
    RelationConnector[]
  >([]);

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(undefined), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!selectedDeviceId || typeof document === "undefined") {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !portalRef.current?.contains(event.target)
      ) {
        setSelectedDeviceId(undefined);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [selectedDeviceId]);

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
      const cardsFor = (deviceId: string) =>
        cards.filter((card) => card.dataset.deviceId === deviceId);
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

      const connectors: RelationConnector[] = [];
      const selectedCards = cardsFor(selectedDeviceId);
      selectedCards.forEach((selectedCard, selectedIndex) => {
        selectedCards.slice(selectedIndex + 1).forEach((sameDeviceCard) => {
          const relatedIndex = selectedCards.indexOf(sameDeviceCard);
          const anchors = connectorAnchors(
            localRect(selectedCard),
            localRect(sameDeviceCard),
          );
          connectors.push({
            id: `same-device-${selectedIndex}-${relatedIndex}`,
            kind: "same-device",
            color: "#6259d8",
            ...anchors,
          });
        });
      });

      for (const relation of portalData.relations) {
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
            const anchors = connectorAnchors(
              localRect(selectedCard),
              localRect(relatedCard),
            );
            connectors.push({
              id: `${relation.id}-${selectedIndex}-${relatedIndex}`,
              kind: "relation",
              color: relation.color,
              ...anchors,
            });
          });
        });
      }
      setRelationConnectors(connectors);
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
  }, [portalData, selectedDeviceId, viewMode]);

  function openAdd(kind: EntityKind) {
    setManageTab(
      kind === "network"
        ? "networks"
        : kind === "device"
          ? "devices"
          : "services",
    );
    setDialog({ kind });
    setMessage(undefined);
  }

  function openEdit(kind: EntityKind, id: string) {
    setDialog({ kind, editingId: id });
    setMessage(undefined);
  }

  function requestDelete(kind: EntityKind, id: string) {
    setMessage(undefined);
    if (kind === "network") {
      const childCount = portalData.deviceNetworks.filter(
        (membership) => membership.networkId === id,
      ).length;
      if (childCount > 0) {
        setMessage(
          `所属IPが${childCount}件登録されています。先にデバイスを編集してください。`,
        );
        return;
      }
    }

    if (kind === "device") {
      const membershipIds = new Set(
        portalData.deviceNetworks
          .filter((membership) => membership.deviceId === id)
          .map((membership) => membership.id),
      );
      const childCount = portalData.services.filter((service) =>
        membershipIds.has(service.deviceNetworkId),
      ).length;
      if (childCount > 0) {
        setMessage(
          `サービスが${childCount}件登録されています。先にサービスを削除または移動してください。`,
        );
        return;
      }
    }

    setConfirm({ type: "delete", kind, id });
  }

  function entityName(kind: EntityKind, id: string) {
    if (kind === "network") {
      return portalData.networks.find((item) => item.id === id)?.name ?? "";
    }
    if (kind === "device") {
      return portalData.devices.find((item) => item.id === id)?.name ?? "";
    }
    return portalData.services.find((item) => item.id === id)?.name ?? "";
  }

  function handleDelete() {
    if (!confirm || confirm.type !== "delete") {
      return;
    }

    updateData((current) => {
      if (confirm.kind === "network") {
        return {
          ...current,
          networks: current.networks.filter(
            (network) => network.id !== confirm.id,
          ),
        };
      }
      if (confirm.kind === "device") {
        return {
          ...current,
          devices: current.devices.filter(
            (device) => device.id !== confirm.id,
          ),
          deviceNetworks: current.deviceNetworks.filter(
            (membership) => membership.deviceId !== confirm.id,
          ),
          relations: current.relations.filter(
            (relation) =>
              relation.fromDeviceId !== confirm.id &&
              relation.toDeviceId !== confirm.id,
          ),
        };
      }
      return {
        ...current,
        services: current.services.filter(
          (service) => service.id !== confirm.id,
        ),
      };
    });
    if (confirm.kind === "device" && selectedDeviceId === confirm.id) {
      setSelectedDeviceId(undefined);
    }
    setMessage(`${KIND_LABELS[confirm.kind]}を削除しました。`);
    setConfirm(null);
  }

  function handleSave(kind: EntityKind, entity: PortalEntity) {
    updateData((current) => {
      if (kind === "network") {
        const network = entity as PortalNetwork;
        const exists = current.networks.some((item) => item.id === network.id);
        return {
          ...current,
          networks: exists
            ? current.networks.map((item) =>
                item.id === network.id ? network : item,
              )
            : [...current.networks, network],
        };
      }

      if (kind === "service") {
        const service = entity as PortalService;
        const exists = current.services.some(
          (item) => item.id === service.id,
        );
        return {
          ...current,
          services: exists
            ? current.services.map((item) =>
                item.id === service.id ? service : item,
              )
            : [...current.services, service],
        };
      }

      const mutation = entity as DeviceMutation;
      const exists = current.devices.some(
        (item) => item.id === mutation.device.id,
      );
      const previousMembershipIds = new Set(
        current.deviceNetworks
          .filter(
            (membership) => membership.deviceId === mutation.device.id,
          )
          .map((membership) => membership.id),
      );
      const nextMembershipIds = new Set(
        mutation.deviceNetworks.map((membership) => membership.id),
      );
      return {
        ...current,
        devices: exists
          ? current.devices.map((item) =>
              item.id === mutation.device.id ? mutation.device : item,
            )
          : [...current.devices, mutation.device],
        deviceNetworks: [
          ...current.deviceNetworks.filter(
            (membership) => membership.deviceId !== mutation.device.id,
          ),
          ...mutation.deviceNetworks,
        ],
        relations: [
          ...current.relations.filter(
            (relation) =>
              relation.fromDeviceId !== mutation.device.id,
          ),
          ...mutation.relations,
        ],
        services: current.services.filter(
          (service) =>
            !previousMembershipIds.has(service.deviceNetworkId) ||
            nextMembershipIds.has(service.deviceNetworkId),
        ),
      };
    });
    setMessage(`${KIND_LABELS[kind]}を保存しました。`);
    setDialog(null);
  }

  function handleReset() {
    resetData();
    setSelectedDeviceId(initialSelectedDeviceId);
    setConfirm(null);
    setDialog(null);
    setMessage("初期データへ戻しました。");
  }

  function toggleSelection(deviceId: string) {
    setSelectedDeviceId((current) =>
      current === deviceId ? undefined : deviceId,
    );
  }

  const vmCount = portalData.devices.filter((device) => device.isVm).length;
  const screenReaderSummary = `${portalData.networks.length}ネットワーク、${portalData.devices.length}デバイス（VM ${vmCount}）、${portalData.deviceNetworks.length}所属IP、${portalData.relations.length}関係、${portalData.services.length}サービス`;

  return (
    <section
      aria-label={`${portalTitle || "ouchi.local"} ポータル`}
      className={`ouchi-portal${className ? ` ${className}` : ""}`}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(".ouchi-node-card, .ouchi-list-node")
        ) {
          return;
        }
        setSelectedDeviceId(undefined);
      }}
      ref={portalRef}
    >
      <header
        className={`ouchi-portal-header${
          showTitle || portalTitle ? "" : " ouchi-portal-header--actions-only"
        }`}
      >
        {showTitle ? (
          <div className="ouchi-title-block">
            <span className="ouchi-home-mark" aria-hidden="true">
              家
            </span>
            <div>
              <h2>ouchi.local</h2>
              <p className="ouchi-summary">
                ポータル — おうちのサービスは、ここから全部入る
              </p>
              <span className="ouchi-visually-hidden">
                {screenReaderSummary}
              </span>
            </div>
          </div>
        ) : portalTitle ? (
          <div className="ouchi-user-title">
            <span className="ouchi-visually-hidden">
              {screenReaderSummary}
            </span>
            <h2>{portalTitle}</h2>
          </div>
        ) : (
          <span className="ouchi-visually-hidden">
            {screenReaderSummary}
          </span>
        )}

        <div className="ouchi-header-actions">
          <div
            aria-label="表示形式"
            className="ouchi-segmented"
            role="group"
          >
            <button
              aria-pressed={viewMode === "icons"}
              className={viewMode === "icons" ? "is-active" : ""}
              onClick={() => setViewMode("icons")}
              type="button"
            >
              <GridIcon size={18} />
              アイコン表示
            </button>
            <button
              aria-pressed={viewMode === "list"}
              className={viewMode === "list" ? "is-active" : ""}
              onClick={() => setViewMode("list")}
              type="button"
            >
              <ListIcon size={18} />
              リスト表示
            </button>
          </div>
          <button
            aria-description="ログインが必要です"
            className="ouchi-manage-button"
            onClick={() => {
              setManageOpen(true);
              setMessage(undefined);
            }}
            title="ログインが必要です"
            type="button"
          >
            <SettingsIcon size={19} />
            管理
            <span className="ouchi-manage-lock" aria-hidden="true">
              <LockIcon size={13} />
            </span>
          </button>
        </div>
      </header>

      <div className="ouchi-canvas" ref={canvasRef}>
        {relationConnectors.length > 0 && (
          <svg
            aria-hidden="true"
            className="ouchi-relation-connectors"
            focusable="false"
          >
            {relationConnectors.map((connector) => (
              <g
                className={`ouchi-relation-connector ouchi-relation-connector--${connector.kind}`}
                key={connector.id}
                style={{ "--ouchi-relation-color": connector.color } as CSSProperties}
              >
                <path d={connector.d} />
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
        {portalData.networks.length === 0 ? (
          <div className="ouchi-global-empty">
            <strong>ネットワークがありません</strong>
            <p>「管理」から最初のネットワークを追加してください。</p>
            <button
              className="ouchi-primary-button"
              onClick={() => {
                setManageOpen(true);
                openAdd("network");
              }}
              type="button"
            >
              ネットワークを追加
            </button>
          </div>
        ) : viewMode === "icons" ? (
          <IconBoard
            data={portalData}
            onSelect={toggleSelection}
            selectedDeviceId={selectedDeviceId}
          />
        ) : (
          <ListBoard
            data={portalData}
            onSelect={toggleSelection}
            selectedDeviceId={selectedDeviceId}
          />
        )}
      </div>

      <footer className="ouchi-portal-footer">
        <div className="ouchi-portal-legend">
          <p>
            メーターはSSHで取得（メモリ／ディスク）。CPUは収集しません。
          </p>
          <div className="ouchi-relation-legend" aria-label="選択表示の凡例">
            <span>
              <i className="ouchi-legend-swatch ouchi-legend-swatch--same" />
              同一デバイス
            </span>
            <span>
              <i className="ouchi-legend-swatch ouchi-legend-swatch--relation" />
              関係先はタグ色
            </span>
            <span>
              <i className="ouchi-legend-swatch ouchi-legend-swatch--muted" />
              無関係はグレーアウト
            </span>
          </div>
        </div>
        <div className="ouchi-status-legend" aria-label="状態の凡例">
          <span>
            <i className="ouchi-status-dot ouchi-status--up" />
            稼働中
          </span>
          <span>
            <i className="ouchi-status-dot ouchi-status--down" />
            停止
          </span>
          <span>
            <i className="ouchi-status-dot ouchi-status--maintenance" />
            メンテナンス
          </span>
        </div>
      </footer>

      <ManageDrawer
        activeTab={manageTab}
        data={portalData}
        message={message}
        onPortalTitleChange={onPortalTitleChange}
        onAdd={openAdd}
        onClose={() => {
          setManageOpen(false);
          setDialog(null);
          setConfirm(null);
        }}
        onDelete={requestDelete}
        onEdit={openEdit}
        onReset={() => setConfirm({ type: "reset" })}
        onTabChange={(tab) => {
          setManageTab(tab);
          setMessage(undefined);
        }}
        open={manageOpen}
        portalTitle={portalTitle}
        warning={seedWarning ?? storageWarning}
      />

      {dialog && (
        <EntityDialog
          data={portalData}
          editingId={dialog.editingId}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      )}

      {confirm?.type === "delete" && (
        <ConfirmDialog
          description={`「${entityName(confirm.kind, confirm.id)}」を削除します。この操作は元に戻せません。`}
          onCancel={() => setConfirm(null)}
          onConfirm={handleDelete}
          title={`${KIND_LABELS[confirm.kind]}を削除しますか？`}
        />
      )}

      {confirm?.type === "reset" && (
        <ConfirmDialog
          description="localStorageの編集内容を破棄し、同梱JSONの状態へ戻します。"
          onCancel={() => setConfirm(null)}
          onConfirm={handleReset}
          title="初期データへ戻しますか？"
        />
      )}
    </section>
  );
}
