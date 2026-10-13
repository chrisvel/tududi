// Life-to-Day (T-1103): the optional lesson of the day review (blueprint
// 14.6). Opens the same four-box form as the Life tab.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LessonPanel from './LessonPanel';

const DayLessonCard: React.FC = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <section
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            data-testid="day-lesson-card"
        >
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                    {t(
                        'ltdLessons.day.title',
                        'Did today teach you something?'
                    )}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                        'ltdLessons.day.hint',
                        'Optional. One line is enough; an if/then makes it show up on the right task next time.'
                    )}
                </span>
            </div>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="min-h-[44px] rounded-lg px-3.5 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                data-testid="day-lesson-write"
            >
                {t('ltdLessons.day.write', 'Write a lesson')}
            </button>
            {open && (
                <LessonPanel
                    isOpen
                    lesson={null}
                    onClose={() => setOpen(false)}
                />
            )}
        </section>
    );
};

export default DayLessonCard;
