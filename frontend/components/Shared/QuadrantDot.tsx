import React from 'react';
import { useMatrixPlacements } from '../../contexts/MatrixPlacementsContext';
import { getQuadrantStyle } from '../../constants/matrixColors';

/** Position labels for tooltip display. */
const QUADRANT_LABELS: Record<number, string> = {
    0: 'Top Left',
    1: 'Top Right',
    2: 'Bottom Left',
    3: 'Bottom Right',
};

interface QuadrantDotProps {
    taskId?: number;
}

/**
 * Colored dots shown next to a task name indicating which matrix quadrant(s)
 * it's placed in. Renders one dot per matrix placement, so tasks appearing
 * in multiple matrices show multiple dots.
 */
const QuadrantDot: React.FC<QuadrantDotProps> = ({ taskId }) => {
    const { placementsByTask } = useMatrixPlacements();

    if (!taskId) return null;
    const placements = placementsByTask.get(taskId);
    if (!placements || placements.length === 0) return null;

    return (
        <span className="inline-flex items-center gap-0.5 flex-shrink-0">
            {placements.map((placement) => {
                const style = getQuadrantStyle(placement.quadrant_index);
                const label = QUADRANT_LABELS[placement.quadrant_index] ?? '';

                const title = placement.matrix_name
                    ? `${placement.matrix_name} · ${label}`
                    : label;

                return (
                    <span
                        key={`${placement.matrix_id}-${placement.quadrant_index}`}
                        className={`inline-block h-2.5 w-2.5 rounded-full ring-1 ${style.dot} ${style.ring}`}
                        title={title}
                    />
                );
            })}
        </span>
    );
};

export default React.memo(QuadrantDot);
