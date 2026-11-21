import { useEffect, useState } from "react";
import {
  ACCENT_LABELS,
  DEVICE_CATEGORY_LABELS,
  ICON_LABELS,
  type PortalDataV2,
  type PortalDevice,
  type PortalNetwork,
  type PortalService,
} from "./types";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  CloseIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";
import { PortalApiError } from "./apiClient";
import {
  MAX_PORTAL_TITLE_LENGTH,
  validateSettingsTitle,
} from "./validation";

export type ManageTab = "networks" | "devices" | "services";
export type EntityKind = "network" | "device" | "service";

interface ManageDrawerProps {
  open: boolean;
  activeTab: ManageTab;
  data: PortalDataV2;
  portalTitle?: string;
  warning?: string;
  message?: string;
  onSavePortalTitle: (title: string) => Promise<void>;
  onExportLedger: () => Promise<string>;
  onImportLedger: (yaml: string) => Promise<string>;
  onClose: () => void;
  onTabChange: (tab: ManageTab) => void;
  onAdd: (kind: EntityKind) => void;
  onEdit: (kind: EntityKind, id: string) => void;
  onDelete: (kind: EntityKind, id: string) => void;
}

const TAB_LABELS: Record<ManageTab, string> = {
  networks: "ネットワーク",
  devices: "デバイス",
  services: "サービス",
};

export function ManageDrawer({
  open,
  activeTab,
  data,
  portalTitle,
  warning,
  message,
  onSavePortalTitle,
  onExportLedger,
  onImportLedger,
  onClose,
  onTabChange,
  onAdd,
  onEdit,
  onDelete,
}: ManageDrawerProps) {
  const [titleDraft, setTitleDraft] = useState(portalTitle ?? "");
  const [importFile, setImportFile] = useState<{
    name: string;
    yaml: string;
  }>();
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string>();
  const [transferError, setTransferError] = useState<string>();
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string>();

  useEffect(() => {
    if (open) {
      setTitleDraft(portalTitle ?? "");
      setTitleError(undefined);
    }
  }, [open, portalTitle]);

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
    (activeTab === "services" && data.deviceNetworks.length === 0);
  const normalizedTitle = titleDraft.trim();
  const titleSaveDisabled =
    !normalizedTitle || normalizedTitle === portalTitle || titleSaving;

  async function savePortalTitle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issues = validateSettingsTitle(titleDraft);
    if (issues.length > 0) {
      setTitleError(issues.map((issue) => issue.message).join(" / "));
      return;
    }
    setTitleSaving(true);
    setTitleError(undefined);
    try {
      await onSavePortalTitle(normalizedTitle);
    } catch (cause) {
      setTitleError(transferFailure(cause));
    } finally {
      setTitleSaving(false);
    }
  }

  function transferFailure(cause: unknown) {
    if (cause instanceof PortalApiError) {
      if (cause.issues.length > 0) {
        return cause.issues.map((issue) => issue.message).join(" / ");
      }
      return cause.message;
    }
    return cause instanceof Error
      ? cause.message
      : "設定の移行処理に失敗しました";
  }

  async function selectImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setTransferNotice(undefined);
    setTransferError(undefined);
    if (!file) {
      setImportFile(undefined);
      return;
    }
    try {
      setImportFile({ name: file.name, yaml: await file.text() });
    } catch (cause) {
      setImportFile(undefined);
      setTransferError(transferFailure(cause));
    }
  }

  async function exportLedgerFile() {
    setTransferBusy(true);
    setTransferNotice(undefined);
    setTransferError(undefined);
    try {
      const filename = await onExportLedger();
      setTransferNotice(`${filename} をダウンロードしました。`);
    } catch (cause) {
      setTransferError(transferFailure(cause));
    } finally {
      setTransferBusy(false);
    }
  }

  async function applyImport() {
    if (!importFile) {
      return;
    }
    setTransferBusy(true);
    setTransferNotice(undefined);
    setTransferError(undefined);
    try {
      const result = await onImportLedger(importFile.yaml);
      setTransferNotice(result);
      setImportFile(undefined);
    } catch (cause) {
      setTransferError(transferFailure(cause));
    } finally {
      setTransferBusy(false);
    }
  }

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
            <p className="ouchi-eyebrow">PORTAL DATA V2</p>
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

        {portalTitle !== undefined && (
          <section
            aria-labelledby="ouchi-portal-title-settings"
            className="ouchi-portal-title-settings"
          >
            <div>
              <p className="ouchi-eyebrow">PORTAL LABEL</p>
              <h4 id="ouchi-portal-title-settings">
                ポータルのタイトル
              </h4>
              <p>ポータル左上に表示する名前を設定できます。</p>
            </div>
            <form onSubmit={savePortalTitle}>
              <div className="ouchi-setting-fields">
                <label>
                  <span>ドメイン</span>
                  <input
                    aria-label="ポータルドメイン"
                    readOnly
                    value={data.settings?.domain ?? "ouchi.local"}
                  />
                </label>
                <label>
                  <span>ポータルタイトル</span>
                  <input
                    aria-label="ポータルタイトル"
                    maxLength={MAX_PORTAL_TITLE_LENGTH}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    value={titleDraft}
                  />
                </label>
              </div>
              <button
                className="ouchi-primary-button ouchi-primary-button--compact"
                disabled={titleSaveDisabled}
                type="submit"
              >
                {titleSaving ? "保存中" : "タイトルを保存"}
              </button>
            </form>
            {titleError && (
              <p className="ouchi-portal-title-error" role="alert">
                {titleError}
              </p>
            )}
          </section>
        )}

        <section
          aria-labelledby="ouchi-ledger-transfer"
          className="ouchi-ledger-transfer"
        >
          <div className="ouchi-ledger-transfer-heading">
            <div>
              <p className="ouchi-eyebrow">TEXT TRANSFER</p>
              <h4 id="ouchi-ledger-transfer">設定のエクスポート／インポート</h4>
              <p>
                YAMLで台帳一式を移行します。公開鍵だけを出力し、秘密情報は含めません。
              </p>
            </div>
            <button
              className="ouchi-secondary-button ouchi-primary-button--compact"
              disabled={transferBusy}
              onClick={() => void exportLedgerFile()}
              type="button"
            >
              YAMLをエクスポート
            </button>
          </div>

          <div className="ouchi-ledger-import">
            <label className="ouchi-ledger-file-picker">
              <span>インポートするYAML</span>
              <input
                accept=".yaml,.yml,application/yaml,text/yaml"
                aria-label="インポートするYAMLファイル"
                disabled={transferBusy}
                onChange={(event) => void selectImportFile(event)}
                type="file"
              />
            </label>

            {importFile && (
              <div className="ouchi-ledger-preview">
                <div>
                  <strong>{importFile.name}</strong>
                  <span>{importFile.yaml.length.toLocaleString()} 文字</span>
                </div>
                <pre aria-label="インポート内容のプレビュー">
                  {importFile.yaml.slice(0, 3000)}
                  {importFile.yaml.length > 3000 ? "\n…" : ""}
                </pre>
                <p className="ouchi-ledger-warning" role="alert">
                  適用すると現在のネットワーク、デバイス、所属IP、関係、サービス、鍵情報は
                  すべて置き換わります。内容を確認してから適用してください。
                </p>
                <button
                  className="ouchi-danger-button ouchi-primary-button--compact"
                  disabled={transferBusy}
                  onClick={() => void applyImport()}
                  type="button"
                >
                  内容を確認して全置き換え
                </button>
              </div>
            )}
          </div>

          {transferError && (
            <p className="ouchi-ledger-transfer-error" role="alert">
              {transferError}
            </p>
          )}
          {transferNotice && (
            <p className="ouchi-ledger-transfer-notice" role="status">
              {transferNotice}
            </p>
          )}
        </section>

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
                "カテゴリー、所属IP、SSH接続情報、関係を管理します"}
              {activeTab === "services" &&
                "サービスをデバイスのアクセスIPへ配置します"}
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
                : "先にデバイスと所属IPを追加してください。"}
            </p>
          )}

          <div className="ouchi-manage-list">
            {activeTab === "networks" &&
              sortNetworksForDisplay(data.networks).map((network) => (
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
          <span>SQLite台帳（API）へ保存</span>
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
  data: PortalDataV2;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const memberships = data.deviceNetworks.filter(
    (membership) => membership.networkId === network.id,
  );
  const deviceCount = new Set(
    memberships.map((membership) => membership.deviceId),
  ).size;

  return (
    <article className="ouchi-manage-row">
      <span
        aria-hidden="true"
        className={`ouchi-manage-accent ouchi-accent--${network.accent}`}
      />
      <div className="ouchi-manage-row-main">
        <strong>{network.name}</strong>
        <p>
          {network.cidr || "CIDRなし"} ・ デバイス {deviceCount}件 ・ 所属IP{" "}
          {memberships.length}件
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
  data: PortalDataV2;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const memberships = data.deviceNetworks.filter(
    (membership) => membership.deviceId === device.id,
  );
  const membershipIds = new Set(
    memberships.map((membership) => membership.id),
  );
  const serviceCount = data.services.filter((service) =>
    membershipIds.has(service.deviceNetworkId),
  ).length;
  const relationCount = data.relations.filter(
    (relation) =>
      relation.fromDeviceId === device.id ||
      relation.toDeviceId === device.id,
  ).length;
  const networkNames = memberships
    .map(
      (membership) =>
        data.networks.find(
          (network) => network.id === membership.networkId,
        )?.name,
    )
    .filter(Boolean)
    .join(" / ");

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
          {networkNames || "未所属"} ・ サービス {serviceCount}件 ・ 関係{" "}
          {relationCount}件
        </p>
      </div>
      <span className="ouchi-manage-chip">
        {DEVICE_CATEGORY_LABELS[device.category]}
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
  data: PortalDataV2;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const membership = data.deviceNetworks.find(
    (item) => item.id === service.deviceNetworkId,
  );
  const device = data.devices.find(
    (item) => item.id === membership?.deviceId,
  );
  const network = data.networks.find(
    (item) => item.id === membership?.networkId,
  );
  const targetLabel =
    membership && device
      ? `${device.name} / ${membership.ip} / ${network?.name ?? "未所属"}`
      : "配置先IPなし";
  const serviceUrl = service.url;

  return (
    <article className="ouchi-manage-row">
      <div className="ouchi-manage-row-main">
        <strong>{service.petname?.trim() || service.subdomain}</strong>
        <p title={serviceUrl ?? undefined}>
          {targetLabel} ・ {ICON_LABELS[service.iconKey]}
        </p>
      </div>
      <RowActions
        deleteLabel={`${service.petname?.trim() || service.subdomain}を削除`}
        editLabel={`${service.petname?.trim() || service.subdomain}を編集`}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </article>
  );
}
