import type { ReactNode } from "react";

export interface ManageTableColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ManageTableRowAction {
  ariaLabel: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ManageTableRow {
  actions?: ManageTableRowAction[];
  cells: Record<string, ReactNode>;
  deleteDisabled?: boolean;
  deleteLabel: string;
  editLabel: string;
  id: string;
  onDelete: () => void;
  onEdit: () => void;
}

interface ManageTableProps {
  columns: ManageTableColumn[];
  deleteDisabled?: boolean;
  deleteDisabledReason?: string;
  editButtonLabel?: string;
  emptyMessage: string;
  rows: ManageTableRow[];
}

export function ManageTable({
  columns,
  deleteDisabled = false,
  deleteDisabledReason = "この操作は現在無効です。",
  editButtonLabel = "編集",
  emptyMessage,
  rows,
}: ManageTableProps) {
  return (
    <table className="ouchi-manage-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              className={column.numeric ? "ouchi-manage-table-number" : undefined}
              key={column.key}
              scope="col"
            >
              {column.label}
            </th>
          ))}
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="ouchi-manage-table-empty" colSpan={columns.length + 1}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  className={
                    column.numeric ? "ouchi-manage-table-number" : undefined
                  }
                  key={column.key}
                >
                  {row.cells[column.key] ?? "—"}
                </td>
              ))}
              <td className="ouchi-manage-table-actions">
                <button
                  aria-label={row.editLabel}
                  onClick={row.onEdit}
                  type="button"
                >
                  {editButtonLabel}
                </button>
                {(row.actions ?? []).map((action) => (
                  <span key={action.label}>
                    {" "}
                    <button
                      aria-label={action.ariaLabel}
                      disabled={action.disabled}
                      onClick={action.onClick}
                      type="button"
                    >
                      {action.label}
                    </button>
                  </span>
                ))}{" "}
                <button
                  aria-label={row.deleteLabel}
                  className="ouchi-manage-danger"
                  disabled={deleteDisabled || row.deleteDisabled}
                  onClick={row.onDelete}
                  title={
                    deleteDisabled
                      ? deleteDisabledReason
                      : row.deleteDisabled
                      ? "使用中のため削除できません"
                      : undefined
                  }
                  type="button"
                >
                  削除
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
