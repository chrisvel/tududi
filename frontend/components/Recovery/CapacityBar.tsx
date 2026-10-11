// Life-to-Day (T-501): load against today's capacity (blueprint 14.5). The
// numbers come from the server; this only shows them, without red.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Capacity } from '../../utils/todayService';
import { formatDuration } from '../DailyPlan/planUtils';

interface CapacityBarProps {
    capacity: Capacity;
    nameOf: (taskUid: string) => string | undefined;
}

const CapacityBar: React.FC<CapacityBarProps> = ({ capacity, nameOf }) => {
    const { t } = useTranslation();
    const percent =
        capacity.load === null ? 100 : Math.round(capacity.load * 100);
    const moves = capacity.move_suggestions
        .map((uid) => nameOf(uid))
        .filter((name): name is string => !!name);
    return (
        <section
            className="flex flex-col gap-2"
            data-testid="capacity-bar"
            aria-label={t('capacity.label', 'Today’s load')}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>
                    {t(
                        'capacity.summary',
                        '{{planned}} planned of {{capacity}} free',
                        {
                            planned: formatDuration(
                                Math.round(
                                    capacity.planned_minutes * capacity.factor
                                )
                            ),
                            capacity: formatDuration(capacity.capacity_minutes),
                        }
                    )}
                </span>
                <span data-testid="capacity-percent">
                    {t('capacity.percent', '{{percent}}%', {
                        percent: Math.min(percent, 999),
                    })}
                </span>
            </div>
            <div
                className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700"
                role="meter"
                aria-valuenow={Math.min(percent, 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('capacity.label', 'Today’s load')}
            >
                <div
                    className={`h-1.5 rounded-full ${capacity.unrealistic ? 'bg-amber-500' : 'bg-secondary'}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                />
            </div>
            {capacity.unrealistic && (
                <p
                    className="text-sm text-gray-800 dark:text-gray-200"
                    data-testid="capacity-unrealistic"
                    role="status"
                >
                    {t(
                        'capacity.unrealistic',
                        'This plan is bigger than the time you have.'
                    )}
                    {moves.length > 0 && (
                        <>
                            {' '}
                            {t('capacity.moveHint', 'Maybe move:')}{' '}
                            {moves.map((name, i) => (
                                <React.Fragment key={`${name}-${i}`}>
                                    {i > 0 && t('capacity.separator', ', ')}
                                    <bdi>{name}</bdi>
                                </React.Fragment>
                            ))}
                        </>
                    )}
                </p>
            )}
            {capacity.event_overlaps.length > 0 && (
                <p
                    className="text-sm text-gray-700 dark:text-gray-300"
                    data-testid="capacity-overlap"
                >
                    {t(
                        'capacity.eventOverlap',
                        'Some blocks overlap a calendar event.'
                    )}
                </p>
            )}
            {capacity.missing_buffer.length > 0 && (
                <p
                    className="text-sm text-gray-700 dark:text-gray-300"
                    data-testid="capacity-buffer"
                >
                    {t(
                        'capacity.missingBuffer',
                        'Leave 5 minutes between blocks to breathe.'
                    )}
                </p>
            )}
        </section>
    );
};

export default CapacityBar;
