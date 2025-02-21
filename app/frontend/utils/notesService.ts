import { Note } from "../entities/Note";

export const fetchNotes = async (): Promise<Note[]> => {
  const response = await fetch("/api/notes");
  if (!response.ok) throw new Error('Failed to fetch notes.');

  return await response.json();
};

export const createNote = async (noteData: Note): Promise<Note> => {
  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) throw new Error('Failed to create note.');

  return await response.json();
};

export const updateNote = async (noteId: number, noteData: Note): Promise<Note> => {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) throw new Error('Failed to update note.');

  return await response.json();
};

export const deleteNote = async (noteId: number): Promise<void> => {
  const response = await fetch(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete note.');
};