import type { CSSProperties } from 'react';

// The one color palette for tududi. Anything a user can color (areas,
// projects, goals, tags, notes, people, calendars, habits) picks from it, and
// automatic colors (avatars, template accents) are drawn from it too.
//
// `value` is what gets stored and is the light-mode shade. `dark` is a lighter
// shade of the same hue so fills and text stay readable on dark surfaces.
export interface PaletteColor {
    key: string;
    name: string;
    value: string;
    dark: string;
}

export const PALETTE: PaletteColor[] = [
    { key: 'red', name: 'Red', value: '#b91c1c', dark: '#f87171' },
    { key: 'orange', name: 'Orange', value: '#c2410c', dark: '#fb923c' },
    { key: 'yellow', name: 'Yellow', value: '#ca8a04', dark: '#facc15' },
    { key: 'green', name: 'Green', value: '#15803d', dark: '#4ade80' },
    { key: 'teal', name: 'Teal', value: '#0f766e', dark: '#2dd4bf' },
    { key: 'cyan', name: 'Cyan', value: '#0e7490', dark: '#22d3ee' },
    { key: 'blue', name: 'Blue', value: '#1d4ed8', dark: '#60a5fa' },
    { key: 'indigo', name: 'Indigo', value: '#4338ca', dark: '#818cf8' },
    { key: 'purple', name: 'Purple', value: '#7e22ce', dark: '#c084fc' },
    { key: 'pink', name: 'Pink', value: '#be185d', dark: '#f472b6' },
    { key: 'gray', name: 'Gray', value: '#374151', dark: '#9ca3af' },
];

const byValue = new Map(PALETTE.map((c) => [c.value.toLowerCase(), c]));

// Colors saved before the palette existed (for example CalDAV calendars) are
// kept as they are and used for both modes.
export function resolveColor(
    value?: string | null,
    fallback?: string
): PaletteColor | null {
    const raw = (value || fallback || '').trim();
    if (!raw) return null;
    const known = byValue.get(raw.toLowerCase());
    if (known) return known;
    const byKey = PALETTE.find((c) => c.key === raw.toLowerCase());
    if (byKey) return byKey;
    return /^#[0-9a-f]{3,8}$/i.test(raw)
        ? { key: 'custom', name: raw, value: raw, dark: raw }
        : null;
}

// A stable color for things nobody picked a color for (a commenter's avatar,
// a template category), so the same name always gets the same hue.
export function hashColor(seed: string): PaletteColor {
    const choices = PALETTE.filter((c) => c.key !== 'gray');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return choices[hash % choices.length];
}

// CSS variables for a color, read by the `accent` utility classes below.
// Set them on a container and use e.g. `ACCENT.bg` inside it.
export function accentVars(color: PaletteColor | null): CSSProperties {
    if (!color) return {};
    return {
        '--accent-light': color.value,
        '--accent-dark': color.dark,
    } as CSSProperties;
}

// Class helpers that follow the light/dark shade of the accent variables.
export const ACCENT = {
    bg: 'bg-[color:var(--accent-light)] dark:bg-[color:var(--accent-dark)]',
    text: 'text-[color:var(--accent-light)] dark:text-[color:var(--accent-dark)]',
    softBg: 'bg-[color:color-mix(in_srgb,var(--accent-light)_12%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--accent-dark)_16%,transparent)]',
    softerBg:
        'bg-[color:color-mix(in_srgb,var(--accent-light)_7%,transparent)] dark:bg-[color:color-mix(in_srgb,var(--accent-dark)_10%,transparent)]',
    hoverSoftBg:
        'hover:bg-[color:color-mix(in_srgb,var(--accent-light)_12%,transparent)] dark:hover:bg-[color:color-mix(in_srgb,var(--accent-dark)_16%,transparent)]',
    hoverText:
        'hover:text-[color:var(--accent-light)] dark:hover:text-[color:var(--accent-dark)]',
    ring: 'ring-[color:var(--accent-light)] dark:ring-[color:var(--accent-dark)]',
    // Filled buttons keep the deeper shade in both modes so white text reads.
    solid: 'bg-[color:var(--accent-light)] text-white hover:brightness-110',
    // Tints of the card surface (SURFACE.card), for "done" states. In dark
    // mode the tint is mixed into the lifted gray so warm hues stay clean.
    surface:
        'bg-[color:color-mix(in_srgb,var(--accent-light)_7%,white)] dark:bg-[color:color-mix(in_srgb,var(--accent-dark)_6%,rgb(55_65_81))]',
    surfaceStrong:
        'bg-[color:color-mix(in_srgb,var(--accent-light)_14%,white)] dark:bg-black/15',
    // A footer or inset strip: tinted in light mode, neutral in dark mode.
    strip: 'bg-[color:color-mix(in_srgb,var(--accent-light)_7%,transparent)] dark:bg-black/15',
};

// Raised surfaces. In dark mode cards are lifted slightly above the gray-800
// page rather than sunk below it, so colored accents read cleanly on them.
export const SURFACE = {
    // A hairline outline so cards separate from the page in both modes. It
    // is a ring, so it adds no layout width.
    outline: 'ring-1 ring-gray-900/[0.06] dark:ring-white/10',
    card: 'bg-white dark:bg-gray-700 ring-1 ring-gray-900/[0.06] dark:ring-white/10',
    inset: 'bg-gray-100 dark:bg-gray-800/70',
};
