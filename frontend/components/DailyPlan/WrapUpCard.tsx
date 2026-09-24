import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoonIcon, SparklesIcon } from '@heroicons/react/24/outline';
import {
    AiWrapUp,
    carryOverTasks,
    wrapUpDayWithAi,
} from '../../utils/dailyPlanService';
import { useToast } from '../Shared/ToastContext';

interface WrapUpCardProps {
    date: string;
    wrapUp: AiWrapUp | null;
    onGenerated: (wrapUp: AiWrapUp) => void;
}

const nextDate = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const WrapUpCard: React.FC<WrapUpCardProps> = ({
    date,
    wrapUp,
    onGenerated,
}) => {
    const { t } = useTranslation();
    const { showErrorToast, showSuccessToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [carrying, setCarrying] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        setSelected(new Set(wrapUp?.carry_over.map((c) => c.task_uid) ?? []));
    }, [wrapUp]);

    const generate = async () => {
        setLoading(true);
        try {
            const result = await wrapUpDayWithAi(date);
            onGenerated(result.wrap_up);
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t(
                          'dailyPlan.ai.wrapUpError',
                          'Could not wrap up the day.'
                      )
            );
        } finally {
            setLoading(false);
        }
    };

    const carryOver = async () => {
        if (selected.size === 0) return;
        setCarrying(true);
        try {
            await carryOverTasks(nextDate(date), [...selected]);
            showSuccessToast(
                t('dailyPlan.ai.carried', '{{count}} tasks added to tomorrow', {
                    count: selected.size,
                })
            );
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : t('dailyPlan.saveError', 'Could not save the plan.')
            );
        } finally {
            setCarrying(false);
        }
    };

    if (!wrapUp) {
        return (
            <section
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 dark:border-violet-900/60 dark:bg-violet-900/20"
                data-testid="wrap-up-card"
            >
                <MoonIcon className="h-6 w-6 text-violet-700 dark:text-violet-300" />
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base text-gray-900 dark:text-gray-100">
                        {t('dailyPlan.ai.wrapUpTitle', 'How did today go?')}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t(
                            'dailyPlan.ai.wrapUpHint',
                            'Get a short recap and pick what to carry over to tomorrow.'
                        )}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={generate}
                    disabled={loading}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                    data-testid="wrap-up-generate"
                >
                    <SparklesIcon
                        className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`}
                    />
                    {loading
                        ? t('dailyPlan.ai.wrappingUp', 'Thinking…')
                        : t('dailyPlan.ai.wrapUp', 'Wrap up my day')}
                </button>
            </section>
        );
    }

    return (
        <section
            className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 dark:border-violet-900/60 dark:bg-violet-900/20"
            data-testid="wrap-up-card"
        >
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                <MoonIcon className="h-4 w-4" />
                {t('dailyPlan.ai.wrapUpHeading', 'Day wrap-up')}
            </p>
            <p className="text-[15px] text-gray-900 dark:text-gray-100">
                {wrapUp.summary}
            </p>
            {wrapUp.wins.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                    {wrapUp.wins.map((win) => (
                        <li key={win}>✓ {win}</li>
                    ))}
                </ul>
            )}
            {wrapUp.pattern && (
                <p className="text-sm italic text-gray-600 dark:text-gray-400">
                    {wrapUp.pattern}
                </p>
            )}
            {wrapUp.carry_over.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-violet-200 pt-3 dark:border-violet-900/60">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {t('dailyPlan.ai.carryTitle', 'Carry over to tomorrow')}
                    </p>
                    {wrapUp.carry_over.map((item) => (
                        <label
                            key={item.task_uid}
                            className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200"
                        >
                            <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={selected.has(item.task_uid)}
                                onChange={(e) =>
                                    setSelected((current) => {
                                        const next = new Set(current);
                                        if (e.target.checked) {
                                            next.add(item.task_uid);
                                        } else {
                                            next.delete(item.task_uid);
                                        }
                                        return next;
                                    })
                                }
                            />
                            <span>
                                {item.name}
                                {item.reason && (
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {' '}
                                        · {item.reason}
                                    </span>
                                )}
                            </span>
                        </label>
                    ))}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={carryOver}
                            disabled={carrying || selected.size === 0}
                            className="inline-flex min-h-[36px] items-center rounded-lg bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
                            data-testid="wrap-up-carry"
                        >
                            {t('dailyPlan.ai.addToTomorrow', 'Add to tomorrow')}
                        </button>
                        <button
                            type="button"
                            onClick={generate}
                            disabled={loading}
                            className="text-xs text-gray-600 underline-offset-2 hover:underline disabled:opacity-60 dark:text-gray-400"
                        >
                            {t('dailyPlan.ai.regenerate', 'Regenerate')}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default WrapUpCard;
