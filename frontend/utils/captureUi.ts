import { useSyncExternalStore } from 'react';
import { CaptureTarget } from './captureText';

interface CaptureUiState {
    open: boolean;
    target: CaptureTarget;
    // Changes on every open, so the composer can start from the same place
    openCount: number;
}

let state: CaptureUiState = { open: false, target: 'inbox', openCount: 0 };
const listeners = new Set<() => void>();

const setState = (next: CaptureUiState) => {
    state = next;
    listeners.forEach((listener) => listener());
};

export const openCapture = (target: CaptureTarget = 'inbox'): void => {
    setState({ open: true, target, openCount: state.openCount + 1 });
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
