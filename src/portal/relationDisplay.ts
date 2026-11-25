/**
 * Per-relation-name line display modes on the portal. This is a
 * throwaway per-browser preference: it lives in localStorage only and
 * never touches the ledger, the API, or the YAML format.
 */
export type RelationDisplayMode = "always" | "selected" | "hidden";

export type RelationDisplayModes = Record<string, RelationDisplayMode>;

export const RELATION_DISPLAY_MODE_LABELS: Record<RelationDisplayMode, string> =
  {
    always: "常時表示",
    selected: "選択時のみ",
    hidden: "表示しない",
  };

const STORAGE_KEY = "ouchi.relationDisplayModes.v1";

const MODES: RelationDisplayMode[] = ["always", "selected", "hidden"];

export function relationDisplayMode(
  modes: RelationDisplayModes | undefined,
  relationName: string,
): RelationDisplayMode {
  return modes?.[relationName] ?? "selected";
}

export function nextRelationDisplayMode(
  mode: RelationDisplayMode,
): RelationDisplayMode {
  return mode === "selected" ? "always" : mode === "always" ? "hidden" : "selected";
}

export function loadRelationDisplayModes(): RelationDisplayModes {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const modes: RelationDisplayModes = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (MODES.includes(value as RelationDisplayMode)) {
        modes[name] = value as RelationDisplayMode;
      }
    }
    return modes;
  } catch {
    return {};
  }
}

export function saveRelationDisplayModes(modes: RelationDisplayModes): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(modes));
  } catch {
    // A browser that refuses storage just loses the preference.
  }
}
