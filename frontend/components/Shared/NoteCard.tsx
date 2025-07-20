import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    TagIcon,
    FolderIcon,
    EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import MarkdownRenderer from './MarkdownRenderer';

interface NoteCardProps {
    note: {
        id?: string | number;
        title: string;
        tags?: { name: string }[];
        Tags?: { name: string }[];
        project?: { name: string };
        Project?: { name: string };
    };
    onEdit?: (note: any) => void;
    onDelete?: (note: any) => void;
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
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const tags = note.tags || note.Tags || [];
    const project = note.project || note.Project;

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
        <Link
            to={`/note/${note.id}`}
            className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col group hover:opacity-80 transition-opacity duration-300 ease-in-out cursor-pointer"
            style={{
                minHeight: '280px',
                maxHeight: '280px',
            }}
        >
            {/* Note Content */}
            <div className="p-4 flex flex-col h-full">
                {/* Title - Default Height with Trimming */}
                <div className="mb-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 text-left line-clamp-2">
                        {note.title || t('notes.untitled', 'Untitled Note')}
                    </h3>
                </div>

                {/* Separator under title */}
                <hr className="border-gray-200 dark:border-gray-700 mb-3" />

                {/* Content Summary - Main Area */}
                <div className="flex-1 mb-3 min-h-[120px]">
                    <div className="text-sm text-gray-400 dark:text-gray-600 line-clamp-5 leading-relaxed prose prose-sm max-w-none prose-gray dark:prose-invert opacity-60">
                        {note.content ? (
                            <MarkdownRenderer
                                content={
                                    note.content.substring(0, 200) +
                                    (note.content.length > 200 ? '...' : '')
                                }
                                summaryMode={true}
                            />
                        ) : (
                            <p>No content preview available...</p>
                        )}
                    </div>
                </div>

                {/* Separator */}
                <hr className="border-gray-200 dark:border-gray-700 mb-3" />

                {/* Footer - Project and Tags - Fixed Height */}
                <div className="h-8 flex items-end">
                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 w-full">
                        {showProject && project && (
                            <div className="flex items-center">
                                <FolderIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{project.name}</span>
                            </div>
                        )}
                        {tags.length > 0 && (
                            <div className="flex items-center">
                                <TagIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">
                                    {tags.map((tag) => tag.name).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Three Dots Dropdown - Bottom Right */}
            {showActions && (onEdit || onDelete) && (
                <div className="absolute bottom-2 right-2" ref={dropdownRef}>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDropdownOpen(!dropdownOpen);
                        }}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        aria-label={t('notes.toggleDropdownMenu')}
                    >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>

                    {dropdownOpen && (
                        <div className="absolute right-0 bottom-full mb-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-10">
                            {onEdit && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onEdit(note);
                                        setDropdownOpen(false);
                                    }}
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
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
                                >
                                    {t('notes.delete', 'Delete')}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Link>
    );
};

export default NoteCard;
