// The themeable accent colour.
//
// Tailwind's blue palette is wired to CSS variables (see tailwind.config.js),
// so every `*-blue-*` utility in the app follows the accent a user picks in
// Profile > Appearance. The variables are set on <html> at runtime; their
// defaults live in frontend/styles/tailwind.css and match Tailwind's built-in
// blue palette, so an app without a chosen accent looks exactly as before.
//
// An accent is a single colour. The rest of the ramp is derived from it the
// way Tailwind derives its blue scale: the accent keeps its own hue and
// character, and every shade sits at the same distance from the anchor shade
// as it does in the default palette.

export const THEME_SHADES = [
    50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;

export type ThemeShade = (typeof THEME_SHADES)[number];

export const THEME_ACCENT_STORAGE_KEY = 'themeAccent';

// The accent an app with no chosen accent uses: Tailwind's blue-600.
export const DEFAULT_ACCENT = '#2563eb';

// The shade an accent sits on: the solid colour of a filled button.
const ANCHOR_SHADE: ThemeShade = 600;

// Tailwind's default blue palette. It is the shape of the ramp only — the
// values below are never used as colours themselves.
const BLUE_PALETTE: Record<ThemeShade, string> = {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
};

interface Rgb {
    r: number;
    g: number;
    b: number;
}

interface Hsl {
    h: number;
    s: number;
    l: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

/**
 * Whether a value is a colour the theme accepts: a hex colour such as
 * `#2563eb` (the three and four digit forms are allowed too).
 */
export function isThemeColor(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim())
    );
}

function hexToRgb(hex: string): Rgb | null {
    if (!isThemeColor(hex)) return null;

    let value = hex.trim().slice(1);
    if (value.length === 3 || value.length === 4) {
        value = value
            .split('')
            .map((char) => char + char)
            .join('');
    }

    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;

    return { r, g, b };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const lightness = (max + min) / 2;
    const delta = max - min;

    if (delta === 0) {
        return { h: 0, s: 0, l: lightness * 100 };
    }

    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    let hue: number;
    if (max === red) {
        hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
        hue = (blue - red) / delta + 2;
    } else {
        hue = (red - green) / delta + 4;
    }
    hue = (hue * 60 + 360) % 360;

    return { h: hue, s: saturation * 100, l: lightness * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
    const saturation = s / 100;
    const lightness = l / 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const sector = h / 60;
    const second = chroma * (1 - Math.abs((sector % 2) - 1));

    let rgb: [number, number, number];
    if (sector < 1) rgb = [chroma, second, 0];
    else if (sector < 2) rgb = [second, chroma, 0];
    else if (sector < 3) rgb = [0, chroma, second];
    else if (sector < 4) rgb = [0, second, chroma];
    else if (sector < 5) rgb = [second, 0, chroma];
    else rgb = [chroma, 0, second];

    const offset = lightness - chroma / 2;
    return {
        r: Math.round((rgb[0] + offset) * 255),
        g: Math.round((rgb[1] + offset) * 255),
        b: Math.round((rgb[2] + offset) * 255),
    };
}

function toHex({ r, g, b }: Rgb): string {
    const channel = (value: number) =>
        clamp(value, 0, 255).toString(16).padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// The lightness and saturation of every shade in the default palette, used
// as the shape the accent's own ramp is placed onto.
const BLUE_SHAPE = Object.fromEntries(
    Object.entries(BLUE_PALETTE).map(([shade, hex]) => [
        shade,
        rgbToHsl(hexToRgb(hex) as Rgb),
    ])
) as Record<ThemeShade, Hsl>;

/**
 * The CSS variables that colour the app for an accent. The values are
 * space separated channels, the form Tailwind's `<alpha-value>` needs.
 */
export function themeAccentVars(
    accent: string | null | undefined
): Record<string, string> {
    const rgb = hexToRgb((accent ?? '').trim());
    if (!rgb) return {};

    const hsl = rgbToHsl(rgb);
    const anchor = BLUE_SHAPE[ANCHOR_SHADE];
    const vars: Record<string, string> = {};

    // The default accent keeps Tailwind's palette exactly: a round trip
    // through HSL would shift the lightest shades by a channel or two.
    const isDefaultAccent =
        (accent ?? '').trim().toLowerCase() ===
        BLUE_PALETTE[ANCHOR_SHADE].toLowerCase();

    for (const shade of THEME_SHADES) {
        if (isDefaultAccent) {
            const template = hexToRgb(BLUE_PALETTE[shade]) as Rgb;
            vars[`--theme-blue-${shade}`] =
                `${template.r} ${template.g} ${template.b}`;
            continue;
        }

        const shape = BLUE_SHAPE[shade];
        const lightness = clamp(hsl.l + (shape.l - anchor.l), 0, 100);
        // A grey accent stays grey: there is no hue to scale the saturation by.
        const saturation =
            hsl.s === 0 || anchor.s === 0
                ? 0
                : clamp(hsl.s * (shape.s / anchor.s), 0, 100);

        const channel = hslToRgb({ h: hsl.h, s: saturation, l: lightness });
        vars[`--theme-blue-${shade}`] =
            `${channel.r} ${channel.g} ${channel.b}`;
    }

    return vars;
}

/**
 * One shade of an accent as a hex colour, for previews and swatches.
 */
export function themeAccentHex(
    accent: string | null | undefined,
    shade: ThemeShade = ANCHOR_SHADE
): string | null {
    const vars = themeAccentVars(accent);
    const channels = vars[`--theme-blue-${shade}`];
    if (!channels) return null;

    const [r, g, b] = channels.split(' ').map(Number);
    return toHex({ r, g, b });
}

/**
 * Apply an accent to the page. Without an accent the variables are removed
 * and the stylesheet's defaults (Tailwind's blue) apply again.
 */
export function applyThemeAccent(accent: string | null | undefined): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const vars = themeAccentVars(accent);

    for (const shade of THEME_SHADES) {
        const name = `--theme-blue-${shade}`;
        if (vars[name]) {
            root.style.setProperty(name, vars[name]);
        } else {
            root.style.removeProperty(name);
        }
    }
}

/**
 * The accent of the last session, so the app paints in it before the profile
 * has loaded.
 */
export function readStoredThemeAccent(): string | null {
    try {
        return localStorage.getItem(THEME_ACCENT_STORAGE_KEY);
    } catch {
        return null;
    }
}

export function storeThemeAccent(accent: string | null | undefined): void {
    try {
        if (accent) {
            localStorage.setItem(THEME_ACCENT_STORAGE_KEY, accent);
        } else {
            localStorage.removeItem(THEME_ACCENT_STORAGE_KEY);
        }
    } catch {
        // Storage is unavailable (private mode); the theme still applies.
    }
}
