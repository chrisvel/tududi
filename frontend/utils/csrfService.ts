import { getApiPath } from '../config/paths';

let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

// If the last fetch attempt failed (typically because the device is
// offline), don't hammer the network again on every subsequent call -
// e.g. keystroke-triggered requests can retry this dozens of times a
// minute. Back off briefly and retry immediately once the browser
// reports connectivity again.
let lastFailureAt: number | null = null;
const FAILURE_BACKOFF_MS = 4000;

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        lastFailureAt = null;
    });
}

// Mutations must still be attempted even when a CSRF token can't be
// fetched (e.g. offline): the caller's own fetch() needs to fire so the
// service worker's offline queue (see public/sw.js) can catch and queue
// it. Resolving '' instead of rejecting lets every caller of this
// function proceed rather than aborting before the mutation is issued.
export const getCsrfToken = async (): Promise<string> => {
    if (csrfToken) {
        return csrfToken;
    }

    if (
        lastFailureAt !== null &&
        Date.now() - lastFailureAt < FAILURE_BACKOFF_MS
    ) {
        return '';
    }

    if (tokenPromise) {
        return tokenPromise;
    }

    tokenPromise = fetch(getApiPath('csrf-token'), {
        credentials: 'include',
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to fetch CSRF token');
            }
            return response.json();
        })
        .then((data) => {
            csrfToken = data.csrfToken;
            tokenPromise = null;
            return csrfToken!;
        })
        .catch((error) => {
            tokenPromise = null;
            lastFailureAt = Date.now();
            console.warn('Unable to fetch CSRF token, proceeding without one:', error);
            return '';
        });

    return tokenPromise;
};

export const clearCsrfToken = (): void => {
    csrfToken = null;
    tokenPromise = null;
    lastFailureAt = null;
};

export const fetchWithCsrf = async (
    url: string,
    options: RequestInit = {}
): Promise<Response> => {
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
        options.method?.toUpperCase() || 'GET'
    );

    if (needsCsrf) {
        const token = await getCsrfToken();
        options.headers = {
            ...options.headers,
            'x-csrf-token': token,
        };
    }

    return fetch(url, options);
};
