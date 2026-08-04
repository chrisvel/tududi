import React, { useState, useEffect, useRef } from 'react';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import {
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';
import QuickCaptureInput, {
    InboxComposerFooterContext,
    QuickCaptureInputHandle,
} from './QuickCaptureInput';

interface InboxItemDetailProps {
    item: InboxItem;
    onDelete: (uid: string) => void;
    onUpdate?: (uid: string, newContent: string) => Promise<void>;
    openTaskModal: (task: Task, inboxItemUid?: string) => void;
    openProjectModal: (project: Project | null, inboxItemUid?: string) => void;
    openNoteModal: (note: Note | null, inboxItemUid?: string) => void;
    projects: Project[];
    isNew?: boolean;
    onReClarify?: (uid: string) => void;
}

const InboxItemDetail: React.FC<InboxItemDetailProps> = ({
    item,
    onDelete,
    onUpdate,
    openTaskModal,
    openProjectModal,
    openNoteModal,
    projects,
    isNew = false,
    onReClarify,
}) => {
    const { t } = useTranslation();
    const {
        tagsStore: { tags },
    } = useStore();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<QuickCaptureInputHandle>(null);

    useEffect(() => {
        if (!isEditing) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                if (composerRef.current) {
                    void composerRef.current.submit();
                } else {
                    setIsEditing(false);
                }
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setIsEditing(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isEditing]);

    // ── Parsing helpers ───────────────────────────────────────────────────────

    const tokenizeText = (text: string): string[] => {
        const tokens: string[] = [];
        let currentToken = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"' && (i === 0 || text[i - 1] === '+')) {
                inQuotes = true;
                currentToken += char;
            } else if (char === '"' && inQuotes) {
                inQuotes = false;
                currentToken += char;
            } else if (char === ' ' && !inQuotes) {
                if (currentToken) { tokens.push(currentToken); currentToken = ''; }
            } else {
                currentToken += char;
            }
        }
        if (currentToken) tokens.push(currentToken);
        return tokens;
    };

    const parseHashtags = (text: string): string[] => {
        const words = text.trim().split(/\s+/);
        const matches: string[] = [];
        let i = 0;
        while (i < words.length) {
            if (words[i].startsWith('#') || words[i].startsWith('+')) {
                let groupEnd = i;
                while (groupEnd < words.length && (words[groupEnd].startsWith('#') || words[groupEnd].startsWith('+'))) groupEnd++;
                for (let j = i; j < groupEnd; j++) {
                    if (words[j].startsWith('#')) {
                        const tagName = words[j].substring(1);
                        if (tagName && /^[a-zA-Z0-9_-]+$/.test(tagName) && !matches.includes(tagName)) matches.push(tagName);
                    }
                }
                i = groupEnd;
            } else {
                i++;
            }
        }
        return matches;
    };

    const parseProjectRefs = (text: string): string[] => {
        const tokens = tokenizeText(text.trim());
        const matches: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
                let groupEnd = i;
                while (groupEnd < tokens.length && (tokens[groupEnd].startsWith('#') || tokens[groupEnd].startsWith('+'))) groupEnd++;
                for (let j = i; j < groupEnd; j++) {
                    if (tokens[j].startsWith('+')) {
                        let projectName = tokens[j].substring(1);
                        if (projectName.startsWith('"') && projectName.endsWith('"')) projectName = projectName.slice(1, -1);
                        if (projectName && !matches.includes(projectName)) { matches.push(projectName); return matches; }
                    }
                }
                i = groupEnd;
            } else {
                i++;
            }
        }
        return matches;
    };

    const cleanTextFromTagsAndProjects = (text: string): string => {
        const tokens = tokenizeText(text.trim());
        const cleanedTokens: string[] = [];
        let i = 0;
        while (i < tokens.length) {
            if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
                while (i < tokens.length && (tokens[i].startsWith('#') || tokens[i].startsWith('+'))) i++;
            } else {
                cleanedTokens.push(tokens[i]);
                i++;
            }
        }
        return cleanedTokens.join(' ').trim();
    };

    // Remove a raw token (e.g. "#tag" or "+project") from the item text and save
    const removeTokenFromText = async (raw: string) => {
        if (!onUpdate || item.uid === undefined) return;
        const newText = (item.content || '')
            .replace(raw, '')
            .replace(/ {2,}/g, ' ')
            .trim();
        await onUpdate(item.uid, newText);
    };

    // ── Derived values ────────────────────────────────────────────────────────

    const fullContent = item.content || '';
    const displayText =
        item.title && item.title.trim().length > 0 ? item.title : fullContent;
    const baseContent = fullContent || displayText;


    const extraLineCount = displayText
        .split('\n')
        .filter((l) => l.trim().length > 0).length - 1;

    // ── Inline text segment renderer ──────────────────────────────────────────
    // Parses the first line into plain-text + tag chip + project chip segments

    const renderInlineSegments = (text: string): React.ReactNode => {
        // Only render the first line for the preview
        const firstLine = text.split('\n')[0];
        const re = /#([\w-]+)|\+(?:"([^"]+)"|(\w+))/g;
        const nodes: React.ReactNode[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        let idx = 0;

        while ((m = re.exec(firstLine)) !== null) {
            if (m.index > last) {
                nodes.push(
                    <span key={`t-${idx}`}>{firstLine.slice(last, m.index)}</span>
                );
            }
            const raw = m[0];
            if (m[1]) {
                // #tag
                const tagName = m[1];
                nodes.push(
                    <span
                        key={`tag-${idx}`}
                        className="inline-flex items-center gap-0.5 mx-0.5 align-middle text-[11px] font-semibold leading-none text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-400/10 rounded-full px-2 py-[3px]"
                    >
                        #{tagName}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                void removeTokenFromText(raw);
                            }}
                            className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            aria-label={`Remove tag ${tagName}`}
                        >
                            ×
                        </button>
                    </span>
                );
            } else {
                // +project
                const projectName = m[2] || m[3];
                nodes.push(
                    <span
                        key={`proj-${idx}`}
                        className="inline-flex items-center gap-0.5 mx-0.5 align-middle text-[11px] font-semibold leading-none text-green-700 dark:text-green-300 bg-green-100/70 dark:bg-green-400/10 rounded-full px-2 py-[3px]"
                    >
                        +{projectName}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                void removeTokenFromText(raw);
                            }}
                            className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                            aria-label={`Remove project ${projectName}`}
                        >
                            ×
                        </button>
                    </span>
                );
            }
            last = m.index + m[0].length;
            idx++;
        }

        if (last < firstLine.length) {
            nodes.push(
                <span key={`t-end-${idx}`}>{firstLine.slice(last)}</span>
            );
        }

        return nodes.length > 0 ? nodes : firstLine;
    };

    // ── Conversion helpers ────────────────────────────────────────────────────

    const buildConversionPayload = (
        textOverride?: string,
        hashtagOverride?: string[],
        projectRefsOverride?: string[],
        cleanedOverride?: string
    ) => {
        const sourceText = textOverride ?? baseContent;
        const sourceHashtags = hashtagOverride ?? parseHashtags(sourceText);
        const sourceProjectRefs = projectRefsOverride ?? parseProjectRefs(sourceText);
        const cleaned = cleanedOverride ?? cleanTextFromTagsAndProjects(sourceText) ?? sourceText;

        const tagObjects = sourceHashtags.map((hashtagName) => {
            const existingTag = tags.find((tag) => tag.name.toLowerCase() === hashtagName.toLowerCase());
            return existingTag || { name: hashtagName };
        });

        let projectUid: string | undefined;
        if (sourceProjectRefs.length > 0) {
            const matchingProject = projects.find(
                (p) => p.name.toLowerCase() === sourceProjectRefs[0].toLowerCase()
            );
            if (matchingProject) projectUid = matchingProject.uid;
        }

        return { sourceText, cleanedContent: cleaned, tagObjects, projectUid, projectRefsList: sourceProjectRefs, hashtagsList: sourceHashtags };
    };

    const handleConvertToTask = (context?: InboxComposerFooterContext) => {
        const payload = buildConversionPayload(context?.text, context?.hashtags, context?.projectRefs, context?.cleanedText);
        const newTask: Task = {
            name: payload.cleanedContent || displayText,
            status: 'not_started',
            priority: null,
            tags: payload.tagObjects,
            project_uid: payload.projectUid,
            completed_at: null,
        };
        void openTaskModal(newTask, item.uid);
    };

    const handleConvertToProject = (context?: InboxComposerFooterContext) => {
        const payload = buildConversionPayload(context?.text, context?.hashtags, context?.projectRefs, context?.cleanedText);
        const newProject: Project = {
            name: payload.cleanedContent || displayText,
            description: '',
            status: 'planned',
            tags: payload.tagObjects,
        };
        openProjectModal(newProject, item.uid);
    };

    const handleConvertToNote = async (context?: InboxComposerFooterContext) => {
        const sourceText = context?.text ?? baseContent;
        let title = sourceText.split('\n')[0] || sourceText.substring(0, 50);
        let isBookmark = false;

        try {
            const { isUrl: detectUrl, extractUrlTitle } = await import('../../utils/urlService');
            if (detectUrl(sourceText.trim())) {
                setLoading(true);
                try {
                    const result = (await Promise.race([
                        extractUrlTitle(sourceText.trim()),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
                    ])) as any;
                    if (result?.title) { title = result.title; isBookmark = true; }
                } catch { isBookmark = true; }
                finally { setLoading(false); }
            }
        } catch { setLoading(false); }

        const payload = buildConversionPayload(context?.text, context?.hashtags, context?.projectRefs, context?.cleanedText);
        const bookmarkTag = isBookmark ? [{ name: 'bookmark' }] : [];
        const tagObjects = [...payload.tagObjects, ...bookmarkTag];
        const finalTitle = title === sourceText ? payload.cleanedContent || sourceText : title;

        const newNote: Note = {
            title: finalTitle,
            content: payload.cleanedContent || sourceText,
            tags: tagObjects,
            project_uid: payload.projectUid,
        };
        openNoteModal(newNote, item.uid);
    };

    const handleSubmitEdit = async (text: string) => {
        if (!onUpdate || item.uid === undefined) return;
        if (baseContent.trim() === text.trim()) { setIsEditing(false); return; }
        await onUpdate(item.uid, text);
    };

    const handleDelete = () => setShowConfirmDialog(true);
    const confirmDelete = () => {
        if (item.uid !== undefined) onDelete(item.uid);
        setShowConfirmDialog(false);
    };

    // ── Edit-mode footer ──────────────────────────────────────────────────────

    const renderComposerFooter = (context: InboxComposerFooterContext) => (
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap h-5">
            <div className="flex items-center gap-3.5">
                {loading && (
                    <div className="h-3.5 w-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                )}
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                    {t('inbox.saveAs', 'Save as')}
                </span>
                <button
                    type="button"
                    onClick={() => handleConvertToTask(context)}
                    className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline transition-colors focus:outline-none"
                >
                    {t('inbox.createTask', 'Task')}
                </button>
                <button
                    type="button"
                    onClick={() => void handleConvertToNote(context)}
                    className="text-[12px] text-purple-600 dark:text-purple-400 hover:underline transition-colors focus:outline-none"
                >
                    {t('inbox.createNote', 'Note')}
                </button>
                <button
                    type="button"
                    onClick={() => handleConvertToProject(context)}
                    className="text-[12px] text-green-600 dark:text-green-400 hover:underline transition-colors focus:outline-none"
                >
                    {t('inbox.createProject', 'Project')}
                </button>
                {onReClarify && item.uid && (
                    <>
                        <span className="text-[11px] text-gray-300 dark:text-gray-600 select-none">•</span>
                        <button
                            type="button"
                            onClick={() => { setIsEditing(false); onReClarify(item.uid!); }}
                            className="text-[12px] text-gray-400 dark:text-gray-500 hover:underline transition-colors focus:outline-none"
                        >
                            {t('inbox.reClarifyLink', 'Re-clarify')}
                        </button>
                    </>
                )}
            </div>
            <button
                type="button"
                onClick={handleDelete}
                className="text-[12px] text-red-500 dark:text-red-400 hover:underline transition-colors focus:outline-none"
            >
                {t('common.delete', 'Delete')}
            </button>
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div ref={containerRef}>
            {isEditing ? (
                <QuickCaptureInput
                    ref={composerRef}
                    mode="edit"
                    initialValue={fullContent}
                    hidePrimaryButton
                    projects={projects}
                    onSubmitOverride={handleSubmitEdit}
                    onAfterSubmit={() => setIsEditing(false)}
                    renderFooterActions={renderComposerFooter}
                    openTaskModal={openTaskModal}
                    openProjectModal={openProjectModal}
                    openNoteModal={openNoteModal}
                    cardClassName="mb-0"
                    multiline={true}
                />
            ) : (
                /* ── Flat row (no card, no shadow) ─────────────────────────── */
                <div
                    className={`group flex items-start gap-2.5 px-4 py-2.5 rounded-lg cursor-pointer hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition-colors${isNew ? ' animate-inbox-row-in' : ''}`}
                    onClick={() => setIsEditing(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); } }}
                >
                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-normal text-gray-700 dark:text-gray-300 leading-relaxed break-words">
                            {renderInlineSegments(displayText)}
                            {extraLineCount > 0 && (
                                <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                                    +{extraLineCount}{' '}
                                    {extraLineCount === 1 ? t('inbox.line', 'line') : t('inbox.lines', 'lines')}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Delete button – visible only on hover */}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                        className="flex-shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label={t('common.delete', 'Delete')}
                    >
                        <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {showConfirmDialog && (
                <ConfirmDialog
                    title={t('inbox.deleteConfirmTitle', 'Delete Item')}
                    message={t(
                        'inbox.deleteConfirmMessage',
                        'Are you sure you want to delete this inbox item? This action cannot be undone.'
                    )}
                    onConfirm={confirmDelete}
                    onCancel={() => setShowConfirmDialog(false)}
                />
            )}
        </div>
    );
};

export default InboxItemDetail;
