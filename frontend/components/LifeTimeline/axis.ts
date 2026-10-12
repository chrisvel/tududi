// Life-to-Day (T-602): axis labels for the Life timeline. Gregorian uses the
// ported getTickMarks unchanged; the Jalali calendar places ticks on Jalali
// year, month and Saturday boundaries via jalali.ts, using the same span
// thresholds as the port's autoStyle so both calendars change style together.
import { getTickMarks, dateToX, TickMark } from '../../utils/timeline';
import {
    formatDisplayDate,
    formatDisplayNumber,
    isPersianCalendar,
    jalaliToLocalDate,
    persianMonthName,
    resolveDisplayLocale,
    toPersianPartsInTz,
} from '../../utils/jalali';
import type { MilestonePrecision } from '../../utils/milestonesService';

const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

// Jalali boundary dates are reused on every frame of a zoom gesture.
const boundaryCache = new Map<string, number>();
const jalaliMs = (year: number, month: number): number => {
    const key = `${year}-${month}`;
    let value = boundaryCache.get(key);
    if (value === undefined) {
        value = jalaliToLocalDate(year, month, 1).getTime();
        boundaryCache.set(key, value);
    }
    return value;
};

const yearLabel = (year: number) =>
    formatDisplayNumber(year, { useGrouping: false });

function jalaliTicks(startMs: number, endMs: number, width: number) {
    const ticks: TickMark[] = [];
    const visible = (x: number) => x >= -2 && x <= width + 2;
    const spanYears = (endMs - startMs) / YEAR_MS;
    const start = toPersianPartsInTz(startMs);
    const end = toPersianPartsInTz(endMs);

    if (spanYears > 2) {
        const decades = spanYears > 15;
        const first = decades ? Math.floor(start.year / 10) * 10 : start.year;
        for (let y = first; y <= end.year; y++) {
            const x = dateToX(jalaliMs(y, 1), startMs, endMs, width);
            if (!visible(x)) continue;
            const major = !decades || y % 10 === 0;
            ticks.push({
                x,
                label: !decades || y % 5 === 0 ? yearLabel(y) : '',
                major,
            });
        }
    } else if (spanYears > 0.4) {
        let { year, month } = start;
        while (jalaliMs(year, month) <= endMs) {
            const x = dateToX(jalaliMs(year, month), startMs, endMs, width);
            if (visible(x))
                ticks.push({
                    x,
                    label:
                        month === 1
                            ? yearLabel(year)
                            : persianMonthName(year, month),
                    major: month === 1,
                });
            if (++month > 12) {
                month = 1;
                year++;
            }
        }
    } else {
        // Jalali weeks start on Saturday.
        const d = new Date(startMs);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
        for (let t = d.getTime(); t <= endMs; t += 7 * DAY_MS) {
            const x = dateToX(t, startMs, endMs, width);
            if (!visible(x)) continue;
            const isFirst = toPersianPartsInTz(t).day <= 7;
            ticks.push({
                x,
                label: isFirst
                    ? formatDisplayDate(t, { month: 'long', year: 'numeric' })
                    : '',
                major: isFirst,
            });
        }
    }
    return ticks;
}

export function timelineTicks(
    startMs: number,
    endMs: number,
    width: number
): TickMark[] {
    if (isPersianCalendar()) return jalaliTicks(startMs, endMs, width);
    return getTickMarks(
        'custom',
        startMs,
        endMs,
        width,
        resolveDisplayLocale()
    );
}

const PRECISION_FORMAT: Record<MilestonePrecision, Intl.DateTimeFormatOptions> =
    {
        day: { year: 'numeric', month: 'long', day: 'numeric' },
        month: { year: 'numeric', month: 'long' },
        year: { year: 'numeric' },
    };

/** ISO day (YYYY-MM-DD) as local midnight, the app's date-label convention. */
export const isoToMs = (iso: string): number =>
    new Date(`${iso}T00:00:00`).getTime();

/** User-facing date in the active calendar (Jalali for fa by default). */
export const formatMilestoneDate = (
    iso: string,
    precision: MilestonePrecision = 'day'
): string => formatDisplayDate(isoToMs(iso), PRECISION_FORMAT[precision]);
