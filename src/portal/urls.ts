import type {
  PortalDeviceNetwork,
  PortalService,
} from "./types";

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return `/${trimmed.replace(/^\/+/, "")}`;
}

function formatPort(
  scheme: PortalService["scheme"],
  port: number,
): string {
  if (
    (scheme === "http" && port === 80) ||
    (scheme === "https" && port === 443)
  ) {
    return "";
  }
  return `:${port}`;
}

export function buildServiceUrl(
  service: Pick<
    PortalService,
    "scheme" | "port" | "topPath" | "serviceUrl"
  >,
  deviceNetwork: Pick<PortalDeviceNetwork, "ip">,
): string {
  const explicitUrl = service.serviceUrl?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }
  return `${service.scheme}://${deviceNetwork.ip}${formatPort(
    service.scheme,
    service.port,
  )}${normalizePath(service.topPath)}`;
}

export function buildMonitorUrl(
  service: Pick<
    PortalService,
    "scheme" | "port" | "monitorPath"
  >,
  deviceNetwork: Pick<PortalDeviceNetwork, "ip">,
): string {
  return `${service.scheme}://${deviceNetwork.ip}${formatPort(
    service.scheme,
    service.port,
  )}${normalizePath(service.monitorPath)}`;
}
