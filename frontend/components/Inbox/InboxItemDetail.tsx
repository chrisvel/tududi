import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    PencilIcon,
    DocumentTextIcon,
    FolderIcon,
    ClipboardDocumentListIcon,
    TagIcon,
    EllipsisVerticalIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';

interface InboxItemDetailProps {
    item: InboxItem;
    onDelete: (uid: string) => void;
    onUpdate?: (uid: string) => Promise<void>;
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
    const [isHovered, setIsHovered] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownId = useRef(
        `dropdown-${Math.random().toString(36).substr(2, 9)}`
    ).current;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isDropdownOpen && buttonRef.current) {
                const target = event.target as Node;
                const isOutsideButton = !buttonRef.current.contains(target);
                const currentDropdown = document.querySelector(
                    `[data-dropdown-id="${dropdownId}"]`
                );
                const isOutsideDropdown = !currentDropdown?.contains(target);

                if (isOutsideButton && isOutsideDropdown) {
                    setIsDropdownOpen(false);
                }
            }
        };

        const handleCloseOtherDropdowns = (event: CustomEvent) => {
            if (event.detail.dropdownId !== dropdownId && isDropdownOpen) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener(
                'closeOtherDropdowns',
                handleCloseOtherDropdowns as EventListener
            );
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener(
                'closeOtherDropdowns',
                handleCloseOtherDropdowns as EventListener
            );
        };
    }, [isDropdownOpen, dropdownId]);

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

    return (
        <div
            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center px-4 py-2 gap-2">
                <div className="flex-1 w-4/5">
                    <button
                        onClick={() => {
                            if (onUpdate && item.uid !== undefined) {
                                onUpdate(item.uid);
                            }
                        }}
                        className="text-base font-medium text-gray-900 dark:text-gray-300 break-words text-left cursor-pointer w-full"
                    >
                        {cleanedContent || item.content}
                    </button>

                    {(hashtags.length > 0 || projectRefs.length > 0) && (
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {projectRefs.length > 0 && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <span>
                                        {projectRefs.map(
                                            (projectRef, index) => {
                                                const matchingProject =
                                                    projects.find(
                                                        (project) =>
                                                            project.name.toLowerCase() ===
                                                            projectRef.toLowerCase()
                                                    );

                                                if (matchingProject) {
                                                    return (
                                                        <React.Fragment
                                                            key={projectRef}
                                                        >
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
                                                            {index <
                                                                projectRefs.length -
                                                                    1 && ', '}
                                                        </React.Fragment>
                                                    );
                                                } else {
                                                    return (
                                                        <React.Fragment
                                                            key={projectRef}
                                                        >
                                                            <span>
                                                                {projectRef}
                                                            </span>
                                                            {index <
                                                                projectRefs.length -
                                                                    1 && ', '}
                                                        </React.Fragment>
                                                    );
                                                }
                                            }
                                        )}
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
                                        {hashtags.map((hashtag, index) => {
                                            return (
                                                <React.Fragment key={hashtag}>
                                                    <Link
                                                        to={`/tag/${encodeURIComponent(hashtag)}`}
                                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                    >
                                                        {hashtag}
                                                    </Link>
                                                    {index <
                                                        hashtags.length - 1 &&
                                                        ', '}
                                                </React.Fragment>
                                            );
                                        })}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="hidden md:flex items-center justify-end w-1/5 space-x-1">
                    {loading && <div className="spinner" />}

                    <button
                        onClick={() => {
                            if (onUpdate && item.uid !== undefined) {
                                onUpdate(item.uid);
                            }
                        }}
                        className={`p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('common.edit')}
                    >
                        <PencilIcon className="h-4 w-4" />
                    </button>

                    <button
                        onClick={handleConvertToTask}
                        className={`p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('inbox.createTask')}
                    >
                        <ClipboardDocumentListIcon className="h-4 w-4" />
                    </button>

                    <button
                        onClick={handleConvertToProject}
                        className={`p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('inbox.createProject')}
                    >
                        <FolderIcon className="h-4 w-4" />
                    </button>

                    <button
                        onClick={handleConvertToNote}
                        className={`p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('inbox.createNote', 'Create Note')}
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                    </button>

                    <button
                        onClick={handleDelete}
                        className={`p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('common.delete', 'Delete')}
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex md:hidden items-center justify-end w-1/5 relative">
                    {loading && <div className="spinner mr-2" />}
                    <button
                        ref={buttonRef}
                        type="button"
                        data-dropdown-button
                        onClick={(e) => {
                            e.stopPropagation();
                            const newOpenState = !isDropdownOpen;

                            if (newOpenState) {
                                document.dispatchEvent(
                                    new CustomEvent('closeOtherDropdowns', {
                                        detail: { dropdownId },
                                    })
                                );
                            }

                            setIsDropdownOpen(newOpenState);
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>

                    {isDropdownOpen && (
                        <div
                            data-dropdown-id={dropdownId}
                            className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] transform-gpu"
                            style={{
                                transform:
                                    buttonRef.current &&
                                    buttonRef.current.getBoundingClientRect()
                                        .bottom +
                                        240 >
                                        window.innerHeight
                                        ? 'translateY(-100%) translateY(-8px)'
                                        : 'none',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="py-1">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onUpdate) {
                                            const identifier =
                                                item.uid ??
                                                (item.id !== undefined
                                                    ? String(item.id)
                                                    : null);

                                            if (identifier) {
                                                onUpdate(identifier);
                                            } else {
                                                console.warn(
                                                    'Inbox item is missing an identifier for update.'
                                                );
                                            }
                                        }
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {t('common.edit', 'Edit')}
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleConvertToTask();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {t('inbox.createTask', 'Create Task')}
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleConvertToProject();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {t('inbox.createProject', 'Create Project')}
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleConvertToNote();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {t('inbox.createNote', 'Create Note')}
                                </button>

                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete();
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    {t('common.delete', 'Delete')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
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
