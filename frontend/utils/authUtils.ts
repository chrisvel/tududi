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

let isRedirecting = false;

export const handleAuthResponse = async (
    response: Response,
    errorMessage: string
): Promise<Response> => {
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
