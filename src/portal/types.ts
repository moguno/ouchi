export type PortalStatus = "up" | "down" | "maintenance";

export type AccentTone = "blue" | "green" | "orange" | "violet" | "slate";

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

export interface PortalDevice {
  id: string;
  networkId: string;
  name: string;
  ip: string;
  isVm: boolean;
}

export interface PortalService {
  id: string;
  deviceId: string;
  name: string;
  subtitle: string;
  url: string;
  iconKey: PortalIconKey;
  status: PortalStatus;
}

export interface PortalDataV1 {
  version: 1;
  networks: PortalNetwork[];
  devices: PortalDevice[];
  services: PortalService[];
}

export interface OuchiPortalProps {
  data?: PortalDataV1;
  storageKey?: string;
  onDataChange?: (data: PortalDataV1) => void;
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
