import type { PortalIconKey } from "./types";

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

export function PlusIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </SvgBase>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="m5 16-.8 3.8L8 19l10.2-10.2a2.2 2.2 0 0 0-3.1-3.1L5 16Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="m13.5 7.5 3 3" stroke="currentColor" strokeWidth="1.8" />
    </SvgBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </SvgBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <SvgBase {...props}>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
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

function GenericServiceMark({ kind }: { kind: PortalIconKey }) {
  if (kind === "database") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <ellipse cx="24" cy="11" rx="12" ry="5" fill="#2b7a78" />
        <path d="M12 11v20c0 3 5 5 12 5s12-2 12-5V11" fill="#3caea3" />
        <ellipse cx="24" cy="20" rx="12" ry="5" fill="#165f5b" opacity=".25" />
      </svg>
    );
  }
  if (kind === "monitor") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <rect x="7" y="8" width="34" height="26" rx="4" fill="#315d78" />
        <path d="M16 22h5l3-7 4 13 3-6h4" stroke="#8ce3ba" strokeWidth="2.5" />
        <path d="M19 40h10M24 34v6" stroke="#315d78" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }
  if (kind === "container") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <path d="m24 7 15 8v18l-15 8-15-8V15l15-8Z" fill="#345b73" />
        <path d="m15 20 9 5 9-5M24 25v11" stroke="#a7d9e9" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "globe") {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="16" fill="#5d66a8" />
        <path d="M8 24h32M24 8c5 5 7 10 7 16s-2 11-7 16c-5-5-7-10-7-16s2-11 7-16Z" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <rect x="7" y="8" width="34" height="12" rx="3" fill="#54616c" />
      <rect x="7" y="23" width="34" height="12" rx="3" fill="#768691" />
      <path d="M13 14h10M13 29h10M23 35h12" stroke="#d9edf3" strokeLinecap="round" strokeWidth="2" />
      <circle cx="34" cy="14" r="2" fill="#9fe4bb" />
    </svg>
  );
}

export function ServiceIcon({
  iconKey,
  size = 58,
}: {
  iconKey: PortalIconKey;
  size?: number;
}) {
  let mark: React.ReactNode;
  switch (iconKey) {
    case "gitea":
      mark = <GiteaMark />;
      break;
    case "gatus":
      mark = <GatusMark />;
      break;
    case "proxmox":
      mark = <ProxmoxMark />;
      break;
    case "omv":
      mark = <OmvMark />;
      break;
    default:
      mark = <GenericServiceMark kind={iconKey} />;
  }

  return (
    <span
      className={`ouchi-service-mark ouchi-service-mark--${iconKey}`}
      style={{ width: size, height: size }}
    >
      {mark}
    </span>
  );
}
