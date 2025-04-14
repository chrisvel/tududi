import { InboxItem } from "../entities/InboxItem";

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