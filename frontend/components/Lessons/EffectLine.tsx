// Life-to-Day (T-1103): the effect of a task on the Now card and in Focus.
// One path line and, when a lesson belongs here, one lesson line. The
// outcome percent and the "why" wait behind "More" (expandable only).
import React, { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { fetchTaskEffect, lessonKeys } from '../../utils/lessonsService';
import { lessonLine, outcomeLine, pathLine } from './effectText';

interface EffectLineProps {
    taskUid: string | null | undefined;
    expandable?: boolean;
    className?: string;
}

const EffectLine: React.FC<EffectLineProps> = ({
    taskUid,
    expandable = false,
    className = 'text-sm text-gray-600 dark:text-gray-400',
}) => {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const { data } = useSWR(taskUid ? lessonKeys.effect(taskUid) : null, () =>
        fetchTaskEffect(taskUid!)
    );
    if (!data) return null;
    const outcome = outcomeLine(data, t, i18n.language);
    return (
        <div
            className={`flex flex-col gap-1 ${className}`}
            data-testid="effect-line"
        >
            <span data-testid="effect-path">
                <bdi>{pathLine(data, t)}</bdi>
            </span>
            {data.lesson && (
                <span
                    className="text-gray-800 dark:text-gray-200"
                    data-testid="effect-lesson"
                >
                    <bdi>{lessonLine(data.lesson, t)}</bdi>
                </span>
            )}
            {expandable && data.kind === 'linked' && (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        aria-expanded={open}
                        className="min-h-[44px] self-start text-sm text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
                        data-testid="effect-more"
                    >
                        {open
                            ? t('ltdLessons.effect.less', 'Less')
                            : t(
                                  'ltdLessons.effect.more',
                                  'More about this path'
                              )}
                    </button>
                    {open && (
                        <div
                            className="flex flex-col gap-1"
                            data-testid="effect-details"
                        >
                            {outcome && (
                                <span data-testid="effect-outcome">
                                    {outcome}
                                </span>
                            )}
                            {data.meaning && (
                                <span>
                                    {t(
                                        'ltdLessons.effect.why',
                                        'Why this goal'
                                    )}
                                    :{' '}
                                    <bdi className="whitespace-pre-line">
                                        {data.meaning}
                                    </bdi>
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default EffectLine;
