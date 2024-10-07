// src/components/Sidebar/SidebarProjects.tsx

import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { FolderIcon, PlusCircleIcon } from '@heroicons/react/24/solid';

interface Project {
  id: number;
  name: string;
  active: boolean;
  pin_to_sidebar: boolean; // Include the new attribute
  // Add other project properties if needed
}

interface SidebarProjectsProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
}

const SidebarProjects: React.FC<SidebarProjectsProps> = ({
  handleNavClick,
  location,
  isDarkMode,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [pinToSidebar, setPinToSidebar] = useState(false); // New state for pinning

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects?pin_to_sidebar=true'); // Fetch only pinned projects
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

  const startProjectCreation = () => {
    setIsCreatingProject(true);
  };

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewProjectName(e.target.value);
  };

  const handlePinToSidebarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPinToSidebar(e.target.checked);
  };

  const handleProjectCreation = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newProjectName.trim()) {
      try {
        const response = await fetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newProjectName, pin_to_sidebar: pinToSidebar }),
        });

        if (response.ok) {
          const newProject = await response.json();
          setProjects((prevProjects) => [...prevProjects, newProject]);
          setNewProjectName('');
          setPinToSidebar(false);
          setIsCreatingProject(false);
        } else {
          const errorData = await response.json();
          console.error('Failed to create project:', errorData.error);
        }
      } catch (error) {
        console.error('Error creating project:', error);
      }
    }
  };

  const isActiveProject = (path: string) => {
    return location.pathname === path
      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
      : 'text-gray-700 dark:text-gray-300';
  };

  return (
    <>
      <ul className="flex flex-col space-y-1 mt-4">
        {/* "PROJECTS" Title with Add Button */}
        <li
          className={`flex justify-between items-center px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveProject(
            '/projects'
          )}`}
          onClick={() => handleNavClick('/projects', 'Projects', 'folder')}
        >
          <span className="flex items-center">
            <FolderIcon className="h-5 w-5 mr-2" />
            PROJECTS
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startProjectCreation();
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Project"
            title="Add Project"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>

        {/* Input for New Project Creation */}
        {isCreatingProject && (
          <li className="px-4 py-1">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newProjectName}
                onChange={handleProjectNameChange}
                onKeyDown={handleProjectCreation}
                placeholder="New project name"
                autoFocus
                className="w-full px-2 py-1 text-gray-900 bg-white dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="flex items-center space-x-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={pinToSidebar}
                  onChange={handlePinToSidebarChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span>Pin</span>
              </label>
            </div>
          </li>
        )}

        {/* List of Projects */}
        {projects.map((project) => (
          <li key={project.id}>
            <button
              onClick={() =>
                handleNavClick(`/project/${project.id}`, project.name, 'folder')
              }
              className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${isActiveProject(
                `/project/${project.id}`
              )}`}
            >
              <FolderIcon className="h-5 w-5 mr-2 text-blue-500" />
              {project.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

export default SidebarProjects;
