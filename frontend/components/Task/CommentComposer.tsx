import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Task } from '../../entities/Task';
import { Person } from '../../entities/Person';
import { Comment } from '../../entities/Comment';
import { createComment } from '../../utils/commentsService';
import { useToast } from '../Shared/ToastContext';
import SuggestionsDropdown from '../Inbox/SuggestionsDropdown';

interface CommentComposerProps {
    task: Task;
    people: Person[];
    parentCommentUid?: string;
    onSubmitted: (comment: Comment) => void;
    placeholder?: string;
    submitLabel?: string;
    autoFocus?: boolean;
    compact?: boolean;
    onCancel?: () => void;
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

// A contentEditable comment box: an inserted @mention becomes a clickable
// link chip immediately, not just after posting. Used both for a new
// top-level comment and, in `compact` mode, for a reply to one.
const CommentComposer: React.FC<CommentComposerProps> = ({
    task,
    people,
    parentCommentUid,
    onSubmitted,
    placeholder,
    submitLabel,
    autoFocus = false,
    compact = false,
    onCancel,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showErrorToast } = useToast();
    const [hasContent, setHasContent] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionPosition, setMentionPosition] = useState({
        left: 0,
        top: 0,
    });
    const [mentionIndex, setMentionIndex] = useState(-1);
    const [submitting, setSubmitting] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    // The DOM Range the current "@query" spans, captured when the trigger is
    // detected - insertion uses this instead of the live selection, since
    // clicking a dropdown suggestion moves focus off the editor first.
    const mentionRangeRef = useRef<Range | null>(null);

    useEffect(() => {
        if (autoFocus) editorRef.current?.focus();
    }, [autoFocus]);

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
                parentCommentUid,
            });
            root.replaceChildren();
            setHasContent(false);
            onSubmitted(comment);
        } catch (err) {
            console.error('Error posting comment:', err);
            showErrorToast(
                t('comments.failedToPost', 'Failed to post comment')
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative">
            <div className="relative">
                {!hasContent && (
                    <span className="pointer-events-none absolute left-2.5 top-2 text-sm text-gray-400 dark:text-gray-500">
                        {placeholder ??
                            t(
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
                    aria-label={submitLabel ?? t('comments.submit', 'Comment')}
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

                        if (e.key === 'Escape' && onCancel) {
                            e.preventDefault();
                            onCancel();
                            return;
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
                    className={`w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        compact ? 'min-h-[2.25rem] p-2' : 'min-h-[4.5rem] p-2.5'
                    }`}
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
            </div>
            <div className="flex justify-end gap-2 mt-2">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!hasContent || submitting}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500 dark:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                >
                    {submitLabel ?? t('comments.submit', 'Comment')}
                </button>
            </div>
        </div>
    );
};

export default CommentComposer;
