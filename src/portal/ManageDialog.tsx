import "./styles/manage-simple.css";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

interface ManageDialogProps {
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  role?: "alertdialog" | "dialog";
  title: string;
  wide?: boolean;
}

export function ManageDialog({
  children,
  initialFocusRef,
  onClose,
  role = "dialog",
  title,
  wide = false,
}: ManageDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        // jsdom does not implement showModal; the open attribute keeps the
        // same dialog semantics available to component tests.
        dialog.setAttribute("open", "");
      }
    }

    const focusTimer = window.setTimeout(
      () => initialFocusRef?.current?.focus(),
      0,
    );
    return () => {
      window.clearTimeout(focusTimer);
      if (dialog.open) {
        if (typeof dialog.close === "function") {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      }
    };
  }, [initialFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <dialog
      aria-labelledby={titleId}
      aria-modal="true"
      className={`ouchi-manage-dialog${wide ? " ouchi-manage-dialog--wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      ref={dialogRef}
      role={role}
    >
      <header className="ouchi-manage-dialog-header">
        <h2 id={titleId}>{title}</h2>
      </header>
      {children}
    </dialog>
  );
}
