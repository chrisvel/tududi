import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import PushPinIcon from '../Shared/Icons/PushPinIcon';
import {
    MAX_PINNED_BOARD_NAME,
    boardPathKey,
    isPinnableBoardPath,
    pinBoard,
    unpinBoard,
    usePinnedBoards,
} from '../../utils/pinnedBoards';

interface BoardPinButtonProps {
    // Labels of the active filters, for the name offered when pinning.
    filterLabels: string[];
}

/**
 * Pins the current board, filters included, under Favorites - or unpins it
 * when the same board and filters are already pinned.
 */
const BoardPinButton: React.FC<BoardPinButtonProps> = ({ filterLabels }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const boardLabel = location.pathname.startsWith('/boards/eisenhower')
        ? t('sidebar.eisenhower', 'Eisenhower Matrix')
        : t('sidebar.kanban', 'Kanban Board');
    const defaultName = [boardLabel, ...filterLabels]
        .join(' · ')
        .slice(0, MAX_PINNED_BOARD_NAME);
    const pinnedBoards = usePinnedBoards();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // The store keeps the URL as the router gives it: filters encoded
    // (a%2Cb), which the server accepts as is.
    const path = location.pathname + location.search;
    const pinned = pinnedBoards.find(
        (board) => boardPathKey(board.path) === boardPathKey(path)
    );

    useEffect(() => {
        if (!isOpen) return;
        setName(defaultName);
        setError(null);
        inputRef.current?.focus();
        inputRef.current?.select();
        // Opening only: the default name must not overwrite typing.
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    if (!isPinnableBoardPath(path)) return null;

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setError(null);
        try {
            await pinBoard(name, path);
            setIsOpen(false);
        } catch {
            setError(
                t('tasks.boardScope.pinError', 'Could not pin the board.')
            );
        } finally {
            setSaving(false);
        }
    };

    const unpin = async () => {
        if (!pinned) return;
        try {
            await unpinBoard(pinned.id);
        } catch {
            // The store is put back by unpinBoard; the pin stays shown.
        }
    };

    const buttonClass =
        'inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 text-sm bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors';

    if (pinned) {
        return (
            <button
                type="button"
                onClick={unpin}
                className={buttonClass}
                title={t('tasks.boardScope.unpinTitle', 'Unpin "{{name}}"', {
                    name: pinned.name,
                })}
            >
                <PushPinIcon filled className="h-4 w-4" />
                {t('tasks.boardScope.pinned', 'Pinned')}
            </button>
        );
    }

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={buttonClass}
                aria-expanded={isOpen}
                title={t(
                    'tasks.boardScope.pinTitle',
                    'Pin this board and its filters under Favorites'
                )}
            >
                <PushPinIcon className="h-4 w-4" />
                {t('tasks.boardScope.pin', 'Pin')}
            </button>
            {isOpen && (
                <form
                    onSubmit={save}
                    className="absolute right-0 mt-1 w-72 z-50 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2"
                >
                    <label
                        htmlFor="board-pin-name"
                        className="text-xs font-medium text-gray-500 dark:text-gray-400"
                    >
                        {t('tasks.boardScope.pinName', 'Name in Favorites')}
                    </label>
                    <input
                        id="board-pin-name"
                        ref={inputRef}
                        type="text"
                        value={name}
                        maxLength={MAX_PINNED_BOARD_NAME}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.stopPropagation();
                                setIsOpen(false);
                            }
                        }}
                        className="w-full rounded bg-gray-100 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                    {error && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:underline"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {t('tasks.boardScope.pin', 'Pin')}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default BoardPinButton;
