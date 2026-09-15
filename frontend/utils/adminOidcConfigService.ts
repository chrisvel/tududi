import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

export interface AdminOidcProvider {
    slug: string;
    name: string;
    issuer: string;
    clientId: string;
    scope?: string;
    autoProvision: boolean;
    adminEmailDomains: string[];
    client_secret_set: boolean;
    client_secret_last4: string | null;
}

export interface AdminOidcConfig {
    source: 'db' | 'env';
    enabled: boolean;
    providers: AdminOidcProvider[];
}

// A provider sent to the PUT endpoint. clientSecret is omitted to mean
// "keep whatever secret is already stored for this slug" -- only send it to
// set or replace one (see backend/modules/oidc/configService.js).
export interface AdminOidcProviderInput {
    slug: string;
    name: string;
    issuer: string;
    clientId: string;
    clientSecret?: string;
    scope?: string;
    autoProvision: boolean;
    adminEmailDomains: string[];
}

export const fetchAdminOidcConfig = async (): Promise<AdminOidcConfig> => {
    const response = await fetch(getApiPath('admin/oidc-config'), {
        method: 'GET',
        credentials: 'include',
    });
    await handleAuthResponse(response, 'Failed to load OIDC configuration.');
    return response.json();
};

export const saveAdminOidcConfig = async (payload: {
    enabled: boolean;
    providers: AdminOidcProviderInput[];
}): Promise<AdminOidcConfig> => {
    const response = await fetch(getApiPath('admin/oidc-config'), {
        method: 'PUT',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(response, 'Failed to save OIDC configuration.');
    return response.json();
};
