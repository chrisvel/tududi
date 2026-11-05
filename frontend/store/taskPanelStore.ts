import { create } from 'zustand';
import { Task } from '../entities/Task';

// The task side panel replaces in-app links to the task page. Anything can
// open it by uid; one TaskPanelHost in the layout renders it.
interface TaskPanelState {
    uid: string | null;
    open: (uid: string) => void;
    close: () => void;
}

export const useTaskPanel = create<TaskPanelState>((set) => ({
    uid: null,
    open: (uid) => set({ uid }),
    close: () => set({ uid: null }),
}));

export const openTaskPanel = (uid: string) => useTaskPanel.getState().open(uid);

// Fired after the panel saves, so task rows on any page can show the change
// without the page reloading its list.
export const TASK_PANEL_SAVED_EVENT = 'taskPanelSaved';

export interface TaskPanelSavedDetail {
    task: Task;
}
