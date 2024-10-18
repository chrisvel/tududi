import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid'; // Heroicons for edit and delete
import NoteModal from './components/Note/NoteModal'; // Ensure the path is correct
import ConfirmDialog from './components/Shared/ConfirmDialog';
import { useDataContext } from './contexts/DataContext'; // Import DataContext
import { Note } from './entities/Note';

const Notes: React.FC = () => {
  const { notes, createNote, updateNote, deleteNote, isLoading, isError } = useDataContext(); // Use notes from context
  const [selectedNote, setSelectedNote] = useState(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete.id);
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

  const handleSaveNote = async (noteData: { id: number; }) => {
    try {
      if (noteData.id) {
        await updateNote(noteData.id, noteData);
      } else {
        await createNote(noteData);
      }
      setIsNoteModalOpen(false);
      setSelectedNote(null);
    } catch (err) {
      console.error('Error saving note:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading notes...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">Error loading notes.</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Notes Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <BookOpenIcon className="h-6 w-6 mr-2 text-gray-900 dark:text-white" />
            <h2 className="text-2xl font-light text-gray-900 dark:text-white">Notes</h2>
          </div>
        </div>

        {/* Notes List */}
        {notes.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No notes found.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center">
                {/* Note Content */}
                <div className="flex-grow overflow-hidden pr-4">
                  <Link
                    to={`/note/${note.id}`}
                    className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline block"
                  >
                    {note.title}
                  </Link>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                    {note.content}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditNote(note)}
                    className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                    aria-label={`Edit ${note.title}`}
                    title={`Edit ${note.title}`}
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setNoteToDelete(note);
                      setIsConfirmDialogOpen(true);
                    }}
                    className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                    aria-label={`Delete ${note.title}`}
                    title={`Delete ${note.title}`}
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
            title="Delete Note"
            message={`Are you sure you want to delete the note "${noteToDelete.title}"?`}
            onConfirm={handleDeleteNote}
            onCancel={() => setIsConfirmDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Notes;
