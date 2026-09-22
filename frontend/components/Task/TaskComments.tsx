import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ChatBubbleLeftIcon,
    ExclamationTriangleIcon,
    NoSymbolIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Person } from '../../entities/Person';
import { Comment } from '../../entities/Comment';
import {
    fetchComments,
    createComment,
    deleteComment,
} from '../../utils/commentsService';
import {
    fetchPeople,
    fetchAssignablePeopleForProject,
} from '../../utils/peopleService';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import SuggestionsDropdown from '../Inbox/SuggestionsDropdown';

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
    mentionedPeople: { uid: string; name: string }[],
    isOwn: boolean
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
                className={`font-semibold hover:underline ${
                    isOwn ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'
                }`}
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

const MENTION_CHIP_CLASS =
    'mention-chip font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';

// Reads the composer's caret position out of the live Selection, so a
// mention typed anywhere in the box can be matched to an "@query" - unlike
// a <textarea>, a contentEditable box has no single .value/.selectionStart,
// so this only looks at the text node the caret currently sits in (which
// covers ordinary typing; the caret landing exactly on a node boundary right
// after a just-inserted mention chip is treated as "no trigger").
function findMentionTriggerInEditor(
    root: HTMLElement
): { range: Range; query: string } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        return null;
    }
    const { anchorNode, anchorOffset } = selection;
    if (
        !anchorNode ||
        anchorNode.nodeType !== Node.TEXT_NODE ||
        !root.contains(anchorNode)
    ) {
        return null;
    }

    const text = anchorNode.textContent || '';
    const upToCaret = text.slice(0, anchorOffset);
    const at = upToCaret.lastIndexOf('@');
    if (at === -1) return null;
    if (at > 0 && !/\s/.test(upToCaret[at - 1])) return null;
    const query = upToCaret.slice(at + 1);
    if (/\s/.test(query)) return null;

    const range = document.createRange();
    range.setStart(anchorNode, at);
    range.setEnd(anchorNode, anchorOffset);
    return { range, query };
}

// Replaces the "@query" the trigger range spans with an atomic, non-editable
// mention link, then places the caret right after it.
function insertMentionAtRange(range: Range, person: Person, root: HTMLElement) {
    const anchor = document.createElement('a');
    anchor.href = `/person/${person.uid}`;
    anchor.textContent = `@${person.name}`;
    anchor.contentEditable = 'false';
    anchor.dataset.personUid = person.uid || '';
    anchor.className = MENTION_CHIP_CLASS;

    const space = document.createTextNode(' ');
    const fragment = document.createDocumentFragment();
    fragment.appendChild(anchor);
    fragment.appendChild(space);

    range.deleteContents();
    range.insertNode(fragment);

    const caretRange = document.createRange();
    caretRange.setStart(space, space.length);
    caretRange.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caretRange);
    root.focus();
}

// Walks the composer's DOM to recover the plain comment text (a mention
// chip's "@Name" textContent stands in for itself) and the uids still
// actually present - a chip the user backspaced away is simply absent here.
function serializeEditableContent(root: HTMLElement): {
    text: string;
    mentionedUids: string[];
} {
    let text = '';
    const mentionedUids: string[] = [];
    const seen = new Set<string>();

    const walk = (node: ChildNode) => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent || '';
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        if (el.tagName === 'A' && el.dataset.personUid) {
            text += el.textContent || '';
            const uid = el.dataset.personUid;
            if (!seen.has(uid)) {
                seen.add(uid);
                mentionedUids.push(uid);
            }
            return;
        }
        if (el.tagName === 'BR') {
            text += '\n';
            return;
        }
        el.childNodes.forEach(walk);
    };

    root.childNodes.forEach(walk);
    return { text, mentionedUids };
}

function getCaretCoords(root: HTMLElement): { left: number; top: number } {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(true);
        // Not implemented in jsdom (no real layout engine) - fall through
        // to the root-relative estimate below in that environment.
        if (typeof range.getBoundingClientRect === 'function') {
            const rect = range.getBoundingClientRect();
            if (rect.left || rect.top || rect.width || rect.height) {
                return { left: rect.left, top: rect.bottom + 4 };
            }
        }
    }
    const rootRect = root.getBoundingClientRect();
    return { left: rootRect.left, top: rootRect.top + 20 };
}

// A deleted comment is a tombstone that still occupies its place in the
// thread, but has nothing left to read - it doesn't count toward the
// "N comments" badge.
function countActive(list: Comment[]): number {
    return list.filter((c) => !c.deleted_at).length;
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

const TaskComments: React.FC<TaskCommentsProps> = ({
    task,
    onCommentCountChange,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showErrorToast } = useToast();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasContent, setHasContent] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionPosition, setMentionPosition] = useState({
        left: 0,
        top: 0,
    });
    const [mentionIndex, setMentionIndex] = useState(-1);
    const [people, setPeople] = useState<Person[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState<Comment | null>(
        null
    );
    const editorRef = useRef<HTMLDivElement>(null);
    // The DOM Range the current "@query" spans, captured when the trigger is
    // detected - insertion uses this instead of the live selection, since
    // clicking a dropdown suggestion moves focus off the editor first.
    const mentionRangeRef = useRef<Range | null>(null);

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

    const mentionMatches = (
        mentionQuery === null
            ? []
            : people
                  .filter((p) => !p.archived)
                  .filter((p) =>
                      p.name
                          .toLowerCase()
                          .startsWith(mentionQuery.toLowerCase())
                  )
    ).slice(0, 5);

    const handleEditorInput = () => {
        const root = editorRef.current;
        if (!root) return;

        const { text } = serializeEditableContent(root);
        setHasContent(text.trim().length > 0);
        setMentionIndex(-1);

        const trigger = findMentionTriggerInEditor(root);
        if (trigger) {
            mentionRangeRef.current = trigger.range;
            setMentionQuery(trigger.query);
            setMentionPosition(getCaretCoords(root));
        } else {
            mentionRangeRef.current = null;
            setMentionQuery(null);
        }
    };

    const handleSelectMention = (person: Person) => {
        const root = editorRef.current;
        if (!person.uid || !root || !mentionRangeRef.current) return;

        insertMentionAtRange(mentionRangeRef.current, person, root);
        mentionRangeRef.current = null;
        setMentionQuery(null);
        setMentionIndex(-1);
        setHasContent(true);
    };

    const handleMentionClick = (e: React.MouseEvent) => {
        const target = (e.target as HTMLElement).closest('a[data-person-uid]');
        if (target) {
            e.preventDefault();
            navigate(target.getAttribute('href') || '/');
        }
    };

    // Pasting keeps only plain text - a rich paste (from a webpage, another
    // app) would otherwise carry its own formatting straight into the DOM
    // here, which serializeEditableContent then has to strip out anyway.
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const text = e.clipboardData.getData('text/plain');
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        handleEditorInput();
    };

    const handleSubmit = async () => {
        const root = editorRef.current;
        if (!root || !task.uid || submitting) return;

        const { text, mentionedUids } = serializeEditableContent(root);
        const trimmed = text.trim();
        if (!trimmed) return;

        setSubmitting(true);
        try {
            const comment = await createComment(task.uid, {
                body: trimmed,
                mentionedPersonUids: mentionedUids,
            });
            const next = [...comments, comment];
            setComments(next);
            onCommentCountChange?.(countActive(next));
            root.replaceChildren();
            setHasContent(false);
        } catch (err) {
            console.error('Error posting comment:', err);
            showErrorToast(
                t('comments.failedToPost', 'Failed to post comment')
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!commentToDelete) return;
        const target = commentToDelete;
        setCommentToDelete(null);
        try {
            const tombstoned = await deleteComment(target.uid);
            const next = comments.map((c) =>
                c.uid === target.uid ? tombstoned : c
            );
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
        <div>
            {comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <ChatBubbleLeftIcon className="h-12 w-12 mb-3 opacity-50" />
                    <span className="text-sm text-center">
                        {t('comments.empty', 'No comments yet')}
                    </span>
                </div>
            ) : (
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto pr-1">
                    {comments.map((comment) => {
                        const authorName =
                            comment.author?.name ||
                            t('comments.unknownAuthor', 'Unknown');
                        const isDeleted = !!comment.deleted_at;
                        return (
                            <div
                                key={comment.uid}
                                className={`flex items-end gap-2 group ${
                                    comment.is_own
                                        ? 'flex-row-reverse'
                                        : 'flex-row'
                                }`}
                            >
                                <span
                                    className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white ${avatarColor(
                                        authorName
                                    )}`}
                                    title={authorName}
                                >
                                    {initials(authorName)}
                                </span>
                                <div
                                    className={`flex flex-col max-w-[min(75%,28rem)] ${
                                        comment.is_own
                                            ? 'items-end'
                                            : 'items-start'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 px-1 mb-0.5">
                                        {!comment.is_own &&
                                            (comment.author?.person_uid ? (
                                                <Link
                                                    to={`/person/${comment.author.person_uid}`}
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                                                >
                                                    {authorName}
                                                </Link>
                                            ) : (
                                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                                    {authorName}
                                                </span>
                                            ))}
                                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                            {formatTimeAgo(comment.created_at)}
                                        </span>
                                        {comment.is_own && !isDeleted && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setCommentToDelete(comment)
                                                }
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                                                aria-label={t(
                                                    'comments.delete',
                                                    'Delete comment'
                                                )}
                                            >
                                                <TrashIcon className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    {isDeleted ? (
                                        <div className="flex items-center gap-1.5 text-sm italic px-3 py-2 shadow-sm bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-2xl">
                                            <NoSymbolIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                            {t(
                                                'comments.deletedPlaceholder',
                                                'Comment deleted'
                                            )}
                                        </div>
                                    ) : (
                                        <div
                                            className={`text-sm whitespace-pre-wrap break-words px-3 py-2 shadow-sm ${
                                                comment.is_own
                                                    ? 'bg-blue-500 dark:bg-blue-600 text-white rounded-2xl rounded-br-sm'
                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-bl-sm'
                                            }`}
                                        >
                                            {renderBody(
                                                comment.body,
                                                comment.mentioned_people,
                                                comment.is_own
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="relative">
                {!hasContent && (
                    <span className="pointer-events-none absolute left-2.5 top-2 text-sm text-gray-400 dark:text-gray-500">
                        {t(
                            'comments.placeholder',
                            'Write a comment... use @ to mention someone'
                        )}
                    </span>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label={t('comments.submit', 'Comment')}
                    onInput={handleEditorInput}
                    onClick={handleMentionClick}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                        const hasMentionSuggestions =
                            mentionQuery !== null && mentionMatches.length > 0;

                        if (hasMentionSuggestions) {
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setMentionIndex((prev) =>
                                    prev < mentionMatches.length - 1
                                        ? prev + 1
                                        : 0
                                );
                                return;
                            }
                            if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setMentionIndex((prev) =>
                                    prev > 0
                                        ? prev - 1
                                        : mentionMatches.length - 1
                                );
                                return;
                            }
                            if (e.key === 'Tab') {
                                e.preventDefault();
                                handleSelectMention(
                                    mentionMatches[
                                        mentionIndex >= 0 ? mentionIndex : 0
                                    ]
                                );
                                return;
                            }
                            if (e.key === 'Enter' && mentionIndex >= 0) {
                                e.preventDefault();
                                handleSelectMention(
                                    mentionMatches[mentionIndex]
                                );
                                return;
                            }
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                setMentionQuery(null);
                                setMentionIndex(-1);
                                return;
                            }
                        }

                        if (
                            mentionQuery === null &&
                            e.key === 'Enter' &&
                            (e.metaKey || e.ctrlKey)
                        ) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    className="w-full min-h-[4.5rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 p-2.5 whitespace-pre-wrap break-words focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <SuggestionsDropdown
                    isVisible={
                        mentionQuery !== null && mentionMatches.length > 0
                    }
                    items={mentionMatches}
                    position={mentionPosition}
                    selectedIndex={mentionIndex}
                    onSelect={handleSelectMention}
                    renderLabel={(person) => <>@{person.name}</>}
                />
                <div className="flex justify-end mt-2">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!hasContent || submitting}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 dark:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                    >
                        {t('comments.submit', 'Comment')}
                    </button>
                </div>
            </div>

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
