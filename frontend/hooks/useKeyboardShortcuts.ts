import { useEffect, useCallback, useMemo } from 'react';
import {
    KeyboardShortcut,
    ShortcutAction,
    matchesShortcut,
    isInputElement,
    getDefaultShortcuts,
} from '../utils/keyboardShortcutsService';

type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/**
 * Hook to register and handle keyboard shortcuts
 *
 * @param shortcuts - Array of keyboard shortcuts to listen for
 * @param handlers - Object mapping actions to handler functions
 * @param enabled - Whether shortcuts are currently enabled
 *
 * @example
 * useKeyboardShortcuts(
 *   userShortcuts,
 *   {
 *     inbox: () => navigate('/inbox'),
 *     task: () => openTaskModal(),
 *   },
 *   true
 * );
 */
export const useKeyboardShortcuts = (
    shortcuts: KeyboardShortcut[] | undefined,
    handlers: ShortcutHandlers,
    enabled: boolean = true
) => {
    // Use defaults if no shortcuts provided
    const activeShortcuts = useMemo(
        () => shortcuts || getDefaultShortcuts(),
        [shortcuts]
    );

    // Memoize the handler to prevent unnecessary re-renders
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Skip if shortcuts are disabled
            if (!enabled) return;

            // Skip if user is typing in an input field
            if (isInputElement(event.target)) return;

            // Check each shortcut for a match
            for (const shortcut of activeShortcuts) {
                if (matchesShortcut(event, shortcut)) {
                    const handler = handlers[shortcut.action];
                    if (handler) {
                        event.preventDefault();
                        handler();
                    }
                    break;
                }
            }
        },
        [activeShortcuts, handlers, enabled]
    );

    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown, enabled]);
};

export default useKeyboardShortcuts;
