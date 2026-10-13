import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    DocumentTextIcon,
    EllipsisVerticalIcon,
    FolderIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline';
import { Tag } from '../../entities/Tag';
import PushPinIcon from '../Shared/Icons/PushPinIcon';

interface TagRowProps {
    tag: Tag;
    onEdit: (tag: Tag) => void;
    onDelete: (tag: Tag) => void;
}

// One tag in a list. Its color shows as a left border, the same row as the
// goal and area lists. The root is meant to sit inside a task-sheet list.
const TagRow: React.FC<TagRowProps> = ({ tag, onEdit, onDelete }) => {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isSystem = tag.tag_type === 'system';
    const tagPath = tag.uid
        ? `/tag/${tag.uid}-${tag.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')}`
        : `/tag/${encodeURIComponent(tag.name)}`;

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

    const menuItemClass =
        'block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-600';

    const stats = [
        {
            icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
            count: tag.tasks_count ?? 0,
            label: t('tags.stats.tasks', 'tasks'),
        },
        {
            icon: <DocumentTextIcon className="h-3.5 w-3.5" />,
            count: tag.notes_count ?? 0,
            label: t('tags.stats.notes', 'notes'),
        },
        {
            icon: <FolderIcon className="h-3.5 w-3.5" />,
            count: tag.projects_count ?? 0,
            label: t('tags.stats.projects', 'projects'),
        },
    ];

    return (
        <div
            className={`relative flex items-center gap-4 -ml-1.5 py-2.5 pl-5 pr-2 border-l-4 border-gray-300 dark:border-gray-600 group ${
                menuOpen ? 'z-50' : ''
            }`}
            style={{ borderLeftColor: tag.color || undefined }}
        >
            <Link
                to={tagPath}
                className="flex flex-1 min-w-0 items-center gap-2"
            >
                <h4 className="text-[15px] font-normal tracking-tight text-gray-900 dark:text-gray-100 truncate">
                    {tag.name}
                </h4>
                {tag.pinned && !isSystem && (
                    <PushPinIcon
                        filled
                        className="h-3.5 w-3.5 flex-shrink-0 text-red-500 dark:text-red-400"
                    />
                )}
                {isSystem && (
                    <LockClosedIcon
                        className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500"
                        title={t('tags.systemTag', 'System tag')}
                    />
                )}
            </Link>

            <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 justify-end">
                {stats.map(({ icon, count, label }) => (
                    <span key={label} className="flex items-center gap-1">
                        {icon}
                        {count} {label}
                    </span>
                ))}
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
                    aria-label={t(
                        'tags.toggleDropdownMenu',
                        'Toggle dropdown menu'
                    )}
                    data-testid={`tag-dropdown-${tag.uid || tag.id}`}
                >
                    <EllipsisVerticalIcon className="h-4 w-4" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60] overflow-hidden">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuOpen(false);
                                onEdit(tag);
                            }}
                            className={`${menuItemClass} text-gray-700 dark:text-gray-300`}
                            data-testid={`tag-edit-${tag.uid || tag.id}`}
                        >
                            {isSystem
                                ? t('tags.customize', 'Customize')
                                : t('tags.edit', 'Edit')}
                        </button>
                        {!isSystem && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onDelete(tag);
                                }}
                                className={`${menuItemClass} text-red-500 dark:text-red-300`}
                                data-testid={`tag-delete-${tag.uid || tag.id}`}
                            >
                                {t('tags.delete', 'Delete')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TagRow;
