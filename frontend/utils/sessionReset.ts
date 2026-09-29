import { mutate } from 'swr';
import { useStore } from '../store/useStore';
import { useDailyPlanProgress } from '../store/dailyPlanStore';

// Logging out and in again happens without a page reload, so anything the
// previous account loaded (sidebar projects, areas, tags, ...) would otherwise
// still be on screen for the next one (#1675).
export function resetSessionState(): void {
    useStore.setState(useStore.getInitialState(), true);
    useDailyPlanProgress.setState(useDailyPlanProgress.getInitialState(), true);
    mutate(() => true, undefined, { revalidate: false });
}
