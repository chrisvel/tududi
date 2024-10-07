// src/components/Projects.tsx

import React, { useEffect, useState } from 'react';
import { Project } from './entities/Project';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { ClockIcon } from '@heroicons/react/24/outline'; // Imported ClockIcon from outline style

interface Area {
  id: number;
  name: string;
}

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [areas, setAreas] = useState<Area[]>([]); // State for areas
  const [taskStatusCounts, setTaskStatusCounts] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [activeFilter, setActiveFilter] = useState<string>('true'); // Preselected to 'Active'
  const [areaFilter, setAreaFilter] = useState<string>(''); // area_id as string

  const navigate = useNavigate();

  // Fetch areas on component mount
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas', {
          method: 'GET',
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch areas.');
        }

        const data: Area[] = await response.json();
        setAreas(data);
      } catch (err) {
        console.error('Error fetching areas:', err);
        setError((err as Error).message);
      }
    };

    fetchAreas();
  }, []);

  // Fetch projects whenever filters change
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (activeFilter !== 'all') {
          params.append('active', activeFilter);
        }
        if (areaFilter) {
          params.append('area_id', areaFilter);
        }

        const response = await fetch(`/api/projects?${params.toString()}`, {
          method: 'GET',
          credentials: 'include', // Include cookies for authentication
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch projects.');
        }

        const data = await response.json();
        setProjects(data.projects);
        setTaskStatusCounts(data.task_status_counts);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [activeFilter, areaFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
          Loading projects...
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

  // Function to group projects by area name
  const groupProjectsByArea = (projects: Project[]) => {
    return projects.reduce<Record<string, Project[]>>((acc, project) => {
      const areaName = project.area ? project.area.name : 'Uncategorized';
      if (!acc[areaName]) {
        acc[areaName] = [];
      }
      acc[areaName].push(project);
      return acc;
    }, {});
  };

  const groupedProjects = groupProjectsByArea(projects);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Filters Section */}
      <div className="flex flex-col md:flex-row md:items-center md:space-x-4 mb-6">
        {/* Active Status Filter */}
        <div className="mb-4 md:mb-0 w-full md:w-1/3">
          <label htmlFor="activeFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            id="activeFilter"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* Area Filter */}
        <div className="w-full md:w-1/3">
          <label htmlFor="areaFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Area
          </label>
          <select
            id="areaFilter"
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="block w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Areas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Listing */}
      <div className="space-y-8">
        {Object.keys(groupedProjects).map((areaName) => (
          <div key={areaName} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{areaName}</h3>
            <ul className="space-y-4">
              {groupedProjects[areaName].map((project) => (
                <li key={project.id} className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    {/* Project Info and Status */}
                    <div className="flex flex-col md:flex-row md:items-center">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mr-4">
                        {project.active ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-500" aria-hidden="true" />
                        ) : (
                          <XCircleIcon className="h-6 w-6 text-red-500" aria-hidden="true" />
                        )}
                      </div>
                      {/* Project Details */}
                      <div>
                        <a
                          href={`/project/${project.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-lg font-medium"
                        >
                          {project.name}
                        </a>
                        {project.description && (
                          <p className="text-gray-600 dark:text-gray-400">{project.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 mt-4 md:mt-0">
                      {/* Edit Project Button */}
                      <button
                        onClick={() => navigate(`/project/${project.id}/edit`)}
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                        aria-label={`Edit ${project.name}`}
                        title={`Edit ${project.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-7l4 4m0 0l4-4m-4 4V3" />
                        </svg>
                      </button>

                      {/* Delete Project Button (Disabled) */}
                      <button
                        disabled
                        className="text-red-500 dark:text-red-300 opacity-50 cursor-not-allowed focus:outline-none"
                        aria-label={`Delete ${project.name}`}
                        title={`Delete ${project.name} (Disabled)`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Task Status Counts */}
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-1" aria-hidden="true" />
                      {`Completed: ${taskStatusCounts[project.id]?.done || 0}`}
                    </span>
                    <span className="inline-flex items-center ml-4">
                      <XCircleIcon className="h-4 w-4 text-red-500 mr-1" aria-hidden="true" />
                      {`Not Started: ${taskStatusCounts[project.id]?.not_started || 0}`}
                    </span>
                    <span className="inline-flex items-center ml-4">
                      <ClockIcon className="h-4 w-4 text-yellow-500 mr-1" aria-hidden="true" />
                      {`In Progress: ${taskStatusCounts[project.id]?.in_progress || 0}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Projects;
