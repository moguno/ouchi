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
  type PortalDeviceNetwork,
  type ValidationIssue,
} from "./types";
import {
  generateId,
  validateDeviceInput,
  validateDeviceNetworkInput,
} from "./validation";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import type { EntityFormProps } from "./entityDialogTypes";

function newMembership(
  deviceId: string,
  networkId: string,
): PortalDeviceNetwork {
  return {
    id: generateId("device-network"),
    deviceId,
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
  const [memberships, setMemberships] = useState<PortalDeviceNetwork[]>(() => {
    const existing = data.deviceNetworks.filter(
      (membership) => membership.deviceId === editing?.id,
    );
    if (existing.length > 0) {
      return existing;
    }
    return [
      newMembership(draftDeviceId.current, data.networks[0]?.id ?? ""),
    ];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  function updateMembership(
    id: string,
    field: keyof Pick<PortalDeviceNetwork, "networkId" | "ip" | "label">,
    value: string,
  ) {
    setMemberships((current) =>
      current.map((membership) =>
        membership.id === id
          ? { ...membership, [field]: value }
          : membership,
      ),
    );
  }

  function addMembership() {
    setMemberships((current) => [
      ...current,
      newMembership(
        draftDeviceId.current,
        data.networks[0]?.id ?? "",
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
      isVm: category === "vm",
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
    const normalizedMemberships = memberships.map((membership) => ({
      ...membership,
      deviceId: device.id,
      ip: membership.ip.trim(),
      label: membership.label?.trim() || undefined,
    }));

    if (normalizedMemberships.length === 0) {
      issues.push({
        path: "deviceNetworks",
        message: "ネットワーク所属を1件以上追加してください",
      });
    }

    normalizedMemberships.forEach((membership, index) => {
      const membershipIssues = validateDeviceNetworkInput(
        membership,
        data,
        membership.id,
      ).map((issue) => ({
        ...issue,
        path: `deviceNetworks[${index}].${issue.path}`,
      }));
      issues.push(...membershipIssues);
    });

    const localIps = new Set<string>();
    normalizedMemberships.forEach((membership, index) => {
      if (localIps.has(membership.ip)) {
        if (!membership.ip) {
          return;
        }
        issues.push({
          path: `deviceNetworks[${index}].ip`,
          message: "同じフォーム内でIPが重複しています",
        });
      }
      if (membership.ip) {
        localIps.add(membership.ip);
      }
    });

    normalizedMemberships.forEach((membership, index) => {
      if (!membership.networkId) {
        issues.push({
          path: `deviceNetworks[${index}].networkId`,
          message: "所属ネットワークを選択してください",
        });
      }
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
      deviceNetworks: normalizedMemberships,
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
          placeholder="例: 門番"
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
          placeholder="例: nanopi-r2s"
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
            <strong>ネットワーク所属IP</strong>
            <small>同じデバイスを複数ネットワークへ所属できます。</small>
          </div>
          <button
            className="ouchi-secondary-button ouchi-secondary-button--compact"
            onClick={addMembership}
            type="button"
          >
            所属を追加
          </button>
        </header>
        <div className="ouchi-editor-stack">
          {memberships.map((membership, index) => (
            <div className="ouchi-editor-row" key={membership.id}>
              <div className="ouchi-form-grid">
                <label className="ouchi-field">
                  <span>ネットワーク {index + 1}</span>
                  <select
                    aria-label={`所属ネットワーク ${index + 1}`}
                    onChange={(event) =>
                      updateMembership(
                        membership.id,
                        "networkId",
                        event.target.value,
                      )
                    }
                    value={membership.networkId}
                  >
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
                      updateMembership(
                        membership.id,
                        "ip",
                        event.target.value,
                      )
                    }
                    placeholder="例: 192.168.0.42"
                    value={membership.ip}
                  />
                </label>
              </div>
              <div className="ouchi-editor-row-foot">
                <label className="ouchi-field">
                  <span>表示ラベル {index + 1}</span>
                  <input
                    aria-label={`表示ラベル ${index + 1}`}
                    onChange={(event) =>
                      updateMembership(
                        membership.id,
                        "label",
                        event.target.value,
                      )
                    }
                    placeholder="例: LAN"
                    value={membership.label ?? ""}
                  />
                </label>
                <button
                  aria-label={`所属IP ${index + 1}を削除`}
                  className="ouchi-manage-danger"
                  disabled={memberships.length === 1}
                  onClick={() =>
                    setMemberships((current) =>
                      current.filter((item) => item.id !== membership.id),
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
