import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export interface MfaStatus {
    enabled: boolean;
    enabled_at: string | null;
    recovery_codes_left: number;
    available: boolean;
}

export interface MfaSetup {
    secret: string;
    otpauth_url: string;
    qr_svg: string;
}

export type ReauthMethod = 'password' | 'code';

// The server wants the password or a code typed again before a sensitive
// action (403 reauth_required). useReverify turns it into a prompt.
export class ReauthRequiredError extends Error {
    method: ReauthMethod;

    constructor(method: ReauthMethod, message = 'Confirm it is you') {
        super(message);
        this.name = 'ReauthRequiredError';
        this.method = method;
    }
}

// Shared by every caller of a step-up route.
export async function readJsonOrThrow<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        if (response.status === 403 && body?.reauth_required) {
            throw new ReauthRequiredError(body.method, body.error);
        }
        const error = new Error(body?.error || 'Request failed');
        (error as any).status = response.status;
        throw error;
    }
    return body as T;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(getApiPath(path), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return readJsonOrThrow<T>(response);
}

export async function fetchMfaStatus(): Promise<MfaStatus> {
    const response = await fetch(getApiPath('profile/mfa'), {
        credentials: 'include',
    });
    return readJsonOrThrow<MfaStatus>(response);
}

export const startMfaSetup = () => post<MfaSetup>('profile/mfa/setup');

export const enableMfa = (code: string) =>
    post<{ recovery_codes: string[] }>('profile/mfa/enable', { code });

export const disableMfa = (payload: {
    code?: string;
    recovery_code?: string;
}) => post<{ enabled: false }>('profile/mfa/disable', payload);

export const regenerateRecoveryCodes = () =>
    post<{ recovery_codes: string[] }>('profile/mfa/recovery-codes');

export const reverify = (payload: {
    password?: string;
    code?: string;
    recovery_code?: string;
}) => post<{ verified: true }>('auth/reverify', payload);
