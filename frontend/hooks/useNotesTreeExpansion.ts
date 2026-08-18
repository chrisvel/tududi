import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'notesTreeExpanded';

const readStoredExpanded = (): Record<string, boolean> | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.error('Error parsing persisted notes tree state:', error);
        return null;
    }
};

const persistExpanded = (expanded: Record<string, boolean>) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
    } catch (error) {
        console.error('Error persisting notes tree state:', error);
    }
};

/**
 * Persisted expand/collapse state for the notes tree, keyed by node id
 * (`area:<uid>`, `project:<uid>`, `tag:<uid>`). The first time this hook
 * runs with no persisted state yet, it seeds the map with `initialActiveKeys`
 * (the folder chain around the currently open note) so that branch starts
 * expanded while everything else starts collapsed. Once seeded (or once a
 * persisted state already exists), it never overrides the user's own
 * expand/collapse choices again.
 */
export const useNotesTreeExpansion = (initialActiveKeys: string[]) => {
    const hasSeeded = useRef(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>(
        () => readStoredExpanded() || {}
    );

    useEffect(() => {
        if (hasSeeded.current) return;
        if (readStoredExpanded()) {
            hasSeeded.current = true;
            return;
        }
        if (initialActiveKeys.length === 0) return;

        hasSeeded.current = true;
        setExpanded((prev) => {
            const next = { ...prev };
            initialActiveKeys.forEach((key) => {
                next[key] = true;
            });
            persistExpanded(next);
            return next;
        });
    }, [initialActiveKeys]);

    const toggle = useCallback((key: string) => {
        setExpanded((prev) => {
            const next = { ...prev, [key]: !prev[key] };
            persistExpanded(next);
            return next;
        });
    }, []);

    return { expanded, toggle };
};
