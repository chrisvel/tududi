import { Area } from '../entities/Area';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export const reorderAreas = async (areaUids: string[]): Promise<void> => {
    const token = await getCsrfToken();
    const response = await fetch(getApiPath('areas/order'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': token,
        },
        body: JSON.stringify({ area_uids: areaUids }),
    });
    await handleAuthResponse(response, 'Failed to save area order.');
};

export const fetchAreas = async (): Promise<Area[]> => {
    const response = await fetch(getApiPath('areas'), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch areas.');
    return await response.json();
};

export const createArea = async (areaData: Partial<Area>): Promise<Area> => {
    const response = await fetch(getApiPath('areas'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(areaData),
    });

    await handleAuthResponse(response, 'Failed to create area.');
    return await response.json();
};

export const updateArea = async (
    areaUid: string,
    areaData: Partial<Area>
): Promise<Area> => {
    const response = await fetch(getApiPath(`areas/${areaUid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(areaData),
    });

    await handleAuthResponse(response, 'Failed to update area.');
    return await response.json();
};

export const deleteArea = async (areaUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`areas/${areaUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });

    await handleAuthResponse(response, 'Failed to delete area.');
};
