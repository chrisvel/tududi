import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    EllipsisVerticalIcon,
    FunnelIcon,
    TagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

export interface View {
    id: number;
    uid: string;
    name: string;
    search_query: string | null;
    filters: string[];
    priority: string | null;
    due: string | null;
    defer: string | null;
    tags: string[];
    extras: string[] | null;
    task_status: string | null;
    is_pinned: boolean;
}

interface ViewRowProps {
    view: View;
    filterCount: number;
    onTogglePin: (view: View) => void;
    onDelete: (view: View) => void;
}

// One saved view in a list, the same row as the goal, area, tag and person
// lists. A view has no color, so its left border stays neutral. The root is
// meant to sit inside a task-sheet list.
const ViewRow: React.FC<ViewRowProps> = ({
    view,
    filterCount,
    onTogglePin,
    onDelete,
}) => {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const summary = [
        view.search_query && `"${view.search_query}"`,
        view.priority,
        view.due?.replace(/_/g, ' '),
        view.defer?.replace(/_/g, ' '),
        ...view.filters,
    ]
        .filter(Boolean)
        .join(' · ');

    const menuItemClass =
        'block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-600';

    return (
        <div
            className={`relative flex items-center gap-4 -ml-1.5 py-2.5 pl-5 pr-2 border-l-4 border-gray-300 dark:border-gray-600 group ${
                menuOpen ? 'z-50' : ''
            }`}
        >
            <Link
                to={`/views/${view.uid}`}
                className="flex flex-1 min-w-0 items-center gap-2"
            >
                <h3 className="text-[15px] font-normal tracking-tight text-gray-900 dark:text-gray-100 truncate">
                    {view.name}
                </h3>
                {view.is_pinned && (
                    <StarIconSolid className="h-3 w-3 flex-shrink-0 text-yellow-400" />
                )}
                {summary && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {summary}
                    </span>
                )}
            </Link>

            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 justify-end">
                <span className="flex items-center gap-1">
                    <FunnelIcon className="h-3.5 w-3.5" />
                    {filterCount} {t('views.filters', 'filters')}
                </span>
                <span className="flex items-center gap-1">
                    <TagIcon className="h-3.5 w-3.5" />
                    {view.tags.length} {t('tags.title', 'tags')}
                </span>
            </div>

            <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpen((open) => !open);
                    }}
                    className="focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60] overflow-hidden">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuOpen(false);
                                onTogglePin(view);
                            }}
                            className={`${menuItemClass} text-gray-700 dark:text-gray-300`}
                        >
                            {view.is_pinned
                                ? t('views.unpinView')
                                : t('views.pinView')}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuOpen(false);
                                onDelete(view);
                            }}
                            className={`${menuItemClass} text-red-500 dark:text-red-300`}
                        >
                            {t('areas.delete', 'Delete')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ViewRow;
