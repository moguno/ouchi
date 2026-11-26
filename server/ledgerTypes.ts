import type {
  PortalDeviceInput,
  PortalLineEndpointShape,
  PortalProperties,
  PortalServiceInput,
  ValidationIssue,
} from "../src/portal/types";

export const LEDGER_FORMAT = "ouchi-ledger/13";
export const V12_LEDGER_FORMAT = "ouchi-ledger/12";
export const V11_LEDGER_FORMAT = "ouchi-ledger/11";
export const V10_LEDGER_FORMAT = "ouchi-ledger/10";
export const V9_LEDGER_FORMAT = "ouchi-ledger/9";
export const V8_LEDGER_FORMAT = "ouchi-ledger/8";
export const V7_LEDGER_FORMAT = "ouchi-ledger/7";
export const V6_LEDGER_FORMAT = "ouchi-ledger/6";
export const V5_LEDGER_FORMAT = "ouchi-ledger/5";
export const V4_LEDGER_FORMAT = "ouchi-ledger/4";
export const PREVIOUS_LEDGER_FORMAT = "ouchi-ledger/3";
export const V2_LEDGER_FORMAT = "ouchi-ledger/2";
export const LEGACY_LEDGER_FORMAT = "ouchi-ledger/1";

export interface LedgerInterface {
  name: string;
  network: string | null;
  ip: string | null;
  mac: string | null;
}

export interface LedgerDevice {
  hostname: string;
  petname: string | null;
  category: PortalDeviceInput["category"];
  sshUser: string | null;
  sshPort: number | null;
  meterEnabled: boolean;
  note: string | null;
  properties: PortalProperties;
  interfaces: LedgerInterface[];
}

export interface LedgerNetwork {
  name: string;
  cidr: string | null;
  accent: string;
  note: string | null;
  properties: PortalProperties;
}

export type LedgerRelationEndpoint =
  | { device: string; interface: string }
  | { service: string };

export interface LedgerRelation {
  from: LedgerRelationEndpoint;
  to: LedgerRelationEndpoint;
  relationName: string;
  fromLabel?: string;
  toLabel?: string;
  port?: number;
  protocol?: PortalServiceInput["protocol"];
  properties: PortalProperties;
}

export interface LedgerRelationName {
  name: string;
  color: string;
  lineStart?: PortalLineEndpointShape;
  lineEnd?: PortalLineEndpointShape;
}

export interface LedgerService {
  subdomain: string;
  device: string;
  interface: string;
  petname: string | null;
  description: string | null;
  port: number;
  protocol: PortalServiceInput["protocol"];
  scheme: PortalServiceInput["scheme"];
  topPath: string | null;
  monitorPath: string | null;
  serviceUrl: string | null;
  iconKey: string | null;
  properties: PortalProperties;
  enabled: boolean;
}

export interface LedgerSshKey {
  owner: string;
  purpose: string;
  keyType: string;
  publicKey: string;
  fingerprint: string | null;
  expiresAt: string | null;
  enabled: boolean;
  note: string | null;
}

export interface LedgerDeviceKey {
  device: string;
  publicKey: string;
}

export interface LedgerDocument {
  format: typeof LEDGER_FORMAT;
  exportedAt: string;
  settings: {
    domain: string;
    title: string;
    properties: PortalProperties;
  };
  networks: LedgerNetwork[];
  devices: LedgerDevice[];
  relationNames: LedgerRelationName[];
  relations: LedgerRelation[];
  services: LedgerService[];
  sshKeys: LedgerSshKey[];
  deviceKeys: LedgerDeviceKey[];
}

export interface LedgerImportCounts {
  networks: number;
  devices: number;
  interfaces: number;
  relationNames: number;
  relations: number;
  services: number;
  sshKeys: number;
  deviceKeys: number;
}

export class LedgerValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("YAMLの検証に失敗しました");
    this.name = "LedgerValidationError";
    this.issues = issues;
  }
}

export type RecordValue = Record<string, unknown>;
