import { getApiPath } from '../config/paths';
import { Task } from '../entities/Task';
import { getCsrfToken } from './csrfService';

export interface HabitCompletion {
    id: number;
    task_id: number;
    completed_at: string;
    original_due_date: string;
    skipped: boolean;
    value?: number | null;
    note?: string | null;
}

export interface CheckInOptions {
    value?: number;
    note?: string;
}

async function errorMessage(response: Response, fallback: string) {
    try {
        const data = await response.json();
        return data.error || data.message || fallback;
    } catch {
        return fallback;
    }
}

async function send(path: string, method: string, body?: unknown) {
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(
            await errorMessage(response, `Failed: ${method} ${path}`)
        );
    }
    return response.json();
}

export async function fetchHabits(archived = false): Promise<Task[]> {
    const response = await fetch(
        getApiPath(archived ? 'habits?archived=true' : 'habits'),
        { credentials: 'include' }
    );
    if (!response.ok) throw new Error('Failed to fetch habits');
    const data = await response.json();
    return data.habits;
}

export async function fetchHabit(habitUid: string): Promise<Task> {
    const response = await fetch(getApiPath(`habits/${habitUid}`), {
        credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch habit');
    const data = await response.json();
    return data.habit;
}

export async function skipHabitDay(
    habitUid: string,
    date?: Date
): Promise<{ completion: HabitCompletion; task: Task }> {
    return send(`habits/${habitUid}/skip`, 'POST', {
        date: date?.toISOString(),
    });
}

export async function updateHabitCompletion(
    habitUid: string,
    completionId: number,
    updates: CheckInOptions
): Promise<{ completion: HabitCompletion; task: Task }> {
    return send(
        `habits/${habitUid}/completions/${completionId}`,
        'PATCH',
        updates
    );
}

export async function setHabitArchived(
    habitUid: string,
    archived: boolean
): Promise<Task> {
    const data = await send(
        `habits/${habitUid}/${archived ? 'archive' : 'unarchive'}`,
        'POST'
    );
    return data.habit;
}

export async function createHabit(habitData: Partial<Task>): Promise<Task> {
    const data = await send('habits', 'POST', habitData);
    return data.habit;
}

export async function logHabitCompletion(
    habitUid: string,
    completedAt?: Date,
    options: CheckInOptions = {}
): Promise<{ completion: HabitCompletion; task: Task }> {
    return send(`habits/${habitUid}/complete`, 'POST', {
        completed_at: completedAt?.toISOString(),
        ...options,
    });
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
    const data = await send(`habits/${habitUid}`, 'PUT', updates);
    return data.habit;
}

export async function deleteHabit(habitUid: string): Promise<void> {
    const response = await fetch(getApiPath(`habits/${habitUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
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
            headers: {
                'x-csrf-token': await getCsrfToken(),
            },
        }
    );
    if (!response.ok) throw new Error('Failed to delete completion');
    return response.json();
}
