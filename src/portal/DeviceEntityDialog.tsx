import {
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import {
  DEVICE_CATEGORY_LABELS,
  PORTAL_DEVICE_CATEGORIES,
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalInterface,
  type ValidationIssue,
} from "./types";
import {
  generateId,
  validateDeviceInput,
  validateInterfaceInput,
} from "./validation";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import type { EntityFormProps } from "./entityDialogTypes";

function newInterface(
  deviceId: string,
  name: string,
  networkId: string | null,
): PortalInterface {
  return {
    id: generateId("interface"),
    deviceId,
    name,
    networkId,
    ip: "",
  };
}

export function DeviceEntityDialog({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
  saveDisabled = false,
}: EntityFormProps<PortalDevice>) {
  const draftDeviceId = useRef(editing?.id ?? generateId("device"));
  const [name, setName] = useState(editing?.name ?? "");
  const [petname, setPetname] = useState(editing?.petname ?? "");
  const [category, setCategory] = useState<PortalDeviceCategory>(
    editing?.category ?? "physical",
  );
  const [interfaces, setInterfaces] = useState<PortalInterface[]>(() => {
    const existing = data.interfaces.filter(
      (iface) => iface.deviceId === editing?.id,
    );
    if (existing.length > 0) {
      return existing;
    }
    return [
      newInterface(
        draftDeviceId.current,
        "eth0",
        data.networks[0]?.id ?? null,
      ),
    ];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  function updateInterface(
    id: string,
    field: keyof Pick<PortalInterface, "name" | "networkId" | "ip" | "mac">,
    value: string,
  ) {
    setInterfaces((current) =>
      current.map((iface) => {
        if (iface.id !== id) {
          return iface;
        }
        if (field === "networkId") {
          return { ...iface, networkId: value === "" ? null : value };
        }
        return { ...iface, [field]: value };
      }),
    );
  }

  function addInterface() {
    setInterfaces((current) => [
      ...current,
      newInterface(
        draftDeviceId.current,
        `eth${current.length}`,
        data.networks[0]?.id ?? null,
      ),
    ]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    // プロパティ（メモ）は専用ダイアログで編集する。ここでは現在の値を
    // そのまま保持して保存する（新規デバイスは空）。
    const device: PortalDevice = {
      id: editing?.id ?? draftDeviceId.current,
      name: name.trim(),
      petname: petname.trim() || undefined,
      properties: editing?.properties ?? {},
      category,
      meterEnabled:
        category === "service"
          ? false
          : editing?.meterEnabled ?? false,
      // SSH接続情報は将来機能のためUIを持たない。保存時は既存値を保持する。
      ssh: editing?.ssh,
    };

    const issues = validateDeviceInput(
      device,
      editing?.id,
      data,
    );
    const normalizedInterfaces = interfaces.map((iface) => ({
      ...iface,
      deviceId: device.id,
      name: iface.name.trim(),
      ip: iface.ip.trim(),
      mac: iface.mac?.trim() || undefined,
    }));

    if (normalizedInterfaces.length === 0) {
      issues.push({
        path: "interfaces",
        message: "インターフェースを1件以上追加してください",
      });
    }

    normalizedInterfaces.forEach((iface, index) => {
      const interfaceIssues = validateInterfaceInput(
        iface,
        data,
        iface.id,
      ).map((issue) => ({
        ...issue,
        path: `interfaces[${index}].${issue.path}`,
      }));
      issues.push(...interfaceIssues);
    });

    const localNames = new Set<string>();
    normalizedInterfaces.forEach((iface, index) => {
      if (!iface.name) {
        return;
      }
      if (localNames.has(iface.name)) {
        issues.push({
          path: `interfaces[${index}].name`,
          message: "同じフォーム内でインターフェース名が重複しています",
        });
      }
      localNames.add(iface.name);
    });

    const localIps = new Set<string>();
    normalizedInterfaces.forEach((iface, index) => {
      if (!iface.ip) {
        return;
      }
      if (localIps.has(iface.ip)) {
        issues.push({
          path: `interfaces[${index}].ip`,
          message: "同じフォーム内でIPが重複しています",
        });
      }
      localIps.add(iface.ip);
    });

    if (issues.length > 0) {
      setIssues(issues, setErrors);
      setFormIssues(issues);
      return;
    }

    setErrors({});
    setFormIssues([]);
    onSave("device", {
      device,
      interfaces: normalizedInterfaces,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <FormNotice issues={formIssues} />
      <label className="ouchi-field">
        <span id="device-petname-label">名前</span>
        <input
          aria-describedby="device-name-hint"
          aria-labelledby="device-petname-label"
          onChange={(event) => setPetname(event.target.value)}
          placeholder="例: 私のデバイス"
          ref={firstFieldRef as RefObject<HTMLInputElement | null>}
          value={petname}
        />
        <small id="device-name-hint">未入力ならホスト名を表示します。</small>
      </label>

      <label className="ouchi-field">
        <span>ホスト名</span>
        <input
          aria-describedby={errors.name ? "device-name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          aria-label="ホスト名"
          onChange={(event) => setName(event.target.value)}
          placeholder="例: my-device"
          required
          value={name}
        />
        <FieldError id="device-name-error">{errors.name}</FieldError>
      </label>

      <label className="ouchi-field">
        <span>デバイスカテゴリー</span>
        <select
          aria-label="デバイスカテゴリー"
          onChange={(event) => {
            setCategory(event.target.value as PortalDeviceCategory);
          }}
          value={category}
        >
          {PORTAL_DEVICE_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {DEVICE_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
        <small>
          VMは独立したデバイス、サービスは外部SaaSの疑似デバイスです。
        </small>
      </label>

      <section className="ouchi-form-section">
        <header>
          <div>
            <strong>インターフェース</strong>
            <small>
              インターフェースごとにネットワークとIPを持ちます。スイッチのポートなどIPがないものはIPを空欄にしてください。
            </small>
          </div>
          <button
            className="ouchi-secondary-button ouchi-secondary-button--compact"
            onClick={addInterface}
            type="button"
          >
            インターフェースを追加
          </button>
        </header>
        <div className="ouchi-editor-stack">
          {interfaces.map((iface, index) => (
            <div className="ouchi-editor-row" key={iface.id}>
              <div className="ouchi-form-grid">
                <label className="ouchi-field">
                  <span>インターフェース名 {index + 1}</span>
                  <input
                    aria-label={`インターフェース名 ${index + 1}`}
                    onChange={(event) =>
                      updateInterface(iface.id, "name", event.target.value)
                    }
                    placeholder="例: eth0"
                    value={iface.name}
                  />
                </label>
                <label className="ouchi-field">
                  <span>ネットワーク {index + 1}</span>
                  <select
                    aria-label={`所属ネットワーク ${index + 1}`}
                    onChange={(event) =>
                      updateInterface(
                        iface.id,
                        "networkId",
                        event.target.value,
                      )
                    }
                    value={iface.networkId ?? ""}
                  >
                    <option value="">（なし）</option>
                    {sortNetworksForDisplay(data.networks).map((network) => (
                      <option key={network.id} value={network.id}>
                        {network.name}
                        {network.cidr ? `（${network.cidr}）` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ouchi-field">
                  <span>IPアドレス {index + 1}</span>
                  <input
                    aria-label={`IPアドレス ${index + 1}`}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateInterface(iface.id, "ip", event.target.value)
                    }
                    placeholder="例: 192.168.0.42"
                    value={iface.ip}
                  />
                </label>
                <label className="ouchi-field">
                  <span>MACアドレス {index + 1}</span>
                  <input
                    aria-label={`MACアドレス ${index + 1}`}
                    onChange={(event) =>
                      updateInterface(iface.id, "mac", event.target.value)
                    }
                    placeholder="例: 00:11:22:33:44:55"
                    value={iface.mac ?? ""}
                  />
                </label>
              </div>
              <div className="ouchi-editor-row-foot">
                <button
                  aria-label={`インターフェース ${index + 1}を削除`}
                  className="ouchi-manage-danger"
                  disabled={interfaces.length === 1}
                  onClick={() =>
                    setInterfaces((current) =>
                      current.filter((item) => item.id !== iface.id),
                    )
                  }
                  type="button"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FormActions
        disabled={saveDisabled}
        disabledReason="デモモードでは保存されません。"
        onClose={onClose}
        submitLabel={editing ? "保存" : "追加する"}
      />
    </form>
  );
}
