import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    DocumentTextIcon,
    FolderIcon,
    ClipboardDocumentListIcon,
    TagIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';
import InboxCard from './InboxCard';

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
    const [editedContent, setEditedContent] = useState(item.content);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if (!isEditing && !isDrawerOpen) {
            return;
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsEditing(false);
                setIsDrawerOpen(false);
                setEditedContent(item.content);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEditing, isDrawerOpen, item.content]);

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

    const hashtags = parseHashtags(item.content);
    const projectRefs = parseProjectRefs(item.content);
    const cleanedContent = cleanTextFromTagsAndProjects(item.content);

    const handleConvertToTask = () => {
        try {
            const taskTags = hashtags.map((hashtagName) => {
                const existingTag = tags.find(
                    (tag) =>
                        tag.name.toLowerCase() === hashtagName.toLowerCase()
                );
                return existingTag || { name: hashtagName };
            });

            let projectId = undefined;
            if (projectRefs.length > 0) {
                const projectName = projectRefs[0];
                const matchingProject = projects.find(
                    (project) =>
                        project.name.toLowerCase() === projectName.toLowerCase()
                );
                if (matchingProject) {
                    projectId = matchingProject.id;
                }
            }

            const newTask: Task = {
                name: cleanedContent || item.content,
                status: 'not_started',
                priority: null,
                tags: taskTags,
                project_id: projectId,
                completed_at: null,
            };

            if (item.uid !== undefined) {
                openTaskModal(newTask, item.uid);
            } else {
                openTaskModal(newTask);
            }
        } catch (error) {
            console.error('Error converting to task:', error);
        }
    };

    const handleConvertToProject = () => {
        try {
            const projectTags = hashtags.map((hashtagName) => {
                const existingTag = tags.find(
                    (tag) =>
                        tag.name.toLowerCase() === hashtagName.toLowerCase()
                );
                return existingTag || { name: hashtagName };
            });

            const newProject: Project = {
                name: cleanedContent || item.content,
                description: '',
                state: 'planned',
                tags: projectTags,
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

    const handleConvertToNote = async () => {
        let title =
            item.content.split('\n')[0] || item.content.substring(0, 50);
        let content = item.content;
        let isBookmark = false;

        try {
            const { isUrl, extractUrlTitle } = await import(
                '../../utils/urlService'
            );

            if (isUrl(item.content.trim())) {
                setLoading(true);
                try {
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), 10000)
                    );

                    const result = (await Promise.race([
                        extractUrlTitle(item.content.trim()),
                        timeoutPromise,
                    ])) as any;

                    if (result && result.title) {
                        title = result.title;
                        content = item.content;
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

        const hashtagTags = hashtags.map((hashtagName) => {
            const existingTag = tags.find(
                (tag) => tag.name.toLowerCase() === hashtagName.toLowerCase()
            );
            return existingTag || { name: hashtagName };
        });

        const bookmarkTag = isBookmark ? [{ name: 'bookmark' }] : [];
        const tagObjects = [...hashtagTags, ...bookmarkTag];

        const finalTitle =
            title === content ? cleanedContent || item.content : title;
        const finalContent = cleanedContent || item.content;

        let projectId = undefined;
        if (projectRefs.length > 0) {
            const projectName = projectRefs[0];
            const matchingProject = projects.find(
                (project) =>
                    project.name.toLowerCase() === projectName.toLowerCase()
            );
            if (matchingProject) {
                projectId = matchingProject.id;
            }
        }

        const newNote: Note = {
            title: finalTitle,
            content: finalContent,
            tags: tagObjects,
            project_uid: projectId,
        };

        if (item.uid !== undefined) {
            openNoteModal(newNote, item.uid);
        } else {
            openNoteModal(newNote);
        }
    };

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
            setIsDrawerOpen(true);
            setEditedContent(item.content);
        }
    };

    const handleSaveEdit = async () => {
        if (!onUpdate || item.uid === undefined || !editedContent.trim()) {
            return;
        }

        await onUpdate(item.uid, editedContent.trim());
        setIsEditing(false);
        setIsDrawerOpen(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setIsDrawerOpen(false);
        setEditedContent(item.content);
    };

    const renderDisplayBody = () => (
        <div className="flex flex-col gap-2">
            <p className="text-base font-medium text-gray-900 dark:text-gray-300 break-words">
                {cleanedContent || item.content}
            </p>

            {(hashtags.length > 0 || projectRefs.length > 0) && (
                <div className="flex flex-wrap items-center text-xs text-gray-500 dark:text-gray-400 gap-2">
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
                                                                  .replace(/[^a-z0-9]+/g, '-')
                                                                  .replace(/^-|-$/g, '')}`
                                                            : `/project/${matchingProject.id}`
                                                    }
                                                    className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                >
                                                    {projectRef}
                                                </Link>
                                                {index < projectRefs.length - 1 && ', '}
                                            </React.Fragment>
                                        );
                                    } else {
                                        return (
                                            <React.Fragment key={projectRef}>
                                                <span>{projectRef}</span>
                                                {index < projectRefs.length - 1 && ', '}
                                            </React.Fragment>
                                        );
                                    }
                                })}
                            </span>
                        </div>
                    )}

                    {projectRefs.length > 0 && hashtags.length > 0 && (
                        <span className="mx-1 text-gray-400">•</span>
                    )}

                    {hashtags.length > 0 && (
                        <div className="flex items-center">
                            <TagIcon className="h-3 w-3 mr-1" />
                            <span>
                                {hashtags.map((hashtag, index) => {
                                    return (
                                        <React.Fragment key={hashtag}>
                                            <Link
                                                to={`/tag/${encodeURIComponent(hashtag)}`}
                                                className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                            >
                                                {hashtag}
                                            </Link>
                                            {index < hashtags.length - 1 && ', '}
                                        </React.Fragment>
                                    );
                                })}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderEditBody = () => (
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="relative flex-1">
                <input
                    ref={inputRef}
                    type="text"
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full text-base font-normal bg-transparent text-gray-900 dark:text-gray-100 border-0 focus:outline-none focus:ring-0 px-0 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                    placeholder={t('inbox.captureThought', 'Capture a thought...')}
                />
            </div>
        </div>
    );

    const renderActionsSection = () => (
        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {loading && <div className="spinner h-4 w-4" />}
                    <button
                        onClick={handleConvertToTask}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-200 dark:focus:ring-offset-gray-900"
                    >
                        <ClipboardDocumentListIcon className="h-4 w-4" />
                        + {t('inbox.createTask', 'Task')}
                    </button>
                    <button
                        onClick={handleConvertToNote}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-200 dark:focus:ring-offset-gray-900"
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                        + {t('inbox.createNote', 'Note')}
                    </button>
                    <button
                        onClick={handleConvertToProject}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-200 dark:focus:ring-offset-gray-900"
                    >
                        <FolderIcon className="h-4 w-4" />
                        + {t('inbox.createProject', 'Project')}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-200 dark:focus:ring-offset-gray-900"
                    >
                        <TrashIcon className="h-4 w-4" />
                        {t('common.delete', 'Delete')}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div ref={containerRef} className="mt-3">
            <InboxCard
                isActive={isEditing}
                onClick={!isEditing ? handleStartEdit : undefined}
            >
                <div className="p-4">
                    {isEditing ? renderEditBody() : renderDisplayBody()}
                    {isDrawerOpen && renderActionsSection()}
                </div>
            </InboxCard>
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
