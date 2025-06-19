import { Tag } from "./Tag";

export interface Task {
  id?: number;
  name: string;
  status: StatusType;
  priority?: PriorityType;
  due_date?: string;
  note?: string;
  tags?: Tag[];
  project_id?: number;
  created_at?: string;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  recurrence_weekday?: number;
  recurrence_month_day?: number;
  recurrence_week_of_month?: number;
  completion_based?: boolean;
  recurring_parent_id?: number;
}

export type StatusType = 'not_started' | 'in_progress' | 'done' | 'archived';
export type PriorityType = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'monthly_weekday' | 'monthly_last_day';
