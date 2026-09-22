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
}
