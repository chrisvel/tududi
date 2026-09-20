import { getApiPath } from '../config/paths';
import { handleAuthResponse } from './authUtils';
import { RolesOverview } from '../entities/Role';

export const fetchRoles = async (): Promise<RolesOverview> => {
    const response = await fetch(getApiPath('admin/roles'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load roles.');
    const data = await response.json();
    if (!data || !Array.isArray(data.roles)) {
        throw new Error('Failed to load roles.');
    }
    return data;
};
