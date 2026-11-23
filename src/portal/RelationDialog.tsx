import { useState, type FormEvent } from "react";
import { FormActions } from "./EntityFormParts";
import { ManageDialog } from "./ManageDialog";
import {
  RelationEditor,
  type RelationEditableField,
} from "./RelationEditor";
import type {
  PortalDataV2,
  PortalRelation,
  ValidationIssue,
} from "./types";
import { resolveRelationLabel } from "./relationLabels";
import {
  generateId,
  validateRelationInput,
} from "./validation";

interface RelationDialogProps {
  data: PortalDataV2;
  editing?: PortalRelation;
  onClose: () => void;
  onSave: (relation: PortalRelation) => Promise<void>;
  saveDisabled?: boolean;
}

export function RelationDialog({
  data,
  editing,
  onClose,
  onSave,
  saveDisabled = false,
}: RelationDialogProps) {
  const firstRelationName = data.relationNames[0];
  const [relation, setRelation] = useState<PortalRelation>(() =>
    editing
      ? { ...editing }
      : {
          id: generateId("relation"),
          relationNameId: firstRelationName?.id ?? "",
          relationName: firstRelationName?.name ?? "",
          fromDeviceId: data.devices[0]?.id ?? "",
          toDeviceId: data.devices[1]?.id ?? data.devices[0]?.id ?? "",
          fromPlaceholder: "",
          toPlaceholder: "",
          fromLabel: resolveRelationLabel(
            firstRelationName?.fromLabel,
            "",
            firstRelationName?.name ?? "",
          ),
          toLabel: resolveRelationLabel(
            firstRelationName?.toLabel,
            "",
            firstRelationName?.name ?? "",
          ),
          color: firstRelationName?.color ?? "#d5a22b",
        },
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  function updateRelation(field: RelationEditableField, value: string) {
    const definition = data.relationNames.find(
      (candidate) => candidate.name === value,
    );
    setRelation((current) => ({
      ...current,
      [field]: value,
          ...(field === "relationName" && definition
            ? {
                relationNameId: definition.id,
                color: definition.color,
                fromPlaceholder: "",
                toPlaceholder: "",
                fromLabel: resolveRelationLabel(
                  definition.fromLabel,
                  "",
                  definition.name,
                ),
                toLabel: resolveRelationLabel(
                  definition.toLabel,
                  "",
                  definition.name,
                ),
          }
        : {}),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const normalized: PortalRelation = {
      ...relation,
      relationName: relation.relationName.trim(),
      fromPlaceholder: relation.fromPlaceholder?.trim() ?? "",
      toPlaceholder: relation.toPlaceholder?.trim() ?? "",
      fromLabel: relation.fromLabel.trim(),
      toLabel: relation.toLabel.trim(),
    };
    const nextIssues = validateRelationInput(
      normalized,
      data,
      editing?.id,
    );
    setIssues(nextIssues);
    if (nextIssues.length > 0) {
      return;
    }
    setSaving(true);
    try {
      await onSave(normalized);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManageDialog
      onClose={onClose}
      title={`関係を${editing ? "編集" : "追加"}`}
    >
      <form className="ouchi-manage-form" onSubmit={handleSubmit}>
        {issues.length > 0 && (
          <div className="ouchi-form-notice" role="alert">
            <strong>入力内容を確認してください</strong>
            <ul>
              {issues.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <RelationEditor
          fromDevices={data.devices}
          index={0}
          onChange={updateRelation}
          onDelete={onClose}
          relation={relation}
          relationNames={data.relationNames}
          showFromDevice
          toDevices={data.devices}
        />
        <FormActions
          disabled={saveDisabled}
          disabledReason="デモモードでは保存されません。"
          onClose={onClose}
          saving={saving}
          submitLabel={editing ? "保存" : "追加する"}
        />
      </form>
    </ManageDialog>
  );
}
