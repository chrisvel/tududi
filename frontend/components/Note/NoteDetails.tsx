import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon, TagIcon, DocumentTextIcon } from '@heroicons/react/24/solid';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from './NoteModal';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import { Note } from '../../entities/Note';
import { fetchNotes, deleteNote as apiDeleteNote, updateNote as apiUpdateNote } from '../../utils/notesService';
import { useModalEvents } from '../../hooks/useModalEvents';

const NoteDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();
  
  // Dispatch global modal events
  useModalEvents(isNoteModalOpen);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        setIsLoading(true);
        const notes = await fetchNotes();
        const foundNote = notes.find((n: Note) => n.id === Number(id));
        setNote(foundNote || null);
        if (!foundNote) {
          setIsError(true);
        }
      } catch (err) {
        setIsError(true);
        console.error('Error fetching note:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNote();
  }, [id]);

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await apiDeleteNote(noteToDelete.id!);
      navigate('/notes');
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleSaveNote = async (updatedNote: Note) => {
    try {
      if (updatedNote.id !== undefined) {
        const savedNote = await apiUpdateNote(updatedNote.id, updatedNote);
        setNote(savedNote);
      } else {
        console.error("Error: Note ID is undefined.");
      }
    } catch (err) {
      console.error('Error saving note:', err);
    }
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
    <div className="flex justify-center px-4 lg:px-2">
      <div className="w-full max-w-5xl">
        {/* Header Section with Title and Action Buttons */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <DocumentTextIcon className="h-6 w-6 text-xl mr-2" />
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
        {/* Tags and Project */}
        {((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0)) || note.project || note.Project ? (
          <div className="bg-white dark:bg-gray-900 shadow-md rounded-lg p-4 mb-6">
            {/* Note Tags */}
            {((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0)) && (
              <div className="mb-4">
                <div className="flex items-start">
                  <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-3 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">Tags:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(note.tags || note.Tags || []).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => navigate(`/tag/${tag.id}`)}
                          className="flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-xs"
                        >
                          <TagIcon className="h-3 w-3" />
                          <span>{tag.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Note Project */}
            {(note.project || note.Project) && (
              <div className={((note.tags && note.tags.length > 0) || (note.Tags && note.Tags.length > 0)) ? "mt-4" : ""}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Project
                </h3>
                <Link
                  to={`/project/${(note.project || note.Project)?.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {(note.project || note.Project)?.name}
                </Link>
              </div>
            )}
          </div>
        ) : null}
        {/* Note Content */}
        <div className="mb-6 bg-white dark:bg-gray-900 shadow-md rounded-lg p-6">
          <MarkdownRenderer content={note.content} />
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