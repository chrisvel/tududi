// src/components/NoteDetails.tsx

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid';
import { Note } from '../../entities/Note';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from './NoteModal';


const NoteDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false); // State for the modal

  // State for managing the confirm delete dialog
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const response = await fetch(`/api/note/${id}`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch note.');
        }
        const data: Note = await response.json();
        setNote(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id]);

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;

    try {
      const response = await fetch(`/api/note/${noteToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        navigate('/notes');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete note.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveNote = (updatedNote: Note) => {
    setNote(updatedNote);
    setIsNoteModalOpen(false); // Close modal after saving
  };

  const handleEditNote = () => {
    setIsNoteModalOpen(true); // Open the modal when editing
  };

  const handleOpenConfirmDialog = (note: Note) => {
    setNoteToDelete(note);
    setIsConfirmDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading note details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-red-500 text-lg">Note not found.</div>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-4xl">
        {/* Header Section with Title */}
        <div className="flex items-center mb-8">
          <i className="bi bi-journal-text text-xl mr-2"></i>
          <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100">
            {note.title}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end mb-4 space-x-2">
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

        {/* Note Content */}
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {note.content}
          </p>
        </div>

        {/* Note Metadata */}
        <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          <p>
            Created on: {new Date(note.created_at || '').toLocaleDateString()}
          </p>
          <p>
            Last updated: {new Date(note.updated_at || '').toLocaleDateString()}
          </p>
        </div>

        {/* Note Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tags
            </h3>
            <div className="mt-2 flex flex-wrap">
              {note.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold mr-2 mb-2 px-2.5 py-0.5 rounded dark:bg-blue-200 dark:text-blue-900"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Note Project */}
        {note.project && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Project
            </h3>
            <Link
              to={`/project/${note.project.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {note.project.name}
            </Link>
          </div>
        )}

        {/* NoteModal for editing */}
        {isNoteModalOpen && (
          <NoteModal
            isOpen={isNoteModalOpen}
            onClose={() => setIsNoteModalOpen(false)}
            onSave={handleSaveNote}
            note={note} // Pass the current note to the modal for editing
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
