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
import { projectColorFromName } from "./colorValue";
import { validateProjectPayload } from "./validationPayloads";
import type {
  PortalProject,
  PortalProjectInput,
  ValidationIssue,
} from "./types";

interface ProjectDialogProps {
  /** Existing projects, for the duplicate-name check. */
  projects: PortalProject[];
  editing?: PortalProject;
  onClose: () => void;
  onSave: (input: PortalProjectInput) => Promise<boolean>;
  saveDisabled?: boolean;
}

/**
 * Create / rename a project. The title is not here on purpose: a
 * project's ouchi title is edited from the management screen's
 * common settings, as before. A new project's color starts as the
 * color its name hashes to — the value that will be stored — and
 * can be adjusted before saving; afterwards it is just the stored
 * color, and renaming never recolors the project.
 */
export function ProjectDialog({
  projects,
  editing,
  onClose,
  onSave,
  saveDisabled = false,
}: ProjectDialogProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(
    editing?.color ?? projectColorFromName(""),
  );
  const [colorTouched, setColorTouched] = useState(Boolean(editing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [issues, setFormIssues] = useState<ValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!editing && !colorTouched) {
      setColor(projectColorFromName(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const input: PortalProjectInput = {
      name: name.trim(),
      color: color.trim(),
    };
    const nextIssues = validateProjectPayload(input);
    if (
      projects.some(
        (project) =>
          project.name === input.name && project.id !== editing?.id,
      )
    ) {
      nextIssues.push({
        path: "name",
        message: "同じプロジェクト名が登録されています",
      });
    }
    setIssues(nextIssues, setErrors);
    setFormIssues(nextIssues);
    if (nextIssues.length > 0) {
      return;
    }
    setSaving(true);
    try {
      if (await onSave(input)) {
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
      title={`プロジェクトを${editing ? "編集" : "追加"}`}
    >
      <form className="ouchi-manage-form" onSubmit={handleSubmit}>
        <FormNotice issues={issues} />
        <div className="ouchi-manage-form-grid">
          <label className="ouchi-manage-field">
            <span>名前</span>
            <input
              aria-describedby={errors.name ? "project-name-error" : undefined}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => handleNameChange(event.target.value)}
              ref={nameRef}
              required
              value={name}
            />
            <FieldError id="project-name-error">{errors.name}</FieldError>
          </label>
          <ColorField
            label="色"
            value={color}
            onChange={(value) => {
              setColorTouched(true);
              setColor(value);
            }}
            error={errors.color}
            errorId="project-color-error"
            colorAriaLabel="プロジェクトの色"
            codeAriaLabel="プロジェクトの色コード"
            placeholder="#d5a22b"
          />
        </div>
        <FormActions
          disabled={saveDisabled}
          onClose={onClose}
          saving={saving}
          submitLabel={editing ? "保存" : "追加"}
        />
      </form>
    </ManageDialog>
  );
}
