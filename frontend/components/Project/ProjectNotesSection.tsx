import React from 'react';
import { Note } from '../../entities/Note';
import NoteCard from '../Shared/NoteCard';
import { TFunction } from 'i18next';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';

interface ProjectNotesSectionProps {
    project: Project;
    notes: Note[];
    t: TFunction;
    onCreateNote: () => void;
    onEditNote: (note: Note) => Promise<void>;
    onDeleteNote: (note: Note) => void;
}

const ProjectNotesSection: React.FC<ProjectNotesSectionProps> = ({
    project,
    notes,
    t,
    onCreateNote,
    onEditNote,
    onDeleteNote,
}) => {
    return (
        <div className="transition-all duration-300 ease-in-out">
            <div className="mb-4">
                <button
                    type="button"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => {
                        if (!project?.id || !project.name) return;
                        onCreateNote();
                    }}
                >
                    <PlusCircleIcon className="h-5 w-5" />
                    {t('noteCreation', 'Create New Note')}
                </button>
            </div>

            {notes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {notes.map((note) => (
                        <NoteCard
                            key={note.uid}
                            note={note}
                            onEdit={onEditNote}
                            onDelete={onDeleteNote}
                            showActions={true}
                            showProject={false}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-gray-500 dark:text-gray-400">
                    <p>{t('project.noNotes', 'No notes for this project.')}</p>
                </div>
            )}
        </div>
    );
};

export default ProjectNotesSection;
