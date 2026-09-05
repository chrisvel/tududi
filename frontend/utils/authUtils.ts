import {
    PlanLimitDetail,
    PlanLimitError,
    broadcastPlanLimit,
} from './planLimits';
import { getCsrfToken } from './csrfService';

export const getDefaultHeaders = (): Record<string, string> => {
    return {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: window.location.origin,
    };
};

export const getPostHeaders = (): Record<string, string> => {
    return {
        ...getDefaultHeaders(),
        'Content-Type': 'application/json',
    };
};

export const getPostHeadersWithCsrf = async (): Promise<
    Record<string, string>
> => {
    const token = await getCsrfToken();
    return {
        ...getPostHeaders(),
        'x-csrf-token': token,
    };
};

// Thrown when a mutation was queued for background sync instead of
// reaching the server - see handleApiMutation in public/sw.js. Callers
// that care about the real created/updated resource should catch this
// separately rather than treating the queued placeholder body as the
// resource itself.
export class OfflineQueuedError extends Error {
    constructor(
        message = 'This action was saved offline and will sync automatically.'
    ) {
        super(message);
        this.name = 'OfflineQueuedError';
    }
}

export const isQueuedOfflineResponse = (response: Response): boolean =>
    response.headers.get('X-Tududi-Queued') === '1';

let isRedirecting = false;

export const handleAuthResponse = async (
    response: Response,
    errorMessage: string
): Promise<Response> => {
    if (isQueuedOfflineResponse(response)) {
        throw new OfflineQueuedError();
    }
    if (!response.ok) {
        if (response.status === 401) {
            if (window.location.pathname !== '/login' && !isRedirecting) {
                isRedirecting = true;
                setTimeout(() => {
                    window.location.href = '/login';
                }, 100);
            }
            throw new Error('Authentication required');
        }
        if (response.status === 402) {
            let detail: PlanLimitDetail = {
                code: 'PLAN_LIMIT_REACHED',
                error: errorMessage,
            };
            try {
                detail = await response.json();
            } catch {
                // keep the generic detail
            }
            broadcastPlanLimit(detail);
            throw new PlanLimitError(detail);
        }
        let details: string[] | undefined;
        try {
            const body = await response.json();
            if (body.details && Array.isArray(body.details)) {
                details = body.details;
            }
            if (body.error) {
                errorMessage = body.error;
            }
        } catch {
            // response body is not JSON, use fallback errorMessage
        }
        const error = new Error(errorMessage);
        (error as any).details = details;
        throw error;
    }
    return response;
};

export const isAuthError = (error: any): boolean => {
    return error?.message && error.message.includes('Authentication required');
};
