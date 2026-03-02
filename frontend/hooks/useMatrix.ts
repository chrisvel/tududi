import { useState, useEffect, useCallback } from 'react';
import {
    fetchMatrices,
    fetchMatrix,
    createMatrix,
    updateMatrix,
    deleteMatrix,
    assignTaskToMatrix,
    removeTaskFromMatrix,
} from '../utils/matrixService';
import { Matrix, MatrixDetail, MatrixTask } from '../entities/Matrix';

/**
 * Deep-clone a MatrixDetail's quadrants & unassigned arrays for rollback.
 */
export function snapshotMatrix(m: MatrixDetail): MatrixDetail {
    return {
        ...m,
        quadrants: Object.fromEntries(
            Object.entries(m.quadrants).map(([k, v]) => [k, [...v]])
        ),
        unassigned: [...m.unassigned],
    };
}

/**
 * Find and remove a task from quadrants by ID.
 * Returns the removed task (shallow copy) or null if not found.
 */
export function extractTaskFromQuadrants(
    quadrants: Record<string, MatrixTask[]>,
    taskId: number
): MatrixTask | null {
    for (const qi of Object.keys(quadrants)) {
        const idx = quadrants[qi].findIndex((t) => t.id === taskId);
        if (idx !== -1) {
            const task = { ...quadrants[qi][idx] };
            quadrants[qi] = quadrants[qi].filter((_, i) => i !== idx);
            return task;
        }
    }
    return null;
}

/**
 * Hook for the matrix list page.
 */
export function useMatrices(projectId?: number) {
    const [matrices, setMatrices] = useState<Matrix[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setIsError(false);
        try {
            const result = await fetchMatrices(projectId);
            setMatrices(result.data || []);
        } catch {
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreate = useCallback(
        async (data: Partial<Matrix>) => {
            const result = await createMatrix(data);
            await load();
            return result.data;
        },
        [load]
    );

    const handleDelete = useCallback(
        async (matrixId: number) => {
            await deleteMatrix(matrixId);
            await load();
        },
        [load]
    );

    return {
        matrices,
        isLoading,
        isError,
        reload: load,
        createMatrix: handleCreate,
        deleteMatrix: handleDelete,
    };
}

/**
 * Hook for a single matrix detail page with optimistic updates.
 */
export function useMatrix(matrixId: number | null) {
    const [matrix, setMatrix] = useState<MatrixDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    /**
     * Fetch matrix data from the server.
     * Never flips isLoading after the first successful load — stale data
     * stays visible while we revalidate in the background.
     */
    const load = useCallback(async () => {
        if (!matrixId) return;
        try {
            const result = await fetchMatrix(matrixId);
            setMatrix(result.data);
            setIsError(false);
        } catch {
            // Only show error state if we never had data
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    }, [matrixId]);

    useEffect(() => {
        setIsLoading(true);
        setIsError(false);
        load();
    }, [load]);

    /**
     * Move a task to a new quadrant with optimistic update.
     */
    const moveTask = useCallback(
        async (taskId: number, newQuadrantIndex: number) => {
            if (!matrix || !matrixId) return;

            const previousMatrix = snapshotMatrix(matrix);

            // Optimistic update: move the task in local state
            const updatedQuadrants = { ...matrix.quadrants };
            let movedTask = extractTaskFromQuadrants(updatedQuadrants, taskId);

            // Check unassigned list too
            let updatedUnassigned = [...matrix.unassigned];
            if (!movedTask) {
                const idx = updatedUnassigned.findIndex(
                    (t) => t.id === taskId
                );
                if (idx !== -1) {
                    movedTask = { ...updatedUnassigned[idx] };
                    updatedUnassigned = updatedUnassigned.filter(
                        (_, i) => i !== idx
                    );
                }
            }

            if (movedTask) {
                movedTask.TaskMatrix = {
                    quadrant_index: newQuadrantIndex as 0 | 1 | 2 | 3,
                    position: 0,
                };
                const targetKey = String(newQuadrantIndex);
                updatedQuadrants[targetKey] = [
                    ...(updatedQuadrants[targetKey] || []),
                    movedTask,
                ];
            }

            setMatrix({
                ...matrix,
                quadrants: updatedQuadrants,
                unassigned: updatedUnassigned,
            });

            try {
                await assignTaskToMatrix(matrixId, taskId, newQuadrantIndex);
                // If task wasn't in local state (e.g., from browsed sidebar),
                // reload to get fresh data. Safe because load() no longer flashes.
                if (!movedTask) {
                    await load();
                }
            } catch {
                // Rollback on error
                setMatrix(previousMatrix);
            }
        },
        [matrix, matrixId, load]
    );

    /**
     * Remove a task from the matrix.
     */
    const removeTask = useCallback(
        async (taskId: number) => {
            if (!matrix || !matrixId) return;

            const previousMatrix = snapshotMatrix(matrix);

            // Optimistic: remove from quadrants, add to unassigned
            const updatedQuadrants = { ...matrix.quadrants };
            const removedTask = extractTaskFromQuadrants(updatedQuadrants, taskId);

            const updatedUnassigned = [...matrix.unassigned];
            if (removedTask) {
                delete removedTask.TaskMatrix;
                updatedUnassigned.push(removedTask);
            }

            setMatrix({
                ...matrix,
                quadrants: updatedQuadrants,
                unassigned: updatedUnassigned,
            });

            try {
                await removeTaskFromMatrix(matrixId, taskId);
            } catch {
                setMatrix(previousMatrix);
            }
        },
        [matrix, matrixId]
    );

    /**
     * Update the matrix details (name, labels).
     */
    const update = useCallback(
        async (data: Partial<Matrix>) => {
            if (!matrixId) return;
            await updateMatrix(matrixId, data);
            await load();
        },
        [matrixId, load]
    );

    return {
        matrix,
        isLoading,
        isError,
        reload: load,
        moveTask,
        removeTask,
        updateMatrix: update,
    };
}
