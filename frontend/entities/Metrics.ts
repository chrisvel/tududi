export interface WeeklyCompletion {
    date: string;
    count: number;
    dayName: string;
}

export interface Metrics {
    total_open_tasks: number;
    tasks_pending_over_month: number;
    tasks_in_progress_count: number;
    tasks_due_today_count: number;
    today_plan_tasks_count: number;
    suggested_tasks_count: number;
    tasks_completed_today_count: number;
    weekly_completions: WeeklyCompletion[];
}
