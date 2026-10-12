// PORT: lifeGLANCE, MIT License, Copyright (c) 2026 krelltunez.
// Source: https://github.com/krelltunez/lifeGLANCE
// Commit: cbc01c1acd818236bfbb9a952092978fa7261def
// Path: src/utils/timeline.js (dateToX, getTickMarks, assignLanes,
// computePinchZoom and the private helpers they call); safeLocale and
// sanitizeLanguageTag come from src/utils/locale.js at the same commit.
// Changes: TypeScript types; Date subtraction written with getTime().
// Behavior is unchanged. See THIRD_PARTY_NOTICES.md.

// Where today sits on screen for each view mode (0 = left edge, 1 = right edge)
const VIEW_ANCHOR: Record<string, number> = {
    all: 0.5,
    past: 0.88,
    future: 0.12,
};

export type TimelineZoom =
    'decades' | '30yr' | 'years' | 'months' | 'weeks' | 'custom';
export type ViewMode = 'all' | 'past' | 'future';

export interface TickMark {
    x: number;
    label: string;
    major: boolean;
}

// --- src/utils/locale.js ---

// Normalize a raw language string into a valid BCP-47 tag, or 'en' if nothing
// usable remains. Strips POSIX modifier (@posix) and charset (.UTF-8) suffixes
// and converts the POSIX '_' region separator to BCP-47 '-'.
function sanitizeLanguageTag(lng: unknown): string {
    if (!lng || typeof lng !== 'string') return 'en';
    const tag = lng.split('@')[0].split('.')[0].trim().replace(/_/g, '-');
    if (!tag || /^(c|posix)$/i.test(tag)) return 'en'; // language-less POSIX locales
    try {
        return Intl.getCanonicalLocales(tag)[0] || 'en';
    } catch {
        // Structurally invalid even after cleanup — fall back to the primary subtag.
        try {
            return Intl.getCanonicalLocales(tag.split('-')[0])[0] || 'en';
        } catch {
            return 'en';
        }
    }
}

// Guard a locale immediately before handing it to Intl. Returns the value
// unchanged when Intl accepts it, otherwise a sanitized tag — so a stale or
// externally-set bad value can never crash a render.
function safeLocale(lng: string | undefined): string | undefined {
    try {
        Intl.getCanonicalLocales(lng); // throws RangeError on an invalid tag
        return lng;
    } catch {
        return sanitizeLanguageTag(lng);
    }
}

// --- src/utils/timeline.js ---

export function dateToX(
    dateMs: number,
    startMs: number,
    endMs: number,
    width: number
): number {
    const span = endMs - startMs;
    if (span === 0) return width / 2;
    return ((dateMs - startMs) / span) * width;
}

// Pinch-to-zoom bounds, expressed as half-span in ms: ~1 month visible at max
// zoom-in, ~300 years visible at max zoom-out.
export const PINCH_MIN_HALF_MS = 14 * 24 * 3600 * 1000;
export const PINCH_MAX_HALF_MS = 150 * 365.25 * 24 * 3600 * 1000;

// Given the view state captured at the start of a pinch gesture and the live
// finger geometry, compute the new half-span and pan offset. `distRatio` is the
// current finger distance over the distance at gesture start (>1 = fingers
// spreading = zoom in). The timestamp under the starting midpoint is kept under
// the current midpoint, so content follows the fingers (two-finger pan + zoom
// combined). `nowMs` cancels out, so this is pure and unit-testable.
export function computePinchZoom({
    startHalfMs,
    startPanMs,
    viewMode = 'all',
    width,
    startMidX,
    midX,
    distRatio,
    minHalfMs = PINCH_MIN_HALF_MS,
    maxHalfMs = PINCH_MAX_HALF_MS,
}: {
    startHalfMs: number;
    startPanMs: number;
    viewMode?: ViewMode;
    width: number;
    startMidX: number;
    midX: number;
    distRatio: number;
    minHalfMs?: number;
    maxHalfMs?: number;
}): { halfMs: number; panMs: number } {
    const fraction = VIEW_ANCHOR[viewMode] ?? 0.5;
    const half = Math.max(
        minHalfMs,
        Math.min(maxHalfMs, startHalfMs / distRatio)
    );
    const kStart = startMidX / width - fraction;
    const kCur = midX / width - fraction;
    const panMs = startPanMs + startHalfMs * 2 * kStart - half * 2 * kCur;
    return { halfMs: half, panMs };
}

// Pick the best tick-mark visual style for a given span
function autoStyle(startMs: number, endMs: number): string {
    const spanYears = (endMs - startMs) / (365.25 * 24 * 3600 * 1000);
    if (spanYears > 15) return 'decades';
    if (spanYears > 2) return 'years';
    if (spanYears > 0.4) return 'months';
    return 'weeks';
}

// Generate tick marks for the current view. `locale` (BCP-47) localizes the
// short month labels; callers pass the app's selected language.
export function getTickMarks(
    zoom: TimelineZoom,
    startMs: number,
    endMs: number,
    width: number,
    locale?: string
): TickMark[] {
    // Guard against a malformed tag reaching toLocaleString below (would throw).
    const loc = safeLocale(locale);
    // 'custom' auto-selects its visual style; '30yr' uses the same style as 'decades'
    const style =
        zoom === 'custom'
            ? autoStyle(startMs, endMs)
            : zoom === '30yr'
              ? 'decades'
              : zoom;

    const ticks: TickMark[] = [];
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    if (style === 'decades') {
        const startYear = Math.floor(startDate.getFullYear() / 10) * 10;
        for (let y = startYear; y <= endDate.getFullYear(); y++) {
            const x = dateToX(
                new Date(y, 0, 1).getTime(),
                startMs,
                endMs,
                width
            );
            if (x < -2 || x > width + 2) continue;
            const major = y % 10 === 0;
            ticks.push({
                x,
                label: major ? String(y) : y % 5 === 0 ? String(y) : '',
                major,
            });
        }
    } else if (style === 'years') {
        for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
            const x = dateToX(
                new Date(y, 0, 1).getTime(),
                startMs,
                endMs,
                width
            );
            if (x < -2 || x > width + 2) continue;
            ticks.push({ x, label: String(y), major: true });
        }
    } else if (style === 'months') {
        let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        while (d <= endDate) {
            const x = dateToX(d.getTime(), startMs, endMs, width);
            if (x >= -2 && x <= width + 2) {
                const major = d.getMonth() === 0;
                const label = major
                    ? String(d.getFullYear())
                    : d.toLocaleString(loc, { month: 'short' });
                ticks.push({ x, label, major });
            }
            d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        }
    } else if (style === 'weeks') {
        let d = new Date(startDate);
        d.setDate(d.getDate() - d.getDay()); // align to Sunday
        while (d <= endDate) {
            const x = dateToX(d.getTime(), startMs, endMs, width);
            if (x >= -2 && x <= width + 2) {
                const isFirst = d.getDate() <= 7;
                const label = isFirst
                    ? d.toLocaleString(loc, { month: 'short', year: 'numeric' })
                    : '';
                ticks.push({ x, label, major: isFirst });
            }
            d = new Date(d.getTime() + 7 * 24 * 3600 * 1000);
        }
    }

    return ticks;
}

// Deterministic hash of an arbitrary string → 0..1 float
function seededHash(str: string): number {
    let h = 0;
    for (const c of str) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
    return (h >>> 0) / 4294967295;
}

export interface LaneInput {
    id: string | number;
    date: string | number | Date;
}

export type Laned<T> = T & { above: boolean; lane: number; connRand: number };

const time = (d: string | number | Date): number => new Date(d).getTime();

// Assign above/below lanes to sorted milestones.
//   maxLane      – max lane index that fits in the container (caller computes)
//   cardTimeSpan – ms equivalent of one card width at current zoom (for overlap detection)
//
// Uses force-directed simulation when cards are sparse enough for it to converge
// cleanly (avg neighbours < DENSITY_THRESHOLD). Falls back to greedy interval
// packing when nearly every card overlaps every other (e.g. 30yr zoom), where
// force-directed produces worse results than a simple sequential scan.
//
// connRand (independent seeded hash) drives connector-length jitter in the renderer.
export function assignLanes<T extends LaneInput>(
    milestones: T[],
    maxLane = 0,
    cardTimeSpan = 0,
    forceAbove = false
): Laned<T>[] {
    const sorted = [...milestones].sort((a, b) => time(a.date) - time(b.date));

    // Build per-card metadata shared by both algorithms
    const cards = sorted.map((m, i) => ({
        m,
        above: forceAbove || i % 2 === 0,
        connRand: seededHash(String(m.id) + '~conn'),
        ms: time(m.date),
    }));

    // Measure average temporal-neighbour count to choose algorithm
    const DENSITY_THRESHOLD = 3; // avg neighbours per card before switching to greedy
    let totalNeighbours = 0;
    if (cardTimeSpan > 0 && cards.length > 1) {
        for (let i = 0; i < cards.length; i++)
            for (let j = 0; j < cards.length; j++)
                if (
                    i !== j &&
                    Math.abs(cards[i].ms - cards[j].ms) < cardTimeSpan
                )
                    totalNeighbours++;
    }
    const avgNeighbours = cards.length > 0 ? totalNeighbours / cards.length : 0;
    const useForceSim = avgNeighbours < DENSITY_THRESHOLD;

    // ── Force-directed simulation (sparse views) ──────────────────────────────
    if (useForceSim) {
        type SimCard = (typeof cards)[number] & {
            idx: number;
            pos: number;
            vel: number;
        };
        const groups: { above: SimCard[]; below: SimCard[] } = {
            above: [],
            below: [],
        };
        cards.forEach((c, i) => {
            groups[c.above ? 'above' : 'below'].push({
                ...c,
                idx: i,
                pos: 0,
                vel: 0,
            });
        });

        const K_CENTER = 0.2;
        const K_REPEL = 1.2;
        const DAMPING = 0.75;
        const ITERATIONS = 60;

        for (const group of Object.values(groups)) {
            if (group.length === 0) continue;
            for (let iter = 0; iter < ITERATIONS; iter++) {
                for (let i = 0; i < group.length; i++) {
                    const ci = group[i];
                    let force = -K_CENTER * ci.pos;
                    if (cardTimeSpan > 0) {
                        for (let j = 0; j < group.length; j++) {
                            if (i === j) continue;
                            const cj = group[j];
                            if (Math.abs(ci.ms - cj.ms) >= cardTimeSpan)
                                continue;
                            const delta = ci.pos - cj.pos;
                            const dist = Math.abs(delta);
                            if (dist < 1.5) {
                                const sign =
                                    dist > 0.001
                                        ? delta > 0
                                            ? 1
                                            : -1
                                        : i > j
                                          ? 1
                                          : -1;
                                force += (sign * K_REPEL * (1.5 - dist)) / 1.5;
                            }
                        }
                    }
                    ci.vel = (ci.vel + force) * DAMPING;
                }
                for (const c of group)
                    c.pos = Math.max(0, Math.min(maxLane, c.pos + c.vel));
            }
        }

        const result: Laned<T>[] = [];
        for (const group of Object.values(groups))
            for (const c of group)
                result.push({
                    ...c.m,
                    above: c.above,
                    lane: Math.round(Math.max(0, Math.min(maxLane, c.pos))),
                    connRand: c.connRand,
                });
        result.sort((a, b) => time(a.date) - time(b.date));
        return result;
    }

    // ── Greedy interval packing (dense views) ─────────────────────────────────
    const placed: Record<'above' | 'below', { ms: number; lane: number }[]> = {
        above: [],
        below: [],
    };
    return cards.map(({ m, above, connRand, ms }) => {
        const side = above ? 'above' : 'below';
        const hasConflict = (l: number) =>
            cardTimeSpan > 0 &&
            placed[side].some(
                (p) => p.lane === l && Math.abs(p.ms - ms) < cardTimeSpan
            );
        let lane = 0;
        while (lane < maxLane && hasConflict(lane)) lane++;
        placed[side].push({ ms, lane });
        return { ...m, above, lane, connRand };
    });
}
