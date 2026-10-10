import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

// The public Untangle page: parse is open to anyone, keep needs a session.
// The parsed result travels inside a signed token so the browser can hold
// it through sign-up and hand it back once the person has an account.

export type UntangleKind = 'task' | 'waiting' | 'habit' | 'someday';

export interface UntangleTask {
    title: string;
    due: string | null;
    minutes: number;
}

export interface UntangleItem extends UntangleTask {
    kind: UntangleKind;
    person: string | null;
    habit_period: 'daily' | 'weekly' | 'monthly' | null;
    habit_times: number | null;
}

export interface UntangleArea {
    name: string;
    goal: { title: string; why: string } | null;
    projects: { name: string; tasks: UntangleTask[] }[];
    items: UntangleItem[];
}

export interface UntangleResult {
    today: { title: string; reason: string };
    drop: { title: string; reason: string }[];
    question: { text: string; options: string[] } | null;
    areas: UntangleArea[];
    week: {
        date: string;
        weekday: string;
        minutes: number;
        titles: string[];
    }[];
}

export interface UntangleAnswer {
    question: string;
    answer: string;
}

export interface UntangleRequest {
    text?: string;
    image?: string | null;
    timezone?: string;
    language?: string;
    answers?: UntangleAnswer[];
}

export interface UntangleResponse {
    result: UntangleResult;
    token: string;
}

export interface KeepResult {
    onboarding_starter: string;
    onboarded_at: string;
    created: {
        areas: number;
        goals: number;
        projects: number;
        tasks: number;
        habits: number;
        people: number;
    };
}

export class UntangleError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = 'UntangleError';
        this.status = status;
        this.code = code;
    }
}

const PENDING_KEY = 'untangle_pending';

export const isUntangleAvailable = async (): Promise<boolean> => {
    try {
        const res = await fetch(getApiPath('untangle/status'), {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });
        return res.ok;
    } catch {
        return false;
    }
};

// Plain fetch on purpose: the shared helpers bounce a 401 to the login
// page, and this call has no session to lose.
export const untangle = async (
    payload: UntangleRequest
): Promise<UntangleResponse> => {
    const res = await fetch(getApiPath('untangle/parse'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        let message = 'Could not untangle that.';
        let code: string | undefined;
        try {
            const body = await res.json();
            message = body.message || body.error || message;
            code = body.code;
        } catch {
            // no body
        }
        throw new UntangleError(message, res.status, code);
    }
    return res.json();
};

export const keepUntangled = async (token: string): Promise<KeepResult> => {
    const response = await fetch(getApiPath('untangle/keep'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ token }),
    });
    await handleAuthResponse(response, 'Could not keep the plan.');
    return response.json();
};

// The token waits in this browser while the person signs up and verifies
// their email. Storage can be missing or refuse writes (private windows), in
// which case Keep it still works for someone already signed in.
export const stashPendingUntangle = (token: string): boolean => {
    try {
        window.localStorage.setItem(PENDING_KEY, token);
        return true;
    } catch {
        return false;
    }
};

export const readPendingUntangle = (): string | null => {
    try {
        return window.localStorage.getItem(PENDING_KEY);
    } catch {
        return null;
    }
};

export const clearPendingUntangle = (): void => {
    try {
        window.localStorage.removeItem(PENDING_KEY);
    } catch {
        // nothing to clear
    }
};
