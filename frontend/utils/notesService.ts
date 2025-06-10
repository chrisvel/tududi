import { Note } from "../entities/Note";

export const fetchNotes = async (): Promise<Note[]> => {
  const response = await fetch("/api/notes");
  if (!response.ok) throw new Error('Failed to fetch notes.');

  return await response.json();
};

export const createNote = async (noteData: Note): Promise<Note> => {
  try {
    console.log("Creating note with data:", JSON.stringify(noteData, null, 2));
    const response = await fetch('/api/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error creating note:", errorData);
      throw new Error(`Failed to create note: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Exception in createNote:", error);
    throw error;
  }
};

export const updateNote = async (noteId: number, noteData: Note): Promise<Note> => {
  const response = await fetch(`/api/note/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData),
  });

  if (!response.ok) throw new Error('Failed to update note.');

  return await response.json();
};

export const deleteNote = async (noteId: number): Promise<void> => {
  const response = await fetch(`/api/note/${noteId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete note.');
};