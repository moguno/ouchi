import { ManageTable, type ManageTableColumn } from "./ManageTable";
import { sortNetworksForDisplay } from "./networkOrder";
import type { PortalDataV2 } from "./types";

interface NetworksTabProps {
  data: PortalDataV2;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onNetworkMemo: (id: string) => void;
  onMoveNetwork: (id: string, direction: "up" | "down") => void;
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
  onNetworkMemo,
  onMoveNetwork,
  saveDisabled = false,
}: NetworksTabProps) {
  const ordered = sortNetworksForDisplay(data.networks);
  const rows = ordered.map((network, index) => {
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
      actions: [
        {
          label: "↑",
          ariaLabel: `${network.name}を上へ移動`,
          disabled: saveDisabled || index === 0,
          onClick: () => onMoveNetwork(network.id, "up"),
        },
        {
          label: "↓",
          ariaLabel: `${network.name}を下へ移動`,
          disabled: saveDisabled || index === ordered.length - 1,
          onClick: () => onMoveNetwork(network.id, "down"),
        },
        {
          label: "メモ",
          ariaLabel: `${network.name}のメモ`,
          onClick: () => onNetworkMemo(network.id),
        },
      ],
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
