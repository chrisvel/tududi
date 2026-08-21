import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export interface SubscribedCalendar {
    id: number;
    uid: string;
    name: string;
    url: string;
    color: string;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface SubscribedCalendarEvent {
    id: string;
    title: string;
    // Date-only (YYYY-MM-DD) when all_day is true, ISO timestamp otherwise.
    start: string;
    end: string;
    all_day: boolean;
    calendar_uid: string;
    calendar_name: string;
    color: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || 'Request failed');
    }
    return (await response.json()) as T;
}

export async function fetchSubscribedCalendars(): Promise<
    SubscribedCalendar[]
> {
    const response = await fetch(getApiPath('subscribed-calendars'), {
        credentials: 'include',
    });
    return handleResponse<SubscribedCalendar[]>(response);
}

export async function createSubscribedCalendar(payload: {
    name: string;
    url: string;
    color?: string;
}): Promise<SubscribedCalendar> {
    const response = await fetch(getApiPath('subscribed-calendars'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return handleResponse<SubscribedCalendar>(response);
}

export async function deleteSubscribedCalendar(uid: string): Promise<void> {
    const response = await fetch(getApiPath(`subscribed-calendars/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleResponse<{ success: boolean }>(response);
}

export async function fetchSubscribedEvents(
    start: Date,
    end: Date
): Promise<SubscribedCalendarEvent[]> {
    const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
    });
    const response = await fetch(
        getApiPath(`subscribed-calendars/events?${params.toString()}`),
        { credentials: 'include' }
    );
    const data = await handleResponse<{
        events: SubscribedCalendarEvent[];
    }>(response);
    return data.events || [];
}
