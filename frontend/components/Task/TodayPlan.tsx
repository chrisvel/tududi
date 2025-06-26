import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import TaskList from "./TaskList";
import { Task } from "../../entities/Task";
import { Project } from "../../entities/Project";

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
        <div className="text-center py-8">
          <CalendarDaysIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
            {t('tasks.noPlanToday', 'No tasks planned for today yet')}
            </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {t('tasks.addToPlanHint', 'Use the calendar icons next to suggested tasks to add them to your today plan')}
          </p>
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