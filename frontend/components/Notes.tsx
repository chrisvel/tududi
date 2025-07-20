import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpenIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';
import NoteModal from './Note/NoteModal';
import ConfirmDialog from './Shared/ConfirmDialog';
import NoteCard from './Shared/NoteCard';
import { Note } from '../entities/Note';
import {
    fetchNotes,
    createNote,
    updateNote,
    deleteNote as apiDeleteNote,
} from '../utils/notesService';
import { useStore } from '../store/useStore';
import { createProject, fetchProjects } from '../utils/projectsService';

const Notes: React.FC = () => {
    const { t } = useTranslation();
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Get projects from store
    const projects = useStore((state) => state.projectsStore.projects);
    const { setProjects } = useStore((state) => state.projectsStore);

    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const loadNotes = async () => {
            setIsLoading(true);
            try {
                const fetchedNotes = await fetchNotes();
                setNotes(fetchedNotes);
            } catch (error) {
                console.error('Error loading notes:', error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadNotes();
    }, []);

    // Load projects if not available - force load every time for debugging
    useEffect(() => {
        const loadProjectsIfNeeded = async () => {
            try {
                // Fetch all projects (active and inactive)
                const fetchedProjects = await fetchProjects('all', '');
                setProjects(fetchedProjects);
            } catch (error) {
                console.error('Error loading projects:', error);
            }
        };

        loadProjectsIfNeeded();
    }, []); // Remove dependencies to force it to run once

    const handleDeleteNote = async () => {
        if (!noteToDelete) return;
        try {
            await apiDeleteNote(noteToDelete.id!);
            setNotes((prev) =>
                prev.filter((note) => note.id !== noteToDelete.id)
            );
            setIsConfirmDialogOpen(false);
            setNoteToDelete(null);
        } catch (err) {
            console.error('Error deleting note:', err);
        }
    };

    const handleEditNote = (note: Note) => {
        setSelectedNote(note);
        setIsNoteModalOpen(true);
    };

    const handleSaveNote = async (noteData: Note) => {
        try {
            let updatedNotes;
            if (noteData.id) {
                const savedNote = await updateNote(noteData.id, noteData);
                updatedNotes = notes.map((note) =>
                    note.id === noteData.id ? savedNote : note
                );
            } else {
                const newNote = await createNote(noteData);
                updatedNotes = [...notes, newNote];
            }
            setNotes(updatedNotes);
            setIsNoteModalOpen(false);
            setSelectedNote(null);
        } catch (err) {
            console.error('Error saving note:', err);
        }
    };

    const handleCreateProject = async (name: string) => {
        try {
            const newProject = await createProject({
                name,
                priority: 'medium',
            });
            return newProject;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    const filteredNotes = notes.filter(
        (note) =>
            note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('notes.loading')}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">{t('notes.error')}</div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Notes Header */}
                <div className="flex items-center mb-8">
                    <BookOpenIcon className="h-6 w-6 mr-2" />
                    <h2 className="text-2xl font-light">{t('notes.title')}</h2>
                </div>

                {/* Search Bar with Icon */}
                <div className="mb-4">
                    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-2">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder={t('notes.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Notes List */}
                {filteredNotes.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('notes.noNotesFound')}
                    </p>
                ) : (
                    <ul className="space-y-1">
                        {filteredNotes.map((note) => (
                            <li key={note.id}>
                                <NoteCard
                                    note={note}
                                    onEdit={handleEditNote}
                                    onDelete={(note) => {
                                        setNoteToDelete(note);
                                        setIsConfirmDialogOpen(true);
                                    }}
                                    showActions={true}
                                    showProject={true}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                {/* NoteModal */}
                {isNoteModalOpen && (
                    <NoteModal
                        isOpen={isNoteModalOpen}
                        onClose={() => {
                            setIsNoteModalOpen(false);
                        }}
                        onSave={handleSaveNote}
                        onDelete={async (noteId) => {
                            try {
                                await apiDeleteNote(noteId);
                                setNotes((prev) =>
                                    prev.filter((note) => note.id !== noteId)
                                );
                                setIsNoteModalOpen(false);
                                setSelectedNote(null);
                            } catch (err) {
                                console.error('Error deleting note:', err);
                            }
                        }}
                        note={selectedNote}
                        projects={
                            projects?.length > 0
                                ? projects
                                : ([
                                      {
                                          id: 1,
                                          name: 'Test Project 1',
                                          active: true,
                                          priority: 'medium',
                                      },
                                      {
                                          id: 2,
                                          name: 'tududi',
                                          active: true,
                                          priority: 'high',
                                      },
                                  ] as any)
                        }
                        onCreateProject={handleCreateProject}
                    />
                )}

                {/* ConfirmDialog */}
                {isConfirmDialogOpen && noteToDelete && (
                    <ConfirmDialog
                        title={t('modals.deleteNote.title')}
                        message={t('modals.deleteNote.message', {
                            noteTitle: noteToDelete.title,
                        })}
                        onConfirm={handleDeleteNote}
                        onCancel={() => setIsConfirmDialogOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default Notes;
