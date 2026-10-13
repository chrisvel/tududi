// LTD-PATCH(T-1203): count and duration edit the same estimate; length only changes the target.
import React, { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Task } from '../../../entities/Task';
import DurationChips from '../../DailyPlan/DurationChips';
import FocusSummaryLine from '../../FocusMode/FocusSummaryLine';
import {
    DEFAULT_POMODORO,
    fetchPomodoroSettings,
    focusKeys,
    manualFocus,
} from '../../../utils/todayService';
import { refreshFocus } from '../../FocusMode/focusState';
import { resolveDisplayLocale } from '../../../utils/jalali';

interface TaskEstimateCardProps {
    task: Task;
    onChange: (minutes: number | null) => void;
    onLengthChange: (minutes: number | null) => void;
}
const TaskEstimateCard: React.FC<TaskEstimateCardProps> = ({
    task,
    onChange,
    onLengthChange,
}) => {
    const { t, i18n } = useTranslation();
    const { data: prefs } = useSWR(focusKeys.settings, fetchPomodoroSettings);
    const value = task.estimated_minutes ?? null;
    const length =
        task.focus_minutes ??
        prefs?.focus_minutes ??
        DEFAULT_POMODORO.focus_minutes;
    const target =
        value === null ? null : Math.max(1, Math.round(value / length));
    const displayCount = target === null ? null : Math.min(12, target);
    const number = (n: number) =>
        new Intl.NumberFormat(resolveDisplayLocale(i18n.language)).format(n);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const record = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task.uid) return;
        setBusy(true);
        setError(null);
        try {
            await manualFocus({
                task_uid: task.uid,
                started_at: new Date(from).toISOString(),
                ended_at: new Date(to).toISOString(),
            });
            setFrom('');
            setTo('');
            void refreshFocus();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setBusy(false);
        }
    };
    return (
        <div>
            <h4 className="mb-2 text-sm font-semibold">
                {t('task.estimate', 'Estimate')}
            </h4>
            <div className="flex flex-col gap-4 rounded-lg border bg-white p-4 dark:bg-gray-900">
                <DurationChips
                    value={value}
                    onChange={(minutes) => {
                        onChange(minutes === value ? null : minutes);
                    }}
                />
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                        {t('taskPomodoro.taskLength', 'Length for this task')}
                        <select
                            className="min-h-[44px] rounded border px-2 dark:bg-gray-800"
                            value={task.focus_minutes ?? ''}
                            data-testid="task-focus-length"
                            onChange={(e) =>
                                onLengthChange(
                                    e.target.value === ''
                                        ? null
                                        : Number(e.target.value)
                                )
                            }
                        >
                            <option value="">
                                {t(
                                    'taskPomodoro.inherit',
                                    'User default ({{minutes}} minutes)',
                                    {
                                        minutes: number(
                                            prefs?.focus_minutes ?? 25
                                        ),
                                    }
                                )}
                            </option>
                            {Array.from(
                                { length: 18 },
                                (_, i) => (i + 1) * 5
                            ).map((n) => (
                                <option key={n} value={n}>
                                    {number(n)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-2">
                        {t('taskPomodoro.estimateCount', 'Estimated intervals')}
                        <input
                            type="number"
                            min={1}
                            max={12}
                            step={1}
                            className="min-h-[44px] w-20 rounded border px-2 dark:bg-gray-800"
                            data-testid="task-focus-count"
                            value={displayCount ?? ''}
                            onChange={(e) => {
                                if (e.target.value === '') {
                                    onChange(null);
                                    return;
                                }
                                const n = Number(e.target.value);
                                if (Number.isInteger(n) && n >= 1 && n <= 12)
                                    onChange(n * length);
                            }}
                        />
                    </label>
                </div>
                <p className="text-xs text-secondary">
                    {t(
                        'taskPomodoro.planHint',
                        'This same duration is used for your daily plan.'
                    )}
                </p>
                <FocusSummaryLine task={task} />
                <details>
                    <summary className="min-h-[44px] cursor-pointer">
                        {t('taskPomodoro.manual', 'Record forgotten time')}
                    </summary>
                    <form className="flex flex-wrap gap-2" onSubmit={record}>
                        <label>
                            {t('taskPomodoro.started', 'Started')}
                            <input
                                type="datetime-local"
                                required
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="min-h-[44px] block rounded border dark:bg-gray-800"
                            />
                        </label>
                        <label>
                            {t('taskPomodoro.ended', 'Ended')}
                            <input
                                type="datetime-local"
                                required
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="min-h-[44px] block rounded border dark:bg-gray-800"
                            />
                        </label>
                        <button
                            className="min-h-[44px] rounded px-3 ltd-primary"
                            disabled={busy}
                        >
                            {t('common.save', 'Save')}
                        </button>
                        {error && <p role="alert">{error}</p>}
                    </form>
                </details>
            </div>
        </div>
    );
};
export default TaskEstimateCard;
