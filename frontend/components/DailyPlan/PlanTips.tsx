import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ExclamationTriangleIcon,
    LightBulbIcon,
    SparklesIcon,
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
    if (tips.length === 0) return null;

    const actionClass =
        'shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40';

    return (
        <section
            className={`flex flex-col gap-1.5 rounded-xl border border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-900/10 ${
                compact ? 'px-3 py-2' : 'px-4 py-3'
            }`}
            aria-label={t('dailyPlan.tips.title', 'Planning tips')}
            data-testid="plan-tips"
        >
            {!compact && (
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                    <SparklesIcon className="h-4 w-4" />
                    {t('dailyPlan.tips.title', 'Planning tips')}
                </p>
            )}
            {tips.map((tip) => {
                let icon = (
                    <LightBulbIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
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
                        className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                    >
                        {icon}
                        <span className="min-w-0 flex-1">{text}</span>
                        {action}
                    </div>
                );
            })}
        </section>
    );
};

export default PlanTips;
