import { Tag } from '../entities/Tag';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { extractUidFromSlug } from './slugUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import { useStore } from '../store/useStore';

// Task/note/project create, update, and delete calls pass their request
// payload here so the cached per-tag counts on the Tags page don't go stale.
// Only payloads that actually touch `tags` (or removals, which always affect
// membership) trigger a refetch, so unrelated field updates (status toggles,
// project moves, etc.) don't cause extra requests.
export const refreshTagCountsIfTagsChanged = (payload?: {
    tags?: unknown;
}): void => {
    if (payload && !('tags' in payload)) return;

    useStore
        .getState()
        .tagsStore.refreshTags()
        .catch((error) =>
            console.error(
                'refreshTagCountsIfTagsChanged: Failed to refresh tags:',
                error
            )
        );
};

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
        headers: await getPostHeadersWithCsrf(),
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
        headers: await getPostHeadersWithCsrf(),
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
            'x-csrf-token': await getCsrfToken(),
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
