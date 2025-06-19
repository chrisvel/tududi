import { Note } from "../entities/Note";
import { handleAuthResponse, getDefaultHeaders, getPostHeaders } from "./authUtils";

export const fetchNotes = async (): Promise<Note[]> => {
  const response = await fetch("/api/notes", {
    credentials: 'include',
    headers: getDefaultHeaders(),
  });
  await handleAuthResponse(response, 'Failed to fetch notes.');

  return await response.json();
};

export const createNote = async (noteData: Note): Promise<Note> => {
  try {
    const response = await fetch('/api/note', {
      method: 'POST',
      credentials: 'include',
      headers: getPostHeaders(),
      body: JSON.stringify(noteData),
    });

    await handleAuthResponse(response, 'Failed to create note.');
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const updateNote = async (noteId: number, noteData: Note): Promise<Note> => {
  const response = await fetch(`/api/note/${noteId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getPostHeaders(),
    body: JSON.stringify(noteData),
  });

  await handleAuthResponse(response, 'Failed to update note.');
  return await response.json();
};

export const deleteNote = async (noteId: number): Promise<void> => {
  const response = await fetch(`/api/note/${noteId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getDefaultHeaders(),
  });

  await handleAuthResponse(response, 'Failed to delete note.');
};