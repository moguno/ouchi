import { useEffect, useState } from "react";
import { parseIconReference } from "./iconCatalog";
import { GenericServiceMark } from "./genericIcons";
import type {
  PortalGenericIconKey,
  PortalIconReference,
} from "./types";

interface IconProps {
  size?: number;
  className?: string;
}

function SvgBase({
  children,
  size = 24,
  className,
  viewBox = "0 0 24 24",
}: IconProps & {
  children: React.ReactNode;
  viewBox?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox={viewBox}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor" />
      <rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor" />
      <rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor" />
      <rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor" />
    </SvgBase>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="M8 6h13M8 12h13M8 18h13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <circle cx="3.5" cy="6" r="1.5" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1.5" fill="currentColor" />
    </SvgBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="M4 7h10M18 7h2M4 17h2M10 17h10M4 12h4M12 12h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="16" cy="7" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="17" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
    </SvgBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" />
    </SvgBase>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="M5 7v5h5M6.2 16.5A7 7 0 1 0 5 8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </SvgBase>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgBase>
  );
}

function GiteaMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <path
        d="M15 15h19v9a10 10 0 0 1-10 10h-1a10 10 0 0 1-8-4"
        fill="#fff"
        stroke="#609926"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.2"
      />
      <path
        d="M34 19h3a4 4 0 0 1 0 8h-3M16 18V9"
        fill="none"
        stroke="#609926"
        strokeLinecap="round"
        strokeWidth="3.2"
      />
      <circle cx="16" cy="8" r="2" fill="#609926" />
      <path
        d="m21 21 4-3 4 3-4 3-4-3Zm0 6 4-3 4 3-4 3-4-3Z"
        fill="#609926"
      />
    </svg>
  );
}

function GatusMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <path
        d="m25 7 3 3 4-1 2 4 4 1v4l3 3-2 4 1 4-4 2-1 4h-4l-3 3-4-2-4 1-2-4-4-1v-4l-3-3 2-4-1-4 4-2 1-4h4l3-3 4 2Z"
        fill="#4c9e45"
      />
      <circle cx="24" cy="24" r="9" fill="#fff" />
      <path
        d="M24 18v12M18 24h12"
        stroke="#4c9e45"
        strokeLinecap="round"
        strokeWidth="4"
      />
    </svg>
  );
}

function ProxmoxMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <path
        d="M11 10 37 36M37 10 11 36"
        stroke="#2e3037"
        strokeLinecap="round"
        strokeWidth="9"
      />
      <path
        d="m11 10 8 2-6 6-2-8Zm26 0-8 2 6 6 2-8ZM11 36l8-2-6-6-2 8Zm26 0-8-2 6-6 2 8Z"
        fill="#e57000"
      />
    </svg>
  );
}

function OmvMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <rect x="8" y="6" width="32" height="36" rx="4" fill="#6c95ce" />
      <path
        d="M14 14h20M14 22h20M14 30h20M14 38h20"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="18" cy="14" r="1.8" fill="#fff" />
      <circle cx="18" cy="22" r="1.8" fill="#fff" />
      <circle cx="18" cy="30" r="1.8" fill="#fff" />
    </svg>
  );
}

function faviconSource(serviceUrl: string | undefined): string | undefined {
  if (!serviceUrl?.trim()) {
    return undefined;
  }
  try {
    const url = new URL(serviceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return `${url.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

export function ServiceIcon({
  iconKey,
  size = 58,
  allowRemoteAssets = true,
  serviceUrl,
}: {
  iconKey: PortalIconReference;
  size?: number;
  allowRemoteAssets?: boolean;
  serviceUrl?: string;
}) {
  const parsed = parseIconReference(iconKey);
  const source =
    parsed.kind === "url"
      ? parsed.id
      : parsed.kind === "favicon"
        ? faviconSource(serviceUrl)
        : undefined;
  const remoteAllowed = allowRemoteAssets && Boolean(source);
  let mark: React.ReactNode;
  if (parsed.kind === "generic") {
    mark = (
      <GenericServiceMark kind={parsed.id as PortalGenericIconKey} />
    );
  } else if (remoteAllowed && source) {
    mark = <RemoteIconImage size={size} src={source} />;
  } else {
    mark = <GenericServiceMark kind="applications" />;
  }

  return (
    <span
      className={`ouchi-service-mark ouchi-service-mark--${parsed.kind}${
        parsed.id ? `-${parsed.id}` : ""
      }`}
      style={{ width: size, height: size }}
    >
      {mark}
    </span>
  );
}

function RemoteIconImage({
  size,
  src,
}: {
  size: number;
  src: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return <GenericServiceMark kind="applications" />;
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      className="ouchi-remote-icon"
      height={size}
      onError={() => setFailed(true)}
      src={src}
      width={size}
    />
  );
}
