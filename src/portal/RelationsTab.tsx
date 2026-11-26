import { useState } from "react";
import { ManageTable, type ManageTableColumn } from "./ManageTable";
import { RelationNameDialog } from "./RelationNameDialog";
import type {
  PortalDataV2,
  PortalRelationName,
} from "./types";

interface RelationsTabProps {
  addDisabled: boolean;
  data: PortalDataV2;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDeleteRelationName: (id: string) => void;
  onEdit: (id: string) => void;
  onRelationMemo: (id: string) => void;
  onSaveRelationName: (relationName: PortalRelationName) => Promise<boolean>;
  saveDisabled?: boolean;
}

const relationNameColumns: ManageTableColumn[] = [
  { key: "name", label: "名前" },
  { key: "color", label: "色" },
  { key: "count", label: "使用数", numeric: true },
];

const relationColumns: ManageTableColumn[] = [
  { key: "name", label: "関係名" },
  { key: "from", label: "始点" },
  { key: "fromLabel", label: "始点ラベル" },
  { key: "to", label: "終点" },
  { key: "toLabel", label: "終点ラベル" },
];

export function RelationsTab({
  addDisabled,
  data,
  onAdd,
  onDelete,
  onDeleteRelationName,
  onEdit,
  onRelationMemo,
  onSaveRelationName,
  saveDisabled = false,
}: RelationsTabProps) {
  const [relationNameDialog, setRelationNameDialog] = useState<{
    editingId?: string;
  } | null>(null);

  const relationNameRows = data.relationNames.map((relationName) => {
    const inUse = relationName.relationCount > 0;
    return {
      id: relationName.id,
      cells: {
        name: relationName.name,
        color: (
          <>
            <span
              aria-hidden="true"
              className="ouchi-manage-color-swatch"
              style={{ background: relationName.color }}
            />
            {relationName.color}
          </>
        ),
        count: relationName.relationCount,
      },
      editLabel: `${relationName.name}を編集`,
      deleteLabel: inUse
        ? `${relationName.name}は使用中のため削除できません`
        : `${relationName.name}を削除`,
      deleteDisabled: inUse,
      onEdit: () =>
        setRelationNameDialog({ editingId: relationName.id }),
      onDelete: () => onDeleteRelationName(relationName.id),
    };
  });

  const relationRows = data.relations.map((relation) => {
    const endpoint = (
      deviceId: string,
      interfaceId: string | null,
      serviceId: string | null,
    ) => {
      const deviceName =
        data.devices.find((device) => device.id === deviceId)?.name ??
        "不明なデバイス";
      if (serviceId) {
        const service = data.services.find(
          (candidate) => candidate.id === serviceId,
        );
        const serviceLabel = service
          ? service.petname?.trim() || service.subdomain
          : "不明なサービス";
        return `${deviceName} / サービス: ${serviceLabel}`;
      }
      const interfaceName = data.interfaces.find(
        (iface) => iface.id === interfaceId,
      )?.name;
      return interfaceName ? `${deviceName} / ${interfaceName}` : deviceName;
    };
    const from = endpoint(
      relation.fromDeviceId,
      relation.fromInterfaceId,
      relation.fromServiceId,
    );
    const to = endpoint(
      relation.toDeviceId,
      relation.toInterfaceId,
      relation.toServiceId,
    );
    const relationName = relation.relationName.trim() || "関係名なし";
    return {
      id: relation.id,
      cells: {
        name: relationName,
        from,
        fromLabel: relation.fromLabel.trim() || "-",
        to,
        toLabel: relation.toLabel.trim() || "-",
      },
      editLabel: `${from}から${to}への関係を編集`,
      deleteLabel: `${from}から${to}への関係を削除`,
      actions: [
        {
          label: "メモ",
          ariaLabel: `${from}から${to}への関係のメモ`,
          onClick: () => onRelationMemo(relation.id),
        },
      ],
      onEdit: () => onEdit(relation.id),
      onDelete: () => onDelete(relation.id),
    };
  });

  const editingRelationName = relationNameDialog?.editingId
    ? data.relationNames.find(
        (relationName) =>
          relationName.id === relationNameDialog.editingId,
      )
    : undefined;

  return (
    <>
      <section aria-labelledby="ouchi-relation-names-heading">
        <h2 id="ouchi-relation-names-heading">関係名</h2>
        <div className="ouchi-manage-toolbar">
          <button
            className="primary"
            onClick={() => setRelationNameDialog({})}
            type="button"
          >
            関係名を追加
          </button>
        </div>
        <ManageTable
          columns={relationNameColumns}
          deleteDisabled={saveDisabled}
          deleteDisabledReason="デモモードでは保存されません。"
          emptyMessage="関係名はまだ登録されていません。"
          rows={relationNameRows}
        />
        <p className="ouchi-manage-note">
          使用中の関係名は削除できません。編集はダイアログで行います。
        </p>
      </section>

      <section
        aria-labelledby="ouchi-relations-heading"
        className="ouchi-manage-section"
      >
        <h2 id="ouchi-relations-heading">関係</h2>
        <div className="ouchi-manage-toolbar">
          <button
            className="primary"
            disabled={addDisabled}
            onClick={onAdd}
            type="button"
          >
            関係を追加
          </button>
        </div>
        {addDisabled && (
          <p className="ouchi-manage-inline-hint">
            関係を作成するにはデバイス2台以上と関係名が必要です。
          </p>
        )}
        <ManageTable
          columns={relationColumns}
          deleteDisabled={saveDisabled}
          deleteDisabledReason="デモモードでは保存されません。"
          editButtonLabel="基本"
          emptyMessage="関係はまだ登録されていません。"
          rows={relationRows}
        />
      </section>

      {relationNameDialog && (
        <RelationNameDialog
          data={data}
          editing={editingRelationName}
          onClose={() => setRelationNameDialog(null)}
          onSave={onSaveRelationName}
          saveDisabled={saveDisabled}
        />
      )}
    </>
  );
}
