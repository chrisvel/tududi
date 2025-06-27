import { Task } from "./Task";

export interface WeeklyCompletion {
  date: string;
  count: number;
  dayName: string;
}

export interface Metrics {
  total_open_tasks: number;
  tasks_pending_over_month: number;
  tasks_in_progress_count: number;
  tasks_in_progress: Task[];
  tasks_due_today: Task[];
  today_plan_tasks?: Task[];
  suggested_tasks: Task[];
  tasks_completed_today: Task[];
  weekly_completions: WeeklyCompletion[];
}