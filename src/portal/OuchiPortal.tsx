import { useEffect, useMemo, useState } from "react";
import { portalDemoData } from "./demoData";
import {
  EntityDialog,
  ConfirmDialog,
  type PortalEntity,
} from "./EntityDialog";
import {
  GridIcon,
  ExternalLinkIcon,
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
  type PortalDataV1,
  type PortalDevice,
  type PortalNetwork,
  type PortalService,
  type PortalStatus,
} from "./types";
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

const EMPTY_DATA: PortalDataV1 = {
  version: 1,
  networks: [],
  devices: [],
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

function ServiceTile({ service }: { service: PortalService }) {
  return (
    <a
      className="ouchi-service-tile"
      href={service.url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="ouchi-service-icon-wrap">
        <ServiceIcon iconKey={service.iconKey} />
        <span
          aria-label={STATUS_LABELS[service.status]}
          className={`ouchi-service-status ouchi-status--${service.status}`}
          role="img"
          title={STATUS_LABELS[service.status]}
        />
      </span>
      <strong>{service.name}</strong>
      <small>{service.subtitle || "サービス"}</small>
    </a>
  );
}

function NetworkCard({
  network,
  devices,
  services,
}: {
  network: PortalNetwork;
  devices: PortalDevice[];
  services: PortalService[];
}) {
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
        {network.cidr && <code>{network.cidr}</code>}
      </header>

      {devices.length === 0 ? (
        <div className="ouchi-empty-network">
          <strong>デバイス未登録</strong>
          <p>管理画面から、このネットワークへデバイスを追加できます。</p>
        </div>
      ) : (
        <div className="ouchi-node-grid">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              services={services.filter(
                (service) => service.deviceId === device.id,
              )}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function DeviceCard({
  device,
  services,
}: {
  device: PortalDevice;
  services: PortalService[];
}) {
  return (
    <section
      aria-labelledby={`device-${device.id}`}
      className={`ouchi-node-card${device.isVm ? " ouchi-device-card--vm" : ""}`}
    >
      <header className="ouchi-node-header">
        <div>
          <div className="ouchi-device-title">
            {device.isVm && (
              <span className="ouchi-vm-badge" aria-hidden="true">
                VM
              </span>
            )}
            <h3 id={`device-${device.id}`}>{device.name}</h3>
          </div>
          <p>{device.ip}</p>
        </div>
        <StatusDot status={aggregateStatus(services)} withLabel />
      </header>
      {services.length === 0 ? (
        <p className="ouchi-node-empty">サービス未登録</p>
      ) : (
        <div className="ouchi-service-grid">
          {services.map((service) => (
            <ServiceTile key={service.id} service={service} />
          ))}
        </div>
      )}
    </section>
  );
}

function IconBoard({
  data,
}: {
  data: PortalDataV1;
}) {
  return (
    <div className="ouchi-network-stack">
      {data.networks.map((network) => (
        <NetworkCard
          key={network.id}
          network={network}
          devices={data.devices.filter(
            (device) => device.networkId === network.id,
          )}
          services={data.services}
        />
      ))}
    </div>
  );
}

function ListService({ service }: { service: PortalService }) {
  return (
    <a
      className="ouchi-list-service"
      href={service.url}
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

function ListBoard({ data }: { data: PortalDataV1 }) {
  return (
    <div className="ouchi-list-stack">
      {data.networks.map((network) => {
        const devices = data.devices.filter(
          (device) => device.networkId === network.id,
        );
        const vmCount = devices.filter((device) => device.isVm).length;

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
                デバイス {devices.length}台 / VM {vmCount}台
              </span>
            </header>

            {devices.length === 0 ? (
              <p className="ouchi-list-empty">デバイス未登録</p>
            ) : (
              <div className="ouchi-list-node-list">
                {devices.map((device) => {
                  const deviceServices = data.services.filter(
                    (service) => service.deviceId === device.id,
                  );
                  return (
                    <div
                      className={`ouchi-list-node${device.isVm ? " ouchi-list-node--vm" : ""}`}
                      key={device.id}
                    >
                      <div className="ouchi-list-node-summary">
                        <div className="ouchi-list-node-meta">
                          <StatusDot
                            status={aggregateStatus(deviceServices)}
                            withLabel
                          />
                          {device.isVm && (
                            <span className="ouchi-vm-badge">VM</span>
                          )}
                          <strong>{device.name}</strong>
                          <code>{device.ip}</code>
                        </div>
                        <div className="ouchi-list-services">
                          {deviceServices.length === 0 ? (
                            <span className="ouchi-list-service-empty">
                              サービス未登録
                            </span>
                          ) : (
                            deviceServices.map((service) => (
                              <ListService key={service.id} service={service} />
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
  storageKey = "ouchi.local.portal.v5",
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

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(undefined), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

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
      const childCount = portalData.devices.filter(
        (device) => device.networkId === id,
      ).length;
      if (childCount > 0) {
        setMessage(
          `デバイスが${childCount}件登録されています。先にデバイスを削除または移動してください。`,
        );
        return;
      }
    }

    if (kind === "device") {
      const childCount = portalData.services.filter(
        (service) => service.deviceId === id,
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
        };
      }
      return {
        ...current,
        services: current.services.filter(
          (service) => service.id !== confirm.id,
        ),
      };
    });
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

      if (kind === "device") {
        const device = entity as PortalDevice;
        const exists = current.devices.some(
          (item) => item.id === device.id,
        );
        return {
          ...current,
          devices: exists
            ? current.devices.map((item) =>
                item.id === device.id ? device : item,
              )
            : [...current.devices, device],
        };
      }

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
    });
    setMessage(`${KIND_LABELS[kind]}を保存しました。`);
    setDialog(null);
  }

  function handleReset() {
    resetData();
    setConfirm(null);
    setDialog(null);
    setMessage("初期データへ戻しました。");
  }

  const vmCount = portalData.devices.filter((device) => device.isVm).length;
  const screenReaderSummary = `${portalData.networks.length}ネットワーク、${portalData.devices.length}デバイス（VM ${vmCount}）、${portalData.services.length}サービス`;

  return (
    <section
      aria-label="ouchi.local ポータル"
      className={`ouchi-portal${className ? ` ${className}` : ""}`}
    >
      <header className="ouchi-portal-header">
        <div className="ouchi-title-block">
          <p className="ouchi-eyebrow">OUCHI.LOCAL</p>
          <h2>ポータル</h2>
          <p className="ouchi-summary">{screenReaderSummary}</p>
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
              アイコン
            </button>
            <button
              aria-pressed={viewMode === "list"}
              className={viewMode === "list" ? "is-active" : ""}
              onClick={() => setViewMode("list")}
              type="button"
            >
              <ListIcon size={18} />
              リスト
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
          <IconBoard data={portalData} />
        ) : (
          <ListBoard data={portalData} />
        )}
      </div>

      <footer className="ouchi-portal-footer">
        <p>
          ネットワークごとに物理デバイス、VM、サービスを整理しています。状態は10秒ごとに更新されます。
        </p>
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
