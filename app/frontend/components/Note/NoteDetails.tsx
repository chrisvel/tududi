import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags?: { id: number; name: string }[];
  project?: {
    id: number;
    name: string;
  };
}

const NoteDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const response = await fetch(`/api/note/${id}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
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
    try {
      const response = await fetch(`/api/note/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {note.title}
          </h2>
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
              onClick={handleDeleteNote}
              className="text-red-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
              aria-label={`Delete ${note.title}`}
              title={`Delete ${note.title}`}
            >
              <i className="bi bi-trash text-xl"></i>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {note.content}
          </p>
        </div>

        <div className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          <p>Created on: {new Date(note.created_at).toLocaleDateString()}</p>
          <p>Last updated: {new Date(note.updated_at).toLocaleDateString()}</p>
        </div>

        {note.tags && note.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tags
            </h3>
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
          </div>
        )}

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
      </div>
    </div>
  );
};

export default NoteDetails;
