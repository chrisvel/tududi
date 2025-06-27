import { Tag } from "./Tag";
import { Project } from "./Project";

export interface Task {
  id?: number;
  uuid?: string;
  name: string;
  status: StatusType | number;
  priority?: PriorityType | number;
  due_date?: string;
  note?: string;
  today?: boolean;
  today_move_count?: number;
  tags?: Tag[];
  project_id?: number;
  Project?: Project;
  created_at?: string;
  updated_at?: string;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_end_date?: string;
  recurrence_weekday?: number;
  recurrence_month_day?: number;
  recurrence_week_of_month?: number;
  completion_based?: boolean;
  recurring_parent_id?: number;
  completed_at?: string;
}

export type StatusType = 'not_started' | 'in_progress' | 'done' | 'archived';
export type PriorityType = 'low' | 'medium' | 'high';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'monthly_weekday' | 'monthly_last_day';
