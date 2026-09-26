import { useSyncExternalStore } from 'react';
import { CaptureTarget, CapturedItem } from './captureText';

// "today": opened from Plan my day, so the box only makes tasks and each
// one goes on today's plan.
export type CaptureScope = 'today';

interface CaptureUiState {
    open: boolean;
    target: CaptureTarget;
    scope: CaptureScope | null;
    // Changes on every open, so the composer can start from the same place
    openCount: number;
}

export interface CaptureSavedEvent {
    scope: CaptureScope | null;
    items: CapturedItem[];
    // True when the items were just removed again with Undo
    undone: boolean;
}

let state: CaptureUiState = {
    open: false,
    target: 'inbox',
    scope: null,
    openCount: 0,
};
const listeners = new Set<() => void>();
const savedListeners = new Set<(event: CaptureSavedEvent) => void>();

const setState = (next: CaptureUiState) => {
    state = next;
    listeners.forEach((listener) => listener());
};

export const openCapture = (
    target: CaptureTarget = 'inbox',
    scope: CaptureScope | null = null
): void => {
    setState({
        open: true,
        target: scope === 'today' ? 'task' : target,
        scope,
        openCount: state.openCount + 1,
    });
};

export const closeCapture = (): void => {
    if (state.open) {
        setState({ ...state, open: false });
    }
};

export const toggleCapture = (target: CaptureTarget = 'inbox'): void => {
    if (state.open) {
        closeCapture();
    } else {
        openCapture(target);
    }
};

export const emitCaptureSaved = (event: CaptureSavedEvent): void => {
    savedListeners.forEach((listener) => listener(event));
};

export const onCaptureSaved = (
    listener: (event: CaptureSavedEvent) => void
): (() => void) => {
    savedListeners.add(listener);
    return () => {
        savedListeners.delete(listener);
    };
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const useCaptureUi = (): CaptureUiState =>
    useSyncExternalStore(
        subscribe,
        () => state,
        () => state
    );
