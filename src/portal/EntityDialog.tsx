import { useRef } from "react";
import type { EntityKind } from "./managementTypes";
import { ManageDialog } from "./ManageDialog";
import { DeviceEntityDialog } from "./DeviceEntityDialog";
import { NetworkEntityDialog } from "./NetworkEntityDialog";
import { ServiceEntityDialog } from "./ServiceEntityDialog";
import type {
  EntitySaveHandler,
  FirstFieldRef,
} from "./entityDialogTypes";
import type { PortalDataV2 } from "./types";

export { ConfirmDialog } from "./ConfirmDialog";
export type {
  DeviceMutation,
  PortalEntity,
} from "./entityDialogTypes";

interface EntityDialogProps {
  kind: EntityKind;
  editingId?: string;
  data: PortalDataV2;
  onClose: () => void;
  onSave: EntitySaveHandler;
  saveDisabled?: boolean;
}

const KIND_LABELS: Record<EntityKind, string> = {
  network: "ネットワーク",
  device: "デバイス",
  service: "サービス",
};

export function EntityDialog({
  kind,
  editingId,
  data,
  onClose,
  onSave,
  saveDisabled = false,
}: EntityDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const sharedProps = {
    data,
    firstFieldRef: firstFieldRef as FirstFieldRef,
    onClose,
    onSave,
    saveDisabled,
  };

  return (
    <ManageDialog
      initialFocusRef={firstFieldRef}
      onClose={onClose}
      title={`${KIND_LABELS[kind]}を${editingId ? "編集" : "追加"}`}
      wide={kind !== "network"}
    >
      {kind === "network" && (
        <NetworkEntityDialog
          {...sharedProps}
          editing={data.networks.find(
            (network) => network.id === editingId,
          )}
        />
      )}
      {kind === "device" && (
        <DeviceEntityDialog
          {...sharedProps}
          editing={data.devices.find(
            (device) => device.id === editingId,
          )}
        />
      )}
      {kind === "service" && (
        <ServiceEntityDialog
          {...sharedProps}
          editing={data.services.find(
            (service) => service.id === editingId,
          )}
        />
      )}
    </ManageDialog>
  );
}
