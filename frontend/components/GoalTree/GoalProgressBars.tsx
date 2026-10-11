import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayNumber } from '../../utils/jalali';
import { GoalProgress } from '../../utils/planningService';

export default function GoalProgressBars({
    progress,
}: {
    progress: GoalProgress;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-3" data-testid="goal-progress">
            {(['A', 'O'] as const).map((signal) => {
                const value = progress[signal];
                const label = t(
                    signal === 'A'
                        ? 'ltdPlanning.activity'
                        : 'ltdPlanning.outcome'
                );
                return (
                    <div key={signal}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span>{label}</span>
                            <span data-testid={`goal-progress-${signal}`}>
                                {value === null
                                    ? t(
                                          signal === 'O'
                                              ? 'ltdPlanning.noOutcome'
                                              : 'ltdPlanning.noActivity'
                                      )
                                    : formatDisplayNumber(value, {
                                          style: 'percent',
                                          maximumFractionDigits: 0,
                                      })}
                            </span>
                        </div>
                        {value !== null && (
                            <div
                                role="progressbar"
                                aria-label={label}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(value * 100)}
                                className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                            >
                                <div
                                    className={`h-full rounded-full ${signal === 'A' ? 'bg-blue-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${value * 100}%` }}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
            {progress.health && (
                <p
                    className={`text-sm ${progress.health === 'on_track' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}
                >
                    {t(`ltdPlanning.health.${progress.health}`)}
                </p>
            )}
        </div>
    );
}
