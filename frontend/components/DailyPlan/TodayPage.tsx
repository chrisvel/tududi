import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
    AiWrapUp,
    DailyPlanItem,
    DailyPlanResponse,
    PlanCandidates,
    fetchDailyPlan,
    fetchPlanCandidates,
    saveDailyPlanItems,
    toPlanItemInputs,
} from '../../utils/dailyPlanService';
import {
    CalendarEvent,
    fetchCalendarEvents,
    fetchCalendarFeeds,
} from '../../utils/calendarFeedsService';
import { deleteTask, toggleTaskCompletion } from '../../utils/tasksService';
import { getUserTimezone } from '../../utils/dateUtils';
import { isTaskDone } from '../../constants/taskStatus';
import { useToast } from '../Shared/ToastContext';
import { useDailyPlanProgress } from '../../store/dailyPlanStore';
import { useStore } from '../../store/useStore';
import TodayUnplanned from './TodayUnplanned';
import TodayPlanned from './TodayPlanned';
import { mergeVisibleOrder } from '../Shared/sortableList';
import { buildTips, rescheduleMissed } from './tips';
import { useDailyQuote } from './useDailyQuote';
import {
    DEFAULT_DURATION,
    busyMinutes,
    dayRange,
    formatDuration,
    itemEnd,
    isItemDone,
    minuteOfDay,
    intlLocale,
} from './planUtils';

const isRecurring = (task: Task): boolean =>
    !task.habit_mode &&
    !!task.recurrence_type &&
    task.recurrence_type !== 'none';

// True when a due date on or before the day (or none) became a later one.
const movedPastDay = (
    before: string | null | undefined,
    after: string | null | undefined,
    day: string
): boolean => {
    const later = (date: string | null | undefined) =>
        !!date && date.slice(0, 10) > day;
    return !later(before) && later(after);
};

const TodayPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { showErrorToast, showUndoToast } = useToast();
    const setProgress = useDailyPlanProgress((s) => s.setProgress);
    const quote = useDailyQuote(i18n.language);
    const projects = useStore((state) => state.projectsStore.projects);
    const calendarEnabled = useStore(
        (state) => state.userSettingsStore.calendarEnabled
    );

    const [planResponse, setPlanResponse] = useState<DailyPlanResponse | null>(
        null
    );
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [hasFeeds, setHasFeeds] = useState(false);
    const [showsFeeds, setShowsFeeds] = useState(false);
    const [candidates, setCandidates] = useState<PlanCandidates | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyUid, setBusyUid] = useState<string | null>(null);
    const [now, setNow] = useState(() =>
        minuteOfDay(new Date(), getUserTimezone())
    );

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
                const plan = await fetchDailyPlan();
                if (cancelled) return;
                setPlanResponse(plan);

                const candidateList = await fetchPlanCandidates().catch(
                    () => null
                );
                if (cancelled) return;
                setCandidates(candidateList);
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

    // Calendar feeds belong to the Calendar feature; with it off Today shows
    // no events and no prompt to connect a calendar.
    const planDate = planResponse?.date;
    useEffect(() => {
        if (!planDate || !calendarEnabled) {
            setHasFeeds(false);
            setShowsFeeds(false);
            setEvents([]);
            return;
        }
        let cancelled = false;
        (async () => {
            const feeds = await fetchCalendarFeeds().catch(() => []);
            if (cancelled) return;
            // Calendars switched off in Profile -> Calendars stay out of Today.
            const shown = feeds.some((feed) => feed.show_on_calendar);
            setHasFeeds(feeds.length > 0);
            setShowsFeeds(shown);
            if (!shown) return;
            const day = await fetchCalendarEvents(planDate).catch(() => null);
            if (!cancelled && day) setEvents(day.events);
        })();
        return () => {
            cancelled = true;
        };
    }, [planDate, calendarEnabled]);

    const plan = planResponse?.plan ?? null;
    const items = useMemo(() => plan?.items ?? [], [plan]);
    const started = !!plan?.started_at;
    // A row can report an edit from an older render (a delayed refetch), so
    // edits are checked against the latest items.
    const itemsRef = useRef(items);
    itemsRef.current = items;

    useEffect(() => {
        setProgress(
            started
                ? {
                      done: items.filter(isItemDone).length,
                      total: items.length,
                  }
                : null
        );
    }, [started, items, setProgress]);

    const replaceItems = useCallback(
        async (next: DailyPlanItem[]) => {
            if (!planResponse) return;
            const previous = planResponse;
            setPlanResponse({
                ...planResponse,
                plan: planResponse.plan
                    ? { ...planResponse.plan, items: next }
                    : planResponse.plan,
            });
            try {
                const saved = await saveDailyPlanItems(
                    planResponse.date,
                    toPlanItemInputs(next)
                );
                setPlanResponse(saved);
            } catch (err) {
                setPlanResponse(previous);
                showErrorToast(
                    err instanceof Error
                        ? err.message
                        : t('dailyPlan.saveError', 'Could not save the plan.')
                );
            }
        },
        [planResponse, showErrorToast, t]
    );

    const mergePlannedTask = useCallback(
        (updated: Task, extra?: Partial<DailyPlanItem>) =>
            setPlanResponse((current) =>
                current?.plan
                    ? {
                          ...current,
                          plan: {
                              ...current.plan,
                              items: current.plan.items.map((i) =>
                                  i.task_uid === updated.uid
                                      ? {
                                            ...i,
                                            ...extra,
                                            task: { ...i.task, ...updated },
                                        }
                                      : i
                              ),
                          },
                      }
                    : current
            ),
        []
    );

    // Completing a recurring task reopens the same task for its next due
    // date, so the plan records the day's occurrence as done itself.
    const syncCompletedTask = useCallback(
        (updated: Task) => {
            const planDate = planResponse?.date;
            mergePlannedTask(updated, {
                occurrence_done:
                    !!planDate &&
                    isRecurring(updated) &&
                    !isTaskDone(updated.status) &&
                    !!updated.due_date &&
                    updated.due_date.slice(0, 10) > planDate,
            });
        },
        [mergePlannedTask, planResponse?.date]
    );

    const handleToggleDone = useCallback(
        async (item: DailyPlanItem) => {
            setBusyUid(item.task_uid);
            try {
                const updated = await toggleTaskCompletion(
                    item.task_uid,
                    item.task
                );
                syncCompletedTask(updated);
            } catch (err) {
                showErrorToast(
                    err instanceof Error
                        ? err.message
                        : t('dailyPlan.saveError', 'Could not save the plan.')
                );
            } finally {
                setBusyUid(null);
            }
        },
        [showErrorToast, syncCompletedTask, t]
    );

    // The expandable rows save their own edits; these keep the plan's copy
    // of each task in step.
    const syncPlannedTask = useCallback(
        async (updated: Task) => {
            const planDate = planResponse?.date;
            const current = itemsRef.current;
            const item = current.find((i) => i.task_uid === updated.uid);
            // A due date moved from today (or earlier) to a later day takes
            // the task off today's plan, with an undo to keep it.
            if (
                planDate &&
                item &&
                !isItemDone(item) &&
                !isTaskDone(updated.status) &&
                movedPastDay(item.task.due_date, updated.due_date, planDate)
            ) {
                replaceItems(current.filter((i) => i !== item));
                showUndoToast(
                    t(
                        'dailyPlan.movedOffPlan',
                        "'{{name}}' is no longer due today, so it left today's plan.",
                        { name: updated.name }
                    ),
                    () => replaceItems(current)
                );
                return;
            }
            mergePlannedTask(updated);
        },
        [mergePlannedTask, planResponse?.date, replaceItems, showUndoToast, t]
    );

    const replaceCandidate = useCallback(
        (uid: string | undefined, updated: Task | null) =>
            setCandidates((current) => {
                if (!current || !uid) return current;
                const apply = (tasks: Task[]) =>
                    updated
                        ? tasks.map((task) =>
                              task.uid === uid ? { ...task, ...updated } : task
                          )
                        : tasks.filter((task) => task.uid !== uid);
                return {
                    ...current,
                    overdue: apply(current.overdue),
                    due_today: apply(current.due_today),
                    in_progress: apply(current.in_progress),
                    suggested: apply(current.suggested),
                };
            }),
        []
    );

    const handleDeleteTask = useCallback(
        async (taskUid: string) => {
            await deleteTask(taskUid);
            // The server drops the plan item along with the task.
            setPlanResponse((current) =>
                current?.plan
                    ? {
                          ...current,
                          plan: {
                              ...current.plan,
                              items: current.plan.items.filter(
                                  (i) => i.task_uid !== taskUid
                              ),
                          },
                      }
                    : current
            );
            replaceCandidate(taskUid, null);
        },
        [replaceCandidate]
    );

    const handlePushLater = useCallback(
        (item: DailyPlanItem) => {
            const rest = items.filter((i) => i.task_uid !== item.task_uid);
            replaceItems([...rest, { ...item, start_minute: null }]);
        },
        [items, replaceItems]
    );

    const handleAdd = useCallback(
        (task: Task, startMinute: number | null = null) => {
            if (!task.uid) return;
            replaceItems([
                ...items,
                {
                    task_uid: task.uid,
                    position: items.length,
                    start_minute: startMinute,
                    duration_minutes:
                        task.estimated_minutes ?? DEFAULT_DURATION,
                    task,
                },
            ]);
        },
        [items, replaceItems]
    );

    const doneCount = items.filter(isItemDone).length;
    const minutesLeft = items
        .filter((item) => !isItemDone(item))
        .reduce((sum, item) => sum + item.duration_minutes, 0);
    const progress = items.length
        ? Math.round((doneCount / items.length) * 100)
        : 0;
    const range = dayRange(items, events, planResponse?.day_hours);
    const aiEnabled = useStore(
        (state) => state.userSettingsStore.aiAssistantEnabled
    );
    const tips =
        aiEnabled && started
            ? buildTips({
                  items,
                  events,
                  candidates: candidates
                      ? [
                            ...(candidates.tagged_today ?? []),
                            ...candidates.overdue,
                            ...candidates.due_today,
                            ...candidates.in_progress,
                            ...candidates.suggested,
                        ]
                      : [],
                  range,
                  now,
                  durationFor: (task) =>
                      task.estimated_minutes || DEFAULT_DURATION,
                  include: ['missed', 'gapFit'],
              })
            : [];
    // The wrap-up is offered once the last timed block is over, or when
    // everything is done.
    const lastEnd = items
        .filter((item) => item.start_minute !== null)
        .reduce((max, item) => Math.max(max, itemEnd(item)), 0);
    const dayIsOver =
        items.length > 0 &&
        (items.every(isItemDone) || (lastEnd > 0 && now >= lastEnd));
    const setWrapUp = (wrapUp: AiWrapUp) =>
        setPlanResponse((current) =>
            current?.plan
                ? { ...current, plan: { ...current.plan, ai_wrap_up: wrapUp } }
                : current
        );
    const freeMinutes = Math.max(
        0,
        range.end - range.start - busyMinutes(events, range)
    );
    const dateLabel = planResponse
        ? new Intl.DateTimeFormat(intlLocale(i18n.language), {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
          }).format(new Date(`${planResponse.date}T12:00:00`))
        : '';

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-10">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex flex-1 items-baseline gap-2">
                        <h2 className="text-2xl font-light">
                            {t('tasks.today', 'Today')},
                        </h2>
                        <span className="text-lg font-light text-gray-500 dark:text-gray-400">
                            {dateLabel}
                        </span>
                        <span
                            className="self-center rounded-full border border-blue-300/50 bg-blue-50 px-2 py-0.5 dark:border-blue-500/30 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            title={t(
                                'dailyPlan.betaHint',
                                'The planned Today page is new. The classic page is still at the bottom of this page.'
                            )}
                            data-testid="today-beta-badge"
                        >
                            {t('dailyPlan.beta', 'Beta')}
                        </span>
                    </div>
                    {started && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t(
                                    'dailyPlan.progress',
                                    '{{done}} of {{total}} done',
                                    {
                                        done: doneCount,
                                        total: items.length,
                                    }
                                )}
                                {minutesLeft > 0 &&
                                    ` · ${t(
                                        'dailyPlan.timeLeft',
                                        '{{time}} left',
                                        {
                                            time: formatDuration(minutesLeft),
                                        }
                                    )}`}
                            </span>
                            <Link
                                to="/today/plan"
                                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                            >
                                <ArrowPathIcon className="h-4 w-4" />
                                {t('dailyPlan.replan', 'Replan')}
                            </Link>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    {started && (
                        <div
                            className="h-1 rounded-full bg-gray-200 dark:bg-gray-700"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className="h-1 rounded-full bg-blue-600 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                    {quote && (
                        <p className="text-gray-400 font-light dark:text-gray-500">
                            {quote}
                        </p>
                    )}
                </div>

                {error && (
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                )}

                {!planResponse && !error && (
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                )}

                {planResponse && !started && (
                    <TodayUnplanned
                        candidates={candidates}
                        events={events}
                        freeMinutes={freeMinutes}
                        hasFeeds={hasFeeds}
                        showsFeeds={showsFeeds}
                        calendarEnabled={calendarEnabled}
                        hasDraft={items.length > 0}
                    />
                )}

                {planResponse && started && (
                    <TodayPlanned
                        items={items}
                        events={events}
                        candidates={candidates}
                        now={now}
                        busyUid={busyUid}
                        onToggleDone={handleToggleDone}
                        onPushLater={handlePushLater}
                        onAdd={handleAdd}
                        projects={projects}
                        onPlannedTaskUpdate={syncPlannedTask}
                        onPlannedTaskComplete={syncCompletedTask}
                        onPlannedTaskDelete={handleDeleteTask}
                        onReorderUntimed={(orderedUids) => {
                            const byUid = new Map(
                                items.map((item) => [item.task_uid, item])
                            );
                            replaceItems(
                                mergeVisibleOrder(
                                    items.map((item) => item.task_uid),
                                    orderedUids
                                ).map((uid) => byUid.get(uid) as DailyPlanItem)
                            );
                        }}
                        onCandidateUpdate={async (task) =>
                            replaceCandidate(task.uid, task)
                        }
                        onCandidateDelete={handleDeleteTask}
                        tips={tips}
                        onMoveMissed={() =>
                            replaceItems(
                                rescheduleMissed(items, events, range, now)
                            )
                        }
                        onPlaceTip={(tip) => handleAdd(tip.task, tip.start)}
                        wrapUp={{
                            show:
                                aiEnabled && (dayIsOver || !!plan?.ai_wrap_up),
                            date: planResponse.date,
                            value: plan?.ai_wrap_up ?? null,
                            onGenerated: setWrapUp,
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default TodayPage;
