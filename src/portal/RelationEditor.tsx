import type {
  PortalDevice,
  PortalInterface,
  PortalRelation,
  PortalRelationName,
  PortalService,
} from "./types";
import { displayRelationLabel } from "./relationLabels";

export type RelationEditableField = keyof Pick<
  PortalRelation,
  | "fromInterfaceId"
  | "toInterfaceId"
  | "fromServiceId"
  | "toServiceId"
  | "relationName"
  | "fromLabel"
  | "toLabel"
  | "port"
  | "protocol"
>;

export type RelationEndpointKind = "interface" | "service";

interface RelationEditorProps {
  relation: PortalRelation;
  index: number;
  devices: PortalDevice[];
  interfaces: PortalInterface[];
  services: PortalService[];
  relationNames: PortalRelationName[];
  showFromInterface?: boolean;
  onChange: (field: RelationEditableField, value: string) => void;
  onKindChange: (side: "from" | "to", kind: RelationEndpointKind) => void;
  onDelete: () => void;
}

function deviceLabel(
  devices: PortalDevice[],
  deviceId: string | undefined,
): string {
  const device = devices.find((candidate) => candidate.id === deviceId);
  return device?.petname?.trim() || device?.name || "不明なデバイス";
}

function endpointSummary(
  devices: PortalDevice[],
  interfaces: PortalInterface[],
  services: PortalService[],
  interfaceId: string | null,
  serviceId: string | null,
  fallback: string,
): string {
  if (serviceId) {
    const service = services.find((candidate) => candidate.id === serviceId);
    if (!service) {
      return fallback;
    }
    const host = interfaces.find((iface) => iface.id === service.interfaceId);
    const label = service.petname?.trim() || service.subdomain;
    return `${deviceLabel(devices, host?.deviceId)} / サービス: ${label}`;
  }
  const iface = interfaces.find((candidate) => candidate.id === interfaceId);
  if (!iface) {
    return fallback;
  }
  return `${deviceLabel(devices, iface.deviceId)} / ${iface.name}`;
}

export function RelationEditor({
  relation,
  index,
  devices,
  interfaces,
  services,
  relationNames,
  showFromInterface = false,
  onChange,
  onKindChange,
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
    services,
    relation.fromInterfaceId,
    relation.fromServiceId,
    "始点未選択",
  );
  const toSummary = endpointSummary(
    devices,
    interfaces,
    services,
    relation.toInterfaceId,
    relation.toServiceId,
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

  function serviceOptions() {
    return devices.map((device) => {
      const deviceServices = services.filter((service) => {
        const host = interfaces.find(
          (iface) => iface.id === service.interfaceId,
        );
        return host?.deviceId === device.id;
      });
      if (deviceServices.length === 0) {
        return null;
      }
      return (
        <optgroup
          key={device.id}
          label={device.petname?.trim() || device.name}
        >
          {deviceServices.map((service) => (
            <option key={service.id} value={service.id}>
              {device.name} / {service.petname?.trim() || service.subdomain}
            </option>
          ))}
        </optgroup>
      );
    });
  }

  function endpointPicker(side: "from" | "to", sideLabel: string) {
    const serviceId = relation[`${side}ServiceId`];
    const kind: RelationEndpointKind = serviceId ? "service" : "interface";
    const interfaceField = `${side}InterfaceId` as RelationEditableField;
    const serviceField = `${side}ServiceId` as RelationEditableField;
    return (
      <div className="ouchi-field">
        <span>
          {sideLabel} {index + 1}
        </span>
        <div
          aria-label={`${sideLabel}の種類 ${index + 1}`}
          className="ouchi-endpoint-kind"
          role="group"
        >
          <button
            aria-pressed={kind === "interface"}
            onClick={() => onKindChange(side, "interface")}
            type="button"
          >
            インターフェース
          </button>
          <button
            aria-pressed={kind === "service"}
            onClick={() => onKindChange(side, "service")}
            type="button"
          >
            サービス
          </button>
        </div>
        {kind === "interface" ? (
          <select
            aria-label={`${sideLabel}インターフェース ${index + 1}`}
            onChange={(event) => onChange(interfaceField, event.target.value)}
            value={relation[`${side}InterfaceId`] ?? ""}
          >
            {interfaceOptions()}
          </select>
        ) : (
          <select
            aria-label={`${sideLabel}サービス ${index + 1}`}
            onChange={(event) => onChange(serviceField, event.target.value)}
            value={serviceId ?? ""}
          >
            {services.length === 0 && (
              <option value="">サービスが登録されていません</option>
            )}
            {serviceOptions()}
          </select>
        )}
      </div>
    );
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
      {showFromInterface && endpointPicker("from", "始点")}
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
      {endpointPicker("to", "終点")}
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
      <label className="ouchi-field">
        <span>宛先ポート {index + 1}</span>
        <input
          aria-label={`宛先ポート ${index + 1}`}
          inputMode="numeric"
          onChange={(event) =>
            onChange("port", event.target.value)
          }
          placeholder="空なら指定なし"
          value={relation.port ?? ""}
        />
      </label>
      <label className="ouchi-field">
        <span>プロトコル {index + 1}</span>
        <select
          aria-label={`プロトコル ${index + 1}`}
          onChange={(event) =>
            onChange("protocol", event.target.value)
          }
          value={relation.protocol ?? ""}
        >
          <option value="">指定なし</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
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
