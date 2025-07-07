import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  TagIcon,
  FolderIcon,
} from '@heroicons/react/24/solid';
import NoteModal from './Note/NoteModal';
import ConfirmDialog from './Shared/ConfirmDialog';
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
  console.log('Notes component rendering...');
  
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  
  // Memoize projects to ensure stable reference
  const memoizedProjects = useMemo(() => projects || [], [projects]);
  
  console.log('Notes component render - projects:', { projectsLength: projects?.length, projects: projects?.map(p => p.name) });
  console.log('Memoized projects:', { memoizedLength: memoizedProjects?.length });
  
  const [isError, setIsError] = useState(false);
  const [hoveredNoteId, setHoveredNoteId] = useState<number | null>(null);

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
      console.log('useEffect triggered - projects length:', projects?.length);
      console.log('Force loading projects in Notes component...');
      try {
        // Fetch all projects (active and inactive)
        const fetchedProjects = await fetchProjects("all", "");
        console.log('Raw API response:', fetchedProjects);
        console.log('Projects loaded:', fetchedProjects.length, fetchedProjects.map(p => p.name));
        setProjects(fetchedProjects);
        console.log('setProjects called');
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
      setNotes((prev) => prev.filter((note) => note.id !== noteToDelete.id));
      setIsConfirmDialogOpen(false);
      setNoteToDelete(null);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleEditNote = (note: Note) => {
    console.log('Opening note modal with projects:', { 
      projectsLength: projects?.length, 
      memoizedLength: memoizedProjects?.length,
      projectsExist: !!projects,
      memoizedExist: !!memoizedProjects
    });
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
      const newProject = await createProject({ name, priority: 'medium' });
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <BookOpenIcon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">
              {t('notes.title')}
            </h2>
          </div>
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
          <p className="text-gray-700 dark:text-gray-300">{t('notes.noNotesFound')}</p>
        ) : (
          <ul className="space-y-1">
            {filteredNotes.map((note) => (
              <li
                key={note.id}
                className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-3 flex justify-between items-center"
                onMouseEnter={() => setHoveredNoteId(note.id || null)}
                onMouseLeave={() => setHoveredNoteId(null)}
              >
                <div className="flex-grow overflow-hidden pr-4">
                  <div className="flex flex-col">
                    <Link
                      to={`/note/${note.id}`}
                      className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline mb-1"
                    >
                      {note.title}
                    </Link>
                    {/* Project and Tags */}
                    {((note.project || note.Project) || ((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0))) && (
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        {(note.project || note.Project) && (
                          <div className="flex items-center">
                            <FolderIcon className="h-3 w-3 mr-1" />
                            <span>{(note.project || note.Project)?.name}</span>
                          </div>
                        )}
                        {(note.project || note.Project) && ((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0)) && (
                          <span className="mx-2">•</span>
                        )}
                        {((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0)) && (
                          <div className="flex items-center">
                            <TagIcon className="h-3 w-3 mr-1" />
                            <span>{(note.tags || note.Tags || []).map(tag => tag.name).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditNote(note)}
                    className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${hoveredNoteId === note.id ? 'opacity-100' : 'opacity-0'}`}
                    aria-label={t('notes.editNoteAriaLabel', { noteTitle: note.title })}
                    title={t('notes.editNoteTitle', { noteTitle: note.title })}
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setNoteToDelete(note);
                      setIsConfirmDialogOpen(true);
                    }}
                    className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${hoveredNoteId === note.id ? 'opacity-100' : 'opacity-0'}`}
                    aria-label={t('notes.deleteNoteAriaLabel', { noteTitle: note.title })}
                    title={t('notes.deleteNoteTitle', { noteTitle: note.title })}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* NoteModal */}
        {isNoteModalOpen && (
          <NoteModal
            isOpen={isNoteModalOpen}
            onClose={() => {
              console.log('Closing modal, projects at close:', { projectsLength: projects?.length });
              setIsNoteModalOpen(false);
            }}
            onSave={handleSaveNote}
            onDelete={async (noteId) => {
              try {
                await apiDeleteNote(noteId);
                setNotes((prev) => prev.filter((note) => note.id !== noteId));
                setIsNoteModalOpen(false);
                setSelectedNote(null);
              } catch (err) {
                console.error('Error deleting note:', err);
              }
            }}
            note={selectedNote}
            projects={projects?.length > 0 ? projects : [
              { id: 1, name: 'Test Project 1', active: true, priority: 'medium' },
              { id: 2, name: 'tududi', active: true, priority: 'high' }
            ] as any} 
            onCreateProject={handleCreateProject}
          />
        )}
        

        {/* ConfirmDialog */}
        {isConfirmDialogOpen && noteToDelete && (
          <ConfirmDialog
            title={t('modals.deleteNote.title')}
            message={t('modals.deleteNote.message', { noteTitle: noteToDelete.title })}
            onConfirm={handleDeleteNote}
            onCancel={() => setIsConfirmDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Notes;