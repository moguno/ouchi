import {
  ACCENT_TONES,
  PORTAL_ICON_KEYS,
  type AccentTone,
  type PortalApiData,
  type PortalApiDevice,
  type PortalApiService,
  type PortalDataV2,
  type PortalDeviceInput,
  type PortalDeviceNetwork,
  type PortalIconKey,
  type PortalMembershipInput,
  type PortalNetworkInput,
  type PortalRelationInput,
  type PortalServiceInput,
  type PortalSettings,
  type PortalSettingsInput,
  type ValidationIssue,
} from "./types";

export class PortalApiError extends Error {
  readonly status: number;
  readonly issues: ValidationIssue[];

  constructor(
    message: string,
    status: number,
    issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "PortalApiError";
    this.status = status;
    this.issues = issues;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function request<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => undefined)) as
    | {
        error?: string;
        issues?: ValidationIssue[];
      }
    | undefined;
  if (!response.ok) {
    throw new PortalApiError(
      payload?.error ??
        (response.status === 400
          ? "入力内容を確認してください"
          : `APIエラー（HTTP ${response.status}）`),
      response.status,
      payload?.issues ?? [],
    );
  }
  return payload as T;
}

function normalizeAccent(value: string): AccentTone {
  return ACCENT_TONES.includes(value as AccentTone)
    ? (value as AccentTone)
    : "slate";
}

function normalizeIconKey(value: string | null): PortalIconKey {
  return value && PORTAL_ICON_KEYS.includes(value as PortalIconKey)
    ? (value as PortalIconKey)
    : "monitor";
}

function deviceNetworksFrom(
  devices: PortalApiDevice[],
): PortalDeviceNetwork[] {
  return devices.flatMap((device) =>
    device.memberships.map((membership) => ({
      id: String(membership.id),
      deviceId: String(membership.deviceId),
      networkId: String(membership.networkId),
      ip: membership.ip ?? "",
      label: membership.label ?? undefined,
    })),
  );
}

function serviceFrom(service: PortalApiService) {
  return {
    id: String(service.id),
    deviceNetworkId: String(service.deviceNetworkId),
    subdomain: service.subdomain,
    petname: service.petname ?? undefined,
    description: service.description ?? undefined,
    scheme: service.scheme,
    port: service.port,
    protocol: service.protocol,
    topPath: service.topPath ?? "/",
    monitorPath: service.monitorPath ?? "/",
    serviceUrl: service.serviceUrl ?? undefined,
    iconKey: normalizeIconKey(service.iconKey),
    enabled: service.enabled,
    url: service.url,
    monitorUrl: service.monitorUrl,
    status: service.status,
  };
}

export function normalizePortalData(data: PortalApiData): PortalDataV2 {
  return {
    version: 2,
    networks: data.networks.map((network) => ({
      id: String(network.id),
      name: network.name,
      cidr: network.cidr ?? undefined,
      accent: normalizeAccent(network.accent),
      note: network.note ?? undefined,
    })),
    devices: data.devices.map((device) => ({
      id: String(device.id),
      name: device.hostname,
      category: device.category,
      isVm: device.isVm,
      meterEnabled: device.meterEnabled,
      note: device.note ?? undefined,
      ssh:
        device.sshUser || device.sshPort
          ? {
              user: device.sshUser ?? "",
              port: device.sshPort ?? 22,
            }
          : undefined,
    })),
    deviceNetworks: deviceNetworksFrom(data.devices),
    relations: data.relations.map((relation) => ({
      id: String(relation.id),
      fromDeviceId: String(relation.fromDeviceId),
      toDeviceId: String(relation.toDeviceId),
      tag: relation.tag ?? undefined,
      fromLabel: relation.fromLabel ?? undefined,
      toLabel: relation.toLabel ?? undefined,
      color: relation.color,
    })),
    services: data.services.map(serviceFrom),
    settings: {
      domain: data.settings.domain,
      title: data.settings.title,
    },
  };
}

export async function fetchPortal(
  apiBaseUrl = "",
): Promise<PortalDataV2> {
  const data = await request<PortalApiData>(
    apiBaseUrl,
    "/api/portal",
  );
  return normalizePortalData(data);
}

export interface LedgerDownload {
  filename: string;
  yaml: string;
}

export interface LedgerImportResult {
  ok: true;
  imported: {
    networks: number;
    devices: number;
    memberships: number;
    relations: number;
    services: number;
    sshKeys: number;
    deviceKeys: number;
  };
}

export async function exportLedger(
  baseUrl = "",
): Promise<LedgerDownload> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/export`, {
    headers: { Accept: "application/yaml" },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      | { error?: string; issues?: ValidationIssue[] }
      | undefined;
    throw new PortalApiError(
      payload?.error ?? `エクスポートに失敗しました（HTTP ${response.status}）`,
      response.status,
      payload?.issues ?? [],
    );
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
    "ouchi-ledger.yaml";
  return {
    filename,
    yaml: await response.text(),
  };
}

export function importLedger(
  baseUrl: string,
  yaml: string,
) {
  return request<LedgerImportResult>(baseUrl, "/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
    body: yaml,
  });
}

export function createNetwork(
  baseUrl: string,
  input: PortalNetworkInput,
) {
  return request(baseUrl, "/api/networks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNetwork(
  baseUrl: string,
  id: string,
  input: PortalNetworkInput,
) {
  return request(baseUrl, `/api/networks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteNetwork(baseUrl: string, id: string) {
  return request(baseUrl, `/api/networks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createDevice(
  baseUrl: string,
  input: PortalDeviceInput,
) {
  return request(baseUrl, "/api/devices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDevice(
  baseUrl: string,
  id: string,
  input: PortalDeviceInput,
) {
  return request(baseUrl, `/api/devices/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteDevice(baseUrl: string, id: string) {
  return request(baseUrl, `/api/devices/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createMembership(
  baseUrl: string,
  input: PortalMembershipInput,
) {
  return request(baseUrl, "/api/memberships", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMembership(
  baseUrl: string,
  id: string,
  input: PortalMembershipInput,
) {
  return request(baseUrl, `/api/memberships/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteMembership(baseUrl: string, id: string) {
  return request(baseUrl, `/api/memberships/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createService(
  baseUrl: string,
  input: PortalServiceInput,
) {
  return request(baseUrl, "/api/services", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateService(
  baseUrl: string,
  id: string,
  input: PortalServiceInput,
) {
  return request(baseUrl, `/api/services/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteService(baseUrl: string, id: string) {
  return request(baseUrl, `/api/services/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createRelation(
  baseUrl: string,
  input: PortalRelationInput,
) {
  return request(baseUrl, "/api/relations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteRelation(baseUrl: string, id: string) {
  return request(baseUrl, `/api/relations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function updateSettings(
  baseUrl: string,
  input: PortalSettingsInput,
) {
  return request<PortalSettings>(baseUrl, "/api/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
