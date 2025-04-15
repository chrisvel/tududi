import { InboxItem } from "../entities/InboxItem";
import { useStore } from "../store/useStore";

// API functions
export const fetchInboxItems = async (): Promise<InboxItem[]> => {
  const response = await fetch('/api/inbox');
  
  if (!response.ok) throw new Error('Failed to fetch inbox items.');
  
  const result = await response.json();
  
  if (!Array.isArray(result)) {
    throw new Error('Resulting inbox items are not an array.');
  }
  
  return result;
};

export const createInboxItem = async (content: string, source: string = 'tududi'): Promise<InboxItem> => {
  const response = await fetch('/api/inbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, source }),
  });

  if (!response.ok) throw new Error('Failed to create inbox item.');

  return await response.json();
};

export const updateInboxItem = async (itemId: number, content: string): Promise<InboxItem> => {
  const response = await fetch(`/api/inbox/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) throw new Error('Failed to update inbox item.');

  return await response.json();
};

export const processInboxItem = async (itemId: number): Promise<InboxItem> => {
  const response = await fetch(`/api/inbox/${itemId}/process`, {
    method: 'PATCH',
  });

  if (!response.ok) throw new Error('Failed to process inbox item.');

  return await response.json();
};

export const deleteInboxItem = async (itemId: number): Promise<void> => {
  const response = await fetch(`/api/inbox/${itemId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete inbox item.');
};

// Track last check time to detect new items
let lastCheckTimestamp = Date.now();

// Store-aware functions
export const loadInboxItemsToStore = async (): Promise<void> => {
  const inboxStore = useStore.getState().inboxStore;
  // Only show loading for initial load
  if (inboxStore.inboxItems.length === 0) {
    inboxStore.setLoading(true);
  }
  
  try {
    const items = await fetchInboxItems();
    
    // Check for new items since last check
    const currentItemIds = new Set(inboxStore.inboxItems.map(item => item.id));
    const currentTime = Date.now();
    
    // New telegram items
    const newTelegramItems = items.filter(item => 
      item.id && 
      !currentItemIds.has(item.id) && 
      item.source === 'telegram'
    );
    
    // Only show notifications if we have detected changes
    if (inboxStore.inboxItems.length > 0 && newTelegramItems.length > 0) {
      // Instead of trying to show toast directly (which won't work outside of React components),
      // dispatch a custom event that the component can listen for and show toasts
      
      // Get some minimal info about the items for the notification
      const notificationData = {
        count: newTelegramItems.length,
        firstItemContent: newTelegramItems[0].content.substring(0, 30) + 
                         (newTelegramItems[0].content.length > 30 ? '...' : '')
      };
      
      // Dispatch a custom event with the notification data
      window.dispatchEvent(new CustomEvent('inboxItemsUpdated', { 
        detail: notificationData
      }));
    }
    
    // Update state and timestamp
    inboxStore.setInboxItems(items);
    inboxStore.setError(false);
    lastCheckTimestamp = currentTime;
  } catch (error) {
    console.error('Failed to load inbox items:', error);
    inboxStore.setError(true);
  } finally {
    inboxStore.setLoading(false);
  }
};

export const createInboxItemWithStore = async (content: string, source: string = 'tududi'): Promise<InboxItem> => {
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

export const updateInboxItemWithStore = async (itemId: number, content: string): Promise<InboxItem> => {
  const inboxStore = useStore.getState().inboxStore;
  
  try {
    const updatedItem = await updateInboxItem(itemId, content);
    inboxStore.updateInboxItem(updatedItem);
    return updatedItem;
  } catch (error) {
    console.error('Failed to update inbox item:', error);
    throw error;
  }
};

export const processInboxItemWithStore = async (itemId: number): Promise<InboxItem> => {
  const inboxStore = useStore.getState().inboxStore;
  
  try {
    const processedItem = await processInboxItem(itemId);
    inboxStore.removeInboxItem(itemId);
    return processedItem;
  } catch (error) {
    console.error('Failed to process inbox item:', error);
    throw error;
  }
};

export const deleteInboxItemWithStore = async (itemId: number): Promise<void> => {
  const inboxStore = useStore.getState().inboxStore;
  
  try {
    await deleteInboxItem(itemId);
    inboxStore.removeInboxItem(itemId);
  } catch (error) {
    console.error('Failed to delete inbox item:', error);
    throw error;
  }
};