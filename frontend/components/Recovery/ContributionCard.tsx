// Life-to-Day (T-505): "Today helped these goals", from the whyChain and the
// minutes done. Work without a goal is normal, never an error.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Contribution } from '../../utils/todayService';
import { formatDuration } from '../DailyPlan/planUtils';

const ContributionCard: React.FC<{ contribution: Contribution }> = ({
    contribution,
}) => {
    const { t } = useTranslation();
    const { goals, unaligned_minutes: unaligned } = contribution;
    if (goals.length === 0 && unaligned === 0) return null;
    return (
        <section
            className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            data-testid="contribution-card"
        >
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
                {t('contribution.title', 'Today helped these goals')}
            </h3>
            <ul className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                {goals.map((goal) => (
                    <li key={goal.goal_uid}>
                        {t('contribution.goalLine', '{{time}} for', {
                            time: formatDuration(goal.minutes),
                        })}{' '}
                        <bdi>{goal.title}</bdi>
                    </li>
                ))}
                {unaligned > 0 && (
                    <li data-testid="contribution-unaligned">
                        {t(
                            'contribution.unaligned',
                            '{{time}} of other work (that is normal)',
                            { time: formatDuration(unaligned) }
                        )}
                    </li>
                )}
            </ul>
        </section>
    );
};

export default ContributionCard;
