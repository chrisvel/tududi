// Life-to-Day (Phase 5): capacity, Focus sessions, Recovery and the daily
// contribution report. Deterministic server logic; this only calls it.
import { request } from './planningService';

export interface WorkHours {
    start: number;
    end: number;
}
export interface Capacity {
    date: string;
    window: WorkHours;
    busy_minutes: number;
    buffer_minutes: number;
    capacity_minutes: number;
    planned_minutes: number;
    factor: number;
    load: number | null;
    unrealistic: boolean;
    move_suggestions: string[];
    event_overlaps: string[];
    missing_buffer: string[];
}
export interface FocusSession {
    uid: string;
    task_uid: string | null;
    task_name: string | null;
    starter_step: string | null;
    started_at: string;
    ended_at: string | null;
    planned_minutes: number;
    actual_minutes: number | null;
    interrupted: boolean;
    resume_note: string | null;
}
export interface RecoveryResult {
    journal_uid: string | null;
    date: string;
    moved_to: string;
    moved: string[];
    kept: string[];
    capacity_rest_minutes: number;
}
export interface ContributionGoal {
    goal_uid: string;
    title: string;
    horizon: string;
    chain: { uid: string; title: string; horizon: string }[];
    minutes: number;
    tasks: number;
}
export interface Contribution {
    date: string;
    goals: ContributionGoal[];
    unaligned_minutes: number;
}
export interface Overwhelmed {
    on: boolean;
    until: string | null;
}

export const fetchCapacity = (date?: string) =>
    request<Capacity>(
        `planner/capacity${date ? `?date=${encodeURIComponent(date)}` : ''}`
    );
export const fetchWorkHours = () => request<WorkHours>('planner/work-hours');
export const saveWorkHours = (hours: WorkHours) =>
    request<WorkHours>('planner/work-hours', 'PUT', hours);
export const lightenDay = (date?: string) =>
    request<RecoveryResult>('planner/recovery', 'POST', date ? { date } : {});
export const fetchOverwhelmed = () =>
    request<Overwhelmed>('planner/overwhelmed');
export const saveOverwhelmed = (on: boolean) =>
    request<Overwhelmed>('planner/overwhelmed', 'PUT', { on });
export const fetchContribution = () =>
    request<Contribution>('planner/contribution');

export const fetchCurrentFocus = async () =>
    (await request<{ session: FocusSession | null }>('focus-sessions/current'))
        .session;
export const startFocus = async (taskUid: string, plannedMinutes = 25) =>
    (
        await request<{ session: FocusSession }>('focus-sessions', 'POST', {
            task_uid: taskUid,
            planned_minutes: plannedMinutes,
        })
    ).session;
export const endFocus = async (
    uid: string,
    body: { interrupted?: boolean; resume_note?: string } = {}
) =>
    (
        await request<{ session: FocusSession }>(
            `focus-sessions/${uid}/end`,
            'POST',
            body
        )
    ).session;
export const resumeFocus = async (uid: string) =>
    (
        await request<{ session: FocusSession }>(
            `focus-sessions/${uid}/resume`,
            'POST',
            {}
        )
    ).session;
