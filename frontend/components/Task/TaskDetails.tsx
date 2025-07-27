import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    FolderIcon,
    CalendarIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ListBulletIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskModal from './TaskModal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    fetchTaskByUuid,
    updateTask,
    deleteTask,
    fetchSubtasks,
    toggleTaskCompletion,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import TaskPriorityIcon from './TaskPriorityIcon';
import LoadingScreen from '../Shared/LoadingScreen';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import TaskTimeline from './TaskTimeline';

const TaskDetails: React.FC = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const projects = useStore((state) => state.projectsStore.projects);

    // Local state
    const [task, setTask] = useState<Task | null>(null);
    const [subtasks, setSubtasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

    // Date and recurrence formatting functions (from TaskHeader)
    const formatDueDate = (dueDate: string) => {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        if (dueDate === today) return t('dateIndicators.today', 'TODAY');
        if (dueDate === tomorrow)
            return t('dateIndicators.tomorrow', 'TOMORROW');
        if (dueDate === yesterday)
            return t('dateIndicators.yesterday', 'YESTERDAY');

        return new Date(dueDate).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatRecurrence = (recurrenceType: string) => {
        switch (recurrenceType) {
            case 'daily':
                return t('recurrence.daily', 'Daily');
            case 'weekly':
                return t('recurrence.weekly', 'Weekly');
            case 'monthly':
                return t('recurrence.monthly', 'Monthly');
            case 'monthly_weekday':
                return t('recurrence.monthlyWeekday', 'Monthly');
            case 'monthly_last_day':
                return t('recurrence.monthlyLastDay', 'Monthly');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    useEffect(() => {
        const fetchTaskData = async () => {
            if (!uuid) {
                setError('No task UUID provided');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const taskData = await fetchTaskByUuid(uuid);
                setTask(taskData);

                // Load subtasks if this task has any
                if (taskData.id) {
                    try {
                        const subtasksData = await fetchSubtasks(taskData.id);
                        setSubtasks(subtasksData);
                    } catch (subtaskError) {
                        console.warn('Error loading subtasks:', subtaskError);
                        // Don't fail the whole page if subtasks fail to load
                    }
                }
            } catch (fetchError) {
                setError('Task not found');
                console.error('Error fetching task:', fetchError);
            } finally {
                setLoading(false);
            }
        };

        fetchTaskData();
    }, [uuid]);

    const handleEdit = () => {
        setIsTaskModalOpen(true);
    };

    const handleToggleCompletion = async () => {
        if (!task?.id) return;

        try {
            const updatedTask = await toggleTaskCompletion(task.id);
            setTask(updatedTask);

            const statusMessage =
                updatedTask.status === 'done' || updatedTask.status === 2
                    ? t('task.completedSuccess', 'Task marked as completed')
                    : t('task.reopenedSuccess', 'Task reopened');

            showSuccessToast(statusMessage);
        } catch (error) {
            console.error('Error toggling task completion:', error);
            showErrorToast(
                t('task.toggleError', 'Failed to update task status')
            );
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            if (task?.id) {
                const updated = await updateTask(task.id, updatedTask);
                setTask(updated);
                showSuccessToast(
                    t('task.updateSuccess', 'Task updated successfully')
                );

                // Reload subtasks in case they changed
                if (updated.id) {
                    try {
                        const subtasksData = await fetchSubtasks(updated.id);
                        setSubtasks(subtasksData);
                    } catch (subtaskError) {
                        console.warn('Error reloading subtasks:', subtaskError);
                    }
                }
            }
            setIsTaskModalOpen(false);
        } catch (error) {
            console.error('Error updating task:', error);
            showErrorToast(t('task.updateError', 'Failed to update task'));
        }
    };

    const handleDeleteClick = () => {
        if (task) {
            setTaskToDelete(task);
            setIsConfirmDialogOpen(true);
        }
    };

    const handleDeleteConfirm = async () => {
        if (taskToDelete?.id) {
            try {
                await deleteTask(taskToDelete.id);
                showSuccessToast(
                    t('task.deleteSuccess', 'Task deleted successfully')
                );
                navigate('/today'); // Navigate back to today view after deletion
            } catch (error) {
                console.error('Error deleting task:', error);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            return await createProject({ name });
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    const handleSubtaskClick = (subtask: Task) => {
        if (subtask.uuid) {
            navigate(`/task/${subtask.uuid}`);
        }
    };

    if (loading) {
        return <LoadingScreen />;
    }

    if (error || !task) {
        return (
            <div className="flex justify-center px-4 lg:px-2">
                <div className="w-full max-w-5xl">
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                        <ExclamationTriangleIcon className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto mb-8" />
                        <h1 className="text-2xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                            {error || t('task.notFound', 'Task Not Found')}
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                            {t(
                                'task.notFoundDescription',
                                'The task you are looking for does not exist or has been deleted.'
                            )}
                        </p>
                        <button
                            onClick={() => navigate('/today')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
                        >
                            {t('common.goToToday', 'Go to Today')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Header Section with Title and Action Buttons */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <TaskPriorityIcon
                            priority={task.priority}
                            status={task.status}
                            onToggleCompletion={handleToggleCompletion}
                        />
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-normal text-gray-900 dark:text-gray-100">
                                {task.name}
                            </h2>
                            {/* Project, tags, due date, and recurrence under title */}
                            {(task.Project ||
                                (task.tags && task.tags.length > 0) ||
                                task.due_date ||
                                (task.recurrence_type &&
                                    task.recurrence_type !== 'none')) && (
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {task.Project && (
                                        <div className="flex items-center">
                                            <FolderIcon className="h-3 w-3 mr-1" />
                                            <Link
                                                to={`/project/${task.Project.id}`}
                                                className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                            >
                                                {task.Project.name}
                                            </Link>
                                        </div>
                                    )}
                                    {task.Project &&
                                        task.tags &&
                                        task.tags.length > 0 && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {task.tags && task.tags.length > 0 && (
                                        <div className="flex items-center">
                                            <TagIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {task.tags.map((tag, index) => (
                                                    <React.Fragment
                                                        key={tag.id || tag.name}
                                                    >
                                                        <Link
                                                            to={`/tag/${encodeURIComponent(tag.name)}`}
                                                            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                                        >
                                                            {tag.name}
                                                        </Link>
                                                        {index <
                                                            task.tags!.length -
                                                                1 && ', '}
                                                    </React.Fragment>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                    {(task.Project ||
                                        (task.tags && task.tags.length > 0)) &&
                                        task.due_date && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {task.due_date && (
                                        <div className="flex items-center">
                                            <CalendarIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {formatDueDate(task.due_date)}
                                            </span>
                                        </div>
                                    )}
                                    {(task.Project ||
                                        (task.tags && task.tags.length > 0) ||
                                        task.due_date) &&
                                        task.recurrence_type &&
                                        task.recurrence_type !== 'none' && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {task.recurrence_type &&
                                        task.recurrence_type !== 'none' && (
                                            <div className="flex items-center">
                                                <ArrowPathIcon className="h-3 w-3 mr-1" />
                                                <span>
                                                    {formatRecurrence(
                                                        task.recurrence_type
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex space-x-1">
                        <button
                            onClick={handleEdit}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-colors duration-200"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteClick();
                            }}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full transition-colors duration-200"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Content - Two column layout */}
                <div className="mb-8 mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Notes and Subtasks */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Notes Section - Always Visible */}
                            <div>
                                <h4 className="text-base font-light text-gray-900 dark:text-gray-100 mb-4">
                                    {t('task.notes', 'Notes')}
                                </h4>
                                {task.note ? (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                                        <MarkdownRenderer
                                            content={task.note}
                                            className="prose dark:prose-invert max-w-none"
                                        />
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                                            <PencilSquareIcon className="h-12 w-12 mb-3 opacity-50" />
                                            <span className="text-sm text-center">
                                                {t('task.noNotes', 'No notes added yet')}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Subtasks Section - Always Visible */}
                            <div>
                                <h4 className="text-base font-light text-gray-900 dark:text-gray-100 mb-4">
                                    {t('task.subtasks', 'Subtasks')}
                                </h4>
                                {subtasks.length > 0 ? (
                                    <div className="space-y-1">
                                        {subtasks.map((subtask) => (
                                            <div
                                                key={subtask.id}
                                                className="group"
                                            >
                                                <div
                                                    onClick={() =>
                                                        handleSubtaskClick(
                                                            subtask
                                                        )
                                                    }
                                                    className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 cursor-pointer transition-all duration-200 ${
                                                        subtask.status ===
                                                            'in_progress' ||
                                                        subtask.status === 1
                                                            ? 'border-green-400/60 dark:border-green-500/60'
                                                            : 'border-gray-50 dark:border-gray-800'
                                                    }`}
                                                >
                                                    <div className="px-4 py-2.5 flex items-center space-x-3">
                                                        <div className="flex-shrink-0">
                                                            <TaskPriorityIcon
                                                                priority={
                                                                    subtask.priority
                                                                }
                                                                status={
                                                                    subtask.status
                                                                }
                                                                onToggleCompletion={async () => {
                                                                    if (
                                                                        subtask.id
                                                                    ) {
                                                                        try {
                                                                            await toggleTaskCompletion(
                                                                                subtask.id
                                                                            );
                                                                            // Reload subtasks after toggling completion
                                                                            if (
                                                                                task?.id
                                                                            ) {
                                                                                const subtasksData =
                                                                                    await fetchSubtasks(
                                                                                        task.id
                                                                                    );
                                                                                setSubtasks(
                                                                                    subtasksData
                                                                                );
                                                                            }
                                                                        } catch (error) {
                                                                            console.error(
                                                                                'Error toggling subtask completion:',
                                                                                error
                                                                            );
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <span
                                                            className={`text-base flex-1 truncate ${
                                                                subtask.status ===
                                                                    'done' ||
                                                                subtask.status ===
                                                                    2 ||
                                                                subtask.status ===
                                                                    'archived' ||
                                                                subtask.status ===
                                                                    3
                                                                    ? 'text-gray-500 dark:text-gray-400'
                                                                    : 'text-gray-900 dark:text-gray-100'
                                                            }`}
                                                        >
                                                            {subtask.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                                            <ListBulletIcon className="h-12 w-12 mb-3 opacity-50" />
                                            <span className="text-sm text-center">
                                                {t('task.noSubtasks', 'No subtasks yet')}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Recent Activity */}
                        <div>
                            <h4 className="text-base font-light text-gray-900 dark:text-gray-100 mb-4">
                                {t('task.recentActivity', 'Recent Activity')}
                            </h4>
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
                                <TaskTimeline taskId={task.id} />
                            </div>
                        </div>
                    </div>
                </div>
                {/* End of main content sections */}



                {/* Task Modal for Editing */}
                <TaskModal
                    isOpen={isTaskModalOpen}
                    task={
                        task || {
                            name: '',
                            status: 'not_started',
                            priority: 'medium',
                            completed_at: null,
                        }
                    }
                    onClose={() => setIsTaskModalOpen(false)}
                    onSave={handleTaskUpdate}
                    onDelete={async (taskId: number) => {
                        await deleteTask(taskId);
                        navigate('/today');
                    }}
                    projects={projects}
                    onCreateProject={handleCreateProject}
                    showToast={false}
                    initialSubtasks={subtasks}
                />

                {/* Confirm Delete Dialog */}
                {isConfirmDialogOpen && taskToDelete && (
                    <ConfirmDialog
                        title={t('task.deleteConfirmTitle', 'Delete Task')}
                        message={t(
                            'task.deleteConfirmMessage',
                            'Are you sure you want to delete this task? This action cannot be undone.'
                        )}
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setTaskToDelete(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
