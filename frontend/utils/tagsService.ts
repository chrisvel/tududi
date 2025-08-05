import { Tag } from '../entities/Tag';
import { handleAuthResponse } from './authUtils';
import { extractUidFromSlug } from './slugUtils';

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

export const updateTag = async (tagId: number, tagData: Tag): Promise<Tag> => {
    const response = await fetch(`/api/tag/${tagId}`, {
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

export const deleteTag = async (tagId: number): Promise<void> => {
    const response = await fetch(`/api/tag/${tagId}`, {
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
    
    const response = await fetch(`/api/tag?uid=${encodeURIComponent(uid)}`, {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to fetch tag.');
    return await response.json();
};
