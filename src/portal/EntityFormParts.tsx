import type { Dispatch, SetStateAction } from "react";
import type {
  PortalProperties,
  ValidationIssue,
} from "./types";
import {
  generateId,
  issuesToRecord,
  MAX_PROPERTY_KEY_LENGTH,
  PLAINTEXT_SECRET_WARNING,
} from "./validation";
import type { PropertyDraft } from "./entityDialogTypes";

export function FieldError({
  id,
  children,
}: {
  id: string;
  children?: string;
}) {
  if (!children) {
    return null;
  }
  return (
    <span className="ouchi-field-error" id={id} role="alert">
      {children}
    </span>
  );
}

export function FormNotice({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="ouchi-form-error-summary" role="alert">
      <strong>入力内容を確認してください</strong>
      <ul>
        {issues.slice(0, 5).map((issue, index) => (
          <li key={`${issue.path}-${index}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}

export function FormActions({
  disabled = false,
  disabledReason,
  onClose,
  saving = false,
  submitLabel,
}: {
  disabled?: boolean;
  disabledReason?: string;
  onClose: () => void;
  saving?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="ouchi-manage-form-actions">
      <button onClick={onClose} type="button">
        キャンセル
      </button>
      <button
        className="primary"
        disabled={saving || disabled}
        title={disabled ? disabledReason : undefined}
        type="submit"
      >
        {saving ? "保存中" : submitLabel}
      </button>
    </div>
  );
}

export function propertyDraftsFrom(
  properties: PortalProperties | undefined,
): PropertyDraft[] {
  return Object.entries(properties ?? {}).map(([key, value]) => ({
    id: generateId("property"),
    key,
    value,
  }));
}

export function propertiesFromDrafts(
  drafts: PropertyDraft[],
): PortalProperties {
  return Object.fromEntries(
    drafts.map((draft) => [draft.key, draft.value]),
  );
}

export function PropertiesEditor({
  drafts,
  setDrafts,
}: {
  drafts: PropertyDraft[];
  setDrafts: Dispatch<SetStateAction<PropertyDraft[]>>;
}) {
  return (
    <section
      aria-labelledby="ouchi-properties-heading"
      className="ouchi-form-section ouchi-properties-editor"
    >
      <header>
        <div>
          <strong id="ouchi-properties-heading">プロパティ</strong>
          <small>
            任意のキーと文字列を本体情報として保存します。保存時は行全体を一括送信します。
          </small>
        </div>
        <button
          className="ouchi-secondary-button ouchi-secondary-button--compact"
          onClick={() =>
            setDrafts((current) => [
              ...current,
              { id: generateId("property"), key: "", value: "" },
            ])
          }
          type="button"
        >
          プロパティを追加
        </button>
      </header>
      <p className="ouchi-properties-warning" role="note">
        {PLAINTEXT_SECRET_WARNING}。
      </p>
      {drafts.length === 0 ? (
        <p className="ouchi-inline-hint">
          プロパティは未設定です。必要に応じて行を追加してください。
        </p>
      ) : (
        <div className="ouchi-editor-stack">
          {drafts.map((draft, index) => (
            <div className="ouchi-property-row" key={draft.id}>
              <label className="ouchi-field">
                <span>キー {index + 1}</span>
                <input
                  aria-label={`プロパティキー ${index + 1}`}
                  maxLength={MAX_PROPERTY_KEY_LENGTH}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.id === draft.id
                          ? { ...item, key: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="例: vault_path"
                  value={draft.key}
                />
              </label>
              <label className="ouchi-field">
                <span>値 {index + 1}</span>
                <input
                  aria-label={`プロパティ値 ${index + 1}`}
                  onChange={(event) =>
                    setDrafts((current) =>
                      current.map((item) =>
                        item.id === draft.id
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="例: sops:devices/nanopi/monitor_key"
                  value={draft.value}
                />
              </label>
              <button
                aria-label={`プロパティ ${index + 1}を削除`}
                className="ouchi-manage-danger"
                onClick={() =>
                  setDrafts((current) =>
                    current.filter((item) => item.id !== draft.id),
                  )
                }
                type="button"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function setIssues(
  issues: ValidationIssue[],
  setter: (value: Record<string, string>) => void,
) {
  setter(issuesToRecord(issues));
}
