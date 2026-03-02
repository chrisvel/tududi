import React, { useState, useMemo } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    closestCenter,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { MatrixDetail, MatrixTask } from '../../entities/Matrix';
import Quadrant from './Quadrant';
import UnassignedSidebar from './UnassignedSidebar';
import { useTranslation } from 'react-i18next';
import { useMatrixStore } from '../../store/useMatrixStore';

interface MatrixBoardProps {
    matrix: MatrixDetail;
    moveTask: (taskId: number, newQuadrantIndex: number) => Promise<void>;
    removeTask: (taskId: number) => Promise<void>;
    onQuickAddTask?: (taskName: string, quadrantIndex: number) => Promise<void>;
    /** Incremented to re-trigger sidebar browse fetch */
    reloadTrigger?: number;
}

const MatrixBoard: React.FC<MatrixBoardProps> = ({
    matrix,
    moveTask,
    removeTask,
    onQuickAddTask,
    reloadTrigger,
}) => {
    const { t } = useTranslation();
    const { setActiveDragTaskId } = useMatrixStore();
    const [activeDragTask, setActiveDragTask] = useState<MatrixTask | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        })
    );

    /** Pre-sorted tasks for each quadrant, memoized to avoid repeated sorts. */
    const sortedQuadrants = useMemo(() => {
        const sorted = (index: number): MatrixTask[] =>
            [...(matrix.quadrants[String(index)] || [])].sort(
                (a, b) => (a.TaskMatrix?.position || 0) - (b.TaskMatrix?.position || 0)
            );
        return { 0: sorted(0), 1: sorted(1), 2: sorted(2), 3: sorted(3) };
    }, [matrix.quadrants]);

    /** All assigned tasks across quadrants, memoized for drag lookup. */
    const allAssignedTasks = useMemo(
        () => [...sortedQuadrants[0], ...sortedQuadrants[1], ...sortedQuadrants[2], ...sortedQuadrants[3]],
        [sortedQuadrants]
    );

    const handleDragStart = (event: DragStartEvent) => {
        const taskId = event.active.data.current?.taskId;
        const taskName = event.active.data.current?.taskName;
        setActiveDragTaskId(taskId ?? null);

        // Find the task across all quadrants + unassigned for the overlay
        if (taskId !== undefined) {
            const found =
                allAssignedTasks.find((t) => t.id === taskId) ??
                matrix.unassigned?.find((t) => t.id === taskId);
            // Use the found task, or build a minimal one from drag data (sidebar browsed tasks)
            setActiveDragTask(found ?? (taskName ? { id: taskId, name: taskName } as MatrixTask : null));
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragTaskId(null);
        setActiveDragTask(null);
        const { active, over } = event;
        if (!over) return;

        const taskId = active.data.current?.taskId;
        const newQuadrantIndex = over.data.current?.quadrantIndex;

        if (taskId === undefined || newQuadrantIndex === undefined) return;

        // If dropped on unassigned sidebar, remove from matrix
        if (newQuadrantIndex === -1) {
            removeTask(taskId);
            return;
        }

        // If from unassigned or different quadrant, move it
        const task = allAssignedTasks.find((t) => t.id === taskId);
        if (!task || task.TaskMatrix?.quadrant_index !== newQuadrantIndex) {
            moveTask(taskId, newQuadrantIndex);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col lg:flex-row h-full w-full bg-gray-50 dark:bg-gray-900">
                {/* Main matrix area */}
                <div className="flex-1 flex flex-col p-3 sm:p-6 min-w-0 overflow-auto scrollbar-hide">
                    {/* Header */}
                    <div className="mb-2 sm:mb-4">
                        <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm hidden sm:block">
                            {t(
                                'matrix.actions.dragHint',
                                'Drag and drop tasks to prioritize'
                            )}
                        </p>
                    </div>

                    {/* Matrix Container — px/py reserves space for rotated axis labels */}
                    <div className="relative flex-grow flex items-center justify-center min-h-[300px] sm:min-h-[440px] max-w-3xl mx-auto w-full px-6 sm:px-10 py-5 sm:py-8">
                        {/* Y-axis labels */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {matrix.y_axis_label_top}
                        </div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {matrix.y_axis_label_bottom}
                        </div>

                        {/* X-axis labels */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider origin-center whitespace-nowrap">
                            {matrix.x_axis_label_left}
                        </div>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider origin-center whitespace-nowrap">
                            {matrix.x_axis_label_right}
                        </div>

                        {/* 2x2 Grid */}
                        <div className="grid grid-cols-2 grid-rows-2 w-full h-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-gray-800">
                            <Quadrant
                                index={0}
                                tasks={sortedQuadrants[0]}
                                className="border-r border-b border-gray-200 dark:border-gray-700"
                                onRemoveTask={removeTask}
                                onQuickAdd={onQuickAddTask}
                            />
                            <Quadrant
                                index={1}
                                tasks={sortedQuadrants[1]}
                                className="border-b border-gray-200 dark:border-gray-700"
                                onRemoveTask={removeTask}
                                onQuickAdd={onQuickAddTask}
                            />
                            <Quadrant
                                index={2}
                                tasks={sortedQuadrants[2]}
                                className="border-r border-gray-200 dark:border-gray-700"
                                onRemoveTask={removeTask}
                                onQuickAdd={onQuickAddTask}
                            />
                            <Quadrant
                                index={3}
                                tasks={sortedQuadrants[3]}
                                onRemoveTask={removeTask}
                                onQuickAdd={onQuickAddTask}
                            />
                        </div>
                    </div>
                </div>

                {/* Unassigned sidebar — now a category browser */}
                <UnassignedSidebar
                    tasks={matrix.unassigned}
                    matrixId={matrix.id!}
                    reloadTrigger={reloadTrigger}
                />
            </div>
            <DragOverlay dropAnimation={null}>
                {activeDragTask ? (
                    <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-lg border-2 border-blue-500 cursor-grabbing opacity-90 max-w-[250px]">
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight">
                            {activeDragTask.name}
                        </h4>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default MatrixBoard;
