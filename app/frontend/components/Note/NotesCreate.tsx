// src/pages/NotesCreate.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Tag {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
}

const NotesCreate: React.FC = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const navigate = useNavigate();

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
          setAvailableTags(data.tags.map((tag: Tag) => tag.name));
        } else {
          console.error('Failed to fetch tags:', data.error);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  // Fetch available projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects?active=true', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok) {
          setProjects(data.projects || []);
        } else {
          console.error('Failed to fetch projects:', data.error);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };
    fetchProjects();
  }, []);

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tag = e.target.value;
    if (e.target.checked) {
      setTags([...tags, tag]);
    } else {
      setTags(tags.filter((t) => t !== tag));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (title.trim() === '') {
      setError('Title is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          tags: tags.map((tag) => ({ value: tag })), // Assuming backend expects array of objects with 'value'
          project_id: selectedProjectId,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        navigate('/notes');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create note.');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      setError('Error creating note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 flex justify-center">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 shadow rounded-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New Note</h2>

        {error && (
          <div
            className="mb-4 text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200 p-4 rounded"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={`mt-1 block w-full px-3 py-2 border ${
                title.trim() === '' ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'
              } rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white`}
              placeholder="Enter note title"
            />
            {title.trim() === '' && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-300" id="title-error">
                Title is required.
              </p>
            )}
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter note content"
            ></textarea>
          </div>

          {/* Tags */}
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</span>
            <div className="flex flex-wrap space-x-2">
              {availableTags.map((tag) => (
                <label key={tag} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    value={tag}
                    checked={tags.includes(tag)}
                    onChange={handleTagChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{tag}</span>
                </label>
              ))}
              {/* Optionally, allow adding new tags */}
            </div>
          </div>

          {/* Project Selection */}
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Project
            </label>
            <select
              id="project"
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(parseInt(e.target.value))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotesCreate;