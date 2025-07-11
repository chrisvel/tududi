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
}

const TodayPlan: React.FC<TodayPlanProps> = ({
    todayPlanTasks,
    projects,
    onTaskUpdate,
    onTaskDelete,
    onToggleToday,
}) => {
    const { t } = useTranslation();

    // Handle undefined or null todayPlanTasks
    const safeTodayPlanTasks = todayPlanTasks || [];

    if (safeTodayPlanTasks.length === 0) {
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
                tasks={safeTodayPlanTasks}
                onTaskUpdate={onTaskUpdate}
                onTaskDelete={onTaskDelete}
                projects={projects}
                onToggleToday={onToggleToday}
            />
        </>
    );
};

export default TodayPlan;
