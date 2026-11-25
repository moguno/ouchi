import "./styles/manage-simple.css";
import { useRef, useState, type FormEvent } from "react";
import { ColorField } from "./ColorField";
import { ManageDialog } from "./ManageDialog";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import type {
  PortalDataV2,
  PortalLineEndpointShape,
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
  const [lineStart, setLineStart] = useState<PortalLineEndpointShape>(
    editing?.lineStart ?? "circle",
  );
  const [lineEnd, setLineEnd] = useState<PortalLineEndpointShape>(
    editing?.lineEnd ?? "circle",
  );
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
      lineStart,
      lineEnd,
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
          <ColorField
            label="色"
            value={color}
            onChange={setColor}
            error={errors.color}
            errorId="relation-name-color-error"
            colorAriaLabel="関係名の色"
            codeAriaLabel="関係名の色コード"
            placeholder="#d5a22b"
          />
          <label className="ouchi-manage-field">
            <span>始点の形</span>
            <select
              onChange={(event) =>
                setLineStart(event.target.value as PortalLineEndpointShape)
              }
              value={lineStart}
            >
              <option value="none">なし</option>
              <option value="arrow">矢印</option>
              <option value="circle">丸</option>
              <option value="square">四角</option>
              <option value="diamond">ひし形</option>
            </select>
          </label>
          <label className="ouchi-manage-field">
            <span>終点の形</span>
            <select
              onChange={(event) =>
                setLineEnd(event.target.value as PortalLineEndpointShape)
              }
              value={lineEnd}
            >
              <option value="none">なし</option>
              <option value="arrow">矢印</option>
              <option value="circle">丸</option>
              <option value="square">四角</option>
              <option value="diamond">ひし形</option>
            </select>
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
