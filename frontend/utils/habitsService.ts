import { getApiPath } from '../config/paths';
import { Task } from '../entities/Task';

export interface HabitCompletion {
    id: number;
    task_id: number;
    completed_at: string;
    original_due_date: string;
    skipped: boolean;
    created_at: string;
    updated_at: string;
}

export async function fetchHabits(): Promise<Task[]> {
    const response = await fetch(getApiPath('habits'), {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch habits');
    const data = await response.json();
    return data.habits;
}

export async function createHabit(habitData: Partial<Task>): Promise<Task> {
    const response = await fetch(getApiPath('habits'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(habitData),
    });
    if (!response.ok) throw new Error('Failed to create habit');
    const data = await response.json();
    return data.habit;
}

export async function logHabitCompletion(habitUid: string, completedAt?: Date) {
    const response = await fetch(getApiPath(`habits/${habitUid}/complete`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            completed_at: completedAt?.toISOString(),
        }),
    });
    if (!response.ok) throw new Error('Failed to log completion');
    return response.json();
}

export async function fetchHabitStats(
    habitUid: string,
    startDate?: Date,
    endDate?: Date
) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate.toISOString());
    if (endDate) params.append('end_date', endDate.toISOString());

    const response = await fetch(
        getApiPath(`habits/${habitUid}/stats?${params}`),
        {
            credentials: 'include',
        }
    );
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
}

export async function updateHabit(
    habitUid: string,
    updates: Partial<Task>
): Promise<Task> {
    const response = await fetch(getApiPath(`habits/${habitUid}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update habit');
    const data = await response.json();
    return data.habit;
}

export async function deleteHabit(habitUid: string): Promise<void> {
    const response = await fetch(getApiPath(`habits/${habitUid}`), {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to delete habit');
}

export async function fetchHabitCompletions(
    habitUid: string,
    startDate?: Date,
    endDate?: Date
): Promise<HabitCompletion[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate.toISOString());
    if (endDate) params.append('end_date', endDate.toISOString());

    const response = await fetch(
        getApiPath(`habits/${habitUid}/completions?${params}`),
        {
            credentials: 'include',
        }
    );
    if (!response.ok) throw new Error('Failed to fetch completions');
    const data = await response.json();
    return data.completions;
}

export async function deleteHabitCompletion(
    habitUid: string,
    completionId: number
): Promise<{ task: Task }> {
    const response = await fetch(
        getApiPath(`habits/${habitUid}/completions/${completionId}`),
        {
            method: 'DELETE',
            credentials: 'include',
        }
    );
    if (!response.ok) throw new Error('Failed to delete completion');
    return response.json();
}
