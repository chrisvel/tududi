import { 
  TaskEvent, 
  TaskCompletionTime, 
  ProductivityMetrics, 
  CompletionAnalyticsResponse,
  TaskActivitySummary 
} from '../entities/TaskEvent';

const API_BASE = '/api';

/**
 * Get task timeline (all events for a specific task)
 */
export const getTaskTimeline = async (taskId: number): Promise<TaskEvent[]> => {
  const response = await fetch(`${API_BASE}/task/${taskId}/timeline`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch task timeline: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get task completion time analytics
 */
export const getTaskCompletionTime = async (taskId: number): Promise<TaskCompletionTime | null> => {
  const response = await fetch(`${API_BASE}/task/${taskId}/completion-time`, {
    credentials: 'include'
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch task completion time: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get user productivity metrics
 */
export const getUserProductivityMetrics = async (
  startDate?: string, 
  endDate?: string
): Promise<ProductivityMetrics> => {
  const params = new URLSearchParams();
  
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`${API_BASE}/user/productivity-metrics?${params}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch productivity metrics: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get user activity summary
 */
export const getUserActivitySummary = async (
  startDate: string, 
  endDate: string
): Promise<TaskActivitySummary[]> => {
  const params = new URLSearchParams({
    startDate,
    endDate
  });

  const response = await fetch(`${API_BASE}/user/activity-summary?${params}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activity summary: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get completion analytics for multiple tasks
 */
export const getCompletionAnalytics = async (
  options: {
    limit?: number;
    offset?: number;
    projectId?: number;
  } = {}
): Promise<CompletionAnalyticsResponse> => {
  const params = new URLSearchParams();
  
  if (options.limit) params.append('limit', options.limit.toString());
  if (options.offset) params.append('offset', options.offset.toString());
  if (options.projectId) params.append('projectId', options.projectId.toString());

  const response = await fetch(`${API_BASE}/tasks/completion-analytics?${params}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch completion analytics: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Format duration for display
 */
export const formatDuration = (hours: number): string => {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    const days = Math.floor(hours / 24);
    const h = Math.floor(hours % 24);
    return h > 0 ? `${days}d ${h}h` : `${days}d`;
  }
};

/**
 * Get human-readable event type
 */
export const getEventTypeLabel = (eventType: string): string => {
  const labels: Record<string, string> = {
    'created': 'Created',
    'status_changed': 'Status Changed',
    'priority_changed': 'Priority Changed',
    'due_date_changed': 'Due Date Changed',
    'project_changed': 'Project Changed',
    'name_changed': 'Name Changed',
    'description_changed': 'Description Changed',
    'note_changed': 'Note Changed',
    'completed': 'Completed',
    'archived': 'Archived',
    'deleted': 'Deleted',
    'restored': 'Restored',
    'today_changed': 'Today Flag Changed',
    'tags_changed': 'Tags Changed',
    'recurrence_changed': 'Recurrence Changed'
  };

  return labels[eventType] || eventType;
};

/**
 * Get human-readable status value
 */
export const getStatusLabel = (status: number): string => {
  const statusLabels: Record<number, string> = {
    0: 'Not Started',
    1: 'In Progress',
    2: 'Done',
    3: 'Archived',
    4: 'Waiting'
  };

  return statusLabels[status] || `Status ${status}`;
};

/**
 * Get human-readable priority value
 */
export const getPriorityLabel = (priority: number): string => {
  const priorityLabels: Record<number, string> = {
    0: 'Low',
    1: 'Medium',
    2: 'High'
  };

  return priorityLabels[priority] || `Priority ${priority}`;
};