export type PortalStatus = "up" | "down" | "maintenance";

export type AccentTone = "blue" | "green" | "orange" | "violet" | "slate";

export type PortalServiceScheme = "http" | "https";

export type PortalIconKey =
  | "gitea"
  | "gatus"
  | "proxmox"
  | "omv"
  | "server"
  | "database"
  | "monitor"
  | "container"
  | "globe";

export interface PortalNetwork {
  id: string;
  name: string;
  cidr?: string;
  accent: AccentTone;
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
  isVm: boolean;
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

export interface PortalRelation {
  id: string;
  fromDeviceId: string;
  toDeviceId: string;
  fromLabel: string;
  toLabel: string;
  color: string;
}

export interface PortalService {
  id: string;
  deviceNetworkId: string;
  name: string;
  subtitle: string;
  scheme: PortalServiceScheme;
  port: number;
  topPath: string;
  monitorPath: string;
  serviceUrl?: string;
  iconKey: PortalIconKey;
  status: PortalStatus;
}

export interface PortalDataV2 {
  version: 2;
  networks: PortalNetwork[];
  devices: PortalDevice[];
  deviceNetworks: PortalDeviceNetwork[];
  relations: PortalRelation[];
  services: PortalService[];
}

export interface OuchiPortalProps {
  data?: PortalDataV2;
  storageKey?: string;
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

export const PORTAL_STATUSES: PortalStatus[] = [
  "up",
  "down",
  "maintenance",
];

export const PORTAL_SERVICE_SCHEMES: PortalServiceScheme[] = [
  "http",
  "https",
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

export const STATUS_LABELS: Record<PortalStatus, string> = {
  up: "稼働中",
  down: "停止",
  maintenance: "メンテナンス",
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
