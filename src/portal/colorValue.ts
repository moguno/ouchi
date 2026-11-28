/**
 * Until schema v0.10 the network accent was one of five tone names that
 * mapped to this fixed palette. The values survive as the hex colors the
 * tones convert to (migration 010 / the ouchi-ledger/7 upgrade), and as
 * the fallback when a network carries no usable accent.
 */
export const LEGACY_ACCENT_COLORS: Record<string, string> = {
  blue: "#5b9bd6",
  green: "#4ba755",
  orange: "#d69132",
  violet: "#7467a8",
  slate: "#667483",
};

export function normalizeNetworkAccent(
  value: string | null | undefined,
): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return LEGACY_ACCENT_COLORS.slate;
  }
  return LEGACY_ACCENT_COLORS[trimmed.toLowerCase()] ?? trimmed;
}

const BASIC_NAMED_COLORS: Record<string, string> = {
  aqua: "#00ffff",
  black: "#000000",
  blue: "#0000ff",
  fuchsia: "#ff00ff",
  gray: "#808080",
  green: "#008000",
  lime: "#00ff00",
  maroon: "#800000",
  navy: "#000080",
  olive: "#808000",
  orange: "#ffa500",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  silver: "#c0c0c0",
  teal: "#008080",
  white: "#ffffff",
  yellow: "#ffff00",
};

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - chroma / 2;
  const sector = Math.floor(hue / 60) % 6;
  const [r, g, b] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][sector];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * The color a project is born with: a deterministic function of its
 * name (FNV-1a over the name's code points, mapped to a hue), stored
 * in the project's color column at creation time. Renaming a project
 * never recolors it — afterwards the color is just a stored value,
 * editable like a network accent.
 */
export function projectColorFromName(name: string): string {
  let hash = 2166136261;
  for (const char of name.trim()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hslToHex((hash >>> 0) % 360, 45, 55);
}

function rgbToHex(red: number, green: number, blue: number) {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

/**
 * An input[type=color] only accepts #rrggbb. The saved value remains unchanged
 * in the text field, while this helper supplies a normalized color to the
 * native palette.
 */
export function colorValueForInput(
  value: string,
  fallback = "#d5a22b",
): string {
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((digit) => `${digit}${digit}`)
      .join("")}`;
  }

  const rgb = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/,
  );
  if (rgb) {
    return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  if (BASIC_NAMED_COLORS[trimmed]) {
    return BASIC_NAMED_COLORS[trimmed];
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext?.("2d");
    if (context) {
      context.fillStyle = "#000000";
      context.fillStyle = trimmed;
      const parsed = String(context.fillStyle);
      if (/^#[0-9a-f]{6}$/i.test(parsed)) {
        return parsed.toLowerCase();
      }
      const browserRgb = parsed.match(
        /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/,
      );
      if (browserRgb) {
        return rgbToHex(
          Number(browserRgb[1]),
          Number(browserRgb[2]),
          Number(browserRgb[3]),
        );
      }
    }
  }

  return fallback;
}
