import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Squares2X2Icon } from '@heroicons/react/24/solid';
import { useMatrices } from '../../hooks/useMatrix';
import { Matrix } from '../../entities/Matrix';
import MatrixModal from './MatrixModal';


const MatrixListPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { matrices, isLoading, isError, createMatrix, deleteMatrix } =
        useMatrices();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    // Auto-open create modal when navigated from project page
    useEffect(() => {
        const state = location.state as { createForProject?: number } | null;
        if (state?.createForProject && !isLoading) {
            setIsModalOpen(true);
            // Clear the state to prevent re-triggering
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, isLoading, navigate, location.pathname]);

    const handleCreate = async (data: Partial<Matrix>) => {
        const created = await createMatrix(data);
        if (created?.id) {
            navigate(`/matrices/${created.id}`);
        }
    };

    const handleDelete = async (matrixId: number) => {
        await deleteMatrix(matrixId);
        setDeleteConfirm(null);
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="text-red-500">
                    {t('matrix.errors.loadFailed', 'Failed to load matrix')}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        {t('matrix.title', 'Matrices')}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {t(
                            'matrix.pageDescription',
                            'Prioritize tasks visually with custom 2×2 grids'
                        )}
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                    <PlusIcon className="h-4 w-4" />
                    {t('matrix.create', 'Create Matrix')}
                </button>
            </div>

            {/* Matrix list */}
            {matrices.length === 0 ? (
                <div className="text-center py-16">
                    <Squares2X2Icon className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {t('matrix.empty.title', 'No matrices yet')}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                        {t(
                            'matrix.empty.description',
                            'Create your first 2×2 matrix to start prioritizing tasks visually.'
                        )}
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        <PlusIcon className="h-4 w-4" />
                        {t(
                            'matrix.empty.createFirst',
                            'Create your first matrix'
                        )}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matrices.map((matrix) => (
                        <div
                            key={matrix.id}
                            className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() =>
                                navigate(`/matrices/${matrix.id}`)
                            }
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
                                        {matrix.name}
                                    </h3>
                                    {matrix.project && (
                                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 truncate">
                                            {matrix.project.name}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm(matrix.id!);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-opacity"
                                    title={t(
                                        'matrix.delete.title',
                                        'Delete Matrix'
                                    )}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Mini axis preview */}
                            <div className="mt-3 grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden text-xs">
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 text-gray-500 dark:text-gray-400 text-center truncate">
                                    {matrix.y_axis_label_top} /{' '}
                                    {matrix.x_axis_label_left}
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 text-gray-500 dark:text-gray-400 text-center truncate">
                                    {matrix.y_axis_label_top} /{' '}
                                    {matrix.x_axis_label_right}
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 text-gray-500 dark:text-gray-400 text-center truncate">
                                    {matrix.y_axis_label_bottom} /{' '}
                                    {matrix.x_axis_label_left}
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-2 text-gray-500 dark:text-gray-400 text-center truncate">
                                    {matrix.y_axis_label_bottom} /{' '}
                                    {matrix.x_axis_label_right}
                                </div>
                            </div>

                            <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                {t('matrix.card.taskCount', {
                                    count: matrix.taskCount || 0,
                                    defaultValue:
                                        '{{count}} task',
                                })}
                            </div>

                            {/* Delete confirmation */}
                            {deleteConfirm === matrix.id && (
                                <div
                                    className="absolute inset-0 bg-white/95 dark:bg-gray-800/95 rounded-xl flex flex-col items-center justify-center p-4 z-10"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">
                                        {t(
                                            'matrix.delete.confirm',
                                            'Delete this matrix?'
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">
                                        {t(
                                            'matrix.delete.description',
                                            'Tasks will not be deleted. They will only be removed from this matrix.'
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() =>
                                                setDeleteConfirm(null)
                                            }
                                            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleDelete(matrix.id!)
                                            }
                                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                                        >
                                            {t('common.delete', 'Delete')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <MatrixModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                }}
                onSave={handleCreate}
            />
        </div>
    );
};

export default MatrixListPage;
