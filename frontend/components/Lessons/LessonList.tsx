// Life-to-Day (T-1103): a list of life lessons with the four-box form, under
// Vision on the Life tab and on a goal page (lessons linked to that goal).
import React, { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate } from '../../utils/jalali';
import { Lesson, fetchLessons, lessonKeys } from '../../utils/lessonsService';
import LessonPanel from './LessonPanel';
import { lessonLine } from './effectText';

interface LessonListProps {
    goalUid?: string;
    goalTitle?: string;
    headingId: string;
}

const day = (value: string) =>
    formatDisplayDate(new Date(`${value}T12:00:00Z`), { dateStyle: 'medium' });

const LessonList: React.FC<LessonListProps> = ({
    goalUid,
    goalTitle,
    headingId,
}) => {
    const { t } = useTranslation();
    const { data: lessons, error } = useSWR(lessonKeys.list(goalUid), () =>
        fetchLessons(goalUid)
    );
    const [editing, setEditing] = useState<Lesson | null | undefined>();

    return (
        <section
            aria-labelledby={headingId}
            className="space-y-3"
            data-testid="lesson-list"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                    id={headingId}
                    className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                    {t('ltdLessons.heading', 'Life lessons')}
                </h2>
                <button
                    type="button"
                    className="min-h-[44px] rounded-lg border border-gray-200 px-3 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    onClick={() => setEditing(null)}
                    data-testid="lesson-add"
                >
                    {t('ltdLessons.add', 'Add lesson')}
                </button>
            </div>
            {error && (
                <p
                    role="alert"
                    className="text-sm text-red-600 dark:text-red-400"
                >
                    {t('ltdLessons.loadError', 'Could not load lessons.')}
                </p>
            )}
            {lessons && lessons.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {goalUid
                        ? t(
                              'ltdLessons.emptyGoal',
                              'No lesson is linked to this goal yet.'
                          )
                        : t(
                              'ltdLessons.empty',
                              'What has life taught you? Write it once, with an if/then, and it shows up on the tasks it belongs to.'
                          )}
                </p>
            )}
            {lessons && lessons.length > 0 && (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {lessons.map((lesson) => (
                        <li key={lesson.uid} className="min-w-0">
                            <button
                                type="button"
                                onClick={() => setEditing(lesson)}
                                className="flex w-full min-w-0 flex-col gap-1 rounded-xl border border-gray-200 p-4 text-start hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                data-testid={`lesson-item-${lesson.uid}`}
                            >
                                <bdi className="block break-words font-medium text-gray-900 dark:text-gray-100">
                                    {lesson.title}
                                </bdi>
                                {lesson.if_text && lesson.then_text && (
                                    <bdi className="block break-words text-sm text-gray-700 dark:text-gray-300">
                                        {lessonLine(lesson, t)}
                                    </bdi>
                                )}
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {day(lesson.learned_on)}
                                    {lesson.status !== 'active' &&
                                        ` · ${t(`ltdLessons.status.${lesson.status}`, lesson.status)}`}
                                    {lesson.links.length > 0 && ' · '}
                                    {lesson.links.map((link, index) => (
                                        <React.Fragment
                                            key={`${link.type}:${link.uid}`}
                                        >
                                            {index > 0 && ' · '}
                                            <bdi>{link.title}</bdi>
                                        </React.Fragment>
                                    ))}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {editing !== undefined && (
                <LessonPanel
                    isOpen
                    lesson={editing ?? null}
                    initialLinks={
                        goalUid
                            ? [{ type: 'goal', uid: goalUid, title: goalTitle }]
                            : undefined
                    }
                    onClose={() => setEditing(undefined)}
                />
            )}
        </section>
    );
};

export default LessonList;
