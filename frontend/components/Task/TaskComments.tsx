import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ChatBubbleLeftIcon,
    ExclamationTriangleIcon,
    NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Person } from '../../entities/Person';
import { Comment } from '../../entities/Comment';
import { fetchComments, deleteComment } from '../../utils/commentsService';
import {
    fetchPeople,
    fetchAssignablePeopleForProject,
} from '../../utils/peopleService';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import CommentComposer from './CommentComposer';

interface TaskCommentsProps {
    task: Task;
    onCommentCountChange?: (count: number) => void;
}

// Posted comments store a plain `@Name` in the body (nothing hidden in the
// text). Which uid a name refers to comes back from the server on
// `comment.mentioned_people`, resolved from the `mentioned_person_uids` sent
// on submit - that is matched against the body here to turn each mention
// into a link.
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderBody(
    body: string,
    mentionedPeople: { uid: string; name: string }[]
) {
    if (!mentionedPeople || mentionedPeople.length === 0) {
        return body;
    }

    // Longest name first, so "Sam" mentioned alongside "Samantha" can't
    // swallow part of "Samantha"'s match.
    const byName = new Map(
        [...mentionedPeople]
            .sort((a, b) => b.name.length - a.name.length)
            .map((p) => [p.name, p.uid] as const)
    );
    const pattern = [...byName.keys()].map(escapeRegExp).join('|');
    const mentionRegex = new RegExp(`@(${pattern})(?!\\w)`, 'g');

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = mentionRegex.exec(body)) !== null) {
        if (match.index > lastIndex) {
            parts.push(body.slice(lastIndex, match.index));
        }
        const name = match[1];
        parts.push(
            <Link
                key={`mention-${key++}`}
                to={`/person/${byName.get(name)}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
                @{name}
            </Link>
        );
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < body.length) {
        parts.push(body.slice(lastIndex));
    }
    return parts;
}

// A small, stable palette so the same person's avatar is always the same
// color across renders and viewers, without needing to store a color.
const AVATAR_PALETTE = [
    'bg-rose-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-sky-500',
    'bg-violet-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-orange-500',
];

function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

// A deleted comment is a tombstone that still occupies its place in the
// thread, but has nothing left to read - it doesn't count toward the
// "N comments" badge. Replies count too, one level deep.
function countActive(list: Comment[]): number {
    let count = 0;
    for (const comment of list) {
        if (!comment.deleted_at) count++;
        count += comment.replies.filter((r) => !r.deleted_at).length;
    }
    return count;
}

function replaceInTree(
    list: Comment[],
    uid: string,
    updated: Comment
): Comment[] {
    return list.map((comment) => {
        if (comment.uid === uid) return updated;
        if (comment.replies.some((r) => r.uid === uid)) {
            return {
                ...comment,
                replies: comment.replies.map((r) =>
                    r.uid === uid ? updated : r
                ),
            };
        }
        return comment;
    });
}

function appendReply(
    list: Comment[],
    parentUid: string,
    reply: Comment
): Comment[] {
    return list.map((comment) =>
        comment.uid === parentUid
            ? { ...comment, replies: [...comment.replies, reply] }
            : comment
    );
}

function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

interface CommentRowProps {
    comment: Comment;
    isReply: boolean;
    onReply?: () => void;
    onDelete: () => void;
}

const CommentRow: React.FC<CommentRowProps> = ({
    comment,
    isReply,
    onReply,
    onDelete,
}) => {
    const { t } = useTranslation();
    const authorName =
        comment.author?.name || t('comments.unknownAuthor', 'Unknown');
    const isDeleted = !!comment.deleted_at;

    return (
        <div className="flex gap-3 group">
            <span
                className={`flex-shrink-0 rounded-full flex items-center justify-center font-semibold text-white ${avatarColor(
                    authorName
                )} ${isReply ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'}`}
                title={authorName}
            >
                {initials(authorName)}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    {comment.author?.person_uid ? (
                        <Link
                            to={`/person/${comment.author.person_uid}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                        >
                            {authorName}
                        </Link>
                    ) : (
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {authorName}
                        </span>
                    )}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTimeAgo(comment.created_at)}
                    </span>
                </div>
                {isDeleted ? (
                    <div className="flex items-center gap-1.5 text-sm italic text-gray-400 dark:text-gray-500 mt-0.5">
                        <NoSymbolIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        {t('comments.deletedPlaceholder', 'Comment deleted')}
                    </div>
                ) : (
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words mt-0.5">
                        {renderBody(comment.body, comment.mentioned_people)}
                    </div>
                )}
                {!isDeleted && (
                    <div className="flex items-center gap-3 mt-1">
                        {onReply && (
                            <button
                                type="button"
                                onClick={onReply}
                                className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                                {t('comments.reply', 'Reply')}
                            </button>
                        )}
                        {comment.is_own && (
                            <button
                                type="button"
                                onClick={onDelete}
                                className="text-xs font-medium text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                                aria-label={t(
                                    'comments.delete',
                                    'Delete comment'
                                )}
                            >
                                {t('comments.delete', 'Delete comment')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const TaskComments: React.FC<TaskCommentsProps> = ({
    task,
    onCommentCountChange,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [people, setPeople] = useState<Person[]>([]);
    const [commentToDelete, setCommentToDelete] = useState<Comment | null>(
        null
    );
    const [replyingToUid, setReplyingToUid] = useState<string | null>(null);

    useEffect(() => {
        if (!task.uid) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetchComments(task.uid)
            .then((data) => {
                if (cancelled) return;
                setComments(data);
                onCommentCountChange?.(countActive(data));
            })
            .catch((err) => {
                console.error('Error fetching comments:', err);
                if (!cancelled) {
                    setError(
                        t('comments.failedToLoad', 'Failed to load comments')
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [task.uid]);

    useEffect(() => {
        const load = task.project_uid
            ? fetchAssignablePeopleForProject(task.project_uid)
            : fetchPeople();
        load.catch(() => []).then((p) => p && setPeople(p));
    }, [task.project_uid]);

    const handleConfirmDelete = async () => {
        if (!commentToDelete) return;
        const target = commentToDelete;
        setCommentToDelete(null);
        try {
            const tombstoned = await deleteComment(target.uid);
            const next = replaceInTree(comments, target.uid, tombstoned);
            setComments(next);
            onCommentCountChange?.(countActive(next));
        } catch (err) {
            console.error('Error deleting comment:', err);
            showErrorToast(
                t('comments.failedToDelete', 'Failed to delete comment')
            );
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <span className="text-sm">
                    {t('comments.loading', 'Loading comments...')}
                </span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-red-500">
                <ExclamationTriangleIcon className="h-6 w-6 mb-2" />
                <span className="text-sm">{error}</span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto w-full">
            {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <ChatBubbleLeftIcon className="h-12 w-12 mb-3 opacity-50" />
                    <span className="text-sm text-center">
                        {t('comments.empty', 'No comments yet')}
                    </span>
                </div>
            ) : (
                <div className="space-y-5 mb-5 max-h-[32rem] overflow-y-auto pr-1">
                    {comments.map((comment) => (
                        <div key={comment.uid}>
                            <CommentRow
                                comment={comment}
                                isReply={false}
                                onReply={() =>
                                    setReplyingToUid((prev) =>
                                        prev === comment.uid
                                            ? null
                                            : comment.uid
                                    )
                                }
                                onDelete={() => setCommentToDelete(comment)}
                            />
                            {(comment.replies.length > 0 ||
                                replyingToUid === comment.uid) && (
                                <div className="ml-12 mt-3 space-y-3">
                                    {comment.replies.map((reply) => (
                                        <CommentRow
                                            key={reply.uid}
                                            comment={reply}
                                            isReply
                                            onDelete={() =>
                                                setCommentToDelete(reply)
                                            }
                                        />
                                    ))}
                                    {replyingToUid === comment.uid && (
                                        <CommentComposer
                                            task={task}
                                            people={people}
                                            parentCommentUid={comment.uid}
                                            compact
                                            autoFocus
                                            placeholder={t(
                                                'comments.replyPlaceholder',
                                                'Write a reply...'
                                            )}
                                            submitLabel={t(
                                                'comments.reply',
                                                'Reply'
                                            )}
                                            onCancel={() =>
                                                setReplyingToUid(null)
                                            }
                                            onSubmitted={(reply) => {
                                                const next = appendReply(
                                                    comments,
                                                    comment.uid,
                                                    reply
                                                );
                                                setComments(next);
                                                onCommentCountChange?.(
                                                    countActive(next)
                                                );
                                                setReplyingToUid(null);
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <CommentComposer
                task={task}
                people={people}
                onSubmitted={(comment) => {
                    const next = [...comments, comment];
                    setComments(next);
                    onCommentCountChange?.(countActive(next));
                }}
            />

            {commentToDelete && (
                <ConfirmDialog
                    title={t('comments.deleteConfirmTitle', 'Delete Comment')}
                    message={t(
                        'comments.deleteConfirmMessage',
                        'Are you sure you want to delete this comment? This action cannot be undone.'
                    )}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setCommentToDelete(null)}
                />
            )}
        </div>
    );
};

export default TaskComments;
