import { Tag } from './Tag';
import { Project } from './Project';
import { Area } from './Area';
import { Attachment } from './Attachment';
import { Person } from './Person';

export type TaskRelationType =
    'blocks' | 'blocked_by' | 'related_to' | 'duplicates' | 'duplicated_by';

export interface TaskRelation {
    uid: string;
    type: TaskRelationType;
    task: { uid: string; name: string; status: StatusType | number };
}

export type HabitPeriod = 'daily' | 'weekly' | 'monthly' | 'interval';
export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening';

// Progress in the habit's current period, computed by the server in the
// user's timezone.
export interface HabitProgress {
    period_start: string;
    period_end: string;
    today: string;
    first_day: string;
    progress: number;
    check_ins: number;
    today_check_ins: number;
    goal: number;
    met: boolean;
    skipped: boolean;
    scheduled_today: boolean;
    multiple_per_day: boolean;
}

export interface Task {
    id?: number;
    uid?: string;
    name: string;
    original_name?: string;
    status: StatusType | number;
    priority?: PriorityType | number;
    due_date?: string;
    defer_until?: string;
    reminder_at?: string;
    estimated_minutes?: number | null;
    note?: string;
    tags?: Tag[];
    project_id?: number;
    project_uid?: string;
    Project?: Project;
    area_id?: number;
    area_uid?: string;
    Area?: Area;
    goal_id?: number | null;
    goal_uid?: string | null;
    created_at?: string;
    updated_at?: string;
    recurrence_type?: RecurrenceType;
    recurrence_interval?: number;
    recurrence_end_date?: string;
    recurrence_weekday?: number;
    recurrence_weekdays?: number[];
    recurrence_month_day?: number;
    recurrence_week_of_month?: number;
    completion_based?: boolean;
    recurring_parent_id?: number;
    recurring_parent_uid?: string;
    is_virtual_occurrence?: boolean;
    virtual_id?: string;
    occurrence_index?: number;
    completed_at: string | null;
    parent_task_id?: number;
    parent_task?: { id: number; uid: string; name: string } | null;
    subtasks?: Task[];
    parent_child_logic_executed?: boolean;
    attachments?: Attachment[];
    comments_count?: number;
    is_blocked?: boolean;
    blocked_by_count?: number;
    habit_mode?: boolean;
    habit_target_count?: number;
    habit_frequency_period?: HabitPeriod;
    habit_streak_mode?: 'calendar' | 'scheduled';
    habit_flexibility_mode?: 'strict' | 'flexible';
    habit_current_streak?: number;
    habit_best_streak?: number;
    habit_total_completions?: number;
    habit_last_completion_at?: string;
    habit_polarity?: 'build' | 'quit';
    habit_unit?: string | null;
    habit_target_value?: number | null;
    habit_schedule_days?: number[] | null;
    habit_interval_days?: number | null;
    habit_time_of_day?: HabitTimeOfDay | null;
    habit_reminder_time?: string | null;
    habit_strength?: number;
    habit_color?: string | null;
    habit_progress?: HabitProgress;
    habit_archived?: boolean;
    assigned_to?: string | null;
    AssignedTo?: Person | null;
    involves?: string[];
    // Transient UI field set by suggestion scoring - never persisted or sent to server
    _suggestionMeta?: {
        score: number;
        reason:
            | 'area_balance'
            | 'due'
            | 'goal'
            | 'fits_now'
            | 'revive'
            | 'high'
            | 'aging_review'
            | 'next_step';
        reasonLabel: string;
        reasonColor: string;
    };
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
