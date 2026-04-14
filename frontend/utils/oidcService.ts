import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export interface OIDCProvider {
    slug: string;
    name: string;
}

export interface OIDCIdentity {
    id: number;
    provider_slug: string;
    provider_name: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    first_login_at: string;
    last_login_at: string;
    created_at: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Request failed';
        throw new Error(message);
    }
    return (await response.json()) as T;
}

export async function fetchOIDCProviders(): Promise<OIDCProvider[]> {
    const response = await fetch(getApiPath('oidc/providers'), {
        credentials: 'include',
    });
    const data = await handleResponse<{ providers: OIDCProvider[] }>(response);
    return data.providers;
}

export async function fetchOIDCIdentities(): Promise<OIDCIdentity[]> {
    const response = await fetch(getApiPath('oidc/identities'), {
        credentials: 'include',
    });
    const data = await handleResponse<{ identities: OIDCIdentity[] }>(
        response
    );
    return data.identities;
}

export async function unlinkOIDCIdentity(identityId: number): Promise<void> {
    const response = await fetch(getApiPath(`oidc/unlink/${identityId}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Failed to unlink account';
        throw new Error(message);
    }
}

export async function initiateOIDCLink(providerSlug: string): Promise<void> {
    const response = await fetch(getApiPath(`oidc/link/${providerSlug}`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Failed to initiate account linking';
        throw new Error(message);
    }

    const data = (await response.json()) as { redirectUrl: string };
    window.location.href = data.redirectUrl;
}
