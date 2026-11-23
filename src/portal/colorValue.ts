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
