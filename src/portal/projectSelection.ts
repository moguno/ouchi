/**
 * Which project the portal is looking at. A per-browser preference:
 * it lives in localStorage only and never touches the ledger, the
 * API, or the YAML format. Switching projects switches the whole
 * ouchi — board, management and memo views all follow the active
 * project. (The side menu's open/collapsed state is deliberately
 * NOT stored: every load starts collapsed, by user decision.)
 */
const ACTIVE_PROJECT_KEY = "ouchi.activeProjectId.v1";

export function loadActiveProjectId(): string | undefined {
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveActiveProjectId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    // A browser that refuses storage just loses the preference.
  }
}

export function clearActiveProjectId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    // A browser that refuses storage just loses the preference.
  }
}


