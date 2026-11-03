import { getApiPath } from '../config/paths';

export interface DatabaseInfo {
    dialect: 'sqlite' | 'postgres';
}

// Admins only. Anyone else gets a 403, which the caller treats as nothing
// to show.
export const fetchDatabaseInfo = async (): Promise<DatabaseInfo | null> => {
    const response = await fetch(getApiPath('admin/database'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return response.json();
};
