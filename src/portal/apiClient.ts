import {
  type PortalApiData,
  type PortalApiDevice,
  type PortalApiService,
  type PortalDataV2,
  type PortalDeviceInput,
  type PortalInterface,
  type PortalInterfaceInput,
  type PortalNetworkInput,
  type PortalRelationInput,
  type PortalRelationNameInput,
  type PortalServiceInput,
  type PortalSettings,
  type PortalSettingsInput,
  type ValidationIssue,
} from "./types";
import { normalizeServiceIconReference } from "./iconCatalog";
import { normalizeNetworkAccent } from "./colorValue";

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

function normalizeAccent(value: string): string {
  return normalizeNetworkAccent(value);
}

function normalizeIconKey(value: string | null) {
  return normalizeServiceIconReference(value, undefined, "favicon");
}

function interfacesFrom(
  devices: PortalApiDevice[],
): PortalInterface[] {
  return devices.flatMap((device) =>
    device.interfaces.map((iface) => ({
      id: String(iface.id),
      deviceId: String(iface.deviceId),
      name: iface.name,
      networkId: iface.networkId === null ? null : String(iface.networkId),
      ip: iface.ip ?? "",
      mac: iface.mac ?? undefined,
    })),
  );
}

function serviceFrom(service: PortalApiService) {
  return {
    id: String(service.id),
    interfaceId: String(service.interfaceId),
    subdomain: service.subdomain,
    petname: service.petname ?? undefined,
    description: service.description ?? undefined,
    properties: service.properties ?? {},
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
      petname: device.petname ?? undefined,
      properties: device.properties ?? {},
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
    interfaces: interfacesFrom(data.devices),
    relationNames: data.relationNames.map((relationName) => ({
      id: String(relationName.id),
      name: relationName.name,
      color: relationName.color,
      relationCount: relationName.relationCount,
    })),
    relations: data.relations.map((relation) => ({
      id: String(relation.id),
      relationNameId: String(relation.relationNameId),
      relationName: relation.relationName,
      fromDeviceId: String(relation.fromDeviceId),
      toDeviceId: String(relation.toDeviceId),
      fromInterfaceId: String(relation.fromInterfaceId),
      toInterfaceId: String(relation.toInterfaceId),
      fromLabel: relation.fromLabel,
      toLabel: relation.toLabel,
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
    interfaces: number;
    relationNames: number;
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

export function createInterface(
  baseUrl: string,
  input: PortalInterfaceInput,
) {
  return request(baseUrl, "/api/interfaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateInterface(
  baseUrl: string,
  id: string,
  input: PortalInterfaceInput,
) {
  return request(baseUrl, `/api/interfaces/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteInterface(baseUrl: string, id: string) {
  return request(baseUrl, `/api/interfaces/${encodeURIComponent(id)}`, {
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

export function createRelationName(
  baseUrl: string,
  input: PortalRelationNameInput,
) {
  return request(baseUrl, "/api/relation-names", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRelationName(
  baseUrl: string,
  id: string,
  input: PortalRelationNameInput,
) {
  return request(baseUrl, `/api/relation-names/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteRelationName(baseUrl: string, id: string) {
  return request(baseUrl, `/api/relation-names/${encodeURIComponent(id)}`, {
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

export function updateRelation(
  baseUrl: string,
  id: string,
  input: PortalRelationInput,
) {
  return request(baseUrl, `/api/relations/${encodeURIComponent(id)}`, {
    method: "PUT",
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
