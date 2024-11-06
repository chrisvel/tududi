import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { Project } from '../entities/Project';

const useManageProjects = () => {
  const { mutate } = useSWRConfig();

  const createProject = useCallback(async (projectData: Partial<Project>) => {
    try {
      const response = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create project.');
      }
      const newProject: Project = await response.json();
      mutate('/api/projects', (current: Project[] = []) => [...current, newProject], false);
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }, [mutate]);

  const updateProject = useCallback(async (projectId: number, projectData: Partial<Project>) => {
    try {
      const response = await fetch(`/api/project/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update project.');
      }
      const updatedProject: Project = await response.json();
      mutate('/api/projects', (current: Project[] = []) =>
        current.map((project) => (project.id === projectId ? updatedProject : project)), false);
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }, [mutate]);

  const deleteProject = useCallback(async (projectId: number) => {
    try {
      const response = await fetch(`/api/project/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project.');
      }
      mutate('/api/projects', (current: Project[] = []) =>
        current.filter((project) => project.id !== projectId), false);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }, [mutate]);

  return { createProject, updateProject, deleteProject };
};

export default useManageProjects;
