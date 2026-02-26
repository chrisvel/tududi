import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from 'react';
import { TaskPlacementSummary } from '../entities/Matrix';
import { fetchAllPlacements } from '../utils/matrixService';

interface MatrixPlacementsContextValue {
    /** Map from task_id → array of placements */
    placementsByTask: Map<number, TaskPlacementSummary[]>;
    /** Whether the initial fetch is still loading */
    isLoading: boolean;
    /** Reload placements from server */
    reload: () => void;
}

const MatrixPlacementsContext = createContext<MatrixPlacementsContextValue>({
    placementsByTask: new Map(),
    isLoading: true,
    reload: () => {},
});

export const useMatrixPlacements = () => useContext(MatrixPlacementsContext);

export const MatrixPlacementsProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const [placements, setPlacements] = useState<TaskPlacementSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const result = await fetchAllPlacements();
            setPlacements(result.data || []);
        } catch {
            // Silently fail — dots just won't show
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const placementsByTask = useMemo(() => {
        const map = new Map<number, TaskPlacementSummary[]>();
        for (const p of placements) {
            const existing = map.get(p.task_id) || [];
            existing.push(p);
            map.set(p.task_id, existing);
        }
        return map;
    }, [placements]);

    const value = useMemo(
        () => ({ placementsByTask, isLoading, reload: load }),
        [placementsByTask, isLoading, load]
    );

    return (
        <MatrixPlacementsContext.Provider value={value}>
            {children}
        </MatrixPlacementsContext.Provider>
    );
};
