import { useState, type FormEvent } from "react";
import {
  PORTAL_SERVICE_SCHEMES,
  type PortalDataV2,
  type PortalService,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type ValidationIssue,
} from "./types";
import { validateServiceInput } from "./validation";
import { buildServiceUrl } from "./urls";
import {
  FieldError,
  FormActions,
  FormNotice,
  setIssues,
} from "./EntityFormParts";
import { ManageDialog } from "./ManageDialog";

export interface ServiceTopPatch {
  scheme: PortalServiceScheme;
  port: number;
  protocol: PortalServiceProtocol;
  topPath: string;
  serviceUrl?: string;
}

interface ServiceTopDialogProps {
  data: PortalDataV2;
  service: PortalService;
  onClose: () => void;
  onSave: (serviceId: string, patch: ServiceTopPatch) => void;
  saveDisabled?: boolean;
}

export function ServiceTopDialog({
  data,
  service,
  onClose,
  onSave,
  saveDisabled = false,
}: ServiceTopDialogProps) {
  const displayName = service.petname?.trim() || service.subdomain;
  const [scheme, setScheme] = useState<PortalServiceScheme>(service.scheme);
  const [port, setPort] = useState(String(service.port));
  const [protocol, setProtocol] = useState<PortalServiceProtocol>(
    service.protocol,
  );
  const [topPath, setTopPath] = useState(service.topPath);
  const [serviceUrl, setServiceUrl] = useState(service.serviceUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);

  const iface = data.interfaces.find(
    (item) => item.id === service.interfaceId,
  );
  const candidate = {
    scheme,
    port: Number(port),
    topPath,
    serviceUrl: serviceUrl.trim() || undefined,
  };
  const servicePreview = iface
    ? buildServiceUrl(candidate, iface)
    : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveDisabled) {
      return;
    }
    const issues = validateServiceInput(
      {
        subdomain: service.subdomain,
        petname: service.petname ?? "",
        description: service.description ?? "",
        interfaceId: service.interfaceId,
        scheme,
        port: Number(port),
        protocol,
        topPath: topPath.trim(),
        monitorPath: service.monitorPath,
        serviceUrl: serviceUrl.trim() || undefined,
        iconKey: service.iconKey,
        enabled: service.enabled,
      },
      data,
    );
    if (issues.length > 0) {
      setIssues(issues, setErrors);
      setFormIssues(issues);
      return;
    }
    setErrors({});
    setFormIssues([]);
    onSave(service.id, {
      scheme,
      port: Number(port),
      protocol,
      topPath: topPath.trim(),
      serviceUrl: serviceUrl.trim() || undefined,
    });
  }

  return (
    <ManageDialog onClose={onClose} title={`${displayName}のトップ`}>
      <form className="ouchi-entity-form" onSubmit={handleSubmit}>
        <FormNotice issues={formIssues} />
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
                  {value === "none" ? "リンクなし" : value.toUpperCase()}
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

        <label className="ouchi-field">
          <span>トップパス</span>
          <input
            aria-describedby={
              errors.topPath ? "service-top-path-error" : undefined
            }
            aria-invalid={Boolean(errors.topPath)}
            onChange={(event) => setTopPath(event.target.value)}
            placeholder="/"
            value={topPath}
          />
          <FieldError id="service-top-path-error">{errors.topPath}</FieldError>
        </label>

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

        {iface && (
          <div className="ouchi-url-preview">
            <span>サービス</span>
            <code>{servicePreview ?? "（リンクなし）"}</code>
          </div>
        )}

        <FormActions
          disabled={saveDisabled}
          disabledReason="デモモードでは保存されません。"
          onClose={onClose}
          submitLabel="保存"
        />
      </form>
    </ManageDialog>
  );
}
