import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    FolderIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

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
    const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

    const tags = note.tags || note.Tags || [];
    const project = note.project || note.Project;

    return (
        <div
            className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-2 flex justify-between items-center"
            onMouseEnter={() => setHoveredNoteId(note.id?.toString() || null)}
            onMouseLeave={() => setHoveredNoteId(null)}
        >
            <div className="flex items-center space-x-4">
                <DocumentTextIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <div className="flex flex-col">
                    <div className="flex items-center">
                        <Link
                            to={`/note/${note.id}`}
                            className="text-md text-gray-900 dark:text-gray-100 break-words"
                        >
                            {note.title || t('notes.untitled', 'Untitled Note')}
                        </Link>
                    </div>
                    {/* Project and Tags */}
                    {((showProject && project) || tags.length > 0) && (
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            {showProject && project && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <span>{project.name}</span>
                                </div>
                            )}
                            {showProject && project && tags.length > 0 && (
                                <span className="mx-2">•</span>
                            )}
                            {tags.length > 0 && (
                                <div className="flex items-center">
                                    <TagIcon className="h-3 w-3 mr-1" />
                                    <span>
                                        {tags.map((tag) => tag.name).join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {showActions && (onEdit || onDelete) && (
                <div className="flex space-x-2">
                    {onEdit && (
                        <button
                            onClick={() => onEdit(note)}
                            className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${
                                hoveredNoteId === note.id?.toString()
                                    ? 'opacity-100'
                                    : 'opacity-0'
                            }`}
                            aria-label={t('notes.editNoteAriaLabel', {
                                noteTitle: note.title,
                            })}
                            title={t('notes.editNoteTitle', {
                                noteTitle: note.title,
                            })}
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(note)}
                            className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${
                                hoveredNoteId === note.id?.toString()
                                    ? 'opacity-100'
                                    : 'opacity-0'
                            }`}
                            aria-label={t('notes.deleteNoteAriaLabel', {
                                noteTitle: note.title,
                            })}
                            title={t('notes.deleteNoteTitle', {
                                noteTitle: note.title,
                            })}
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default NoteCard;
