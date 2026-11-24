import { useState, type FormEvent } from "react";
import type {
  PortalDataV2,
  PortalIconReference,
  PortalService,
} from "./types";
import { IconPicker } from "./IconPicker";
import { normalizeIconReference } from "./iconCatalog";
import { buildServiceUrl } from "./urls";
import { FormActions } from "./EntityFormParts";
import { ManageDialog } from "./ManageDialog";

interface ServiceIconDialogProps {
  data: PortalDataV2;
  service: PortalService;
  onClose: () => void;
  onSave: (serviceId: string, iconKey: PortalIconReference) => void;
  saveDisabled?: boolean;
}

export function ServiceIconDialog({
  data,
  service,
  onClose,
  onSave,
  saveDisabled = false,
}: ServiceIconDialogProps) {
  const displayName = service.petname?.trim() || service.subdomain;
  const [iconKey, setIconKey] = useState<PortalIconReference>(
    normalizeIconReference(service.iconKey, "favicon"),
  );

  const iface = data.interfaces.find(
    (item) => item.id === service.interfaceId,
  );
  const serviceUrl =
    service.url ??
    (iface
      ? buildServiceUrl(
          {
            scheme: service.scheme,
            port: service.port,
            topPath: service.topPath,
            serviceUrl: service.serviceUrl,
          },
          iface,
        )
      : undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    onSave(service.id, iconKey);
  }

  return (
    <ManageDialog onClose={onClose} title={`${displayName}のアイコン`} wide>
      <form className="ouchi-entity-form" onSubmit={handleSubmit}>
        <IconPicker
          onChange={setIconKey}
          serviceUrl={serviceUrl || undefined}
          value={iconKey}
        />
        <FormActions
          disabled={saveDisabled}
          disabledReason="デモモードでは保存されません。"
          onClose={onClose}
          submitLabel="保存"
        />
      </form>
    </ManageDialog>
  );
}
