import "./styles/manage-simple.css";
import { useRef, useState, type FormEvent } from "react";
import { colorValueForInput } from "./colorValue";
import { ManageDialog } from "./ManageDialog";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import type {
  PortalDataV2,
  PortalRelationName,
  ValidationIssue,
} from "./types";
import {
  generateId,
  validateRelationNameInput,
} from "./validation";

interface RelationNameDialogProps {
  data: PortalDataV2;
  editing?: PortalRelationName;
  onClose: () => void;
  onSave: (relationName: PortalRelationName) => Promise<boolean>;
  saveDisabled?: boolean;
}

export function RelationNameDialog({
  data,
  editing,
  onClose,
  onSave,
  saveDisabled = false,
}: RelationNameDialogProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? "#d5a22b");
  const [fromLabel, setFromLabel] = useState(editing?.fromLabel ?? "");
  const [toLabel, setToLabel] = useState(editing?.toLabel ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issues, setFormIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const normalized: PortalRelationName = {
      id: editing?.id ?? generateId("relation-name"),
      name: name.trim(),
      color: color.trim(),
      fromLabel: fromLabel.trim() || undefined,
      toLabel: toLabel.trim() || undefined,
      relationCount: editing?.relationCount ?? 0,
    };
    const nextIssues = validateRelationNameInput(
      normalized,
      data,
      editing?.id,
    );
    setIssues(nextIssues, setErrors);
    setFormIssues(nextIssues);
    if (nextIssues.length > 0) {
      return;
    }

    setSaving(true);
    try {
      if (await onSave(normalized)) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManageDialog
      initialFocusRef={nameRef}
      onClose={onClose}
      title={`関係名を${editing ? "編集" : "追加"}`}
    >
      <form className="ouchi-manage-form" onSubmit={handleSubmit}>
        <FormNotice issues={issues} />
        <div className="ouchi-manage-form-grid">
          <label className="ouchi-manage-field">
            <span>関係名</span>
            <input
              aria-describedby={errors.name ? "relation-name-error" : undefined}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => setName(event.target.value)}
              ref={nameRef}
              required
              value={name}
            />
            <FieldError id="relation-name-error">{errors.name}</FieldError>
          </label>
          <label className="ouchi-manage-field">
            <span>色</span>
            <span className="ouchi-manage-color-row">
              <input
                aria-label="関係名の色"
                onChange={(event) => setColor(event.target.value)}
                type="color"
                value={colorValueForInput(color)}
              />
              <input
                aria-label="関係名の色コード"
                aria-invalid={Boolean(errors.color)}
                onChange={(event) => setColor(event.target.value)}
                placeholder="#d5a22b"
                value={color}
              />
            </span>
            <FieldError id="relation-name-color-error">
              {errors.color}
            </FieldError>
          </label>
          <label className="ouchi-manage-field">
            <span>始点の名前</span>
            <input
              onChange={(event) => setFromLabel(event.target.value)}
              placeholder="空なら関係名を使用"
              value={fromLabel}
            />
          </label>
          <label className="ouchi-manage-field">
            <span>終点の名前</span>
            <input
              onChange={(event) => setToLabel(event.target.value)}
              placeholder="空なら関係名を使用"
              value={toLabel}
            />
          </label>
        </div>
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
