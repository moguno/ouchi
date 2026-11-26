import {
  PORTAL_DEVICE_CATEGORIES,
  PORTAL_SERVICE_SCHEMES,
  PORTAL_STATUSES,
  type PortalDeviceCategory,
  type PortalServiceProtocol,
  type PortalServiceScheme,
  type PortalStatus,
  type ValidationIssue,
} from "./types";
import { isIconReference } from "./iconCatalog";

export const DEFAULT_PORTAL_TITLE = "あなたのホームラボ";
export const MAX_PORTAL_TITLE_LENGTH = 100;
export const MAX_RELATION_LABEL_LENGTH = 100;
export const MAX_PROPERTY_KEY_LENGTH = 128;
export const MAX_PROPERTY_VALUE_BYTES = 64 * 1024;
export const PLAINTEXT_SECRET_WARNING =
  "平文の秘密情報は入力しないこと。必要な場合は SOPS などで暗号化した文字列を入れること";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function isIconKey(value: unknown): boolean {
  return value === undefined || value === null || isIconReference(value);
}

export function isStatus(value: unknown): value is PortalStatus {
  return (
    typeof value === "string" &&
    PORTAL_STATUSES.includes(value as PortalStatus)
  );
}

export function isDeviceCategory(
  value: unknown,
): value is PortalDeviceCategory {
  return (
    typeof value === "string" &&
    PORTAL_DEVICE_CATEGORIES.includes(value as PortalDeviceCategory)
  );
}

export function isScheme(value: unknown): value is PortalServiceScheme {
  return (
    typeof value === "string" &&
    PORTAL_SERVICE_SCHEMES.includes(value as PortalServiceScheme)
  );
}

export function isPort(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 65_535
  );
}

export function isPercent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

export function isProtocol(value: unknown): value is PortalServiceProtocol {
  return value === "tcp" || value === "udp";
}

export function relationPortIssues(
  port: unknown,
  protocol: unknown,
  portPath: string,
  protocolPath: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasPort = port !== undefined && port !== null;
  const hasProtocol = protocol !== undefined && protocol !== null;
  if (hasPort && !isPort(port)) {
    issues.push({ path: portPath, message: "ポート番号が不正です" });
  }
  if (hasProtocol && !isProtocol(protocol)) {
    issues.push({ path: protocolPath, message: "プロトコルが不正です" });
  }
  if (hasPort !== hasProtocol) {
    issues.push({
      path: hasPort ? protocolPath : portPath,
      message: "ポートとプロトコルはセットで指定してください",
    });
  }
  return issues;
}

export function issuesToRecord(
  issues: ValidationIssue[],
): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [issue.path, issue.message]));
}

export function generateId(prefix: string): string {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomId}`;
}
