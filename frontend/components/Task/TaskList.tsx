import React from 'react';
import TaskItem from './TaskItem';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';

interface TaskListProps {
    tasks: Task[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCreate?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => Promise<void>;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskUid: string) => Promise<void>;
}

const TaskList: React.FC<TaskListProps> = ({
    tasks,
    onTaskUpdate,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
}) => {
    return (
        <div className="task-list-container">
            {tasks.length > 0 ? (
                tasks.map((task) => (
                    <div
                        key={task.uid || task.id}
                        className="task-item-wrapper transition-all duration-200 ease-in-out"
                    >
                        <TaskItem
                            task={task}
                            onTaskUpdate={onTaskUpdate}
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
