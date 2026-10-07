import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronRightIcon,
    ExclamationTriangleIcon,
    LightBulbIcon,
} from '@heroicons/react/24/outline';
import { PlanTip } from './tips';
import { formatDuration, formatMinute } from './planUtils';

interface PlanTipsProps {
    tips: PlanTip[];
    onMoveMissed?: () => void;
    onPlace?: (tip: Extract<PlanTip, { kind: 'gapFit' }>) => void;
    compact?: boolean;
}

const PlanTips: React.FC<PlanTipsProps> = ({
    tips,
    onMoveMissed,
    onPlace,
    compact = false,
}) => {
    const { t } = useTranslation();
    const [index, setIndex] = useState(0);
    if (tips.length === 0) return null;
    // One tip at a time keeps the page calm; the arrow steps to the next.
    const current = Math.min(index, tips.length - 1);

    const actionClass =
        'shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40';

    return (
        <section
            className={`flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 ${
                compact ? 'px-3 py-1.5' : 'px-3 py-2'
            }`}
            aria-label={t('dailyPlan.tips.title', 'Planning tips')}
            aria-live="polite"
            data-testid="plan-tips"
        >
            {[tips[current]].map((tip) => {
                let icon = (
                    <LightBulbIcon className="h-4 w-4 shrink-0 text-gray-400" />
                );
                let text = '';
                let action: React.ReactNode = null;

                if (tip.kind === 'missed') {
                    icon = (
                        <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    );
                    text = t(
                        'dailyPlan.tips.missed',
                        '{{count}} planned blocks already passed',
                        { count: tip.count }
                    );
                    if (onMoveMissed) {
                        action = (
                            <button
                                type="button"
                                className={actionClass}
                                onClick={onMoveMissed}
                            >
                                {t(
                                    'dailyPlan.tips.moveMissed',
                                    'Move to next free slots'
                                )}
                            </button>
                        );
                    }
                } else if (tip.kind === 'overbooked') {
                    icon = (
                        <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    );
                    text = t(
                        'dailyPlan.tips.overbooked',
                        'Planned {{planned}}, only {{free}} free: {{over}} over',
                        {
                            planned: formatDuration(tip.planned),
                            free: formatDuration(tip.free),
                            over: formatDuration(tip.planned - tip.free),
                        }
                    );
                } else if (tip.kind === 'gapFit') {
                    text = t(
                        'dailyPlan.tips.gapFit',
                        '{{gap}} free at {{time}} fits {{name}} ({{duration}})',
                        {
                            gap: formatDuration(tip.gapMinutes),
                            time: formatMinute(tip.start),
                            name: tip.task.name,
                            duration: formatDuration(tip.duration),
                        }
                    );
                    if (onPlace) {
                        action = (
                            <button
                                type="button"
                                className={actionClass}
                                onClick={() => onPlace(tip)}
                            >
                                {t('dailyPlan.tips.place', 'Place it')}
                            </button>
                        );
                    }
                } else if (tip.kind === 'noBreak') {
                    text = t(
                        'dailyPlan.tips.noBreak',
                        'No break between {{start}} and {{end}}',
                        {
                            start: formatMinute(tip.start),
                            end: formatMinute(tip.end),
                        }
                    );
                }

                return (
                    <div
                        key={`${tip.kind}-${'start' in tip ? tip.start : ''}`}
                        className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                        {icon}
                        <span className="min-w-0 flex-1 truncate">{text}</span>
                        {action}
                    </div>
                );
            })}
            {tips.length > 1 && (
                <button
                    type="button"
                    onClick={() => setIndex((current + 1) % tips.length)}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    aria-label={t('dailyPlan.tips.next', 'Next tip')}
                    data-testid="plan-tips-next"
                >
                    {current + 1}/{tips.length}
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
            )}
        </section>
    );
};

export default PlanTips;
