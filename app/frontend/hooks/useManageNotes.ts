import useSWR from 'swr';
import { Note } from '../entities/Note';
import { fetcher } from '../utils/fetcher';
import { useCallback } from 'react';

const useManageNotes = () => {
  const { data, error, mutate } = useSWR<Note[]>('/api/notes', fetcher);

  const createNote = useCallback(
    async (noteData: Partial<Note>) => {
      const noteDataToSend = {
        ...noteData,
        tags: noteData.tags?.map((tag) => tag.name) || [],
      };
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(noteDataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create note.');
      }

      const newNote: Note = await response.json();
      mutate([...(data || []), newNote], false);
    },
    [mutate, data]
  );

  const updateNote = useCallback(
    async (noteId: number, noteData: Partial<Note>) => {
      const noteDataToSend = {
        ...noteData,
        tags: noteData.tags?.map((tag) => tag.name) || [],
      };
      const response = await fetch(`/api/note/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(noteDataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update note.');
      }

      const updatedNote: Note = await response.json();
      mutate((data || []).map((note) => (note.id === noteId ? updatedNote : note)), false);
    },
    [mutate, data]
  );

  const deleteNote = useCallback(
    async (noteId: number) => {
      const response = await fetch(`/api/note/${noteId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete note.');
      }
      
      mutate((data || []).filter((note) => note.id !== noteId), false);
    },
    [mutate, data]
  );

  return {
    notes: data || [],
    isLoading: !error && !data,
    isError: error,
    createNote,
    updateNote,
    deleteNote,
    mutate
  };
};

export default useManageNotes;
