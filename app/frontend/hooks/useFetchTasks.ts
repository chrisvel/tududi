import { useState, useEffect } from 'react';
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

const useFetchTasks = (options?: UseFetchTasksOptions): UseFetchTasksResult => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const fetchTasks = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      let url = '/api/tasks';
      const params = new URLSearchParams();

      if (options?.type) {
        params.append('type', options.type);
      }
      if (options?.tag) {
        params.append('tag', options.tag);
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
        setTasks(data.tasks || []);
        setMetrics(data.metrics || initialMetrics);
      } else {
        throw new Error('Failed to fetch tasks.');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [options?.type, options?.tag]);

  return { tasks, metrics, isLoading, isError, mutate: fetchTasks };
};

export default useFetchTasks;
