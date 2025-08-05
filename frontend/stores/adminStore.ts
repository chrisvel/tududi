import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminState {
    isAdminMode: boolean;
    toggleAdminMode: () => void;
    setAdminMode: (enabled: boolean) => void;
}

export const useAdminStore = create<AdminState>()(
    persist(
        (set, get) => ({
            isAdminMode: false, // Admin mode is disabled by default
            toggleAdminMode: () => {
                set({ isAdminMode: !get().isAdminMode });
            },
            setAdminMode: (enabled: boolean) => {
                set({ isAdminMode: enabled });
            },
        }),
        {
            name: 'admin-mode-storage',
        }
    )
);
