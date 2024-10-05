// src/hooks/useManageNotes.ts

import useSWR from 'swr';
import { Note } from '../entities/Note';
import { fetcher } from '../utils/fetcher';
import { useCallback } from 'react';

const useManageNotes = () => {
  const { data: notes, error, mutate } = useSWR<Note[]>('/api/notes', fetcher);

  const createNote = useCallback(
    async (noteData: Partial<Note>) => {
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create note.');
      }

      const newNote: Note = await response.json();

      // Optimistically update the cache
      mutate([...notes, newNote], false);
    },
    [mutate, notes]
  );

  const updateNote = useCallback(
    async (noteId: number, noteData: Partial<Note>) => {
      const response = await fetch(`/api/note/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update note.');
      }

      const updatedNote: Note = await response.json();

      // Optimistically update the cache
      mutate(notes.map((note) => (note.id === noteId ? updatedNote : note)), false);
    },
    [mutate, notes]
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

      // Optimistically update the cache
      mutate(notes.filter((note) => note.id !== noteId), false);
    },
    [mutate, notes]
  );

  return {
    notes: notes || [],
    isLoading: !error && !notes,
    isError: error,
    createNote,
    updateNote,
    deleteNote,
  };
};

export default useManageNotes;
