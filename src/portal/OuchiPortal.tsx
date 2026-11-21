import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  PortalApiError,
  createDevice,
  createMembership,
  createNetwork,
  createRelation,
  createService,
  deleteDevice,
  deleteMembership,
  deleteNetwork,
  deleteRelation,
  deleteService,
  exportLedger,
  importLedger,
  updateDevice,
  updateMembership,
  updateNetwork,
  updateRelation,
  updateRelationTagColor,
  updateService,
  updateSettings,
} from "./apiClient";
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
  ServiceIcon,
  SettingsIcon,
} from "./icons";
import {
  routeConnectorLinks,
  type ConnectorLink,
  type ConnectorRect,
} from "./connectors";
import {
  ManageDrawer,
  type EntityKind,
  type ManageTab,
} from "./ManageDrawer";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  DEVICE_CATEGORY_LABELS,
  PORTAL_DEVICE_CATEGORIES,
  type OuchiPortalProps,
  type PortalDeviceInput,
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceNetwork,
  type PortalNetwork,
  type PortalRelation,
  type PortalService,
} from "./types";
import { usePortalData } from "./usePortalData";
import {
  DEFAULT_PORTAL_TITLE,
  validatePortalData,
} from "./validation";
import "./styles.css";

type ViewMode = "icons" | "list";

interface DialogState {
  kind: EntityKind;
  editingId?: string;
}

type ConfirmState =
  | { type: "delete"; kind: EntityKind; id: string };

interface DeviceVisual {
  mode: "neutral" | "selected" | "related";
  tags: Array<{ label: string; color: string }>;
  color?: string;
}

interface RelationConnector {
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

interface ConnectorTooltip {
  id: string;
  text: string;
  x: number;
  y: number;
}

const EMPTY_DATA: PortalDataV2 = {
  version: 2,
  networks: [],
  devices: [],
  deviceNetworks: [],
  relations: [],
  services: [],
  settings: {
    domain: "ouchi.local",
    title: DEFAULT_PORTAL_TITLE,
  },
};

const KIND_LABELS: Record<EntityKind, string> = {
  network: "ネットワーク",
  device: "デバイス",
  service: "サービス",
};

const DEMO_SERVICE_LINK_MESSAGE =
  "ここをクリックすると設定したURLにジャンプします";

function serviceName(service: PortalService): string {
  return service.petname?.trim() || service.subdomain;
}

function deviceName(device: PortalDevice): string {
  return device.petname?.trim() || device.name;
}

function serviceDescription(service: PortalService): string {
  return service.description?.trim() || "";
}

function relationLabelFor(
  relation: PortalRelation,
  fromPerspective: boolean,
): string {
  return fromPerspective
    ? relation.fromLabel?.trim() || relation.tag?.trim() || ""
    : relation.toLabel?.trim() || relation.tag?.trim() || "";
}

function relationTooltip(relation: PortalRelation): string {
  return `${relationLabelFor(relation, true)}⇒${relationLabelFor(
    relation,
    false,
  )}`;
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
        label: relationLabelFor(relation, !viewingFrom),
        color: relation.color,
      })),
      color: related[0].color,
    };
  }
  return { mode: "neutral", tags: [] };
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

function DemoServiceLinkDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="ouchi-dialog-backdrop ouchi-dialog-backdrop--confirm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby="ouchi-demo-service-message"
        aria-labelledby="ouchi-demo-service-title"
        aria-modal="true"
        className="ouchi-confirm-dialog ouchi-demo-service-dialog"
        role="alertdialog"
      >
        <p className="ouchi-eyebrow">表示専用デモ</p>
        <h3 id="ouchi-demo-service-title">サービスのリンク</h3>
        <p id="ouchi-demo-service-message">
          {DEMO_SERVICE_LINK_MESSAGE}
        </p>
        <div className="ouchi-form-actions">
          <button
            className="ouchi-primary-button"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            閉じる
          </button>
        </div>
      </section>
    </div>
  );
}

function ServiceTile({
  service,
  membership,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoClick,
}: {
  service: PortalService;
  membership: PortalDeviceNetwork;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoClick: () => void;
}) {
  const href = service.url ?? "";
  const content = (
    <>
      <span className="ouchi-service-icon-wrap">
        <ServiceIcon
          allowRemoteAssets={allowRemoteIcons}
          iconKey={service.iconKey}
          serviceUrl={href}
          size={50}
        />
      </span>
      <span className="ouchi-service-copy">
        <strong>{serviceName(service)}</strong>
        <small>{serviceDescription(service) || membership.ip || "IP未登録"}</small>
      </span>
    </>
  );
  if (demoMode) {
    return (
      <button
        className="ouchi-service-tile ouchi-service-tile--demo"
        onClick={onDemoClick}
        type="button"
      >
        {content}
      </button>
    );
  }
  return href ? (
    <a
      className="ouchi-service-tile"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  ) : (
    <div className="ouchi-service-tile ouchi-service-tile--disabled">
      {content}
    </div>
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
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  membership: PortalDeviceNetwork;
  device: PortalDevice;
  services: PortalService[];
  visual: DeviceVisual;
  sameDevice: boolean;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  const selected = device.id === selectedDeviceId;
  const petname = device.petname?.trim();
  const displayName = deviceName(device);
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
          aria-label={`${displayName}を${selected ? "選択解除" : "選択"}`}
          aria-pressed={selected}
          className="ouchi-node-select-button"
          onClick={() => onSelect(device.id)}
          type="button"
        >
          <span className="ouchi-node-radio" aria-hidden="true" />
          <span className="ouchi-device-title">
            <span id={`device-${membership.id}`}>{displayName}</span>
            {device.isVm && <span className="ouchi-vm-badge">VM</span>}
            {sameDevice && selected && (
              <span className="ouchi-same-device-badge">同一デバイス</span>
            )}
          </span>
          <span className="ouchi-node-address">
            {membership.ip || "IP未登録"}
            {petname ? ` / ${device.name}` : ""}
            {` / ${DEVICE_CATEGORY_LABELS[device.category]}`}
          </span>
        </button>
        <div className="ouchi-node-header-side">
          <RelationBadges visual={visual} />
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
              demoMode={demoMode}
              iconBaseUrl={iconBaseUrl}
              allowRemoteIcons={allowRemoteIcons}
              onDemoClick={onDemoServiceClick}
            />
          ))}
        </div>
      )}

    </article>
  );
}

function NetworkCard({
  network,
  data,
  selectedDeviceId,
  onSelect,
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  network: PortalNetwork;
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
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

      {memberships.length > 0 && (
        <div className="ouchi-device-category-stack">
          {PORTAL_DEVICE_CATEGORIES.filter((category) =>
            memberships.some(
              (membership) =>
                data.devices.find(
                  (device) => device.id === membership.deviceId,
                )?.category === category,
            ),
          ).map((category) => {
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
                          demoMode={demoMode}
                          device={device}
                          allowRemoteIcons={allowRemoteIcons}
                          iconBaseUrl={iconBaseUrl}
                          membership={membership}
                          onDemoServiceClick={onDemoServiceClick}
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
  demoMode,
  iconBaseUrl,
  allowRemoteIcons,
  onDemoServiceClick,
}: {
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  iconBaseUrl: string;
  allowRemoteIcons: boolean;
  onDemoServiceClick: () => void;
}) {
  return (
    <div className="ouchi-network-stack">
      {sortNetworksForDisplay(data.networks).map((network) => (
        <NetworkCard
          data={data}
          demoMode={demoMode}
          allowRemoteIcons={allowRemoteIcons}
          iconBaseUrl={iconBaseUrl}
          key={network.id}
          network={network}
          onDemoServiceClick={onDemoServiceClick}
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
  demoMode,
  onDemoClick,
}: {
  service: PortalService;
  membership: PortalDeviceNetwork;
  demoMode: boolean;
  onDemoClick: () => void;
}) {
  const href = service.url ?? "";
  const content = (
    <>
      <span className="ouchi-list-service-name">{serviceName(service)}</span>
      <small>{serviceDescription(service) || membership.ip || "IP未登録"}</small>
      {href && <ExternalLinkIcon size={14} />}
    </>
  );
  if (demoMode) {
    return (
      <button
        className="ouchi-list-service ouchi-service-tile--demo"
        onClick={onDemoClick}
        type="button"
      >
        {content}
      </button>
    );
  }
  return href ? (
    <a
      className="ouchi-list-service"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  ) : (
    <span className="ouchi-list-service ouchi-service-tile--disabled">
      {content}
    </span>
  );
}

function ListBoard({
  data,
  selectedDeviceId,
  onSelect,
  demoMode,
  onDemoServiceClick,
}: {
  data: PortalDataV2;
  selectedDeviceId?: string;
  onSelect: (deviceId: string) => void;
  demoMode: boolean;
  onDemoServiceClick: () => void;
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

            {memberships.length > 0 && (
              <div className="ouchi-list-category-stack">
                {PORTAL_DEVICE_CATEGORIES.filter((category) =>
                  memberships.some(
                    (membership) =>
                      data.devices.find(
                        (device) => device.id === membership.deviceId,
                      )?.category === category,
                  ),
                ).map((category) => {
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
                            const petname = device.petname?.trim();
                            const displayName = deviceName(device);
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
                                      aria-label={`${displayName}を${selected ? "選択解除" : "選択"}`}
                                      aria-pressed={selected}
                                      className="ouchi-list-select-button"
                                      onClick={() => onSelect(device.id)}
                                      type="button"
                                    >
                                      <strong>{displayName}</strong>
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
                                    <code>{membership.ip || "IP未登録"}</code>
                                    {petname && <small>{device.name}</small>}
                                    <small>
                                      {DEVICE_CATEGORY_LABELS[device.category]}
                                    </small>
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
                                          demoMode={demoMode}
                                          key={service.id}
                                          membership={membership}
                                          onDemoClick={onDemoServiceClick}
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
  apiBaseUrl = "",
  yamlUrl,
  readOnly = false,
  showTitle = true,
  initialSelectedDeviceId,
  onDataChange,
  className,
}: OuchiPortalProps) {
  const isReadOnly = readOnly || Boolean(yamlUrl);
  const seedResult = useMemo(
    () => (data ? validatePortalData(data) : undefined),
    [data],
  );
  const seed = seedResult?.value;
  const seedWarning =
    seedResult && seedResult.issues.length > 0
      ? "初期データの形式に問題があります。管理画面からデータを修正してください。"
      : undefined;
  const {
    data: loadedData,
    loading,
    error: apiError,
    reload,
  } = usePortalData({ seed, apiBaseUrl, yamlUrl, onDataChange });
  const portalData = loadedData ?? EMPTY_DATA;
  const portalTitle =
    portalData.settings?.title.trim() || DEFAULT_PORTAL_TITLE;

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
  const [connectorTooltip, setConnectorTooltip] =
    useState<ConnectorTooltip>();
  const [demoServiceNoticeOpen, setDemoServiceNoticeOpen] = useState(false);

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
    const service = portalData.services.find((item) => item.id === id);
    return service ? serviceName(service) : "";
  }

  function apiFailure(cause: unknown) {
    if (cause instanceof PortalApiError) {
      if (cause.issues.length > 0) {
        return cause.issues.map((issue) => issue.message).join(" / ");
      }
      return cause.message;
    }
    return cause instanceof Error ? cause.message : "API操作に失敗しました";
  }

  async function handleDelete() {
    if (!confirm || confirm.type !== "delete") {
      return;
    }

    try {
      if (confirm.kind === "network") {
        await deleteNetwork(apiBaseUrl, confirm.id);
      } else if (confirm.kind === "device") {
        await deleteDevice(apiBaseUrl, confirm.id);
      } else {
        await deleteService(apiBaseUrl, confirm.id);
      }
      if (confirm.kind === "device" && selectedDeviceId === confirm.id) {
        setSelectedDeviceId(undefined);
      }
      setMessage(`${KIND_LABELS[confirm.kind]}を削除しました。`);
      setConfirm(null);
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
      setConfirm(null);
    }
  }

  async function handleExportLedger() {
    const download = await exportLedger(apiBaseUrl);
    if (typeof document === "undefined") {
      return download.filename;
    }
    const blob = new Blob([download.yaml], {
      type: "application/yaml;charset=utf-8",
    });
    const canUseObjectUrl =
      typeof URL.createObjectURL === "function";
    const url = canUseObjectUrl
      ? URL.createObjectURL(blob)
      : `data:application/yaml;charset=utf-8,${encodeURIComponent(download.yaml)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = download.filename;
    link.click();
    if (canUseObjectUrl) {
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    return download.filename;
  }

  async function handleImportLedger(yaml: string) {
    const result = await importLedger(apiBaseUrl, yaml);
    setSelectedDeviceId(undefined);
    await reload();
    const imported = result.imported;
    return (
      `全置き換えが完了しました。ネットワーク ${imported.networks}件、` +
      `デバイス ${imported.devices}件、所属IP ${imported.memberships}件、` +
      `関係 ${imported.relations}件、サービス ${imported.services}件、` +
      `SSH公開鍵 ${imported.sshKeys}件を読み込みました。`
    );
  }

  async function handleSavePortalTitle(title: string) {
    await updateSettings(apiBaseUrl, { title });
    await reload();
    setMessage("ポータルタイトルを保存しました。");
  }

  async function handleSave(kind: EntityKind, entity: PortalEntity) {
    try {
      if (kind === "network") {
        const network = entity as PortalNetwork;
        const input = {
          name: network.name,
          cidr: network.cidr || null,
          accent: network.accent,
          note: network.note || null,
        };
        if (portalData.networks.some((item) => item.id === network.id)) {
          await updateNetwork(apiBaseUrl, network.id, input);
        } else {
          await createNetwork(apiBaseUrl, input);
        }
      } else if (kind === "service") {
        const service = entity as PortalService;
        const input = {
          deviceNetworkId: Number(service.deviceNetworkId),
          subdomain: service.subdomain.trim().toLowerCase(),
          petname: service.petname || null,
          description: service.description || null,
          port: service.port,
          protocol: service.protocol,
          scheme: service.scheme,
          topPath: service.topPath || null,
          monitorPath: service.monitorPath || null,
          serviceUrl: service.serviceUrl || null,
          iconKey: service.iconKey,
          enabled: service.enabled,
        };
        if (portalData.services.some((item) => item.id === service.id)) {
          await updateService(apiBaseUrl, service.id, input);
        } else {
          await createService(apiBaseUrl, input);
        }
      } else {
        const mutation = entity as DeviceMutation;
        const existing = portalData.devices.some(
          (item) => item.id === mutation.device.id,
        );
        const nextMembershipIds = new Set(
          mutation.deviceNetworks.map((membership) => membership.id),
        );
        const blockedMembership = portalData.deviceNetworks.find(
          (membership) =>
            membership.deviceId === mutation.device.id &&
            !nextMembershipIds.has(membership.id) &&
            portalData.services.some(
              (service) => service.deviceNetworkId === membership.id,
            ),
        );
        if (blockedMembership) {
          throw new Error(
            "サービスが紐づく所属IPを削除する前に、サービスを削除または移動してください",
          );
        }
        const deviceInput: PortalDeviceInput = {
          hostname: mutation.device.name.trim(),
          petname: mutation.device.petname?.trim() || null,
          category: mutation.device.category,
          isVm: mutation.device.isVm,
          sshUser: mutation.device.ssh?.user || null,
          sshPort: mutation.device.ssh?.port ?? null,
          meterEnabled: mutation.device.meterEnabled ?? false,
          note: mutation.device.note || null,
        };
        let savedDeviceId = mutation.device.id;
        if (existing) {
          await updateDevice(apiBaseUrl, savedDeviceId, deviceInput);
        } else {
          const created = (await createDevice(
            apiBaseUrl,
            deviceInput,
          )) as { id: number };
          savedDeviceId = String(created.id);
        }

        const currentMemberships = portalData.deviceNetworks.filter(
          (membership) => membership.deviceId === savedDeviceId,
        );
        for (const membership of currentMemberships) {
          if (!nextMembershipIds.has(membership.id)) {
            await deleteMembership(apiBaseUrl, membership.id);
          }
        }
        for (const membership of mutation.deviceNetworks) {
          const input = {
            deviceId: Number(savedDeviceId),
            networkId: Number(membership.networkId),
            ip: membership.ip.trim() || null,
            label: membership.label || null,
          };
          if (
            currentMemberships.some((item) => item.id === membership.id)
          ) {
            await updateMembership(apiBaseUrl, membership.id, input);
          } else {
            await createMembership(apiBaseUrl, input);
          }
        }

        const relationColors = new Map(
          portalData.relations.map((relation) => [
            relation.tag.trim(),
            relation.color.trim(),
          ]),
        );
        const recoloredTags = new Set<string>();
        for (const relation of mutation.relations) {
          const tag = relation.tag.trim();
          const color = relation.color.trim();
          const currentColor = relationColors.get(tag);
          if (
            tag &&
            color &&
            currentColor &&
            currentColor !== color &&
            !recoloredTags.has(tag)
          ) {
            await updateRelationTagColor(apiBaseUrl, tag, color);
            recoloredTags.add(tag);
          }
        }

        const currentRelations = portalData.relations.filter(
          (relation) => relation.fromDeviceId === savedDeviceId,
        );
        const nextRelationIds = new Set(
          mutation.relations.map((relation) => relation.id),
        );
        for (const relation of currentRelations) {
          if (!nextRelationIds.has(relation.id)) {
            await deleteRelation(apiBaseUrl, relation.id);
          }
        }
        for (const relation of mutation.relations) {
          const input = {
            fromDeviceId: Number(savedDeviceId),
            toDeviceId: Number(relation.toDeviceId),
            tag: relation.tag.trim(),
            fromLabel: relation.fromLabel || null,
            toLabel: relation.toLabel || null,
            color: relation.color.trim(),
          };
          if (
            currentRelations.some(
              (currentRelation) => currentRelation.id === relation.id,
            )
          ) {
            await updateRelation(apiBaseUrl, relation.id, input);
          } else {
            await createRelation(apiBaseUrl, input);
          }
        }
      }
      setMessage(`${KIND_LABELS[kind]}を保存しました。`);
      setDialog(null);
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  function toggleSelection(deviceId: string) {
    setSelectedDeviceId((current) =>
      current === deviceId ? undefined : deviceId,
    );
  }

  function updateConnectorTooltip(
    event: React.PointerEvent<SVGGElement>,
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
          {isReadOnly ? (
            <span className="ouchi-readonly-note">表示専用デモ</span>
          ) : (
            <button
              className="ouchi-manage-button"
              onClick={() => {
                setManageOpen(true);
                setMessage(undefined);
              }}
              type="button"
            >
              <SettingsIcon size={19} />
              管理
            </button>
          )}
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
                onPointerEnter={(event) =>
                  updateConnectorTooltip(event, connector)
                }
                onPointerLeave={() => setConnectorTooltip(undefined)}
                onPointerMove={(event) =>
                  updateConnectorTooltip(event, connector)
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
        {connectorTooltip && (
          <div
            className="ouchi-relation-tooltip"
            role="tooltip"
            style={{
              left: connectorTooltip.x,
              top: connectorTooltip.y,
            }}
          >
            {connectorTooltip.text}
          </div>
        )}
        {loading && !loadedData ? (
          <div className="ouchi-global-empty" role="status">
            <strong>台帳を読み込んでいます</strong>
            <p>
              {yamlUrl
                ? "同梱されたサンプルYAMLを読み込んでいます。"
                : "SQLite台帳へ API で接続しています。"}
            </p>
          </div>
        ) : apiError && !loadedData ? (
          <div className="ouchi-global-empty" role="alert">
            <strong>
              {yamlUrl ? "YAMLを読み込めません" : "APIへ接続できません"}
            </strong>
            <p>{apiError}</p>
            <button
              className="ouchi-primary-button"
              onClick={() => void reload()}
              type="button"
            >
              再読み込み
            </button>
          </div>
        ) : portalData.networks.length === 0 ? (
          <div className="ouchi-global-empty">
            <strong>デバイス未登録</strong>
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
            demoMode={isReadOnly}
            allowRemoteIcons={!isReadOnly}
            iconBaseUrl={apiBaseUrl}
            onDemoServiceClick={() => setDemoServiceNoticeOpen(true)}
            onSelect={toggleSelection}
            selectedDeviceId={selectedDeviceId}
          />
        ) : (
          <ListBoard
            data={portalData}
            demoMode={isReadOnly}
            onDemoServiceClick={() => setDemoServiceNoticeOpen(true)}
            onSelect={toggleSelection}
            selectedDeviceId={selectedDeviceId}
          />
        )}
      </div>

      {!isReadOnly && (
        <ManageDrawer
          activeTab={manageTab}
          data={portalData}
          message={message}
          onExportLedger={handleExportLedger}
          onImportLedger={handleImportLedger}
          onSavePortalTitle={handleSavePortalTitle}
          onAdd={openAdd}
          onClose={() => {
            setManageOpen(false);
            setDialog(null);
            setConfirm(null);
          }}
          onDelete={requestDelete}
          onEdit={openEdit}
          onTabChange={(tab) => {
            setManageTab(tab);
            setMessage(undefined);
          }}
          open={manageOpen}
          portalTitle={portalTitle}
          warning={seedWarning ?? apiError}
        />
      )}

      {!isReadOnly && dialog && (
        <EntityDialog
          data={portalData}
          editingId={dialog.editingId}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      )}

      {!isReadOnly && confirm?.type === "delete" && (
        <ConfirmDialog
          description={`「${entityName(confirm.kind, confirm.id)}」を削除します。この操作は元に戻せません。`}
          onCancel={() => setConfirm(null)}
          onConfirm={handleDelete}
          title={`${KIND_LABELS[confirm.kind]}を削除しますか？`}
        />
      )}

      {isReadOnly && demoServiceNoticeOpen && (
        <DemoServiceLinkDialog
          onClose={() => setDemoServiceNoticeOpen(false)}
        />
      )}

    </section>
  );
}
