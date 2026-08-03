import { InboxItem } from '../entities/InboxItem';
import { useStore } from '../store/useStore';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

// API functions
export const fetchInboxItems = async (
    limit: number = 20,
    offset: number = 0
): Promise<{
    items: InboxItem[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
    trashedCount?: number;
}> => {
    const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
    });

    const response = await fetch(getApiPath(`inbox?${params}`), {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
        },
    });

    await handleAuthResponse(response, 'Failed to fetch inbox items.');

    const result = await response.json();

    // Handle backward compatibility - if it's an array, convert to new format
    if (Array.isArray(result)) {
        return {
            items: result,
            pagination: {
                total: result.length,
                limit: result.length,
                offset: 0,
                hasMore: false,
            },
        };
    }

    if (!result.items || !Array.isArray(result.items)) {
        throw new Error('Resulting inbox items are not in expected format.');
    }

    return result;
};

export const createInboxItem = async (
    content: string,
    source?: string
): Promise<InboxItem> => {
    const response = await fetch(getApiPath('inbox'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(source ? { content, source } : { content }),
    });

    await handleAuthResponse(response, 'Failed to create inbox item.');
    return await response.json();
};

export const updateInboxItem = async (
    itemUid: string,
    content: string
): Promise<InboxItem> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ content }),
    });

    await handleAuthResponse(response, 'Failed to update inbox item.');
    return await response.json();
};

export const processInboxItem = async (itemUid: string): Promise<InboxItem> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}/process`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });

    await handleAuthResponse(response, 'Failed to process inbox item.');
    return await response.json();
};

export const deleteInboxItem = async (itemUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });

    await handleAuthResponse(response, 'Failed to delete inbox item.');
};

export const trashInboxItem = async (itemUid: string): Promise<InboxItem> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}/trash`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to trash inbox item.');
    return await response.json();
};

export const restoreInboxItems = async (itemUid: string): Promise<InboxItem> => {
    const response = await fetch(getApiPath(`inbox/${itemUid}/restore`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to restore inbox item.');
    return await response.json();
};

// Track last check time to detect new items
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const lastCheckTimestamp = Date.now();

// Store-aware functions
export const loadInboxItemsToStore = async (
    isInitialLoad: boolean = false,
    requestedCount: number = 20
): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    // Only show loading for initial load, not for polling
    if (isInitialLoad && inboxStore.inboxItems.length === 0) {
        inboxStore.setLoading(true);
        inboxStore.resetPagination();
    }

    try {
        // Load the requested number of items (for pagination preservation)
        const result = await fetchInboxItems(requestedCount, 0);
        const { items, pagination } = result;

        // Check for new items since last check (only for non-initial loads)
        if (!isInitialLoad) {
            const currentItemUids = new Set(
                inboxStore.inboxItems.map((item) => item.uid).filter(Boolean)
            );

            // New telegram items
            const newTelegramItems = items.filter(
                (item) =>
                    item.uid &&
                    !currentItemUids.has(item.uid) &&
                    item.source === 'telegram'
            );

            // Only show notifications if we have detected changes
            if (
                inboxStore.inboxItems.length > 0 &&
                newTelegramItems.length > 0
            ) {
                // Get some minimal info about the items for the notification
                const previewSource =
                    newTelegramItems[0].title ||
                    newTelegramItems[0].content ||
                    '';
                const notificationData = {
                    count: newTelegramItems.length,
                    firstItemContent:
                        previewSource.substring(0, 30) +
                        (previewSource.length > 30 ? '...' : ''),
                };

                // Dispatch a custom event with the notification data
                window.dispatchEvent(
                    new CustomEvent('inboxItemsUpdated', {
                        detail: notificationData,
                    })
                );
            }
        }

        // Update state
        inboxStore.setInboxItems(items);
        inboxStore.setPagination(pagination);
        inboxStore.setError(false);
        if (typeof result.trashedCount === 'number') {
            inboxStore.setTrashedCount(result.trashedCount);
        }
    } catch (error) {
        console.error('Failed to load inbox items:', error);
        inboxStore.setError(true);
    } finally {
        // Only set loading to false if we were actually loading
        if (isInitialLoad) {
            inboxStore.setLoading(false);
        }
    }
};

export const loadMoreInboxItemsToStore = async (): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;

    if (!inboxStore.pagination.hasMore || inboxStore.isLoading) {
        return;
    }

    inboxStore.setLoading(true);

    try {
        const nextOffset =
            inboxStore.pagination.offset + inboxStore.pagination.limit;
        const { items, pagination } = await fetchInboxItems(20, nextOffset);

        // Append new items to existing ones
        inboxStore.appendInboxItems(items);
        inboxStore.setPagination(pagination);
        inboxStore.setError(false);
    } catch (error) {
        console.error('Failed to load more inbox items:', error);
        inboxStore.setError(true);
    } finally {
        inboxStore.setLoading(false);
    }
};

export const createInboxItemWithStore = async (
    content: string,
    source?: string
): Promise<InboxItem> => {
    const inboxStore = useStore.getState().inboxStore;

    try {
        const newItem = await createInboxItem(content, source);
        inboxStore.addInboxItem(newItem);
        return newItem;
    } catch (error) {
        console.error('Failed to create inbox item:', error);
        throw error;
    }
};

export const updateInboxItemWithStore = async (
    itemUid: string,
    content: string
): Promise<InboxItem> => {
    const inboxStore = useStore.getState().inboxStore;

    try {
        const updatedItem = await updateInboxItem(itemUid, content);
        inboxStore.updateInboxItem(updatedItem);
        return updatedItem;
    } catch (error) {
        console.error('Failed to update inbox item:', error);
        throw error;
    }
};

export const processInboxItemWithStore = async (
    itemUid: string
): Promise<InboxItem> => {
    const inboxStore = useStore.getState().inboxStore;

    try {
        const processedItem = await processInboxItem(itemUid);
        inboxStore.removeInboxItemByUid(itemUid);
        return processedItem;
    } catch (error) {
        console.error('Failed to process inbox item:', error);
        throw error;
    }
};

export const deleteInboxItemWithStore = async (
    itemUid: string
): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;

    try {
        await deleteInboxItem(itemUid);
        inboxStore.removeInboxItemByUid(itemUid);
    } catch (error) {
        console.error('Failed to delete inbox item:', error);
        throw error;
    }
};

export const trashInboxItemWithStore = async (itemUid: string): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    try {
        await trashInboxItem(itemUid);
        inboxStore.removeInboxItemByUid(itemUid);
        inboxStore.setTrashedCount(inboxStore.trashedCount + 1);
    } catch (error) {
        console.error('Failed to trash inbox item:', error);
        throw error;
    }
};

export const restoreInboxItemWithStore = async (itemUid: string): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    try {
        const restored = await restoreInboxItems(itemUid);
        inboxStore.addInboxItem(restored);
        inboxStore.setTrashedCount(Math.max(0, inboxStore.trashedCount - 1));
    } catch (error) {
        console.error('Failed to restore inbox item:', error);
        throw error;
    }
};

export const restoreAllTrashedWithStore = async (): Promise<void> => {
    const inboxStore = useStore.getState().inboxStore;
    try {
        const response = await fetch(getApiPath('inbox/restore-all'), {
            method: 'PATCH',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'x-csrf-token': await getCsrfToken(),
            },
        });
        await handleAuthResponse(response, 'Failed to restore items.');
        inboxStore.setTrashedCount(0);
        await loadInboxItemsToStore(true);
    } catch (error) {
        console.error('Failed to restore all trashed items:', error);
        throw error;
    }
};
