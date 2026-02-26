import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MatrixTask } from '../../entities/Matrix';
import DraggableTask from './DraggableTask';
import { useTranslation } from 'react-i18next';

interface QuadrantProps {
    index: number;
    tasks: MatrixTask[];
    className?: string;
    onRemoveTask?: (taskId: number) => void;
    onQuickAdd?: (taskName: string, quadrantIndex: number) => Promise<void>;
}

const Quadrant: React.FC<QuadrantProps> = ({
    index,
    tasks,
    className = '',
    onRemoveTask,
    onQuickAdd,
}) => {
    const { t } = useTranslation();
    const { isOver, setNodeRef } = useDroppable({
        id: `quadrant-${index}`,
        data: { quadrantIndex: index },
    });

    const [isAdding, setIsAdding] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAdding && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isAdding]);

    const handleQuickAdd = async () => {
        const name = newTaskName.trim();
        if (!name || !onQuickAdd) return;
        setIsSaving(true);
        try {
            await onQuickAdd(name, index);
            setNewTaskName('');
            setIsAdding(false);
        } catch {
            // Keep the input open on error
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleQuickAdd();
        } else if (e.key === 'Escape') {
            setIsAdding(false);
            setNewTaskName('');
        }
    };

    return (
        <div
            ref={setNodeRef}
            className={`p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 overflow-y-auto scrollbar-hide max-h-[250px] sm:max-h-[350px] transition-colors ${className} ${
                isOver
                    ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400'
                    : ''
            }`}
        >
            {tasks.length === 0 && !isAdding ? (
                <div className="h-full min-h-[80px] sm:min-h-[120px] w-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-xs sm:text-sm border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl gap-2">
                    <span>{t('matrix.quadrant.empty', 'Drop tasks here')}</span>
                    {onQuickAdd && (
                        <button
                            type="button"
                            onClick={() => setIsAdding(true)}
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                        >
                            + {t('matrix.quadrant.quickAdd', 'Add task')}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {tasks.map((task) => (
                        <DraggableTask
                            key={task.id}
                            task={task}
                            onRemove={onRemoveTask}
                        />
                    ))}
                    {isAdding ? (
                        <div className="flex gap-1.5">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newTaskName}
                                onChange={(e) => setNewTaskName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={() => {
                                    if (!newTaskName.trim()) {
                                        setIsAdding(false);
                                    }
                                }}
                                placeholder={t('matrix.quadrant.taskNamePlaceholder', 'Task name...')}
                                disabled={isSaving}
                                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onClick={handleQuickAdd}
                                disabled={isSaving || !newTaskName.trim()}
                                className="px-2 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors flex-shrink-0"
                            >
                                {isSaving ? '...' : '✓'}
                            </button>
                        </div>
                    ) : (
                        onQuickAdd && (
                            <button
                                type="button"
                                onClick={() => setIsAdding(true)}
                                className="self-start text-xs text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 font-medium transition-colors mt-1"
                            >
                                + {t('matrix.quadrant.quickAdd', 'Add task')}
                            </button>
                        )
                    )}
                </>
            )}
        </div>
    );
};

export default Quadrant;
