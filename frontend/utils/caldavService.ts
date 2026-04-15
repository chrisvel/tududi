import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export interface CalDAVCalendar {
    id: number;
    uid: string;
    user_id: number;
    name: string;
    description: string | null;
    color: string | null;
    ctag: string | null;
    sync_token: string | null;
    enabled: boolean;
    sync_direction: 'bidirectional' | 'pull' | 'push';
    sync_interval_minutes: number;
    last_sync_at: string | null;
    last_sync_status: string | null;
    conflict_resolution: 'last_write_wins' | 'local_wins' | 'remote_wins' | 'manual';
    created_at: string;
    updated_at: string;
    stats?: {
        total: number;
        synced: number;
        conflicts: number;
        pending: number;
    };
}

export interface RemoteCalendar {
    id: number;
    user_id: number;
    local_calendar_id: number;
    name: string;
    server_url: string;
    calendar_path: string;
    username: string;
    auth_type: 'basic' | 'bearer';
    enabled: boolean;
    sync_direction: 'bidirectional' | 'pull' | 'push';
    server_ctag: string | null;
    server_sync_token: string | null;
    last_sync_at: string | null;
    last_sync_status: string | null;
    last_sync_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface SyncStatus {
    calendarId: number;
    enabled: boolean;
    last_sync_at: string | null;
    last_sync_status: string | null;
    sync_direction: string;
    sync_interval_minutes: number;
    conflicts: number;
    conflictDetails: any[];
}

export interface SyncResult {
    success: boolean;
    calendarId: number;
    userId: number;
    direction: string;
    dryRun: boolean;
    startTime: string;
    endTime: string;
    duration: string;
    stats: {
        pulled: number;
        pushed: number;
        conflicts: number;
        errors: number;
    };
    phases: {
        pull?: any;
        merge?: any;
        push?: any;
    };
}

export interface ConflictDetail {
    id: number;
    task_id: number;
    calendar_id: number;
    sync_status: string;
    conflict_local_version: any;
    conflict_remote_version: any;
    conflict_detected_at: string;
}

export const fetchCalendars = async (): Promise<CalDAVCalendar[]> => {
    const response = await fetch(getApiPath('/caldav/calendars'), {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch calendars');
    }
    return response.json();
};

export const fetchCalendar = async (id: number): Promise<CalDAVCalendar> => {
    const response = await fetch(getApiPath(`/caldav/calendars/${id}`), {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch calendar');
    }
    return response.json();
};

export const createCalendar = async (data: {
    name: string;
    description?: string;
    color?: string;
    enabled?: boolean;
    sync_direction?: string;
    sync_interval_minutes?: number;
    conflict_resolution?: string;
}): Promise<CalDAVCalendar> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath('/caldav/calendars'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create calendar');
    }
    return response.json();
};

export const updateCalendar = async (
    id: number,
    data: Partial<Omit<CalDAVCalendar, 'id' | 'uid' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<CalDAVCalendar> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath(`/caldav/calendars/${id}`), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update calendar');
    }
    return response.json();
};

export const deleteCalendar = async (id: number): Promise<void> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath(`/caldav/calendars/${id}`), {
        method: 'DELETE',
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to delete calendar');
    }
};

export const fetchRemoteCalendars = async (): Promise<RemoteCalendar[]> => {
    const response = await fetch(getApiPath('/caldav/remote-calendars'), {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch remote calendars');
    }
    return response.json();
};

export const createRemoteCalendar = async (data: {
    local_calendar_id: number;
    name: string;
    server_url: string;
    calendar_path: string;
    username: string;
    password: string;
    auth_type?: string;
    enabled?: boolean;
    sync_direction?: string;
}): Promise<RemoteCalendar> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath('/caldav/remote-calendars'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create remote calendar');
    }
    return response.json();
};

export const updateRemoteCalendar = async (
    id: number,
    data: Partial<Omit<RemoteCalendar, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<RemoteCalendar> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath(`/caldav/remote-calendars/${id}`), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update remote calendar');
    }
    return response.json();
};

export const deleteRemoteCalendar = async (id: number): Promise<void> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath(`/caldav/remote-calendars/${id}`), {
        method: 'DELETE',
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to delete remote calendar');
    }
};

export const testConnection = async (data: {
    server_url: string;
    calendar_path: string;
    username: string;
    password: string;
    auth_type?: string;
}): Promise<{
    success: boolean;
    status: number;
    supportsCalDAV: boolean;
    davCapabilities: string;
    message: string;
}> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath('/caldav/remote-calendars/test-connection'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Connection test failed');
    }
    return response.json();
};

export const syncCalendar = async (
    id: number,
    options?: { direction?: string; dryRun?: boolean }
): Promise<SyncResult> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath(`/caldav/sync/calendars/${id}`), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(options || {}),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
    }
    return response.json();
};

export const syncAllCalendars = async (options?: {
    force?: boolean;
    dryRun?: boolean;
}): Promise<any> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath('/caldav/sync/all'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(options || {}),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
    }
    return response.json();
};

export const getSyncStatus = async (id: number): Promise<SyncStatus> => {
    const response = await fetch(getApiPath(`/caldav/sync/status/${id}`), {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch sync status');
    }
    return response.json();
};

export const fetchConflicts = async (calendarId?: number): Promise<ConflictDetail[]> => {
    const url = calendarId
        ? getApiPath(`/caldav/conflicts?calendarId=${calendarId}`)
        : getApiPath('/caldav/conflicts');
    const response = await fetch(url, {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch conflicts');
    }
    return response.json();
};

export const resolveConflict = async (
    taskId: number,
    calendarId: number,
    resolution: 'local' | 'remote'
): Promise<any> => {
    const csrfToken = await getCsrfToken();
    const response = await fetch(getApiPath(`/caldav/conflicts/${taskId}/resolve`), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ calendarId, resolution }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resolve conflict');
    }
    return response.json();
};
