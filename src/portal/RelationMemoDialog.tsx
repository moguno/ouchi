import { useRef, useState, type FormEvent } from "react";
import type {
  PortalProperties,
  PortalRelation,
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

interface RelationMemoDialogProps {
  relation: PortalRelation;
  title: string;
  onClose: () => void;
  onSave: (relationId: string, properties: PortalProperties) => void;
  saveDisabled?: boolean;
}

export function RelationMemoDialog({
  relation,
  title,
  onClose,
  onSave,
  saveDisabled = false,
}: RelationMemoDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [propertyDrafts, setPropertyDrafts] = useState<PropertyDraft[]>(() =>
    propertyDraftsFrom(relation.properties),
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
      relation.id,
      normalizeProperties(propertiesFromDrafts(propertyDrafts)),
    );
  }

  return (
    <ManageDialog
      initialFocusRef={firstFieldRef}
      onClose={onClose}
      title={title}
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
