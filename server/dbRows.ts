import type {
  PortalApiDevice,
  PortalApiInterface,
  PortalApiNetwork,
  PortalApiProject,
  PortalApiRelation,
  PortalApiRelationName,
  PortalApiService,
  PortalLineEndpointShape,
  PortalProperties,
  PortalServiceProtocol,
} from "../src/portal/types";
import { normalizeServiceIconReference } from "../src/portal/iconCatalog";
import { buildMonitorUrl, buildServiceUrl } from "../src/portal/urls";
import { normalizeProperties } from "../src/portal/validation";

export type ProjectRow = {
  id: number;
  name: string;
  title: string;
  color: string;
  properties: string;
};

export type NetworkRow = {
  id: number;
  project_id: number;
  name: string;
  cidr: string | null;
  accent: string;
  note: string | null;
  properties: string;
  sort_order: number;
};

export type DeviceRow = {
  id: number;
  project_id: number;
  hostname: string;
  petname: string | null;
  category: PortalApiDevice["category"];
  ssh_user: string | null;
  ssh_port: number | null;
  meter_enabled: number;
  note: string | null;
  properties: string;
};

export type InterfaceRow = {
  id: number;
  project_id: number;
  device_id: number;
  name: string;
  network_id: number | null;
  ip: string | null;
  mac: string | null;
  properties: string;
};

export type ServiceRow = {
  id: number;
  project_id: number;
  interface_id: number;
  subdomain: string;
  petname: string | null;
  description: string | null;
  port: number;
  protocol: PortalApiService["protocol"];
  scheme: PortalApiService["scheme"];
  top_path: string | null;
  monitor_path: string | null;
  service_url: string | null;
  icon_key: string | null;
  favicon_url: string | null;
  enabled: number;
  ip: string | null;
  properties: string;
};

export type RelationRow = {
  id: number;
  project_id: number;
  relation_name_id: number;
  relation_name: string;
  line_start: PortalLineEndpointShape;
  line_end: PortalLineEndpointShape;
  from_device_id: number;
  to_device_id: number;
  from_interface_id: number | null;
  to_interface_id: number | null;
  from_interface_name: string | null;
  to_interface_name: string | null;
  from_service_id: number | null;
  to_service_id: number | null;
  from_service_name: string | null;
  to_service_name: string | null;
  from_service_subdomain: string | null;
  to_service_subdomain: string | null;
  from_label: string;
  to_label: string;
  port: number | null;
  protocol: PortalServiceProtocol | null;
  properties: string;
  color: string;
};

export type RelationNameRow = {
  id: number;
  project_id: number;
  name: string;
  color: string;
  line_start: PortalLineEndpointShape;
  line_end: PortalLineEndpointShape;
  relation_count: number;
};

export function asNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

export function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function parseProperties(value: string | null): PortalProperties {
  if (!value) {
    return {};
  }
  try {
    return normalizeProperties(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

export function serializeProperties(value: unknown): string {
  return JSON.stringify(normalizeProperties(value));
}

export function toApiProject(row: ProjectRow): PortalApiProject {
  return {
    id: asNumber(row.id),
    name: row.name,
    title: row.title,
    color: row.color,
    properties: parseProperties(row.properties),
  };
}

export function toApiNetwork(row: NetworkRow): PortalApiNetwork {
  return {
    id: asNumber(row.id),
    projectId: asNumber(row.project_id),
    name: row.name,
    cidr: row.cidr,
    accent: row.accent,
    note: row.note,
    properties: parseProperties(row.properties),
    sortOrder: asNumber(row.sort_order),
  };
}

export function toApiInterface(row: InterfaceRow): PortalApiInterface {
  return {
    id: asNumber(row.id),
    projectId: asNumber(row.project_id),
    deviceId: asNumber(row.device_id),
    name: row.name,
    networkId: row.network_id === null ? null : asNumber(row.network_id),
    ip: row.ip,
    mac: row.mac,
    properties: parseProperties(row.properties),
  };
}

export function toApiDevice(
  row: DeviceRow,
  interfaces: PortalApiInterface[],
): PortalApiDevice {
  return {
    id: asNumber(row.id),
    projectId: asNumber(row.project_id),
    hostname: row.hostname,
    petname: row.petname,
    category: row.category,
    sshUser: row.ssh_user,
    sshPort: row.ssh_port === null ? null : asNumber(row.ssh_port),
    meterEnabled: Boolean(row.meter_enabled),
    note: row.note,
    properties: parseProperties(row.properties),
    interfaces,
  };
}

export function toApiService(row: ServiceRow): PortalApiService {
  const base = {
    scheme: row.scheme,
    port: row.port,
    topPath: row.top_path ?? "",
    monitorPath: row.monitor_path ?? "",
    serviceUrl: row.service_url ?? "",
  };
  return {
    id: asNumber(row.id),
    projectId: asNumber(row.project_id),
    interfaceId: asNumber(row.interface_id),
    subdomain: row.subdomain,
    petname: row.petname,
    description: row.description,
    properties: parseProperties(row.properties),
    port: row.port,
    protocol: row.protocol,
    scheme: row.scheme,
    topPath: row.top_path,
    monitorPath: row.monitor_path,
    serviceUrl: row.service_url,
    iconKey: normalizeServiceIconReference(row.icon_key, row.favicon_url),
    enabled: Boolean(row.enabled),
    url: buildServiceUrl(base, { ip: row.ip ?? "" }),
    monitorUrl: buildMonitorUrl(base, { ip: row.ip ?? "" }),
  };
}

export function nullableNumber(value: number | bigint | null): number | null {
  return value === null ? null : asNumber(value);
}

export function toApiRelation(row: RelationRow): PortalApiRelation {
  return {
    id: asNumber(row.id),
    projectId: asNumber(row.project_id),
    relationNameId: asNumber(row.relation_name_id),
    relationName: row.relation_name,
    fromDeviceId: asNumber(row.from_device_id),
    toDeviceId: asNumber(row.to_device_id),
    fromInterfaceId: nullableNumber(row.from_interface_id),
    toInterfaceId: nullableNumber(row.to_interface_id),
    fromInterfaceName: row.from_interface_name,
    toInterfaceName: row.to_interface_name,
    fromServiceId: nullableNumber(row.from_service_id),
    toServiceId: nullableNumber(row.to_service_id),
    fromServiceName: row.from_service_name,
    toServiceName: row.to_service_name,
    fromServiceSubdomain: row.from_service_subdomain,
    toServiceSubdomain: row.to_service_subdomain,
    fromLabel: row.from_label,
    toLabel: row.to_label,
    port: nullableNumber(row.port),
    protocol: row.protocol,
    properties: parseProperties(row.properties),
    color: row.color,
    lineStart: row.line_start,
    lineEnd: row.line_end,
  };
}

export function toApiRelationName(row: RelationNameRow): PortalApiRelationName {
  return {
    id: asNumber(row.id),
    projectId: asNumber(row.project_id),
    name: row.name,
    color: row.color,
    lineStart: row.line_start,
    lineEnd: row.line_end,
    relationCount: asNumber(row.relation_count),
  };
}

export const RELATION_SELECT = `
  SELECT r.id, r.project_id, n.id AS relation_name_id, n.name AS relation_name,
         n.color, n.line_start, n.line_end,
         COALESCE(fi.device_id, fsi.device_id) AS from_device_id,
         COALESCE(ti.device_id, tsi.device_id) AS to_device_id,
         r.from_interface_id, r.to_interface_id,
         fi.name AS from_interface_name, ti.name AS to_interface_name,
         r.from_service_id, r.to_service_id,
         COALESCE(NULLIF(fs.petname, ''), fs.subdomain) AS from_service_name,
         COALESCE(NULLIF(ts.petname, ''), ts.subdomain) AS to_service_name,
         fs.subdomain AS from_service_subdomain,
         ts.subdomain AS to_service_subdomain,
         r.from_label, r.to_label, r.port, r.protocol, r.properties
  FROM relations r
  JOIN relation_names n ON n.id = r.relation_name_id
  LEFT JOIN interfaces fi ON fi.id = r.from_interface_id
  LEFT JOIN interfaces ti ON ti.id = r.to_interface_id
  LEFT JOIN services fs ON fs.id = r.from_service_id
  LEFT JOIN services ts ON ts.id = r.to_service_id
  LEFT JOIN interfaces fsi ON fsi.id = fs.interface_id
  LEFT JOIN interfaces tsi ON tsi.id = ts.interface_id
`;

export const RELATION_NAME_SELECT = `
  SELECT n.id, n.project_id, n.name, n.color, n.line_start, n.line_end,
         COUNT(r.id) AS relation_count
  FROM relation_names n
  LEFT JOIN relations r ON r.relation_name_id = n.id
`;
