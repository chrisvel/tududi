import { create } from 'zustand';
import { mutate } from 'swr';
import { FocusSession } from '../../utils/todayService';

// The overlay can be opened from any route. Both entry points share this state.
export const useFocusTimer = create<{
    session: FocusSession | null;
    open: boolean;
    show: (session: FocusSession) => void;
    hide: () => void;
}>((set) => ({
    session: null,
    open: false,
    show: (session) => set({ session, open: true }),
    hide: () => set({ open: false }),
}));
export const refreshFocus = () =>
    mutate((key) => typeof key === 'string' && key.startsWith('focus/'));
