import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TagIcon, SortDescendingIcon, SortAscendingIcon } from '@heroicons/react/24/solid';

interface Tag {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
}

interface Note {
  id: number;
  title: string;
  content: string;
  tags: Tag[];
  project: Project | null;
}

const NotesList: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [orderBy, setOrderBy] = useState<string>('title:asc');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Parse query parameters for tag and order_by
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tag = params.get('tag');
    const order = params.get('order_by');

    if (tag) {
      setSelectedTag(tag);
    }

    if (order) {
      setOrderBy(order);
    }
  }, [location.search]);

  // Fetch tags for filtering (assuming there's an API endpoint)
  useEffect(() => {
    const fetchTags = async () => {
      try {
        // Assuming you have an endpoint to fetch all tags
        const response = await fetch('/api/tags', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
          setTags(data.tags || []);
        } else {
          console.error('Failed to fetch tags:', data.error);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  // Fetch notes based on selected tag and order
  useEffect(() => {
    const fetchNotes = async () => {
      setIsLoading(true);
      try {
        let query = `?order_by=${orderBy}`;
        if (selectedTag) {
          query += `&tag=${encodeURIComponent(selectedTag)}`;
        }
        const response = await fetch(`/api/notes${query}`, {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
          setNotes(data.notes || []);
        } else {
          console.error('Failed to fetch notes:', data.error);
          setError(data.error || 'Failed to fetch notes.');
        }
      } catch (error) {
        console.error('Error fetching notes:', error);
        setError('Error fetching notes.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotes();
  }, [selectedTag, orderBy]);

  const handleTagFilter = (tag: string | null) => {
    const params = new URLSearchParams(location.search);
    if (tag) {
      params.set('tag', tag);
    } else {
      params.delete('tag');
    }
    navigate({
      pathname: '/notes',
      search: params.toString(),
    });
  };

  const handleSortChange = (newOrder: string) => {
    const params = new URLSearchParams(location.search);
    params.set('order_by', newOrder);
    navigate({
      pathname: '/notes',
      search: params.toString(),
    });
  };

  const handleAddNote = () => {
    navigate('/notes/create');
  };

  const handleEditNote = (id: number) => {
    navigate(`/notes/${id}/edit`);
  };

  const handleDeleteNote = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.status === 204) {
        // Successfully deleted
        setNotes((prevNotes) => prevNotes.filter((note) => note.id !== id));
      } else {
        const data = await response.json();
        console.error('Failed to delete note:', data.error);
        alert(data.error || 'Failed to delete note.');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Error deleting note.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <h2 className="mb-5 flex items-center text-2xl font-bold text-gray-900 dark:text-white">
        <TagIcon className="h-6 w-6 mr-2" />
        Notes
      </h2>

      {/* Filter and Sort Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          {/* Tag Filter */}
          <div className="relative">
            <button
              className="inline-flex justify-center w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              id="filter-menu"
              aria-haspopup="true"
            >
              <TagIcon className="h-5 w-5 mr-2" />
              {selectedTag ? selectedTag : 'Filter by Tag'}
              {/* Dropdown Icon */}
              <svg
                className="-mr-1 ml-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.35a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {/* Dropdown Menu */}
            <div
              className="origin-top-left absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="filter-menu"
            >
              <div className="py-1">
                <button
                  onClick={() => handleTagFilter(null)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  role="menuitem"
                >
                  All
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagFilter(tag)}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      selectedTag === tag
                        ? 'bg-blue-500 text-white dark:bg-blue-600'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    role="menuitem"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              className="inline-flex justify-center w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              id="sort-menu"
              aria-haspopup="true"
            >
              <SortDescendingIcon className="h-5 w-5 mr-2" />
              Sort
              {/* Dropdown Icon */}
              <svg
                className="-mr-1 ml-2 h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.35a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {/* Dropdown Menu */}
            <div
              className="origin-top-left absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="sort-menu"
            >
              <div className="py-1">
                <button
                  onClick={() => handleSortChange('title:asc')}
                  className={`flex items-center justify-between block w-full text-left px-4 py-2 text-sm ${
                    orderBy === 'title:asc'
                      ? 'bg-blue-500 text-white dark:bg-blue-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  role="menuitem"
                >
                  Title Ascending
                  {orderBy === 'title:asc' && (
                    <SortAscendingIcon className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleSortChange('title:desc')}
                  className={`flex items-center justify-between block w-full text-left px-4 py-2 text-sm ${
                    orderBy === 'title:desc'
                      ? 'bg-blue-500 text-white dark:bg-blue-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  role="menuitem"
                >
                  Title Descending
                  {orderBy === 'title:desc' && (
                    <SortDescendingIcon className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleSortChange('created_at:desc')}
                  className={`flex items-center justify-between block w-full text-left px-4 py-2 text-sm ${
                    orderBy === 'created_at:desc'
                      ? 'bg-blue-500 text-white dark:bg-blue-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  role="menuitem"
                >
                  Newest First
                  {orderBy === 'created_at:desc' && (
                    <SortDescendingIcon className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleSortChange('created_at:asc')}
                  className={`flex items-center justify-between block w-full text-left px-4 py-2 text-sm ${
                    orderBy === 'created_at:asc'
                      ? 'bg-blue-500 text-white dark:bg-blue-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  role="menuitem"
                >
                  Oldest First
                  {orderBy === 'created_at:asc' && (
                    <SortAscendingIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Note Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleAddNote}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add Note
          </button>
        </div>

        {/* Notes List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center text-gray-500 dark:text-gray-300">
              Loading notes...
            </div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : notes.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-300">
              No notes found.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-white dark:bg-gray-800 shadow rounded-lg p-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {note.title}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditNote(note.id)}
                      className="text-blue-500 hover:text-blue-700 focus:outline-none"
                      aria-label="Edit Note"
                      title="Edit Note"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path
                          fillRule="evenodd"
                          d="M2 6a2 2 0 012-2h3a1 1 0 010 2H4V16h2a1 1 0 010 2H4a2 2 0 01-2-2V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-500 hover:text-red-700 focus:outline-none"
                      aria-label="Delete Note"
                      title="Delete Note"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-1 1v1H5a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3V3a1 1 0 00-1-1H9zm3 4V3a1 1 0 00-1-1H9a1 1 0 00-1 1v3H6v10a1 1 0 001 1h8a1 1 0 001-1V6h-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {note.content}
                </p>
                {/* Tags */}
                <div className="mt-2 flex flex-wrap space-x-2">
                  {note.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-200"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
                {/* Project */}
                {note.project && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200">
                      Project: {note.project.name}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );