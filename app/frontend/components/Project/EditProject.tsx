// src/components/Project/EditProject.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Project } from '../../entities/Project';

interface Area {
  id: number;
  name: string;
}

const EditProject: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('bi-folder-fill'); // Default icon
  const [active, setActive] = useState(false); // State for 'active'
  const [pinToSidebar, setPinToSidebar] = useState(false); // State for 'pin_to_sidebar'
  const [areas, setAreas] = useState<Area[]>([]); // List of areas
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null); // Selected area ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for submission
  const [success, setSuccess] = useState<string | null>(null); // Success message

  useEffect(() => {
    if (!id) {
      setError('Invalid project ID.');
      setLoading(false);
      return;
    }

    const fetchProjectAndAreas = async () => {
      try {
        // Fetch Project Details
        const projectResponse = await fetch(`/api/project/${id}`, {
          method: 'GET',
          credentials: 'include', // Include cookies for authentication
        });

        const projectContentType = projectResponse.headers.get('Content-Type');

        if (projectResponse.ok && projectContentType?.includes('application/json')) {
          const projectData = await projectResponse.json();
          setProject(projectData);
          setName(projectData.name);
          setDescription(projectData.description || '');
          setIcon(projectData.icon || 'bi-folder-fill');
          setActive(projectData.active || false);
          setPinToSidebar(projectData.pin_to_sidebar || false); // Initialize 'pin_to_sidebar' status
          setSelectedAreaId(projectData.area?.id || null); // Initialize selected area
        } else if (projectContentType?.includes('application/json')) {
          const errorData = await projectResponse.json();
          throw new Error(errorData.error || 'Failed to fetch project.');
        } else {
          const text = await projectResponse.text();
          throw new Error(`Unexpected response: ${text}`);
        }

        // Fetch Areas
        const areasResponse = await fetch(`/api/areas`, {
          method: 'GET',
          credentials: 'include',
        });

        const areasContentType = areasResponse.headers.get('Content-Type');

        if (areasResponse.ok && areasContentType?.includes('application/json')) {
          const areasData = await areasResponse.json();
          setAreas(areasData);
        } else if (areasContentType?.includes('application/json')) {
          const errorData = await areasResponse.json();
          throw new Error(errorData.error || 'Failed to fetch areas.');
        } else {
          const text = await areasResponse.text();
          throw new Error(`Unexpected response: ${text}`);
        }
      } catch (error) {
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndAreas();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic front-end validation
    if (name.trim() === '') {
      setError('Project name cannot be empty.');
      return;
    }

    if (!selectedAreaId) {
      setError('Please select an area for the project.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/project/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon, active, pin_to_sidebar: pinToSidebar, area_id: selectedAreaId }), // Include 'active', 'pin_to_sidebar', and 'area_id'
        credentials: 'include', // Include cookies for authentication
      });

      const contentType = response.headers.get('Content-Type');

      if (response.ok && contentType?.includes('application/json')) {
        const data = await response.json();
        setSuccess('Project updated successfully.');
        navigate(`/project/${id}`);
      } else if (contentType?.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project.');
      } else {
        // Handle unexpected content types
        const text = await response.text();
        throw new Error(`Unexpected response: ${text}`);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading project details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div
          className="text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 p-4 rounded"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 text-center">
          Edit Project
        </h2>

        {success && (
          <div
            className="mb-4 text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-200 p-4 rounded"
            role="alert"
            aria-live="polite"
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Project Name
            </label>
            <div className="mt-1 relative">
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={`appearance-none block w-full px-3 py-2 border ${
                  name.trim() === '' ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'
                } rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white`}
                placeholder="Enter project name"
              />
              {name.trim() === '' && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-300" id="name-error">
                  Project name is required.
                </p>
              )}
            </div>
          </div>

          {/* Project Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <div className="mt-1">
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter project description"
              ></textarea>
            </div>
          </div>

          {/* Project Icon */}
          <div>
            <label htmlFor="icon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Icon
            </label>
            <div className="mt-1 relative">
              <select
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 text-base border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="bi-folder-fill">Folder</option>
                <option value="bi-kanban">Kanban</option>
                <option value="bi-gear">Gear</option>
                {/* Add more icon options as needed */}
              </select>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {/* SVG Icon Preview */}
                {icon === 'bi-folder-fill' && (
                  <svg
                    className="h-5 w-5 text-gray-400 dark:text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                )}
                {icon === 'bi-kanban' && (
                  <svg
                    className="h-5 w-5 text-gray-400 dark:text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    {/* Kanban Board Icon */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
                {icon === 'bi-gear' && (
                  <svg
                    className="h-5 w-5 text-gray-400 dark:text-gray-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    {/* Gear Icon */}
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 
                    3-1.343 3-3-1.343-3-3-3z" />
                  </svg>
                )}
                {/* Add more SVGs as needed */}
              </div>
            </div>
          </div>

          {/* Project Area */}
          <div>
            <label htmlFor="area" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Area
            </label>
            <div className="mt-1">
              <select
                id="area"
                value={selectedAreaId ?? ''}
                onChange={(e) => setSelectedAreaId(parseInt(e.target.value))}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="" disabled>
                  Select an area
                </option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              id="active"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>

          {/* Pin to Sidebar */}
          <div className="flex items-center">
            <input
              id="pin_to_sidebar"
              type="checkbox"
              checked={pinToSidebar} // Corrected variable name
              onChange={(e) => setPinToSidebar(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 rounded"
            />
            <label htmlFor="pin_to_sidebar" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Pin to Sidebar
            </label>
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
              {isSubmitting ? (
                <div className="w-5 h-5 border-4 border-white border-t-transparent border-solid rounded-full animate-spin mr-2"></div>
              ) : null}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProject;
