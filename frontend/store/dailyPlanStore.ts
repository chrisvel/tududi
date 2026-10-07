import { create } from 'zustand';

// Progress of today's started plan, shown next to "Today" in the sidebar.
interface DailyPlanProgressState {
    progress: { done: number; total: number } | null;
    setProgress: (progress: { done: number; total: number } | null) => void;
}

export const useDailyPlanProgress = create<DailyPlanProgressState>((set) => ({
    progress: null,
    setProgress: (progress) => set({ progress }),
}));
