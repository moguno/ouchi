import "./styles/entity-dialog.css";
import { useEffect, useRef } from "react";

const DEMO_SERVICE_LINK_MESSAGE =
  "ここをクリックすると設定したURLにジャンプします";

export function DemoServiceLinkDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="ouchi-dialog-backdrop ouchi-dialog-backdrop--confirm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-describedby="ouchi-demo-service-message"
        aria-labelledby="ouchi-demo-service-title"
        aria-modal="true"
        className="ouchi-confirm-dialog ouchi-demo-service-dialog"
        role="alertdialog"
      >
        <p className="ouchi-eyebrow">表示専用デモ</p>
        <h3 id="ouchi-demo-service-title">サービスのリンク</h3>
        <p id="ouchi-demo-service-message">
          {DEMO_SERVICE_LINK_MESSAGE}
        </p>
        <div className="ouchi-form-actions">
          <button
            className="ouchi-primary-button"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            閉じる
          </button>
        </div>
      </section>
    </div>
  );
}
