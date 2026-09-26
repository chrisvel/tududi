import React from 'react';
import { useTranslation } from 'react-i18next';

interface FeaturesTabProps {
    isActive: boolean;
    eisenhowerEnabled: boolean;
    onToggleEisenhower: () => void;
    kanbanEnabled: boolean;
    onToggleKanban: () => void;
    habitsEnabled: boolean;
    onToggleHabits: () => void;
    calendarEnabled: boolean;
    onToggleCalendar: () => void;
    templatesEnabled: boolean;
    onToggleTemplates: () => void;
    pomodoroEnabled: boolean;
    onTogglePomodoro: () => void;
}

interface ToggleRowProps {
    label: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    last?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
    label,
    description,
    value,
    onToggle,
    last,
}) => (
    <div
        className={`flex items-center justify-between py-4 ${
            last ? '' : 'border-b border-gray-200 dark:border-gray-700'
        }`}
    >
        <div className="pr-8">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
            </p>
        </div>
        <div
            className={`relative inline-block w-12 h-6 flex-shrink-0 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            onClick={onToggle}
        >
            <span
                className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                    value ? 'translate-x-6' : 'translate-x-0'
                }`}
            />
        </div>
    </div>
);

const FeaturesTab: React.FC<FeaturesTabProps> = ({
    isActive,
    eisenhowerEnabled,
    onToggleEisenhower,
    kanbanEnabled,
    onToggleKanban,
    habitsEnabled,
    onToggleHabits,
    calendarEnabled,
    onToggleCalendar,
    templatesEnabled,
    onToggleTemplates,
    pomodoroEnabled,
    onTogglePomodoro,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {t('profile.featuresAddons', 'Features & Add-ons')}
            </h3>

            <div className="space-y-0">
                <ToggleRow
                    label={t('sidebar.habits', 'Habits')}
                    description={t(
                        'profile.habitsDescription',
                        'Enable the Habits section for tracking recurring behaviours and streaks.'
                    )}
                    value={habitsEnabled}
                    onToggle={onToggleHabits}
                />
                <ToggleRow
                    label={t('sidebar.eisenhower', 'Eisenhower Matrix')}
                    description={t(
                        'profile.eisenhowerDescription',
                        'Enable the Eisenhower Matrix page for prioritising tasks by urgency and importance.'
                    )}
                    value={eisenhowerEnabled}
                    onToggle={onToggleEisenhower}
                />
                <ToggleRow
                    label={t('sidebar.kanban', 'Kanban Board')}
                    description={t(
                        'profile.kanbanDescription',
                        'Enable the Kanban Board for tracking task progress across swimlanes.'
                    )}
                    value={kanbanEnabled}
                    onToggle={onToggleKanban}
                />
                <ToggleRow
                    label={t('sidebar.calendar', 'Calendar')}
                    description={t(
                        'profile.calendarDescription',
                        'Enable the Calendar view for visualising tasks by due date across day, week, and month.'
                    )}
                    value={calendarEnabled}
                    onToggle={onToggleCalendar}
                />
                <ToggleRow
                    label={t('navigation.templates', 'Templates')}
                    description={t(
                        'profile.templatesDescription',
                        'Enable Project Templates to save and reuse project structures.'
                    )}
                    value={templatesEnabled}
                    onToggle={onToggleTemplates}
                />
                <ToggleRow
                    label={t('profile.enablePomodoro', 'Pomodoro Timer')}
                    description={t(
                        'profile.pomodoroDescription',
                        'Enable the Pomodoro timer in the navigation bar for focused work sessions.'
                    )}
                    value={pomodoroEnabled}
                    onToggle={onTogglePomodoro}
                />
            </div>
        </div>
    );
};

export default FeaturesTab;
