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
import { ProjectSidebar } from "./ProjectSidebar";
import { WelcomeTutorial } from "./WelcomeTutorial";
import { ProjectDialog } from "./ProjectDialog";
import {
  clearActiveProjectId,
  loadActiveProjectId,
  saveActiveProjectId,
} from "./projectSelection";
import {
  PortalApiError,
  createProject,
  updateProject,
} from "./apiClient";
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
  type PortalProject,
  type PortalProjectInput,
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
  const [storedProjectId, setStoredProjectId] = useState<
    string | undefined
  >(loadActiveProjectId);
  // The side menu always starts collapsed and its open state is
  // deliberately not remembered (user decision, 2026-11-28):
  // toggling lasts for this view only, a reload starts collapsed.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [projectDialog, setProjectDialog] = useState<{
    editing?: PortalProject;
  } | null>(null);
  const projects = portalData.projects ?? [];
  const activeProject =
    projects.find((project) => project.id === storedProjectId) ??
    projects[0];
  // A project is one whole ouchi and shares nothing with the
  // others: every view below works on the active project's slice.
  const scopedData: PortalDataV2 = useMemo(() => {
    if (!activeProject) {
      return portalData;
    }
    return {
      ...portalData,
      networks: portalData.networks.filter(
        (item) => item.projectId === activeProject.id,
      ),
      devices: portalData.devices.filter(
        (item) => item.projectId === activeProject.id,
      ),
      interfaces: portalData.interfaces.filter(
        (item) => item.projectId === activeProject.id,
      ),
      relationNames: portalData.relationNames.filter(
        (item) => item.projectId === activeProject.id,
      ),
      relations: portalData.relations.filter(
        (item) => item.projectId === activeProject.id,
      ),
      services: portalData.services.filter(
        (item) => item.projectId === activeProject.id,
      ),
      settings: {
        domain: portalData.settings?.domain ?? "ouchi.local",
        title: activeProject.title,
        properties: activeProject.properties ?? {},
      },
      projects: [activeProject],
    };
  }, [portalData, activeProject]);
  const portalTitle =
    scopedData.settings?.title.trim() || DEFAULT_PORTAL_TITLE;
  // Every project deleted: the main pane goes blank (mock20) — the
  // side menu's add button is the only way forward.
  const noProjects =
    portalData.projects !== undefined &&
    projects.length === 0 &&
    Boolean(loadedData);

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
    data: scopedData,
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

  function selectProject(id: string) {
    setStoredProjectId(id);
    saveActiveProjectId(id);
    setSelectedDeviceId(undefined);
    setSelectedServiceId(undefined);
    setMessage(undefined);
  }

  function requestDeleteProject(project: PortalProject) {
    setMessage(undefined);
    setConfirm({ type: "delete", kind: "project", id: project.id });
  }

  function handleProjectDeleted(id: string) {
    if (id !== activeProject?.id) {
      return;
    }
    // The active ouchi is gone: fall back to the first remaining
    // project (or to the empty state when none are left).
    setStoredProjectId(undefined);
    clearActiveProjectId();
    setSelectedDeviceId(undefined);
    setSelectedServiceId(undefined);
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => !current);
  }

  async function handleSaveProject(
    input: PortalProjectInput,
  ): Promise<boolean> {
    if (demoMode) {
      return false;
    }
    try {
      if (projectDialog?.editing) {
        await updateProject(apiBaseUrl, projectDialog.editing.id, input);
        setMessage("プロジェクトを保存しました。");
      } else {
        const created = await createProject(apiBaseUrl, input);
        setStoredProjectId(String(created.id));
        saveActiveProjectId(String(created.id));
        setMessage("プロジェクトを追加しました。");
      }
      await reload();
      return true;
    } catch (cause) {
      if (cause instanceof PortalApiError && cause.issues.length > 0) {
        setMessage(cause.issues.map((issue) => issue.message).join(" / "));
      } else {
        setMessage(
          cause instanceof Error ? cause.message : "API操作に失敗しました",
        );
      }
      return false;
    }
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
    kind: EntityKind | "relation" | "relationName" | "project",
    id: string,
  ) {
    if (kind === "project") {
      return projects.find((item) => item.id === id)?.name ?? "";
    }
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
    kind: EntityKind | "relation" | "relationName" | "project",
    id: string,
  ) {
    const target = `「${entityName(kind, id)}」を削除します。`;
    if (kind === "project") {
      return `${target}中のネットワーク・デバイス・サービス・関係もすべて削除されます。この操作は元に戻せません。`;
    }
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
    activeProject: activeProject
      ? { id: activeProject.id, name: activeProject.name }
      : undefined,
    onProjectDeleted: handleProjectDeleted,
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


  const vmCount = scopedData.devices.filter(
    (device) => device.category === "vm",
  ).length;
  const screenReaderSummary = `${scopedData.networks.length}ネットワーク、${scopedData.devices.length}デバイス（VM ${vmCount}）、${scopedData.interfaces.length}インターフェース、${scopedData.relations.length}関係、${scopedData.services.length}サービス`;
  const memoNetwork = networkMemoId
    ? scopedData.networks.find((item) => item.id === networkMemoId)
    : undefined;
  const memoDevice = deviceMemoId
    ? scopedData.devices.find((item) => item.id === deviceMemoId)
    : undefined;
  const memoService = serviceMemoId
    ? scopedData.services.find((item) => item.id === serviceMemoId)
    : undefined;
  const memoRelation = relationMemoId
    ? scopedData.relations.find((item) => item.id === relationMemoId)
    : undefined;
  const memoRelationTitle = memoRelation
    ? `${memoRelation.relationName}（${
        scopedData.devices.find(
          (device) => device.id === memoRelation.fromDeviceId,
        )?.name ?? "不明なデバイス"
      } → ${
        scopedData.devices.find(
          (device) => device.id === memoRelation.toDeviceId,
        )?.name ?? "不明なデバイス"
      }）のメモ`
    : "";
  const topService = serviceTopId
    ? scopedData.services.find((item) => item.id === serviceTopId)
    : undefined;
  const iconService = serviceIconId
    ? scopedData.services.find((item) => item.id === serviceIconId)
    : undefined;
  const dialogs = (
    <>
      {canOpenManage && dialog && (
        <EntityDialog
          data={scopedData}
          editingId={dialog.editingId}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onSave={handleSave}
          saveDisabled={demoMode}
        />
      )}

      {canOpenManage && relationDialog && (
        <RelationDialog
          data={scopedData}
          editing={
            relationDialog.editingId
              ? scopedData.relations.find(
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
        data={scopedData}
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
          data={scopedData}
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
      <div className="ouchi-portal-body">
        {portalData.projects !== undefined && (
          <ProjectSidebar
            actionsDisabled={demoMode}
            activeProjectId={activeProject?.id}
            collapsed={sidebarCollapsed}
            onAdd={() => setProjectDialog({})}
            onDelete={requestDeleteProject}
            onEdit={(project) => setProjectDialog({ editing: project })}
            onSelect={selectProject}
            onToggleCollapsed={toggleSidebar}
            projects={projects}
          />
        )}
        <div className="ouchi-portal-main">
      {noProjects ? (
        <div className="ouchi-project-empty">
          プロジェクトを追加してください
        </div>
      ) : (
        <>
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
        relationNames={scopedData.relationNames}
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
        ) : scopedData.networks.length === 0 ? (
          <WelcomeTutorial
            onAddNetwork={() => {
              setManageTab("networks");
              openManagement();
            }}
          />
        ) : viewMode === "icons" ? (
          <IconBoard
            data={scopedData}
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
            data={scopedData}
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
        </>
      )}
        </div>
      </div>

      {dialogs}

      {projectDialog && (
        <ProjectDialog
          editing={projectDialog.editing}
          onClose={() => setProjectDialog(null)}
          onSave={handleSaveProject}
          projects={projects}
          saveDisabled={demoMode}
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
