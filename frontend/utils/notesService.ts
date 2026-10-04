import { Note } from '../entities/Note';
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';
import { refreshTagCountsIfTagsChanged } from './tagsService';

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
    const created = await response.json();
    refreshTagCountsIfTagsChanged(noteData);
    return created;
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
    const updated = await response.json();
    refreshTagCountsIfTagsChanged(noteData);
    return updated;
};

export const deleteNote = async (noteUid: string): Promise<void> => {
    const response = await fetch(getApiPath(`note/${noteUid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });

    await handleAuthResponse(response, 'Failed to delete note.');
    refreshTagCountsIfTagsChanged();
};

export interface BacklinkNote {
    uid: string;
    title: string;
}

export const fetchNoteBacklinks = async (noteUid: string): Promise<BacklinkNote[]> => {
    const response = await fetch(getApiPath(`note/${noteUid}/backlinks`), {
        credentials: 'include',
        headers: getDefaultHeaders(),
        cache: 'no-store',
    });
    await handleAuthResponse(response, 'Failed to fetch backlinks.');
    return await response.json();
};

const requestNoteBySlug = (uidSlug: string): Promise<Response> =>
    fetch(getApiPath(`note/${uidSlug}`), {
        credentials: 'include',
        headers: {
            ...getDefaultHeaders(),
            'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
    });

// A note opened by link is requested as soon as the app boots, alongside
// the user and translation requests, instead of after the page mounts
// (#1785). The first fetchNoteBySlug for that note picks it up.
const PREFETCH_MAX_AGE_MS = 15000;
let prefetchedNote: {
    uidSlug: string;
    response: Promise<Response>;
    startedAt: number;
} | null = null;

export const prefetchNoteFromPath = (pathname: string): void => {
    const match = pathname.match(/^\/notes\/([^/?#]+)\/?$/);
    if (!match) return;
    const uidSlug = decodeURIComponent(match[1]);
    const response = requestNoteBySlug(uidSlug);
    // Errors surface when the page asks for the note.
    response.catch(() => undefined);
    prefetchedNote = { uidSlug, response, startedAt: Date.now() };
};

const takePrefetchedNote = (uidSlug: string): Promise<Response> | null => {
    const prefetched = prefetchedNote;
    prefetchedNote = null;
    if (
        !prefetched ||
        prefetched.uidSlug !== uidSlug ||
        Date.now() - prefetched.startedAt > PREFETCH_MAX_AGE_MS
    ) {
        return null;
    }
    return prefetched.response;
};

export const fetchNoteBySlug = async (uidSlug: string): Promise<Note> => {
    const response = await (takePrefetchedNote(uidSlug) ??
        requestNoteBySlug(uidSlug));

    await handleAuthResponse(response, 'Failed to fetch note.');
    return await response.json();
};
