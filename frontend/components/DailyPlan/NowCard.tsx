// LTD-PATCH(T-1203): lifetime Focus minutes and completed intervals on the Now task.
// LTD-PATCH(T-301): Share quiet Life-to-Day presentation without changing behavior.
// LTD-PATCH(T-503): show the starter step (or a five-minute start) first; Focus and resume (T-502).
// LTD-PATCH(T-1103): one path line and at most one lesson line after the first step.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import { FocusSession } from '../../utils/todayService';
import { formatMinute, itemEnd, pickCurrentItem } from './planUtils';
import FocusSummaryLine from '../FocusMode/FocusSummaryLine';
import EffectLine from '../Lessons/EffectLine';

interface NowCardProps {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    now: number;
    onDone: (item: DailyPlanItem) => void;
    onPushLater: (item: DailyPlanItem) => void;
    busyUid: string | null;
    onFocus?: (item: DailyPlanItem) => void;
    resumable?: FocusSession | null;
    onResume?: (session: FocusSession) => void;
}

const NowCard: React.FC<NowCardProps> = ({
    items,
    events,
    now,
    onDone,
    onPushLater,
    busyUid,
    onFocus,
    resumable = null,
    onResume,
}) => {
    const { t } = useTranslation();
    const current = pickCurrentItem(items, now);

    if (!current) {
        return (
            <section className="ltd-now flex items-center gap-4">
                <CheckCircleIcon className="h-8 w-8 text-secondary" />
                <div className="flex flex-col gap-1">
                    <span className="text-lg text-gray-900 dark:text-gray-100">
                        {t(
                            'dailyPlan.allDone',
                            'Everything you planned is done'
                        )}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t(
                            'dailyPlan.allDoneHint',
                            'Pick something from "Not planned" below, or call it a day.'
                        )}
                    </span>
                </div>
            </section>
        );
    }

    const { item, state } = current;
    const hasSlot = item.start_minute !== null;
    const label =
        state === 'now'
            ? t('dailyPlan.now', 'Now')
            : state === 'next'
              ? t('dailyPlan.next', 'Next')
              : t('dailyPlan.upNext', 'Up next');
    const when = hasSlot
        ? `${formatMinute(item.start_minute as number)} – ${formatMinute(itemEnd(item))}`
        : null;

    const details: string[] = [];
    if (item.task.Project?.name) details.push(item.task.Project.name);
    if (state === 'now') {
        details.push(
            t('dailyPlan.minutesLeft', '{{count}} minutes left in this block', {
                count: itemEnd(item) - now,
            })
        );
    }
    const nextEvent = events.find(
        (e) => !e.all_day && e.start_minute !== null && e.start_minute >= now
    );
    if (nextEvent) {
        details.push(
            t('dailyPlan.eventAt', '{{title}} at {{time}}', {
                title: nextEvent.title,
                time: formatMinute(nextEvent.start_minute as number),
            })
        );
    }

    const isBusy = busyUid === item.task_uid;
    const starterStep = item.task.starter_step?.trim();
    const resume = resumable;
    const resumeHere = !!resume && resume.task_uid === item.task_uid;

    return (
        <section
            className="ltd-now flex flex-col gap-6 sm:flex-row sm:items-center"
            data-testid="now-card"
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-secondary">
                    {label}
                    {when ? ` · ${when}` : ''}
                </span>
                <span className="ltd-now-title break-words">
                    <bdi>{item.task.name}</bdi>
                </span>
                {resume && !resumeHere && (
                    <span
                        className="text-sm text-gray-700 dark:text-gray-300"
                        data-testid="now-card-paused"
                    >
                        {t('focusMode.pausedEarlier', 'Paused earlier:')}{' '}
                        <bdi>{resume.task_name}</bdi>
                        {resume.resume_note && (
                            <>
                                {' · '}
                                <bdi>{resume.resume_note}</bdi>
                            </>
                        )}
                    </span>
                )}
                {resumeHere && resume?.resume_note ? (
                    <span
                        className="text-sm text-gray-700 dark:text-gray-300"
                        data-testid="now-card-resume-note"
                    >
                        {t('focusMode.whereWasI', 'Where was I?')}{' '}
                        <bdi>{resume.resume_note}</bdi>
                    </span>
                ) : starterStep ? (
                    <span
                        className="text-sm text-gray-700 dark:text-gray-300"
                        data-testid="now-card-starter-step"
                    >
                        {t('dailyPlan.starterStep', 'First step:')}{' '}
                        <bdi>{starterStep}</bdi>
                    </span>
                ) : (
                    <span
                        className="text-sm text-gray-700 dark:text-gray-300"
                        data-testid="now-card-five-minutes"
                    >
                        {t(
                            'dailyPlan.fiveMinuteStart',
                            'Just start for 5 minutes.'
                        )}
                    </span>
                )}
                <FocusSummaryLine task={item.task} />
                <EffectLine taskUid={item.task_uid} expandable />
                {details.length > 0 && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {details.join(' · ')}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {resume && onResume && (
                    <button
                        type="button"
                        onClick={() => onResume(resume)}
                        disabled={isBusy}
                        className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        data-testid="now-card-resume"
                    >
                        {t('focusMode.resume', 'Continue')}
                    </button>
                )}
                {!resumeHere && onFocus && (
                    <button
                        type="button"
                        onClick={() => onFocus(item)}
                        disabled={isBusy}
                        className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        data-testid="now-card-focus"
                    >
                        {t('focusMode.start', 'Focus')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onPushLater(item)}
                    disabled={isBusy}
                    className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                    {t('dailyPlan.pushLater', 'Push to later')}
                </button>
                <button
                    type="button"
                    onClick={() => onDone(item)}
                    disabled={isBusy}
                    className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium ltd-primary disabled:opacity-50"
                    data-testid="now-card-done"
                >
                    {t('dailyPlan.markDone', 'Mark done')}
                </button>
            </div>
        </section>
    );
};

export default NowCard;
