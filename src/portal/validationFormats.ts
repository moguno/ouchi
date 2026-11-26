import type { PortalLineEndpointShape, ValidationIssue } from "./types";
import { isNonEmptyString, MAX_RELATION_LABEL_LENGTH } from "./validationCore";

interface Ipv4Parts {
  octets: [number, number, number, number];
  value: number;
}

export function parseIpv4(value: string): Ipv4Parts | undefined {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    return undefined;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return undefined;
    }

    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return undefined;
    }
    octets.push(octet);
  }

  const typedOctets = octets as [number, number, number, number];
  const valueAsNumber =
    (((typedOctets[0] << 24) >>> 0) +
      (typedOctets[1] << 16) +
      (typedOctets[2] << 8) +
      typedOctets[3]) >>>
    0;

  return { octets: typedOctets, value: valueAsNumber };
}

export function isIpv4(value: string): boolean {
  return parseIpv4(value) !== undefined;
}

export function parseCidr(
  value: string,
): { address: Ipv4Parts; prefix: number; networkValue: number } | undefined {
  const [addressText, prefixText, ...rest] = value.trim().split("/");
  if (rest.length > 0 || !addressText || !prefixText) {
    return undefined;
  }

  if (!/^\d{1,2}$/.test(prefixText)) {
    return undefined;
  }

  const prefix = Number(prefixText);
  const address = parseIpv4(addressText);
  if (!address || prefix < 0 || prefix > 32) {
    return undefined;
  }

  const mask =
    prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const networkValue = (address.value & mask) >>> 0;

  return { address, prefix, networkValue };
}

export function isCidr(value: string): boolean {
  return parseCidr(value) !== undefined;
}

export function isIpWithinCidr(ip: string, cidr: string): boolean {
  const ipAddress = parseIpv4(ip);
  const parsedCidr = parseCidr(cidr);
  if (!ipAddress || !parsedCidr) {
    return false;
  }

  const mask =
    parsedCidr.prefix === 0
      ? 0
      : (0xffffffff << (32 - parsedCidr.prefix)) >>> 0;
  return ((ipAddress.value & mask) >>> 0) === parsedCidr.networkValue;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isHttpPath(value: string): boolean {
  return value.trim().startsWith("/");
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export const LINE_ENDPOINT_SHAPES = [
  "none",
  "arrow",
  "circle",
  "square",
  "diamond",
] as const;

export function isLineEndpointShape(
  value: unknown,
): value is PortalLineEndpointShape {
  return (
    typeof value === "string" &&
    (LINE_ENDPOINT_SHAPES as readonly string[]).includes(value)
  );
}

export function lineEndpointShapeIssue(
  value: unknown,
  path: string,
  label: string,
): ValidationIssue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return isLineEndpointShape(value)
    ? undefined
    : { path, message: `${label}が不正です` };
}

export function relationColorIssue(
  value: unknown,
  path: string,
): ValidationIssue | undefined {
  if (!isNonEmptyString(value)) {
    return { path, message: "関係色は必須です" };
  }
  if ([...value.trim()].length > 100) {
    return { path, message: "関係色は100文字以内で入力してください" };
  }
  return undefined;
}

export function relationLabelIssues(
  input: Record<string, unknown>,
  path = "",
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of ["fromLabel", "toLabel"] as const) {
    const value = input[field];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "string") {
      issues.push({
        path: `${path}${field}`,
        message:
          field === "fromLabel"
            ? "始点ラベルが不正です"
            : "終点ラベルが不正です",
      });
    } else if ([...value.trim()].length > MAX_RELATION_LABEL_LENGTH) {
      issues.push({
        path: `${path}${field}`,
        message:
          `ラベルは${MAX_RELATION_LABEL_LENGTH}文字以内で` +
          "入力してください",
      });
    }
  }
  return issues;
}

export function accentColorIssue(
  value: unknown,
  path: string,
): ValidationIssue | undefined {
  if (!isNonEmptyString(value)) {
    return { path, message: "アクセント色は必須です" };
  }
  if ([...value.trim()].length > 100) {
    return { path, message: "アクセント色は100文字以内で入力してください" };
  }
  return undefined;
}
