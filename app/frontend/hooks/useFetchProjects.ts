import useSWR from 'swr';
import { Project } from '../entities/Project';
import { fetcher } from '../utils/fetcher';

interface ProjectsAPIResponse {
  projects: Project[];
  task_status_counts: Record<number, any>;
}

import { useMemo } from 'react';

const useFetchProjects = (activeFilter: string, areaFilter: string) => {
  const url = useMemo(() => {
    const queryParams = new URLSearchParams();

    if (activeFilter !== 'all') queryParams.append('active', activeFilter);
    if (areaFilter) queryParams.append('area_id', areaFilter);

    return `/api/projects?${queryParams.toString()}`;
  }, [activeFilter, areaFilter]);

  const { data, error, mutate } = useSWR<ProjectsAPIResponse>(url, fetcher);

  return {
    projects: data?.projects || [],
    taskStatusCounts: data?.task_status_counts || {},
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
};

export default useFetchProjects;
