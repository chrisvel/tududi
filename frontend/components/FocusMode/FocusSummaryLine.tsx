import React, { useEffect } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { fetchFocusSummary, focusKeys } from '../../utils/todayService';
import { resolveDisplayLocale } from '../../utils/jalali';

export default function FocusSummaryLine({ task }: { task: Task }) {
    const { t, i18n } = useTranslation();
    const { data, mutate } = useSWR(
        task.uid ? focusKeys.summary(task.uid) : null,
        () => fetchFocusSummary([task.uid!])
    );
    useEffect(() => {
        void mutate();
    }, [task.estimated_minutes, task.focus_minutes, mutate]);
    const s = task.uid ? data?.[task.uid] : null;
    if (!s || (s.target_count === null && s.spent_minutes === 0)) return null;
    const number = (n: number) =>
        new Intl.NumberFormat(resolveDisplayLocale(i18n.language)).format(n);
    const dots = Math.min(8, s.target_count ?? s.completed_count);
    return (
        <div
            className="flex flex-wrap items-center gap-2 text-xs"
            style={{ color: 'var(--ltd-ink)' }}
            data-testid="focus-summary"
        >
            {s.target_count !== null && (
                <span dir="ltr" data-testid="focus-count">
                    {number(s.completed_count)} / {number(s.target_count)}
                </span>
            )}
            <span data-testid="focus-spent">
                {t('taskPomodoro.spent', '{{minutes}} minutes', {
                    minutes: number(s.spent_minutes),
                })}
            </span>
            <span aria-hidden="true" className="flex gap-1">
                {Array.from({ length: dots }, (_, i) => (
                    <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                            background:
                                i < s.completed_count
                                    ? 'var(--ltd-primary)'
                                    : 'var(--ltd-separator)',
                        }}
                    />
                ))}
            </span>
            {s.target_count !== null && s.completed_count > s.target_count && (
                <span>
                    {t('taskPomodoro.overEstimate', 'More than estimated')}
                </span>
            )}
        </div>
    );
}
