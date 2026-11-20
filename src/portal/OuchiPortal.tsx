import {
  useEffect,
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
  ServiceIcon,
  SettingsIcon,
} from "./icons";
import {
  ManageDrawer,
  type EntityKind,
  type ManageTab,
} from "./ManageDrawer";
import {
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
        <div className="ouchi-node-grid">
          {memberships.map((membership) => {
            const device = data.devices.find(
              (item) => item.id === membership.deviceId,
            );
            if (!device) {
              return null;
            }
            const services = data.services.filter(
              (service) => service.deviceNetworkId === membership.id,
            );
            return (
              <DeviceCard
                key={membership.id}
                device={device}
                membership={membership}
                onSelect={onSelect}
                sameDevice={(membershipCounts.get(device.id) ?? 0) > 1}
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
      {data.networks.map((network) => (
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
      {data.networks.map((network) => {
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
              <div className="ouchi-list-node-list">
                {memberships.map((membership) => {
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
                  const selected = device.id === selectedDeviceId;
                  return (
                    <div
                      className={[
                        "ouchi-list-node",
                        device.isVm ? "ouchi-list-node--vm" : "",
                        `ouchi-list-node--${visual.mode}`,
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                        visual.mode === "related" && visual.color
                          ? ({
                              "--ouchi-relation-color": visual.color,
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
                            <span className="ouchi-vm-badge">VM</span>
                          )}
                          {selected &&
                            (membershipCounts.get(device.id) ?? 0) > 1 && (
                            <span className="ouchi-same-device-badge">
                              同一デバイス
                            </span>
                            )}
                          <code>{membership.ip}</code>
                          {membership.label && <small>{membership.label}</small>}
                          {visual.mode === "related" &&
                            visual.tags.map((tag, index) => (
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
  );
}

export function OuchiPortal({
  data,
  storageKey = "ouchi.local.portal.v10",
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
      aria-label="ouchi.local ポータル"
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
      <header className="ouchi-portal-header">
        <div className="ouchi-title-block">
          <span className="ouchi-home-mark" aria-hidden="true">
            家
          </span>
          <div>
            <h2>ouchi.local</h2>
            <p className="ouchi-summary">
              ポータル — おうちのサービスは、ここから全部入る
            </p>
            <span className="ouchi-visually-hidden">{screenReaderSummary}</span>
          </div>
        </div>

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
        </div>
      </header>

      <div className="ouchi-canvas">
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
