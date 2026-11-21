import { useState } from "react";
import { OuchiPortal } from "./portal";

const PORTAL_SUBTITLES = [
  "これがあなたのホームラボです",
  "AIと創る、おうちネットワーク",
] as const;

const PORTAL_SUBTITLE_STORAGE_KEY = "ouchi.local.portal.subtitle.v1";
const PORTAL_TITLE_STORAGE_KEY = "ouchi.local.portal.home-title.v1";
const DEFAULT_PORTAL_TITLE = "あなたのホームラボ";

function selectPortalSubtitle() {
  if (typeof window === "undefined") {
    return PORTAL_SUBTITLES[0];
  }

  try {
    const previous = window.localStorage.getItem(
      PORTAL_SUBTITLE_STORAGE_KEY,
    );
    const previousIndex = Number(previous);
    const nextIndex =
      previous === null ||
      !Number.isInteger(previousIndex) ||
      previousIndex < 0 ||
      previousIndex >= PORTAL_SUBTITLES.length
        ? 0
        : (previousIndex + 1) % PORTAL_SUBTITLES.length;
    window.localStorage.setItem(
      PORTAL_SUBTITLE_STORAGE_KEY,
      String(nextIndex),
    );
    return PORTAL_SUBTITLES[nextIndex];
  } catch {
    return PORTAL_SUBTITLES[0];
  }
}

const initialPortalSubtitle = selectPortalSubtitle();

function loadPortalTitle() {
  if (typeof window === "undefined") {
    return DEFAULT_PORTAL_TITLE;
  }

  try {
    return (
      window.localStorage.getItem(PORTAL_TITLE_STORAGE_KEY)?.trim() ||
      DEFAULT_PORTAL_TITLE
    );
  } catch {
    return DEFAULT_PORTAL_TITLE;
  }
}

export default function App() {
  const [portalTitle, setPortalTitle] = useState(loadPortalTitle);

  function handlePortalTitleChange(nextTitle: string) {
    const normalized = nextTitle.trim();
    setPortalTitle(normalized);

    try {
      window.localStorage.setItem(PORTAL_TITLE_STORAGE_KEY, normalized);
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }

  return (
    <main className="demo-page">
      <header className="demo-portal-title">
        <div className="ouchi-title-block">
          <span className="ouchi-home-mark" aria-hidden="true">
            家
          </span>
          <div>
            <h1>ouchi.local</h1>
            <p className="ouchi-summary demo-portal-subtitle">
              {initialPortalSubtitle}
            </p>
          </div>
        </div>
      </header>
      <OuchiPortal
        onPortalTitleChange={handlePortalTitleChange}
        portalTitle={portalTitle}
        showTitle={false}
        initialSelectedDeviceId="omv-vm"
      />
      <p className="demo-note">
        Reactコンポーネント・デモ / データはブラウザ内に保存されます
      </p>
    </main>
  );
}
