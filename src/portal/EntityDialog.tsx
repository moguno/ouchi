import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EntityKind } from "./ManageDrawer";
import {
  ACCENT_LABELS,
  ACCENT_TONES,
  ICON_LABELS,
  PORTAL_ICON_KEYS,
  PORTAL_STATUSES,
  STATUS_LABELS,
  type AccentTone,
  type PortalDataV1,
  type PortalIconKey,
  type PortalDevice,
  type PortalNetwork,
  type PortalService,
  type PortalStatus,
  type ValidationIssue,
} from "./types";
import {
  generateId,
  issuesToRecord,
  validateDeviceInput,
  validateNetworkInput,
  validateServiceInput,
} from "./validation";
import { CloseIcon } from "./icons";

export type PortalEntity =
  | PortalNetwork
  | PortalDevice
  | PortalService;

interface EntityDialogProps {
  kind: EntityKind;
  editingId?: string;
  data: PortalDataV1;
  onClose: () => void;
  onSave: (kind: EntityKind, entity: PortalEntity) => void;
}

const KIND_LABELS: Record<EntityKind, string> = {
  network: "ネットワーク",
  device: "デバイス",
  service: "サービス",
};

export function EntityDialog({
  kind,
  editingId,
  data,
  onClose,
  onSave,
}: EntityDialogProps) {
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [onClose]);

  const title = editingId ? "編集" : "追加";

  return (
    <div
      className="ouchi-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="ouchi-entity-dialog-title"
        aria-modal="true"
        className="ouchi-entity-dialog"
        role="dialog"
      >
        <header className="ouchi-dialog-header">
          <div>
            <p className="ouchi-eyebrow">PORTAL DATA</p>
            <h3 id="ouchi-entity-dialog-title">
              {KIND_LABELS[kind]}を{title}
            </h3>
          </div>
          <button
            aria-label="入力を閉じる"
            className="ouchi-icon-button"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        {kind === "network" && (
          <NetworkForm
            data={data}
            editing={data.networks.find((network) => network.id === editingId)}
            firstFieldRef={firstFieldRef}
            onClose={onClose}
            onSave={onSave}
          />
        )}
        {kind === "device" && (
          <DeviceForm
            data={data}
            editing={data.devices.find(
              (device) => device.id === editingId,
            )}
            firstFieldRef={firstFieldRef}
            onClose={onClose}
            onSave={onSave}
          />
        )}
        {kind === "service" && (
          <ServiceForm
            data={data}
            editing={data.services.find(
              (service) => service.id === editingId,
            )}
            firstFieldRef={firstFieldRef}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </section>
    </div>
  );
}

type FirstFieldRef =
  | React.RefObject<HTMLInputElement | HTMLSelectElement | null>
  | React.RefObject<HTMLSelectElement | null>;

function FieldError({
  id,
  children,
}: {
  id: string;
  children?: string;
}) {
  if (!children) {
    return null;
  }
  return (
    <span className="ouchi-field-error" id={id} role="alert">
      {children}
    </span>
  );
}

function FormActions({
  onClose,
  submitLabel,
}: {
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="ouchi-form-actions">
      <button className="ouchi-secondary-button" onClick={onClose} type="button">
        キャンセル
      </button>
      <button className="ouchi-primary-button" type="submit">
        {submitLabel}
      </button>
    </div>
  );
}

function setIssues(
  issues: ValidationIssue[],
  setter: (value: Record<string, string>) => void,
) {
  setter(issuesToRecord(issues));
}

function NetworkForm({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
}: {
  data: PortalDataV1;
  editing?: PortalNetwork;
  firstFieldRef: FirstFieldRef;
  onClose: () => void;
  onSave: EntityDialogProps["onSave"];
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [cidr, setCidr] = useState(editing?.cidr ?? "");
  const [accent, setAccent] = useState<AccentTone>(
    editing?.accent ?? "blue",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name, cidr: cidr.trim() || undefined, accent };
    const issues = validateNetworkInput(input, data, editing?.id);
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      return;
    }

    setErrors({});
    onSave("network", {
      id: editing?.id ?? generateId("network"),
      name: name.trim(),
      cidr: cidr.trim() || undefined,
      accent,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <label className="ouchi-field">
        <span>ネットワーク名</span>
        <input
          aria-describedby={errors.name ? "network-name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: インターネット"
          ref={firstFieldRef as React.RefObject<HTMLInputElement>}
          required
          value={name}
        />
        <FieldError id="network-name-error">{errors.name}</FieldError>
      </label>

      <label className="ouchi-field">
        <span id="network-cidr-label">CIDR</span>
        <input
          aria-labelledby="network-cidr-label"
          aria-describedby={
            errors.cidr ? "network-cidr-error" : "network-cidr-help"
          }
          aria-invalid={Boolean(errors.cidr)}
          onChange={(event) => setCidr(event.target.value)}
          placeholder="例: 192.168.0.0/24"
          value={cidr}
        />
        <small id="network-cidr-help">
          「インターネット」など範囲を限定しない場合は空欄にします。
        </small>
        <FieldError id="network-cidr-error">{errors.cidr}</FieldError>
      </label>

      <label className="ouchi-field">
        <span>アクセント色</span>
        <select
          onChange={(event) => setAccent(event.target.value as AccentTone)}
          value={accent}
        >
          {ACCENT_TONES.map((tone) => (
            <option key={tone} value={tone}>
              {ACCENT_LABELS[tone]}
            </option>
          ))}
        </select>
      </label>

      <FormActions
        onClose={onClose}
        submitLabel={editing ? "保存" : "追加する"}
      />
    </form>
  );
}

function DeviceForm({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
}: {
  data: PortalDataV1;
  editing?: PortalDevice;
  firstFieldRef: FirstFieldRef;
  onClose: () => void;
  onSave: EntityDialogProps["onSave"];
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [ip, setIp] = useState(editing?.ip ?? "");
  const [networkId, setNetworkId] = useState(
    editing?.networkId ?? data.networks[0]?.id ?? "",
  );
  const [isVm, setIsVm] = useState(editing?.isVm ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name, ip: ip.trim(), networkId, isVm };
    const issues = validateDeviceInput(input, data, editing?.id);
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      return;
    }

    setErrors({});
    onSave("device", {
      id: editing?.id ?? generateId("device"),
      name: name.trim(),
      ip: ip.trim(),
      networkId,
      isVm,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <label className="ouchi-field">
        <span>デバイス名</span>
        <input
          aria-describedby={errors.name ? "device-name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: nanopi-r2s"
          ref={firstFieldRef as React.RefObject<HTMLInputElement>}
          required
          value={name}
        />
        <FieldError id="device-name-error">{errors.name}</FieldError>
      </label>

      <label className="ouchi-field">
        <span>IPv4アドレス</span>
        <input
          aria-describedby={errors.ip ? "device-ip-error" : undefined}
          aria-invalid={Boolean(errors.ip)}
          inputMode="decimal"
          onChange={(event) => setIp(event.target.value)}
          placeholder="例: 192.168.0.42"
          required
          value={ip}
        />
        <FieldError id="device-ip-error">{errors.ip}</FieldError>
      </label>

      <label className="ouchi-field">
        <span>所属ネットワーク</span>
        <select
          aria-describedby={
            errors.networkId ? "device-network-error" : undefined
          }
          aria-invalid={Boolean(errors.networkId)}
          onChange={(event) => setNetworkId(event.target.value)}
          required
          value={networkId}
        >
          {data.networks.map((network) => (
            <option key={network.id} value={network.id}>
              {network.name}
              {network.cidr ? `（${network.cidr}）` : ""}
            </option>
          ))}
        </select>
        <FieldError id="device-network-error">{errors.networkId}</FieldError>
      </label>

      <label className="ouchi-checkbox-field">
        <input
          checked={isVm}
          onChange={(event) => setIsVm(event.target.checked)}
          type="checkbox"
        />
        <span>
          <strong>VMとして登録</strong>
          <small>
            ONにすると仮想デバイスとして表示されます。ネットワークとの関係は変わりません。
          </small>
        </span>
      </label>

      <FormActions
        onClose={onClose}
        submitLabel={editing ? "保存" : "追加する"}
      />
    </form>
  );
}

function ServiceForm({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
}: {
  data: PortalDataV1;
  editing?: PortalService;
  firstFieldRef: FirstFieldRef;
  onClose: () => void;
  onSave: EntityDialogProps["onSave"];
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [deviceId, setDeviceId] = useState(
    editing?.deviceId ?? data.devices[0]?.id ?? "",
  );
  const [iconKey, setIconKey] = useState<PortalIconKey>(
    editing?.iconKey ?? "monitor",
  );
  const [status, setStatus] = useState<PortalStatus>(
    editing?.status ?? "up",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      name,
      url: url.trim(),
      deviceId,
      iconKey,
      status,
    };
    const issues = validateServiceInput(input, data);
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      return;
    }

    setErrors({});
    onSave("service", {
      id: editing?.id ?? generateId("service"),
      name: name.trim(),
      subtitle: subtitle.trim(),
      url: url.trim(),
      deviceId,
      iconKey,
      status,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <label className="ouchi-field">
        <span>サービス名</span>
        <input
          aria-describedby={errors.name ? "service-name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: gitea"
          ref={firstFieldRef as React.RefObject<HTMLInputElement>}
          required
          value={name}
        />
        <FieldError id="service-name-error">{errors.name}</FieldError>
      </label>

      <label className="ouchi-field">
        <span id="service-subtitle-label">補足名</span>
        <input
          aria-labelledby="service-subtitle-label"
          onChange={(event) => setSubtitle(event.target.value)}
          placeholder="例: おうちGit"
          value={subtitle}
        />
        <small>アイコンの下に表示する短い説明です。</small>
      </label>

      <label className="ouchi-field">
        <span>URL</span>
        <input
          aria-describedby={errors.url ? "service-url-error" : undefined}
          aria-invalid={Boolean(errors.url)}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="http://192.168.0.19:3000"
          required
          type="url"
          value={url}
        />
        <FieldError id="service-url-error">{errors.url}</FieldError>
      </label>

      <label className="ouchi-field">
        <span>配置先</span>
        <select
          aria-describedby={
            errors.deviceId ? "service-device-error" : undefined
          }
          aria-invalid={Boolean(errors.deviceId)}
          onChange={(event) => setDeviceId(event.target.value)}
          required
          value={deviceId}
        >
          {data.networks.map((network) => (
            <optgroup key={network.id} label={network.name}>
              {data.devices
                .filter((device) => device.networkId === network.id)
                .map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}（{device.isVm ? "VM" : "物理"} /{" "}
                    {device.ip}）
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <FieldError id="service-device-error">{errors.deviceId}</FieldError>
      </label>

      <div className="ouchi-form-grid">
        <label className="ouchi-field">
          <span>アイコン</span>
          <select
            onChange={(event) =>
              setIconKey(event.target.value as PortalIconKey)
            }
            required
            value={iconKey}
          >
            {PORTAL_ICON_KEYS.map((key) => (
              <option key={key} value={key}>
                {ICON_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="ouchi-field">
          <span>初期状態</span>
          <select
            onChange={(event) => setStatus(event.target.value as PortalStatus)}
            required
            value={status}
          >
            {PORTAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="ouchi-form-note">
        状態は10秒ごとにランダム更新されます。ここで選んだ値は登録時の初期値です。
      </p>

      <FormActions
        onClose={onClose}
        submitLabel={editing ? "保存" : "追加する"}
      />
    </form>
  );
}

export function ConfirmDialog({
  title,
  description,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="ouchi-dialog-backdrop ouchi-dialog-backdrop--confirm">
      <section
        aria-labelledby="ouchi-confirm-title"
        aria-modal="true"
        className="ouchi-confirm-dialog"
        role="alertdialog"
      >
        <h3 id="ouchi-confirm-title">{title}</h3>
        <p>{description}</p>
        <div className="ouchi-form-actions">
          <button
            className="ouchi-secondary-button"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
          <button
            className="ouchi-danger-button"
            onClick={onConfirm}
            ref={confirmRef}
            type="button"
          >
            削除する
          </button>
        </div>
      </section>
    </div>
  );
}
