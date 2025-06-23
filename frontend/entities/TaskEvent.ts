export interface TaskEvent {
  id: number;
  task_id: number;
  user_id: number;
  event_type: 'created' | 'status_changed' | 'priority_changed' | 'due_date_changed' | 
              'project_changed' | 'name_changed' | 'description_changed' | 'note_changed' |
              'completed' | 'archived' | 'deleted' | 'restored' | 'today_changed' |
              'tags_changed' | 'recurrence_changed';
  old_value?: any;
  new_value?: any;
  field_name?: string;
  metadata?: {
    source?: 'web' | 'api' | 'telegram';
    action?: string;
    [key: string]: any;
  };
  created_at: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
}

export interface TaskCompletionTime {
  task_id: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  duration_hours: number;
  duration_days: number;
}

export interface TaskCompletionAnalytics {
  task_id: number;
  task_name: string;
  project_name?: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  duration_hours: number;
  duration_days: number;
}

export interface ProductivityMetrics {
  total_events: number;
  tasks_created: number;
  tasks_completed: number;
  status_changes: number;
  average_completion_time?: number;
  completion_times: TaskCompletionTime[];
}

export interface CompletionAnalyticsSummary {
  total_tasks: number;
  average_completion_hours: number;
  median_completion_hours: number;
  fastest_completion: number;
  slowest_completion: number;
}

export interface CompletionAnalyticsResponse {
  tasks: TaskCompletionAnalytics[];
  summary: CompletionAnalyticsSummary;
}

export interface TaskActivitySummary {
  event_type: string;
  count: number;
  date: string;
}