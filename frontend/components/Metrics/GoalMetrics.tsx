import React, { useEffect, useState } from 'react';
import { formatDisplayDate, formatDisplayNumber } from '../../utils/jalali';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
    checkinMetric,
    deleteGoalMetric,
    fetchGoalMetrics,
    GoalMetric,
    planningKeys,
    refreshPlanning,
    saveGoalMetric,
} from '../../utils/planningService';

const inputClass =
    'w-full min-w-0 rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900';
const blankMetric: Partial<GoalMetric> = {
    name: '',
    unit: '',
    baseline: 0,
    target: 100,
    direction: 'increase',
    weight: 1,
    source: 'manual',
};
export default function GoalMetrics({ goalUid }: { goalUid: string }) {
    const { t } = useTranslation();
    const { data, error: loadError } = useSWR(
        planningKeys.metrics(goalUid),
        () => fetchGoalMetrics(goalUid)
    );
    const [draft, setDraft] = useState<Partial<GoalMetric>>({ ...blankMetric });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const act = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        try {
            await fn();
            await refreshPlanning();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <section
            aria-label={t('ltdPlanning.metrics')}
            className="mb-6 space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
        >
            <h2 className="font-medium">{t('ltdPlanning.metrics')}</h2>
            {(error || loadError) && (
                <p role="alert" className="text-amber-700 dark:text-amber-300">
                    {error || loadError.message}
                </p>
            )}
            {data?.metrics.map((metric) => (
                <MetricRow
                    key={metric.uid}
                    metric={metric}
                    busy={busy}
                    act={act}
                    onEdit={() => setDraft({ ...metric })}
                />
            ))}
            <form
                className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                        const {
                            uid,
                            name,
                            unit,
                            baseline,
                            target,
                            direction,
                            weight,
                            source,
                        } = draft;
                        await saveGoalMetric(goalUid, {
                            uid,
                            name,
                            unit,
                            baseline,
                            target,
                            direction,
                            weight,
                            source,
                        });
                        setDraft({ ...blankMetric });
                    });
                }}
            >
                <label>
                    {t('ltdPlanning.metricName')}
                    <input
                        required
                        aria-label={t('ltdPlanning.metricName')}
                        className={inputClass}
                        value={draft.name}
                        onChange={(e) =>
                            setDraft({ ...draft, name: e.target.value })
                        }
                    />
                </label>
                <label>
                    {t('ltdPlanning.unit')}
                    <input
                        aria-label={t('ltdPlanning.unit')}
                        className={inputClass}
                        value={draft.unit || ''}
                        onChange={(e) =>
                            setDraft({ ...draft, unit: e.target.value })
                        }
                    />
                </label>
                {(['baseline', 'target', 'weight'] as const).map((field) => (
                    <label key={field}>
                        {t(`ltdPlanning.${field}`)}
                        <input
                            required
                            type="number"
                            step="any"
                            min={field === 'weight' ? 0.01 : undefined}
                            aria-label={t(`ltdPlanning.${field}`)}
                            className={inputClass}
                            value={draft[field]}
                            onChange={(e) =>
                                setDraft({
                                    ...draft,
                                    [field]: Number(e.target.value),
                                })
                            }
                        />
                    </label>
                ))}
                <label>
                    {t('ltdPlanning.direction')}
                    <select
                        aria-label={t('ltdPlanning.direction')}
                        className={inputClass}
                        value={draft.direction}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                direction: e.target
                                    .value as GoalMetric['direction'],
                            })
                        }
                    >
                        <option value="increase">
                            {t('ltdPlanning.increase')}
                        </option>
                        <option value="decrease">
                            {t('ltdPlanning.decrease')}
                        </option>
                    </select>
                </label>
                <div className="flex flex-wrap gap-2">
                    <button
                        disabled={busy}
                        className="rounded border px-3 py-2"
                        type="submit"
                    >
                        {t(
                            draft.uid
                                ? 'ltdPlanning.updateMetric'
                                : 'ltdPlanning.addMetric'
                        )}
                    </button>
                    {draft.uid && (
                        <button
                            type="button"
                            onClick={() => setDraft({ ...blankMetric })}
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}
function MetricRow({
    metric,
    busy,
    act,
    onEdit,
}: {
    metric: GoalMetric;
    busy: boolean;
    act: (fn: () => Promise<unknown>) => Promise<void>;
    onEdit: () => void;
}) {
    const { t } = useTranslation();
    const [value, setValue] = useState(String(metric.current_value));
    useEffect(
        () => setValue(String(metric.current_value)),
        [metric.current_value]
    );
    const [note, setNote] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    return (
        <div
            className="space-y-3 border-b border-gray-200 pb-4 dark:border-gray-700"
            data-testid={`metric-${metric.uid}`}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 break-words">
                    <bdi>{metric.name}</bdi> ·{' '}
                    <bdi>
                        {formatDisplayNumber(metric.current_value)}{' '}
                        {metric.unit}
                    </bdi>
                </h3>
                <div className="flex gap-3">
                    <button type="button" onClick={onEdit}>
                        {t('common.edit', 'Edit')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                    >
                        {t('common.delete', 'Delete')}
                    </button>
                </div>
            </div>
            {confirmDelete && (
                <div className="flex flex-wrap items-center gap-3">
                    <p>{t('ltdPlanning.deleteMetricConfirm')}</p>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            void act(() => deleteGoalMetric(metric.uid))
                        }
                    >
                        {t('common.delete', 'Delete')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                </div>
            )}
            <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    void act(() =>
                        checkinMetric(metric.uid, Number(value), note)
                    );
                }}
            >
                <label className="min-w-0 flex-1">
                    {t('ltdPlanning.currentValue')}
                    <input
                        required
                        type="number"
                        step="any"
                        aria-label={t('ltdPlanning.valueFor', {
                            name: metric.name,
                        })}
                        className={inputClass}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                </label>
                <label className="min-w-0 flex-1">
                    {t('ltdPlanning.note')}
                    <input
                        aria-label={t('ltdPlanning.noteFor', {
                            name: metric.name,
                        })}
                        className={inputClass}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </label>
                <button
                    type="submit"
                    disabled={busy}
                    className="rounded border px-3 py-2"
                >
                    {t('ltdPlanning.checkin')}
                </button>
            </form>
            <details>
                <summary className="cursor-pointer text-sm">
                    {t('ltdPlanning.history')}
                </summary>
                <ul className="mt-2 space-y-2 text-sm">
                    {metric.checkins?.map((checkin) => (
                        <li key={checkin.uid}>
                            <time>
                                {formatDisplayDate(
                                    new Date(checkin.recorded_at),
                                    { dateStyle: 'medium', timeStyle: 'short' }
                                )}
                            </time>{' '}
                            ·{' '}
                            <bdi>
                                {formatDisplayNumber(checkin.value)}{' '}
                                {metric.unit}
                            </bdi>
                            {checkin.note && (
                                <p>
                                    <bdi>{checkin.note}</bdi>
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            </details>
        </div>
    );
}
