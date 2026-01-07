import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    DocumentTextIcon,
    FolderIcon,
    ClipboardDocumentListIcon,
    TagIcon,
    GlobeAltIcon,
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
import InboxCard from './InboxCard';
import { isUrl } from '../../utils/urlService';

interface InboxItemDetailProps {
    item: InboxItem;
    onDelete: (uid: string) => void;
    onUpdate?: (uid: string, newContent: string) => Promise<void>;
    openTaskModal: (task: Task, inboxItemUid?: string) => void;
    openProjectModal: (project: Project | null, inboxItemUid?: string) => void;
    openNoteModal: (note: Note | null, inboxItemUid?: string) => void;
    projects: Project[];
}

const InboxItemDetail: React.FC<InboxItemDetailProps> = ({
    item,
    onDelete,
    onUpdate,
    openTaskModal,
    openProjectModal,
    openNoteModal,
    projects,
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
        if (!isEditing) {
            return;
        }

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

    const parseHashtags = (text: string): string[] => {
        const trimmedText = text.trim();
        const matches: string[] = [];

        const words = trimmedText.split(/\s+/);
        if (words.length === 0) return matches;

        let i = 0;
        while (i < words.length) {
            if (words[i].startsWith('#') || words[i].startsWith('+')) {
                let groupEnd = i;
                while (
                    groupEnd < words.length &&
                    (words[groupEnd].startsWith('#') ||
                        words[groupEnd].startsWith('+'))
                ) {
                    groupEnd++;
                }

                for (let j = i; j < groupEnd; j++) {
                    if (words[j].startsWith('#')) {
                        const tagName = words[j].substring(1);
                        if (
                            tagName &&
                            /^[a-zA-Z0-9_-]+$/.test(tagName) &&
                            !matches.includes(tagName)
                        ) {
                            matches.push(tagName);
                        }
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
        const trimmedText = text.trim();
        const matches: string[] = [];

        const tokens = tokenizeText(trimmedText);

        let i = 0;
        while (i < tokens.length) {
            if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
                let groupEnd = i;
                while (
                    groupEnd < tokens.length &&
                    (tokens[groupEnd].startsWith('#') ||
                        tokens[groupEnd].startsWith('+'))
                ) {
                    groupEnd++;
                }

                for (let j = i; j < groupEnd; j++) {
                    if (tokens[j].startsWith('+')) {
                        let projectName = tokens[j].substring(1);

                        if (
                            projectName.startsWith('"') &&
                            projectName.endsWith('"')
                        ) {
                            projectName = projectName.slice(1, -1);
                        }

                        if (projectName && !matches.includes(projectName)) {
                            matches.push(projectName);
                        }
                    }
                }

                i = groupEnd;
            } else {
                i++;
            }
        }

        return matches;
    };

    const tokenizeText = (text: string): string[] => {
        const tokens: string[] = [];
        let currentToken = '';
        let inQuotes = false;
        let i = 0;

        while (i < text.length) {
            const char = text[i];

            if (char === '"' && (i === 0 || text[i - 1] === '+')) {
                inQuotes = true;
                currentToken += char;
            } else if (char === '"' && inQuotes) {
                inQuotes = false;
                currentToken += char;
            } else if (char === ' ' && !inQuotes) {
                if (currentToken) {
                    tokens.push(currentToken);
                    currentToken = '';
                }
            } else {
                currentToken += char;
            }
            i++;
        }

        if (currentToken) {
            tokens.push(currentToken);
        }

        return tokens;
    };

    const cleanTextFromTagsAndProjects = (text: string): string => {
        const trimmedText = text.trim();
        const tokens = tokenizeText(trimmedText);
        const cleanedTokens: string[] = [];

        let i = 0;
        while (i < tokens.length) {
            if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
                while (
                    i < tokens.length &&
                    (tokens[i].startsWith('#') || tokens[i].startsWith('+'))
                ) {
                    i++;
                }
            } else {
                cleanedTokens.push(tokens[i]);
                i++;
            }
        }

        return cleanedTokens.join(' ').trim();
    };

    const fullContent = item.content || '';
    const displayText =
        item.title && item.title.trim().length > 0 ? item.title : fullContent;
    const baseContent = fullContent || displayText;
    const cleanedPreviewText = cleanTextFromTagsAndProjects(displayText);
    const previewText =
        cleanedPreviewText.length > 0 ? cleanedPreviewText : displayText;

    const hashtags = useMemo(() => {
        const parsed = parseHashtags(fullContent);
        const hasBookmark = parsed.some(
            (tag) => tag.toLowerCase() === 'bookmark'
        );
        if (!hasBookmark && isUrl(fullContent.trim())) {
            return [...parsed, 'bookmark'];
        }
        return parsed;
    }, [fullContent]);
    const isBookmarkItem = useMemo(
        () => hashtags.some((tag) => tag.toLowerCase() === 'bookmark'),
        [hashtags]
    );
    const projectRefs = parseProjectRefs(fullContent);
    const hasLongContent =
        Boolean(item.title && item.title.trim()) &&
        item.title !== null &&
        item.title !== fullContent;
    const iconTooltip = isBookmarkItem
        ? t('inbox.iconTooltip.bookmark', 'Bookmark link')
        : t('inbox.iconTooltip.text', 'Captured text');

    const slugify = (text: string) =>
        text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

    const getTagLink = (tagName: string) => {
        const tag = tags.find(
            (t) => t.name.toLowerCase() === tagName.toLowerCase()
        );
        if (tag?.uid) {
            return `/tag/${tag.uid}-${slugify(tag.name)}`;
        }
        return `/tag/${encodeURIComponent(tagName)}`;
    };

    const linkifyContent = (text: string): React.ReactNode => {
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matches = [...text.matchAll(urlRegex)];

        if (matches.length === 0) {
            return text;
        }

        const nodes: React.ReactNode[] = [];
        let lastIndex = 0;

        matches.forEach((match, idx) => {
            const start = match.index ?? 0;
            const url = match[0];
            if (start > lastIndex) {
                nodes.push(
                    <React.Fragment key={`text-${idx}-${start}`}>
                        {text.slice(lastIndex, start)}
                    </React.Fragment>
                );
            }
            nodes.push(
                <a
                    key={`url-${idx}-${start}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline break-all"
                >
                    {url}
                </a>
            );
            lastIndex = start + url.length;
        });

        if (lastIndex < text.length) {
            nodes.push(
                <React.Fragment key={`text-tail-${lastIndex}`}>
                    {text.slice(lastIndex)}
                </React.Fragment>
            );
        }

        return nodes;
    };

    const buildConversionPayload = (
        textOverride?: string,
        hashtagOverride?: string[],
        projectRefsOverride?: string[],
        cleanedOverride?: string
    ) => {
        const sourceText = textOverride ?? baseContent;
        const sourceHashtags = hashtagOverride ?? parseHashtags(sourceText);
        const sourceProjectRefs =
            projectRefsOverride ?? parseProjectRefs(sourceText);
        const cleaned =
            cleanedOverride ??
            cleanTextFromTagsAndProjects(sourceText) ??
            sourceText;

        const tagObjects = sourceHashtags.map((hashtagName) => {
            const existingTag = tags.find(
                (tag) => tag.name.toLowerCase() === hashtagName.toLowerCase()
            );
            return existingTag || { name: hashtagName };
        });

        let projectId = undefined;
        if (sourceProjectRefs.length > 0) {
            const projectName = sourceProjectRefs[0];
            const matchingProject = projects.find(
                (project) =>
                    project.name.toLowerCase() === projectName.toLowerCase()
            );
            if (matchingProject) {
                projectId = matchingProject.id;
            }
        }

        return {
            sourceText,
            cleanedContent: cleaned,
            tagObjects,
            projectId,
            projectRefsList: sourceProjectRefs,
            hashtagsList: sourceHashtags,
        };
    };

    const handleConvertToTask = (context?: InboxComposerFooterContext) => {
        try {
            const payload = buildConversionPayload(
                context?.text,
                context?.hashtags,
                context?.projectRefs,
                context?.cleanedText
            );

            const newTask: Task = {
                name: payload.cleanedContent || displayText,
                status: 'not_started',
                priority: null,
                tags: payload.tagObjects,
                project_id: payload.projectId,
                completed_at: null,
            };

            if (item.uid !== undefined) {
                void openTaskModal(newTask, item.uid);
            } else {
                void openTaskModal(newTask);
            }
        } catch (error) {
            console.error('Error converting to task:', error);
        }
    };

    const handleSubmitEdit = async (text: string) => {
        if (!onUpdate || item.uid === undefined) {
            return;
        }

        const trimmedCurrent = baseContent.trim();
        const trimmedNew = text.trim();

        if (trimmedCurrent === trimmedNew) {
            setIsEditing(false);
            return;
        }

        await onUpdate(item.uid, text);
    };

    const handleConvertToProject = (context?: InboxComposerFooterContext) => {
        try {
            const payload = buildConversionPayload(
                context?.text,
                context?.hashtags,
                context?.projectRefs,
                context?.cleanedText
            );

            const newProject: Project = {
                name: payload.cleanedContent || displayText,
                description: '',
                status: 'planned',
                tags: payload.tagObjects,
            };

            if (item.uid !== undefined) {
                openProjectModal(newProject, item.uid);
            } else {
                openProjectModal(newProject);
            }
        } catch (error) {
            console.error('Error converting to project:', error);
        }
    };

    const handleConvertToNote = async (
        context?: InboxComposerFooterContext
    ) => {
        const sourceText = context?.text ?? baseContent;
        let title = sourceText.split('\n')[0] || sourceText.substring(0, 50);
        let content = sourceText;
        let isBookmark = false;

        try {
            const { isUrl: detectUrl, extractUrlTitle } = await import(
                '../../utils/urlService'
            );

            if (detectUrl(sourceText.trim())) {
                setLoading(true);
                try {
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 3000)
                    );

                    const result = (await Promise.race([
                        extractUrlTitle(sourceText.trim()),
                        timeoutPromise,
                    ])) as any;

                    if (result && result.title) {
                        title = result.title;
                        content = sourceText;
                        isBookmark = true;
                    }
                } catch (titleError) {
                    console.error('Error extracting URL title:', titleError);
                    isBookmark = true;
                } finally {
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error('Error checking URL or extracting title:', error);
            setLoading(false);
        }

        const payload = buildConversionPayload(
            context?.text,
            context?.hashtags,
            context?.projectRefs,
            context?.cleanedText
        );

        const bookmarkTag = isBookmark ? [{ name: 'bookmark' }] : [];
        const tagObjects = [...payload.tagObjects, ...bookmarkTag];

        const finalTitle =
            title === content ? payload.cleanedContent || sourceText : title;
        const finalContent = payload.cleanedContent || sourceText;

        const newNote: Note = {
            title: finalTitle,
            content: finalContent,
            tags: tagObjects,
            project_uid: payload.projectId,
        };

        if (item.uid !== undefined) {
            openNoteModal(newNote, item.uid);
        } else {
            openNoteModal(newNote);
        }
    };

    const renderComposerFooter = (context: InboxComposerFooterContext) => (
        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {loading && <div className="spinner h-4 w-4" />}
                    <button
                        onClick={() => handleConvertToTask(context)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-200 dark:focus:ring-offset-gray-900"
                    >
                        <span className="flex items-center gap-1">
                            <span className="sm:hidden text-sm font-semibold leading-none">
                                +
                            </span>
                            <ClipboardDocumentListIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                {t('inbox.createTask', 'Task')}
                            </span>
                        </span>
                    </button>
                    <button
                        onClick={() => handleConvertToNote(context)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-200 dark:focus:ring-offset-gray-900"
                    >
                        <span className="flex items-center gap-1">
                            <span className="sm:hidden text-sm font-semibold leading-none">
                                +
                            </span>
                            <DocumentTextIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                {t('inbox.createNote', 'Note')}
                            </span>
                        </span>
                    </button>
                    <button
                        onClick={() => handleConvertToProject(context)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-200 dark:focus:ring-offset-gray-900"
                    >
                        <span className="flex items-center gap-1">
                            <span className="sm:hidden text-sm font-semibold leading-none">
                                +
                            </span>
                            <FolderIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">
                                {t('inbox.createProject', 'Project')}
                            </span>
                        </span>
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-200 dark:focus:ring-offset-gray-900"
                    >
                        <TrashIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">
                            {t('common.delete', 'Delete')}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );

    const handleDelete = () => {
        setShowConfirmDialog(true);
    };

    const confirmDelete = () => {
        if (item.uid !== undefined) {
            onDelete(item.uid);
        }
        setShowConfirmDialog(false);
    };

    const handleStartEdit = () => {
        if (!isEditing) {
            setIsEditing(true);
        }
    };

    const renderMetadata = () =>
        (hashtags.length > 0 || projectRefs.length > 0) && (
            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                {projectRefs.length > 0 && (
                    <div className="flex items-center">
                        <FolderIcon className="h-3 w-3 mr-1" />
                        <span>
                            {projectRefs.map((projectRef, index) => {
                                const matchingProject = projects.find(
                                    (project) =>
                                        project.name.toLowerCase() ===
                                        projectRef.toLowerCase()
                                );

                                if (matchingProject) {
                                    return (
                                        <React.Fragment key={projectRef}>
                                            <Link
                                                to={
                                                    matchingProject.uid
                                                        ? `/project/${matchingProject.uid}-${matchingProject.name
                                                              .toLowerCase()
                                                              .replace(
                                                                  /[^a-z0-9]+/g,
                                                                  '-'
                                                              )
                                                              .replace(
                                                                  /^-|-$/g,
                                                                  ''
                                                              )}`
                                                        : `/project/${matchingProject.id}`
                                                }
                                                className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                            >
                                                {projectRef}
                                            </Link>
                                            {index < projectRefs.length - 1 &&
                                                ', '}
                                        </React.Fragment>
                                    );
                                }

                                return (
                                    <React.Fragment key={projectRef}>
                                        <span>{projectRef}</span>
                                        {index < projectRefs.length - 1 && ', '}
                                    </React.Fragment>
                                );
                            })}
                        </span>
                    </div>
                )}

                {projectRefs.length > 0 && hashtags.length > 0 && (
                    <span className="mx-2">•</span>
                )}

                {hashtags.length > 0 && (
                    <div className="flex items-center">
                        <TagIcon className="h-3 w-3 mr-1" />
                        <span>
                            {hashtags.map((hashtag, index) => (
                                <React.Fragment key={hashtag}>
                                    <Link
                                        to={getTagLink(hashtag)}
                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                    >
                                        {hashtag}
                                    </Link>
                                    {index < hashtags.length - 1 && ', '}
                                </React.Fragment>
                            ))}
                        </span>
                    </div>
                )}
            </div>
        );

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
                    multiline={hasLongContent}
                />
            ) : (
                <InboxCard className="w-full">
                    <div className="px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div
                                className="flex-shrink-0"
                                title={iconTooltip}
                                aria-label={iconTooltip}
                            >
                                {isBookmarkItem ? (
                                    <GlobeAltIcon className="h-5 w-5 text-blue-500 dark:text-blue-300" />
                                ) : (
                                    <DocumentTextIcon
                                        className={`h-5 w-5 ${
                                            hasLongContent
                                                ? 'text-purple-500 dark:text-purple-300'
                                                : 'text-gray-400 dark:text-gray-500'
                                        }`}
                                    />
                                )}
                            </div>
                            <div className="flex-1">
                                <button
                                    onClick={handleStartEdit}
                                    className="text-base font-medium text-gray-900 dark:text-gray-300 break-words text-left cursor-pointer w-full hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                    {linkifyContent(previewText)}
                                </button>
                            </div>
                        </div>
                        {renderMetadata()}
                    </div>
                </InboxCard>
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
