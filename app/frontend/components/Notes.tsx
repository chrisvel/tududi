// src/Notes.tsx

import React, { useState, useEffect } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import TagInput from '../TagInput';
import ConfirmDialog from './ConfirmDialog';


interface Tag {
  id: number;
  name: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
  project_id: number | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [newNoteTags, setNewNoteTags] = useState<Tag[]>([]);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState<string>('');
  const [editingNoteContent, setEditingNoteContent] = useState<string>('');
  const [editingNoteTags, setEditingNoteTags] = useState<Tag[]>([]);

  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        if (response.ok) {
          setNotes(data.notes || []);
        } else {
          setError(data.error || 'Failed to fetch notes.');
        }
      } catch (err) {
        setError('Error fetching notes.');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  // Handle Adding a New Note
  const handleAddNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      setError('Title and Content are required.');
      return;
    }

    try {
      const response = await fetch('/api/note/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newNoteTitle,
          content: newNoteContent,
          tags: JSON.stringify(newNoteTags), // Assuming backend expects JSON string
        }),
      });

      if (response.ok) {
        const createdNote = await response.json();
        setNotes([...notes, createdNote.note]);
        setIsCreating(false);
        setNewNoteTitle('');
        setNewNoteContent('');
        setNewNoteTags([]);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create note.');
      }
    } catch (err) {
      setError('Error creating note.');
      console.error('Error:', err);
    }
  };

  // Handle Editing a Note
  const handleEditNote = async (noteId: number) => {
    if (!editingNoteTitle.trim() || !editingNoteContent.trim()) {
      setError('Title and Content are required.');
      return;
    }

    try {
      const response = await fetch(`/api/note/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingNoteTitle,
          content: editingNoteContent,
          tags: JSON.stringify(editingNoteTags),
        }),
      });

      if (response.ok) {
        const updatedNote = await response.json();
        setNotes(notes.map(note => (note.id === noteId ? updatedNote.note : note)));
        setEditingNoteId(null);
        setEditingNoteTitle('');
        setEditingNoteContent('');
        setEditingNoteTags([]);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update note.');
      }
    } catch (err) {
      setError('Error updating note.');
      console.error('Error:', err);
    }
  };

  // Handle Deleting a Note
  const handleDeleteNote = async () => {
    if (deletingNoteId === null) return;

    try {
      const response = await fetch(`/api/note/${deletingNoteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotes(notes.filter(note => note.id !== deletingNoteId));
        setDeletingNoteId(null);
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete note.');
      }
    } catch (err) {
      setError('Error deleting note.');
      console.error('Error:', err);
    }
  };

  if (loading) {
    return <div className="text-gray-700 dark:text-gray-300">Loading notes...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Notes</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
        >
          {/* Plus Icon */}
          <svg
            className="h-5 w-5 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Note
        </button>
      </div>

      {/* Add Note Form */}
      {isCreating && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Create New Note</h3>
          <div className="mb-4">
            <label htmlFor="newNoteTitle" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Title:
            </label>
            <input
              type="text"
              id="newNoteTitle"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter note title"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="newNoteContent" className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Content:
            </label>
            <textarea
              id="newNoteContent"
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-gray-100"
              placeholder="Enter note content"
              rows={4}
            ></textarea>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Tags:
            </label>
            <TagInput selectedTags={newNoteTags} setSelectedTags={setNewNoteTags} />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleAddNote}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewNoteTitle('');
                setNewNoteContent('');
                setNewNoteTags([]);
                setError(null);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-gray-700 dark:text-gray-300">No notes available.</p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="p-4 bg-white dark:bg-gray-800 rounded shadow">
              {editingNoteId === note.id ? (
                <div>
                  <div className="mb-4">
                    <label htmlFor={`editTitle-${note.id}`} className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                      Title:
                    </label>
                    <input
                      type="text"
                      id={`editTitle-${note.id}`}
                      value={editingNoteTitle}
                      onChange={(e) => setEditingNoteTitle(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor={`editContent-${note.id}`} className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                      Content:
                    </label>
                    <textarea
                      id={`editContent-${note.id}`}
                      value={editingNoteContent}
                      onChange={(e) => setEditingNoteContent(e.target.value)}
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      rows={3}
                    ></textarea>
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
                      Tags:
                    </label>
                    <TagInput selectedTags={editingNoteTags} setSelectedTags={setEditingNoteTags} />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditNote(note.id)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditingNoteTitle('');
                        setEditingNoteContent('');
                        setEditingNoteTags([]);
                        setError(null);
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 focus:outline-none"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{note.title}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditingNoteTitle(note.title);
                          setEditingNoteContent(note.content);
                          setEditingNoteTags(note.tags);
                        }}
                        className="text-yellow-500 hover:text-yellow-600 focus:outline-none"
                        aria-label="Edit Note"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setDeletingNoteId(note.id)}
                        className="text-red-500 hover:text-red-600 focus:outline-none"
                        aria-label="Delete Note"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-gray-700 dark:text-gray-300">{note.content}</p>
                  <div className="mt-4">
                    {note.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded"
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingNoteId !== null && (
        <ConfirmDialog
          title="Delete Note"
          message="Are you sure you want to delete this note? This action cannot be undone."
          onConfirm={handleDeleteNote}
          onCancel={() => setDeletingNoteId(null)}
        />
      )}
    </div>
  );
};

export default Notes;
