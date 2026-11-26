import type { ValidationIssue } from "./types";
import {
  isDeviceCategory,
  isNonEmptyString,
  isPort,
  isProtocol,
  isRecord,
  isScheme,
  relationPortIssues,
} from "./validationCore";
import {
  accentColorIssue,
  isCidr,
  isHttpPath,
  isHttpUrl,
  isIpv4,
  lineEndpointShapeIssue,
  relationColorIssue,
  relationLabelIssues,
} from "./validationFormats";
import { validatePropertiesPayload } from "./validationProperties";

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateNetworkPayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "ネットワークの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: "name", message: "ネットワーク名は必須です" });
  }
  if (
    input.cidr !== undefined &&
    input.cidr !== null &&
    input.cidr !== "" &&
    (!isNonEmptyString(input.cidr) || !isCidr(input.cidr))
  ) {
    issues.push({ path: "cidr", message: "CIDRの形式が不正です" });
  }
  const accentIssue = accentColorIssue(input.accent, "accent");
  if (accentIssue) {
    issues.push(accentIssue);
  }
  if (input.note !== undefined && !isNullableString(input.note)) {
    issues.push({ path: "note", message: "メモが不正です" });
  }
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}

export function validateDevicePayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "デバイスの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.hostname)) {
    issues.push({ path: "hostname", message: "ホスト名は必須です" });
  }
  if (input.petname !== undefined && !isNullableString(input.petname)) {
    issues.push({ path: "petname", message: "名前が不正です" });
  }
  if (!isDeviceCategory(input.category)) {
    issues.push({ path: "category", message: "デバイスカテゴリーが不正です" });
  }
  if (input.sshUser !== undefined && !isNullableString(input.sshUser)) {
    issues.push({ path: "sshUser", message: "SSHユーザーが不正です" });
  }
  if (
    input.sshPort !== undefined &&
    input.sshPort !== null &&
    !isPort(input.sshPort)
  ) {
    issues.push({ path: "sshPort", message: "SSHポートが不正です" });
  }
  if (typeof input.meterEnabled !== "boolean") {
    issues.push({ path: "meterEnabled", message: "メーター設定が不正です" });
  }
  if (input.note !== undefined && !isNullableString(input.note)) {
    issues.push({ path: "note", message: "メモが不正です" });
  }
  if (input.category === "service" && input.meterEnabled === true) {
    issues.push({
      path: "category",
      message: "サービスカテゴリーはメーターを有効にできません",
    });
  }
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}

export function validateInterfacePayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "インターフェースの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isPositiveInteger(input.deviceId)) {
    issues.push({ path: "deviceId", message: "デバイスIDが不正です" });
  }
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: "name", message: "インターフェース名は必須です" });
  }
  if (
    input.networkId !== undefined &&
    input.networkId !== null &&
    !isPositiveInteger(input.networkId)
  ) {
    issues.push({ path: "networkId", message: "ネットワークIDが不正です" });
  }
  if (
    input.ip !== undefined &&
    input.ip !== null &&
    input.ip !== "" &&
    (!isNonEmptyString(input.ip) || !isIpv4(input.ip))
  ) {
    issues.push({ path: "ip", message: "IPv4アドレスの形式が不正です" });
  }
  if (input.mac !== undefined && !isNullableString(input.mac)) {
    issues.push({ path: "mac", message: "MACアドレスが不正です" });
  }
  return issues;
}

export function validateRelationPayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "関係の形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  const endpoint = (side: "from" | "to", sideLabel: string) => {
    const interfaceId = input[`${side}InterfaceId`];
    const serviceId = input[`${side}ServiceId`];
    const hasInterface = interfaceId !== undefined && interfaceId !== null;
    const hasService = serviceId !== undefined && serviceId !== null;
    if (hasInterface && !isPositiveInteger(interfaceId)) {
      issues.push({
        path: `${side}InterfaceId`,
        message: `${sideLabel}インターフェースIDが不正です`,
      });
    }
    if (hasService && !isPositiveInteger(serviceId)) {
      issues.push({
        path: `${side}ServiceId`,
        message: `${sideLabel}サービスIDが不正です`,
      });
    }
    if (hasInterface && hasService) {
      issues.push({
        path: `${side}ServiceId`,
        message: `${sideLabel}の端点はインターフェースかサービスのどちらか一方です`,
      });
    }
    if (!hasInterface && !hasService) {
      issues.push({
        path: `${side}InterfaceId`,
        message: `${sideLabel}の端点（インターフェースかサービス）を指定してください`,
      });
    }
    return {
      interfaceId: isPositiveInteger(interfaceId) ? interfaceId : null,
      serviceId: isPositiveInteger(serviceId) ? serviceId : null,
    };
  };
  const from = endpoint("from", "関係元");
  const to = endpoint("to", "関係先");
  if (
    from.interfaceId !== null &&
    from.interfaceId === to.interfaceId
  ) {
    issues.push({
      path: "toInterfaceId",
      message: "同じインターフェース自身へ関係は定義できません",
    });
  }
  if (from.serviceId !== null && from.serviceId === to.serviceId) {
    issues.push({
      path: "toServiceId",
      message: "同じサービス自身へ関係は定義できません",
    });
  }
  if (!isNonEmptyString(input.relationName)) {
    issues.push({ path: "relationName", message: "関係名は必須です" });
  }
  issues.push(...relationLabelIssues(input));
  issues.push(
    ...relationPortIssues(input.port, input.protocol, "port", "protocol"),
  );
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}

export function validateRelationNamePayload(
  input: unknown,
): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "関係名の形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isNonEmptyString(input.name)) {
    issues.push({ path: "name", message: "関係名は必須です" });
  }
  const colorIssue = relationColorIssue(input.color, "color");
  if (colorIssue) {
    issues.push(colorIssue);
  }
  const lineStartIssue = lineEndpointShapeIssue(
    input.lineStart,
    "lineStart",
    "始点の形",
  );
  if (lineStartIssue) {
    issues.push(lineStartIssue);
  }
  const lineEndIssue = lineEndpointShapeIssue(
    input.lineEnd,
    "lineEnd",
    "終点の形",
  );
  if (lineEndIssue) {
    issues.push(lineEndIssue);
  }
  return issues;
}

export function validateServicePayload(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [{ path: "root", message: "サービスの形式が不正です" }];
  }
  const issues: ValidationIssue[] = [];
  if (!isPositiveInteger(input.interfaceId)) {
    issues.push({
      path: "interfaceId",
      message: "インターフェースIDが不正です",
    });
  }
  if (!isNonEmptyString(input.subdomain)) {
    issues.push({ path: "subdomain", message: "サブドメインは必須です" });
  } else if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(input.subdomain.trim())
  ) {
    issues.push({
      path: "subdomain",
      message: "サブドメインは英数字とハイフンで入力してください",
    });
  }
  for (const field of ["petname", "description", "iconKey"] as const) {
    if (input[field] !== undefined && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}が不正です` });
    }
  }
  for (const field of ["topPath", "monitorPath", "serviceUrl"] as const) {
    if (input[field] !== undefined && !isNullableString(input[field])) {
      issues.push({ path: field, message: `${field}が不正です` });
    }
  }
  if (!isPort(input.port)) {
    issues.push({ path: "port", message: "ポートは1〜65535で入力してください" });
  }
  if (!isProtocol(input.protocol)) {
    issues.push({ path: "protocol", message: "プロトコルが不正です" });
  }
  if (!isScheme(input.scheme)) {
    issues.push({ path: "scheme", message: "スキームが不正です" });
  }
  for (const field of ["topPath", "monitorPath"] as const) {
    const value = input[field];
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !isHttpPath(value)
    ) {
      issues.push({ path: field, message: `${field}は / から入力してください` });
    }
  }
  if (
    typeof input.serviceUrl === "string" &&
    input.serviceUrl.trim() !== "" &&
    !isHttpUrl(input.serviceUrl)
  ) {
    issues.push({
      path: "serviceUrl",
      message: "サービスURLはHTTPまたはHTTPSで入力してください",
    });
  }
  if (typeof input.enabled !== "boolean") {
    issues.push({ path: "enabled", message: "有効フラグが不正です" });
  }
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}
