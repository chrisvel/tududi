import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import SortFilterButton, { SortOption } from './Shared/SortFilterButton';
import NoteModal from './Note/NoteModal';
import ConfirmDialog from './Shared/ConfirmDialog';
import NoteCard from './Shared/NoteCard';
import { Note } from '../entities/Note';
import {
    createNote,
    updateNote,
    deleteNote as apiDeleteNote,
} from '../utils/notesService';
import { useStore } from '../store/useStore';
import { createProject, fetchProjects } from '../utils/projectsService';

const Notes: React.FC = () => {
    const { t } = useTranslation();
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');

    // Get notes and projects from global store
    const { notes, isLoading, isError, hasLoaded, loadNotes, setNotes } =
        useStore((state) => state.notesStore);
    const projects = useStore((state) => state.projectsStore.projects);
    const { setProjects } = useStore((state) => state.projectsStore);

    useEffect(() => {
        if (!hasLoaded && !isLoading && !isError) {
            loadNotes();
        }
    }, [hasLoaded, isLoading, isError, loadNotes]);

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

    // Sort options for notes
    const sortOptions: SortOption[] = [
        { value: 'created_at:desc', label: t('sort.created_at', 'Created At') },
        { value: 'title:asc', label: t('sort.name', 'Title') },
        { value: 'updated_at:desc', label: t('common.updated', 'Updated') },
    ];

    // Handle sort change
    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
    };

    const handleDeleteNote = async () => {
        if (!noteToDelete) return;
        try {
            await apiDeleteNote(noteToDelete.id!);
            const updatedNotes = notes.filter(
                (note) => note.id !== noteToDelete.id
            );
            setNotes(updatedNotes);
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
            if (noteData.id) {
                const savedNote = await updateNote(noteData.id, noteData);
                const updatedNotes = notes.map((note) =>
                    note.id === noteData.id ? savedNote : note
                );
                setNotes(updatedNotes);
            } else {
                const newNote = await createNote(noteData);
                setNotes([newNote, ...notes]);
            }
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
                priority: 'low',
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

    // Sort the filtered notes
    const sortedNotes = [...filteredNotes].sort((a, b) => {
        const [field, direction] = orderBy.split(':');
        const isAsc = direction === 'asc';

        let valueA, valueB;

        switch (field) {
            case 'title':
                valueA = a.title?.toLowerCase() || '';
                valueB = b.title?.toLowerCase() || '';
                break;
            case 'updated_at':
                valueA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                valueB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                break;
            case 'created_at':
            default:
                valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
                valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
                break;
        }

        if (valueA < valueB) return isAsc ? -1 : 1;
        if (valueA > valueB) return isAsc ? 1 : -1;
        return 0;
    });

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
                    <h2 className="text-2xl font-light">{t('notes.title')}</h2>
                </div>

                {/* Header with Search and Sort Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
                    <div className="flex items-center space-x-2">
                        {/* Search Toggle Button */}
                        <button
                            onClick={() =>
                                setIsSearchExpanded(!isSearchExpanded)
                            }
                            className={`p-2 rounded-md focus:outline-none transition-colors ${
                                isSearchExpanded
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                            aria-label={t('common.search', 'Search')}
                        >
                            <MagnifyingGlassIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                        {/* Sort Filter Button */}
                        <div className="w-full md:w-auto">
                            <SortFilterButton
                                options={sortOptions}
                                value={orderBy}
                                onChange={handleSortChange}
                                size="desktop"
                            />
                        </div>
                    </div>
                </div>

                {/* Collapsible Search Bar */}
                <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isSearchExpanded
                            ? 'max-h-20 opacity-100 mb-4'
                            : 'max-h-0 opacity-0 mb-0'
                    }`}
                >
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

                {/* Notes Grid */}
                {sortedNotes.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('notes.noNotesFound')}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedNotes.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onEdit={handleEditNote}
                                onDelete={(note) => {
                                    setNoteToDelete(note);
                                    setIsConfirmDialogOpen(true);
                                }}
                                showActions={true}
                                showProject={true}
                            />
                        ))}
                    </div>
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
                                const updatedNotes = notes.filter(
                                    (note) => note.id !== noteId
                                );
                                setNotes(updatedNotes);
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
                                          priority: 'low',
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
