import React, { useState, useEffect } from 'react';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';
import TaskPriorityIcon from './TaskPriorityIcon';

// Import SubtasksDisplay component from TaskHeader
interface SubtasksDisplayProps {
    showSubtasks: boolean;
    loadingSubtasks: boolean;
    subtasks: Task[];
    onTaskClick: (e: React.MouseEvent, task: Task) => void;
    onTaskUpdate: (task: Task) => Promise<void>;
    loadSubtasks: () => Promise<void>;
    onSubtaskUpdate: (updatedSubtask: Task) => void;
}

const SubtasksDisplay: React.FC<SubtasksDisplayProps> = ({
    showSubtasks,
    loadingSubtasks,
    subtasks,
    onTaskClick,
    loadSubtasks,
    onSubtaskUpdate,
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
                subtasks.map((subtask, index) => (
                    <div
                        key={subtask.id || `subtask-${index}`}
                        className="ml-12 group"
                    >
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
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <div className="flex-shrink-0">
                                        <TaskPriorityIcon
                                            priority={subtask.priority || 'low'}
                                            status={
                                                subtask.status || 'not_started'
                                            }
                                            onToggleCompletion={async () => {
                                                if (subtask.id) {
                                                    try {
                                                        const updatedSubtask =
                                                            await toggleTaskCompletion(
                                                                subtask.id
                                                            );

                                                        // Check if parent-child logic was executed
                                                        if (
                                                            updatedSubtask.parent_child_logic_executed
                                                        ) {
                                                            // For subtasks, we need a full page refresh because the parent task
                                                            // might be displayed in multiple places (task list, today view, etc.)
                                                            setTimeout(() => {
                                                                window.location.reload();
                                                            }, 200);
                                                            return;
                                                        }

                                                        // Update the subtask in local state immediately
                                                        onSubtaskUpdate(
                                                            updatedSubtask
                                                        );
                                                    } catch (error) {
                                                        console.error(
                                                            'Error toggling subtask completion:',
                                                            error
                                                        );
                                                        // Refresh subtasks on error
                                                        await loadSubtasks();
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <span
                                        className={`text-base flex-1 truncate ${
                                            subtask.status === 'done' ||
                                            subtask.status === 2 ||
                                            subtask.status === 'archived' ||
                                            subtask.status === 3
                                                ? 'text-gray-500 dark:text-gray-400'
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
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskDelete: (taskId: number) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number) => Promise<void>;
}

const TaskItem: React.FC<TaskItemProps> = ({
    task,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
}) => {
    // Use task ID as key for modal state to persist across task prop changes
    const [modalOpenTaskId, setModalOpenTaskId] = useState<number | null>(null);
    const isModalOpen = modalOpenTaskId === task.id;

    // Wrapper function for setting modal state
    const setIsModalOpen = (value: boolean) => {
        if (value) {
            setModalOpenTaskId(task.id || null);
        } else {
            setModalOpenTaskId(null);
        }
    };

    // Update projectList when projects prop changes
    useEffect(() => {
        setProjectList(projects);
    }, [projects]);
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

    // Check if task has subtasks using the included subtasks data
    useEffect(() => {
        // Handle both 'subtasks' and 'Subtasks' property names (case sensitivity)
        const subtasksData = task.subtasks || task.Subtasks || [];
        const hasSubtasksFromData = subtasksData.length > 0;
        setHasSubtasks(!!hasSubtasksFromData);

        // Set initial subtasks state if they are already loaded
        if (hasSubtasksFromData) {
            setSubtasks(subtasksData);
        }
    }, [task.id, task.updated_at, task.subtasks, task.Subtasks]);

    const loadSubtasks = async () => {
        if (!task.id) return;

        // If subtasks are already included in the task data, use them (handle case sensitivity)
        const subtasksData = task.subtasks || task.Subtasks || [];
        if (subtasksData.length > 0) {
            setSubtasks(subtasksData);
            return;
        }

        // Only fetch if not already included (fallback for older API responses)
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

    const handleTaskClick = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        // Use setTimeout to ensure state update happens after any other processing
        setTimeout(() => {
            setIsModalOpen(true);
        }, 0);
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
    };

    const handleSubtaskDelete = async () => {
        if (selectedSubtask && selectedSubtask.id) {
            await onTaskDelete(selectedSubtask.id);
            setSubtaskModalOpen(false);
            setSelectedSubtask(null);
        }
    };

    const handleParentTaskSave = async (updatedParentTask: Task) => {
        await onTaskUpdate(updatedParentTask);
        setParentTaskModalOpen(false);
        setParentTask(null);
    };

    const handleParentTaskDelete = async () => {
        if (parentTask && parentTask.id) {
            await onTaskDelete(parentTask.id);
            setParentTaskModalOpen(false);
            setParentTask(null);
        }
    };

    const handleSave = async (updatedTask: Task) => {
        await onTaskUpdate(updatedTask);
        setIsModalOpen(false);
    };

    const handleDelete = async () => {
        if (task.id) {
            await onTaskDelete(task.id);
        }
    };

    const handleToggleCompletion = async () => {
        if (task.id) {
            try {
                const response = await toggleTaskCompletion(task.id);

                // Handle the updated task
                if (onTaskCompletionToggle) {
                    onTaskCompletionToggle(response);
                } else {
                    // Merge the response with existing task data to preserve subtasks
                    const mergedTask = {
                        ...task,
                        ...response,
                        // Explicitly preserve subtasks data from original task
                        subtasks:
                            response.subtasks ||
                            response.Subtasks ||
                            task.subtasks ||
                            task.Subtasks ||
                            [],
                        Subtasks:
                            response.subtasks ||
                            response.Subtasks ||
                            task.subtasks ||
                            task.Subtasks ||
                            [],
                    };
                    await onTaskUpdate(mergedTask);
                }

                // Only refresh if parent-child logic was executed (affecting other tasks)
                if (response.parent_child_logic_executed) {
                    // Instead of refreshing, let's refetch and update the task data
                    setTimeout(async () => {
                        try {
                            // Refetch the current task with updated subtasks
                            const updatedTaskResponse = await fetch(
                                `/api/task/${task.id}`
                            );
                            if (updatedTaskResponse.ok) {
                                const updatedTaskData =
                                    await updatedTaskResponse.json();
                                await onTaskUpdate(updatedTaskData);
                            }
                        } catch (error) {
                            console.error(
                                'Error refetching task after parent-child logic:',
                                error
                            );
                            // Fallback to refresh if API call fails
                            window.location.reload();
                        }
                    }, 200);
                }
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
                    onSubtaskUpdate={(updatedSubtask) => {
                        setSubtasks((prev) =>
                            prev.map((st) =>
                                st.id === updatedSubtask.id
                                    ? updatedSubtask
                                    : st
                            )
                        );
                    }}
                />
            )}

            <TaskModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                }}
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
