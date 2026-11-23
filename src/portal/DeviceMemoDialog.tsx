import { useRef, useState, type FormEvent } from "react";
import type {
  PortalDevice,
  PortalProperties,
  ValidationIssue,
} from "./types";
import {
  normalizeProperties,
  validatePropertyEntries,
} from "./validation";
import {
  FormActions,
  FormNotice,
  PropertiesEditor,
  propertiesFromDrafts,
  propertyDraftsFrom,
} from "./EntityFormParts";
import { ManageDialog } from "./ManageDialog";
import type { PropertyDraft } from "./entityDialogTypes";

interface DeviceMemoDialogProps {
  device: PortalDevice;
  onClose: () => void;
  onSave: (deviceId: string, properties: PortalProperties) => void;
  saveDisabled?: boolean;
}

export function DeviceMemoDialog({
  device,
  onClose,
  onSave,
  saveDisabled = false,
}: DeviceMemoDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [propertyDrafts, setPropertyDrafts] = useState<PropertyDraft[]>(() =>
    propertyDraftsFrom(device.properties),
  );
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);
  const displayName = device.petname?.trim() || device.name;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const issues = validatePropertyEntries(
      propertyDrafts.map((draft) => [draft.key, draft.value]),
    );
    if (issues.length > 0) {
      setFormIssues(issues);
      return;
    }
    setFormIssues([]);
    onSave(
      device.id,
      normalizeProperties(propertiesFromDrafts(propertyDrafts)),
    );
  }

  return (
    <ManageDialog
      initialFocusRef={firstFieldRef}
      onClose={onClose}
      title={`${displayName}のメモ`}
      wide
    >
      <form className="ouchi-entity-form" onSubmit={handleSubmit}>
        <FormNotice issues={formIssues} />
        <PropertiesEditor
          drafts={propertyDrafts}
          setDrafts={setPropertyDrafts}
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
