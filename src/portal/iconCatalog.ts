import {
  PORTAL_GENERIC_ICON_KEYS,
  PORTAL_ICON_KEYS,
  type PortalIconKind,
  type PortalIconReference,
} from "./types";

/**
 * Service icons come in exactly three flavours: the service's own
 * favicon, an explicit image URL, or unset (null), which renders one
 * bundled placeholder icon. Legacy references from earlier models are
 * normalized on read: `dashboard:slug` becomes its CDN image URL, and
 * bundled generic / preset references become unset.
 */
export const FAVICON_ICON_REFERENCE: PortalIconReference = "favicon";

const DASHBOARD_ICON_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg";

function isHttpImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isDashboardSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value);
}

export function faviconIconReference(): PortalIconReference {
  return FAVICON_ICON_REFERENCE;
}

export function urlIconReference(url: string): PortalIconReference {
  return `url:${url.trim()}`;
}

export function tryNormalizeIconReference(
  value: unknown,
): PortalIconReference | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.toLowerCase() === "favicon") {
    return FAVICON_ICON_REFERENCE;
  }
  if (isHttpImageUrl(normalized)) {
    return urlIconReference(normalized);
  }
  const separator = normalized.indexOf(":");
  if (separator <= 0) {
    return undefined;
  }
  const kind = normalized.slice(0, separator).toLowerCase();
  const id = normalized.slice(separator + 1).trim();
  if (kind === "url" && isHttpImageUrl(id)) {
    return urlIconReference(id);
  }
  if (kind === "dashboard" && isDashboardSlug(id)) {
    return urlIconReference(
      `${DASHBOARD_ICON_CDN_BASE}/${encodeURIComponent(id.toLowerCase())}.svg`,
    );
  }
  return undefined;
}

/** Bundled generic / preset references retired by the three-choice model. */
export function isLegacyGenericIconReference(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  const lower = normalized.toLowerCase();
  if (
    (PORTAL_GENERIC_ICON_KEYS as string[]).includes(lower) ||
    (PORTAL_ICON_KEYS as string[]).includes(lower)
  ) {
    return true;
  }
  const separator = normalized.indexOf(":");
  if (separator <= 0) {
    return false;
  }
  const kind = normalized.slice(0, separator).toLowerCase();
  return kind === "generic" || kind === "preset";
}

export function normalizeServiceIconReference(
  iconKey: unknown,
  legacyFaviconUrl?: unknown,
  fallback: PortalIconReference | null = null,
): PortalIconReference | null {
  if (iconKey === null) {
    return null;
  }
  const normalized = tryNormalizeIconReference(iconKey);
  if (normalized) {
    return normalized;
  }
  if (isLegacyGenericIconReference(iconKey)) {
    return null;
  }
  const legacyUrl = tryNormalizeIconReference(legacyFaviconUrl);
  if (legacyUrl && legacyUrl.startsWith("url:")) {
    return legacyUrl;
  }
  return fallback;
}

export function isIconReference(value: unknown): boolean {
  return tryNormalizeIconReference(value) !== undefined;
}

export function parseIconReference(value: unknown): {
  kind: PortalIconKind;
  id: string;
  reference: PortalIconReference | null;
} {
  const reference = normalizeServiceIconReference(value);
  if (reference === null) {
    return { kind: "unset", id: "", reference: null };
  }
  if (reference === FAVICON_ICON_REFERENCE) {
    return { kind: "favicon", id: "", reference };
  }
  return { kind: "url", id: reference.slice("url:".length), reference };
}

export function iconReferenceKind(value: unknown): PortalIconKind {
  return parseIconReference(value).kind;
}

export function iconReferenceId(value: unknown): string {
  return parseIconReference(value).id;
}

export function iconReferenceLabel(value: unknown): string {
  const parsed = parseIconReference(value);
  if (parsed.kind === "favicon") {
    return "favicon";
  }
  if (parsed.kind === "url") {
    return "URLアイコン";
  }
  return "未設定";
}
