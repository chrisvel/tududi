import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import TaskList from './TaskList';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';

interface TodayPlanProps {
    todayPlanTasks: Task[] | undefined;
    projects: Project[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskDelete: (taskId: number) => Promise<void>;
    onToggleToday?: (taskId: number) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void; // New prop
}

const TodayPlan: React.FC<TodayPlanProps> = ({
    todayPlanTasks,
    projects,
    onTaskUpdate,
    onTaskDelete,
    onToggleToday,
    onTaskCompletionToggle, // Destructure new prop
}) => {
    const { t } = useTranslation();

    // Handle undefined or null todayPlanTasks
    const safeTodayPlanTasks = todayPlanTasks || [];

    // Sort tasks to move in-progress tasks to the top
    const sortedTasks = React.useMemo(() => {
        if (safeTodayPlanTasks.length === 0) return [];

        return [...safeTodayPlanTasks].sort((a, b) => {
            const aInProgress = a.status === 'in_progress' || a.status === 1;
            const bInProgress = b.status === 'in_progress' || b.status === 1;

            // If both are in progress, sort by updated_at (recently updated to bottom)
            if (aInProgress && bInProgress) {
                // Recently updated tasks should be at the bottom of in-progress group
                const aUpdated = new Date(a.updated_at || a.created_at || 0);
                const bUpdated = new Date(b.updated_at || b.created_at || 0);
                return aUpdated.getTime() - bUpdated.getTime(); // Older tasks first, newer to bottom
            }

            // If both are not in progress, maintain original order
            if (!aInProgress && !bInProgress) {
                return 0;
            }

            // Put in-progress tasks first
            return aInProgress ? -1 : 1;
        });
    }, [safeTodayPlanTasks]);

    if (sortedTasks.length === 0) {
        return (
            <>
                <div className="flex justify-center items-center mt-4">
                    <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                        <CalendarDaysIcon className="h-20 w-20 text-gray-400 opacity-30 mb-6" />
                        <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                            {t(
                                'tasks.noPlanToday',
                                'No tasks planned for today yet'
                            )}
                        </p>
                        <p className="text-base text-center text-gray-400 dark:text-gray-400">
                            {t(
                                'tasks.addToPlanHint',
                                'Click the "add to today plan" icon on the right of any task to add it here'
                            )}
                        </p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <TaskList
                tasks={sortedTasks}
                onTaskUpdate={onTaskUpdate}
                onTaskDelete={onTaskDelete}
                projects={projects}
                onToggleToday={onToggleToday}
                onTaskCompletionToggle={onTaskCompletionToggle}
            />
        </>
    );
};

export default TodayPlan;
