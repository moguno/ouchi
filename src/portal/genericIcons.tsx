import type { PortalGenericIconKey } from "./types";

/*
 * Original geometric marks authored for ouchi.local. They are distributed
 * under this project's Apache-2.0 license and may be bundled offline.
 */
export function GenericServiceMark({
  kind,
}: {
  kind: PortalGenericIconKey;
}) {
  const stroke = "#27545c";
  let content: React.ReactNode;

  switch (kind) {
    case "applications":
      content = (
        <>
          <rect x="8" y="8" width="13" height="13" rx="3" fill="#8ac6bd" />
          <rect x="27" y="8" width="13" height="13" rx="3" fill="#4f8ea3" />
          <rect x="8" y="27" width="13" height="13" rx="3" fill="#4f8ea3" />
          <rect x="27" y="27" width="13" height="13" rx="3" fill="#8ac6bd" />
        </>
      );
      break;
    case "gitea":
      content = (
        <>
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
        </>
      );
      break;
    case "gatus":
      content = (
        <>
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
        </>
      );
      break;
    case "proxmox":
      content = (
        <>
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
        </>
      );
      break;
    case "omv":
      content = (
        <>
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
        </>
      );
      break;
    case "server":
      content = (
        <>
          <rect x="7" y="8" width="34" height="12" rx="3" fill="#54616c" />
          <rect x="7" y="23" width="34" height="12" rx="3" fill="#768691" />
          <path
            d="M13 14h10M13 29h10M23 35h12"
            stroke="#d9edf3"
            strokeLinecap="round"
            strokeWidth="2"
          />
          <circle cx="34" cy="14" r="2" fill="#9fe4bb" />
        </>
      );
      break;
    case "database":
      content = (
        <>
          <ellipse cx="24" cy="11" rx="12" ry="5" fill="#2b7a78" />
          <path d="M12 11v20c0 3 5 5 12 5s12-2 12-5V11" fill="#3caea3" />
          <ellipse cx="24" cy="20" rx="12" ry="5" fill="#165f5b" opacity=".25" />
        </>
      );
      break;
    case "monitor":
      content = (
        <>
          <rect x="7" y="8" width="34" height="26" rx="4" fill="#315d78" />
          <path
            d="M16 22h5l3-7 4 13 3-6h4"
            stroke="#8ce3ba"
            strokeWidth="2.5"
          />
          <path
            d="M19 40h10M24 34v6"
            stroke="#315d78"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </>
      );
      break;
    case "container":
      content = (
        <>
          <path d="m24 7 15 8v18l-15 8-15-8V15l15-8Z" fill="#345b73" />
          <path
            d="m15 20 9 5 9-5M24 25v11"
            stroke="#a7d9e9"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </>
      );
      break;
    case "globe":
      content = (
        <>
          <circle cx="24" cy="24" r="16" fill="#5d66a8" />
          <path
            d="M8 24h32M24 8c5 5 7 10 7 16s-2 11-7 16c-5-5-7-10-7-16s2-11 7-16Z"
            stroke="#fff"
            strokeWidth="2"
          />
        </>
      );
      break;
    case "bookmark":
      content = (
        <path
          d="M15 8h18a2 2 0 0 1 2 2v30l-11-7-11 7V10a2 2 0 0 1 2-2Z"
          fill="#f0b35a"
          stroke="#91601b"
          strokeWidth="2"
        />
      );
      break;
    case "calendar":
      content = (
        <>
          <rect x="8" y="12" width="32" height="28" rx="4" fill="#eef5f4" stroke={stroke} strokeWidth="2" />
          <path d="M8 20h32M16 8v8M32 8v8" stroke={stroke} strokeWidth="2.5" />
          <path d="M15 27h5v5h-5zM27 27h5v5h-5z" fill="#4f8ea3" />
        </>
      );
      break;
    case "camera":
      content = (
        <>
          <path d="M9 17h7l3-5h10l3 5h7v21H9Z" fill="#5b7180" stroke={stroke} strokeWidth="2" />
          <circle cx="24" cy="27" r="8" fill="#d8edf0" stroke="#fff" strokeWidth="2" />
          <circle cx="24" cy="27" r="4" fill="#4f8ea3" />
        </>
      );
      break;
    case "chart":
      content = (
        <>
          <path d="M10 8v30h29" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
          <rect x="15" y="25" width="5" height="8" rx="1" fill="#8ac6bd" />
          <rect x="23" y="18" width="5" height="15" rx="1" fill="#4f8ea3" />
          <rect x="31" y="12" width="5" height="21" rx="1" fill="#e1984d" />
        </>
      );
      break;
    case "chat":
      content = (
        <path
          d="M9 11h30v20H22l-8 7v-7H9Z"
          fill="#76a9c6"
          stroke={stroke}
          strokeLinejoin="round"
          strokeWidth="2"
        />
      );
      break;
    case "cloud":
      content = (
        <path
          d="M14 34h22a7 7 0 0 0 1-14 12 12 0 0 0-22-3 9 9 0 0 0-1 17Z"
          fill="#b8dbe2"
          stroke="#477b8e"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      );
      break;
    case "code":
      content = (
        <path
          d="m18 14-9 10 9 10M30 14l9 10-9 10M27 9l-6 30"
          fill="none"
          stroke="#325e70"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      );
      break;
    case "download":
      content = (
        <>
          <path d="M24 8v23M15 22l9 9 9-9M9 38h30" fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </>
      );
      break;
    case "folder":
      content = (
        <path
          d="M7 12h13l4 5h17v21H7Z"
          fill="#e8b857"
          stroke="#8b641e"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      );
      break;
    case "home":
      content = (
        <>
          <path d="m7 23 17-14 17 14v17H7Z" fill="#7eb3ad" stroke={stroke} strokeLinejoin="round" strokeWidth="2" />
          <path d="M20 40V28h8v12" fill="#e7f3f1" stroke={stroke} strokeWidth="2" />
        </>
      );
      break;
    case "key":
      content = (
        <>
          <circle cx="16" cy="17" r="8" fill="#f0c25c" stroke="#8a641b" strokeWidth="2" />
          <path d="m22 23 17 17M31 32l5-5M35 36l5-5" stroke={stroke} strokeLinecap="round" strokeWidth="4" />
        </>
      );
      break;
    case "lock":
      content = (
        <>
          <rect x="11" y="22" width="26" height="18" rx="4" fill="#6d8fa5" stroke={stroke} strokeWidth="2" />
          <path d="M16 22v-5a8 8 0 0 1 16 0v5" fill="none" stroke={stroke} strokeWidth="3" />
          <circle cx="24" cy="30" r="2.5" fill="#fff" />
        </>
      );
      break;
    case "mail":
      content = (
        <>
          <rect x="7" y="11" width="34" height="26" rx="4" fill="#a9d1d8" stroke={stroke} strokeWidth="2" />
          <path d="m10 15 14 11 14-11" fill="none" stroke={stroke} strokeLinejoin="round" strokeWidth="2.4" />
        </>
      );
      break;
    case "music":
      content = (
        <>
          <path d="M20 11v24M20 14l17-3v22" fill="none" stroke={stroke} strokeLinejoin="round" strokeWidth="3" />
          <ellipse cx="15" cy="36" rx="6" ry="4" fill="#4f8ea3" />
          <ellipse cx="32" cy="34" rx="6" ry="4" fill="#4f8ea3" />
        </>
      );
      break;
    case "printer":
      content = (
        <>
          <path d="M12 9h24v10H12z" fill="#dbe9eb" stroke={stroke} strokeWidth="2" />
          <rect x="7" y="19" width="34" height="16" rx="3" fill="#617b89" stroke={stroke} strokeWidth="2" />
          <path d="M13 30h22v11H13z" fill="#fff" stroke={stroke} strokeWidth="2" />
          <circle cx="35" cy="24" r="2" fill="#79d39a" />
        </>
      );
      break;
    case "shield":
      content = (
        <>
          <path d="M24 6 39 12v10c0 9-6 16-15 20-9-4-15-11-15-20V12Z" fill="#5d9c89" stroke="#28594c" strokeLinejoin="round" strokeWidth="2.2" />
          <path d="m16 24 6 6 11-12" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </>
      );
      break;
    case "terminal":
      content = (
        <>
          <rect x="6" y="10" width="36" height="28" rx="4" fill="#263b47" stroke={stroke} strokeWidth="2" />
          <path d="m14 20 6 5-6 5M23 30h11" fill="none" stroke="#b8e2d7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        </>
      );
      break;
    case "upload":
      content = (
        <path d="M24 36V13M15 22l9-9 9 9M9 38h30" fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      );
      break;
    case "users":
      content = (
        <>
          <circle cx="18" cy="17" r="6" fill="#79aaa9" stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="19" r="5" fill="#a3c9c7" stroke={stroke} strokeWidth="2" />
          <path d="M7 38c1-8 5-12 11-12s10 4 11 12M26 28c8-2 13 2 15 10" fill="none" stroke={stroke} strokeLinecap="round" strokeWidth="2.5" />
        </>
      );
      break;
    case "video":
      content = (
        <>
          <rect x="6" y="13" width="26" height="22" rx="4" fill="#547b91" stroke={stroke} strokeWidth="2" />
          <path d="m32 20 10-5v18l-10-5Z" fill="#8eb6cf" stroke={stroke} strokeLinejoin="round" strokeWidth="2" />
        </>
      );
      break;
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      {content}
    </svg>
  );
}
