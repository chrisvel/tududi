// Life-to-Day (T-602): the Life timeline scale, written for Tailwind on the
// pure functions ported from lifeGLANCE (frontend/utils/timeline.ts). Layer 1
// is milestones above the axis; layer 2 is dated goals below it. Zoom runs
// from weeks to decades with the wheel, pinch, buttons or keys; the track
// pans inside its own box so the page never scrolls sideways.
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { assignLanes, computePinchZoom, dateToX } from '../../utils/timeline';
import { formatMilestoneDate, isoToMs, timelineTicks } from './axis';
import type { MilestonePrecision } from '../../utils/milestonesService';

const DAY_MS = 24 * 3600 * 1000;
const YEAR_MS = 365.25 * DAY_MS;

export const ZOOM_PRESETS = {
    weeks: 13 * 7 * DAY_MS,
    months: 18 * 30.44 * DAY_MS,
    years: 10 * YEAR_MS,
    decades: 50 * YEAR_MS,
} as const;
export type ZoomPreset = keyof typeof ZOOM_PRESETS;

// Narrower cards on phones so more of them fit side by side.
const cardWidthFor = (width: number) => (width < 640 ? 112 : 144);
const LANE_HEIGHT = 52;
const MAX_LANE = 2;
const LAYER_HEIGHT = (MAX_LANE + 1) * LANE_HEIGHT;
const AXIS_HEIGHT = 48;
const DRAG_THRESHOLD = 4;

export interface TimelineItem {
    id: string;
    title: string;
    date: string; // ISO day
    precision: MilestonePrecision;
    color?: string | null;
}

interface PreparedItem {
    id: string;
    title: string;
    date: number; // local-midnight ms
    label: string;
    color?: string | null;
}

const prepare = (items: TimelineItem[]): PreparedItem[] =>
    items.map((item) => ({
        id: item.id,
        title: item.title,
        date: isoToMs(item.date),
        label: formatMilestoneDate(item.date, item.precision),
        color: item.color,
    }));

interface LifeTimelineProps {
    milestones: TimelineItem[];
    goals: TimelineItem[];
    showMilestones: boolean;
    showGoals: boolean;
    axisRtl: boolean;
    onMilestoneClick: (id: string) => void;
    onGoalClick: (id: string) => void;
}

const LifeTimeline: React.FC<LifeTimelineProps> = ({
    milestones,
    goals,
    showMilestones,
    showGoals,
    axisRtl,
    onMilestoneClick,
    onGoalClick,
}) => {
    const { t } = useTranslation();
    const trackRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const nowMs = useMemo(() => Date.now(), []);
    const [view, setView] = useState({ halfMs: ZOOM_PRESETS.years, panMs: 0 });
    const viewRef = useRef(view);
    viewRef.current = view;

    useLayoutEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        const measure = () => setWidth(el.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Screen x ↔ timeline x. The axis runs left-to-right by default (A-11);
    // the setting mirrors it for right-to-left reading.
    const toScreen = useCallback(
        (x: number) => (axisRtl ? width - x : x),
        [axisRtl, width]
    );
    const localX = useCallback(
        (clientX: number) => {
            const rect = trackRef.current?.getBoundingClientRect();
            const x = clientX - (rect?.left ?? 0);
            return axisRtl ? width - x : x;
        },
        [axisRtl, width]
    );

    // Zoom around a timeline x (the cursor, or the centre for buttons/keys).
    const zoomAt = useCallback(
        (ratio: number, x: number) => {
            if (!width) return;
            const { halfMs, panMs } = viewRef.current;
            setView(
                computePinchZoom({
                    startHalfMs: halfMs,
                    startPanMs: panMs,
                    width,
                    startMidX: x,
                    midX: x,
                    distRatio: ratio,
                })
            );
        },
        [width]
    );
    const panBy = useCallback(
        (dxTimeline: number) => {
            if (!width) return;
            const { halfMs, panMs } = viewRef.current;
            setView({
                halfMs,
                panMs: panMs - (dxTimeline * 2 * halfMs) / width,
            });
        },
        [width]
    );

    // Wheel needs a non-passive listener to keep the page from scrolling.
    // Wheel events are folded into one update per animation frame.
    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        let frame = 0;
        let pending = { zoom: 1, pan: 0, x: 0 };
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            if (horizontal || e.shiftKey)
                pending.pan -=
                    (horizontal ? e.deltaX : e.deltaY) * (axisRtl ? -1 : 1);
            else pending.zoom *= Math.exp(-e.deltaY * 0.002);
            pending.x = localX(e.clientX);
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const { zoom, pan, x } = pending;
                pending = { zoom: 1, pan: 0, x: 0 };
                if (zoom !== 1) zoomAt(zoom, x);
                if (pan) panBy(pan);
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [axisRtl, localX, panBy, zoomAt]);

    // One pointer pans; two pointers pinch-zoom with the ported math.
    const pointers = useRef(new Map<number, number>());
    const gesture = useRef<{
        startHalfMs: number;
        startPanMs: number;
        startMidX: number;
        startDist: number;
        startX: number;
        moved: boolean;
    } | null>(null);
    const suppressClick = useRef(false);

    const beginGesture = () => {
        const xs = [...pointers.current.values()];
        const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
        gesture.current = {
            startHalfMs: viewRef.current.halfMs,
            startPanMs: viewRef.current.panMs,
            startMidX: mid,
            startDist: xs.length > 1 ? Math.abs(xs[0] - xs[1]) || 1 : 1,
            startX: mid,
            moved: gesture.current?.moved ?? false,
        };
    };
    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointers.current.set(e.pointerId, localX(e.clientX));
        if (pointers.current.size === 1) suppressClick.current = false;
        beginGesture();
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!pointers.current.has(e.pointerId) || !gesture.current) return;
        pointers.current.set(e.pointerId, localX(e.clientX));
        const g = gesture.current;
        const xs = [...pointers.current.values()];
        const mid = xs.reduce((a, b) => a + b, 0) / xs.length;
        if (!g.moved && Math.abs(mid - g.startX) < DRAG_THRESHOLD) return;
        if (!g.moved) {
            g.moved = true;
            suppressClick.current = true;
            trackRef.current?.setPointerCapture?.(e.pointerId);
        }
        const dist = xs.length > 1 ? Math.abs(xs[0] - xs[1]) || 1 : 1;
        setView(
            computePinchZoom({
                startHalfMs: g.startHalfMs,
                startPanMs: g.startPanMs,
                width,
                startMidX: g.startMidX,
                midX: mid,
                distRatio: xs.length > 1 ? dist / g.startDist : 1,
            })
        );
    };
    const onPointerEnd = (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size) beginGesture();
        else gesture.current = null;
    };
    // A drag that ends on a card must not also open it.
    const guardClick = (fn: () => void) => () => {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
        fn();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        const step = width * 0.1;
        const forward = axisRtl ? -1 : 1;
        if (e.key === '+' || e.key === '=') zoomAt(1.5, width / 2);
        else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.5, width / 2);
        else if (e.key === 'ArrowRight') panBy(-step * forward);
        else if (e.key === 'ArrowLeft') panBy(step * forward);
        else if (e.key === 'Home')
            setView((v) => ({ halfMs: v.halfMs, panMs: 0 }));
        else return;
        e.preventDefault();
    };

    const { halfMs } = view;
    const startMs = nowMs + view.panMs - halfMs;
    const endMs = nowMs + view.panMs + halfMs;
    const cardWidth = cardWidthFor(width);
    const cardTimeSpan = width ? (cardWidth * 2 * halfMs) / width : 0;

    const ticks = useMemo(
        () => (width ? timelineTicks(startMs, endMs, width) : []),
        [startMs, endMs, width]
    );
    // Positions and date labels do not depend on the view, so they are
    // computed once per data change rather than on every zoom frame.
    const preparedMilestones = useMemo(() => prepare(milestones), [milestones]);
    const preparedGoals = useMemo(() => prepare(goals), [goals]);
    // Only cards near the visible range enter the O(n²) lane assignment.
    const layout = useCallback(
        (items: PreparedItem[]) =>
            assignLanes(
                items.filter(
                    (item) =>
                        item.date >= startMs - cardTimeSpan &&
                        item.date <= endMs + cardTimeSpan
                ),
                MAX_LANE,
                cardTimeSpan,
                true
            ),
        [startMs, endMs, cardTimeSpan]
    );
    const milestoneCards = useMemo(
        () => (width && showMilestones ? layout(preparedMilestones) : []),
        [layout, preparedMilestones, showMilestones, width]
    );
    const goalCards = useMemo(
        () => (width && showGoals ? layout(preparedGoals) : []),
        [layout, preparedGoals, showGoals, width]
    );

    const axisTop = LAYER_HEIGHT;
    const todayX = toScreen(dateToX(nowMs, startMs, endMs, width));

    const renderCard = (
        item: PreparedItem & { lane: number },
        layer: 'milestone' | 'goal'
    ) => {
        const x = toScreen(dateToX(item.date, startMs, endMs, width));
        const top =
            layer === 'milestone'
                ? axisTop - (item.lane + 1) * LANE_HEIGHT + 4
                : axisTop + AXIS_HEIGHT + item.lane * LANE_HEIGHT + 4;
        return (
            <button
                key={`${layer}-${item.id}`}
                type="button"
                data-testid={`life-${layer}-${item.id}`}
                onClick={guardClick(() =>
                    layer === 'milestone'
                        ? onMilestoneClick(item.id)
                        : onGoalClick(item.id)
                )}
                className={`absolute top-0 flex min-h-[44px] flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 text-start text-xs shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    layer === 'milestone'
                        ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                        : 'border-dashed border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                }`}
                style={{
                    width: cardWidth,
                    transform: `translate(${x - cardWidth / 2}px, ${top}px)`,
                    borderInlineStartColor: item.color || undefined,
                    borderInlineStartWidth: item.color ? 4 : undefined,
                }}
            >
                <bdi className="block truncate font-medium text-gray-900 dark:text-gray-100">
                    {item.title}
                </bdi>
                <bdi className="block truncate text-gray-500 dark:text-gray-400">
                    {item.label}
                </bdi>
            </button>
        );
    };

    const toolButton =
        'min-h-[44px] min-w-[44px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
    const activePreset = (Object.keys(ZOOM_PRESETS) as ZoomPreset[]).find(
        (preset) => Math.abs(ZOOM_PRESETS[preset] - halfMs) < DAY_MS
    );

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <div
                    role="group"
                    aria-label={t('ltdLife.zoomLevel', 'Zoom level')}
                    className="flex flex-wrap gap-1"
                >
                    {(Object.keys(ZOOM_PRESETS) as ZoomPreset[]).map(
                        (preset) => (
                            <button
                                key={preset}
                                type="button"
                                aria-pressed={activePreset === preset}
                                data-testid={`life-zoom-${preset}`}
                                onClick={() =>
                                    setView((v) => ({
                                        halfMs: ZOOM_PRESETS[preset],
                                        panMs: v.panMs,
                                    }))
                                }
                                className={`${toolButton} ${
                                    activePreset === preset
                                        ? 'border-blue-500 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                                        : ''
                                }`}
                            >
                                {t(`ltdLife.zoom.${preset}`, preset)}
                            </button>
                        )
                    )}
                </div>
                <div className="flex gap-1">
                    <button
                        type="button"
                        aria-label={t('ltdLife.zoomOut', 'Zoom out')}
                        data-testid="life-zoom-out"
                        onClick={() => zoomAt(1 / 1.5, width / 2)}
                        className={toolButton}
                    >
                        −
                    </button>
                    <button
                        type="button"
                        aria-label={t('ltdLife.zoomIn', 'Zoom in')}
                        data-testid="life-zoom-in"
                        onClick={() => zoomAt(1.5, width / 2)}
                        className={toolButton}
                    >
                        +
                    </button>
                    <button
                        type="button"
                        data-testid="life-today-button"
                        onClick={() =>
                            setView((v) => ({ halfMs: v.halfMs, panMs: 0 }))
                        }
                        className={toolButton}
                    >
                        {t('ltdLife.today', 'Today')}
                    </button>
                </div>
            </div>
            <div
                ref={trackRef}
                dir="ltr"
                role="group"
                tabIndex={0}
                aria-label={t(
                    'ltdLife.timelineLabel',
                    'Life timeline. Use + and − to zoom, arrow keys to move, Home for today.'
                )}
                data-testid="life-timeline"
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                style={{ height: LAYER_HEIGHT * 2 + AXIS_HEIGHT }}
            >
                <div
                    className="absolute inset-x-0 border-t border-gray-300 dark:border-gray-600"
                    style={{ top: axisTop + AXIS_HEIGHT / 2 }}
                />
                {ticks.map((tick) => (
                    <div
                        key={`${tick.x}-${tick.label}`}
                        className="absolute top-0"
                        style={{
                            transform: `translate(${toScreen(tick.x)}px, ${axisTop}px)`,
                        }}
                    >
                        <div
                            className={`w-px ${
                                tick.major
                                    ? 'h-6 bg-gray-400 dark:bg-gray-500'
                                    : 'h-3 bg-gray-300 dark:bg-gray-600'
                            }`}
                            style={{
                                transform: `translateY(${tick.major ? 12 : 18}px)`,
                            }}
                        />
                        {tick.label && (
                            <span
                                className="absolute top-0 whitespace-nowrap text-[11px] text-gray-600 dark:text-gray-300"
                                style={{
                                    transform: 'translate(-50%, 30px)',
                                }}
                            >
                                {tick.label}
                            </span>
                        )}
                    </div>
                ))}
                <div
                    aria-hidden="true"
                    data-testid="life-today"
                    className="absolute inset-y-0 top-0 w-px bg-blue-500/60"
                    style={{ transform: `translateX(${todayX}px)` }}
                />
                {milestoneCards.map((card) => renderCard(card, 'milestone'))}
                {goalCards.map((card) => renderCard(card, 'goal'))}
            </div>
        </div>
    );
};

export default LifeTimeline;
