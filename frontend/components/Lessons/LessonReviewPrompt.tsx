// Life-to-Day (T-1103): at most one lesson review a day on Today (blueprint
// 14.7): the active lesson whose review day came first. Each answer is a
// Journal entry with Undo.
import React, { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import { revertJournal } from '../../utils/planningService';
import {
    LessonVerdict,
    fetchDueLesson,
    lessonKeys,
    refreshLessons,
    reviewLesson,
} from '../../utils/lessonsService';
import { lessonLine } from './effectText';

const LessonReviewPrompt: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast, showUndoToast } = useToast();
    const { data: lesson } = useSWR(lessonKeys.due, fetchDueLesson);
    const [busy, setBusy] = useState(false);
    if (!lesson) return null;

    const answer = async (verdict: LessonVerdict) => {
        setBusy(true);
        try {
            const { journal_uid } = await reviewLesson(lesson.uid, verdict);
            showUndoToast(
                t('ltdLessons.review.saved', 'Noted'),
                () =>
                    void revertJournal(journal_uid)
                        .then(() => refreshLessons())
                        .catch(() =>
                            showErrorToast(
                                t('ltdLife.undoFailed', 'Could not undo')
                            )
                        )
            );
        } catch (err) {
            showErrorToast((err as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const button =
        'min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

    return (
        <section
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-900/20"
            data-testid="lesson-review"
        >
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {t(
                    'ltdLessons.review.question',
                    'Does this lesson still hold?'
                )}
            </p>
            <bdi className="block break-words text-gray-900 dark:text-gray-100">
                {lessonLine(lesson, t)}
            </bdi>
            {lesson.if_text && lesson.then_text && (
                <bdi className="block text-sm text-gray-600 dark:text-gray-400">
                    {lesson.title}
                </bdi>
            )}
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => answer('holds')}
                    data-testid="lesson-review-holds"
                >
                    {t('ltdLessons.review.holds', 'It holds')}
                </button>
                <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => answer('not_yet')}
                    data-testid="lesson-review-not-yet"
                >
                    {t('ltdLessons.review.notYet', 'Not yet')}
                </button>
                <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => answer('park')}
                    data-testid="lesson-review-park"
                >
                    {t('ltdLessons.review.park', 'Set it aside')}
                </button>
            </div>
        </section>
    );
};

export default LessonReviewPrompt;
