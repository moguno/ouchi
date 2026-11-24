import type {
  PortalDevice,
  PortalInterface,
  PortalRelation,
  PortalRelationName,
} from "./types";
import { displayRelationLabel } from "./relationLabels";

export type RelationEditableField = keyof Pick<
  PortalRelation,
  | "fromInterfaceId"
  | "toInterfaceId"
  | "relationName"
  | "fromLabel"
  | "toLabel"
>;

interface RelationEditorProps {
  relation: PortalRelation;
  index: number;
  devices: PortalDevice[];
  interfaces: PortalInterface[];
  relationNames: PortalRelationName[];
  showFromInterface?: boolean;
  onChange: (field: RelationEditableField, value: string) => void;
  onDelete: () => void;
}

function endpointSummary(
  devices: PortalDevice[],
  interfaces: PortalInterface[],
  interfaceId: string,
  fallback: string,
): string {
  const iface = interfaces.find((candidate) => candidate.id === interfaceId);
  if (!iface) {
    return fallback;
  }
  const device = devices.find((candidate) => candidate.id === iface.deviceId);
  const deviceName = device?.petname?.trim() || device?.name || "不明なデバイス";
  return `${deviceName} / ${iface.name}`;
}

export function RelationEditor({
  relation,
  index,
  devices,
  interfaces,
  relationNames,
  showFromInterface = false,
  onChange,
  onDelete,
}: RelationEditorProps) {
  const selectedRelationName = relationNames.find(
    (candidate) => candidate.name === relation.relationName,
  );
  const fromLabel = displayRelationLabel(relation.fromLabel);
  const toLabel = displayRelationLabel(relation.toLabel);
  const fromSummary = endpointSummary(
    devices,
    interfaces,
    relation.fromInterfaceId,
    "始点未選択",
  );
  const toSummary = endpointSummary(
    devices,
    interfaces,
    relation.toInterfaceId,
    "終点未選択",
  );

  function interfaceOptions() {
    return devices.map((device) => (
      <optgroup
        key={device.id}
        label={device.petname?.trim() || device.name}
      >
        {interfaces
          .filter((iface) => iface.deviceId === device.id)
          .map((iface) => (
            <option key={iface.id} value={iface.id}>
              {device.name} / {iface.name}
              {iface.ip ? ` / ${iface.ip}` : ""}
            </option>
          ))}
      </optgroup>
    ));
  }

  return (
    <div className="ouchi-relation-row">
      <div className="ouchi-relation-row-route">
        <span className="ouchi-relation-endpoint">
          <strong>{fromSummary}</strong>
          <small>{fromLabel}</small>
        </span>
        <span aria-hidden="true">→</span>
        <span className="ouchi-relation-endpoint">
          <strong>{toSummary}</strong>
          <small>{toLabel}</small>
        </span>
        <button
          aria-label={`関係 ${index + 1}を削除`}
          className="ouchi-manage-danger"
          onClick={onDelete}
          type="button"
        >
          削除
        </button>
      </div>
      {showFromInterface && (
        <label className="ouchi-field">
          <span>始点インターフェース {index + 1}</span>
          <select
            aria-label={`始点インターフェース ${index + 1}`}
            autoFocus={index === 0}
            onChange={(event) =>
              onChange("fromInterfaceId", event.target.value)
            }
            value={relation.fromInterfaceId}
          >
            {interfaceOptions()}
          </select>
        </label>
      )}
      <label className="ouchi-field">
        <span>関係名 {index + 1}</span>
        <select
          aria-label={`関係名 ${index + 1}`}
          onChange={(event) =>
            onChange("relationName", event.target.value)
          }
          value={relation.relationName}
        >
          {relationNames.length === 0 && (
            <option value="">関係名を先に登録してください</option>
          )}
          {relationNames.map((relationName) => (
            <option key={relationName.id} value={relationName.name}>
              {relationName.name}
            </option>
          ))}
        </select>
      </label>
      <label className="ouchi-field">
        <span>終点インターフェース {index + 1}</span>
        <select
          aria-label={`終点インターフェース ${index + 1}`}
          onChange={(event) => onChange("toInterfaceId", event.target.value)}
          value={relation.toInterfaceId}
        >
          {interfaceOptions()}
        </select>
      </label>
      <label className="ouchi-field">
        <span>始点ラベル {index + 1}</span>
        <input
          aria-label={`始点ラベル ${index + 1}`}
          onChange={(event) =>
            onChange("fromLabel", event.target.value)
          }
          placeholder="空なら表示されません"
          value={relation.fromLabel ?? ""}
        />
      </label>
      <label className="ouchi-field">
        <span>終点ラベル {index + 1}</span>
        <input
          aria-label={`終点ラベル ${index + 1}`}
          onChange={(event) =>
            onChange("toLabel", event.target.value)
          }
          placeholder="空なら表示されません"
          value={relation.toLabel ?? ""}
        />
      </label>
      {selectedRelationName && (
        <p className="ouchi-inline-hint">
          色は関係名「{selectedRelationName.name}」の定義を使います。
          ラベルはこの関係だけの自由な名前で、空なら表示されません。
        </p>
      )}
    </div>
  );
}
