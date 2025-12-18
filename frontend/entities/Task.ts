import { Tag } from './Tag';
import { Project } from './Project';
import { Attachment } from './Attachment';

export interface Task {
    id?: number;
    uid?: string;
    name: string;
    original_name?: string;
    status: StatusType | number;
    priority?: PriorityType | number;
    due_date?: string;
    defer_until?: string;
    note?: string;
    today?: boolean;
    today_move_count?: number;
    tags?: Tag[];
    project_id?: number; // Deprecated, use project_uid
    project_uid?: string; // Foreign key for project by uid
    Project?: Project;
    created_at?: string;
    updated_at?: string;
    recurrence_type?: RecurrenceType;
    recurrence_interval?: number;
    recurrence_end_date?: string;
    recurrence_weekday?: number;
    recurrence_weekdays?: number[]; // Array of weekday numbers for weekly recurrence
    recurrence_month_day?: number;
    recurrence_week_of_month?: number;
    completion_based?: boolean;
    recurring_parent_id?: number;
    recurring_parent_uid?: string;
    last_generated_date?: string;
    completed_at: string | null;
    parent_task_id?: number;
    subtasks?: Task[];
    Subtasks?: Task[]; // Handle API response case sensitivity (temporary)
    parent_child_logic_executed?: boolean; // Flag indicating if parent-child logic was executed during toggle
    attachments?: Attachment[];
    // Habit fields
    habit_mode?: boolean;
    habit_target_count?: number;
    habit_frequency_period?: 'daily' | 'weekly' | 'monthly';
    habit_streak_mode?: 'calendar' | 'scheduled';
    habit_flexibility_mode?: 'strict' | 'flexible';
    habit_current_streak?: number;
    habit_best_streak?: number;
    habit_total_completions?: number;
    habit_last_completion_at?: string;
}

export type StatusType =
    | 'not_started'
    | 'in_progress'
    | 'done'
    | 'archived'
    | 'waiting'
    | 'cancelled'
    | 'planned';
export type PriorityType = 'low' | 'medium' | 'high' | null | undefined;
export type RecurrenceType =
    | 'none'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'monthly_weekday'
    | 'monthly_last_day';
