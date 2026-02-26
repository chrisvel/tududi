import { create } from 'zustand';

export type SidebarCategory = 'project' | 'area' | 'tag' | null;

interface MatrixUIState {
    activeDragTaskId: number | null;
    setActiveDragTaskId: (id: number | null) => void;

    sidebarSearchQuery: string;
    setSidebarSearchQuery: (query: string) => void;

    sidebarCategory: SidebarCategory;
    setSidebarCategory: (cat: SidebarCategory) => void;

    sidebarSourceId: string | null;
    setSidebarSourceId: (id: string | null) => void;
}

export const useMatrixStore = create<MatrixUIState>((set) => ({
    activeDragTaskId: null,
    setActiveDragTaskId: (id) => set({ activeDragTaskId: id }),

    sidebarSearchQuery: '',
    setSidebarSearchQuery: (query) => set({ sidebarSearchQuery: query }),

    sidebarCategory: null,
    setSidebarCategory: (cat) => set({ sidebarCategory: cat, sidebarSourceId: null, sidebarSearchQuery: '' }),

    sidebarSourceId: null,
    setSidebarSourceId: (id) => set({ sidebarSourceId: id, sidebarSearchQuery: '' }),
}));
