import { Comment, CommentReactionResult } from '../entities/Comment';
import { FileAttachment } from '../entities/Attachment';
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export const fetchComments = async (taskUid: string): Promise<Comment[]> => {
    const response = await fetch(getApiPath(`task/${taskUid}/comments`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to fetch comments.');
    const data = await response.json();
    return data.comments;
};

export const createComment = async (
    taskUid: string,
    data: {
        body: string;
        mentionedPersonUids: string[];
        parentCommentUid?: string;
    }
): Promise<Comment> => {
    const response = await fetch(getApiPath(`task/${taskUid}/comments`), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({
            body: data.body,
            mentioned_person_uids: data.mentionedPersonUids,
            parent_comment_uid: data.parentCommentUid,
        }),
    });
    await handleAuthResponse(response, 'Failed to post comment.');
    return response.json();
};

// Upload an image pasted into a comment
export const uploadCommentImage = async (
    taskUid: string,
    file: File
): Promise<FileAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(
        getApiPath(`task/${taskUid}/comments/images`),
        {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-csrf-token': await getCsrfToken() },
            body: formData,
        }
    );
    await handleAuthResponse(response, 'Failed to upload image.');
    return response.json();
};

// Soft delete: the server returns the tombstoned comment (empty body,
// deleted_at set) rather than removing it, so the thread keeps its place for
// it and the UI can render a "Comment deleted" placeholder there.
export const deleteComment = async (uid: string): Promise<Comment> => {
    const response = await fetch(getApiPath(`comment/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to delete comment.');
    return response.json();
};

// type is null to clear the caller's own reaction.
export const setCommentReaction = async (
    uid: string,
    type: 'like' | 'dislike' | null
): Promise<CommentReactionResult> => {
    const response = await fetch(getApiPath(`comment/${uid}/reaction`), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ type }),
    });
    await handleAuthResponse(response, 'Failed to update reaction.');
    return response.json();
};
