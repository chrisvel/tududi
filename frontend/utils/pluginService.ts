import {
    getDefaultHeaders,
    getPostHeadersWithCsrf,
    handleAuthResponse,
} from './authUtils';
import { fetchWithCsrf } from './csrfService';
import { getApiPath } from '../config/paths';
import type { PluginListResponse } from '../plugins/types';

const readPluginResponse = async (
    response: Response
): Promise<PluginListResponse> => {
    await handleAuthResponse(response, 'Failed to update plugins.');
    return (await response.json()) as PluginListResponse;
};

export const fetchPlugins = async (): Promise<PluginListResponse> => {
    const response = await fetch(getApiPath('plugins'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    return readPluginResponse(response);
};

export const updatePlugin = async (
    id: string,
    patch: { enabled?: boolean; settings?: Record<string, unknown> }
): Promise<PluginListResponse> => {
    const response = await fetch(
        getApiPath(`plugins/${encodeURIComponent(id)}`),
        {
            method: 'PUT',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify(patch),
        }
    );
    return readPluginResponse(response);
};

/**
 * Install a plugin from a .zip the operator chose, or update one by uploading a
 * newer archive of the same plugin.
 *
 * The archive decides which of the two this is: it carries the plugin's own id
 * in its manifest, so there is no separate update call. The body is multipart,
 * so the browser sets the Content-Type (and its boundary) itself - only the
 * CSRF header is added here.
 */
export const installPlugin = async (
    file: File
): Promise<PluginListResponse> => {
    const formData = new FormData();
    formData.append('plugin', file);

    const response = await fetchWithCsrf(getApiPath('plugins/install'), {
        method: 'POST',
        credentials: 'include',
        headers: getDefaultHeaders(),
        body: formData,
    });

    return readPluginResponse(response);
};

/**
 * Remove an installed plugin from the server, for every account.
 *
 * Deleting a plugin is not the same as a user disabling it: the files are
 * gone, so it stops appearing in anyone's list.
 */
export const removePlugin = async (id: string): Promise<PluginListResponse> => {
    const response = await fetchWithCsrf(
        getApiPath(`plugins/${encodeURIComponent(id)}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: getDefaultHeaders(),
        }
    );

    return readPluginResponse(response);
};

export const updatePluginState = async (patch: {
    activeTheme: string | null;
}): Promise<PluginListResponse> => {
    const response = await fetch(getApiPath('plugins/state'), {
        method: 'PUT',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(patch),
    });
    return readPluginResponse(response);
};

/**
 * Generic authenticated request, exposed to plugins as `api.api`.
 *
 * This exists so a plugin can reach endpoints the host API does not model
 * without hand-rolling credentials. It deliberately reuses the same auth and
 * CSRF helpers the app uses, so a plugin cannot accidentally bypass either.
 */
export const pluginRequest = async <T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown
): Promise<T> => {
    const init: RequestInit = { method, credentials: 'include' };

    if (method === 'GET') {
        init.headers = getDefaultHeaders();
    } else {
        init.headers = await getPostHeadersWithCsrf();
        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }
    }

    const response = await fetch(getApiPath(path), init);
    await handleAuthResponse(
        response,
        `Plugin request failed: ${method} ${path}`
    );

    if (response.status === 204) {
        return undefined as T;
    }

    const text = await response.text();
    if (!text) {
        return undefined as T;
    }

    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(
            `Plugin request returned a non-JSON body: ${method} ${path}`
        );
    }
};
