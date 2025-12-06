import React from 'react';
import TaskItem from './TaskItem';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

interface TaskListProps {
    tasks: Task[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskCreate?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    showCompletedTasks?: boolean; // New prop
}

const TaskList: React.FC<TaskListProps> = ({
    tasks,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
    showCompletedTasks = false, // Default to false
}) => {
    // Conditionally filter tasks based on showCompletedTasks prop
    const filteredTasks = showCompletedTasks
        ? tasks
        : tasks.filter((task) => {
              const isCompleted =
                  task.status === 'done' ||
                  task.status === 'archived' ||
                  task.status === 2 ||
                  task.status === 3;
              return !isCompleted;
          });

    return (
        <div className="task-list-container space-y-1.5 overflow-visible">
            {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                    <div
                        key={task.id}
                        className="task-item-wrapper transition-all duration-200 ease-in-out overflow-visible"
                        data-testid={`task-item-${task.id}`}
                    >
                        <TaskItem
                            task={task}
                            onTaskUpdate={onTaskUpdate}
                            onTaskCompletionToggle={onTaskCompletionToggle}
                            onTaskDelete={onTaskDelete}
                            projects={projects}
                            hideProjectName={hideProjectName}
                            onToggleToday={onToggleToday}
                        />
                    </div>
                ))
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center mt-4">
                    No tasks available.
                </p>
            )}
        </div>
    );
};

export default TaskList;
