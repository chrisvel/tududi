import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { fetchTaskMatrices } from '../../../utils/matrixService';
import { TaskMatrixPlacement } from '../../../entities/Matrix';
import { getQuadrantStyle } from '../../../constants/matrixColors';

interface TaskMatrixCardProps {
    taskId?: number;
}

/** Build the axis-intersection label for a quadrant. */
function getQuadrantLabel(matrix: TaskMatrixPlacement['matrix'], qi: number): string {
    const yLabel = qi < 2 ? matrix.y_axis_label_top : matrix.y_axis_label_bottom;
    const xLabel = qi % 2 === 0 ? matrix.x_axis_label_left : matrix.x_axis_label_right;
    return `${yLabel} · ${xLabel}`;
}

const MiniMatrix: React.FC<{
    placement: TaskMatrixPlacement;
}> = ({ placement }) => {
    const { matrix, quadrant_index } = placement;

    return (
        <Link
            to={`/matrices/${matrix.id}`}
            className="block group"
        >
            <div className="rounded-lg border-2 border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:border-gray-200 dark:hover:border-gray-700 transition-colors overflow-hidden">
                {/* Matrix name */}
                <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                        <Squares2X2Icon className="h-4 w-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {matrix.name}
                        </span>
                    </div>
                    {matrix.project && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-6 truncate">
                            {matrix.project.name}
                        </p>
                    )}
                </div>

                {/* Mini 2x2 grid */}
                <div className="px-3 pb-3">
                    <div className="relative">
                        {/* Axis labels */}
                        <div className="flex justify-between mb-1">
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate max-w-[45%]">
                                {matrix.x_axis_label_left}
                            </span>
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate max-w-[45%] text-right">
                                {matrix.x_axis_label_right}
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            {/* Y axis label - top */}
                            <div className="flex flex-col justify-between h-[72px] mr-0.5">
                                <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none whitespace-nowrap overflow-hidden max-w-[40px] truncate">
                                    {matrix.y_axis_label_top}
                                </span>
                                <span className="text-[9px] text-gray-400 dark:text-gray-500 leading-none whitespace-nowrap overflow-hidden max-w-[40px] truncate">
                                    {matrix.y_axis_label_bottom}
                                </span>
                            </div>

                            {/* The 2x2 grid */}
                            <div className="grid grid-cols-2 gap-0.5 flex-1">
                                {[0, 1, 2, 3].map((qi) => (
                                    <div
                                        key={qi}
                                        className={`h-[34px] rounded-sm transition-all ${
                                            qi === quadrant_index
                                                ? `${getQuadrantStyle(qi).bg} ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-300 dark:ring-offset-gray-900 shadow-sm`
                                                : 'bg-gray-100 dark:bg-gray-700/50'
                                        }`}
                                    >
                                        {qi === quadrant_index && (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="w-2 h-2 rounded-full bg-white/90 shadow-sm" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quadrant label */}
                        <div className="mt-1.5 text-center">
                            <span
                                className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${getQuadrantStyle(quadrant_index).bgSubtle} ${getQuadrantStyle(quadrant_index).text}`}
                            >
                                {getQuadrantLabel(matrix, quadrant_index)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
};

const TaskMatrixCard: React.FC<TaskMatrixCardProps> = ({ taskId }) => {
    const { t } = useTranslation();
    const [placements, setPlacements] = useState<TaskMatrixPlacement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!taskId) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const result = await fetchTaskMatrices(taskId);
                if (!cancelled) {
                    setPlacements(result.data || []);
                }
            } catch {
                // Silently fail — just don't show the card
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [taskId]);

    // Don't render at all if loading or no placements
    if (loading || placements.length === 0) return null;

    return (
        <div className="space-y-3">
            {placements.map((placement) => (
                <MiniMatrix key={placement.matrix.id} placement={placement} />
            ))}
        </div>
    );
};

export default TaskMatrixCard;
