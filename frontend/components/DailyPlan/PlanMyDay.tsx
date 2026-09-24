import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CollisionDetection,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    pointerWithin,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Task } from '../../entities/Task';
import {
    DailyPlanItem,
    InboxCandidate,
    PlanCandidates,
    fetchDailyPlan,
    fetchPlanCandidates,
    saveDailyPlanItems,
    startDailyPlan,
    toPlanItemInputs,
    draftDayWithAi,
    estimateWithAi,
} from '../../utils/dailyPlanService';
import {
    CalendarEvent,
    fetchCalendarEvents,
} from '../../utils/calendarFeedsService';
import { createTask, updateTask } from '../../utils/tasksService';
import { processInboxItem } from '../../utils/inboxService';
import { getUserTimezone } from '../../utils/dateUtils';
import { TASK_STATUS } from '../../constants/taskStatus';
import { useToast } from '../Shared/ToastContext';
import { useStore } from '../../store/useStore';
import { SparklesIcon } from '@heroicons/react/24/outline';
import PlanTips from './PlanTips';
import { buildTips, rescheduleMissed } from './tips';
import CandidateList, { CandidateFilter } from './CandidateList';
import DayTimeline, { PX_PER_MINUTE } from './DayTimeline';
import PlanList from './PlanList';
import {
    DEFAULT_DURATION,
    SLOT_MINUTES,
    busyMinutes,
    dayRange,
    findFreeSlot,
    formatDuration,
    minuteOfDay,
    overlapsItems,
    plannedMinutes,
} from './planUtils';

type Mode = 'timeline' | 'list';
const MODE_KEY = 'dailyPlanMode';
const SAVE_DELAY_MS = 500;

const readMode = (): Mode => {
    try {
        return localStorage.getItem(MODE_KEY) === 'list' ? 'list' : 'timeline';
    } catch {
        return 'timeline';
    }
};

const useIsNarrow = () => {
    const query = '(max-width: 767px)';
    const [narrow, setNarrow] = useState(
        () =>
            typeof window !== 'undefined' && window.matchMedia?.(query).matches
    );
    useEffect(() => {
        const media = window.matchMedia?.(query);
        if (!media) return;
        const update = () => setNarrow(media.matches);
        media.addEventListener?.('change', update);
        return () => media.removeEventListener?.('change', update);
    }, []);
    return !!narrow;
};

const addDays = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Pointer position for drops; keyboard drags have none.
const pointerY = (event: Event | null): number | null => {
    if (!event) return null;
    if ('clientY' in event && typeof event.clientY === 'number') {
        return event.clientY;
    }
    if ('touches' in event) {
        const touch = (event as TouchEvent).touches[0];
        return touch ? touch.clientY : null;
    }
    return null;
};

const collisionDetection: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : closestCenter(args);
};

const PlanMyDay: React.FC = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { showErrorToast, showSuccessToast } = useToast();
    const narrow = useIsNarrow();

    const [date, setDate] = useState<string | null>(null);
    const [started, setStarted] = useState(false);
    const [items, setItems] = useState<DailyPlanItem[]>([]);
    const [candidates, setCandidates] = useState<PlanCandidates | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [durations, setDurations] = useState<Record<string, number>>({});
    const [filter, setFilter] = useState<CandidateFilter>('all');
    const [preferredMode, setPreferredMode] = useState<Mode>(readMode);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>(
        'idle'
    );
    const [dragLabel, setDragLabel] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [leaving, setLeaving] = useState(false);
    const [now, setNow] = useState(() =>
        minuteOfDay(new Date(), getUserTimezone())
    );
    const aiEnabled = useStore(
        (state) => state.userSettingsStore.aiAssistantEnabled
    );
    const [aiEstimates, setAiEstimates] = useState<Record<string, number>>({});
    const [aiDraft, setAiDraft] = useState<{
        summary: string;
        skipped: { task_uid: string; name: string; reason: string }[];
        previous: DailyPlanItem[];
        reasons: Record<string, string>;
    } | null>(null);
    const [drafting, setDrafting] = useState(false);
    const [draftChoiceOpen, setDraftChoiceOpen] = useState(false);

    const mode: Mode = narrow ? 'list' : preferredMode;
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pending = useRef<DailyPlanItem[] | null>(null);

    useEffect(() => {
        const timer = setInterval(
            () => setNow(minuteOfDay(new Date(), getUserTimezone())),
            60 * 1000
        );
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [planResponse, candidateList] = await Promise.all([
                    fetchDailyPlan(),
                    fetchPlanCandidates(),
                ]);
                if (cancelled) return;
                setDate(planResponse.date);
                setStarted(!!planResponse.plan?.started_at);
                setItems(planResponse.plan?.items ?? []);
                setCandidates(candidateList);
                const day = await fetchCalendarEvents(planResponse.date).catch(
                    () => null
                );
                if (!cancelled && day) setEvents(day.events);
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : t('dailyPlan.loadError', 'Could not load today.')
                    );
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const flush = useCallback(async () => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
        }
        const next = pending.current;
        if (!next || !date) return true;
        pending.current = null;
        setSaveState('saving');
        try {
            await saveDailyPlanItems(date, toPlanItemInputs(next));
            setSaveState('idle');
            return true;
        } catch (err) {
            setSaveState('error');
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('dailyPlan.saveError', 'Could not save the plan.')
            );
            return false;
        }
    }, [date, showErrorToast, t]);

    // Every change saves itself shortly after the last edit.
    const persist = useCallback(
        (next: DailyPlanItem[]) => {
            setItems(next);
            pending.current = next;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                flush();
            }, SAVE_DELAY_MS);
        },
        [flush]
    );

    useEffect(
        () => () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
        },
        []
    );

    // One AI call for rough lengths of the tasks that have none yet.
    const estimatesRequested = useRef(false);
    useEffect(() => {
        if (!aiEnabled || !candidates || estimatesRequested.current) return;
        estimatesRequested.current = true;
        const uids = [
            ...candidates.overdue,
            ...candidates.due_today,
            ...candidates.in_progress,
            ...candidates.suggested,
        ]
            .filter((task) => task.uid && !task.estimated_minutes)
            .map((task) => task.uid as string)
            .slice(0, 40);
        if (uids.length === 0) return;
        let cancelled = false;
        estimateWithAi(uids)
            .then((estimates) => {
                if (!cancelled) setAiEstimates(estimates);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [aiEnabled, candidates]);

    const range = useMemo(() => dayRange(items, events), [items, events]);
    const freeMinutes = Math.max(
        0,
        range.end - range.start - busyMinutes(events, range)
    );
    const planned = plannedMinutes(items);
    const plannedMap = useMemo(
        () => new Map(items.map((item) => [item.task_uid, item])),
        [items]
    );

    const setMode = (next: Mode) => {
        setPreferredMode(next);
        try {
            localStorage.setItem(MODE_KEY, next);
        } catch {
            // Remembering the mode is a convenience only.
        }
    };

    const durationFor = (task: Task) =>
        (task.uid && durations[task.uid]) ||
        task.estimated_minutes ||
        (task.uid && aiEstimates[task.uid]) ||
        DEFAULT_DURATION;

    const addTask = useCallback(
        (task: Task, startMinute?: number | null, index?: number) => {
            if (!task.uid || plannedMap.has(task.uid)) return;
            const duration = durationFor(task);
            let start = startMinute ?? null;
            if (startMinute === undefined && mode === 'timeline') {
                start = findFreeSlot(
                    items,
                    events,
                    duration,
                    range,
                    Math.max(now, range.start)
                );
                if (start === null) {
                    showSuccessToast(
                        t(
                            'dailyPlan.noFreeSlot',
                            'No free slot left today, so it was added without a time.'
                        )
                    );
                }
            }
            const item: DailyPlanItem = {
                task_uid: task.uid,
                position: items.length,
                start_minute: start,
                duration_minutes: duration,
                task,
            };
            const next = [...items];
            next.splice(index ?? next.length, 0, item);
            persist(next);

            // The chosen length becomes the task's rough estimate.
            if (task.estimated_minutes !== duration) {
                updateTask(task.uid, { estimated_minutes: duration }).catch(
                    () => undefined
                );
            }
        },
        [
            items,
            events,
            range,
            now,
            mode,
            durations,
            aiEstimates,
            plannedMap,
            persist,
            t,
        ]
    );

    const removeItem = (taskUid: string) =>
        persist(items.filter((item) => item.task_uid !== taskUid));

    const updateItem = (taskUid: string, changes: Partial<DailyPlanItem>) =>
        persist(
            items.map((item) =>
                item.task_uid === taskUid ? { ...item, ...changes } : item
            )
        );

    const placeItem = (
        taskUid: string,
        start: number | null,
        duration?: number
    ) => {
        const item = plannedMap.get(taskUid);
        if (!item) return;
        const length = duration ?? item.duration_minutes;
        if (start !== null && overlapsItems(items, start, length, taskUid)) {
            showErrorToast(
                t('dailyPlan.slotTaken', 'That time overlaps another task.')
            );
            return;
        }
        updateItem(taskUid, { start_minute: start, duration_minutes: length });
    };

    const removeCandidate = (taskUid: string) =>
        setCandidates((current) =>
            current
                ? {
                      ...current,
                      in_progress: current.in_progress.filter(
                          (x) => x.uid !== taskUid
                      ),
                      overdue: current.overdue.filter((x) => x.uid !== taskUid),
                      due_today: current.due_today.filter(
                          (x) => x.uid !== taskUid
                      ),
                      suggested: current.suggested.filter(
                          (x) => x.uid !== taskUid
                      ),
                  }
                : current
        );

    const handleReschedule = async (
        task: Task,
        when: 'tomorrow' | 'next_week'
    ) => {
        if (!task.uid || !date) return;
        try {
            await updateTask(task.uid, {
                due_date: addDays(date, when === 'tomorrow' ? 1 : 7),
            });
            removeCandidate(task.uid);
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('errors.generic', 'Something went wrong')
            );
        }
    };

    const handleDrop = async (task: Task) => {
        if (!task.uid) return;
        try {
            await updateTask(task.uid, { status: TASK_STATUS.CANCELLED });
            removeCandidate(task.uid);
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('errors.generic', 'Something went wrong')
            );
        }
    };

    const handleAddInbox = async (entry: InboxCandidate) => {
        try {
            const task = await createTask({
                name: (entry.title || entry.content).trim(),
                status: TASK_STATUS.NOT_STARTED,
                completed_at: null,
            });
            await processInboxItem(entry.uid);
            setCandidates((current) =>
                current
                    ? {
                          ...current,
                          inbox: current.inbox.filter(
                              (i) => i.uid !== entry.uid
                          ),
                          inbox_count: Math.max(0, current.inbox_count - 1),
                          suggested: [task, ...current.suggested],
                      }
                    : current
            );
            addTask(task);
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('errors.generic', 'Something went wrong')
            );
        }
    };

    const runDraft = async (draftMode: 'fill' | 'replace') => {
        if (!date) return;
        setDraftChoiceOpen(false);
        setDrafting(true);
        try {
            const draft = await draftDayWithAi(date, draftMode);
            if (draft.items.length === 0) {
                showSuccessToast(
                    t(
                        'dailyPlan.ai.nothingToAdd',
                        'Nothing to add: there is no free time or no task to plan.'
                    )
                );
                return;
            }
            const previous = items;
            const drafted: DailyPlanItem[] = draft.items.map((item, i) => ({
                task_uid: item.task_uid,
                position: i,
                start_minute: item.start_minute,
                duration_minutes: item.duration_minutes,
                task: item.task,
            }));
            persist(draftMode === 'fill' ? [...items, ...drafted] : drafted);
            setAiDraft({
                summary: draft.summary,
                skipped: draft.skipped,
                previous,
                reasons: Object.fromEntries(
                    draft.items.map((item) => [item.task_uid, item.reason])
                ),
            });
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('dailyPlan.ai.draftError', 'Could not draft the day.')
            );
        } finally {
            setDrafting(false);
        }
    };

    const startDraft = () => {
        if (items.length === 0) {
            void runDraft('replace');
        } else {
            setDraftChoiceOpen((open) => !open);
        }
    };

    const undoDraft = () => {
        if (!aiDraft) return;
        persist(aiDraft.previous);
        setAiDraft(null);
    };

    const allCandidates = useMemo(
        () =>
            candidates
                ? [
                      ...candidates.overdue,
                      ...candidates.due_today,
                      ...candidates.in_progress,
                      ...candidates.suggested,
                  ]
                : [],
        [candidates]
    );

    const tips = aiEnabled
        ? buildTips({
              items,
              events,
              candidates: allCandidates,
              range,
              now,
              durationFor,
          })
        : [];

    const leave = async (start: boolean) => {
        if (!date) return;
        setLeaving(true);
        const saved = await flush();
        if (!saved) {
            setLeaving(false);
            return;
        }
        try {
            if (start) await startDailyPlan(date);
            navigate('/today');
        } catch (err) {
            setLeaving(false);
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('dailyPlan.saveError', 'Could not save the plan.')
            );
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current as
            | { type: 'candidate'; task: Task }
            | { type: 'item'; item: DailyPlanItem }
            | undefined;
        if (!data) return;
        // Timeline blocks and list rows move themselves; only cards leaving
        // the left column and untimed tray items need a floating preview.
        if (data.type === 'candidate') {
            setDragLabel(data.task.name);
        } else if (mode === 'timeline' && data.item.start_minute === null) {
            setDragLabel(data.item.task.name);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setDragLabel(null);
        const { active, over, delta, activatorEvent } = event;
        const data = active.data.current as
            | { type: 'candidate'; task: Task; duration: number }
            | { type: 'item'; item: DailyPlanItem }
            | undefined;
        if (!data || !over) return;
        const overId = String(over.id);

        if (overId === 'candidates') {
            if (data.type === 'item') removeItem(data.item.task_uid);
            return;
        }

        if (overId === 'timeline') {
            const duration =
                data.type === 'candidate'
                    ? durationFor(data.task)
                    : data.item.duration_minutes;
            let start: number;
            if (data.type === 'item' && data.item.start_minute !== null) {
                start = data.item.start_minute + delta.y / PX_PER_MINUTE;
            } else {
                const y = pointerY(activatorEvent);
                if (y === null) {
                    if (data.type === 'candidate') addTask(data.task);
                    return;
                }
                start =
                    range.start + (y + delta.y - over.rect.top) / PX_PER_MINUTE;
            }
            start = Math.round(start / SLOT_MINUTES) * SLOT_MINUTES;
            start = Math.max(
                range.start,
                Math.min(range.end - duration, start)
            );

            if (data.type === 'candidate') {
                if (overlapsItems(items, start, duration)) {
                    showErrorToast(
                        t(
                            'dailyPlan.slotTaken',
                            'That time overlaps another task.'
                        )
                    );
                    return;
                }
                addTask(data.task, start);
            } else {
                placeItem(data.item.task_uid, start);
            }
            return;
        }

        // List mode: reorder, or insert a candidate where it was dropped.
        const overIndex = overId.startsWith('item:')
            ? items.findIndex((item) => `item:${item.task_uid}` === overId)
            : items.length;
        if (data.type === 'candidate') {
            addTask(data.task, null, overIndex < 0 ? items.length : overIndex);
            return;
        }
        const fromIndex = items.findIndex(
            (item) => item.task_uid === data.item.task_uid
        );
        if (fromIndex >= 0 && overIndex >= 0 && fromIndex !== overIndex) {
            persist(
                arrayMove(
                    items,
                    fromIndex,
                    Math.min(overIndex, items.length - 1)
                )
            );
        }
    };

    const dateLabel = date
        ? new Intl.DateTimeFormat(i18n.language, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
          }).format(new Date(`${date}T12:00:00`))
        : '';
    const capacity =
        freeMinutes > 0 ? Math.min(100, (planned / freeMinutes) * 100) : 0;
    const overBooked = planned > freeMinutes;

    if (error) {
        return (
            <div className="flex items-center justify-center p-6">
                <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragLabel(null)}
        >
            <div className="flex h-full w-full flex-col gap-4 px-4 pb-4 pt-4 sm:px-6 lg:px-8">
                <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h2 className="text-2xl font-light">
                            {t('dailyPlan.planTitle', 'Plan {{date}}', {
                                date: dateLabel,
                            })}
                        </h2>
                        <span className="text-[13px] text-gray-600 dark:text-gray-400">
                            {mode === 'timeline'
                                ? t(
                                      'dailyPlan.planHintTimeline',
                                      'Add tasks from the left, drag them into free time on the right'
                                  )
                                : t(
                                      'dailyPlan.planHintList',
                                      'Add tasks from the left and put them in the order you will do them'
                                  )}
                        </span>
                    </div>

                    <div
                        className="flex w-56 flex-col gap-1.5"
                        data-testid="capacity"
                    >
                        <div className="flex justify-between text-[13px]">
                            <span
                                className={
                                    overBooked
                                        ? 'font-medium text-red-700 dark:text-red-400'
                                        : 'text-gray-700 dark:text-gray-300'
                                }
                            >
                                {t('dailyPlan.planned', '{{time}} planned', {
                                    time: formatDuration(planned),
                                })}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                                {t('dailyPlan.ofFree', 'of {{time}} free', {
                                    time: formatDuration(freeMinutes),
                                })}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                                className={`h-1.5 rounded-full ${overBooked ? 'bg-red-600' : 'bg-blue-600'}`}
                                style={{ width: `${capacity}%` }}
                            />
                        </div>
                    </div>

                    {aiEnabled && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={startDraft}
                                disabled={drafting || !date}
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-[13px] font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                                data-testid="ai-draft-button"
                            >
                                <SparklesIcon
                                    className={`h-4 w-4 ${drafting ? 'animate-pulse' : ''}`}
                                />
                                {drafting
                                    ? t('dailyPlan.ai.drafting', 'Drafting…')
                                    : t('dailyPlan.ai.draft', 'Draft with AI')}
                            </button>
                            {draftChoiceOpen && (
                                <div className="absolute right-0 z-40 mt-1 flex w-56 flex-col rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                                    <button
                                        type="button"
                                        onClick={() => void runDraft('fill')}
                                        className="rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <span className="block font-medium">
                                            {t(
                                                'dailyPlan.ai.fill',
                                                'Fill free time'
                                            )}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'dailyPlan.ai.fillHint',
                                                'Keep what is planned, add around it'
                                            )}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void runDraft('replace')}
                                        className="rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        <span className="block font-medium">
                                            {t(
                                                'dailyPlan.ai.replace',
                                                'Start over'
                                            )}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                                            {t(
                                                'dailyPlan.ai.replaceHint',
                                                'Draft the whole day again (you can undo)'
                                            )}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {!narrow && (
                        <div
                            className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
                            role="group"
                            aria-label={t('dailyPlan.viewMode', 'View')}
                        >
                            {(['timeline', 'list'] as Mode[]).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    aria-pressed={mode === option}
                                    onClick={() => setMode(option)}
                                    className={`min-h-[34px] rounded-md px-3.5 text-[13px] ${
                                        mode === option
                                            ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                                            : 'text-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    {option === 'timeline'
                                        ? t('dailyPlan.timeline', 'Timeline')
                                        : t('dailyPlan.list', 'List')}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        {saveState === 'saving' && (
                            <span className="text-xs text-gray-500">
                                {t('dailyPlan.saving', 'Saving…')}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => leave(false)}
                            disabled={leaving}
                            className="text-sm text-gray-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-gray-400"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => leave(true)}
                            disabled={leaving || !date}
                            className="min-h-[44px] rounded-lg bg-blue-600 px-5 text-[15px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            data-testid="start-my-day"
                        >
                            {started
                                ? t('dailyPlan.doneReplanning', 'Done')
                                : t('dailyPlan.startMyDay', 'Start my day')}
                        </button>
                    </div>
                </header>

                {!candidates ? (
                    <p className="p-8 text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto md:flex-row md:overflow-hidden">
                        <aside className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-5 sm:px-5 md:w-[420px] md:overflow-y-auto dark:border-gray-800 dark:bg-gray-900">
                            <CandidateList
                                candidates={candidates}
                                planned={plannedMap}
                                filter={filter}
                                onFilterChange={setFilter}
                                durations={durations}
                                aiEstimates={aiEnabled ? aiEstimates : {}}
                                onDurationChange={(uid, minutes) =>
                                    setDurations((d) => ({
                                        ...d,
                                        [uid]: minutes,
                                    }))
                                }
                                onAdd={(task) => addTask(task)}
                                onRemove={removeItem}
                                onReschedule={handleReschedule}
                                onDrop={handleDrop}
                                onAddInbox={handleAddInbox}
                                today={date ?? ''}
                            />
                        </aside>
                        <section className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-5 sm:px-6 md:overflow-y-auto dark:border-gray-800 dark:bg-gray-900">
                            {aiDraft && (
                                <section
                                    className="mb-3 flex flex-col gap-2.5 rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-900/60 dark:bg-violet-900/15"
                                    data-testid="ai-draft-banner"
                                >
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon className="h-4 w-4 shrink-0 text-violet-700 dark:text-violet-300" />
                                        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                                            {t(
                                                'dailyPlan.ai.draftTitle',
                                                'AI draft'
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={undoDraft}
                                            className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800"
                                            data-testid="ai-draft-undo"
                                        >
                                            {t('dailyPlan.ai.undo', 'Undo')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAiDraft(null)}
                                            className="rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
                                        >
                                            {t('dailyPlan.ai.keep', 'Keep')}
                                        </button>
                                    </div>

                                    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                                        {aiDraft.summary ||
                                            t(
                                                'dailyPlan.ai.drafted',
                                                'Here is a draft for your day.'
                                            )}
                                    </p>

                                    {aiDraft.skipped.length > 0 && (
                                        <details className="group rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-900/40">
                                            <summary className="cursor-pointer select-none text-xs font-medium text-gray-700 dark:text-gray-300">
                                                {t(
                                                    'dailyPlan.ai.skippedCount',
                                                    'Left out ({{count}})',
                                                    {
                                                        count: aiDraft.skipped
                                                            .length,
                                                    }
                                                )}
                                            </summary>
                                            <ul className="mt-2 flex flex-col gap-1.5">
                                                {aiDraft.skipped.map((s) => (
                                                    <li
                                                        key={s.task_uid}
                                                        className="flex flex-col text-sm sm:flex-row sm:gap-2"
                                                    >
                                                        <span className="font-medium text-gray-900 dark:text-gray-100 sm:w-64 sm:shrink-0 sm:truncate">
                                                            {s.name}
                                                        </span>
                                                        <span className="text-gray-600 dark:text-gray-400">
                                                            {s.reason}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </details>
                                    )}
                                </section>
                            )}

                            {tips.length > 0 && (
                                <div className="mb-3">
                                    <PlanTips
                                        tips={tips}
                                        onMoveMissed={() =>
                                            persist(
                                                rescheduleMissed(
                                                    items,
                                                    events,
                                                    range,
                                                    now
                                                )
                                            )
                                        }
                                        onPlace={(tip) =>
                                            addTask(tip.task, tip.start)
                                        }
                                    />
                                </div>
                            )}

                            {mode === 'timeline' ? (
                                <DayTimeline
                                    aiReasons={aiDraft?.reasons}
                                    items={items}
                                    events={events}
                                    range={range}
                                    now={now}
                                    onResize={(uid, duration) =>
                                        placeItem(
                                            uid,
                                            plannedMap.get(uid)?.start_minute ??
                                                null,
                                            duration
                                        )
                                    }
                                    onRemove={removeItem}
                                />
                            ) : (
                                <PlanList
                                    aiReasons={aiDraft?.reasons}
                                    items={items}
                                    onDurationChange={(uid, duration) => {
                                        const item = plannedMap.get(uid);
                                        placeItem(
                                            uid,
                                            item?.start_minute ?? null,
                                            duration
                                        );
                                    }}
                                    onTimeChange={(uid, start) =>
                                        placeItem(uid, start)
                                    }
                                    onRemove={removeItem}
                                />
                            )}
                        </section>
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={null}>
                {dragLabel ? (
                    <div className="pointer-events-none max-w-xs truncate rounded-md border border-blue-500 bg-blue-100 px-3 py-2 text-[13px] font-medium text-blue-950 shadow-lg dark:bg-blue-900 dark:text-blue-50">
                        {dragLabel}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default PlanMyDay;
