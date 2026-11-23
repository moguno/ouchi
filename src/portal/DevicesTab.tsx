import { ManageTable, type ManageTableColumn } from "./ManageTable";
import {
  DEVICE_CATEGORY_LABELS,
  type PortalDataV2,
} from "./types";

interface DevicesTabProps {
  data: PortalDataV2;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onDeviceMemo: (id: string) => void;
  saveDisabled?: boolean;
}

const columns: ManageTableColumn[] = [
  { key: "name", label: "名前" },
  { key: "hostname", label: "ホスト名" },
  { key: "ip", label: "IP" },
  { key: "category", label: "カテゴリ" },
];

export function DevicesTab({
  data,
  onAdd,
  onDelete,
  onEdit,
  onDeviceMemo,
  saveDisabled = false,
}: DevicesTabProps) {
  const addDisabled = data.networks.length === 0;
  const rows = data.devices.map((device) => {
    const memberships = data.deviceNetworks.filter(
      (membership) => membership.deviceId === device.id,
    );
    const displayName = device.petname?.trim() || device.name;
    return {
      id: device.id,
      cells: {
        name: displayName,
        hostname: device.name,
        ip:
          memberships
            .map((membership) => membership.ip)
            .filter(Boolean)
            .join(", ") || "—",
        category: DEVICE_CATEGORY_LABELS[device.category],
      },
      editLabel: `${displayName}を編集`,
      deleteLabel: `${displayName}を削除`,
      actions: [
        {
          label: "メモ",
          ariaLabel: `${displayName}のメモ`,
          onClick: () => onDeviceMemo(device.id),
        },
      ],
      onEdit: () => onEdit(device.id),
      onDelete: () => onDelete(device.id),
    };
  });

  return (
    <section aria-labelledby="ouchi-devices-heading">
      <h2 id="ouchi-devices-heading">デバイス</h2>
      <div className="ouchi-manage-toolbar">
        <button
          className="primary"
          disabled={addDisabled}
          onClick={onAdd}
          type="button"
        >
          デバイスを追加
        </button>
      </div>
      {addDisabled && (
        <p className="ouchi-manage-inline-hint">
          先にネットワークを追加してください。
        </p>
      )}
      <ManageTable
        columns={columns}
        deleteDisabled={saveDisabled}
        deleteDisabledReason="デモモードでは保存されません。"
        editButtonLabel="基本"
        emptyMessage="デバイスはまだ登録されていません。"
        rows={rows}
      />
    </section>
  );
}
