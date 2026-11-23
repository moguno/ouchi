import { ManageTable, type ManageTableColumn } from "./ManageTable";
import type { PortalDataV2 } from "./types";

interface ServicesTabProps {
  data: PortalDataV2;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onServiceMemo: (id: string) => void;
  onServiceTop: (id: string) => void;
  onServiceIcon: (id: string) => void;
  saveDisabled?: boolean;
}

const columns: ManageTableColumn[] = [
  { key: "name", label: "名前" },
  { key: "subdomain", label: "サブドメイン" },
  { key: "device", label: "デバイス" },
  { key: "url", label: "URL" },
];

export function ServicesTab({
  data,
  onAdd,
  onDelete,
  onEdit,
  onServiceMemo,
  onServiceTop,
  onServiceIcon,
  saveDisabled = false,
}: ServicesTabProps) {
  const addDisabled = data.deviceNetworks.length === 0;
  const rows = data.services.map((service) => {
    const membership = data.deviceNetworks.find(
      (item) => item.id === service.deviceNetworkId,
    );
    const device = data.devices.find(
      (item) => item.id === membership?.deviceId,
    );
    const name = service.petname?.trim() || service.subdomain;
    return {
      id: service.id,
      cells: {
        name,
        subdomain: service.subdomain,
        device: device
          ? device.petname?.trim() || device.name
          : "配置先IPなし",
        url: service.url ? <code>{service.url}</code> : "—",
      },
      editLabel: `${name}を編集`,
      deleteLabel: `${name}を削除`,
      actions: [
        {
          label: "トップ",
          ariaLabel: `${name}のトップ`,
          onClick: () => onServiceTop(service.id),
        },
        {
          label: "アイコン",
          ariaLabel: `${name}のアイコン`,
          onClick: () => onServiceIcon(service.id),
        },
        {
          label: "メモ",
          ariaLabel: `${name}のメモ`,
          onClick: () => onServiceMemo(service.id),
        },
      ],
      onEdit: () => onEdit(service.id),
      onDelete: () => onDelete(service.id),
    };
  });

  return (
    <section aria-labelledby="ouchi-services-heading">
      <h2 id="ouchi-services-heading">サービス</h2>
      <div className="ouchi-manage-toolbar">
        <button
          className="primary"
          disabled={addDisabled}
          onClick={onAdd}
          type="button"
        >
          サービスを追加
        </button>
      </div>
      {addDisabled && (
        <p className="ouchi-manage-inline-hint">
          先にデバイスと所属IPを追加してください。
        </p>
      )}
      <ManageTable
        columns={columns}
        editButtonLabel="基本"
        deleteDisabled={saveDisabled}
        deleteDisabledReason="デモモードでは保存されません。"
        emptyMessage="サービスはまだ登録されていません。"
        rows={rows}
      />
      <p className="ouchi-manage-note">
        トップ、アイコン、メモは各行のボタンから設定します。
      </p>
    </section>
  );
}
