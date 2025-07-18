import { Tag } from '../entities/Tag';
import { handleAuthResponse } from './authUtils';

export const fetchTags = async (): Promise<Tag[]> => {
    try {
        const response = await fetch('/api/tags', {
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

export const fetchTagByUid = async (tagUid: string): Promise<Tag> => {
    const response = await fetch(`/api/tag/uid/${tagUid}`, {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });
    await handleAuthResponse(response, 'Failed to fetch tag.');
    return await response.json();
};

export const createTag = async (tagData: Tag): Promise<Tag> => {
    const response = await fetch('/api/tag', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(tagData),
    });

    await handleAuthResponse(response, 'Failed to create tag.');
    return await response.json();
};

export const updateTag = async (tagUid: string, tagData: Tag): Promise<Tag> => {
    const response = await fetch(`/api/tag/uid/${tagUid}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(tagData),
    });

    await handleAuthResponse(response, 'Failed to update tag.');
    return await response.json();
};

export const deleteTag = async (tagUid: string): Promise<void> => {
    const response = await fetch(`/api/tag/uid/${tagUid}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to delete tag.');
};
