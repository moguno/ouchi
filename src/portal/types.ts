export type PortalStatus = "up" | "down" | "maintenance";

export type AccentTone = "blue" | "green" | "orange" | "violet" | "slate";

export type PortalServiceScheme = "http" | "https";

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
  | "terminal"
  | "upload"
  | "users"
  | "video"
  | PortalLegacyPresetIconKey;

export type PortalIconKey = PortalLegacyPresetIconKey;

export type PortalIconKind = "generic" | "favicon" | "url";

/**
 * Canonical icon references are all bundled generic keys, the service URL
 * origin's favicon, or an explicit HTTP(S) image URL. Legacy `preset:key` and
 * bare preset keys normalize to `generic:key`; legacy `dashboard:slug` values
 * normalize to the corresponding jsDelivr SVG URL.
 */
export type PortalIconReference =
  | `generic:${PortalGenericIconKey}`
  | "favicon"
  | `url:${string}`;

export interface PortalNetwork {
  id: string;
  name: string;
  cidr?: string;
  accent: AccentTone;
  note?: string;
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
  isVm: boolean;
  meterEnabled?: boolean;
  note?: string;
  ssh?: PortalSshInfo;
  resources?: PortalDeviceResources;
}

export interface PortalDeviceNetwork {
  id: string;
  deviceId: string;
  networkId: string;
  ip: string;
  label?: string;
}

export interface PortalRelationName {
  id: string;
  name: string;
  color: string;
  fromLabel?: string;
  toLabel?: string;
  relationCount: number;
}

export interface PortalRelation {
  id: string;
  relationNameId: string;
  relationName: string;
  fromDeviceId: string;
  toDeviceId: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  fromLabel: string;
  toLabel: string;
  color: string;
}

export interface PortalService {
  id: string;
  deviceNetworkId: string;
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
  iconKey: PortalIconReference;
  enabled: boolean;
  url?: string | null;
  monitorUrl?: string | null;
  status?: PortalStatus;
}

export interface PortalSettings {
  domain: string;
  title: string;
}

export interface PortalDataV2 {
  version: 2;
  networks: PortalNetwork[];
  devices: PortalDevice[];
  deviceNetworks: PortalDeviceNetwork[];
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
}

export interface PortalApiMembership {
  id: number;
  deviceId: number;
  networkId: number;
  ip: string | null;
  label: string | null;
}

export interface PortalApiDevice {
  id: number;
  hostname: string;
  petname: string | null;
  properties: PortalProperties;
  category: PortalDeviceCategory;
  isVm: boolean;
  sshUser: string | null;
  sshPort: number | null;
  meterEnabled: boolean;
  note: string | null;
  memberships: PortalApiMembership[];
}

export interface PortalApiRelationName {
  id: number;
  name: string;
  color: string;
  fromLabel: string | null;
  toLabel: string | null;
  relationCount: number;
}

export interface PortalApiRelation {
  id: number;
  relationNameId: number;
  relationName: string;
  fromDeviceId: number;
  toDeviceId: number;
  fromPlaceholder: string;
  toPlaceholder: string;
  fromLabel: string;
  toLabel: string;
  color: string;
}

export interface PortalApiService {
  id: number;
  deviceNetworkId: number;
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
}

export interface PortalNetworkInput {
  name: string;
  cidr?: string | null;
  accent: string;
  note?: string | null;
}

export interface PortalDeviceInput {
  hostname: string;
  petname?: string | null;
  properties?: PortalProperties;
  category: PortalDeviceCategory;
  isVm: boolean;
  sshUser?: string | null;
  sshPort?: number | null;
  meterEnabled: boolean;
  note?: string | null;
}

export interface PortalMembershipInput {
  deviceId: number;
  networkId: number;
  ip?: string | null;
  label?: string | null;
}

export interface PortalRelationInput {
  relationName: string;
  fromDeviceId: number;
  toDeviceId: number;
  fromPlaceholder?: string;
  toPlaceholder?: string;
}

export interface PortalRelationNameInput {
  name: string;
  color: string;
  fromLabel?: string | null;
  toLabel?: string | null;
}

export interface PortalServiceInput {
  deviceNetworkId: number;
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
];

export const PORTAL_DEVICE_CATEGORIES: PortalDeviceCategory[] = [
  "network",
  "physical",
  "vm",
  "service",
];

export const ACCENT_TONES: AccentTone[] = [
  "blue",
  "green",
  "orange",
  "violet",
  "slate",
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

export const STATUS_LABELS: Record<PortalStatus, string> = {
  up: "稼働中",
  down: "停止",
  maintenance: "メンテナンス",
};

export const DEVICE_CATEGORY_LABELS: Record<PortalDeviceCategory, string> = {
  network: "ネットワーク機器",
  physical: "物理マシン",
  vm: "VM",
  service: "サービス",
};

export const ACCENT_LABELS: Record<AccentTone, string> = {
  blue: "ブルー",
  green: "グリーン",
  orange: "オレンジ",
  violet: "バイオレット",
  slate: "スレート",
};

export const ICON_LABELS: Record<PortalIconKey, string> = {
  gitea: "Gitea",
  gatus: "Gatus",
  proxmox: "Proxmox",
  omv: "OpenMediaVault",
  server: "サーバー",
  database: "データベース",
  monitor: "監視",
  container: "コンテナ",
  globe: "インターネット",
};

export const GENERIC_ICON_LABELS: Record<PortalGenericIconKey, string> = {
  applications: "アプリケーション",
  bookmark: "ブックマーク",
  calendar: "カレンダー",
  camera: "カメラ",
  chart: "グラフ",
  chat: "チャット",
  cloud: "クラウド",
  code: "コード",
  download: "ダウンロード",
  folder: "フォルダ",
  home: "ホーム",
  key: "キー",
  lock: "ロック",
  mail: "メール",
  music: "音楽",
  printer: "プリンター",
  shield: "シールド",
  terminal: "ターミナル",
  upload: "アップロード",
  users: "ユーザー",
  video: "動画",
  gitea: "Gitea",
  gatus: "Gatus",
  proxmox: "Proxmox",
  omv: "OpenMediaVault",
  server: "サーバー",
  database: "データベース",
  monitor: "監視",
  container: "コンテナ",
  globe: "インターネット",
};
