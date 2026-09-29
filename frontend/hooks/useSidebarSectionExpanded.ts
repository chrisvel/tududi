import { useCallback, useState } from 'react';

const storageKey = (section: string) => `sidebarSectionExpanded:${section}`;

const readStored = (section: string): boolean => {
    try {
        return localStorage.getItem(storageKey(section)) === 'true';
    } catch {
        return false;
    }
};

// Whether a sidebar section (Projects, Areas, Tags, ...) shows its list.
// The choice is remembered, so a section opened once stays open: on a phone
// tapping the section title navigates and closes the drawer, and the list
// should still be there the next time the drawer opens (#1666).
export const useSidebarSectionExpanded = (
    section: string
): [boolean, (next: boolean | ((current: boolean) => boolean)) => void] => {
    const [expanded, setExpandedState] = useState(() => readStored(section));

    const setExpanded = useCallback(
        (next: boolean | ((current: boolean) => boolean)) => {
            setExpandedState((current) => {
                const value = typeof next === 'function' ? next(current) : next;
                try {
                    localStorage.setItem(storageKey(section), String(value));
                } catch {
                    // Storage can be unavailable (private mode); the state
                    // still works for this session.
                }
                return value;
            });
        },
        [section]
    );

    return [expanded, setExpanded];
};
