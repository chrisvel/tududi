import { getApiPath } from '../config/paths';
import {
    Matrix,
    MatrixDetail,
    MatrixTask,
    TaskMatrixAssignment,
    TaskMatrixPlacement,
    TaskPlacementSummary,
} from '../entities/Matrix';

const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

const fetchOptions: RequestInit = {
    credentials: 'include' as RequestCredentials,
    headers: defaultHeaders,
};

/**
 * Fetch all matrices, optionally filtered by project.
 */
export async function fetchMatrices(
    projectId?: number
): Promise<{ success: boolean; data: Matrix[] }> {
    const url = projectId
        ? getApiPath(`matrices?project_id=${projectId}`)
        : getApiPath('matrices');

    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error('Failed to fetch matrices');
    return response.json();
}

/**
 * Fetch a single matrix with tasks grouped by quadrant.
 */
export async function fetchMatrix(
    matrixId: number
): Promise<{ success: boolean; data: MatrixDetail }> {
    const response = await fetch(
        getApiPath(`matrices/${matrixId}`),
        fetchOptions
    );
    if (!response.ok) throw new Error('Failed to load matrix');
    return response.json();
}

/**
 * Create a new matrix.
 */
export async function createMatrix(
    data: Partial<Matrix>
): Promise<{ success: boolean; data: Matrix }> {
    const response = await fetch(getApiPath('matrices'), {
        ...fetchOptions,
        method: 'POST',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create matrix');
    }
    return response.json();
}

/**
 * Update a matrix.
 */
export async function updateMatrix(
    matrixId: number,
    data: Partial<Matrix>
): Promise<{ success: boolean; data: Matrix }> {
    const response = await fetch(getApiPath(`matrices/${matrixId}`), {
        ...fetchOptions,
        method: 'PUT',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update matrix');
    }
    return response.json();
}

/**
 * Delete a matrix.
 */
export async function deleteMatrix(
    matrixId: number
): Promise<{ success: boolean; message: string }> {
    const response = await fetch(getApiPath(`matrices/${matrixId}`), {
        ...fetchOptions,
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete matrix');
    return response.json();
}

/**
 * Assign or move a task in a matrix.
 */
export async function assignTaskToMatrix(
    matrixId: number,
    taskId: number,
    quadrantIndex: number,
    position?: number
): Promise<{ success: boolean; data: TaskMatrixAssignment; message: string }> {
    const response = await fetch(
        getApiPath(`matrices/${matrixId}/tasks/${taskId}`),
        {
            ...fetchOptions,
            method: 'PUT',
            body: JSON.stringify({
                quadrant_index: quadrantIndex,
                position: position || 0,
            }),
        }
    );
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to assign task to matrix');
    }
    return response.json();
}

/**
 * Remove a task from a matrix.
 */
export async function removeTaskFromMatrix(
    matrixId: number,
    taskId: number
): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
        getApiPath(`matrices/${matrixId}/tasks/${taskId}`),
        {
            ...fetchOptions,
            method: 'DELETE',
        }
    );
    if (!response.ok) throw new Error('Failed to remove task from matrix');
    return response.json();
}

/**
 * Fetch all matrix placements for a specific task.
 */
export async function fetchTaskMatrices(
    taskId: number
): Promise<{ success: boolean; data: TaskMatrixPlacement[] }> {
    const response = await fetch(
        getApiPath(`tasks/${taskId}/matrices`),
        fetchOptions
    );
    if (!response.ok) throw new Error('Failed to fetch task matrices');
    return response.json();
}

/**
 * Fetch all task-to-matrix placements for the authenticated user (bulk).
 */
export async function fetchAllPlacements(): Promise<{
    success: boolean;
    data: TaskPlacementSummary[];
}> {
    const response = await fetch(
        getApiPath('matrices/placements'),
        fetchOptions
    );
    if (!response.ok) throw new Error('Failed to fetch placements');
    return response.json();
}

export type BrowseSource = 'project' | 'area' | 'tag';

/**
 * Browse available tasks for a matrix, filtered by source category.
 */
export async function browseMatrixTasks(
    matrixId: number,
    source: BrowseSource,
    sourceId: string | number
): Promise<{ success: boolean; data: MatrixTask[] }> {
    const response = await fetch(
        getApiPath(`matrices/${matrixId}/browse?source=${source}&sourceId=${sourceId}`),
        fetchOptions
    );
    if (!response.ok) throw new Error('Failed to browse tasks');
    return response.json();
}
