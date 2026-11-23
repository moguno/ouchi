import { useRef } from "react";
import { ManageDialog } from "./ManageDialog";

export function ConfirmDialog({
  title,
  description,
  onCancel,
  onConfirm,
  confirmDisabled = false,
}: {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <ManageDialog
      initialFocusRef={confirmRef}
      onClose={onCancel}
      role="alertdialog"
      title={title}
    >
      <div className="ouchi-manage-form">
        <p>{description}</p>
        <div className="ouchi-manage-form-actions">
          <button onClick={onCancel} type="button">
            キャンセル
          </button>
          <button
            className="ouchi-manage-danger"
            disabled={confirmDisabled}
            onClick={onConfirm}
            ref={confirmRef}
            title={
              confirmDisabled
                ? "デモモードでは保存されません。"
                : undefined
            }
            type="button"
          >
            削除する
          </button>
        </div>
      </div>
    </ManageDialog>
  );
}
