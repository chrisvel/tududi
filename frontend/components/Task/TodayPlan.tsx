import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import TaskList from './TaskList';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { sortTasksByPriorityDueDateProject } from '../../utils/taskSortUtils';

interface TodayPlanProps {
    todayPlanTasks: Task[] | undefined;
    projects: Project[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskDelete: (taskUid: string) => Promise<void>;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
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

    // Sort tasks to move in-progress tasks to the top, then apply multi-criteria sorting
    const sortedTasks = React.useMemo(() => {
        if (safeTodayPlanTasks.length === 0) return [];

        // Separate in-progress and non-in-progress tasks
        const inProgressTasks = safeTodayPlanTasks.filter(
            (task) => task.status === 'in_progress' || task.status === 1
        );
        const otherTasks = safeTodayPlanTasks.filter(
            (task) => task.status !== 'in_progress' && task.status !== 1
        );

        // Sort each group using multi-criteria sorting
        const sortedInProgress =
            sortTasksByPriorityDueDateProject(inProgressTasks);
        const sortedOthers = sortTasksByPriorityDueDateProject(otherTasks);

        // Return in-progress tasks first, followed by others
        return [...sortedInProgress, ...sortedOthers];
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
