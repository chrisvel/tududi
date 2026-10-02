import { getApiPath, getBasePath } from '../config/paths';
import { fetchWithCsrf } from './csrfService';

export interface NotePublicShare {
    enabled: boolean;
    token: string | null;
    shared_at: string | null;
    public_inherit_style?: boolean;
}

// Whether the public page shows the note's color and background.
export interface PublicNoteLook {
    public_inherit_style: boolean;
}

export interface PublicNote {
    title: string;
    content: string;
    color?: string | null;
    background?: string | null;
    updated_at?: string | null;
    // Linked notes of the same owner that are public too.
    linked_notes?: { title: string; token: string }[];
}

export class PublicShareError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

const shareUrl = (noteUid: string): string =>
    getApiPath(`note/${encodeURIComponent(noteUid)}/public-share`);

const readShare = async (
    response: Response,
    fallback: string
): Promise<NotePublicShare> => {
    if (response.ok) return response.json();
    let message = fallback;
    try {
        const body = await response.json();
        message = body.error || body.message || fallback;
    } catch {
        // keep the fallback message
    }
    throw new PublicShareError(message, response.status);
};

export const getNotePublicShare = async (
    noteUid: string
): Promise<NotePublicShare> =>
    readShare(
        await fetch(shareUrl(noteUid), {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        }),
        'Could not load the sharing settings.'
    );

export const enableNotePublicShare = async (
    noteUid: string,
    look?: PublicNoteLook
): Promise<NotePublicShare> =>
    readShare(
        await fetchWithCsrf(shareUrl(noteUid), {
            method: 'POST',
            credentials: 'include',
            headers: JSON_HEADERS,
            body: look ? JSON.stringify(look) : undefined,
        }),
        'Could not turn on public sharing.'
    );

// A new link for a shared note; the old one stops working.
export const rotateNotePublicShare = async (
    noteUid: string
): Promise<NotePublicShare> =>
    readShare(
        await fetchWithCsrf(`${shareUrl(noteUid)}/rotate`, {
            method: 'POST',
            credentials: 'include',
            headers: JSON_HEADERS,
        }),
        'Could not make a new link.'
    );

export const updateNotePublicLook = async (
    noteUid: string,
    look: PublicNoteLook
): Promise<NotePublicShare> =>
    readShare(
        await fetchWithCsrf(shareUrl(noteUid), {
            method: 'PATCH',
            credentials: 'include',
            headers: JSON_HEADERS,
            body: JSON.stringify(look),
        }),
        'Could not save the public page look.'
    );

export const disableNotePublicShare = async (
    noteUid: string
): Promise<NotePublicShare> =>
    readShare(
        await fetchWithCsrf(shareUrl(noteUid), {
            method: 'DELETE',
            credentials: 'include',
            headers: JSON_HEADERS,
        }),
        'Could not turn off public sharing.'
    );

// null means the link is not available: it never existed, or the owner turned
// sharing off, or the note is gone. The three look the same on purpose.
export const fetchPublicNote = async (
    token: string
): Promise<PublicNote | null> => {
    const response = await fetch(
        getApiPath(`public/notes/${encodeURIComponent(token)}`),
        {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
        }
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Could not load the note.');
    return response.json();
};

export const buildPublicNoteUrl = (token: string): string =>
    `${window.location.origin}${getBasePath()}/public/notes/${token}`;
