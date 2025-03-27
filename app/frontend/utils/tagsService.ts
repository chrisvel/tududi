import { Tag } from "../entities/Tag";

export const fetchTags = async (): Promise<Tag[]> => {
  const response = await fetch("/api/tags");
  if (!response.ok) throw new Error('Failed to fetch tags.');

  return await response.json();
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