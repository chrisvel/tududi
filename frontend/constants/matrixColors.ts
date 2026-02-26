/**
 * Unified quadrant color definitions used across the matrix feature.
 *
 * Quadrant indices map to positions in a 2×2 grid:
 *   Q0 = top-left     (e.g., Urgent + Important → "Do First")
 *   Q1 = top-right    (e.g., Not Urgent + Important → "Schedule")
 *   Q2 = bottom-left  (e.g., Urgent + Not Important → "Delegate")
 *   Q3 = bottom-right (e.g., Not Urgent + Not Important → "Eliminate")
 *
 * Color semantics: red → amber → blue → green (urgency gradient).
 */

export interface QuadrantStyle {
    /** Solid dot/indicator color (single shade, e.g. 'bg-rose-500'). */
    dot: string;
    /** Background fill with dark-mode variant (e.g. 'bg-rose-400 dark:bg-rose-500'). */
    bg: string;
    /** Subtle background for cards/chips (e.g. 'bg-rose-50 dark:bg-rose-900/20'). */
    bgSubtle: string;
    /** Text color with dark-mode variant. */
    text: string;
    /** Focus ring color with dark-mode variant. */
    ring: string;
}

export const QUADRANT_STYLES: Record<number, QuadrantStyle> = {
    0: {
        dot: 'bg-rose-500',
        bg: 'bg-rose-400 dark:bg-rose-500',
        bgSubtle: 'bg-rose-50 dark:bg-rose-900/20',
        text: 'text-rose-700 dark:text-rose-300',
        ring: 'ring-rose-300 dark:ring-rose-700',
    },
    1: {
        dot: 'bg-amber-500',
        bg: 'bg-amber-400 dark:bg-amber-500',
        bgSubtle: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-700 dark:text-amber-300',
        ring: 'ring-amber-300 dark:ring-amber-700',
    },
    2: {
        dot: 'bg-sky-500',
        bg: 'bg-sky-400 dark:bg-sky-500',
        bgSubtle: 'bg-sky-50 dark:bg-sky-900/20',
        text: 'text-sky-700 dark:text-sky-300',
        ring: 'ring-sky-300 dark:ring-sky-700',
    },
    3: {
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-400 dark:bg-emerald-500',
        bgSubtle: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-700 dark:text-emerald-300',
        ring: 'ring-emerald-300 dark:ring-emerald-700',
    },
};

/** Fallback when quadrant index is unknown. */
export const QUADRANT_STYLE_DEFAULT: QuadrantStyle = {
    dot: 'bg-gray-400',
    bg: 'bg-gray-300 dark:bg-gray-600',
    bgSubtle: 'bg-gray-50 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    ring: 'ring-gray-300 dark:ring-gray-600',
};

/** Get the style for a quadrant index, falling back to gray for unknown indices. */
export function getQuadrantStyle(index: number): QuadrantStyle {
    return QUADRANT_STYLES[index] ?? QUADRANT_STYLE_DEFAULT;
}
