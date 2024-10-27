import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon, TagIcon } from '@heroicons/react/24/solid';
import { useDataContext } from '../../contexts/DataContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from './NoteModal';
import { Note } from '../../entities/Note'; 

const NoteDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { notes, deleteNote, isLoading, isError } = useDataContext(); 
  const [note, setNote] = useState<Note | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false); 
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const foundNote = notes.find((n) => n.id === Number(id));
    setNote(foundNote || null);
  }, [id, notes]);

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNote(noteToDelete.id);
      navigate('/notes'); 
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleSaveNote = (updatedNote: Note) => {
    setNote(updatedNote); 
    setIsNoteModalOpen(false); 
  };

  const handleEditNote = () => {
    setIsNoteModalOpen(true); 
  };

  const handleOpenConfirmDialog = (note: Note) => {
    setNoteToDelete(note);
    setIsConfirmDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading note details...
        </div>
      </div>
    );
  }

  if (isError || !note) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">
          {isError ? 'Error loading note details.' : 'Note not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-5xl">
        {/* Header Section with Title and Action Buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <i className="bi bi-journal-text text-xl mr-2"></i>
            <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
              {note.title}
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleEditNote}
              className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
              aria-label={`Edit ${note.title}`}
              title={`Edit ${note.title}`}
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleOpenConfirmDialog(note)}
              className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
              aria-label={`Delete ${note.title}`}
              title={`Delete ${note.title}`}
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Card with Tags and Metadata */}
        <div className="bg-white dark:bg-gray-900 shadow-md rounded-lg p-4 mb-6">
          {/* Note Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="mb-4">
              <div className="mt-2 flex flex-wrap space-x-2">
                {note.tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => navigate(`/tasks?tag=${tag.name}`)}
                    className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{tag.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note Metadata */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Created on: {new Date(note.created_at || '').toLocaleDateString()}</p>
            <p>Last updated: {new Date(note.updated_at || '').toLocaleDateString()}</p>
          </div>

          {/* Note Project */}
          {note.project && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project</h3>
              <Link
                to={`/project/${note.project.id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {note.project.name}
              </Link>
            </div>
          )}
        </div>

        {/* Note Content */}
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {note.content}
          </p>
        </div>

        {/* NoteModal for editing */}
        {isNoteModalOpen && (
          <NoteModal
            isOpen={isNoteModalOpen}
            onClose={() => setIsNoteModalOpen(false)}
            onSave={handleSaveNote}
            note={note}
          />
        )}

        {/* ConfirmDialog */}
        {isConfirmDialogOpen && noteToDelete && (
          <ConfirmDialog
            title="Delete Note"
            message={`Are you sure you want to delete the note "${noteToDelete.title}"?`}
            onConfirm={handleDeleteNote}
            onCancel={() => {
              setIsConfirmDialogOpen(false);
              setNoteToDelete(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default NoteDetails;
