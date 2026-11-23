import {
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import {
  PORTAL_SERVICE_SCHEMES,
  type PortalIconReference,
  type PortalService,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type ValidationIssue,
} from "./types";
import { normalizeIconReference } from "./iconCatalog";
import {
  generateId,
  validateServiceInput,
} from "./validation";
import { sortNetworksForDisplay } from "./networkOrder";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import type { EntityFormProps } from "./entityDialogTypes";

export function ServiceEntityDialog({
  data,
  editing,
  firstFieldRef,
  onClose,
  onSave,
  saveDisabled = false,
}: EntityFormProps<PortalService>) {
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
  // 監視パスは後のマイルストーンのためUIを持たない。保存時は既存値を保持する。
  const monitorPath = editing?.monitorPath ?? "/";
  const [serviceUrl, setServiceUrl] = useState(editing?.serviceUrl ?? "");
  const [iconKey, setIconKey] = useState<PortalIconReference>(
    normalizeIconReference(editing?.iconKey, "favicon"),
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  const selectedMembership = data.deviceNetworks.find(
    (membership) => membership.id === deviceNetworkId,
  );
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
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
      // プロパティはメモダイアログが所有する。保存時は既存値を保持する。
      properties: editing?.properties ?? {},
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
        <span id="service-petname-label">名前</span>
        <input
          aria-labelledby="service-petname-label"
          onChange={(event) => setPetname(event.target.value)}
          placeholder="例: おうちGit"
          ref={firstFieldRef as RefObject<HTMLInputElement | null>}
          value={petname}
        />
        <small>未入力ならサブドメインを表示します。</small>
      </label>

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
          required
          value={subdomain}
        />
        <small>`ouchi.local/&lt;サブドメイン&gt;` のパス名になります。</small>
        <FieldError id="service-subdomain-error">
          {errors.subdomain}
        </FieldError>
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


      <div className="ouchi-form-grid">
        <label className="ouchi-checkbox-field">
          <input
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>サービスを有効にする</strong>
            <small>リダイレクトの対象にします。</small>
          </span>
        </label>
      </div>

      <FormActions
        disabled={saveDisabled}
        disabledReason="デモモードでは保存されません。"
        onClose={onClose}
        submitLabel={editing ? "保存" : "追加する"}
      />
    </form>
  );
}
