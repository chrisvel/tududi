// Keyboard Shortcuts Service
// Provides types, defaults, and utility functions for keyboard shortcuts

export type ShortcutAction = 'inbox' | 'task' | 'project' | 'note' | 'area' | 'tag';

export interface KeyboardShortcut {
    action: ShortcutAction;
    key: string;
    modifiers: {
        alt: boolean;
        shift: boolean;
        ctrl: boolean;
        meta: boolean;
    };
}

export interface KeyboardShortcutsConfig {
    shortcuts: KeyboardShortcut[];
    enabled: boolean;
}

// Default shortcuts using Alt+Shift to avoid browser conflicts
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
    { action: 'inbox', key: 'i', modifiers: { alt: true, shift: true, ctrl: false, meta: false } },
    { action: 'task', key: 't', modifiers: { alt: true, shift: true, ctrl: false, meta: false } },
    { action: 'project', key: 'p', modifiers: { alt: true, shift: true, ctrl: false, meta: false } },
    { action: 'note', key: 'n', modifiers: { alt: true, shift: true, ctrl: false, meta: false } },
    { action: 'area', key: 'a', modifiers: { alt: true, shift: true, ctrl: false, meta: false } },
    { action: 'tag', key: 'g', modifiers: { alt: true, shift: true, ctrl: false, meta: false } },
];

export const SHORTCUT_LABELS: Record<ShortcutAction, { labelKey: string; defaultLabel: string }> = {
    inbox: { labelKey: 'profile.shortcuts.actions.inbox', defaultLabel: 'Create new Inbox item' },
    task: { labelKey: 'profile.shortcuts.actions.task', defaultLabel: 'Create new Task' },
    project: { labelKey: 'profile.shortcuts.actions.project', defaultLabel: 'Create new Project' },
    note: { labelKey: 'profile.shortcuts.actions.note', defaultLabel: 'Create new Note' },
    area: { labelKey: 'profile.shortcuts.actions.area', defaultLabel: 'Create new Area' },
    tag: { labelKey: 'profile.shortcuts.actions.tag', defaultLabel: 'Create new Tag' },
};

/**
 * Detects if the user is on a Mac platform
 */
export const isMac = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
};

/**
 * Formats a shortcut for display
 * Always uses full text format: "Ctrl + Shift + T"
 */
export const formatShortcutDisplay = (shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];

    if (shortcut.modifiers.ctrl) {
        parts.push('Ctrl');
    }
    if (shortcut.modifiers.alt) {
        parts.push('Alt');
    }
    if (shortcut.modifiers.shift) {
        parts.push('Shift');
    }
    if (shortcut.modifiers.meta) {
        parts.push(isMac() ? 'Cmd' : 'Win');
    }

    parts.push(shortcut.key.toUpperCase());

    return parts.join(' + ');
};

/**
 * Parses a keyboard event into a normalized format
 */
export const parseKeyboardEvent = (event: KeyboardEvent) => {
    return {
        key: event.key.toLowerCase(),
        modifiers: {
            alt: event.altKey,
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            meta: event.metaKey,
        },
    };
};

/**
 * Checks if a keyboard event matches a shortcut configuration
 */
export const matchesShortcut = (
    event: KeyboardEvent,
    shortcut: KeyboardShortcut
): boolean => {
    const parsed = parseKeyboardEvent(event);
    return (
        parsed.key === shortcut.key.toLowerCase() &&
        parsed.modifiers.alt === shortcut.modifiers.alt &&
        parsed.modifiers.shift === shortcut.modifiers.shift &&
        parsed.modifiers.ctrl === shortcut.modifiers.ctrl &&
        parsed.modifiers.meta === shortcut.modifiers.meta
    );
};

/**
 * Checks if an element is an input field where shortcuts should be disabled
 */
export const isInputElement = (element: EventTarget | null): boolean => {
    if (!element || !(element instanceof HTMLElement)) return false;

    const tagName = element.tagName.toUpperCase();
    return (
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        element.isContentEditable
    );
};

/**
 * Validates shortcuts for duplicates
 * Returns an array of conflict descriptions
 */
export const validateShortcuts = (shortcuts: KeyboardShortcut[]): {
    valid: boolean;
    duplicates: string[];
} => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const shortcut of shortcuts) {
        const key = formatShortcutDisplay(shortcut);
        if (seen.has(key)) {
            duplicates.push(`${key} (${shortcut.action} and ${seen.get(key)})`);
        } else {
            seen.set(key, shortcut.action);
        }
    }

    return {
        valid: duplicates.length === 0,
        duplicates,
    };
};

/**
 * Returns a fresh copy of default shortcuts
 */
export const getDefaultShortcuts = (): KeyboardShortcut[] => {
    return JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
};

/**
 * Returns default config with defaults
 */
export const getDefaultConfig = (): KeyboardShortcutsConfig => {
    return {
        shortcuts: getDefaultShortcuts(),
        enabled: true,
    };
};

/**
 * Finds a shortcut by action
 */
export const getShortcutByAction = (
    shortcuts: KeyboardShortcut[],
    action: ShortcutAction
): KeyboardShortcut | undefined => {
    return shortcuts.find(s => s.action === action);
};

/**
 * Creates a shortcut string for comparison (used for duplicate detection)
 */
export const shortcutToString = (shortcut: KeyboardShortcut): string => {
    const mods = [];
    if (shortcut.modifiers.ctrl) mods.push('ctrl');
    if (shortcut.modifiers.alt) mods.push('alt');
    if (shortcut.modifiers.shift) mods.push('shift');
    if (shortcut.modifiers.meta) mods.push('meta');
    mods.sort();
    return `${mods.join('+')}+${shortcut.key.toLowerCase()}`;
};
