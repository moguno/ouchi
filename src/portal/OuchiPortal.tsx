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
  PortalApiError,
  createDevice,
  createMembership,
  createNetwork,
  createRelation,
  createRelationName,
  createService,
  deleteDevice,
  deleteMembership,
  deleteNetwork,
  deleteRelation,
  deleteRelationName,
  deleteService,
  exportLedger,
  importLedger,
  updateDevice,
  updateMembership,
  updateNetwork,
  updateRelation,
  updateRelationName,
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
  GridIcon,
  ListIcon,
  SettingsIcon,
} from "./icons";
import { DemoServiceLinkDialog } from "./DemoServiceLinkDialog";
import { DeviceMemoDialog } from "./DeviceMemoDialog";
import { ServiceMemoDialog } from "./ServiceMemoDialog";
import { ServiceTopDialog } from "./ServiceTopDialog";
import { ServiceIconDialog } from "./ServiceIconDialog";
import { ManageView } from "./ManageView";
import {
  PortalConnectorLayer,
  usePortalConnectors,
} from "./PortalConnectorLayer";
import { IconBoard, ListBoard } from "./PortalBoard";
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
  type PortalRelationName,
  type PortalService,
  type PortalServiceInput,
} from "./types";
import { serviceName } from "./portalPresentation";
import { usePortalData } from "./usePortalData";
import { fetchDemoLedgerYaml } from "./yamlDataSource";
import {
  DEFAULT_PORTAL_TITLE,
  validatePortalData,
} from "./validation";
type ViewMode = "icons" | "list";

interface DialogState {
  kind: EntityKind;
  editingId?: string;
}

type ConfirmState =
  | {
      type: "delete";
      kind: EntityKind | "relation" | "relationName";
      id: string;
    };

const EMPTY_DATA: PortalDataV2 = {
  version: 2,
  networks: [],
  devices: [],
  deviceNetworks: [],
  relationNames: [],
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

function toDeviceInput(device: PortalDevice): PortalDeviceInput {
  return {
    hostname: device.name.trim(),
    petname: device.petname?.trim() || null,
    properties: device.properties ?? {},
    category: device.category,
    isVm: device.isVm,
    sshUser: device.ssh?.user || null,
    sshPort: device.ssh?.port ?? null,
    meterEnabled: device.meterEnabled ?? false,
    note: device.note || null,
  };
}

function toServiceInput(service: PortalService): PortalServiceInput {
  return {
    deviceNetworkId: Number(service.deviceNetworkId),
    subdomain: service.subdomain.trim().toLowerCase(),
    petname: service.petname || null,
    description: service.description || null,
    properties: service.properties ?? {},
    port: service.port,
    protocol: service.protocol,
    scheme: service.scheme,
    topPath: service.topPath || null,
    monitorPath: service.monitorPath || null,
    serviceUrl: service.serviceUrl || null,
    iconKey: service.iconKey,
    enabled: service.enabled,
  };
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
  const [manageTab, setManageTab] = useState<ManageTab>("networks");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [relationDialog, setRelationDialog] = useState<{
    editingId?: string;
  } | null>(null);
  const [deviceMemoId, setDeviceMemoId] = useState<string | null>(null);
  const [serviceMemoId, setServiceMemoId] = useState<string | null>(null);
  const [serviceTopId, setServiceTopId] = useState<string | null>(null);
  const [serviceIconId, setServiceIconId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [message, setMessage] = useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(
    initialSelectedDeviceId,
  );
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
    selectedDeviceId,
  });

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = window.setTimeout(() => setMessage(undefined), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!selectedDeviceId || manageOpen || typeof document === "undefined") {
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
  }, [manageOpen, selectedDeviceId]);

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

  function deleteKindLabel(
    kind: EntityKind | "relation" | "relationName",
  ) {
    if (kind === "relation") {
      return "関係";
    }
    if (kind === "relationName") {
      return "関係名";
    }
    return KIND_LABELS[kind];
  }

  function deleteConfirmationDescription(
    kind: EntityKind | "relation" | "relationName",
    id: string,
  ) {
    const target = `「${entityName(kind, id)}」を削除します。`;
    if (kind !== "device") {
      return `${target}この操作は元に戻せません。`;
    }

    const membershipIds = new Set(
      portalData.deviceNetworks
        .filter((membership) => membership.deviceId === id)
        .map((membership) => membership.id),
    );
    const serviceCount = portalData.services.filter((service) =>
      membershipIds.has(service.deviceNetworkId),
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
    if (demoMode || !confirm || confirm.type !== "delete") {
      return;
    }

    try {
      if (confirm.kind === "relation") {
        await deleteRelation(apiBaseUrl, confirm.id);
      } else if (confirm.kind === "relationName") {
        await deleteRelationName(apiBaseUrl, confirm.id);
      } else if (confirm.kind === "network") {
        await deleteNetwork(apiBaseUrl, confirm.id);
      } else if (confirm.kind === "device") {
        await deleteDevice(apiBaseUrl, confirm.id);
      } else {
        await deleteService(apiBaseUrl, confirm.id);
      }
      if (confirm.kind === "device" && selectedDeviceId === confirm.id) {
        setSelectedDeviceId(undefined);
      }
      setMessage(`${deleteKindLabel(confirm.kind)}を削除しました。`);
      setConfirm(null);
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
      setConfirm(null);
    }
  }

  async function handleExportLedger() {
    const download = demoMode && yamlUrl
      ? {
          filename: "ouchi-ledger-demo.yaml",
          yaml: await fetchDemoLedgerYaml(yamlUrl),
        }
      : await exportLedger(apiBaseUrl);
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
    if (demoMode) {
      return "デモモードでは保存されません。";
    }
    const result = await importLedger(apiBaseUrl, yaml);
    setSelectedDeviceId(undefined);
    await reload();
    const imported = result.imported;
    return (
      `全置き換えが完了しました。ネットワーク ${imported.networks}件、` +
      `デバイス ${imported.devices}件、所属IP ${imported.memberships}件、` +
      `関係名 ${imported.relationNames}件、関係 ${imported.relations}件、` +
      `サービス ${imported.services}件、` +
      `SSH公開鍵 ${imported.sshKeys}件を読み込みました。`
    );
  }

  async function handleSavePortalTitle(title: string) {
    if (demoMode) {
      return;
    }
    await updateSettings(apiBaseUrl, { title });
    await reload();
    setMessage("ポータルタイトルを保存しました。");
  }

  async function handleSave(kind: EntityKind, entity: PortalEntity) {
    if (demoMode) {
      return;
    }
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
        const input = toServiceInput(service);
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
        const deviceInput = toDeviceInput(mutation.device);
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

      }
      setMessage(`${KIND_LABELS[kind]}を保存しました。`);
      setDialog(null);
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  async function handleSaveRelation(
    relation: PortalRelation,
  ) {
    if (demoMode) {
      return;
    }
    try {
      const input = {
        fromDeviceId: Number(relation.fromDeviceId),
        toDeviceId: Number(relation.toDeviceId),
        relationName: relation.relationName.trim(),
        fromPlaceholder: relation.fromPlaceholder?.trim() ?? "",
        toPlaceholder: relation.toPlaceholder?.trim() ?? "",
      };
      if (
        portalData.relations.some((candidate) => candidate.id === relation.id)
      ) {
        await updateRelation(apiBaseUrl, relation.id, input);
      } else {
        await createRelation(apiBaseUrl, input);
      }
      setRelationDialog(null);
      setMessage("関係を保存しました。");
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  async function handleSaveDeviceMemo(
    deviceId: string,
    properties: PortalProperties,
  ) {
    if (demoMode) {
      return;
    }
    const device = portalData.devices.find((item) => item.id === deviceId);
    if (!device) {
      return;
    }
    try {
      await updateDevice(apiBaseUrl, deviceId, {
        ...toDeviceInput(device),
        properties,
      });
      setDeviceMemoId(null);
      setMessage("メモを保存しました。");
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  async function handleSaveServiceMemo(
    serviceId: string,
    properties: PortalProperties,
  ) {
    if (demoMode) {
      return;
    }
    const service = portalData.services.find((item) => item.id === serviceId);
    if (!service) {
      return;
    }
    try {
      await updateService(apiBaseUrl, serviceId, {
        ...toServiceInput(service),
        properties,
      });
      setServiceMemoId(null);
      setMessage("メモを保存しました。");
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  async function handleSaveServiceTop(
    serviceId: string,
    patch: Pick<
      PortalService,
      "scheme" | "port" | "protocol" | "topPath" | "serviceUrl"
    >,
  ) {
    if (demoMode) {
      return;
    }
    const service = portalData.services.find((item) => item.id === serviceId);
    if (!service) {
      return;
    }
    try {
      await updateService(apiBaseUrl, serviceId, {
        ...toServiceInput(service),
        scheme: patch.scheme,
        port: patch.port,
        protocol: patch.protocol,
        topPath: patch.topPath || null,
        serviceUrl: patch.serviceUrl || null,
      });
      setServiceTopId(null);
      setMessage("トップを保存しました。");
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  async function handleSaveServiceIcon(
    serviceId: string,
    iconKey: PortalService["iconKey"],
  ) {
    if (demoMode) {
      return;
    }
    const service = portalData.services.find((item) => item.id === serviceId);
    if (!service) {
      return;
    }
    try {
      await updateService(apiBaseUrl, serviceId, {
        ...toServiceInput(service),
        iconKey,
      });
      setServiceIconId(null);
      setMessage("アイコンを保存しました。");
      await reload();
    } catch (cause) {
      setMessage(apiFailure(cause));
    }
  }

  async function handleSaveRelationName(
    relationName: PortalRelationName,
  ) {
    if (demoMode) {
      return false;
    }
    try {
      const input = {
        name: relationName.name,
        color: relationName.color,
        fromLabel: relationName.fromLabel?.trim() || null,
        toLabel: relationName.toLabel?.trim() || null,
      };
      if (
        portalData.relationNames.some(
          (candidate) => candidate.id === relationName.id,
        )
      ) {
        await updateRelationName(apiBaseUrl, relationName.id, input);
      } else {
        await createRelationName(apiBaseUrl, input);
      }
      setMessage("関係名を保存しました。");
      await reload();
      return true;
    } catch (cause) {
      setMessage(apiFailure(cause));
      return false;
    }
  }

  function toggleSelection(deviceId: string) {
    setSelectedDeviceId((current) =>
      current === deviceId ? undefined : deviceId,
    );
  }


  const vmCount = portalData.devices.filter((device) => device.isVm).length;
  const screenReaderSummary = `${portalData.networks.length}ネットワーク、${portalData.devices.length}デバイス（VM ${vmCount}）、${portalData.deviceNetworks.length}所属IP、${portalData.relations.length}関係、${portalData.services.length}サービス`;
  const memoDevice = deviceMemoId
    ? portalData.devices.find((item) => item.id === deviceMemoId)
    : undefined;
  const memoService = serviceMemoId
    ? portalData.services.find((item) => item.id === serviceMemoId)
    : undefined;
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
            setDeviceMemoId(null);
            setServiceMemoId(null);
            setServiceTopId(null);
            setServiceIconId(null);
            setConfirm(null);
          }}
          onDelete={requestDelete}
          onDeviceMemo={(id) => {
            setDeviceMemoId(id);
            setMessage(undefined);
          }}
          onServiceMemo={(id) => {
            setServiceMemoId(id);
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

      {dialogs}

      {isReadOnly && demoServiceNoticeOpen && (
        <DemoServiceLinkDialog
          onClose={() => setDemoServiceNoticeOpen(false)}
        />
      )}

    </section>
  );
}
