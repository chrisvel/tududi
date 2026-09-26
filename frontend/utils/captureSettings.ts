import { useSyncExternalStore } from 'react';

export type EnterKeyBehavior = 'save' | 'newline';

export interface CaptureSettings {
    oneItemPerLine: boolean;
    enterKeyboard: EnterKeyBehavior;
    enterTouch: EnterKeyBehavior;
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
    oneItemPerLine: false,
    enterKeyboard: 'save',
    enterTouch: 'newline',
};

const STORAGE_KEY = 'tududi_capture_settings';

const isBehavior = (value: unknown): value is EnterKeyBehavior =>
    value === 'save' || value === 'newline';

const readSettings = (): CaptureSettings => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_CAPTURE_SETTINGS;
        }
        const parsed = JSON.parse(raw);
        return {
            oneItemPerLine:
                typeof parsed.oneItemPerLine === 'boolean'
                    ? parsed.oneItemPerLine
                    : DEFAULT_CAPTURE_SETTINGS.oneItemPerLine,
            enterKeyboard: isBehavior(parsed.enterKeyboard)
                ? parsed.enterKeyboard
                : DEFAULT_CAPTURE_SETTINGS.enterKeyboard,
            enterTouch: isBehavior(parsed.enterTouch)
                ? parsed.enterTouch
                : DEFAULT_CAPTURE_SETTINGS.enterTouch,
        };
    } catch {
        return DEFAULT_CAPTURE_SETTINGS;
    }
};

let current: CaptureSettings | null = null;
const listeners = new Set<() => void>();

export const getCaptureSettings = (): CaptureSettings => {
    if (!current) {
        current = readSettings();
    }
    return current;
};

export const updateCaptureSettings = (
    patch: Partial<CaptureSettings>
): void => {
    current = { ...getCaptureSettings(), ...patch };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
        // Storage can be unavailable (private mode); the setting still
        // applies for this page load.
    }
    listeners.forEach((listener) => listener());
};

// Tests only: forget the in-memory copy so storage is read again.
export const resetCaptureSettingsCache = (): void => {
    current = null;
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const useCaptureSettings = (): CaptureSettings =>
    useSyncExternalStore(subscribe, getCaptureSettings, getCaptureSettings);

export const isTouchDevice = (): boolean =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
