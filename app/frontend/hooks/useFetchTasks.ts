import useSWR from 'swr';
import { Task } from '../entities/Task';

interface UseFetchTasksOptions {
  type?: string;
  tag?: string;
}

interface Metrics {
  total_open_tasks: number;
  tasks_pending_over_month: number;
  tasks_in_progress_count: number;
  tasks_in_progress: Task[];
  tasks_due_today: Task[];
  suggested_tasks: Task[];
}

interface UseFetchTasksResult {
  tasks: Task[];
  metrics: Metrics;
  isLoading: boolean;
  isError: boolean;
  mutate: () => void;
}

const initialMetrics: Metrics = {
  total_open_tasks: 0,
  tasks_pending_over_month: 0,
  tasks_in_progress_count: 0,
  tasks_in_progress: [],
  tasks_due_today: [],
  suggested_tasks: [],
};

const fetcher = (url: string) =>
  fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }).then((res) => {
    if (!res.ok) {
      throw new Error('Failed to fetch tasks.');
    }
    return res.json();
  });

const useFetchTasks = (options?: UseFetchTasksOptions): UseFetchTasksResult => {
  const params = new URLSearchParams();

  if (options?.type) {
    params.append('type', options.type);
  }
  if (options?.tag) {
    params.append('tag', options.tag);
  }

  const queryString = params.toString();
  const url = `/api/tasks${queryString ? `?${queryString}` : ''}`;
  const { data, error, mutate } = useSWR(url, fetcher);

  return {
    tasks: data?.tasks || [],
    metrics: data?.metrics || initialMetrics,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export default useFetchTasks;
