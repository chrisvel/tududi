import { Note } from '../entities/Note';
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeaders,
} from './authUtils';

export const fetchNotes = async (): Promise<Note[]> => {
    const response = await fetch('/api/notes', {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to fetch notes.');

    return await response.json();
};

export const fetchNoteByUid = async (noteUid: string): Promise<Note> => {
    const response = await fetch(`/api/note/uid/${noteUid}`, {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to fetch note.');
    return await response.json();
};

export const createNote = async (noteData: Note): Promise<Note> => {
    const response = await fetch('/api/note', {
        method: 'POST',
        credentials: 'include',
        headers: getPostHeaders(),
        body: JSON.stringify(noteData),
    });

    await handleAuthResponse(response, 'Failed to create note.');
    return await response.json();
};

export const updateNote = async (
    noteUid: string,
    noteData: Note
): Promise<Note> => {
    const response = await fetch(`/api/note/uid/${noteUid}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getPostHeaders(),
        body: JSON.stringify(noteData),
    });

    await handleAuthResponse(response, 'Failed to update note.');
    return await response.json();
};

export const deleteNote = async (noteUid: string): Promise<void> => {
    const response = await fetch(`/api/note/uid/${noteUid}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to delete note.');
};
