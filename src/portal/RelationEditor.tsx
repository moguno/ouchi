import type {
  PortalDevice,
  PortalRelation,
  PortalRelationName,
} from "./types";
import {
  hasRelationPlaceholder,
  resolveRelationLabel,
} from "./relationLabels";

export type RelationEditableField = keyof Pick<
  PortalRelation,
  | "fromDeviceId"
  | "toDeviceId"
  | "relationName"
  | "fromPlaceholder"
  | "toPlaceholder"
>;

interface RelationEditorProps {
  relation: PortalRelation;
  index: number;
  fromDevices: PortalDevice[];
  toDevices: PortalDevice[];
  relationNames: PortalRelationName[];
  showFromDevice?: boolean;
  onChange: (field: RelationEditableField, value: string) => void;
  onDelete: () => void;
}

export function RelationEditor({
  relation,
  index,
  fromDevices,
  toDevices,
  relationNames,
  showFromDevice = false,
  onChange,
  onDelete,
}: RelationEditorProps) {
  const selectedRelationName = relationNames.find(
    (candidate) => candidate.name === relation.relationName,
  );
  const showFromPlaceholder = hasRelationPlaceholder(
    selectedRelationName?.fromLabel,
  );
  const showToPlaceholder = hasRelationPlaceholder(
    selectedRelationName?.toLabel,
  );
  const fromLabel = resolveRelationLabel(
    selectedRelationName?.fromLabel,
    relation.fromPlaceholder,
    selectedRelationName?.name ?? relation.relationName,
  );
  const toLabel = resolveRelationLabel(
    selectedRelationName?.toLabel,
    relation.toPlaceholder,
    selectedRelationName?.name ?? relation.relationName,
  );
  const fromDevice = fromDevices.find(
    (device) => device.id === relation.fromDeviceId,
  );
  const toDevice = toDevices.find(
    (device) => device.id === relation.toDeviceId,
  );
  const fromDeviceName =
    fromDevice?.petname?.trim() ||
    fromDevice?.name ||
    "始点未選択";
  const toDeviceName =
    toDevice?.petname?.trim() ||
    toDevice?.name ||
    "終点未選択";

  return (
    <div className="ouchi-relation-row">
      <div className="ouchi-relation-row-route">
        <span className="ouchi-relation-endpoint">
          <strong>{fromDeviceName}</strong>
          <small>{fromLabel}</small>
        </span>
        <span aria-hidden="true">→</span>
        <span className="ouchi-relation-endpoint">
          <strong>{toDeviceName}</strong>
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
      {showFromDevice && (
        <label className="ouchi-field">
          <span>始点デバイス {index + 1}</span>
          <select
            aria-label={`始点デバイス ${index + 1}`}
            autoFocus={index === 0}
            onChange={(event) =>
              onChange("fromDeviceId", event.target.value)
            }
            value={relation.fromDeviceId}
          >
            {fromDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.petname?.trim() || device.name}
              </option>
            ))}
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
        <span>終点デバイス {index + 1}</span>
        <select
          aria-label={`終点デバイス ${index + 1}`}
          onChange={(event) => onChange("toDeviceId", event.target.value)}
          value={relation.toDeviceId}
        >
          {toDevices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.petname?.trim() || device.name}
            </option>
          ))}
        </select>
      </label>
      {showFromPlaceholder && (
        <label className="ouchi-field">
          <span>始点プレースホルダー {index + 1}</span>
          <input
            aria-label={`始点プレースホルダー ${index + 1}`}
            onChange={(event) =>
              onChange("fromPlaceholder", event.target.value)
            }
            placeholder="空なら -"
            value={relation.fromPlaceholder ?? ""}
          />
        </label>
      )}
      {showToPlaceholder && (
        <label className="ouchi-field">
          <span>終点プレースホルダー {index + 1}</span>
          <input
            aria-label={`終点プレースホルダー ${index + 1}`}
            onChange={(event) =>
              onChange("toPlaceholder", event.target.value)
            }
            placeholder="空なら -"
            value={relation.toPlaceholder ?? ""}
          />
        </label>
      )}
      {selectedRelationName && (
        <p className="ouchi-inline-hint">
          色と方向ラベルは関係名「{selectedRelationName.name}」の定義を使います。
          {"{} "}は対応するプレースホルダーで置換され、空なら{" - "}
          になります。
        </p>
      )}
    </div>
  );
}
