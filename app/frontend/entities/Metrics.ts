import { Task } from "./Task";

export interface Metrics {
  total_open_tasks: number;
  tasks_pending_over_month: number;
  tasks_in_progress_count: number;
  tasks_in_progress: Task[];
  tasks_due_today: Task[];
  suggested_tasks: Task[];
}