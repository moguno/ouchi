import {
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import {
  ACCENT_LABELS,
  ACCENT_TONES,
  type AccentTone,
  type PortalNetwork,
  type ValidationIssue,
} from "./types";
import {
  generateId,
  validateNetworkInput,
} from "./validation";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import type { EntityFormProps } from "./entityDialogTypes";

export function NetworkEntityDialog({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
  saveDisabled = false,
}: EntityFormProps<PortalNetwork>) {
  const [name, setName] = useState(editing?.name ?? "");
  const [cidr, setCidr] = useState(editing?.cidr ?? "");
  const [accent, setAccent] = useState<AccentTone>(
    editing?.accent ?? "blue",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const input = { name, cidr: cidr.trim() || undefined, accent };
    const issues = validateNetworkInput(input, data, editing?.id);
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      setFormIssues(issues);
      return;
    }

    setErrors({});
    setFormIssues([]);
    onSave("network", {
      id: editing?.id ?? generateId("network"),
      name: name.trim(),
      cidr: cidr.trim() || undefined,
      accent,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <FormNotice issues={formIssues} />
      <label className="ouchi-field">
        <span>ネットワーク名</span>
        <input
          aria-describedby={errors.name ? "network-name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: インターネット"
          ref={firstFieldRef as RefObject<HTMLInputElement | null>}
          required
          value={name}
        />
        <FieldError id="network-name-error">{errors.name}</FieldError>
      </label>

      <label className="ouchi-field">
        <span id="network-cidr-label">CIDR</span>
        <input
          aria-labelledby="network-cidr-label"
          aria-describedby={
            errors.cidr ? "network-cidr-error" : "network-cidr-help"
          }
          aria-invalid={Boolean(errors.cidr)}
          onChange={(event) => setCidr(event.target.value)}
          placeholder="例: 192.168.0.0/24"
          value={cidr}
        />
        <small id="network-cidr-help">
          「インターネット」など範囲を限定しない場合は空欄にします。
        </small>
        <FieldError id="network-cidr-error">{errors.cidr}</FieldError>
      </label>

      <label className="ouchi-field">
        <span>アクセント色</span>
        <select
          onChange={(event) => setAccent(event.target.value as AccentTone)}
          value={accent}
        >
          {ACCENT_TONES.map((tone) => (
            <option key={tone} value={tone}>
              {ACCENT_LABELS[tone]}
            </option>
          ))}
        </select>
      </label>

      <FormActions
        disabled={saveDisabled}
        disabledReason="デモモードでは保存されません。"
        onClose={onClose}
        submitLabel={editing ? "保存" : "追加する"}
      />
    </form>
  );
}
