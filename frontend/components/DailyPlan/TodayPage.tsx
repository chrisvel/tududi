// LTD-PATCH(T-301): Share quiet Life-to-Day presentation without changing behavior.
// LTD-PATCH(T-501): capacity bar, Focus mode (T-502), Recovery and Overwhelmed (T-504), contribution (T-505).
// LTD-PATCH(T-1103): one lesson review question a day, and a lesson in the day review.
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
import { focusKey, focusScopeParams, useFocus } from '../../utils/focus';
import {
    CalendarEvent,
    fetchCalendarEvents,
    fetchCalendarFeeds,
} from '../../utils/calendarFeedsService';
import { deleteTask, toggleTaskCompletion } from '../../utils/tasksService';
import { getUserTimezone } from '../../utils/dateUtils';
import { isTaskDone } from '../../constants/taskStatus';
import { isHabitDoneForNow } from '../../utils/habitUtils';
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
import { useAiAllowed } from '../../hooks/useTrialStatus';
import {
    Capacity,
    Contribution,
    FocusSession,
    fetchCapacity,
    fetchContribution,
    fetchCurrentFocus,
    fetchOverwhelmed,
    lightenDay,
    resumeFocus,
    saveOverwhelmed,
    startFocus,
} from '../../utils/todayService';
import { revertJournal } from '../../utils/planningService';
// LTD-PATCH(T-1203): Today opens the global server-session overlay.
import useSWR from 'swr';
import { useFocusTimer, refreshFocus } from '../FocusMode/focusState';
import FocusTodayLine from '../FocusMode/FocusTodayLine';
import { focusKeys } from '../../utils/todayService';
import NowCard from './NowCard';
import CapacityBar from '../Recovery/CapacityBar';
import ContributionCard from '../Recovery/ContributionCard';
import RecoveryControls from '../Recovery/RecoveryControls';
import LessonReviewPrompt from '../Lessons/LessonReviewPrompt';
import DayLessonCard from '../Lessons/DayLessonCard';

// The degraded path (blueprint 3.5): from 14:00 with nothing done yet.
const HEAVY_DAY_FROM = 14 * 60;

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
    const aiAllowed = useAiAllowed();
    const { t, i18n } = useTranslation();
    const focus = useFocus();
    const focusId = focusKey(focus);
    const { showErrorToast, showUndoToast, showSuccessToast } = useToast();
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
    const [reloadKey, setReloadKey] = useState(0);
    const [capacity, setCapacity] = useState<Capacity | null>(null);
    const [contribution, setContribution] = useState<Contribution | null>(null);
    const setFocusSession = useFocusTimer((s) => s.show);
    const { data: currentSession } = useSWR(
        focusKeys.current,
        fetchCurrentFocus
    );
    const focusSession =
        currentSession && !currentSession.ended_at ? currentSession : null;
    const resumable =
        currentSession?.interrupted && currentSession.ended_at
            ? currentSession
            : null;
    const [overwhelmed, setOverwhelmed] = useState(false);
    const [recoveryBusy, setRecoveryBusy] = useState(false);
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
                const scope = focusScopeParams(focus);
                const plan = await fetchDailyPlan(undefined, scope);
                if (cancelled) return;
                setPlanResponse(plan);

                const candidateList = await fetchPlanCandidates(
                    undefined,
                    scope
                ).catch(() => null);
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
    }, [t, focusId, reloadKey]);

    useEffect(() => {
        fetchOverwhelmed()
            .then((state) => setOverwhelmed(state.on))
            .catch(() => undefined);
    }, []);

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

    // Capacity and the contribution report are derived on the server from
    // the saved plan, so they follow every save.
    const itemsKey = items
        .map(
            (i) =>
                `${i.task_uid}:${i.start_minute}:${i.duration_minutes}:${isItemDone(i)}`
        )
        .join('|');
    useEffect(() => {
        if (!planDate) return undefined;
        let cancelled = false;
        fetchCapacity(planDate)
            .then((value) => !cancelled && setCapacity(value))
            .catch(() => undefined);
        fetchContribution()
            .then((value) => !cancelled && setContribution(value))
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [planDate, itemsKey, focusSession]);
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
    // date, and a habit stays open after a check-in, so the plan records the
    // day's occurrence as done itself.
    const syncCompletedTask = useCallback(
        (updated: Task) => {
            const planDate = planResponse?.date;
            mergePlannedTask(updated, {
                occurrence_done: updated.habit_mode
                    ? isHabitDoneForNow(updated)
                    : !!planDate &&
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

    const handleFocus = useCallback(
        async (item: DailyPlanItem) => {
            try {
                setFocusSession(await startFocus(item.task_uid));
                void refreshFocus();
            } catch (err) {
                showErrorToast(
                    err instanceof Error ? err.message : String(err)
                );
            }
        },
        [showErrorToast]
    );

    const handleResume = useCallback(
        async (session: FocusSession) => {
            try {
                setFocusSession(await resumeFocus(session.uid));
                void refreshFocus();
            } catch (err) {
                showErrorToast(
                    err instanceof Error ? err.message : String(err)
                );
            }
        },
        [showErrorToast]
    );

    // "Lighten my day": the server moves open work to tomorrow through the
    // Journal; Undo is the existing toast reverting that entry.
    const handleLighten = useCallback(async () => {
        if (!planResponse) return;
        setRecoveryBusy(true);
        try {
            const result = await lightenDay(planResponse.date);
            if (!result.journal_uid) {
                showSuccessToast(
                    t(
                        'recovery.nothingToMove',
                        'Your day is already light. One small step at a time.'
                    )
                );
                return;
            }
            const journalUid = result.journal_uid;
            setReloadKey((key) => key + 1);
            showUndoToast(
                t(
                    'recovery.done',
                    'Lighter now: {{moved}} moved to tomorrow. Small steps count.',
                    { moved: result.moved.length }
                ),
                async () => {
                    try {
                        await revertJournal(journalUid);
                    } catch (err) {
                        showErrorToast(
                            err instanceof Error ? err.message : String(err)
                        );
                    }
                    setReloadKey((key) => key + 1);
                }
            );
        } catch (err) {
            showErrorToast(err instanceof Error ? err.message : String(err));
        } finally {
            setRecoveryBusy(false);
        }
    }, [planResponse, showErrorToast, showSuccessToast, showUndoToast, t]);

    const toggleOverwhelmed = useCallback(
        async (on: boolean) => {
            setOverwhelmed(on);
            try {
                setOverwhelmed((await saveOverwhelmed(on)).on);
            } catch (err) {
                setOverwhelmed(!on);
                showErrorToast(
                    err instanceof Error ? err.message : String(err)
                );
            }
        },
        [showErrorToast]
    );

    const doneCount = items.filter(isItemDone).length;
    const minutesLeft = items
        .filter((item) => !isItemDone(item))
        .reduce((sum, item) => sum + item.duration_minutes, 0);
    const progress = items.length
        ? Math.round((doneCount / items.length) * 100)
        : 0;
    const range = dayRange(items, events, planResponse?.day_hours);
    const aiEnabled =
        useStore((state) => state.userSettingsStore.aiAssistantEnabled) &&
        aiAllowed;
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

    // Overwhelmed: only the Now card; everything else and notifications
    // stay away until the person leaves the mode.
    if (overwhelmed && planResponse && started) {
        return (
            <div
                className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-10"
                data-testid="overwhelmed-mode"
            >
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                    <p className="text-gray-700 dark:text-gray-300">
                        {t(
                            'recovery.overwhelmedHint',
                            'Just this one thing. Everything else can wait.'
                        )}
                    </p>
                    <NowCard
                        items={items}
                        events={events}
                        now={now}
                        onDone={handleToggleDone}
                        onPushLater={handlePushLater}
                        busyUid={busyUid}
                        onFocus={handleFocus}
                        resumable={resumable}
                        onResume={handleResume}
                    />
                    <button
                        type="button"
                        onClick={() => toggleOverwhelmed(false)}
                        className="min-h-[44px] self-start rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        data-testid="overwhelmed-off"
                    >
                        {t('recovery.showAll', 'Show my whole day again')}
                    </button>
                </div>
            </div>
        );
    }

    const heavyDay =
        started &&
        now >= HEAVY_DAY_FROM &&
        doneCount === 0 &&
        items.some((item) => !isItemDone(item));

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-10">
            <FocusTodayLine />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="flex flex-1 items-baseline gap-2">
                        <h2
                            className="text-[28px] font-semibold"
                            data-testid="today-heading"
                        >
                            {t('tasks.today', 'Today')},
                        </h2>
                        <span className="text-[17px] font-normal text-gray-500 dark:text-gray-400">
                            {dateLabel}
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
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
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
                                className="h-1 rounded-full bg-secondary"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                    {quote && (
                        <p className="text-secondary font-normal dark:text-gray-500">
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

                {planResponse && started && capacity && (
                    <CapacityBar
                        capacity={capacity}
                        nameOf={(uid) =>
                            items.find((item) => item.task_uid === uid)?.task
                                .name
                        }
                    />
                )}

                {planResponse && started && items.length > 0 && (
                    <RecoveryControls
                        heavyDay={heavyDay}
                        busy={recoveryBusy}
                        onLighten={handleLighten}
                        onOverwhelmed={() => toggleOverwhelmed(true)}
                    />
                )}

                {planResponse && started && (
                    <TodayPlanned
                        onFocus={handleFocus}
                        resumable={resumable}
                        onResume={handleResume}
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

                {planResponse && <LessonReviewPrompt />}

                {contribution && (
                    <ContributionCard contribution={contribution} />
                )}

                {planResponse && started && dayIsOver && <DayLessonCard />}
            </div>
        </div>
    );
};

export default TodayPage;
