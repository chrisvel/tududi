// Projects.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '../entities/Project';

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const navigate = useNavigate();

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

  const handleProjectClick = (projectId: number) => {
    navigate(`/project/${projectId}`);
  };

  return (
    <div>
      <h2 className="text-2xl mb-4">Projects</h2>
      <ul>
        {projects.map((project) => (
          <li
            key={project.id}
            className="cursor-pointer mb-2 p-4 bg-white rounded shadow hover:shadow-md"
            onClick={() => handleProjectClick(project.id)}
          >
            <h3 className="text-xl font-semibold">{project.name}</h3>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Projects;
