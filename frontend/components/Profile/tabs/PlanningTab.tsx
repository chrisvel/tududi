import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { QueueListIcon } from '@heroicons/react/24/outline';

interface PlanningTabProps {
    isActive: boolean;
}

// Describes the ranking in backend/modules/daily-plan/ranking.js. Keep the
// two in step when either changes.
const PlanningTab: React.FC<PlanningTabProps> = ({ isActive }) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    const groups = [
        {
            title: t('profile.planning.overdue', 'Overdue'),
            detail: t(
                'profile.planning.overdueDetail',
                'Past their due date, including tasks you already started.'
            ),
        },
        {
            title: t('profile.planning.dueToday', 'Due today'),
            detail: t(
                'profile.planning.dueTodayDetail',
                'Tasks due before the day ends.'
            ),
        },
        {
            title: t('profile.planning.inProgress', 'In progress'),
            detail: t(
                'profile.planning.inProgressDetail',
                'Work you started and have not finished.'
            ),
        },
        {
            title: t('profile.planning.everythingElse', 'Everything else'),
            detail: t(
                'profile.planning.everythingElseDetail',
                'Open tasks you could pick up. Deferred tasks, someday tasks and tasks due more than 3 days out are left out.'
            ),
        },
    ];

    const tieBreakers = [
        t('profile.planning.rulePriority', 'Higher priority first.'),
        t(
            'profile.planning.ruleProject',
            'Tasks in a project before tasks without one.'
        ),
        t(
            'profile.planning.ruleDue',
            'The earlier due date first, then the older task.'
        ),
    ];

    return (
        <div>
            <h3 className="mb-6 flex items-center text-xl font-semibold text-gray-900 dark:text-white">
                <QueueListIcon className="mr-3 h-6 w-6 text-blue-500" />
                {t('profile.planning.title', 'Planning')}
            </h3>

            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                {t(
                    'profile.planning.description',
                    'How "What could you do today?" orders your tasks when you plan your day. The rules are fixed, so the same tasks always come out in the same order.'
                )}
            </p>

            <h4 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('profile.planning.groupsTitle', 'Groups, in this order')}
            </h4>
            <ol className="mb-6 flex flex-col gap-2">
                {groups.map((group, index) => (
                    <li
                        key={group.title}
                        className="flex items-start gap-3 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/60"
                    >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                            {index + 1}
                        </span>
                        <span className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {group.title}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                {group.detail}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>

            <h4 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('profile.planning.withinTitle', 'Inside each group')}
            </h4>
            <ol className="mb-6 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                {tieBreakers.map((rule) => (
                    <li key={rule}>{rule}</li>
                ))}
            </ol>

            <Link
                to="/today/plan"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
                {t('profile.planning.open', 'Plan my day')}
            </Link>
        </div>
    );
};

export default PlanningTab;
