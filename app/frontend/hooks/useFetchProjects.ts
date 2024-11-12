// app/frontend/hooks/useFetchProjects.ts

import { useState, useEffect } from 'react';
import { Project } from '../entities/Project';

interface UseFetchProjectsOptions {
  activeFilter?: string;
  areaFilter?: string;
}

interface UseFetchProjectsResult {
  projects: Project[];
  taskStatusCounts?: any;
  isLoading: boolean;
  isError: boolean;
  mutate: () => void;
}

const useFetchProjects = (options?: UseFetchProjectsOptions): UseFetchProjectsResult => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskStatusCounts, setTaskStatusCounts] = useState<any>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const fetchProjects = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      let url = '/api/projects';
      const params = new URLSearchParams();

      if (options?.activeFilter !== undefined) {
        params.append('active', String(options.activeFilter));
      }
      if (options?.areaFilter !== undefined) {
        params.append('area', options.areaFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.projects) {
          setProjects(data.projects);
          setTaskStatusCounts(data.taskStatusCounts);
        } else {
          setProjects(data);
          setTaskStatusCounts(undefined);
        }
      } else {
        throw new Error('Failed to fetch projects.');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [options?.activeFilter, options?.areaFilter]);

  return { projects, taskStatusCounts, isLoading, isError, mutate: fetchProjects };
};

export default useFetchProjects;
