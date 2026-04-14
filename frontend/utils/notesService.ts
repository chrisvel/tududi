import { Note } from '../entities/Note';
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';

export const fetchNotes = async (): Promise<Note[]> => {
    const response = await fetch(getApiPath('notes'), {
        credentials: 'include',
        headers: {
            ...getDefaultHeaders(),
            'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
    });
    await handleAuthResponse(response, 'Failed to fetch notes.');

    return await response.json();
};

export const createNote = async (noteData: Note): Promise<Note> => {
    // Transform project_id to project_uid if needed (same as updateNote)
    const requestData = { ...noteData };
    if (noteData.project && noteData.project.uid) {
        requestData.project_uid = noteData.project.uid;
    } else if (noteData.project_uid) {
        // project_uid is already set, use it as-is
    } else if (noteData.project_id && !noteData.project_uid) {
        // Legacy: if only project_id is provided, we can't convert it to uid here
        // This should not happen with the new implementation, but keeping for safety
        console.warn(
            'Note creation with project_id but no project_uid - this may fail'
        );
    }

    const response = await fetch(getApiPath('note'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(requestData),
    });

    await handleAuthResponse(response, 'Failed to create note.');
    return await response.json();
};

export const updateNote = async (
    noteUid: string,
    noteData: Note
): Promise<Note> => {
    // Transform project_id to project_uid if needed
    const requestData = { ...noteData };
    if (noteData.project && noteData.project.uid) {
        requestData.project_uid = noteData.project.uid;
    } else if (noteData.project_uid) {
        // project_uid is already set, use it as-is
    } else if (noteData.project_id && !noteData.project_uid) {
        // Legacy: if only project_id is provided, we can't convert it to uid here
        // This should not happen with the new implementation, but keeping for safety
        console.warn(
            'Note update with project_id but no project_uid - this may fail'
        );
    }

    // Use the provided noteUid
    const noteIdentifier = noteUid;

    const response = await fetch(getApiPath(`note/${noteIdentifier}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(requestData),
    });

    await handleAuthResponse(response, 'Failed to update note.');
    return await response.json();
};

export const deleteNote = async (noteUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`note/${noteUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });

    await handleAuthResponse(response, 'Failed to delete note.');
};

export const fetchNoteBySlug = async (uidSlug: string): Promise<Note> => {
    const response = await fetch(getApiPath(`note/${uidSlug}`), {
        credentials: 'include',
        headers: {
            ...getDefaultHeaders(),
            'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
    });

    await handleAuthResponse(response, 'Failed to fetch note.');
    return await response.json();
};
