import { Tag } from '../entities/Tag';
import { handleAuthResponse } from './authUtils';
import { extractUidFromSlug } from './slugUtils';
import { getApiPath } from '../config/paths';

export const fetchTags = async (): Promise<Tag[]> => {
    try {
        const response = await fetch(getApiPath('tags'), {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'Cache-Control': 'no-cache',
            },
        });
        await handleAuthResponse(response, 'Failed to fetch tags.');
        return await response.json();
    } catch (error) {
        console.error('Tags fetch error:', error);
        // Return empty array to prevent UI from breaking
        return [];
    }
};

export const createTag = async (tagData: Tag): Promise<Tag> => {
    const response = await fetch(getApiPath('tag'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(tagData),
    });

    if (!response.ok) {
        // Handle authentication errors first
        if (response.status === 401) {
            await handleAuthResponse(response, 'Failed to create tag.');
            return Promise.reject(new Error('Authentication required'));
        }

        // Try to get the specific error message from the response
        let errorMessage = 'Failed to create tag.';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch {
            // If parsing fails, use default message
        }
        throw new Error(errorMessage);
    }

    return await response.json();
};

export const updateTag = async (tagUid: string, tagData: Tag): Promise<Tag> => {
    const response = await fetch(getApiPath(`tag/${tagUid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(tagData),
    });

    if (!response.ok) {
        // Handle authentication errors first
        if (response.status === 401) {
            await handleAuthResponse(response, 'Failed to update tag.');
        }

        // Try to get the specific error message from the response
        let errorMessage = 'Failed to update tag.';
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch {
            // If parsing fails, use default message
        }
        throw new Error(errorMessage);
    }

    return await response.json();
};

export const deleteTag = async (tagUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`tag/${tagUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to delete tag.');
};

export const fetchTagBySlug = async (uidSlug: string): Promise<Tag> => {
    // Extract uid from uidSlug using proper extraction function
    const uid = extractUidFromSlug(uidSlug);

    const response = await fetch(
        getApiPath(`tag?uid=${encodeURIComponent(uid)}`),
        {
            credentials: 'include',
            headers: {
                Accept: 'application/json',
            },
        }
    );

    await handleAuthResponse(response, 'Failed to fetch tag.');
    return await response.json();
};
