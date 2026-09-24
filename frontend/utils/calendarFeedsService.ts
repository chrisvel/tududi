import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';

export interface CalendarFeed {
    uid: string;
    name: string;
    url_host: string;
    color: string | null;
    last_fetched_at: string | null;
    last_error: string | null;
}

export interface CalendarEvent {
    uid: string;
    title: string;
    all_day: boolean;
    busy: boolean;
    start: string;
    end: string;
    start_minute: number | null;
    end_minute: number | null;
    feed_uid: string;
    feed_name: string;
    color: string | null;
}

export interface CalendarEventsResponse {
    date: string;
    events: CalendarEvent[];
    errors: { feed_uid: string; message: string }[];
}

export const fetchCalendarFeeds = async (): Promise<CalendarFeed[]> => {
    const response = await fetch(getApiPath('calendar-feeds'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to load calendars.');
    const data = await response.json();
    return data.feeds;
};

export const createCalendarFeed = async (data: {
    name: string;
    url: string;
    color?: string | null;
}): Promise<CalendarFeed> => {
    const response = await fetch(getApiPath('calendar-feeds'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Could not add that calendar.');
    const body = await response.json();
    return body.feed;
};

export const updateCalendarFeed = async (
    uid: string,
    data: { name?: string; url?: string; color?: string | null }
): Promise<CalendarFeed> => {
    const response = await fetch(
        getApiPath(`calendar-feeds/${encodeURIComponent(uid)}`),
        {
            method: 'PATCH',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify(data),
        }
    );
    await handleAuthResponse(response, 'Could not update that calendar.');
    const body = await response.json();
    return body.feed;
};

export const deleteCalendarFeed = async (uid: string): Promise<void> => {
    const response = await fetch(
        getApiPath(`calendar-feeds/${encodeURIComponent(uid)}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Could not remove that calendar.');
};

export const fetchCalendarEvents = async (
    date?: string
): Promise<CalendarEventsResponse> => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await fetch(getApiPath(`calendar-feeds/events${query}`), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to load calendar events.');
    return response.json();
};
