import { Tag } from "../entities/Tag";

export const fetchTags = async (): Promise<Tag[]> => {
  try {
    const response = await fetch("/api/tags", {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch tags.');

    return await response.json();
  } catch (error) {
    console.error("Tags fetch error:", error);
    // Return empty array to prevent UI from breaking
    return [];
  }
};

export const createTag = async (tagData: Tag): Promise<Tag> => {
  const response = await fetch('/api/tag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tagData),
  });

  if (!response.ok) throw new Error('Failed to create tag.');

  return await response.json();
};

export const updateTag = async (tagId: number, tagData: Tag): Promise<Tag> => {
  const response = await fetch(`/api/tag/${tagId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tagData),
  });

  if (!response.ok) throw new Error('Failed to update tag.');

  return await response.json();
};

export const deleteTag = async (tagId: number): Promise<void> => {
  const response = await fetch(`/api/tag/${tagId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete tag.');
};