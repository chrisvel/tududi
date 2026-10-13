// Life-to-Day (T-1103): the task effect on the task page: the path, the
// outcome of the nearest measured goal, why that goal matters, and at most
// one life lesson.
import React from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchTaskEffect, lessonKeys } from '../../utils/lessonsService';
import { createGoalUrl } from '../../utils/slugUtils';
import { lessonLine, outcomeLine, pathLine } from './effectText';

const TaskEffectCard: React.FC<{ taskUid: string; refreshKey?: string }> = ({
    taskUid,
    refreshKey,
}) => {
    const { t, i18n } = useTranslation();
    const { data } = useSWR(
        [lessonKeys.effect(taskUid), refreshKey].join(':'),
        () => fetchTaskEffect(taskUid)
    );
    if (!data) return null;
    const outcome = outcomeLine(data, t, i18n.language);
    return (
        <div data-testid="task-effect-card">
            <h3 className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('ltdLessons.effect.heading', 'Long path')}
            </h3>
            <div className="flex flex-col gap-2 rounded-lg border-2 border-gray-50 bg-white p-4 text-sm text-gray-700 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                <p data-testid="task-effect-path">
                    <bdi>{pathLine(data, t)}</bdi>
                </p>
                {data.chain.length > 1 && (
                    <ol
                        aria-label={t('ltdPlanning.whyChain')}
                        className="flex flex-wrap gap-1 text-xs text-gray-500 dark:text-gray-400"
                    >
                        {data.chain.map((node, index) => (
                            <li key={node.uid} className="min-w-0 break-words">
                                {index > 0 && (
                                    <span aria-hidden="true">← </span>
                                )}
                                <Link
                                    className="hover:underline"
                                    to={createGoalUrl({
                                        uid: node.uid,
                                        title: node.title,
                                    })}
                                >
                                    <bdi>{node.title}</bdi>
                                </Link>
                            </li>
                        ))}
                    </ol>
                )}
                {outcome && <p data-testid="task-effect-outcome">{outcome}</p>}
                {data.meaning && (
                    <p>
                        <span className="font-medium">
                            {t('ltdLessons.effect.why', 'Why this goal')}:
                        </span>{' '}
                        <bdi className="whitespace-pre-line">
                            {data.meaning}
                        </bdi>
                    </p>
                )}
                {data.lesson && (
                    <p
                        className="border-s-2 border-amber-400 ps-2 text-gray-800 dark:text-gray-200"
                        data-testid="task-effect-lesson"
                    >
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {t('ltdLessons.lesson', 'Lesson')}
                        </span>
                        <bdi>{lessonLine(data.lesson, t)}</bdi>
                    </p>
                )}
            </div>
        </div>
    );
};

export default TaskEffectCard;
