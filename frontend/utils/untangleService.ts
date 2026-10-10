import { getApiPath } from '../config/paths';
import {
    getPostHeaders,
    getPostHeadersWithCsrf,
    handleAuthResponse,
} from './authUtils';

// The public Untangle page: parse is open to anyone, keep needs a session.
// The parsed result travels inside a signed token so the browser can hold
// it through sign-up and hand it back once the person has an account.

export type UntangleKind = 'task' | 'waiting' | 'habit' | 'someday';

export interface UntangleTask {
    title: string;
    due: string | null;
    minutes: number;
    person: string | null;
    tags: string[];
}

export interface UntangleItem extends UntangleTask {
    kind: UntangleKind;
    habit_period: 'daily' | 'weekly' | 'monthly' | null;
    habit_times: number | null;
}

export interface UntanglePerson {
    name: string;
    items: string[];
    waiting: number;
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
    tips: string[];
    questions: { text: string; options: string[] }[];
    areas: UntangleArea[];
    people: UntanglePerson[];
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
    // Set on sample runs
    sample?: string;
    cached?: boolean;
    // Set on a person's own list: whether this was their free untangle
    free?: boolean;
}

export interface UntangleSample {
    key: string;
    label: string;
    text: string;
}

export interface UntangleStatus {
    available: boolean;
    samples: UntangleSample[];
}

// What a signed-out person typed, waiting for their account
export interface PendingUntangle {
    text: string;
    image: string | null;
    timezone: string;
    language: string;
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

const PENDING_KEY = 'untangle_pending_input';

export const fetchUntangleStatus = async (): Promise<UntangleStatus> => {
    try {
        const res = await fetch(getApiPath('untangle/status'), {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) return { available: false, samples: [] };
        const body = await res.json();
        return {
            available: body.available === true,
            samples: Array.isArray(body.samples) ? body.samples : [],
        };
    } catch {
        return { available: false, samples: [] };
    }
};

// A signed-in browser carries a session, and the server then expects the
// CSRF token on every POST; a stranger has no session and the token is
// optional. So ask for one and carry on without it when that fails.
const postHeaders = async (): Promise<Record<string, string>> => {
    try {
        return await getPostHeadersWithCsrf();
    } catch {
        return getPostHeaders();
    }
};

// Plain fetch on purpose: the shared response helpers bounce a 401 to the
// login page, and these calls handle sign-in themselves.
const post = async (
    path: string,
    payload: unknown
): Promise<UntangleResponse> => {
    const res = await fetch(getApiPath(path), {
        method: 'POST',
        credentials: 'include',
        headers: await postHeaders(),
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

// A sample list: open to anyone, cached on the server for the day
export const untangleSample = async (
    payload: { key: string } & Omit<UntangleRequest, 'text' | 'image'>
): Promise<UntangleResponse> => post('untangle/sample', payload);

// A person's own list: needs an account; the first one is free
export const untangle = async (
    payload: UntangleRequest
): Promise<UntangleResponse> => post('untangle/parse', payload);

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

// What the person typed waits in this browser while they sign up and
// verify their email. Storage can be missing or refuse writes (private
// windows), so every call is guarded.
export const stashPendingUntangle = (input: PendingUntangle): boolean => {
    try {
        window.localStorage.setItem(PENDING_KEY, JSON.stringify(input));
        return true;
    } catch {
        return false;
    }
};

export const readPendingUntangle = (): PendingUntangle | null => {
    try {
        const raw = window.localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.text !== 'string') return null;
        return {
            text: parsed.text,
            image: typeof parsed.image === 'string' ? parsed.image : null,
            timezone:
                typeof parsed.timezone === 'string' ? parsed.timezone : 'UTC',
            language:
                typeof parsed.language === 'string' ? parsed.language : 'en',
        };
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
