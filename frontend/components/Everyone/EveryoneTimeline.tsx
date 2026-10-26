import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassMinusIcon,
    MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
    EveryoneTimelineResponse,
    fetchEveryoneTimeline,
} from '../../utils/everyoneService';
import { updateTask } from '../../utils/tasksService';
import { useToast } from '../Shared/ToastContext';
import TaskModal from '../Task/TaskModal';
import { columnColors, PersonAvatar } from './PeopleBoard';
import {
    TimelineItem,
    buildItems,
    dateOf,
    fromDay,
    shiftDates,
    todayDay,
    weekdayOf,
} from '../Project/Timeline/timelineLayout';

const TRACK_HEIGHT = 32;
const BAR_HEIGHT = 26;
const LOAD_HEIGHT = 34;
const LEFT_WIDTH = 200;
const HEADER_HEIGHT = 52;
const SPAN_KEY = 'everyone_timeline_days';
// Zoom steps in days, with the narrowest a day may get before the grid
// scrolls sideways
const SPANS = [7, 14, 28, 56];
const MIN_DAY_WIDTH: Record<number, number> = { 7: 80, 14: 44, 28: 22, 56: 14 };

interface Placed {
    item: TimelineItem;
    track: number;
}

interface DragState {
    uid: string;
    lane: string;
    edge: 'move' | 'start' | 'end';
    originX: number;
    delta: number;
}

// Packs bars into as few rows as possible without overlaps.
const packTracks = (items: TimelineItem[]): Placed[] => {
    const trackEnds: number[] = [];
    return items.map((item) => {
        let track = trackEnds.findIndex((end) => end < item.from);
        if (track === -1) {
            track = trackEnds.length;
            trackEnds.push(item.to);
        } else {
            trackEnds[track] = item.to;
        }
        return { item, track };
    });
};

// Planned hours per day: each estimate is spread evenly over the days its
// task covers.
const dailyLoad = (items: TimelineItem[], first: number, days: number) => {
    const load = new Array(days).fill(0);
    items.forEach((item) => {
        const minutes = item.task.estimated_minutes;
        if (!minutes) return;
        const span = item.to - item.from + 1;
        for (let day = item.from; day <= item.to; day += 1) {
            const i = day - first;
            if (i >= 0 && i < days) load[i] += minutes / 60 / span;
        }
    });
    return load;
};

const formatHours = (hours: number) =>
    hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 10) / 10}h`;

const startOfWeek = (day: number) => {
    let d = day;
    while (weekdayOf(d) !== 1) d -= 1;
    return d;
};

const EveryoneTimeline: React.FC<{ header: React.ReactNode }> = ({
    header,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [days, setDays] = useState<number>(() => {
        try {
            const saved = Number(localStorage.getItem(SPAN_KEY));
            return SPANS.includes(saved) ? saved : 14;
        } catch {
            return 14;
        }
    });
    const [first, setFirst] = useState(() => startOfWeek(todayDay()));
    const [data, setData] = useState<EveryoneTimelineResponse | null>(null);
    const [error, setError] = useState(false);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [hoverLane, setHoverLane] = useState<string | null>(null);
    const [panelTask, setPanelTask] = useState<Task | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [viewWidth, setViewWidth] = useState(0);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const measure = () => setViewWidth(el.clientWidth);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const load = useCallback(() => {
        fetchEveryoneTimeline(fromDay(first), days)
            .then((res) => {
                setData(res);
                setError(false);
            })
            .catch(() => setError(true));
    }, [first, days]);

    useEffect(() => {
        load();
    }, [load]);

    const changeDays = (next: number) => {
        setDays(next);
        try {
            localStorage.setItem(SPAN_KEY, String(next));
        } catch {
            // Only a convenience
        }
    };

    const last = first + days - 1;
    const today = todayDay();
    // Days stretch to fill the space; past a minimum width the grid scrolls
    const minDayW = MIN_DAY_WIDTH[days];
    const dayW = viewWidth
        ? Math.max(minDayW, (viewWidth - LEFT_WIDTH) / days)
        : minDayW * 1.5;
    const spanIndex = SPANS.indexOf(days);
    const spanLabels: Record<number, string> = {
        7: t('everyoneTimeline.oneWeek', '1 week'),
        14: t('everyoneTimeline.twoWeeks', '2 weeks'),
        28: t('everyoneTimeline.fourWeeks', '4 weeks'),
        56: t('everyoneTimeline.eightWeeks', '8 weeks'),
    };
    const width = days * dayW;
    const capacity = data
        ? (data.day_hours.end - data.day_hours.start) / 60
        : 8;

    const colors = useMemo(
        () => columnColors(data?.lanes || []),
        [data?.lanes]
    );

    const lanes = useMemo(
        () =>
            (data?.lanes || []).map((lane) => {
                const { items } = buildItems(lane.tasks);
                const clipped = items.map((item) => ({
                    ...item,
                    from: Math.max(item.from, first),
                    to: Math.min(item.to, last),
                }));
                const placed = packTracks(clipped);
                const tracks = Math.max(1, ...placed.map((p) => p.track + 1));
                const loadByDay = dailyLoad(items, first, days);
                const planned = loadByDay.reduce((a, b) => a + b, 0);
                const overDays = loadByDay.filter((h) => h > capacity).length;
                return {
                    lane,
                    placed,
                    tracks,
                    loadByDay,
                    planned,
                    overDays,
                };
            }),
        [data, first, last, days, capacity]
    );

    const dayList = Array.from({ length: days }, (_, i) => first + i);

    const handlePointerDown = (
        e: React.PointerEvent,
        item: TimelineItem,
        laneUid: string
    ) => {
        if (e.button !== 0 || !item.task.uid) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const edge = (e.target as HTMLElement).dataset?.edge;
        setDrag({
            uid: item.task.uid,
            lane: laneUid,
            edge: edge === 'start' || edge === 'end' ? edge : 'move',
            originX: e.clientX,
            delta: 0,
        });
    };

    const laneAt = (clientX: number, clientY: number) => {
        const els = document.elementsFromPoint(clientX, clientY);
        const laneEl = els.find(
            (el) => (el as HTMLElement).dataset?.laneUid
        ) as HTMLElement | undefined;
        return laneEl?.dataset.laneUid ?? null;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!drag) return;
        const delta = Math.round((e.clientX - drag.originX) / dayW);
        if (delta !== drag.delta) setDrag({ ...drag, delta });
        if (drag.edge === 'move') setHoverLane(laneAt(e.clientX, e.clientY));
    };

    const handlePointerUp = async (
        e: React.PointerEvent,
        task: Task,
        original: TimelineItem
    ) => {
        if (!drag) return;
        const { delta, lane, edge } = drag;
        const target = edge === 'move' ? laneAt(e.clientX, e.clientY) : null;
        setDrag(null);
        setHoverLane(null);
        const moved = delta !== 0;
        const reassigned = !!target && target !== lane;
        if (!moved && !reassigned) {
            if (edge === 'move') setPanelTask(task);
            return;
        }
        const payload: Partial<Task> = {};
        if (moved) {
            Object.assign(payload, shiftDates(original, delta, edge));
            if (payload.start_date && task.start_time)
                payload.start_time = task.start_time;
            if (payload.due_date && task.due_has_time && task.due_time)
                payload.due_time = task.due_time;
        }
        if (reassigned) payload.assigned_to = target;
        try {
            await updateTask(task.uid!, payload);
        } catch (err: any) {
            showErrorToast(
                err?.message ||
                    t('projectTimeline.saveError', 'Could not move the task')
            );
        }
        load();
    };

    // Unclipped item for a task, so a drag shifts its real dates
    const originalItem = (task: Task) => buildItems([task]).items[0];

    return (
        <div
            className="h-full flex flex-col overflow-hidden px-4 sm:px-6 lg:px-8"
            data-testid="everyone-timeline"
        >
            {header}

            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label={t('everyoneTimeline.earlier', 'Earlier')}
                        onClick={() => setFirst((d) => d - 7)}
                        className="rounded-lg bg-white p-1.5 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setFirst(startOfWeek(todayDay()))}
                        className="rounded-lg bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        {t('sidebar.today', 'Today')}
                    </button>
                    <button
                        type="button"
                        aria-label={t('everyoneTimeline.later', 'Later')}
                        onClick={() => setFirst((d) => d + 7)}
                        className="rounded-lg bg-white p-1.5 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                    <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        {format(dateOf(first), 'MMM d')} –{' '}
                        {format(dateOf(last), 'MMM d')}
                    </span>
                </div>
                <div
                    role="group"
                    aria-label={t('projectTimeline.scale', 'Scale')}
                    className="flex items-center rounded-lg bg-gray-200/70 p-0.5 dark:bg-gray-800"
                >
                    <button
                        type="button"
                        aria-label={t('everyoneTimeline.zoomIn', 'Zoom in')}
                        title={t('everyoneTimeline.zoomIn', 'Zoom in')}
                        disabled={spanIndex <= 0}
                        onClick={() => changeDays(SPANS[spanIndex - 1])}
                        className="rounded-md p-1.5 text-gray-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        <MagnifyingGlassPlusIcon className="h-4 w-4" />
                    </button>
                    <span
                        className="min-w-[4.5rem] text-center text-sm font-medium text-gray-700 dark:text-gray-200"
                        data-testid="everyone-timeline-span"
                    >
                        {spanLabels[days]}
                    </span>
                    <button
                        type="button"
                        aria-label={t('everyoneTimeline.zoomOut', 'Zoom out')}
                        title={t('everyoneTimeline.zoomOut', 'Zoom out')}
                        disabled={spanIndex >= SPANS.length - 1}
                        onClick={() => changeDays(SPANS[spanIndex + 1])}
                        className="rounded-md p-1.5 text-gray-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        <MagnifyingGlassMinusIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded-xl bg-white p-4 text-sm text-red-600 dark:bg-gray-800 dark:text-red-400">
                    {t(
                        'everyoneTimeline.loadError',
                        'Could not load the timeline.'
                    )}
                </div>
            )}

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-6">
                <div
                    className="rounded-xl bg-white shadow-sm dark:bg-gray-900"
                    style={{ width: LEFT_WIDTH + width }}
                    onPointerMove={handlePointerMove}
                >
                    <div className="sticky top-0 z-20 flex rounded-t-xl bg-white dark:bg-gray-900">
                        <div
                            className="sticky left-0 z-10 flex items-end bg-white px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                            style={{ width: LEFT_WIDTH, height: HEADER_HEIGHT }}
                        >
                            {t('everyone.people', 'People')}
                        </div>
                        <div
                            className="relative"
                            style={{ width, height: HEADER_HEIGHT }}
                        >
                            {dayList.map((day, i) =>
                                i === 0 || weekdayOf(day) === 1 ? (
                                    <div
                                        key={`wk-${day}`}
                                        className="absolute top-1.5 truncate pl-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                                        style={{
                                            left: i * dayW,
                                            width:
                                                Math.min(
                                                    7 -
                                                        ((weekdayOf(day) + 6) %
                                                            7),
                                                    days - i
                                                ) * dayW,
                                        }}
                                    >
                                        {format(dateOf(day), 'MMM d')}
                                    </div>
                                ) : null
                            )}
                            {dayList.map((day, i) => {
                                const weekday = weekdayOf(day);
                                const weekend = weekday === 0 || weekday === 6;
                                return (
                                    <div
                                        key={day}
                                        className={`absolute bottom-0 flex h-7 items-center justify-center gap-1 whitespace-nowrap text-[11px] tabular-nums ${
                                            day === today
                                                ? 'font-bold text-blue-700 dark:text-blue-400'
                                                : 'text-gray-500 dark:text-gray-400'
                                        } ${weekend ? 'bg-gray-500/[0.06] dark:bg-white/[0.04]' : ''}`}
                                        style={{ left: i * dayW, width: dayW }}
                                    >
                                        {dayW >= 36 && (
                                            <span>
                                                {format(
                                                    dateOf(day),
                                                    dayW >= 56 ? 'EEE' : 'EEEEE'
                                                )}
                                            </span>
                                        )}
                                        {(dayW >= 18 ||
                                            weekday === 1 ||
                                            day === today) && (
                                            <span>
                                                {format(dateOf(day), 'd')}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {lanes.map(
                        (
                            {
                                lane,
                                placed,
                                tracks,
                                loadByDay,
                                planned,
                                overDays,
                            },
                            laneIndex
                        ) => {
                            const color = colors[lane.person.uid];
                            const bodyH = 8 + tracks * TRACK_HEIGHT;
                            const isTarget =
                                !!drag &&
                                hoverLane === lane.person.uid &&
                                drag.lane !== lane.person.uid;
                            const band =
                                laneIndex % 2
                                    ? 'bg-gray-50 dark:bg-gray-800/40'
                                    : 'bg-white dark:bg-gray-900';
                            return (
                                <div
                                    key={lane.person.uid}
                                    data-lane-uid={lane.person.uid}
                                    data-testid={`timeline-lane-${lane.person.uid}`}
                                    className={`flex ${band}`}
                                    style={
                                        isTarget
                                            ? { backgroundColor: `${color}1f` }
                                            : undefined
                                    }
                                >
                                    <div
                                        className={`sticky left-0 z-10 flex items-start gap-2.5 px-4 py-3 ${band}`}
                                        style={{ width: LEFT_WIDTH }}
                                    >
                                        <PersonAvatar
                                            name={lane.person.name}
                                            color={color}
                                        />
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                {lane.is_self
                                                    ? t('everyone.you', 'You')
                                                    : lane.person.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {t(
                                                    'everyoneTimeline.planned',
                                                    '{{hours}} planned',
                                                    {
                                                        hours: formatHours(
                                                            planned
                                                        ),
                                                    }
                                                )}
                                                {overDays > 0 &&
                                                    ` · ${t(
                                                        'everyoneTimeline.daysOver',
                                                        '{{count}} days over',
                                                        { count: overDays }
                                                    )}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        className="relative"
                                        style={{
                                            width,
                                            height: bodyH + LOAD_HEIGHT,
                                        }}
                                    >
                                        {dayList.map((day) => {
                                            const weekday = weekdayOf(day);
                                            if (weekday !== 0 && weekday !== 6)
                                                return null;
                                            return (
                                                <div
                                                    key={`w-${day}`}
                                                    className="absolute inset-y-0 bg-gray-500/[0.06] dark:bg-white/[0.04]"
                                                    style={{
                                                        left:
                                                            (day - first) *
                                                            dayW,
                                                        width: dayW,
                                                    }}
                                                />
                                            );
                                        })}
                                        {today >= first && today <= last && (
                                            <div
                                                className="absolute inset-y-0 w-0.5 bg-blue-600 dark:bg-blue-400"
                                                style={{
                                                    left:
                                                        (today - first) * dayW,
                                                }}
                                            />
                                        )}
                                        {placed.map(({ item, track }) => {
                                            const dragging =
                                                drag?.uid === item.task.uid;
                                            const shift = dragging
                                                ? drag!.delta * dayW
                                                : 0;
                                            const edge = dragging
                                                ? drag!.edge
                                                : 'move';
                                            const original = originalItem(
                                                item.task
                                            );
                                            // Resizing is only offered on ends
                                            // that are inside the window
                                            const canResize =
                                                item.kind === 'range' &&
                                                (item.to - item.from + 1) *
                                                    dayW >=
                                                    40;
                                            const startHandle =
                                                canResize &&
                                                original.from >= first;
                                            const endHandle =
                                                canResize &&
                                                original.to <= last;
                                            const leftShift =
                                                edge === 'end' ? 0 : shift;
                                            const widthShift =
                                                edge === 'start'
                                                    ? -shift
                                                    : edge === 'end'
                                                      ? shift
                                                      : 0;
                                            const span =
                                                item.to - item.from + 1;
                                            const est = item.task
                                                .estimated_minutes
                                                ? formatHours(
                                                      item.task
                                                          .estimated_minutes /
                                                          60
                                                  )
                                                : '';
                                            const label = `${item.task.name}${
                                                item.task.Project?.name
                                                    ? ` · ${item.task.Project.name}`
                                                    : ''
                                            }${est ? ` · ${est}` : ''}`;
                                            return (
                                                <button
                                                    key={item.task.uid}
                                                    type="button"
                                                    title={label}
                                                    aria-label={label}
                                                    onPointerDown={(e) =>
                                                        handlePointerDown(
                                                            e,
                                                            item,
                                                            lane.person.uid
                                                        )
                                                    }
                                                    onPointerUp={(e) =>
                                                        handlePointerUp(
                                                            e,
                                                            item.task,
                                                            original
                                                        )
                                                    }
                                                    className={`group absolute flex touch-none items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md px-2 text-left text-xs font-medium text-gray-900 dark:text-gray-100 ${
                                                        dragging
                                                            ? 'z-10 cursor-grabbing shadow-lg'
                                                            : 'cursor-grab'
                                                    } ${item.kind === 'due' ? 'justify-center' : ''}`}
                                                    style={{
                                                        left:
                                                            (item.from -
                                                                first) *
                                                                dayW +
                                                            3 +
                                                            leftShift,
                                                        width: Math.max(
                                                            dayW - 6,
                                                            span * dayW -
                                                                6 +
                                                                widthShift
                                                        ),
                                                        top:
                                                            8 +
                                                            track *
                                                                TRACK_HEIGHT,
                                                        height: BAR_HEIGHT,
                                                        backgroundColor: `${color}${item.kind === 'start' ? '22' : '38'}`,
                                                    }}
                                                >
                                                    {startHandle && (
                                                        <span
                                                            data-edge="start"
                                                            className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md group-hover:bg-black/10 dark:group-hover:bg-white/20"
                                                        />
                                                    )}
                                                    {endHandle && (
                                                        <span
                                                            data-edge="end"
                                                            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md group-hover:bg-black/10 dark:group-hover:bg-white/20"
                                                        />
                                                    )}
                                                    {item.kind === 'due' && (
                                                        <span
                                                            className="h-2 w-2 flex-shrink-0 rotate-45"
                                                            style={{
                                                                backgroundColor:
                                                                    color,
                                                            }}
                                                        />
                                                    )}
                                                    <span className="truncate">
                                                        {item.task.name}
                                                    </span>
                                                    {est &&
                                                        span * dayW > 110 && (
                                                            <span className="ml-auto flex-shrink-0 text-[11px] text-gray-600 dark:text-gray-300">
                                                                {est}
                                                            </span>
                                                        )}
                                                </button>
                                            );
                                        })}
                                        <div
                                            className="absolute inset-x-0 flex"
                                            style={{
                                                top: bodyH + 4,
                                                height: LOAD_HEIGHT - 10,
                                            }}
                                        >
                                            {loadByDay.map((hours, i) => {
                                                const over = hours > capacity;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="px-0.5"
                                                        style={{ width: dayW }}
                                                    >
                                                        {hours > 0 && (
                                                            <div
                                                                className={`flex h-full items-center justify-center rounded text-[11px] font-semibold tabular-nums ${
                                                                    over
                                                                        ? 'bg-orange-200 text-orange-900 dark:bg-orange-500/30 dark:text-orange-100'
                                                                        : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-100'
                                                                }`}
                                                                title={t(
                                                                    'everyoneTimeline.loadTitle',
                                                                    '{{hours}} of {{capacity}} planned',
                                                                    {
                                                                        hours: formatHours(
                                                                            hours
                                                                        ),
                                                                        capacity:
                                                                            formatHours(
                                                                                capacity
                                                                            ),
                                                                    }
                                                                )}
                                                            >
                                                                {dayW >= 40
                                                                    ? formatHours(
                                                                          hours
                                                                      )
                                                                    : dayW >= 22
                                                                      ? Math.round(
                                                                            hours
                                                                        )
                                                                      : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    )}
                </div>

                <div className="mt-3 flex flex-wrap gap-4 px-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-7 rounded bg-indigo-50 dark:bg-indigo-500/20" />
                        {t(
                            'everyoneTimeline.legendLoad',
                            'Hours from task estimates, spread from start to due'
                        )}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-7 rounded bg-orange-200 dark:bg-orange-500/30" />
                        {t(
                            'everyoneTimeline.legendOver',
                            'More than your {{hours}} planning day',
                            { hours: formatHours(capacity) }
                        )}
                    </span>
                    <span>
                        {t(
                            'everyoneTimeline.dragHint',
                            'Drag a bar to move it, its ends to change the dates, or onto another person to assign it'
                        )}
                    </span>
                </div>
            </div>
            {panelTask && (
                <TaskModal
                    isOpen
                    onClose={() => setPanelTask(null)}
                    task={panelTask}
                    onSaved={load}
                />
            )}
        </div>
    );
};

export default EveryoneTimeline;
