import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/solid'; // Heroicons for edit and delete
import TaskTags from './components/Task/TaskTags'; // Ensure correct path
import NoteModal from './components/Note/NoteModal'; // Ensure the path is correct
import { Note } from './entities/Note'; // Ensure correct path
import ConfirmDialog from './components/Shared/ConfirmDialog';

const Notes: React.FC = () => {
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [orderBy, setOrderBy] = useState<string>('title:asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null); // For editing note

  // State for managing the confirm delete dialog
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/notes`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch notes.');
        }

        const data = await response.json();
        setAllNotes(data);
        setFilteredNotes(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

  // Handle filtering and sorting
  useEffect(() => {
    let notes = [...allNotes];

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      notes = notes.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          (note.tags && note.tags.some((tag) => tag.name.toLowerCase().includes(query))) ||
          (note.project && note.project.name.toLowerCase().includes(query))
      );
    }

    const [key, direction] = orderBy.split(':');
    notes.sort((a, b) => {
      if (key === 'title') {
        return direction === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
      } else if (key === 'created_at') {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });

    setFilteredNotes(notes);
  }, [allNotes, searchQuery, orderBy]);

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
        setAllNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteToDelete.id));
        setIsConfirmDialogOpen(false);
        setNoteToDelete(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete note.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleOpenConfirmDialog = (note: Note) => {
    setNoteToDelete(note);
    setIsConfirmDialogOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = (savedNote: Note) => {
    if (savedNote.id) {
      // Update existing note
      setAllNotes((prevNotes) =>
        prevNotes.map((note) => (note.id === savedNote.id ? savedNote : note))
      );
    } else {
      // Add new note
      setAllNotes((prevNotes) => [...prevNotes, savedNote]);
    }
    setIsNoteModalOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading notes...
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

  return (
    <div className="flex justify-center px-4 py-6">
      <div className="w-full max-w-4xl">
        {/* Notes Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notes</h2>
        </div>

        {/* Filters Section */}
        <div className="mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Search Notes */}
            <div className="w-full md:w-2/3">
              <label
                htmlFor="searchQuery"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Search Notes
              </label>
              <input
                type="text"
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search term"
                className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative inline-block text-left w-full md:w-1/3" ref={dropdownRef}>
              <label
                htmlFor="orderBy"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Order By
              </label>
              <div>
                <button
                  type="button"
                  className="inline-flex justify-between w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  id="menu-button"
                  aria-expanded="true"
                  aria-haspopup="true"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  {orderBy === 'title:asc' ? 'Title' : 'Date Created'}
                  <svg
                    className="-mr-1 ml-2 h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.292 7.707a1 1 0 011.414 0L10 11.414l3.293-3.707a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {dropdownOpen && (
                <div
                  className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="menu-button"
                >
                  <div className="py-1" role="none">
                    {['title:asc', 'created_at:desc'].map((order) => (
                      <button
                        key={order}
                        onClick={() => setOrderBy(order)}
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                      >
                        {order === 'title:asc' ? 'Title' : 'Date Created'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes Listing */}
        {filteredNotes.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No notes found.</p>
        ) : (
          <ul className="space-y-2">
            {filteredNotes.map((note) => (
              <li key={note.id}>
                <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 flex justify-between items-center">
                  {/* Note Content */}
                  <div className="flex-grow overflow-hidden pr-4">
                    <Link
                      to={`/note/${note.id}`}
                      className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline block"
                    >
                      {note.title}
                    </Link>

                    {/* Truncated Content */}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                      {note.content}
                    </p>
                  </div>

                  {/* Tags and Actions */}
                  <div className="flex items-center space-x-2">
                    {/* Tags */}
                    {note.tags && (
                      <TaskTags
                        tags={note.tags}
                        className="flex-wrap gap-1"
                      />
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2 mt-1">
                      <button
                        onClick={() => handleEditNote(note)}
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
        {isConfirmDialogOpen && (
          <ConfirmDialog
            title="Delete Note"
            message={`Are you sure you want to delete the note "${noteToDelete?.title}"?`}
            onConfirm={handleDeleteNote}
            onCancel={() => setIsConfirmDialogOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Notes;
