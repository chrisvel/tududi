// SidebarProjects.tsx
import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { Project } from '../../entities/Project';

interface SidebarProjectsProps {
  handleNavClick: (path: string, title: string, icon: string) => void;
  location: Location;
}

const SidebarProjects: React.FC<SidebarProjectsProps> = ({ handleNavClick, location }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
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

  const handleProjectCreation = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newProjectName.trim()) {
      try {
        const response = await fetch('/api/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newProjectName }),
        });

        if (response.ok) {
          const newProject = await response.json();
          setProjects((prevProjects) => [...prevProjects, newProject]);
          setNewProjectName('');
          setIsCreatingProject(false);
        } else {
          console.error('Failed to create project');
        }
      } catch (error) {
        console.error('Error creating project:', error);
      }
    }
  };

  return (
    <>
      <ul className="flex flex-col space-y-1">
        <li className="flex justify-between items-center px-4 py-2 text-gray-300 uppercase text-xs tracking-wider">
          <span>Projects</span>
          <button
            onClick={startProjectCreation}
            className="text-gray-300 hover:text-white focus:outline-none"
          >
            <i className="bi bi-plus-circle-fill"></i>
          </button>
        </li>

        {isCreatingProject && (
          <li className="px-4 py-1">
            <input
              type="text"
              value={newProjectName}
              onChange={handleProjectNameChange}
              onKeyDown={handleProjectCreation}
              placeholder="New project name"
              autoFocus
              className="w-full px-2 py-1 text-gray-800 bg-white rounded-lg"
            />
          </li>
        )}

        {projects.map((project) => (
          <li key={project.id}>
            <button
              onClick={() => handleNavClick(`/project/${project.id}`, project.name, 'bi-folder-fill')}
              className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-700 transition-all duration-200 ${
                location.pathname === `/project/${project.id}`
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300'
              }`}
            >
              <i className="bi bi-folder-fill mr-2"></i>
              {project.name}
            </button>
          </li>
        ))}

        <li className="border-t border-gray-700 my-2"></li>
      </ul>
    </>
  );
};

export default SidebarProjects;
