import {
  PortalApiError,
  createDevice,
  createInterface,
  createNetwork,
  createRelation,
  createRelationName,
  createService,
  deleteDevice,
  deleteInterface,
  deleteNetwork,
  deleteProject,
  deleteRelation,
  deleteRelationName,
  deleteService,
  exportLedger,
  importLedger,
  reorderNetworks,
  updateDevice,
  updateInterface,
  updateNetwork,
  updateProject,
  updateRelation,
  updateRelationName,
  updateService,
  updateSettings,
} from "./apiClient";
import type { Dispatch, SetStateAction } from "react";
import { type DeviceMutation, type PortalEntity } from "./EntityDialog";
import type { MemoTargetKind } from "./MemoView";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  toDeviceInput,
  toInterfaceInput,
  toRelationInput,
  toServiceInput,
} from "./portalInputs";
import type {
  PortalDataV2,
  PortalNetwork,
  PortalProperties,
  PortalRelation,
  PortalRelationName,
  PortalService,
} from "./types";
import type { EntityKind } from "./managementTypes";
import { fetchDemoLedgerYaml } from "./yamlDataSource";

export interface DialogState {
  kind: EntityKind;
  editingId?: string;
}

export type ConfirmState =
  | {
      type: "delete";
      kind: EntityKind | "relation" | "relationName" | "project";
      id: string;
    };

const KIND_LABELS: Record<EntityKind, string> = {
  network: "ネットワーク",
  device: "デバイス",
  service: "サービス",
};

export interface PortalActionsDeps {
  apiBaseUrl: string;
  demoMode: boolean;
  yamlUrl?: string;
  portalData: PortalDataV2;
  /**
   * The project the portal is currently switched to. New entities
   * are created inside it, the title save and the ledger export
   * address it. Undefined only for data without a project list.
   */
  activeProject?: { id: string; name: string };
  /** Called after a project deletion succeeds, so the portal can
   * drop the stored selection when the deleted project was active. */
  onProjectDeleted?: (id: string) => void;
  reload: () => Promise<PortalDataV2 | undefined>;
  confirm: ConfirmState | null;
  selectedDeviceId?: string;
  selectedServiceId?: string;
  setMessage: Dispatch<SetStateAction<string | undefined>>;
  setConfirm: Dispatch<SetStateAction<ConfirmState | null>>;
  setDialog: Dispatch<SetStateAction<DialogState | null>>;
  setRelationDialog: Dispatch<
    SetStateAction<{ editingId?: string } | null>
  >;
  setNetworkMemoId: Dispatch<SetStateAction<string | null>>;
  setDeviceMemoId: Dispatch<SetStateAction<string | null>>;
  setServiceMemoId: Dispatch<SetStateAction<string | null>>;
  setRelationMemoId: Dispatch<SetStateAction<string | null>>;
  setServiceTopId: Dispatch<SetStateAction<string | null>>;
  setServiceIconId: Dispatch<SetStateAction<string | null>>;
  setSelectedDeviceId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedServiceId: Dispatch<SetStateAction<string | undefined>>;
}

  export function deleteKindLabel(
    kind: EntityKind | "relation" | "relationName" | "project",
  ) {
    if (kind === "relation") {
      return "関係";
    }
    if (kind === "relationName") {
      return "関係名";
    }
    if (kind === "project") {
      return "プロジェクト";
    }
    return KIND_LABELS[kind];
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

export function usePortalActions(deps: PortalActionsDeps) {
  // Creates land in the active project; updates never move entities
  // between projects, so only create payloads are stamped.
  const stampProject = <T extends object>(input: T): T & { projectId?: number } =>
    deps.activeProject
      ? { ...input, projectId: Number(deps.activeProject.id) }
      : input;
  const {
    apiBaseUrl,
    demoMode,
    yamlUrl,
    portalData,
    activeProject,
    onProjectDeleted,
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
  } = deps;

    async function handleDelete() {
      if (demoMode || !confirm || confirm.type !== "delete") {
        return;
      }

      try {
        if (confirm.kind === "project") {
          await deleteProject(apiBaseUrl, confirm.id);
          onProjectDeleted?.(confirm.id);
        } else if (confirm.kind === "relation") {
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
        if (confirm.kind === "service" && selectedServiceId === confirm.id) {
          setSelectedServiceId(undefined);
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
      // Exports are per project: the active project's document.
      const download = demoMode && yamlUrl
        ? {
            filename: "ouchi-ledger-demo.yaml",
            yaml: await fetchDemoLedgerYaml(yamlUrl),
          }
        : await exportLedger(apiBaseUrl, activeProject?.id);
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
      setSelectedServiceId(undefined);
      await reload();
      const imported = result.imported;
      return (
        `全置き換えが完了しました。ネットワーク ${imported.networks}件、` +
        `デバイス ${imported.devices}件、インターフェース ${imported.interfaces}件、` +
        `関係名 ${imported.relationNames}件、関係 ${imported.relations}件、` +
        `サービス ${imported.services}件、` +
        `SSH公開鍵 ${imported.sshKeys}件を読み込みました。`
      );
    }

    async function handleSavePortalTitle(title: string) {
      if (demoMode) {
        return;
      }
      if (activeProject) {
        // The title is the active project's ouchi title; the
        // settings endpoint only ever addresses the first project.
        await updateProject(apiBaseUrl, activeProject.id, {
          name: activeProject.name,
          title,
        });
      } else {
        await updateSettings(apiBaseUrl, { title });
      }
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
            await createNetwork(apiBaseUrl, stampProject(input));
          }
        } else if (kind === "service") {
          const service = entity as PortalService;
          const input = toServiceInput(service);
          if (portalData.services.some((item) => item.id === service.id)) {
            await updateService(apiBaseUrl, service.id, input);
          } else {
            await createService(apiBaseUrl, stampProject(input));
          }
        } else {
          const mutation = entity as DeviceMutation;
          const existing = portalData.devices.some(
            (item) => item.id === mutation.device.id,
          );
          const nextInterfaceIds = new Set(
            mutation.interfaces.map((iface) => iface.id),
          );
          const blockedInterface = portalData.interfaces.find(
            (iface) =>
              iface.deviceId === mutation.device.id &&
              !nextInterfaceIds.has(iface.id) &&
              (portalData.services.some(
                (service) => service.interfaceId === iface.id,
              ) ||
                portalData.relations.some(
                  (relation) =>
                    relation.fromInterfaceId === iface.id ||
                    relation.toInterfaceId === iface.id,
                )),
          );
          if (blockedInterface) {
            throw new Error(
              "サービスや関係が紐づくインターフェースを削除する前に、サービスや関係を削除または移動してください",
            );
          }
          const deviceInput = toDeviceInput(mutation.device);
          let savedDeviceId = mutation.device.id;
          if (existing) {
            await updateDevice(apiBaseUrl, savedDeviceId, deviceInput);
          } else {
            const created = (await createDevice(
              apiBaseUrl,
              stampProject(deviceInput),
            )) as { id: number };
            savedDeviceId = String(created.id);
          }

          const currentInterfaces = portalData.interfaces.filter(
            (iface) => iface.deviceId === savedDeviceId,
          );
          for (const iface of currentInterfaces) {
            if (!nextInterfaceIds.has(iface.id)) {
              await deleteInterface(apiBaseUrl, iface.id);
            }
          }
          for (const iface of mutation.interfaces) {
            const input = {
              deviceId: Number(savedDeviceId),
              name: iface.name.trim(),
              networkId: iface.networkId ? Number(iface.networkId) : null,
              ip: iface.ip.trim() || null,
              mac: iface.mac?.trim() || null,
            };
            if (
              currentInterfaces.some((item) => item.id === iface.id)
            ) {
              await updateInterface(apiBaseUrl, iface.id, input);
            } else {
              await createInterface(apiBaseUrl, input);
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
        const input = toRelationInput(relation);
        if (
          portalData.relations.some((candidate) => candidate.id === relation.id)
        ) {
          await updateRelation(apiBaseUrl, relation.id, input);
        } else {
          await createRelation(apiBaseUrl, stampProject(input));
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

    async function handleSaveRelationMemo(
      relationId: string,
      properties: PortalProperties,
    ) {
      if (demoMode) {
        return;
      }
      const relation = portalData.relations.find(
        (item) => item.id === relationId,
      );
      if (!relation) {
        return;
      }
      try {
        await updateRelation(
          apiBaseUrl,
          relationId,
          toRelationInput(relation, properties),
        );
        setRelationMemoId(null);
        setMessage("メモを保存しました。");
        await reload();
      } catch (cause) {
        setMessage(apiFailure(cause));
      }
    }

    async function handleSaveNetworkMemo(
      networkId: string,
      properties: PortalProperties,
    ) {
      if (demoMode) {
        return;
      }
      const network = portalData.networks.find((item) => item.id === networkId);
      if (!network) {
        return;
      }
      try {
        await updateNetwork(apiBaseUrl, networkId, {
          name: network.name,
          cidr: network.cidr || null,
          accent: network.accent,
          note: network.note || null,
          properties,
        });
        setNetworkMemoId(null);
        setMessage("メモを保存しました。");
        await reload();
      } catch (cause) {
        setMessage(apiFailure(cause));
      }
    }

    async function handleMoveNetwork(
      networkId: string,
      direction: "up" | "down",
    ) {
      if (demoMode) {
        return;
      }
      const ordered = sortNetworksForDisplay(portalData.networks);
      const index = ordered.findIndex((item) => item.id === networkId);
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) {
        return;
      }
      const next = [...ordered];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      try {
        await reorderNetworks(
          apiBaseUrl,
          next.map((network) => network.id),
        );
        await reload();
      } catch (cause) {
        setMessage(apiFailure(cause));
      }
    }

    async function handleSaveMemoProperties(
      kind: MemoTargetKind,
      id: string,
      properties: PortalProperties,
    ): Promise<boolean> {
      if (demoMode) {
        return false;
      }
      try {
        if (kind === "device") {
          const device = portalData.devices.find((item) => item.id === id);
          if (!device) {
            return false;
          }
          await updateDevice(apiBaseUrl, id, {
            ...toDeviceInput(device),
            properties,
          });
        } else if (kind === "interface") {
          const iface = portalData.interfaces.find((item) => item.id === id);
          if (!iface) {
            return false;
          }
          await updateInterface(apiBaseUrl, id, {
            ...toInterfaceInput(iface),
            properties,
          });
        } else if (kind === "service") {
          const service = portalData.services.find((item) => item.id === id);
          if (!service) {
            return false;
          }
          await updateService(apiBaseUrl, id, {
            ...toServiceInput(service),
            properties,
          });
        } else if (kind === "relation") {
          const relation = portalData.relations.find((item) => item.id === id);
          if (!relation) {
            return false;
          }
          await updateRelation(
            apiBaseUrl,
            id,
            toRelationInput(relation, properties),
          );
        } else if (kind === "network") {
          const network = portalData.networks.find((item) => item.id === id);
          if (!network) {
            return false;
          }
          await updateNetwork(apiBaseUrl, id, {
            name: network.name,
            cidr: network.cidr || null,
            accent: network.accent,
            note: network.note || null,
            properties,
          });
        } else if (kind === "project" && id !== "settings") {
          const project = portalData.projects?.find((item) => item.id === id);
          if (!project) {
            return false;
          }
          await updateProject(apiBaseUrl, id, {
            name: project.name,
            title: project.title,
            properties,
          });
        } else {
          // The settings fallback entry (data without a project list)
          // addresses the default project's ouchi via /api/settings.
          await updateSettings(apiBaseUrl, {
            title: portalData.settings?.title ?? "あなたのホームラボ",
            properties,
          });
        }
        await reload();
        return true;
      } catch (cause) {
        setMessage(apiFailure(cause));
        return false;
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
          lineStart: relationName.lineStart,
          lineEnd: relationName.lineEnd,
        };
        if (
          portalData.relationNames.some(
            (candidate) => candidate.id === relationName.id,
          )
        ) {
          await updateRelationName(apiBaseUrl, relationName.id, input);
        } else {
          await createRelationName(apiBaseUrl, stampProject(input));
        }
        setMessage("関係名を保存しました。");
        await reload();
        return true;
      } catch (cause) {
        setMessage(apiFailure(cause));
        return false;
      }
    }

  return {
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
  };
}
