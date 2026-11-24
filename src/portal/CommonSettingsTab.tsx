import type {
  ChangeEvent,
  FormEvent,
} from "react";
import type { PortalDataV2 } from "./types";
import { MAX_PORTAL_TITLE_LENGTH } from "./validation";

export interface LedgerImportFile {
  name: string;
  yaml: string;
}

interface CommonSettingsTabProps {
  data: PortalDataV2;
  importFile?: LedgerImportFile;
  onApplyImport: () => void;
  onExportLedger: () => void;
  onSelectImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onSavePortalTitle: (event: FormEvent<HTMLFormElement>) => void;
  onTitleDraftChange: (value: string) => void;
  titleDraft: string;
  titleError?: string;
  titleSaveDisabled: boolean;
  titleSaving: boolean;
  transferBusy: boolean;
  saveDisabled?: boolean;
  transferError?: string;
  transferNotice?: string;
}

export function CommonSettingsTab({
  data,
  importFile,
  onApplyImport,
  onExportLedger,
  onSelectImportFile,
  onSavePortalTitle,
  onTitleDraftChange,
  titleDraft,
  titleError,
  titleSaveDisabled,
  titleSaving,
  transferBusy,
  saveDisabled = false,
  transferError,
  transferNotice,
}: CommonSettingsTabProps) {
  return (
    <div className="ouchi-settings-grid">
      <section aria-labelledby="ouchi-portal-title-settings">
        <h2 id="ouchi-portal-title-settings">ポータルのタイトル</h2>
        <form onSubmit={onSavePortalTitle}>
          <div className="ouchi-setting-fields">
            <label>
              <span>ポータルタイトル</span>
              <input
                aria-label="ポータルタイトル"
                maxLength={MAX_PORTAL_TITLE_LENGTH}
                onChange={(event) =>
                  onTitleDraftChange(event.target.value)
                }
                value={titleDraft}
              />
            </label>
          </div>
          <button
            className="primary"
            disabled={titleSaveDisabled}
            title={
              saveDisabled
                ? "デモモードでは保存されません。"
                : undefined
            }
            type="submit"
          >
            {titleSaving ? "保存中" : "タイトルを保存"}
          </button>
        </form>
        {titleError && <p role="alert">{titleError}</p>}
      </section>

      <section aria-labelledby="ouchi-ledger-transfer">
        <h2 id="ouchi-ledger-transfer">設定のエクスポート／インポート</h2>
        <p>
          YAMLで台帳一式を移行します。公開鍵だけを出力し、秘密情報は含みません。
        </p>
        <p>
          <button
            className="primary"
            disabled={transferBusy}
            onClick={onExportLedger}
            type="button"
          >
            YAMLをエクスポート
          </button>
        </p>

        <div className="ouchi-ledger-import">
          <label className="ouchi-ledger-file-picker">
            <span>インポートするYAML</span>
            <input
              accept=".yaml,.yml,application/yaml,text/yaml"
              aria-label="インポートするYAMLファイル"
              disabled={transferBusy || saveDisabled}
              onChange={onSelectImportFile}
              title={
                saveDisabled
                  ? "デモモードではYAMLをインポートできません。"
                  : undefined
              }
              type="file"
            />
          </label>

          {importFile && (
            <div className="ouchi-ledger-preview">
              <div>
                <strong>{importFile.name}</strong>
                <span>{importFile.yaml.length.toLocaleString()} 文字</span>
              </div>
              <pre aria-label="インポート内容のプレビュー">
                {importFile.yaml.slice(0, 3000)}
                {importFile.yaml.length > 3000 ? "\n…" : ""}
              </pre>
              <p className="ouchi-ledger-warning" role="alert">
                適用すると現在のネットワーク、デバイス、所属IP、関係、サービス、鍵情報は
                すべて置き換わります。内容を確認してから適用してください。
              </p>
              <p>
                <button
                  className="ouchi-manage-danger"
                  disabled={transferBusy || saveDisabled}
                  onClick={onApplyImport}
                  title={
                    saveDisabled
                      ? "デモモードでは保存されません。"
                      : undefined
                  }
                  type="button"
                >
                  内容を確認して全置き換え
                </button>
              </p>
            </div>
          )}
        </div>

        {transferError && (
          <p className="ouchi-ledger-transfer-error" role="alert">
            {transferError}
          </p>
        )}
        {transferNotice && (
          <p className="ouchi-ledger-transfer-notice" role="status">
            {transferNotice}
          </p>
        )}
      </section>
    </div>
  );
}
