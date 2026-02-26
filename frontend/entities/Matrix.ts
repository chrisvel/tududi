import { Project } from './Project';

export interface Matrix {
    id?: number;
    uid?: string;
    name: string;
    project_id?: number | null;
    user_id?: number;
    x_axis_label_left: string;
    x_axis_label_right: string;
    y_axis_label_top: string;
    y_axis_label_bottom: string;
    project?: Pick<Project, 'id' | 'uid' | 'name'>;
    taskCount?: number;
    created_at?: string;
    updated_at?: string;
}

export interface MatrixTask {
    id: number;
    uid?: string;
    name: string;
    status: number | string;
    priority?: number | string | null;
    due_date?: string;
    project_id?: number;
    tags?: { id: number; uid?: string; name: string }[];
    TaskMatrix?: {
        quadrant_index: 0 | 1 | 2 | 3;
        position: number;
    };
}

export interface MatrixDetail extends Matrix {
    quadrants: {
        [key: string]: MatrixTask[];
    };
    unassigned: MatrixTask[];
}

export interface TaskMatrixAssignment {
    task_id: number;
    matrix_id: number;
    quadrant_index: 0 | 1 | 2 | 3;
    position: number;
    created_at?: string;
    updated_at?: string;
}

/**
 * A matrix placement for a task — returned by GET /tasks/:taskId/matrices.
 */
export interface TaskMatrixPlacement {
    matrix: Matrix;
    quadrant_index: 0 | 1 | 2 | 3;
    position: number;
}

/**
 * Lightweight placement summary for dot indicators — returned by GET /matrices/placements.
 */
export interface TaskPlacementSummary {
    task_id: number;
    matrix_id: number;
    quadrant_index: 0 | 1 | 2 | 3;
    matrix_name: string | null;
}
