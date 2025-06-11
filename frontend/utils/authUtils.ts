/**
 * Get default headers for API requests including CSRF protection
 */
export const getDefaultHeaders = (): Record<string, string> => {
  return {
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': window.location.origin,
  };
};

/**
 * Get default headers for POST/PATCH requests
 */
export const getPostHeaders = (): Record<string, string> => {
  return {
    ...getDefaultHeaders(),
    'Content-Type': 'application/json',
  };
};

/**
 * Handles authentication errors by redirecting to login page
 * @param response - The fetch response object
 * @param errorMessage - Default error message to throw if not a 401
 * @returns Promise that resolves if response is ok, rejects with error if not
 */
export const handleAuthResponse = async (response: Response, errorMessage: string): Promise<Response> => {
  if (!response.ok) {
    if (response.status === 401) {
      // Check if we're already on the login page to avoid redirect loops
      if (window.location.pathname !== '/login') {
        console.log('Authentication required, redirecting to login');
        // Add a small delay to allow any pending operations to complete
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
      }
      throw new Error('Authentication required');
    }
    throw new Error(errorMessage);
  }
  return response;
};

/**
 * Checks if an error is an authentication error
 * @param error - The error to check
 * @returns true if it's an authentication error
 */
export const isAuthError = (error: any): boolean => {
  return error?.message && error.message.includes('Authentication required');
};