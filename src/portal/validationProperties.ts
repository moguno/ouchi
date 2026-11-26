import type { PortalProperties, ValidationIssue } from "./types";
import {
  isRecord,
  MAX_PORTAL_TITLE_LENGTH,
  MAX_PROPERTY_KEY_LENGTH,
  MAX_PROPERTY_VALUE_BYTES,
  utf8ByteLength,
} from "./validationCore";

/**
 * Shared validation for device/service property maps. The REST boundary,
 * YAML import and GUI all use this function so their limits stay aligned.
 */
export function validatePropertiesPayload(
  value: unknown,
  path = "properties",
): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path, message: "プロパティは文字列マップで指定してください" }];
  }
  return validatePropertyEntries(Object.entries(value), path);
}

export function validatePropertyEntries(
  entries: Iterable<readonly [string, unknown]>,
  path = "properties",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const normalizedKeys = new Map<string, string>();
  for (const [rawKey, propertyValue] of entries) {
    const key = rawKey.trim();
    if (!key) {
      issues.push({
        path: `${path}.${rawKey}`,
        message: "プロパティキーは空白除去後に必須です",
      });
    } else if ([...key].length > MAX_PROPERTY_KEY_LENGTH) {
      issues.push({
        path: `${path}.${rawKey}`,
        message:
          `プロパティキーは${MAX_PROPERTY_KEY_LENGTH}文字以内で入力してください`,
      });
    }

    const previousKey = normalizedKeys.get(key);
    if (key && previousKey !== undefined) {
      issues.push({
        path: `${path}.${rawKey}`,
        message:
          `プロパティキー「${key}」が重複しています` +
          `（前後の空白を除去すると同じキー: ${previousKey}）`,
      });
    } else if (key) {
      normalizedKeys.set(key, rawKey);
    }

    if (typeof propertyValue !== "string") {
      issues.push({
        path: `${path}.${rawKey}`,
        message: "プロパティ値は文字列で入力してください",
      });
    } else if (utf8ByteLength(propertyValue) > MAX_PROPERTY_VALUE_BYTES) {
      issues.push({
        path: `${path}.${rawKey}`,
        message: "プロパティ値は64KiB以内で入力してください",
      });
    }
  }
  return issues;
}

/**
 * Return a detached, key-trimmed string map. Validation must run before using
 * this function; invalid/non-string entries are ignored defensively here.
 */
export function normalizeProperties(value: unknown): PortalProperties {
  if (!isRecord(value)) {
    return {};
  }
  const entries: Array<[string, string]> = [];
  for (const [rawKey, propertyValue] of Object.entries(value)) {
    const key = rawKey.trim();
    if (key && typeof propertyValue === "string") {
      entries.push([key, propertyValue]);
    }
  }
  return Object.fromEntries(entries);
}

export function validateSettingsTitle(title: string): ValidationIssue[] {
  const normalized = title.trim();
  const issues: ValidationIssue[] = [];
  if (!normalized) {
    issues.push({ path: "title", message: "ポータルタイトルを入力してください" });
  }
  if (/[\r\n]/.test(title)) {
    issues.push({
      path: "title",
      message: "ポータルタイトルに改行は使用できません",
    });
  }
  if ([...normalized].length > MAX_PORTAL_TITLE_LENGTH) {
    issues.push({
      path: "title",
      message: `ポータルタイトルは${MAX_PORTAL_TITLE_LENGTH}文字以内で入力してください`,
    });
  }
  return issues;
}

export function validateSettingsPayload(
  input: unknown,
): ValidationIssue[] {
  if (!isRecord(input) || typeof input.title !== "string") {
    return [
      {
        path: "title",
        message: "ポータルタイトルを文字列で入力してください",
      },
    ];
  }
  const issues = validateSettingsTitle(input.title);
  if (Object.hasOwn(input, "properties")) {
    issues.push(...validatePropertiesPayload(input.properties));
  }
  return issues;
}
