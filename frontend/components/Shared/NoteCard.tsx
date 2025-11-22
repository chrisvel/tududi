import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    TagIcon,
    FolderIcon,
    EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import MarkdownRenderer from './MarkdownRenderer';
import { Note } from '../../entities/Note';

interface NoteCardProps {
    note: Note;
    onEdit?: (note: Note) => void;
    onDelete?: (note: Note) => void;
    showActions?: boolean;
    showProject?: boolean;
}

const NoteCard: React.FC<NoteCardProps> = ({
    note,
    onEdit,
    onDelete,
    showActions = true,
    showProject = true,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const tags = note.tags || note.Tags || [];
    const project = note.project || note.Project;
    const noteIdentifier =
        note.uid ?? (note.id !== undefined ? String(note.id) : 'note');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    return (
        <div className="relative group">
            <Link
                to={`/note/${noteIdentifier}-${note.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')}`}
                className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col hover:opacity-80 transition-opacity duration-300 ease-in-out cursor-pointer border-l-4 border-l-blue-400 dark:border-l-blue-500"
                style={{
                    minHeight: '280px',
                    maxHeight: '280px',
                }}
            >
                {/* Note Content */}
                <div className="p-4 flex flex-col h-full">
                    {/* Title - Default Height with Trimming */}
                    <div>
                        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 text-left truncate leading-tight">
                            {note.title || t('notes.untitled', 'Untitled Note')}
                        </h3>
                    </div>
                </div>

                {/* Separator under title */}
                <hr className="border-gray-200 dark:border-gray-700" />

                <div className="px-4 flex flex-col flex-1">
                    {/* Content Summary - Main Area */}
                    <div className="h-40 overflow-hidden flex py-3">
                        <div
                            className="text-sm text-gray-400 dark:text-gray-600 leading-relaxed w-full opacity-50"
                            style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 6,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {note.content ? (
                                <MarkdownRenderer
                                    content={
                                        note.content.substring(0, 250) +
                                        (note.content.length > 250 ? '...' : '')
                                    }
                                    summaryMode={true}
                                />
                            ) : (
                                <p>No content preview available...</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <hr className="border-gray-200 dark:border-gray-700" />

                <div className="px-4">
                    {/* Footer - Project and Tags - Fixed Height */}
                    <div className="h-10 flex items-center justify-between overflow-hidden flex-shrink-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 min-w-0 flex-1">
                            {showProject && project && (
                                <button
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (project.uid) {
                                            navigate(
                                                `/project/${project.uid}-${project.name
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9]+/g, '-')
                                                    .replace(/^-|-$/g, '')}`
                                            );
                                        } else {
                                            navigate(`/project/${project.id}`);
                                        }
                                    }}
                                    className="flex items-center min-w-0 hover:text-gray-700 dark:hover:text-gray-300 hover:underline transition-colors bg-transparent border-none p-0 cursor-pointer"
                                >
                                    <FolderIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <span className="truncate">
                                        {project.name}
                                    </span>
                                </button>
                            )}
                            {tags.length > 0 && (
                                <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                                    <TagIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                                    <div className="truncate">
                                        {tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="inline"
                                            >
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (tag.uid) {
                                                            navigate(
                                                                `/tag/${tag.uid}-${tag.name
                                                                    .toLowerCase()
                                                                    .replace(
                                                                        /[^a-z0-9]+/g,
                                                                        '-'
                                                                    )
                                                                    .replace(
                                                                        /^-|-$/g,
                                                                        ''
                                                                    )}`
                                                            );
                                                        } else {
                                                            navigate(
                                                                `/tag/${encodeURIComponent(tag.name)}`
                                                            );
                                                        }
                                                    }}
                                                    className="hover:text-gray-700 dark:hover:text-gray-300 hover:underline transition-colors bg-transparent border-none p-0 cursor-pointer"
                                                >
                                                    {tag.name}
                                                </button>
                                                {index < tags.length - 1 && (
                                                    <span className="text-gray-400">
                                                        ,{' '}
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Link>

            {/* Three Dots Dropdown - Outside Link */}
            {showActions && (onEdit || onDelete) && (
                <div className="absolute bottom-2 right-2" ref={dropdownRef}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDropdownOpen(!dropdownOpen);
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none transition-opacity duration-300 p-1"
                        aria-label={t('notes.toggleDropdownMenu')}
                        type="button"
                        data-testid={`note-dropdown-${noteIdentifier}`}
                    >
                        <EllipsisVerticalIcon className="h-4 w-4" />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[9999]">
                            {onEdit && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEdit(note);
                                        setDropdownOpen(false);
                                    }}
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                    data-testid={`note-edit-${noteIdentifier}`}
                                >
                                    {t('notes.edit', 'Edit')}
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDelete(note);
                                        setDropdownOpen(false);
                                    }}
                                    className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                    data-testid={`note-delete-${note.uid}`}
                                >
                                    {t('notes.delete', 'Delete')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NoteCard;
