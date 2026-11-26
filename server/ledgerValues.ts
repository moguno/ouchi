import { parse } from "yaml";
import type { PortalProperties, ValidationIssue } from "../src/portal/types";
import { normalizeProperties } from "../src/portal/validation";
import { LedgerValidationError } from "./ledgerTypes";
import type { RecordValue } from "./ledgerTypes";

export function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? "" : normalized;
}

export function nullablePetname(value: unknown): string | null {
  const normalized = nullableText(value);
  return normalized || null;
}

export function parseStoredProperties(value: string | null): PortalProperties {
  if (!value) {
    return {};
  }
  try {
    return normalizeProperties(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function uniqueMap<T>(
  items: T[],
  keyOf: (item: T) => string,
  pathOf: (item: T) => string,
  collectionLabel: string,
  issues: ValidationIssue[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) {
      continue;
    }
    if (result.has(key)) {
      issues.push({
        path: pathOf(item),
        message: `${collectionLabel}「${key}」が重複しています`,
      });
      continue;
    }
    result.set(key, item);
  }
  return result;
}

export function parseYamlRoot(text: string): RecordValue {
  if (text.trim() === "") {
    throw new LedgerValidationError([
      { path: "root", message: "YAMLが空です" },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = parse(text, {
      maxAliasCount: 100,
      uniqueKeys: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new LedgerValidationError([
      {
        path: "root",
        message: `YAMLを解析できません: ${message}`,
      },
    ]);
  }

  if (!isRecord(parsed)) {
    throw new LedgerValidationError([
      {
        path: "root",
        message: "YAMLのルートはオブジェクトである必要があります",
      },
    ]);
  }
  return parsed;
}
