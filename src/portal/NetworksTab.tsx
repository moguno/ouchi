import { ManageTable, type ManageTableColumn } from "./ManageTable";
import { sortNetworksForDisplay } from "./networkOrder";
import type { PortalDataV2 } from "./types";

interface NetworksTabProps {
  data: PortalDataV2;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  saveDisabled?: boolean;
}

const columns: ManageTableColumn[] = [
  { key: "name", label: "名前" },
  { key: "cidr", label: "CIDR" },
  { key: "deviceCount", label: "デバイス数", numeric: true },
];

export function NetworksTab({
  data,
  onAdd,
  onDelete,
  onEdit,
  saveDisabled = false,
}: NetworksTabProps) {
  const rows = sortNetworksForDisplay(data.networks).map((network) => {
    const deviceCount = new Set(
      data.interfaces
        .filter((iface) => iface.networkId === network.id)
        .map((iface) => iface.deviceId),
    ).size;
    return {
      id: network.id,
      cells: {
        name: network.name,
        cidr: network.cidr || "—",
        deviceCount,
      },
      editLabel: `${network.name}を編集`,
      deleteLabel: `${network.name}を削除`,
      onEdit: () => onEdit(network.id),
      onDelete: () => onDelete(network.id),
    };
  });

  return (
    <section aria-labelledby="ouchi-networks-heading">
      <h2 id="ouchi-networks-heading">ネットワーク</h2>
      <div className="ouchi-manage-toolbar">
        <button className="primary" onClick={onAdd} type="button">
          ネットワークを追加
        </button>
      </div>
      <ManageTable
        columns={columns}
        deleteDisabled={saveDisabled}
        deleteDisabledReason="デモモードでは保存されません。"
        emptyMessage="ネットワークはまだ登録されていません。"
        rows={rows}
      />
    </section>
  );
}
