import { useEffect, useId, useRef, useState } from "react";
import {
  FAVICON_ICON_REFERENCE,
  iconReferenceId,
  iconReferenceKind,
  iconReferenceLabel,
  urlIconReference,
} from "./iconCatalog";
import { ServiceIcon } from "./icons";
import { isHttpUrl } from "./validation";
import type { PortalIconKind, PortalIconReference } from "./types";

export function IconPicker({
  value,
  onChange,
  serviceUrl,
}: {
  value: PortalIconReference | null;
  onChange: (value: PortalIconReference | null) => void;
  serviceUrl?: string;
}) {
  const groupId = useId();
  const [kind, setKind] = useState<PortalIconKind>(() =>
    iconReferenceKind(value),
  );
  const [urlDraft, setUrlDraft] = useState(() => iconReferenceId(value));
  // The value this picker emitted most recently. An empty or invalid
  // URL draft emits null (unset) while the URL option stays selected,
  // so the sync below must not treat that null as an external change.
  const emittedRef = useRef<PortalIconReference | null>(value);

  useEffect(() => {
    if (value === emittedRef.current) {
      return;
    }
    setKind(iconReferenceKind(value));
    if (iconReferenceKind(value) === "url") {
      setUrlDraft(iconReferenceId(value));
    }
  }, [value]);

  function emit(nextKind: PortalIconKind, nextDraft: string) {
    setKind(nextKind);
    setUrlDraft(nextDraft);
    let next: PortalIconReference | null;
    if (nextKind === "unset") {
      next = null;
    } else if (nextKind === "favicon") {
      next = FAVICON_ICON_REFERENCE;
    } else {
      const trimmed = nextDraft.trim();
      next = trimmed && isHttpUrl(trimmed) ? urlIconReference(trimmed) : null;
    }
    emittedRef.current = next;
    onChange(next);
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
          <small>未設定・favicon・URL の3つから選びます。</small>
        </div>
        <span className="ouchi-icon-picker-selected">
          選択中: {iconReferenceLabel(value)}
        </span>
      </div>

      <div className="ouchi-icon-picker-current">
        <ServiceIcon iconKey={value} serviceUrl={serviceUrl} size={42} />
        <div>
          <strong>{iconReferenceLabel(value)}</strong>
          <code>{value ?? "未設定"}</code>
        </div>
      </div>

      <div className="ouchi-icon-picker-options">
        <label className="ouchi-icon-picker-option">
          <input
            checked={kind === "unset"}
            name={`${groupId}-kind`}
            onChange={() => emit("unset", urlDraft)}
            type="radio"
          />
          <span>
            未設定
            <small>専用のアイコンを表示します。</small>
          </span>
        </label>
        <label className="ouchi-icon-picker-option">
          <input
            checked={kind === "favicon"}
            name={`${groupId}-kind`}
            onChange={() => emit("favicon", urlDraft)}
            type="radio"
          />
          <span>
            favicon
            <small>サービスの favicon を使います。</small>
          </span>
        </label>
        <label className="ouchi-icon-picker-option">
          <input
            checked={kind === "url"}
            name={`${groupId}-kind`}
            onChange={() => emit("url", urlDraft)}
            type="radio"
          />
          <span>
            URL
            <small>アイコン画像の URL を直接指定します。</small>
          </span>
        </label>
        {kind === "url" && (
          <label className="ouchi-field">
            <span>アイコン画像 URL</span>
            <input
              aria-label="アイコン画像URL"
              onChange={(event) => emit("url", event.target.value)}
              placeholder="https://example.com/icon.svg"
              type="url"
              value={urlDraft}
            />
            <small>http または https の画像 URL を入力してください。</small>
          </label>
        )}
      </div>
    </div>
  );
}
