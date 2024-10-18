// src/hooks/useFetchNotes.ts
import useFetch from './useFetch';
import { Note } from '../entities/Note';

const useFetchNotes = () => {
  const { data, loading, error } = useFetch<Note[]>('/api/notes', {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  return { notes: data || [], loading, error };
};

export default useFetchNotes;
