import React, { useState, useEffect } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';

// Import SubtasksDisplay component from TaskHeader
interface SubtasksDisplayProps {
    showSubtasks: boolean;
    loadingSubtasks: boolean;
    subtasks: Task[];
    onTaskClick: (e: React.MouseEvent, task: Task) => void;
    onTaskUpdate: (task: Task) => Promise<void>;
    loadSubtasks: () => Promise<void>;
}

const SubtasksDisplay: React.FC<SubtasksDisplayProps> = ({
    showSubtasks,
    loadingSubtasks,
    subtasks,
    onTaskClick,
    onTaskUpdate,
    loadSubtasks,
}) => {
    const { t } = useTranslation();

    if (!showSubtasks) return null;

    return (
        <div className="mt-1 space-y-1">
            {loadingSubtasks ? (
                <div className="ml-12 text-sm text-gray-500 dark:text-gray-400">
                    {t('loading.subtasks', 'Loading subtasks...')}
                </div>
            ) : subtasks.length > 0 ? (
                subtasks.map((subtask) => (
                    <div key={subtask.id} className="ml-12 group">
                        <div
                            className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 cursor-pointer transition-all duration-200 ${
                                subtask.status === 'in_progress' ||
                                subtask.status === 1
                                    ? 'border-green-400/60 dark:border-green-500/60'
                                    : 'border-gray-50 dark:border-gray-800'
                            }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(e, subtask);
                            }}
                        >
                            <div className="px-4 py-2.5 flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    {subtask.status === 'done' ||
                                    subtask.status === 2 ||
                                    subtask.status === 'archived' ||
                                    subtask.status === 3 ? (
                                        <div
                                            className="h-5 w-5 cursor-pointer hover:scale-110 transition-transform text-green-500 flex items-center justify-center"
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                            }}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (subtask.id) {
                                                    try {
                                                        const updatedSubtask =
                                                            await toggleTaskCompletion(
                                                                subtask.id
                                                            );
                                                        await onTaskUpdate(
                                                            updatedSubtask
                                                        );
                                                        // Refresh subtasks to show updated status
                                                        await loadSubtasks();
                                                    } catch (error) {
                                                        console.error(
                                                            'Error toggling subtask completion:',
                                                            error
                                                        );
                                                    }
                                                }
                                            }}
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    ) : (
                                        <div
                                            className={`h-5 w-5 cursor-pointer hover:scale-110 transition-transform border-2 border-current rounded-full flex-shrink-0 ${
                                                subtask.priority === 'high'
                                                    ? 'text-red-500'
                                                    : subtask.priority ===
                                                        'medium'
                                                      ? 'text-yellow-500'
                                                      : 'text-gray-300'
                                            }`}
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                            }}
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (subtask.id) {
                                                    try {
                                                        const updatedSubtask =
                                                            await toggleTaskCompletion(
                                                                subtask.id
                                                            );
                                                        await onTaskUpdate(
                                                            updatedSubtask
                                                        );
                                                        // Refresh subtasks to show updated status
                                                        await loadSubtasks();
                                                    } catch (error) {
                                                        console.error(
                                                            'Error toggling subtask completion:',
                                                            error
                                                        );
                                                    }
                                                }
                                            }}
                                        />
                                    )}
                                    <span
                                        className={`text-base flex-1 truncate ${
                                            subtask.status === 'done' ||
                                            subtask.status === 2 ||
                                            subtask.status === 'archived' ||
                                            subtask.status === 3
                                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {subtask.name}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    {/* Right side status indicators removed */}
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="ml-12 text-sm text-gray-500 dark:text-gray-400">
                    {t('subtasks.noSubtasks', 'No subtasks found')}
                </div>
            )}
        </div>
    );
};
import TaskModal from './TaskModal';
import {
    toggleTaskCompletion,
    fetchSubtasks,
    fetchTaskById,
} from '../../utils/tasksService';
import { isTaskOverdue } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';

interface TaskItemProps {
    task: Task;
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskDelete: (taskId: number) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number) => Promise<void>;
}

const TaskItem: React.FC<TaskItemProps> = ({
    task,
    onTaskUpdate,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
    const [selectedSubtask, setSelectedSubtask] = useState<Task | null>(null);
    const [projectList, setProjectList] = useState<Project[]>(projects);
    const [parentTaskModalOpen, setParentTaskModalOpen] = useState(false);
    const [parentTask, setParentTask] = useState<Task | null>(null);

    // Subtasks state
    const [showSubtasks, setShowSubtasks] = useState(false);
    const [subtasks, setSubtasks] = useState<Task[]>([]);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [hasSubtasks, setHasSubtasks] = useState(false);

    // Calculate completion percentage
    const calculateCompletionPercentage = () => {
        if (subtasks.length === 0) return 0;
        const completedCount = subtasks.filter(
            (subtask) =>
                subtask.status === 'done' ||
                subtask.status === 2 ||
                subtask.status === 'archived' ||
                subtask.status === 3
        ).length;
        return Math.round((completedCount / subtasks.length) * 100);
    };

    const completionPercentage = calculateCompletionPercentage();

    // Helper function to check if task has subtasks
    const checkSubtasks = async () => {
        if (!task.id) return;

        try {
            const subtasksData = await fetchSubtasks(task.id);
            setHasSubtasks(subtasksData.length > 0);
        } catch (error) {
            console.error('Error fetching subtasks:', error);
            setHasSubtasks(false);
        }
    };

    // Check if task has subtasks on mount
    useEffect(() => {
        checkSubtasks();
    }, [task.id]);

    const loadSubtasks = async () => {
        if (!task.id) return;

        setLoadingSubtasks(true);
        try {
            const subtasksData = await fetchSubtasks(task.id);
            setSubtasks(subtasksData);
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            setSubtasks([]);
        } finally {
            setLoadingSubtasks(false);
        }
    };

    // Reload subtasks when showSubtasks changes to true
    useEffect(() => {
        if (showSubtasks && subtasks.length === 0) {
            loadSubtasks();
        }
    }, [showSubtasks, subtasks.length]);

    const handleSubtasksToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!showSubtasks && subtasks.length === 0) {
            await loadSubtasks();
        }

        setShowSubtasks(!showSubtasks);
    };

    const handleTaskClick = () => {
        setIsModalOpen(true);
    };

    const handleSubtaskClick = async (subtask: Task) => {
        // If subtask has a parent_task_id, open the parent task with subtasks focus
        if (subtask.parent_task_id) {
            try {
                const parentTask = await fetchTaskById(subtask.parent_task_id);
                setParentTask(parentTask);
                setParentTaskModalOpen(true);
            } catch (error) {
                console.error('Error fetching parent task:', error);
                // Fall back to opening the subtask itself
                setSelectedSubtask(subtask);
                setSubtaskModalOpen(true);
            }
        } else {
            // If no parent_task_id, open the subtask itself
            setSelectedSubtask(subtask);
            setSubtaskModalOpen(true);
        }
    };

    const handleSubtaskSave = async (updatedSubtask: Task) => {
        await onTaskUpdate(updatedSubtask);
        setSubtaskModalOpen(false);
        setSelectedSubtask(null);
        // Refresh subtasks check after saving
        await checkSubtasks();
    };

    const handleSubtaskDelete = async () => {
        if (selectedSubtask && selectedSubtask.id) {
            await onTaskDelete(selectedSubtask.id);
            setSubtaskModalOpen(false);
            setSelectedSubtask(null);
            // Refresh subtasks check after deleting
            await checkSubtasks();
        }
    };

    const handleParentTaskSave = async (updatedParentTask: Task) => {
        await onTaskUpdate(updatedParentTask);
        setParentTaskModalOpen(false);
        setParentTask(null);
        // Refresh subtasks check after saving
        await checkSubtasks();
    };

    const handleParentTaskDelete = async () => {
        if (parentTask && parentTask.id) {
            await onTaskDelete(parentTask.id);
            setParentTaskModalOpen(false);
            setParentTask(null);
            // Refresh subtasks check after deleting
            await checkSubtasks();
        }
    };

    const handleSave = async (updatedTask: Task) => {
        await onTaskUpdate(updatedTask);
        setIsModalOpen(false);
        // Refresh subtasks check after saving
        await checkSubtasks();
    };

    const handleDelete = async () => {
        if (task.id) {
            await onTaskDelete(task.id);
        }
    };

    const handleToggleCompletion = async () => {
        if (task.id) {
            try {
                const updatedTask = await toggleTaskCompletion(task.id);
                await onTaskUpdate(updatedTask);
            } catch (error) {
                console.error('Error toggling task completion:', error);
            }
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            const response = await fetch('/api/project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, active: true }),
            });

            if (!response.ok) {
                throw new Error('Failed to create project');
            }

            const newProject = await response.json();
            setProjectList((prevProjects) => [...prevProjects, newProject]);
            return newProject;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    // Use the project from the task's included data if available, otherwise find from projectList
    let project =
        task.Project || projectList.find((p) => p.id === task.project_id);

    // If project exists but doesn't have an ID, add the ID from task.project_id
    if (project && !project.id && task.project_id) {
        project = { ...project, id: task.project_id };
    }

    // Check if task is in progress to apply pulsing border animation
    const isInProgress = task.status === 'in_progress' || task.status === 1;

    // Check if task is overdue (created yesterday or earlier and not completed)
    const isOverdue = isTaskOverdue(task);

    return (
        <>
            <div
                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1 relative overflow-hidden transition-all duration-200 ease-in-out ${
                    isInProgress
                        ? 'border-2 border-green-400/60 dark:border-green-500/60'
                        : 'md:dark:border-2 md:dark:border-gray-800'
                }`}
            >
                <TaskHeader
                    task={task}
                    project={project}
                    onTaskClick={handleTaskClick}
                    onToggleCompletion={handleToggleCompletion}
                    hideProjectName={hideProjectName}
                    onToggleToday={onToggleToday}
                    onTaskUpdate={onTaskUpdate}
                    isOverdue={isOverdue}
                    showSubtasks={showSubtasks}
                    hasSubtasks={hasSubtasks}
                    onSubtasksToggle={handleSubtasksToggle}
                />

                {/* Progress bar at bottom of parent task */}
                {subtasks.length > 0 && (
                    <div
                        className={`absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-300 ease-in-out overflow-hidden rounded-b-lg ${
                            showSubtasks
                                ? 'opacity-100 transform translate-y-0'
                                : 'opacity-0 transform translate-y-2'
                        }`}
                    >
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 transition-all duration-500 ease-out"
                                style={{ width: `${completionPercentage}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Hide subtasks display for archived tasks */}
            {!(task.status === 'archived' || task.status === 3) && (
                <SubtasksDisplay
                    showSubtasks={showSubtasks}
                    loadingSubtasks={loadingSubtasks}
                    subtasks={subtasks}
                    onTaskClick={(e, task) => {
                        e.stopPropagation();
                        handleSubtaskClick(task);
                    }}
                    onTaskUpdate={onTaskUpdate}
                    loadSubtasks={loadSubtasks}
                />
            )}

            <TaskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                task={task}
                onSave={handleSave}
                onDelete={handleDelete}
                projects={projectList}
                onCreateProject={handleCreateProject}
            />

            {selectedSubtask && (
                <TaskModal
                    isOpen={subtaskModalOpen}
                    onClose={() => {
                        setSubtaskModalOpen(false);
                        setSelectedSubtask(null);
                    }}
                    task={selectedSubtask}
                    onSave={handleSubtaskSave}
                    onDelete={handleSubtaskDelete}
                    projects={projectList}
                    onCreateProject={handleCreateProject}
                />
            )}

            {parentTask && (
                <TaskModal
                    isOpen={parentTaskModalOpen}
                    onClose={() => {
                        setParentTaskModalOpen(false);
                        setParentTask(null);
                    }}
                    task={parentTask}
                    onSave={handleParentTaskSave}
                    onDelete={handleParentTaskDelete}
                    projects={projectList}
                    onCreateProject={handleCreateProject}
                    autoFocusSubtasks={true}
                />
            )}
        </>
    );
};

export default TaskItem;
