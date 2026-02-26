import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MatrixTask } from '../../entities/Matrix';
import { useTranslation } from 'react-i18next';

interface DraggableTaskProps {
    task: MatrixTask;
    onRemove?: (taskId: number) => void;
}

const priorityColors: Record<number, string> = {
    1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    2: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const priorityLabels: Record<number, string> = {
    1: 'Medium',
    2: 'High',
};

const DraggableTask: React.FC<DraggableTaskProps> = ({ task, onRemove }) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: `task-${task.id}`,
            data: { taskId: task.id, taskName: task.name },
        });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.3 : 1,
    };

    const priority =
        typeof task.priority === 'number' ? task.priority : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`group bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                isDragging ? 'ring-2 ring-blue-500 shadow-lg' : ''
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
                    {task.name}
                </h4>
                {onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove(task.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-opacity flex-shrink-0"
                        title={t(
                            'matrix.actions.remove',
                            'Remove from matrix'
                        )}
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {priority !== undefined && priority > 0 && (
                    <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priorityColors[priority] || ''}`}
                    >
                        {priorityLabels[priority]}
                    </span>
                )}
                {task.due_date && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(task.due_date).toLocaleDateString()}
                    </span>
                )}
                {task.tags &&
                    task.tags.slice(0, 2).map((tag) => (
                        <span
                            key={tag.id}
                            className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-1.5 py-0.5 rounded"
                        >
                            {tag.name}
                        </span>
                    ))}
            </div>
        </div>
    );
};

export default DraggableTask;
