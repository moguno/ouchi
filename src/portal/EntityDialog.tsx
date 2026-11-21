import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EntityKind } from "./ManageDrawer";
import { CloseIcon } from "./icons";
import {
  ACCENT_LABELS,
  ACCENT_TONES,
  DEVICE_CATEGORY_LABELS,
  PORTAL_DEVICE_CATEGORIES,
  PORTAL_SERVICE_SCHEMES,
  type AccentTone,
  type PortalDataV2,
  type PortalDevice,
  type PortalDeviceCategory,
  type PortalDeviceNetwork,
  type PortalIconReference,
  type PortalNetwork,
  type PortalRelation,
  type PortalService,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type ValidationIssue,
} from "./types";
import { IconPicker } from "./IconPicker";
import { normalizeIconReference } from "./iconCatalog";
import {
  generateId,
  issuesToRecord,
  validateDeviceInput,
  validateDeviceNetworkInput,
  validateNetworkInput,
  validateRelationInput,
  validateServiceInput,
} from "./validation";
import { sortNetworksForDisplay } from "./networkOrder";
import { buildMonitorUrl, buildServiceUrl } from "./urls";

export interface DeviceMutation {
  device: PortalDevice;
  deviceNetworks: PortalDeviceNetwork[];
  relations: PortalRelation[];
}

export type PortalEntity =
  | PortalNetwork
  | PortalService
  | DeviceMutation;

interface EntityDialogProps {
  kind: EntityKind;
  editingId?: string;
  data: PortalDataV2;
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
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, []);

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
            <p className="ouchi-eyebrow">PORTAL DATA V2</p>
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

function FormNotice({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="ouchi-form-error-summary" role="alert">
      <strong>入力内容を確認してください</strong>
      <ul>
        {issues.slice(0, 5).map((issue, index) => (
          <li key={`${issue.path}-${index}`}>{issue.message}</li>
        ))}
      </ul>
    </div>
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
  data: PortalDataV2;
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
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { name, cidr: cidr.trim() || undefined, accent };
    const issues = validateNetworkInput(input, data, editing?.id);
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      setFormIssues(issues);
      return;
    }

    setErrors({});
    setFormIssues([]);
    onSave("network", {
      id: editing?.id ?? generateId("network"),
      name: name.trim(),
      cidr: cidr.trim() || undefined,
      accent,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <FormNotice issues={formIssues} />
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

function DeviceForm({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
}: {
  data: PortalDataV2;
  editing?: PortalDevice;
  firstFieldRef: FirstFieldRef;
  onClose: () => void;
  onSave: EntityDialogProps["onSave"];
}) {
  const draftDeviceId = useRef(editing?.id ?? generateId("device"));
  const [name, setName] = useState(editing?.name ?? "");
  const [petname, setPetname] = useState(editing?.petname ?? "");
  const [category, setCategory] = useState<PortalDeviceCategory>(
    editing?.category ?? "physical",
  );
  const [sshEnabled, setSshEnabled] = useState(Boolean(editing?.ssh));
  const [sshUser, setSshUser] = useState(editing?.ssh?.user ?? "");
  const [sshPort, setSshPort] = useState(String(editing?.ssh?.port ?? 22));
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
  const [relations, setRelations] = useState<PortalRelation[]>(() =>
    data.relations.filter(
      (relation) => relation.fromDeviceId === editing?.id,
    ),
  );
  const [recolorTags, setRecolorTags] = useState<Set<string>>(
    () => new Set(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  const relationTargets = data.devices.filter(
    (device) => device.id !== editing?.id,
  );
  const existingTags = [
    ...new Map(
      data.relations.map((relation) => [
        relation.tag.trim(),
        relation.color.trim(),
      ]),
    ).entries(),
  ].filter(([name]) => name);

  function canonicalTagColor(tag: string): string | undefined {
    return data.relations.find(
      (relation) => relation.tag.trim() === tag.trim(),
    )?.color.trim();
  }

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

  function updateRelation(
    id: string,
    field: keyof Pick<
      PortalRelation,
      "toDeviceId" | "tag" | "fromLabel" | "toLabel" | "color"
    >,
    value: string,
  ) {
    if (field === "color") {
      const relation = relations.find((candidate) => candidate.id === id);
      const tag = relation?.tag.trim() ?? "";
      setRelations((current) =>
        current.map((candidate) =>
          candidate.id === id ||
          (tag && candidate.tag.trim() === tag && recolorTags.has(tag))
            ? { ...candidate, color: value }
            : candidate,
        ),
      );
      return;
    }
    if (field === "tag") {
      const canonical = canonicalTagColor(value);
      setRecolorTags((current) => {
        const next = new Set(current);
        next.delete(value.trim());
        return next;
      });
      setRelations((current) =>
        current.map((relation) =>
          relation.id === id
            ? {
                ...relation,
                tag: value,
                ...(canonical ? { color: canonical } : {}),
              }
            : relation,
        ),
      );
      return;
    }
    setRelations((current) =>
      current.map((relation) =>
        relation.id === id ? { ...relation, [field]: value } : relation,
      ),
    );
  }

  function addRelation() {
    if (!editing || relationTargets.length === 0) {
      return;
    }
    const firstTag = existingTags[0];
    setRelations((current) => [
      ...current,
      {
        id: generateId("relation"),
        fromDeviceId: editing.id,
        toDeviceId: relationTargets[0].id,
        tag: firstTag?.[0] ?? "",
        fromLabel: "",
        toLabel: "",
        color: firstTag?.[1] ?? "#d5a22b",
      },
    ]);
  }

  function enableTagRecolor(tag: string) {
    const canonical = canonicalTagColor(tag);
    setRecolorTags((current) => new Set(current).add(tag.trim()));
    setRelations((current) =>
      current.map((relation) =>
        relation.tag.trim() === tag.trim() && canonical
          ? { ...relation, color: canonical }
          : relation,
      ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const device: PortalDevice = {
      id: editing?.id ?? draftDeviceId.current,
      name: name.trim(),
      petname: petname.trim() || undefined,
      category,
      isVm: category === "vm",
      meterEnabled:
        category === "service"
          ? false
          : editing?.meterEnabled ?? false,
      ssh: sshEnabled && category !== "service"
        ? {
            user: sshUser.trim(),
            port: Number(sshPort),
          }
        : undefined,
    };

    const issues = validateDeviceInput(device, editing?.id, data);
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

    const normalizedRelations = relations.map((relation) => ({
      ...relation,
      fromDeviceId: device.id,
      tag: relation.tag?.trim(),
      fromLabel: relation.fromLabel?.trim(),
      toLabel: relation.toLabel?.trim(),
      color: relation.color.trim(),
    }));
    const validationData: PortalDataV2 = {
      ...data,
      relations: data.relations.map((relation) => {
        const tag = relation.tag.trim();
        const changed = normalizedRelations.find(
          (candidate) =>
            candidate.tag === tag && recolorTags.has(tag),
        );
        return changed ? { ...relation, color: changed.color } : relation;
      }),
    };
    normalizedRelations.forEach((relation, index) => {
      issues.push(
        ...validateRelationInput(relation, validationData).map((issue) => ({
          ...issue,
          path: `relations[${index}].${issue.path}`,
        })),
      );
    });
    const colorsByTag = new Map<string, string>();
    normalizedRelations.forEach((relation, index) => {
      const canonical = colorsByTag.get(relation.tag);
      if (canonical && canonical !== relation.color) {
        issues.push({
          path: `relations[${index}].color`,
          message:
            `タグ「${relation.tag}」の色は「${canonical}」に統一してください`,
        });
      } else if (!canonical) {
        colorsByTag.set(relation.tag, relation.color);
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
      relations: normalizedRelations,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <FormNotice issues={formIssues} />
      <label className="ouchi-field">
        <span>ホスト名</span>
        <input
          aria-describedby={errors.name ? "device-name-error" : undefined}
          aria-invalid={Boolean(errors.name)}
          aria-label="ホスト名"
          onChange={(event) => setName(event.target.value)}
          placeholder="例: nanopi-r2s"
          ref={firstFieldRef as React.RefObject<HTMLInputElement>}
          required
          value={name}
        />
        <FieldError id="device-name-error">{errors.name}</FieldError>
      </label>

      <label className="ouchi-field">
        <span id="device-petname-label">ペットネーム</span>
        <input
          aria-labelledby="device-petname-label"
          onChange={(event) => setPetname(event.target.value)}
          placeholder="例: 門番"
          value={petname}
        />
        <small>未入力ならホスト名を表示します。</small>
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
                  className="ouchi-icon-button ouchi-icon-button--small ouchi-icon-button--danger"
                  disabled={memberships.length === 1}
                  onClick={() =>
                    setMemberships((current) =>
                      current.filter((item) => item.id !== membership.id),
                    )
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <label className="ouchi-field">
        <span>デバイスカテゴリー</span>
        <select
          aria-label="デバイスカテゴリー"
          onChange={(event) => {
            const next = event.target.value as PortalDeviceCategory;
            setCategory(next);
            if (next === "service") {
              setSshEnabled(false);
            }
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
            <strong>SSH接続情報</strong>
            <small>
              任意の接続先情報です。パスワードや秘密鍵はDBへ保存しません。
            </small>
          </div>
        </header>
        <label className="ouchi-checkbox-field">
          <input
            checked={sshEnabled}
            disabled={category === "service"}
            onChange={(event) => setSshEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>SSH接続情報を保存する</strong>
            <small>接続先を使わない機器はOFFにします。</small>
          </span>
        </label>
        {sshEnabled && category !== "service" && (
          <div className="ouchi-form-grid">
            <label className="ouchi-field">
              <span>SSHユーザー</span>
              <input
                onChange={(event) => setSshUser(event.target.value)}
                placeholder="例: portal-monitor"
                value={sshUser}
              />
            </label>
            <label className="ouchi-field">
              <span>SSHポート</span>
              <input
                inputMode="numeric"
                onChange={(event) => setSshPort(event.target.value)}
                value={sshPort}
              />
            </label>
          </div>
        )}
      </section>

      <section className="ouchi-form-section">
        <header>
          <div>
            <strong>関係</strong>
            <small>
              両端それぞれのラベルと色を定義します。
            </small>
          </div>
          <button
            className="ouchi-secondary-button ouchi-secondary-button--compact"
            disabled={!editing || relationTargets.length === 0}
            onClick={addRelation}
            type="button"
          >
            関係を追加
          </button>
        </header>
        {!editing && (
          <p className="ouchi-inline-hint">
            関係はデバイスを一度保存したあと、編集画面から追加できます。
          </p>
        )}
        <div className="ouchi-editor-stack">
          <datalist id="ouchi-relation-tag-suggestions">
            {existingTags.map(([name]) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {relations.map((relation, index) => {
            const tag = relation.tag.trim();
            const canonical = canonicalTagColor(tag);
            const isExistingTag = Boolean(canonical);
            const recoloring = recolorTags.has(tag);
            const relationCount = data.relations.filter(
              (candidate) => candidate.tag.trim() === tag,
            ).length;
            return (
            <div className="ouchi-relation-row" key={relation.id}>
              <label className="ouchi-field">
                <span>タグ {index + 1}</span>
                <input
                  aria-label={`関係タグ ${index + 1}`}
                  list="ouchi-relation-tag-suggestions"
                  onChange={(event) =>
                    updateRelation(relation.id, "tag", event.target.value)
                  }
                  placeholder="例: ホストOS"
                  value={relation.tag ?? ""}
                />
              </label>
              <label className="ouchi-field">
                <span>関係先 {index + 1}</span>
                <select
                  aria-label={`関係先 ${index + 1}`}
                  onChange={(event) =>
                    updateRelation(
                      relation.id,
                      "toDeviceId",
                      event.target.value,
                    )
                  }
                  value={relation.toDeviceId}
                >
                  {relationTargets.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ouchi-field">
                <span>from側ラベル {index + 1}</span>
                <input
                  aria-label={`from側ラベル ${index + 1}`}
                  onChange={(event) =>
                    updateRelation(
                      relation.id,
                      "fromLabel",
                      event.target.value,
                    )
                  }
                  placeholder="例: VM"
                  value={relation.fromLabel ?? ""}
                />
              </label>
              <label className="ouchi-field">
                <span>to側ラベル {index + 1}</span>
                <input
                  aria-label={`to側ラベル ${index + 1}`}
                  onChange={(event) =>
                    updateRelation(
                      relation.id,
                      "toLabel",
                      event.target.value,
                    )
                  }
                  placeholder="例: 親ホスト"
                  value={relation.toLabel ?? ""}
                />
              </label>
              <div className="ouchi-color-field">
                <label>
                  <span>色 {index + 1}</span>
                  <input
                    aria-label={`関係色 ${index + 1}`}
                    onChange={(event) =>
                      updateRelation(relation.id, "color", event.target.value)
                    }
                    placeholder="例: yellow または #d5a22b"
                    readOnly={isExistingTag && !recoloring}
                    value={relation.color}
                  />
                </label>
                <code>{relation.color}</code>
                <button
                  aria-label={`関係 ${index + 1}を削除`}
                  className="ouchi-icon-button ouchi-icon-button--small ouchi-icon-button--danger"
                  onClick={() =>
                    setRelations((current) =>
                      current.filter((item) => item.id !== relation.id),
                    )
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
              {isExistingTag && !recoloring && (
                <div className="ouchi-inline-hint">
                  <span>
                    既存タグの色は固定です。色を変える場合は全
                    {relationCount}件へ反映されます。
                  </span>
                  <button
                    className="ouchi-secondary-button ouchi-secondary-button--compact"
                    onClick={() => enableTagRecolor(tag)}
                    type="button"
                  >
                    タグの色を変更
                  </button>
                </div>
              )}
              {isExistingTag && recoloring && (
                <p className="ouchi-inline-hint" role="status">
                  タグ「{tag}」の色を変更します。保存すると、このタグを持つ全
                  {relationCount}件の関係へ一括反映されます。
                </p>
              )}
              {!isExistingTag && (
                <p className="ouchi-inline-hint">
                  新規タグです。色を自由に選べます。
                </p>
              )}
            </div>
            );
          })}
        </div>
      </section>

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
  data: PortalDataV2;
  editing?: PortalService;
  firstFieldRef: FirstFieldRef;
  onClose: () => void;
  onSave: EntityDialogProps["onSave"];
}) {
  const [subdomain, setSubdomain] = useState(editing?.subdomain ?? "");
  const [petname, setPetname] = useState(editing?.petname ?? "");
  const [description, setDescription] = useState(
    editing?.description ?? "",
  );
  const [deviceNetworkId, setDeviceNetworkId] = useState(
    editing?.deviceNetworkId ?? data.deviceNetworks[0]?.id ?? "",
  );
  const [scheme, setScheme] = useState<PortalServiceScheme>(
    editing?.scheme ?? "http",
  );
  const [protocol, setProtocol] = useState<PortalServiceProtocol>(
    editing?.protocol ?? "tcp",
  );
  const [port, setPort] = useState(String(editing?.port ?? 80));
  const [topPath, setTopPath] = useState(editing?.topPath ?? "/");
  const [monitorPath, setMonitorPath] = useState(
    editing?.monitorPath ?? "/",
  );
  const [serviceUrl, setServiceUrl] = useState(editing?.serviceUrl ?? "");
  const [iconKey, setIconKey] = useState<PortalIconReference>(
    normalizeIconReference(editing?.iconKey, "generic:monitor"),
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  const selectedMembership = data.deviceNetworks.find(
    (membership) => membership.id === deviceNetworkId,
  );
  const candidate = {
    scheme,
    port: Number(port),
    topPath,
    monitorPath,
    serviceUrl: serviceUrl.trim() || undefined,
  };
  const servicePreview = selectedMembership
    ? buildServiceUrl(candidate, selectedMembership)
    : "";
  const monitorPreview = selectedMembership
    ? buildMonitorUrl(candidate, selectedMembership)
    : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      subdomain,
      petname,
      description,
      deviceNetworkId,
      scheme,
      port: Number(port),
      protocol,
      topPath: topPath.trim(),
      monitorPath: monitorPath.trim(),
      serviceUrl: serviceUrl.trim() || undefined,
      iconKey,
      enabled,
    };
    const issues = validateServiceInput(input, data);
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      setFormIssues(issues);
      return;
    }

    setErrors({});
    setFormIssues([]);
    onSave("service", {
      id: editing?.id ?? generateId("service"),
      subdomain: subdomain.trim().toLowerCase(),
      petname: petname.trim() || undefined,
      description: description.trim() || undefined,
      deviceNetworkId,
      scheme,
      port: Number(port),
      protocol,
      topPath: topPath.trim(),
      monitorPath: monitorPath.trim(),
      serviceUrl: serviceUrl.trim() || undefined,
      iconKey,
      enabled,
    });
  }

  return (
    <form className="ouchi-entity-form" onSubmit={handleSubmit}>
      <FormNotice issues={formIssues} />
      <label className="ouchi-field">
        <span>サブドメイン</span>
        <input
          aria-label="サブドメイン"
          aria-describedby={
            errors.subdomain ? "service-subdomain-error" : undefined
          }
          aria-invalid={Boolean(errors.subdomain)}
          onChange={(event) => setSubdomain(event.target.value)}
          placeholder="例: gitea"
          ref={firstFieldRef as React.RefObject<HTMLInputElement>}
          required
          value={subdomain}
        />
        <small>`ouchi.local/&lt;サブドメイン&gt;` のパス名になります。</small>
        <FieldError id="service-subdomain-error">
          {errors.subdomain}
        </FieldError>
      </label>

      <label className="ouchi-field">
        <span id="service-petname-label">ペットネーム</span>
        <input
          aria-labelledby="service-petname-label"
          onChange={(event) => setPetname(event.target.value)}
          placeholder="例: おうちGit"
          value={petname}
        />
        <small>未入力ならサブドメインを表示します。</small>
      </label>

      <label className="ouchi-field">
        <span>説明</span>
        <input
          onChange={(event) => setDescription(event.target.value)}
          placeholder="例: Gitサーバ"
          value={description}
        />
      </label>

      <label className="ouchi-field">
        <span>配置先のデバイスIP</span>
        <select
          aria-describedby={
            errors.deviceNetworkId ? "service-device-network-error" : undefined
          }
          aria-invalid={Boolean(errors.deviceNetworkId)}
          onChange={(event) => setDeviceNetworkId(event.target.value)}
          required
          value={deviceNetworkId}
        >
          {sortNetworksForDisplay(data.networks).map((network) => (
            <optgroup key={network.id} label={network.name}>
              {data.deviceNetworks
                .filter(
                  (membership) => membership.networkId === network.id,
                )
                .map((membership) => {
                  const device = data.devices.find(
                    (item) => item.id === membership.deviceId,
                  );
                  return (
                    <option key={membership.id} value={membership.id}>
                      {device?.name ?? membership.deviceId} /{" "}
                      {membership.ip || "IPなし"}
                      {membership.label ? ` / ${membership.label}` : ""}
                    </option>
                  );
                })}
            </optgroup>
          ))}
        </select>
        <FieldError id="service-device-network-error">
          {errors.deviceNetworkId}
        </FieldError>
      </label>

      <div className="ouchi-form-grid ouchi-form-grid--url">
        <label className="ouchi-field">
          <span>スキーム</span>
          <select
            onChange={(event) =>
              setScheme(event.target.value as PortalServiceScheme)
            }
            value={scheme}
          >
            {PORTAL_SERVICE_SCHEMES.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="ouchi-field">
          <span>ポート</span>
          <input
            aria-describedby={errors.port ? "service-port-error" : undefined}
            aria-invalid={Boolean(errors.port)}
            inputMode="numeric"
            onChange={(event) => setPort(event.target.value)}
            value={port}
          />
          <FieldError id="service-port-error">{errors.port}</FieldError>
        </label>
        <label className="ouchi-field">
          <span>プロトコル</span>
          <select
            onChange={(event) =>
              setProtocol(event.target.value as PortalServiceProtocol)
            }
            value={protocol}
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>
        </label>
      </div>

      <div className="ouchi-form-grid">
        <label className="ouchi-field">
          <span>トップパス</span>
          <input
            aria-describedby={errors.topPath ? "service-top-path-error" : undefined}
            aria-invalid={Boolean(errors.topPath)}
            onChange={(event) => setTopPath(event.target.value)}
            placeholder="/"
            value={topPath}
          />
          <FieldError id="service-top-path-error">{errors.topPath}</FieldError>
        </label>
        <label className="ouchi-field">
          <span>監視パス</span>
          <input
            aria-describedby={
              errors.monitorPath ? "service-monitor-path-error" : undefined
            }
            aria-invalid={Boolean(errors.monitorPath)}
            onChange={(event) => setMonitorPath(event.target.value)}
            placeholder="/health"
            value={monitorPath}
          />
          <FieldError id="service-monitor-path-error">
            {errors.monitorPath}
          </FieldError>
        </label>
      </div>

      <label className="ouchi-field">
        <span>サービスURL（任意）</span>
        <input
          aria-describedby={
            errors.serviceUrl ? "service-url-error" : "service-url-help"
          }
          aria-invalid={Boolean(errors.serviceUrl)}
          onChange={(event) => setServiceUrl(event.target.value)}
          placeholder="空欄なら所属IPから自動生成"
          type="url"
          value={serviceUrl}
        />
        <small id="service-url-help">
          空欄の場合はスキーム、IP、ポート、トップパスから生成します。
        </small>
        <FieldError id="service-url-error">{errors.serviceUrl}</FieldError>
      </label>

      {selectedMembership && (
        <div className="ouchi-url-preview">
          <span>サービス</span>
          <code>{servicePreview}</code>
          <span>監視URL</span>
          <code>{monitorPreview || "IP未登録のためリンクなし"}</code>
        </div>
      )}

      <IconPicker
        onChange={setIconKey}
        serviceUrl={servicePreview || undefined}
        value={iconKey}
      />

      <div className="ouchi-form-grid">
        <label className="ouchi-checkbox-field">
          <input
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>サービスを有効にする</strong>
            <small>リダイレクトと監視設定の生成対象にします。</small>
          </span>
        </label>
      </div>

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
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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
