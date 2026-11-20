import {
  ACCENT_LABELS,
  ICON_LABELS,
  STATUS_LABELS,
  type PortalDataV1,
  type PortalDevice,
  type PortalNetwork,
  type PortalService,
} from "./types";
import {
  CloseIcon,
  EditIcon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
} from "./icons";

export type ManageTab = "networks" | "devices" | "services";
export type EntityKind = "network" | "device" | "service";

interface ManageDrawerProps {
  open: boolean;
  activeTab: ManageTab;
  data: PortalDataV1;
  warning?: string;
  message?: string;
  onClose: () => void;
  onTabChange: (tab: ManageTab) => void;
  onAdd: (kind: EntityKind) => void;
  onEdit: (kind: EntityKind, id: string) => void;
  onDelete: (kind: EntityKind, id: string) => void;
  onReset: () => void;
}

const TAB_LABELS: Record<ManageTab, string> = {
  networks: "ネットワーク",
  devices: "デバイス",
  services: "サービス",
};

function statusLabel(service: PortalService) {
  return STATUS_LABELS[service.status];
}

export function ManageDrawer({
  open,
  activeTab,
  data,
  warning,
  message,
  onClose,
  onTabChange,
  onAdd,
  onEdit,
  onDelete,
  onReset,
}: ManageDrawerProps) {
  if (!open) {
    return null;
  }

  const countByTab: Record<ManageTab, number> = {
    networks: data.networks.length,
    devices: data.devices.length,
    services: data.services.length,
  };

  const addDisabled =
    (activeTab === "devices" && data.networks.length === 0) ||
    (activeTab === "services" && data.devices.length === 0);

  return (
    <div className="ouchi-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        aria-label="ポータルを管理"
        aria-modal="true"
        className="ouchi-manage-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="ouchi-drawer-header">
          <div>
            <p className="ouchi-eyebrow">PORTAL DATA</p>
            <h3>ポータルを管理</h3>
          </div>
          <button
            aria-label="管理画面を閉じる"
            className="ouchi-icon-button"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        {(warning || message) && (
          <div
            className={`ouchi-drawer-notice${message ? " ouchi-drawer-notice--error" : ""}`}
            role="status"
          >
            {message ?? warning}
          </div>
        )}

        <div className="ouchi-drawer-tabs" role="tablist" aria-label="編集対象">
          {(Object.keys(TAB_LABELS) as ManageTab[]).map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={activeTab === tab ? "is-active" : ""}
              key={tab}
              onClick={() => onTabChange(tab)}
              role="tab"
              type="button"
            >
              {TAB_LABELS[tab]}
              <span>{countByTab[tab]}</span>
            </button>
          ))}
        </div>

        <div className="ouchi-drawer-body" role="tabpanel">
          <div className="ouchi-drawer-toolbar">
            <p>
              {activeTab === "networks" && "ネットワークとCIDRを管理します"}
              {activeTab === "devices" &&
                "ネットワークへデバイスを登録し、VMフラグを設定します"}
              {activeTab === "services" && "デバイスへサービスを登録します"}
            </p>
            <button
              className="ouchi-primary-button ouchi-primary-button--compact"
              disabled={addDisabled}
              onClick={() =>
                onAdd(
                  activeTab === "networks"
                    ? "network"
                    : activeTab === "devices"
                      ? "device"
                      : "service",
                )
              }
              type="button"
            >
              <PlusIcon size={17} />
              追加
            </button>
          </div>

          {addDisabled && (
            <p className="ouchi-inline-hint">
              {activeTab === "devices"
                ? "先にネットワークを追加してください。"
                : "先にデバイスを追加してください。"}
            </p>
          )}

          <div className="ouchi-manage-list">
            {activeTab === "networks" &&
              data.networks.map((network) => (
                <NetworkRow
                  data={data}
                  key={network.id}
                  network={network}
                  onDelete={() => onDelete("network", network.id)}
                  onEdit={() => onEdit("network", network.id)}
                />
              ))}
            {activeTab === "devices" &&
              data.devices.map((device) => (
                <DeviceRow
                  data={data}
                  key={device.id}
                  device={device}
                  onDelete={() => onDelete("device", device.id)}
                  onEdit={() => onEdit("device", device.id)}
                />
              ))}
            {activeTab === "services" &&
              data.services.map((service) => (
                <ServiceRow
                  data={data}
                  key={service.id}
                  onDelete={() => onDelete("service", service.id)}
                  onEdit={() => onEdit("service", service.id)}
                  service={service}
                />
              ))}

            {countByTab[activeTab] === 0 && (
              <div className="ouchi-manage-empty">
                <strong>まだ登録がありません</strong>
                <p>右上の「追加」から登録できます。</p>
              </div>
            )}
          </div>
        </div>

        <footer className="ouchi-drawer-footer">
          <button className="ouchi-text-button" onClick={onReset} type="button">
            <ResetIcon size={18} />
            初期データへ戻す
          </button>
          <span>localStorageへ自動保存</span>
        </footer>
      </aside>
    </div>
  );
}

function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="ouchi-row-actions">
      <button
        aria-label={editLabel}
        className="ouchi-icon-button ouchi-icon-button--small"
        onClick={onEdit}
        type="button"
      >
        <EditIcon size={17} />
      </button>
      <button
        aria-label={deleteLabel}
        className="ouchi-icon-button ouchi-icon-button--small ouchi-icon-button--danger"
        onClick={onDelete}
        type="button"
      >
        <TrashIcon size={17} />
      </button>
    </div>
  );
}

function NetworkRow({
  network,
  data,
  onEdit,
  onDelete,
}: {
  network: PortalNetwork;
  data: PortalDataV1;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const devices = data.devices.filter(
    (device) => device.networkId === network.id,
  );
  const vmCount = devices.filter((device) => device.isVm).length;

  return (
    <article className="ouchi-manage-row">
      <span
        aria-hidden="true"
        className={`ouchi-manage-accent ouchi-accent--${network.accent}`}
      />
      <div className="ouchi-manage-row-main">
        <strong>{network.name}</strong>
        <p>
          {network.cidr || "CIDRなし"} ・ デバイス {devices.length}件 ・ VM{" "}
          {vmCount}件
        </p>
      </div>
      <span className="ouchi-manage-chip">
        {ACCENT_LABELS[network.accent]}
      </span>
      <RowActions
        deleteLabel={`${network.name}を削除`}
        editLabel={`${network.name}を編集`}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </article>
  );
}

function DeviceRow({
  device,
  data,
  onEdit,
  onDelete,
}: {
  device: PortalDevice;
  data: PortalDataV1;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const network = data.networks.find(
    (item) => item.id === device.networkId,
  );
  const serviceCount = data.services.filter(
    (service) => service.deviceId === device.id,
  ).length;
  return (
    <article className="ouchi-manage-row">
      <span
        className={
          device.isVm ? "ouchi-manage-vm-mark" : "ouchi-manage-device-mark"
        }
        aria-hidden="true"
      >
        {device.isVm ? "VM" : device.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="ouchi-manage-row-main">
        <strong>{device.name}</strong>
        <p>
          {device.ip} ・ {network?.name ?? "未所属"} ・ サービス{" "}
          {serviceCount}件
        </p>
      </div>
      <span className="ouchi-manage-chip">
        {device.isVm ? "VM" : "物理"}
      </span>
      <RowActions
        deleteLabel={`${device.name}を削除`}
        editLabel={`${device.name}を編集`}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </article>
  );
}

function ServiceRow({
  service,
  data,
  onEdit,
  onDelete,
}: {
  service: PortalService;
  data: PortalDataV1;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const device = data.devices.find(
    (item) => item.id === service.deviceId,
  );
  const targetLabel = device
    ? `${device.name}（${device.isVm ? "VM" : "物理"}）`
    : "配置先なし";

  return (
    <article className="ouchi-manage-row">
      <span
        className={`ouchi-manage-status ouchi-status--${service.status}`}
        title={statusLabel(service)}
      />
      <div className="ouchi-manage-row-main">
        <strong>{service.name}</strong>
        <p>
          {service.subtitle || "補足名なし"} ・ {targetLabel} ・{" "}
          {ICON_LABELS[service.iconKey]}
        </p>
      </div>
      <span className={`ouchi-status-label ouchi-status-label--${service.status}`}>
        {statusLabel(service)}
      </span>
      <RowActions
        deleteLabel={`${service.name}を削除`}
        editLabel={`${service.name}を編集`}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </article>
  );
}
