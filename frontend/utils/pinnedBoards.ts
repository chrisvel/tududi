import { useStore } from '../store/useStore';
import { updateUiSettings } from './profileService';

// A board pinned under Favorites: its name and its path, filters included
// (e.g. /boards/kanban?project=abc,def&tags=urgent).
export interface PinnedBoard {
    id: string;
    name: string;
    path: string;
}

export const MAX_PINNED_BOARD_NAME = 120;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// Same rule as the server: only the two boards, nothing else.
const PATH_PATTERN = /^\/boards\/(kanban|eisenhower)(\?[^\s#]{0,2000})?$/;

/** Keeps the well-formed entries of a stored list, first of each id. */
export const sanitizePinnedBoards = (raw: unknown): PinnedBoard[] => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const clean: PinnedBoard[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const { id, name, path } = item as Record<string, unknown>;
        if (typeof id !== 'string' || !ID_PATTERN.test(id)) continue;
        if (typeof name !== 'string' || !name.trim()) continue;
        if (typeof path !== 'string' || !PATH_PATTERN.test(path)) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        clean.push({
            id,
            name: name.trim().slice(0, MAX_PINNED_BOARD_NAME),
            path,
        });
    }
    return clean;
};

export const isPinnableBoardPath = (path: string) => PATH_PATTERN.test(path);

const NO_BOARDS: PinnedBoard[] = [];

export const usePinnedBoards = (): PinnedBoard[] =>
    useStore((state) => state.userSettingsStore?.pinnedBoards ?? NO_BOARDS);

const getPinnedBoards = (): PinnedBoard[] =>
    useStore.getState().userSettingsStore?.pinnedBoards ?? NO_BOARDS;

// Saves the list for the account and keeps the store in step. The store is
// updated first so the sidebar reacts at once; a failed save puts the
// previous list back.
const savePinnedBoards = async (next: PinnedBoard[]): Promise<void> => {
    const previous = getPinnedBoards();
    useStore.getState().userSettingsStore.setPinnedBoards(next);
    try {
        await updateUiSettings({ pinned_boards: next });
    } catch (error) {
        useStore.getState().userSettingsStore.setPinnedBoards(previous);
        throw error;
    }
};

const newId = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const pinBoard = (name: string, path: string) =>
    savePinnedBoards([
        ...getPinnedBoards(),
        {
            id: newId(),
            name: name.trim().slice(0, MAX_PINNED_BOARD_NAME),
            path,
        },
    ]);

export const unpinBoard = (id: string) =>
    savePinnedBoards(getPinnedBoards().filter((board) => board.id !== id));

/**
 * Compares board paths whatever the encoding or the order of their filters
 * (`a,b` and `a%2Cb` are the same filter).
 */
export const boardPathKey = (path: string): string => {
    const at = path.indexOf('?');
    const pathname = at < 0 ? path : path.slice(0, at);
    const params = new URLSearchParams(at < 0 ? '' : path.slice(at + 1));
    params.sort();
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
};
