import dashboardIconIndexJson from "../data/dashboard-icons-index.json";
import {
  GENERIC_ICON_LABELS,
  PORTAL_GENERIC_ICON_KEYS,
  PORTAL_ICON_KEYS,
  type PortalGenericIconKey,
  type PortalIconKey,
  type PortalIconKind,
  type PortalIconReference,
} from "./types";

export interface DashboardIconEntry {
  slug: string;
  name: string;
}

export interface DashboardIconIndex {
  format: string;
  source: string;
  metadataApi: string;
  generatedAt: string;
  packageVersion: string;
  snapshotMode: "jsdelivr" | "offline-bootstrap";
  complete: boolean;
  icons: DashboardIconEntry[];
}

export const DASHBOARD_ICON_INDEX =
  dashboardIconIndexJson as DashboardIconIndex;
export const DEFAULT_ICON_REFERENCE: PortalIconReference =
  "generic:applications";
export const FAVICON_ICON_REFERENCE: PortalIconReference = "favicon";
export const DASHBOARD_ICON_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg";

const dashboardByName = new Map(
  DASHBOARD_ICON_INDEX.icons.map((icon) => [icon.slug, icon]),
);

const featuredDashboardSlugs = [
  "authentik",
  "adguard-home",
  "cloudflare",
  "docker",
  "gitea",
  "github",
  "gitlab",
  "grafana",
  "home-assistant",
  "immich",
  "jellyfin",
  "nextcloud",
  "nginx-proxy-manager",
  "node-red",
  "paperless-ngx",
  "pihole",
  "plex",
  "portainer",
  "proxmox",
  "sonarr",
  "tailscale",
  "traefik",
  "uptime-kuma",
  "vaultwarden",
];

const featuredDashboardRank = new Map(
  featuredDashboardSlugs.map((slug, index) => [slug, index]),
);

function isHttpImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPresetIconKey(value: string): value is PortalIconKey {
  return PORTAL_ICON_KEYS.includes(value as PortalIconKey);
}

export function isGenericIconKey(
  value: string,
): value is PortalGenericIconKey {
  return PORTAL_GENERIC_ICON_KEYS.includes(
    value as PortalGenericIconKey,
  );
}

export function isDashboardSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(value);
}

export function presetIconReference(
  key: PortalIconKey,
): PortalIconReference {
  return genericIconReference(key);
}

export function genericIconReference(
  key: PortalGenericIconKey,
): PortalIconReference {
  return `generic:${key}`;
}

export function faviconIconReference(): PortalIconReference {
  return FAVICON_ICON_REFERENCE;
}

export function urlIconReference(url: string): PortalIconReference {
  return `url:${url.trim()}`;
}

export function dashboardIconPreviewUrl(slug: string): string {
  return `${DASHBOARD_ICON_CDN_BASE}/${encodeURIComponent(slug)}.svg`;
}

export function dashboardIconReference(
  slug: string,
): PortalIconReference {
  return urlIconReference(
    dashboardIconPreviewUrl(slug.toLowerCase()),
  );
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

  const lower = normalized.toLowerCase();
  if (isGenericIconKey(lower)) {
    return genericIconReference(lower);
  }
  if (lower === "favicon") {
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
  const genericId = id.toLowerCase();
  if ((kind === "preset" || kind === "generic") &&
      isGenericIconKey(genericId)) {
    return genericIconReference(genericId);
  }
  if (kind === "dashboard" && isDashboardSlug(id)) {
    return dashboardIconReference(id);
  }
  if (kind === "url" && isHttpImageUrl(id)) {
    return urlIconReference(id);
  }
  return undefined;
}

export function parseIconReference(value: unknown): {
  kind: PortalIconKind;
  id: string;
  reference: PortalIconReference;
} {
  const reference =
    tryNormalizeIconReference(value) ?? DEFAULT_ICON_REFERENCE;
  if (reference === FAVICON_ICON_REFERENCE) {
    return { kind: "favicon", id: "", reference };
  }
  const separator = reference.indexOf(":");
  const kind = reference.slice(0, separator) as PortalIconKind;
  return {
    kind,
    id: reference.slice(separator + 1),
    reference,
  };
}

export function normalizeIconReference(
  value: unknown,
  fallback: PortalIconReference = DEFAULT_ICON_REFERENCE,
): PortalIconReference {
  return tryNormalizeIconReference(value) ?? fallback;
}

export function normalizeServiceIconReference(
  iconKey: unknown,
  legacyFaviconUrl?: unknown,
  fallback: PortalIconReference = DEFAULT_ICON_REFERENCE,
): PortalIconReference {
  const normalized = tryNormalizeIconReference(iconKey);
  if (normalized) {
    return normalized;
  }
  const legacyUrl = tryNormalizeIconReference(legacyFaviconUrl);
  if (legacyUrl && iconReferenceKind(legacyUrl) === "url") {
    return legacyUrl;
  }
  return fallback;
}

export function isIconReference(value: unknown): boolean {
  return tryNormalizeIconReference(value) !== undefined;
}

export function iconReferenceKind(
  value: unknown,
): PortalIconKind {
  return parseIconReference(value).kind;
}

export function iconReferenceId(value: unknown): string {
  return parseIconReference(value).id;
}

export function iconReferenceLabel(value: unknown): string {
  const parsed = parseIconReference(value);
  if (parsed.kind === "generic") {
    return GENERIC_ICON_LABELS[parsed.id as PortalGenericIconKey];
  }
  if (parsed.kind === "favicon") {
    return "favicon";
  }
  const dashboardPrefix = `${DASHBOARD_ICON_CDN_BASE}/`;
  if (parsed.id.startsWith(dashboardPrefix)) {
    const fileName = parsed.id.slice(dashboardPrefix.length);
    if (fileName.endsWith(".svg")) {
      try {
        const slug = decodeURIComponent(fileName.slice(0, -4));
        const dashboardName = dashboardByName.get(slug)?.name;
        if (dashboardName) {
          return dashboardName;
        }
      } catch {
        // Fall through to the generic URL label for malformed escapes.
      }
    }
  }
  return "URLアイコン";
}

export interface PickerIconOption {
  reference: PortalIconReference;
  kind: PortalIconKind;
  id: string;
  label: string;
}

export function builtInIconOptions(): PickerIconOption[] {
  return PORTAL_GENERIC_ICON_KEYS.map((key) => ({
    reference: genericIconReference(key),
    kind: "generic" as const,
    id: key,
    label: GENERIC_ICON_LABELS[key],
  }));
}

function searchable(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").trim();
}

function dashboardScore(icon: DashboardIconEntry, terms: string[]): number {
  const slug = searchable(icon.slug);
  const name = searchable(icon.name);
  const haystack = `${slug} ${name}`;
  if (!terms.every((term) => haystack.includes(term))) {
    return Number.NEGATIVE_INFINITY;
  }
  const query = terms.join(" ");
  let score = featuredDashboardRank.get(icon.slug) ?? 10_000;
  if (slug === query || name === query) {
    score -= 5_000;
  } else if (slug.startsWith(query) || name.startsWith(query)) {
    score -= 2_000;
  } else if (` ${name} ${slug} `.includes(` ${query}`)) {
    score -= 500;
  }
  return score;
}

export function searchBuiltInIcons(
  query: string,
  limit = 40,
): PickerIconOption[] {
  const terms = searchable(query).split(/\s+/).filter(Boolean);
  const options = builtInIconOptions();
  if (terms.length === 0) {
    return options;
  }
  return options
    .filter((option) => {
      const haystack = searchable(
        `${option.label} ${option.id} generic`,
      );
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

export function searchDashboardIcons(
  query: string,
  limit = 40,
): DashboardIconEntry[] {
  const terms = searchable(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [...DASHBOARD_ICON_INDEX.icons]
      .sort((left, right) => {
        const leftRank =
          featuredDashboardRank.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
        const rightRank =
          featuredDashboardRank.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
        return (
          leftRank - rightRank ||
          left.name.localeCompare(right.name, "ja")
        );
      })
      .slice(0, limit);
  }

  return DASHBOARD_ICON_INDEX.icons
    .map((icon) => ({ icon, score: dashboardScore(icon, terms) }))
    .filter((item) => Number.isFinite(item.score))
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.icon.name.localeCompare(right.icon.name, "ja"),
    )
    .slice(0, limit)
    .map((item) => item.icon);
}

export function dashboardIconCount(): number {
  return DASHBOARD_ICON_INDEX.icons.length;
}

export function dashboardIconName(slug: string): string | undefined {
  return dashboardByName.get(slug.toLowerCase())?.name;
}
