import "./styles/base.css";
import "./styles/portal-shell.css";
import "./styles/portal-board.css";
import "./styles/entity-dialog.css";
import "./styles/portal-motion.css";
import "./styles/portal.css";
import "./styles/portal-connectors.css";
import "./styles/portal-board-v2.css";
import "./styles/portal-responsive.css";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ConfirmDialog,
  EntityDialog,
  type DeviceMutation,
  type PortalEntity,
} from "./EntityDialog";
import {
  GridIcon,
  ListIcon,
  SettingsIcon,
} from "./icons";
import { DemoServiceLinkDialog } from "./DemoServiceLinkDialog";
import { DeviceMemoDialog } from "./DeviceMemoDialog";
import { NetworkMemoDialog } from "./NetworkMemoDialog";
import { RelationMemoDialog } from "./RelationMemoDialog";
import { ServiceMemoDialog } from "./ServiceMemoDialog";
import { ServiceTopDialog } from "./ServiceTopDialog";
import { ServiceIconDialog } from "./ServiceIconDialog";
import { ManageView } from "./ManageView";
import { MemoView, type MemoTargetKind } from "./MemoView";
import {
  PortalConnectorLayer,
  usePortalConnectors,
} from "./PortalConnectorLayer";
import { IconBoard, ListBoard, RelationFilterBar } from "./PortalBoard";
import {
  loadRelationDisplayModes,
  nextRelationDisplayMode,
  relationDisplayMode,
  saveRelationDisplayModes,
  type RelationDisplayModes,
} from "./relationDisplay";
import { RelationDialog } from "./RelationDialog";
import type { EntityKind, ManageTab } from "./managementTypes";
import {
  type OuchiPortalProps,
  type PortalDevice,
  type PortalDeviceInput,
  type PortalDataV2,
  type PortalNetwork,
  type PortalProperties,
  type PortalRelation,
  type PortalRelationInput,
  type PortalRelationName,
  type PortalService,
  type PortalServiceInput,
} from "./types";
import { serviceName } from "./portalPresentation";
import { usePortalData } from "./usePortalData";
import {
  deleteKindLabel,
  usePortalActions,
  type ConfirmState,
  type DialogState,
} from "./usePortalActions";
import {
  DEFAULT_PORTAL_TITLE,
  validatePortalData,
} from "./validation";
type ViewMode = "icons" | "list";
const EMPTY_DATA: PortalDataV2 = {
  version: 2,
  networks: [],
  devices: [],
  interfaces: [],
  relationNames: [],
  relations: [],
  services: [],
  settings: {
    domain: "ouchi.local",
    title: DEFAULT_PORTAL_TITLE,
  },
};
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
  const demoMode = Boolean(yamlUrl);
  const isReadOnly = readOnly || demoMode;
  const canOpenManage = demoMode || !isReadOnly;
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
  const [memoOpen, setMemoOpen] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>("networks");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [relationDialog, setRelationDialog] = useState<{
    editingId?: string;
  } | null>(null);
  const [networkMemoId, setNetworkMemoId] = useState<string | null>(null);
  const [deviceMemoId, setDeviceMemoId] = useState<string | null>(null);
  const [serviceMemoId, setServiceMemoId] = useState<string | null>(null);
  const [relationMemoId, setRelationMemoId] = useState<string | null>(null);
  const [serviceTopId, setServiceTopId] = useState<string | null>(null);
  const [serviceIconId, setServiceIconId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [message, setMessage] = useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    initialSelectedDeviceId,
  );
  // Selection is unique across the board: a device or a service,
  // never both. Selecting one clears the other.
  const [selectedServiceId, setSelectedServiceId] = useState<
    string | undefined
  >(undefined);
  const [relationModes, setRelationModes] = useState<RelationDisplayModes>(
    loadRelationDisplayModes,
  );
  const cycleRelationMode = (relationName: string) => {
    setRelationModes((previous) => {
      const next = {
        ...previous,
        [relationName]: nextRelationDisplayMode(
          relationDisplayMode(previous, relationName),
        ),
      };
      saveRelationDisplayModes(next);
      return next;
    });
  };
  const portalRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [demoServiceNoticeOpen, setDemoServiceNoticeOpen] = useState(false);
  const {
    connectorHandlers,
    connectorTooltip,
    relationConnectors,
  } = usePortalConnectors({
    canvasRef,
    data: portalData,
    layoutMode: viewMode,
    relationModes,
    selectedDeviceId,
    selectedServiceId,
  });

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(undefined), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (
      (!selectedDeviceId && !selectedServiceId) ||
      manageOpen ||
      typeof document === "undefined"
    ) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !portalRef.current?.contains(event.target)
      ) {
        setSelectedDeviceId(undefined);
        setSelectedServiceId(undefined);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [manageOpen, selectedDeviceId, selectedServiceId]);

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

  function openManagement() {
    setManageTab("networks");
    setManageOpen(true);
    setMessage(undefined);
  }

  function openMemo() {
    setMemoOpen(true);
    setMessage(undefined);
  }

  function openAddRelation() {
    setRelationDialog({});
    setMessage(undefined);
  }

  function openEditRelation(id: string) {
    setRelationDialog({ editingId: id });
    setMessage(undefined);
  }

  function requestDelete(kind: EntityKind, id: string) {
    setMessage(undefined);
    if (kind === "network") {
      const childCount = portalData.interfaces.filter(
        (iface) => iface.networkId === id,
      ).length;
      if (childCount > 0) {
        setMessage(
          `インターフェースが${childCount}件登録されています。先にデバイスを編集してください。`,
        );
        return;
      }
    }

    setConfirm({ type: "delete", kind, id });
  }

  function requestDeleteRelation(id: string) {
    setMessage(undefined);
    setConfirm({ type: "delete", kind: "relation", id });
  }

  function requestDeleteRelationName(id: string) {
    setMessage(undefined);
    const relationName = portalData.relationNames.find(
      (candidate) => candidate.id === id,
    );
    if (relationName && relationName.relationCount > 0) {
      setMessage(
        `関係名「${relationName.name}」は${relationName.relationCount}件の関係で使用中です。先に関係を削除してください。`,
      );
      return;
    }
    setConfirm({ type: "delete", kind: "relationName", id });
  }

  function entityName(
    kind: EntityKind | "relation" | "relationName",
    id: string,
  ) {
    if (kind === "network") {
      return portalData.networks.find((item) => item.id === id)?.name ?? "";
    }
    if (kind === "device") {
      return portalData.devices.find((item) => item.id === id)?.name ?? "";
    }
    if (kind === "relation") {
      const relation = portalData.relations.find((item) => item.id === id);
      if (!relation) {
        return "";
      }
      const from =
        portalData.devices.find(
          (device) => device.id === relation.fromDeviceId,
        )?.name ?? relation.fromDeviceId;
      const to =
        portalData.devices.find((device) => device.id === relation.toDeviceId)
          ?.name ?? relation.toDeviceId;
      return `${from} → ${to}（${relation.relationName}）`;
    }
    if (kind === "relationName") {
      return (
        portalData.relationNames.find((item) => item.id === id)?.name ?? ""
      );
    }
    const service = portalData.services.find((item) => item.id === id);
    return service ? serviceName(service) : "";
  }
  function deleteConfirmationDescription(
    kind: EntityKind | "relation" | "relationName",
    id: string,
  ) {
    const target = `「${entityName(kind, id)}」を削除します。`;
    if (kind !== "device") {
      return `${target}この操作は元に戻せません。`;
    }

    const interfaceIds = new Set(
      portalData.interfaces
        .filter((iface) => iface.deviceId === id)
        .map((iface) => iface.id),
    );
    const serviceCount = portalData.services.filter((service) =>
      interfaceIds.has(service.interfaceId),
    ).length;
    const relationCount = portalData.relations.filter(
      (relation) =>
        relation.fromDeviceId === id || relation.toDeviceId === id,
    ).length;
    const cascaded = [
      serviceCount > 0 ? `サービス${serviceCount}件` : "",
      relationCount > 0 ? `関係${relationCount}件` : "",
    ].filter(Boolean);
    const cascadeNotice =
      cascaded.length > 0
        ? `${cascaded.join("・")}も一緒に削除されます。`
        : "";
    return `${target}${cascadeNotice}この操作は元に戻せません。`;
  }
  const {
    handleDelete,
    handleExportLedger,
    handleImportLedger,
    handleSavePortalTitle,
    handleSave,
    handleSaveRelation,
    handleSaveDeviceMemo,
    handleSaveServiceMemo,
    handleSaveRelationMemo,
    handleSaveNetworkMemo,
    handleMoveNetwork,
    handleSaveMemoProperties,
    handleSaveServiceTop,
    handleSaveServiceIcon,
    handleSaveRelationName,
  } = usePortalActions({
    apiBaseUrl,
    demoMode,
    yamlUrl,
    portalData,
    reload,
    confirm,
    selectedDeviceId,
    selectedServiceId,
    setMessage,
    setConfirm,
    setDialog,
    setRelationDialog,
    setNetworkMemoId,
    setDeviceMemoId,
    setServiceMemoId,
    setRelationMemoId,
    setServiceTopId,
    setServiceIconId,
    setSelectedDeviceId,
    setSelectedServiceId,
  });
  function toggleSelection(deviceId: string) {
    setSelectedDeviceId((current) =>
      current === deviceId ? undefined : deviceId,
    );
    setSelectedServiceId(undefined);
  }

  function selectService(serviceId: string) {
    setSelectedServiceId((current) =>
      current === serviceId ? undefined : serviceId,
    );
    setSelectedDeviceId(undefined);
  }


  const vmCount = portalData.devices.filter(
    (device) => device.category === "vm",
  ).length;
  const screenReaderSummary = `${portalData.networks.length}ネットワーク、${portalData.devices.length}デバイス（VM ${vmCount}）、${portalData.interfaces.length}インターフェース、${portalData.relations.length}関係、${portalData.services.length}サービス`;
  const memoNetwork = networkMemoId
    ? portalData.networks.find((item) => item.id === networkMemoId)
    : undefined;
  const memoDevice = deviceMemoId
    ? portalData.devices.find((item) => item.id === deviceMemoId)
    : undefined;
  const memoService = serviceMemoId
    ? portalData.services.find((item) => item.id === serviceMemoId)
    : undefined;
  const memoRelation = relationMemoId
    ? portalData.relations.find((item) => item.id === relationMemoId)
    : undefined;
  const memoRelationTitle = memoRelation
    ? `${memoRelation.relationName}（${
        portalData.devices.find(
          (device) => device.id === memoRelation.fromDeviceId,
        )?.name ?? "不明なデバイス"
      } → ${
        portalData.devices.find(
          (device) => device.id === memoRelation.toDeviceId,
        )?.name ?? "不明なデバイス"
      }）のメモ`
    : "";
  const topService = serviceTopId
    ? portalData.services.find((item) => item.id === serviceTopId)
    : undefined;
  const iconService = serviceIconId
    ? portalData.services.find((item) => item.id === serviceIconId)
    : undefined;
  const dialogs = (
    <>
      {canOpenManage && dialog && (
        <EntityDialog
          data={portalData}
          editingId={dialog.editingId}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={handleSave}
          saveDisabled={demoMode}
        />
      )}

      {canOpenManage && relationDialog && (
        <RelationDialog
          data={portalData}
          editing={
            relationDialog.editingId
              ? portalData.relations.find(
                  (relation) => relation.id === relationDialog.editingId,
                )
              : undefined
          }
          onClose={() => setRelationDialog(null)}
          onSave={handleSaveRelation}
          saveDisabled={demoMode}
        />
      )}

      {canOpenManage && memoDevice && (
        <DeviceMemoDialog
          device={memoDevice}
          onClose={() => setDeviceMemoId(null)}
          onSave={handleSaveDeviceMemo}
          saveDisabled={demoMode}
        />
      )}

      {canOpenManage && memoService && (
        <ServiceMemoDialog
          onClose={() => setServiceMemoId(null)}
          onSave={handleSaveServiceMemo}
          saveDisabled={demoMode}
          service={memoService}
        />
      )}

      {canOpenManage && memoRelation && (
        <RelationMemoDialog
          onClose={() => setRelationMemoId(null)}
          onSave={handleSaveRelationMemo}
          relation={memoRelation}
          saveDisabled={demoMode}
          title={memoRelationTitle}
        />
      )}

      {canOpenManage && memoNetwork && (
        <NetworkMemoDialog
          network={memoNetwork}
          onClose={() => setNetworkMemoId(null)}
          onSave={handleSaveNetworkMemo}
          saveDisabled={demoMode}
        />
      )}

      {canOpenManage && topService && (
        <ServiceTopDialog
          data={portalData}
          onClose={() => setServiceTopId(null)}
          onSave={handleSaveServiceTop}
          saveDisabled={demoMode}
          service={topService}
        />
      )}

      {canOpenManage && iconService && (
        <ServiceIconDialog
          data={portalData}
          onClose={() => setServiceIconId(null)}
          onSave={handleSaveServiceIcon}
          saveDisabled={demoMode}
          service={iconService}
        />
      )}

      {canOpenManage && confirm?.type === "delete" && (
        <ConfirmDialog
          confirmDisabled={demoMode}
          description={deleteConfirmationDescription(
            confirm.kind,
            confirm.id,
          )}
          onCancel={() => setConfirm(null)}
          onConfirm={handleDelete}
          title={`${deleteKindLabel(confirm.kind)}を削除しますか？`}
        />
      )}
    </>
  );

  if (canOpenManage && memoOpen) {
    return (
      <MemoView
        data={portalData}
        onBack={() => setMemoOpen(false)}
        onSaveMemo={handleSaveMemoProperties}
        saveDisabled={demoMode}
      />
    );
  }

  if (canOpenManage && manageOpen) {
    return (
      <>
        <ManageView
          activeTab={manageTab}
          data={portalData}
          message={message}
          onAdd={openAdd}
          onAddRelation={openAddRelation}
          onBack={() => {
            setManageOpen(false);
            setDialog(null);
            setRelationDialog(null);
            setNetworkMemoId(null);
            setDeviceMemoId(null);
            setServiceMemoId(null);
            setRelationMemoId(null);
            setServiceTopId(null);
            setServiceIconId(null);
            setConfirm(null);
          }}
          onDelete={requestDelete}
          onNetworkMemo={(id) => {
            setNetworkMemoId(id);
            setMessage(undefined);
          }}
          onMoveNetwork={handleMoveNetwork}
          onDeviceMemo={(id) => {
            setDeviceMemoId(id);
            setMessage(undefined);
          }}
          onServiceMemo={(id) => {
            setServiceMemoId(id);
            setMessage(undefined);
          }}
          onRelationMemo={(id) => {
            setRelationMemoId(id);
            setMessage(undefined);
          }}
          onServiceTop={(id) => {
            setServiceTopId(id);
            setMessage(undefined);
          }}
          onServiceIcon={(id) => {
            setServiceIconId(id);
            setMessage(undefined);
          }}
          onDeleteRelation={requestDeleteRelation}
          onDeleteRelationName={requestDeleteRelationName}
          onEdit={openEdit}
          onEditRelation={openEditRelation}
          onExportLedger={handleExportLedger}
          onImportLedger={handleImportLedger}
          onSavePortalTitle={handleSavePortalTitle}
          onSaveRelationName={handleSaveRelationName}
          savingDisabled={demoMode}
          onTabChange={(tab) => {
            setManageTab(tab);
            setMessage(undefined);
          }}
          portalTitle={portalTitle}
          warning={seedWarning ?? apiError}
        />
        {dialogs}
      </>
    );
  }

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
        setSelectedServiceId(undefined);
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
          {canOpenManage && (
            <button
              className="ouchi-manage-button"
              onClick={(event) => {
                event.stopPropagation();
                openMemo();
              }}
              type="button"
            >
              メモ
            </button>
          )}
          {isReadOnly && !demoMode ? (
            <span className="ouchi-readonly-note">表示専用デモ</span>
          ) : (
            <button
              className="ouchi-manage-button"
              onClick={(event) => {
                event.stopPropagation();
                openManagement();
              }}
              type="button"
            >
              <SettingsIcon size={19} />
              管理
            </button>
          )}
        </div>
      </header>

      <RelationFilterBar
        modes={relationModes}
        onCycle={cycleRelationMode}
        relationNames={portalData.relationNames}
      />

      <div className="ouchi-canvas" ref={canvasRef}>
        <PortalConnectorLayer
          connectors={relationConnectors}
          handlers={connectorHandlers}
          tooltip={connectorTooltip}
        />
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
                openManagement();
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
            relationModes={relationModes}
            demoMode={isReadOnly}
            allowRemoteIcons={!isReadOnly}
            iconBaseUrl={apiBaseUrl}
            onDemoServiceClick={() => setDemoServiceNoticeOpen(true)}
            onSelect={toggleSelection}
            onSelectService={selectService}
            selectedDeviceId={selectedDeviceId}
            selectedServiceId={selectedServiceId}
          />
        ) : (
          <ListBoard
            data={portalData}
            relationModes={relationModes}
            demoMode={isReadOnly}
            onDemoServiceClick={() => setDemoServiceNoticeOpen(true)}
            onSelect={toggleSelection}
            onSelectService={selectService}
            selectedDeviceId={selectedDeviceId}
            selectedServiceId={selectedServiceId}
          />
        )}
      </div>

      {dialogs}

      {isReadOnly && demoServiceNoticeOpen && (
        <DemoServiceLinkDialog
          onClose={() => setDemoServiceNoticeOpen(false)}
        />
      )}

    </section>
  );
}
