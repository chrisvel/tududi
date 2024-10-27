import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { Tag } from '../entities/Tag';  

const useManageTags = () => {
  const { mutate } = useSWRConfig();

  const createTag = useCallback(async (tagData: Partial<Tag>) => {
    try {
      const response = await fetch('/api/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create tag.');
      }
      const newTag: Tag = await response.json();
      mutate('/api/tags', (current: Tag[] = []) => [...current, newTag], false);
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }, [mutate]);

  const updateTag = useCallback(async (tagId: number, tagData: Partial<Tag>) => {
    try {
      const response = await fetch(`/api/tag/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tag.');
      }
      const updatedTag: Tag = await response.json();
      mutate('/api/tags', (current: Tag[] = []) =>
        current.map(tag => (tag.id === tagId ? updatedTag : tag)), false
      );
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  }, [mutate]);

  const deleteTag = useCallback(async (tagId: number) => {
    try {
      const response = await fetch(`/api/tag/${tagId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete tag.');
      }
      mutate('/api/tags', (current: Tag[] = []) =>
        current.filter(tag => tag.id !== tagId), false
      );
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }, [mutate]);

  return { createTag, updateTag, deleteTag };
};

export default useManageTags;
