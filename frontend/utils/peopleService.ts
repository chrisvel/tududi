import { Person } from '../entities/Person';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export const fetchPeople = async (params: {
    archived?: boolean;
    sort?: string;
    relationship_type?: string;
} = {}): Promise<Person[]> => {
    const query = new URLSearchParams();
    if (params.archived !== undefined) query.set('archived', String(params.archived));
    if (params.sort) query.set('sort', params.sort);
    if (params.relationship_type) query.set('relationship_type', params.relationship_type);

    const url = query.toString() ? `people?${query.toString()}` : 'people';
    const response = await fetch(getApiPath(url), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch people.');
    const data = await response.json();
    return data.people;
};

export const fetchPersonByUid = async (uid: string): Promise<Person> => {
    const response = await fetch(getApiPath(`people/${uid}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch person.');
    return response.json();
};

export const createPerson = async (
    data: Omit<Person, 'id' | 'uid' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ person: Person }> => {
    const response = await fetch(getApiPath('people'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to create person.');
    return response.json();
};

export const updatePerson = async (
    uid: string,
    data: Partial<Person>
): Promise<{ person: Person }> => {
    const response = await fetch(getApiPath(`people/${uid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to update person.');
    return response.json();
};

export const deletePerson = async (uid: string): Promise<void> => {
    const response = await fetch(getApiPath(`people/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to delete person.');
};
