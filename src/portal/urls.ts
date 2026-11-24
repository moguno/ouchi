import type {
  PortalInterface,
  PortalService,
} from "./types";

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+/, "")}`;
}

export function buildServiceUrl(
  service: Pick<
    PortalService,
    "scheme" | "port" | "topPath" | "serviceUrl"
  >,
  iface: Pick<PortalInterface, "ip">,
): string | null {
  const explicitUrl = service.serviceUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }
  const ip = iface.ip.trim();
  if (!ip) {
    return null;
  }
  return `${service.scheme}://${ip}:${service.port}${normalizePath(
    service.topPath,
  )}`;
}

export function buildMonitorUrl(
  service: Pick<
    PortalService,
    "scheme" | "port" | "topPath" | "monitorPath" | "serviceUrl"
  >,
  iface: Pick<PortalInterface, "ip">,
): string | null {
  const explicitUrl = service.serviceUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }
  const ip = iface.ip.trim();
  if (!ip) {
    return null;
  }
  const monitorPath = service.monitorPath.trim() || service.topPath;
  return `${service.scheme}://${ip}:${service.port}${normalizePath(
    monitorPath,
  )}`;
}
