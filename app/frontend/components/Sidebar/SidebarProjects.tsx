// src/components/Sidebar/SidebarProjects.tsx

import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { FolderIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { Project } from '../../entities/Project';

interface SidebarProjectsProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
  isDarkMode: boolean;
  openProjectModal: () => void; // Add this prop
}

const SidebarProjects: React.FC<SidebarProjectsProps> = ({
  handleNavClick,
  location,
  isDarkMode,
  openProjectModal,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);

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
          className={`flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveProject(
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
              e.stopPropagation(); // Prevent triggering the parent onClick
              openProjectModal(); // Open the modal
            }}
            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
            aria-label="Add Project"
            title="Add Project"
          >
            <PlusCircleIcon className="h-5 w-5" />
          </button>
        </li>
      </ul>
    </>
  );
};

export default SidebarProjects;
