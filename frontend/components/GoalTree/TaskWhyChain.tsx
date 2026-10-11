import React from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { fetchTaskWhyChain } from '../../utils/planningService';
import { createGoalUrl } from '../../utils/slugUtils';

export default function TaskWhyChain({ task }: { task: Task }) {
    const { t } = useTranslation();
    const { data } = useSWR(
        task.uid && (task.goal_id || task.project_id)
            ? `ltd:why:${task.uid}:${task.goal_id}:${task.project_id}`
            : null,
        () => fetchTaskWhyChain(task.uid!)
    );
    if (!data?.whyChain.length) return null;
    return (
        <nav
            aria-label={t('ltdPlanning.whyChain')}
            className="mt-1 min-w-0 text-xs text-gray-500 dark:text-gray-400"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <ol className="flex flex-wrap gap-1">
                <li>{t('ltdPlanning.thisTask')}</li>
                {data.whyChain.map((goal) => (
                    <li key={goal.uid} className="min-w-0 break-words">
                        <span aria-hidden="true"> ← </span>
                        <Link
                            className="hover:underline"
                            to={createGoalUrl({
                                uid: goal.uid!,
                                title: goal.title,
                            })}
                        >
                            <bdi>{goal.title}</bdi>
                        </Link>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
