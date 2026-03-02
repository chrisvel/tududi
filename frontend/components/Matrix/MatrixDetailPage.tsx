import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeftIcon,
    Cog6ToothIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { useMatrix } from '../../hooks/useMatrix';
import MatrixBoard from './MatrixBoard';
import MatrixModal from './MatrixModal';
import { deleteMatrix, assignTaskToMatrix } from '../../utils/matrixService';
import { createTask } from '../../utils/tasksService';
import { useMatrixPlacements } from '../../contexts/MatrixPlacementsContext';

const MatrixDetailPage: React.FC = () => {
    const { matrixId } = useParams<{ matrixId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const numericId = matrixId ? parseInt(matrixId, 10) : null;
    const {
        matrix,
        isError,
        reload,
        moveTask,
        removeTask,
        updateMatrix,
    } = useMatrix(numericId);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [reloadTrigger, setReloadTrigger] = useState(0);
    const { reload: reloadPlacements } = useMatrixPlacements();

    /** Wrap moveTask to also refresh the sidebar browse */
    const handleMoveTask = useCallback(
        async (taskId: number, newQuadrantIndex: number) => {
            await moveTask(taskId, newQuadrantIndex);
            setReloadTrigger((c) => c + 1);
        },
        [moveTask]
    );

    /** Wrap removeTask to also refresh the sidebar browse */
    const handleRemoveTask = useCallback(
        async (taskId: number) => {
            await removeTask(taskId);
            setReloadTrigger((c) => c + 1);
        },
        [removeTask]
    );

    const handleDelete = async () => {
        if (!numericId) return;
        setIsDeleting(true);
        try {
            await deleteMatrix(numericId);
            navigate('/matrices');
        } catch {
            setIsDeleting(false);
        }
    };

    /**
     * Quick-add: create a task and immediately assign it to the given quadrant.
     */
    const handleQuickAddTask = useCallback(
        async (taskName: string, quadrantIndex: number) => {
            if (!numericId || !matrix) return;
            const newTask = await createTask({
                name: taskName,
                status: 0,
                completed_at: null,
            });
            if (newTask.id) {
                await assignTaskToMatrix(numericId, newTask.id, quadrantIndex);
            }
            // Reload matrix data, sidebar browse, and placement cache
            reload();
            setReloadTrigger((c) => c + 1);
            reloadPlacements();
        },
        [numericId, matrix, reload, reloadPlacements]
    );

    if (!matrix) {
        if (isError) {
            return (
                <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
                    <div className="text-red-500">
                        {t(
                            'matrix.errors.notFound',
                            'Matrix not found'
                        )}
                    </div>
                    <button
                        onClick={() => navigate('/matrices')}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        {t('common.back', 'Back')}
                    </button>
                </div>
            );
        }
        return (
            <div className="p-8 flex items-center justify-center h-full">
                <div className="text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                        onClick={() => navigate('/matrices')}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                        title={t('common.back', 'Back')}
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {matrix.name}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={t(
                            'matrix.settings',
                            'Matrix Settings'
                        )}
                    >
                        <Cog6ToothIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-1.5 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title={t(
                            'matrix.delete.title',
                            'Delete Matrix'
                        )}
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Matrix board */}
            <div className="flex-1 overflow-auto scrollbar-hide">
                <MatrixBoard
                    matrix={matrix}
                    moveTask={handleMoveTask}
                    removeTask={handleRemoveTask}
                    onQuickAddTask={handleQuickAddTask}
                    reloadTrigger={reloadTrigger}
                />
            </div>

            {/* Settings modal */}
            <MatrixModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={updateMatrix}
                matrix={matrix}
            />
        </div>
    );
};

export default MatrixDetailPage;
