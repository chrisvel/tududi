// Life-to-Day (T-901): Google Calendar connection. No secret ever reaches
// the browser; the server returns status only.
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';

export interface GcalStatus {
    available: boolean;
    connected: boolean;
    status: 'active' | 'revoked' | null;
    last_sync_at: string | null;
    last_error: string | null;
    can_export: boolean;
    export_enabled: boolean;
}

export interface GcalDisconnectResult {
    disconnected: boolean;
    revoked: boolean;
    message?: string;
}

export const fetchGcalStatus = async (): Promise<GcalStatus> => {
    const response = await fetch(getApiPath('ltd/gcal'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Could not load Google Calendar.');
    return response.json();
};

const post = async <T>(path: string, body: unknown, error: string) => {
    const response = await fetch(getApiPath(path), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(body ?? {}),
    });
    await handleAuthResponse(response, error);
    return (await response.json()) as T;
};

export const startGcalConnect = () =>
    post<{ url: string }>(
        'ltd/gcal/connect',
        {},
        'Could not start Google sign-in.'
    );

export const setGcalExport = (on: boolean) =>
    post<GcalStatus>(
        'ltd/gcal/export',
        { on },
        'Could not change the Life-to-Day calendar.'
    );

export const disconnectGcal = () =>
    post<GcalDisconnectResult>(
        'ltd/gcal/disconnect',
        {},
        'Could not disconnect Google Calendar.'
    );
