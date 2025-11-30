import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskModal from './TaskModal';
import {
    fetchTaskByUid,
    fetchTaskById,
    updateTask,
    deleteTask,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';

const TaskView: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const store = useStore();
    const { showErrorToast } = useToast();
    const { t } = useTranslation();
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubtaskRedirect, setIsSubtaskRedirect] = useState(false);

    useEffect(() => {
        const fetchTask = async () => {
            if (!uid) {
                setError('No task UID provided');
                setLoading(false);
                return;
            }

            try {
                const taskData = await fetchTaskByUid(uid);

                // Check if this is a subtask and redirect to parent if so
                if (taskData.parent_task_id) {
                    setIsSubtaskRedirect(true);
                    try {
                        const parentTask = await fetchTaskById(
                            taskData.parent_task_id
                        );
                        setTask(parentTask);
                    } catch (parentError) {
                        // If parent task fetch fails, fall back to showing the subtask
                        console.error(
                            'Error fetching parent task:',
                            parentError
                        );
                        setTask(taskData);
                        setIsSubtaskRedirect(false);
                    }
                } else {
                    setTask(taskData);
                }
            } catch {
                setError('An error occurred while fetching the task');
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
    }, [uid]);

    const handleClose = () => {
        navigate(-1); // Go back to previous page
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            if (task?.uid) {
                const updated = await updateTask(task.uid, updatedTask);
                setTask(updated);
            }
        } catch (error: any) {
            console.error('Error updating task:', error);
            showErrorToast(t('errors.permissionDenied', 'Permission denied'));
        }
    };

    const handleTaskDelete = async (taskUid: string) => {
        try {
            await deleteTask(taskUid);
            navigate('/today'); // Navigate back to today view after deletion
        } catch (error: any) {
            console.error('Error deleting task:', error);
            showErrorToast(t('errors.permissionDenied', 'Permission denied'));
        }
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            return await createProject({ name });
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    Loading task...
                </div>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-center">
                    <div className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
                        {error || 'Task not found'}
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <TaskModal
            isOpen={true}
            task={task}
            onClose={handleClose}
            onSave={handleTaskUpdate}
            onDelete={handleTaskDelete}
            projects={store.projectsStore.projects}
            onCreateProject={handleCreateProject}
            autoFocusSubtasks={isSubtaskRedirect}
        />
    );
};

export default TaskView;
