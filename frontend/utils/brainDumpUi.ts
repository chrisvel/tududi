import { useSyncExternalStore } from 'react';

// Open/closed state of the brain dump modal (the welcome screen a new
// account sees once, and the same screen reopened from the navbar menu).
// A module store rather than a prop chain, so the navbar can open it and
// the app shell can mount it without threading state through Layout.
interface BrainDumpUiState {
    open: boolean;
    // Bumped on every open so the modal starts from a clean slate.
    openCount: number;
}

let state: BrainDumpUiState = { open: false, openCount: 0 };
const listeners = new Set<() => void>();

const setState = (next: BrainDumpUiState) => {
    state = next;
    listeners.forEach((listener) => listener());
};

export const openBrainDump = (): void => {
    if (state.open) return;
    setState({ open: true, openCount: state.openCount + 1 });
};

export const closeBrainDump = (): void => {
    if (state.open) setState({ ...state, open: false });
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const useBrainDumpUi = (): BrainDumpUiState =>
    useSyncExternalStore(
        subscribe,
        () => state,
        () => state
    );
