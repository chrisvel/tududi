import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
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

const Notes: React.FC = () => {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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
    setSelectedNote(note);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async (noteData: Note) => {
    try {
      let updatedNotes;
      if (noteData.id) {
        await updateNote(noteData.id, noteData);
        updatedNotes = notes.map((note) =>
          note.id === noteData.id ? noteData : note
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

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  )
  .sort((a, b) => a.title.localeCompare(b.title));

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
          <ul className="space-y-2">
            {filteredNotes.map((note) => (
              <li
                key={note.id}
                className="px-4 flex justify-between items-center border-b border-gray-300 dark:border-gray-700"
              >
                <div className="flex-grow overflow-hidden pr-4">
                  <Link
                    to={`/note/${note.id}`}
                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline block"
                  >
                    {note.title}
                  </Link>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditNote(note)}
                    className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
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
            onClose={() => setIsNoteModalOpen(false)}
            onSave={handleSaveNote}
            note={selectedNote}
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
