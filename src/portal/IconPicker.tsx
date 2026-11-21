import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_ICON_REFERENCE,
  FAVICON_ICON_REFERENCE,
  dashboardIconReference,
  iconReferenceKind,
  iconReferenceId,
  iconReferenceLabel,
  normalizeIconReference,
  searchBuiltInIcons,
  searchDashboardIcons,
  type DashboardIconEntry,
  type PickerIconOption,
} from "./iconCatalog";
import { ServiceIcon } from "./icons";
import type { PortalIconReference } from "./types";

export function IconPicker({
  value,
  onChange,
  serviceUrl,
}: {
  value: PortalIconReference;
  onChange: (value: PortalIconReference) => void;
  serviceUrl?: string;
}) {
  const [query, setQuery] = useState("");
  const [urlDraft, setUrlDraft] = useState(
    value.startsWith("url:") ? value.slice("url:".length) : "",
  );
  const deferredQuery = useDeferredValue(query);
  const selectedReference = normalizeIconReference(value);
  const groupId = useId();
  const builtIn = useMemo(
    () => searchBuiltInIcons(deferredQuery),
    [deferredQuery],
  );
  const dashboard = useMemo(
    () => searchDashboardIcons(deferredQuery),
    [deferredQuery],
  );
  const total = builtIn.length + dashboard.length;

  useEffect(() => {
    if (iconReferenceKind(value) === "url") {
      setUrlDraft(iconReferenceId(value));
    }
  }, [value]);

  function selectReference(reference: PortalIconReference) {
    if (reference.startsWith("url:")) {
      setUrlDraft(reference.slice("url:".length));
    }
    onChange(reference);
  }

  function updateUrlDraft(next: string) {
    setUrlDraft(next);
    onChange(
      next.trim()
        ? `url:${next.trim()}`
        : DEFAULT_ICON_REFERENCE,
    );
  }

  return (
    <div
      aria-labelledby={`${groupId}-label`}
      className="ouchi-icon-picker"
      role="group"
    >
      <div className="ouchi-icon-picker-heading">
        <div>
          <span id={`${groupId}-label`}>アイコン</span>
          <small>名称または slug で検索できます。</small>
        </div>
        <span
          className="ouchi-icon-picker-selected"
          data-icon-reference={selectedReference}
        >
          選択中: {iconReferenceLabel(selectedReference)}
        </span>
      </div>

      <div className="ouchi-icon-picker-current">
        <ServiceIcon
          iconKey={selectedReference}
          serviceUrl={serviceUrl}
          size={42}
        />
        <div>
          <strong>{iconReferenceLabel(selectedReference)}</strong>
          <code>{selectedReference}</code>
        </div>
      </div>

      <div className="ouchi-icon-reference-controls">
        <button
          aria-pressed={selectedReference === FAVICON_ICON_REFERENCE}
          className="ouchi-secondary-button ouchi-secondary-button--compact"
          onClick={() => onChange(FAVICON_ICON_REFERENCE)}
          type="button"
        >
          サービスの favicon を使う
        </button>
        <label className="ouchi-field">
          <span>アイコン画像 URL</span>
          <input
            aria-describedby={`${groupId}-url-help`}
            aria-label="アイコン画像URL"
            onChange={(event) => updateUrlDraft(event.target.value)}
            placeholder="https://example.com/icon.svg"
            type="url"
            value={urlDraft}
          />
          <small id={`${groupId}-url-help`}>
            URLを入力すると `url:` 参照として保存します。読み込めない場合は
            同梱の汎用アイコンを表示します。
          </small>
        </label>
      </div>

      <label className="ouchi-icon-search">
        <span>アイコンを検索</span>
        <input
          aria-controls={`${groupId}-results`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="例: メール、grafana、plex"
          type="search"
          value={query}
        />
      </label>

      <p aria-live="polite" className="ouchi-icon-result-count" role="status">
        {total}件の候補
      </p>

      <div className="ouchi-icon-picker-results" id={`${groupId}-results`}>
        <IconOptionGroup
          emptyMessage="条件に一致する同梱アイコンはありません。"
          groupId={`${groupId}-built-in`}
          label="汎用アイコン"
          options={builtIn}
          selectedReference={selectedReference}
          onSelect={selectReference}
        />
        <DashboardOptionGroup
          emptyMessage="条件に一致する dashboard-icons はありません。"
          groupId={`${groupId}-dashboard`}
          icons={dashboard}
          query={deferredQuery}
          selectedReference={selectedReference}
          onSelect={selectReference}
        />
      </div>
    </div>
  );
}

function IconOptionGroup({
  groupId,
  label,
  options,
  selectedReference,
  emptyMessage,
  onSelect,
}: {
  groupId: string;
  label: string;
  options: PickerIconOption[];
  selectedReference: PortalIconReference;
  emptyMessage: string;
  onSelect: (value: PortalIconReference) => void;
}) {
  return (
    <section className="ouchi-icon-option-group">
      <header>
        <h4 id={`${groupId}-title`}>{label}</h4>
        <span>{options.length}</span>
      </header>
      {options.length === 0 ? (
        <p className="ouchi-icon-option-empty">{emptyMessage}</p>
      ) : (
        <div
          aria-labelledby={`${groupId}-title`}
          className="ouchi-icon-option-grid"
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.reference === selectedReference;
            return (
              <button
                aria-label={`${option.label}を選択`}
                aria-selected={selected}
                className="ouchi-icon-option"
                key={option.reference}
                onClick={() => onSelect(option.reference)}
                role="option"
                type="button"
              >
                <ServiceIcon
                  allowRemoteAssets={false}
                  iconKey={option.reference}
                  size={34}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>汎用</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DashboardOptionGroup({
  groupId,
  icons,
  selectedReference,
  query,
  emptyMessage,
  onSelect,
}: {
  groupId: string;
  icons: DashboardIconEntry[];
  selectedReference: PortalIconReference;
  query: string;
  emptyMessage: string;
  onSelect: (value: PortalIconReference) => void;
}) {
  return (
    <section className="ouchi-icon-option-group">
      <header>
        <h4 id={`${groupId}-title`}>dashboard-icons</h4>
        <span>{icons.length}</span>
      </header>
      <p className="ouchi-icon-group-note">
        {query.trim()
          ? "同梱索引を検索しています。選択すると jsDelivr の SVG URL を保存します。"
          : "主要な候補を表示しています。検索すると全同梱索引から絞り込みます。"}
      </p>
      {icons.length === 0 ? (
        <p className="ouchi-icon-option-empty">{emptyMessage}</p>
      ) : (
        <div
          aria-labelledby={`${groupId}-title`}
          className="ouchi-icon-option-grid"
          role="listbox"
        >
          {icons.map((icon) => {
            const reference = dashboardIconReference(icon.slug);
            const selected = reference === selectedReference;
            return (
              <button
                aria-label={`${icon.name}を選択`}
                aria-selected={selected}
                className="ouchi-icon-option"
                key={reference}
                onClick={() => onSelect(reference)}
                role="option"
                type="button"
              >
                <ServiceIcon
                  iconKey={reference}
                  allowRemoteAssets
                  size={34}
                />
                <span>
                  <strong>{icon.name}</strong>
                  <small>{icon.slug}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
