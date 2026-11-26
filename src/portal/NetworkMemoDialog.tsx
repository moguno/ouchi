import { useRef, useState, type FormEvent } from "react";
import type {
  PortalNetwork,
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

interface NetworkMemoDialogProps {
  network: PortalNetwork;
  onClose: () => void;
  onSave: (networkId: string, properties: PortalProperties) => void;
  saveDisabled?: boolean;
}

export function NetworkMemoDialog({
  network,
  onClose,
  onSave,
  saveDisabled = false,
}: NetworkMemoDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [propertyDrafts, setPropertyDrafts] = useState<PropertyDraft[]>(() =>
    propertyDraftsFrom(network.properties),
  );
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

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
      network.id,
      normalizeProperties(propertiesFromDrafts(propertyDrafts)),
    );
  }

  return (
    <ManageDialog
      initialFocusRef={firstFieldRef}
      onClose={onClose}
      title={`${network.name}のメモ`}
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
