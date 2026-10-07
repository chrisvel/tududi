export interface Comment {
    uid: string;
    task_id: number;
    body: string;
    mentioned_person_uids: string[];
    mentioned_people: { uid: string; name: string }[];
    created_at: string;
    deleted_at: string | null;
    author: {
        uid: string;
        name: string;
        email: string;
        person_uid: string | null;
    } | null;
    is_own: boolean;
    // One level deep: populated on a top-level comment, always empty on a
    // reply (replying to a reply isn't offered).
    replies: Comment[];
    likes_count: number;
    dislikes_count: number;
    my_reaction: 'like' | 'dislike' | null;
}

export interface CommentReactionResult {
    uid: string;
    likes_count: number;
    dislikes_count: number;
    my_reaction: 'like' | 'dislike' | null;
}
