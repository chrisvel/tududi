import { getApiPath } from '../config/paths';
import { getDefaultHeaders, handleAuthResponse } from './authUtils';

export interface CalendarEvent {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    description?: string;
    location?: string;
}

export const fetchTodayEvents = async (): Promise<CalendarEvent[]> => {
    const response = await fetch(getApiPath('calendar/events?type=today'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch calendar events.');
    const result = await response.json();
    return result.events || [];
};

export const fetchUpcomingEvents = async (): Promise<CalendarEvent[]> => {
    const response = await fetch(
        getApiPath('calendar/events?type=upcoming&maxDays=7'),
        {
            credentials: 'include',
            headers: getDefaultHeaders(),
        }
    );

    await handleAuthResponse(response, 'Failed to fetch upcoming events.');
    const result = await response.json();
    return result.events || [];
};

export const syncIfStale = async (): Promise<{ triggered: boolean }> => {
    const response = await fetch(getApiPath('calendar/sync-if-stale'), {
        method: 'POST',
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to check calendar sync status.');
    return await response.json();
};
