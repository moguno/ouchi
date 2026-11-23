import "./styles/manage-simple.css";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type {
  PortalDataV2,
  PortalRelationName,
} from "./types";
import { PortalApiError } from "./apiClient";
import { validateSettingsTitle } from "./validation";
import type { EntityKind, ManageTab } from "./managementTypes";
import {
  CommonSettingsTab,
  type LedgerImportFile,
} from "./CommonSettingsTab";
import { DevicesTab } from "./DevicesTab";
import { NetworksTab } from "./NetworksTab";
import { RelationsTab } from "./RelationsTab";
import { ServicesTab } from "./ServicesTab";

interface ManageViewProps {
  activeTab: ManageTab;
  data: PortalDataV2;
  portalTitle?: string;
  warning?: string;
  message?: string;
  onBack: () => void;
  onSavePortalTitle: (title: string) => Promise<void>;
  onExportLedger: () => Promise<string>;
  onImportLedger: (yaml: string) => Promise<string>;
  onTabChange: (tab: ManageTab) => void;
  onAdd: (kind: EntityKind) => void;
  onEdit: (kind: EntityKind, id: string) => void;
  onDelete: (kind: EntityKind, id: string) => void;
  onDeviceMemo: (id: string) => void;
  onServiceMemo: (id: string) => void;
  onServiceTop: (id: string) => void;
  onServiceIcon: (id: string) => void;
  onAddRelation: () => void;
  onEditRelation: (id: string) => void;
  onDeleteRelation: (id: string) => void;
  onDeleteRelationName: (id: string) => void;
  onSaveRelationName: (relationName: PortalRelationName) => Promise<boolean>;
  savingDisabled?: boolean;
}

const TAB_LABELS: Record<ManageTab, string> = {
  networks: "ネットワーク",
  devices: "デバイス",
  services: "サービス",
  relations: "関係",
  settings: "共通設定",
};

export function ManageView({
  activeTab,
  data,
  portalTitle,
  warning,
  message,
  onBack,
  onSavePortalTitle,
  onExportLedger,
  onImportLedger,
  onTabChange,
  onAdd,
  onEdit,
  onDelete,
  onDeviceMemo,
  onServiceMemo,
  onServiceTop,
  onServiceIcon,
  onAddRelation,
  onEditRelation,
  onDeleteRelation,
  onDeleteRelationName,
  onSaveRelationName,
  savingDisabled = false,
}: ManageViewProps) {
  const [titleDraft, setTitleDraft] = useState(portalTitle ?? "");
  const [importFile, setImportFile] = useState<LedgerImportFile>();
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferNotice, setTransferNotice] = useState<string>();
  const [transferError, setTransferError] = useState<string>();
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string>();

  useEffect(() => {
    setTitleDraft(portalTitle ?? "");
    setTitleError(undefined);
  }, [portalTitle]);

  const entityCounts = {
    networks: data.networks.length,
    devices: data.devices.length,
    services: data.services.length,
  };
  const normalizedTitle = titleDraft.trim();
  const titleSaveDisabled =
    savingDisabled ||
    !normalizedTitle ||
    normalizedTitle === portalTitle ||
    titleSaving;
  const relationAddDisabled =
    data.devices.length < 2 || data.relationNames.length === 0;

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

  async function savePortalTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingDisabled) {
      return;
    }
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

  async function selectImportFile(event: ChangeEvent<HTMLInputElement>) {
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
    if (savingDisabled || !importFile) {
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
    <section
      aria-label="ポータルを管理"
      className="ouchi-manage-view"
      role="region"
    >
      <header className="ouchi-manage-view-header">
        <button
          aria-label="ポータルに戻る"
          className="ouchi-manage-back"
          onClick={onBack}
          type="button"
        >
          ← ポータルに戻る
        </button>
        <h1>ポータルを管理</h1>
        <span className="ouchi-manage-view-domain">
          {data.settings?.domain ?? "ouchi.local"}
        </span>
      </header>

      {savingDisabled && (
        <div className="ouchi-manage-demo-notice" role="note">
          デモモードでは保存されません。入力や画面操作は試せますが、追加・編集・削除・インポート・タイトル保存は無効です。YAMLエクスポートは利用できます。
        </div>
      )}

      {(warning || message) && (
        <div
          className={`ouchi-manage-notice${message ? " ouchi-manage-notice--error" : ""}`}
          role="status"
        >
          {message ?? warning}
        </div>
      )}

      <nav aria-label="管理メニュー" className="ouchi-manage-tabs">
        {(Object.keys(TAB_LABELS) as ManageTab[]).map((tab) => (
          <button
            aria-controls={`ouchi-manage-panel-${tab}`}
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            id={`ouchi-manage-tab-${tab}`}
            key={tab}
            onClick={() => onTabChange(tab)}
            role="tab"
            type="button"
          >
            {TAB_LABELS[tab]}
            {tab in entityCounts
              ? ` (${entityCounts[tab as keyof typeof entityCounts]})`
              : ""}
          </button>
        ))}
      </nav>

      <div
        aria-labelledby={`ouchi-manage-tab-${activeTab}`}
        className="ouchi-manage-view-body"
        id={`ouchi-manage-panel-${activeTab}`}
        role="tabpanel"
      >
        {activeTab === "settings" && (
          <CommonSettingsTab
            data={data}
            importFile={importFile}
            onApplyImport={() => void applyImport()}
            onExportLedger={() => void exportLedgerFile()}
            onSavePortalTitle={(event) => void savePortalTitle(event)}
            onSelectImportFile={(event) =>
              void selectImportFile(event)
            }
            onTitleDraftChange={setTitleDraft}
            titleDraft={titleDraft}
            titleError={titleError}
            titleSaveDisabled={titleSaveDisabled}
            titleSaving={titleSaving}
            transferBusy={transferBusy}
            saveDisabled={savingDisabled}
            transferError={transferError}
            transferNotice={transferNotice}
          />
        )}
        {activeTab === "networks" && (
          <NetworksTab
            data={data}
            onAdd={() => onAdd("network")}
            onDelete={(id) => onDelete("network", id)}
            onEdit={(id) => onEdit("network", id)}
            saveDisabled={savingDisabled}
          />
        )}
        {activeTab === "devices" && (
          <DevicesTab
            data={data}
            onAdd={() => onAdd("device")}
            onDelete={(id) => onDelete("device", id)}
            onDeviceMemo={onDeviceMemo}
            onEdit={(id) => onEdit("device", id)}
            saveDisabled={savingDisabled}
          />
        )}
        {activeTab === "services" && (
          <ServicesTab
            data={data}
            onAdd={() => onAdd("service")}
            onDelete={(id) => onDelete("service", id)}
            onEdit={(id) => onEdit("service", id)}
            onServiceIcon={onServiceIcon}
            onServiceMemo={onServiceMemo}
            onServiceTop={onServiceTop}
            saveDisabled={savingDisabled}
          />
        )}
        {activeTab === "relations" && (
          <RelationsTab
            addDisabled={relationAddDisabled}
            data={data}
            onAdd={onAddRelation}
            onDelete={onDeleteRelation}
            onDeleteRelationName={onDeleteRelationName}
            onEdit={onEditRelation}
            onSaveRelationName={onSaveRelationName}
            saveDisabled={savingDisabled}
          />
        )}
      </div>

      <footer className="ouchi-manage-view-footer">
        {savingDisabled
          ? "デモモード: 保存無効"
          : "SQLite台帳（API）へ保存"}
      </footer>
    </section>
  );
}
