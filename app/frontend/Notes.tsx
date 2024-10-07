import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  project?: {
    id: number;
    name: string;
  };
  tags?: { id: number; name: string }[];
}

const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<string>('title:asc'); // Default ordering
  const [tagFilter, setTagFilter] = useState<string>(''); // Tag filter

  const navigate = useNavigate();

  // Fetch notes from the backend
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const params = new URLSearchParams();
        if (tagFilter) {
          params.append('tag', tagFilter);
        }
        if (orderBy) {
          params.append('order_by', orderBy);
        }

        const response = await fetch(`/api/notes?${params.toString()}`, {
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
        setNotes(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [tagFilter, orderBy]);

  // Handle note deletion
  const handleDeleteNote = async (id: number) => {
    try {
      const response = await fetch(`/api/note/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete note.');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        {/* Notes Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notes
          </h2>
          <Link
            to="/note/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Create New Note
          </Link>
        </div>

        {/* Filters Section */}
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-6">
          {/* Order By */}
          <div className="mb-4 md:mb-0 w-full md:w-1/3">
            <label
              htmlFor="orderBy"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Order By
            </label>
            <select
              id="orderBy"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="title:asc">Title Ascending</option>
              <option value="created_at:desc">Date Created Descending</option>
            </select>
          </div>

          {/* Tag Filter */}
          <div className="w-full md:w-1/3">
            <label
              htmlFor="tagFilter"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Filter by Tag
            </label>
            <input
              type="text"
              id="tagFilter"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Enter tag name"
              className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notes Listing */}
        {notes.length === 0 ? (
          <p className="text-gray-700 dark:text-gray-300">No notes found.</p>
        ) : (
          <ul className="space-y-4">
            {notes.map((note) => (
              <li
                key={note.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-md"
              >
                <div>
                  <Link
                    to={`/note/${note.id}`}
                    className="text-lg font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {note.title}
                  </Link>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {note.content}
                  </p>
                  {note.tags && (
                    <div className="mt-2">
                      {note.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded dark:bg-blue-200 dark:text-blue-900"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <Link
                    to={`/note/${note.id}/edit`}
                    className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                    aria-label={`Edit ${note.title}`}
                    title={`Edit ${note.title}`}
                  >
                    <i className="bi bi-pencil-square text-xl"></i>
                  </Link>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                    aria-label={`Delete ${note.title}`}
                    title={`Delete ${note.title}`}
                  >
                    <i className="bi bi-trash text-xl"></i>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Notes;
