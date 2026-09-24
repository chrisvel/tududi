import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
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
import { toggleTaskCompletion } from '../../utils/tasksService';
import { getUserTimezone } from '../../utils/dateUtils';
import { useToast } from '../Shared/ToastContext';
import { useDailyPlanProgress } from '../../store/dailyPlanStore';
import TodayUnplanned from './TodayUnplanned';
import TodayPlanned from './TodayPlanned';
import { useDailyQuote } from './useDailyQuote';
import {
    DEFAULT_DURATION,
    busyMinutes,
    dayRange,
    formatDuration,
    isItemDone,
    minuteOfDay,
} from './planUtils';

const TodayPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { showErrorToast } = useToast();
    const setProgress = useDailyPlanProgress((s) => s.setProgress);
    const quote = useDailyQuote(i18n.language);

    const [planResponse, setPlanResponse] = useState<DailyPlanResponse | null>(
        null
    );
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [hasFeeds, setHasFeeds] = useState(false);
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

                const [feeds, candidateList] = await Promise.all([
                    fetchCalendarFeeds().catch(() => []),
                    fetchPlanCandidates().catch(() => null),
                ]);
                if (cancelled) return;
                setHasFeeds(feeds.length > 0);
                setCandidates(candidateList);
                if (feeds.length > 0) {
                    const day = await fetchCalendarEvents(plan.date).catch(
                        () => null
                    );
                    if (!cancelled && day) setEvents(day.events);
                }
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

    const plan = planResponse?.plan ?? null;
    const items = useMemo(() => plan?.items ?? [], [plan]);
    const started = !!plan?.started_at;

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

    const handleToggleDone = useCallback(
        async (item: DailyPlanItem) => {
            setBusyUid(item.task_uid);
            try {
                const updated = await toggleTaskCompletion(
                    item.task_uid,
                    item.task
                );
                setPlanResponse((current) =>
                    current?.plan
                        ? {
                              ...current,
                              plan: {
                                  ...current.plan,
                                  items: current.plan.items.map((i) =>
                                      i.task_uid === item.task_uid
                                          ? {
                                                ...i,
                                                task: { ...i.task, ...updated },
                                            }
                                          : i
                                  ),
                              },
                          }
                        : current
                );
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
        [showErrorToast, t]
    );

    const handlePushLater = useCallback(
        (item: DailyPlanItem) => {
            const rest = items.filter((i) => i.task_uid !== item.task_uid);
            replaceItems([...rest, { ...item, start_minute: null }]);
        },
        [items, replaceItems]
    );

    const handleAdd = useCallback(
        (task: Task) => {
            if (!task.uid) return;
            replaceItems([
                ...items,
                {
                    task_uid: task.uid,
                    position: items.length,
                    start_minute: null,
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
    const range = dayRange(items, events);
    const freeMinutes = Math.max(
        0,
        range.end - range.start - busyMinutes(events, range)
    );
    const dateLabel = planResponse
        ? new Intl.DateTimeFormat(i18n.language, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
          }).format(new Date(`${planResponse.date}T12:00:00`))
        : '';

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-10">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                    <div className="flex flex-1 items-end gap-2">
                        <h2 className="text-2xl font-light">
                            {t('tasks.today', 'Today')},
                        </h2>
                        <span className="text-lg font-light text-gray-500 dark:text-gray-400">
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
                                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
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
                    />
                )}
            </div>
        </div>
    );
};

export default TodayPage;
