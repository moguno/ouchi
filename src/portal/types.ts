export type PortalStatus = "up" | "down" | "maintenance";


export type PortalServiceScheme = "http" | "https" | "none";

export type PortalServiceProtocol = "tcp" | "udp";

export type PortalProperties = Record<string, string>;

export type PortalDeviceCategory =
  | "network"
  | "physical"
  | "vm"
  | "service";

export type PortalLegacyPresetIconKey =
  | "gitea"
  | "gatus"
  | "proxmox"
  | "omv"
  | "server"
  | "database"
  | "monitor"
  | "container"
  | "globe";

export type PortalGenericIconKey =
  | "applications"
  | "bookmark"
  | "calendar"
  | "camera"
  | "chart"
  | "chat"
  | "cloud"
  | "code"
  | "download"
  | "folder"
  | "home"
  | "key"
  | "lock"
  | "mail"
  | "music"
  | "printer"
  | "shield"
  | "switch"
  | "terminal"
  | "upload"
  | "users"
  | "video"
  | PortalLegacyPresetIconKey;

export type PortalIconKey = PortalLegacyPresetIconKey;

export type PortalIconKind = "favicon" | "url" | "unset";

/**
 * A service icon is the service URL origin's favicon, an explicit
 * HTTP(S) image URL, or unset (null), which renders one bundled
 * placeholder icon. Legacy `generic:` / `preset:` references normalize
 * to unset; legacy `dashboard:slug` values normalize to the
 * corresponding jsDelivr SVG URL.
 */
export type PortalIconReference = "favicon" | `url:${string}`;

export interface PortalNetwork {
  id: string;
  name: string;
  cidr?: string;
  accent: string;
  note?: string;
  properties?: PortalProperties;
  sortOrder?: number;
}

export interface PortalDeviceResources {
  memoryPercent: number;
  diskPercent: number;
}

export interface PortalSshInfo {
  user: string;
  port: number;
}

export interface PortalDevice {
  id: string;
  name: string;
  petname?: string;
  properties?: PortalProperties;
  category: PortalDeviceCategory;
  meterEnabled?: boolean;
  note?: string;
  ssh?: PortalSshInfo;
  resources?: PortalDeviceResources;
}

export interface PortalInterface {
  id: string;
  deviceId: string;
  name: string;
  networkId: string | null;
  ip: string;
  mac?: string;
}

export type PortalLineEndpointShape =
  | "none"
  | "arrow"
  | "circle"
  | "square"
  | "diamond";

export interface PortalRelationName {
  id: string;
  name: string;
  color: string;
  lineStart: PortalLineEndpointShape;
  lineEnd: PortalLineEndpointShape;
  relationCount: number;
}

export interface PortalRelation {
  id: string;
  relationNameId: string;
  relationName: string;
  fromDeviceId: string;
  toDeviceId: string;
  fromInterfaceId: string | null;
  toInterfaceId: string | null;
  fromServiceId: string | null;
  toServiceId: string | null;
  fromLabel: string;
  toLabel: string;
  port: number | null;
  protocol: PortalServiceProtocol | null;
  properties?: PortalProperties;
  color: string;
  lineStart: PortalLineEndpointShape;
  lineEnd: PortalLineEndpointShape;
}

export interface PortalService {
  id: string;
  interfaceId: string;
  subdomain: string;
  petname?: string;
  description?: string;
  properties?: PortalProperties;
  scheme: PortalServiceScheme;
  port: number;
  protocol: PortalServiceProtocol;
  topPath: string;
  monitorPath: string;
  serviceUrl?: string;
  iconKey: PortalIconReference | null;
  enabled: boolean;
  url?: string | null;
  monitorUrl?: string | null;
  status?: PortalStatus;
}

export interface PortalSettings {
  domain: string;
  title: string;
  properties?: PortalProperties;
}

export interface PortalDataV2 {
  version: 2;
  networks: PortalNetwork[];
  devices: PortalDevice[];
  interfaces: PortalInterface[];
  relationNames: PortalRelationName[];
  relations: PortalRelation[];
  services: PortalService[];
  settings?: PortalSettings;
}

export interface OuchiPortalProps {
  data?: PortalDataV2;
  apiBaseUrl?: string;
  /**
   * Enables the static YAML data source. When set, the portal loads this file
   * instead of the REST API. Management screens remain available for demo,
   * but mutations are disabled.
   */
  yamlUrl?: string;
  /** Hide all management UI. YAML demo mode still exposes save-disabled UI. */
  readOnly?: boolean;
  showTitle?: boolean;
  initialSelectedDeviceId?: string;
  onDataChange?: (data: PortalDataV2) => void;
  className?: string;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  value?: T;
  issues: ValidationIssue[];
}

/**
 * REST API response model. IDs are SQLite INTEGER ids and are intentionally
 * kept numeric at the API boundary; the SPA stringifies them in its adapter.
 */
export interface PortalApiNetwork {
  id: number;
  name: string;
  cidr: string | null;
  accent: string;
  note: string | null;
  properties: PortalProperties;
  sortOrder: number;
}

export interface PortalApiInterface {
  id: number;
  deviceId: number;
  name: string;
  networkId: number | null;
  ip: string | null;
  mac: string | null;
}

export interface PortalApiDevice {
  id: number;
  hostname: string;
  petname: string | null;
  properties: PortalProperties;
  category: PortalDeviceCategory;
  sshUser: string | null;
  sshPort: number | null;
  meterEnabled: boolean;
  note: string | null;
  interfaces: PortalApiInterface[];
}

export interface PortalApiRelationName {
  id: number;
  name: string;
  color: string;
  lineStart: PortalLineEndpointShape;
  lineEnd: PortalLineEndpointShape;
  relationCount: number;
}

export interface PortalApiRelation {
  id: number;
  relationNameId: number;
  relationName: string;
  fromDeviceId: number;
  toDeviceId: number;
  fromInterfaceId: number | null;
  toInterfaceId: number | null;
  fromInterfaceName: string | null;
  toInterfaceName: string | null;
  fromServiceId: number | null;
  toServiceId: number | null;
  fromServiceName: string | null;
  toServiceName: string | null;
  fromServiceSubdomain: string | null;
  toServiceSubdomain: string | null;
  fromLabel: string;
  toLabel: string;
  port: number | null;
  protocol: PortalServiceProtocol | null;
  properties: PortalProperties;
  color: string;
  lineStart: PortalLineEndpointShape;
  lineEnd: PortalLineEndpointShape;
}

export interface PortalApiService {
  id: number;
  interfaceId: number;
  subdomain: string;
  petname: string | null;
  description: string | null;
  properties: PortalProperties;
  port: number;
  protocol: PortalServiceProtocol;
  scheme: PortalServiceScheme;
  topPath: string | null;
  monitorPath: string | null;
  serviceUrl: string | null;
  iconKey: PortalIconReference | null;
  enabled: boolean;
  url: string | null;
  monitorUrl: string | null;
  status?: PortalStatus;
}

export interface PortalApiData {
  version: 2;
  networks: PortalApiNetwork[];
  devices: PortalApiDevice[];
  services: PortalApiService[];
  relationNames: PortalApiRelationName[];
  relations: PortalApiRelation[];
  settings: PortalSettings;
}

export interface PortalSettingsInput {
  title: string;
  properties?: PortalProperties;
}

export interface PortalNetworkInput {
  name: string;
  cidr?: string | null;
  accent: string;
  note?: string | null;
  properties?: PortalProperties;
}

export interface PortalDeviceInput {
  hostname: string;
  petname?: string | null;
  properties?: PortalProperties;
  category: PortalDeviceCategory;
  sshUser?: string | null;
  sshPort?: number | null;
  meterEnabled: boolean;
  note?: string | null;
}

export interface PortalInterfaceInput {
  deviceId: number;
  name: string;
  networkId: number | null;
  ip?: string | null;
  mac?: string | null;
}

export interface PortalRelationInput {
  relationName: string;
  fromInterfaceId?: number | null;
  toInterfaceId?: number | null;
  fromServiceId?: number | null;
  toServiceId?: number | null;
  fromLabel?: string;
  toLabel?: string;
  port?: number | null;
  protocol?: PortalServiceProtocol | null;
  properties?: PortalProperties;
}

export interface PortalRelationNameInput {
  name: string;
  color: string;
  lineStart?: PortalLineEndpointShape;
  lineEnd?: PortalLineEndpointShape;
}

export interface PortalServiceInput {
  interfaceId: number;
  subdomain: string;
  petname?: string | null;
  description?: string | null;
  properties?: PortalProperties;
  port: number;
  protocol: PortalServiceProtocol;
  scheme: PortalServiceScheme;
  topPath?: string | null;
  monitorPath?: string | null;
  serviceUrl?: string | null;
  iconKey?: PortalIconReference | null;
  enabled: boolean;
}

export const PORTAL_STATUSES: PortalStatus[] = [
  "up",
  "down",
  "maintenance",
];

export const PORTAL_SERVICE_SCHEMES: PortalServiceScheme[] = [
  "http",
  "https",
  "none",
];

export const PORTAL_DEVICE_CATEGORIES: PortalDeviceCategory[] = [
  "network",
  "physical",
  "vm",
  "service",
];

export const PORTAL_ICON_KEYS: PortalIconKey[] = [
  "gitea",
  "gatus",
  "proxmox",
  "omv",
  "server",
  "database",
  "monitor",
  "container",
  "globe",
];

export const PORTAL_GENERIC_ICON_KEYS: PortalGenericIconKey[] = [
  "applications",
  "bookmark",
  "calendar",
  "camera",
  "chart",
  "chat",
  "cloud",
  "code",
  "download",
  "folder",
  "home",
  "key",
  "lock",
  "mail",
  "music",
  "printer",
  "shield",
  "terminal",
  "upload",
  "users",
  "video",
  ...PORTAL_ICON_KEYS,
];

export const DEVICE_CATEGORY_LABELS: Record<PortalDeviceCategory, string> = {
  network: "ネットワーク機器",
  physical: "物理マシン",
  vm: "VM",
  service: "サービス",
};
