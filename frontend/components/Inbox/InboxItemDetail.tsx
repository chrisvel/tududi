import React, { useState } from 'react';
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
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';

interface InboxItemDetailProps {
    item: InboxItem;
    onProcess: (id: number) => void;
    onDelete: (id: number) => void;
    onUpdate?: (id: number) => Promise<void>;
    openTaskModal: (task: Task, inboxItemId?: number) => void;
    openProjectModal: (project: Project | null, inboxItemId?: number) => void;
    openNoteModal: (note: Note | null, inboxItemId?: number) => void;
    projects: Project[];
}

const InboxItemDetail: React.FC<InboxItemDetailProps> = ({
    item,
    onProcess, // eslint-disable-line @typescript-eslint/no-unused-vars
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

    // Helper function to parse hashtags from text (consecutive groups anywhere)
    const parseHashtags = (text: string): string[] => {
        const trimmedText = text.trim();
        const matches: string[] = [];

        // Split text into words
        const words = trimmedText.split(/\s+/);
        if (words.length === 0) return matches;

        // Find all consecutive groups of tags/projects
        let i = 0;
        while (i < words.length) {
            // Check if current word starts a tag/project group
            if (words[i].startsWith('#') || words[i].startsWith('+')) {
                // Found start of a group, collect all consecutive tags/projects
                let groupEnd = i;
                while (
                    groupEnd < words.length &&
                    (words[groupEnd].startsWith('#') ||
                        words[groupEnd].startsWith('+'))
                ) {
                    groupEnd++;
                }

                // Process all hashtags in this group
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

                // Skip to end of this group
                i = groupEnd;
            } else {
                i++;
            }
        }

        return matches;
    };

    // Helper function to parse project references from text (consecutive groups anywhere)
    const parseProjectRefs = (text: string): string[] => {
        const trimmedText = text.trim();
        const matches: string[] = [];

        // Tokenize the text handling quoted strings properly
        const tokens = tokenizeText(trimmedText);

        // Find consecutive groups of tags/projects
        let i = 0;
        while (i < tokens.length) {
            // Check if current token starts a tag/project group
            if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
                // Found start of a group, collect all consecutive tags/projects
                let groupEnd = i;
                while (
                    groupEnd < tokens.length &&
                    (tokens[groupEnd].startsWith('#') ||
                        tokens[groupEnd].startsWith('+'))
                ) {
                    groupEnd++;
                }

                // Process all project references in this group
                for (let j = i; j < groupEnd; j++) {
                    if (tokens[j].startsWith('+')) {
                        let projectName = tokens[j].substring(1);

                        // Handle quoted project names
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

                // Skip to end of this group
                i = groupEnd;
            } else {
                i++;
            }
        }

        return matches;
    };

    // Helper function to tokenize text handling quoted strings
    const tokenizeText = (text: string): string[] => {
        const tokens: string[] = [];
        let currentToken = '';
        let inQuotes = false;
        let i = 0;

        while (i < text.length) {
            const char = text[i];

            if (char === '"' && (i === 0 || text[i - 1] === '+')) {
                // Start of a quoted string after +
                inQuotes = true;
                currentToken += char;
            } else if (char === '"' && inQuotes) {
                // End of quoted string
                inQuotes = false;
                currentToken += char;
            } else if (char === ' ' && !inQuotes) {
                // Space outside quotes - end current token
                if (currentToken) {
                    tokens.push(currentToken);
                    currentToken = '';
                }
            } else {
                // Regular character
                currentToken += char;
            }
            i++;
        }

        // Add final token
        if (currentToken) {
            tokens.push(currentToken);
        }

        return tokens;
    };

    // Helper function to clean text by removing tags and project references (consecutive groups anywhere)
    const cleanTextFromTagsAndProjects = (text: string): string => {
        const trimmedText = text.trim();
        const tokens = tokenizeText(trimmedText);
        const cleanedTokens: string[] = [];

        let i = 0;
        while (i < tokens.length) {
            // Check if current token starts a tag/project group
            if (tokens[i].startsWith('#') || tokens[i].startsWith('+')) {
                // Skip this entire consecutive group
                while (
                    i < tokens.length &&
                    (tokens[i].startsWith('#') || tokens[i].startsWith('+'))
                ) {
                    i++;
                }
            } else {
                // Keep regular tokens
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
            // Convert hashtags to Tag objects
            const taskTags = hashtags.map((hashtagName) => {
                // Find existing tag or create a placeholder for new tag
                const existingTag = tags.find(
                    (tag) =>
                        tag.name.toLowerCase() === hashtagName.toLowerCase()
                );
                return existingTag || { name: hashtagName };
            });

            // Find the project to assign (use first project reference if any)
            let projectId = undefined;
            if (projectRefs.length > 0) {
                // Look for an existing project with the first project reference name
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
                priority: 'low',
                tags: taskTags,
                project_id: projectId,
                completed_at: null,
            };

            if (item.id !== undefined) {
                openTaskModal(newTask, item.id);
            } else {
                openTaskModal(newTask);
            }
        } catch (error) {
            console.error('Error converting to task:', error);
        }
    };

    const handleConvertToProject = () => {
        try {
            // Convert hashtags to Tag objects (ignore any existing project references)
            const projectTags = hashtags.map((hashtagName) => {
                // Find existing tag or create a placeholder for new tag
                const existingTag = tags.find(
                    (tag) =>
                        tag.name.toLowerCase() === hashtagName.toLowerCase()
                );
                return existingTag || { name: hashtagName };
            });

            const newProject: Project = {
                name: cleanedContent || item.content,
                description: '',
                active: true,
                tags: projectTags,
            };

            if (item.id !== undefined) {
                openProjectModal(newProject, item.id);
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
                    // Add a timeout to prevent infinite loading
                    const timeoutPromise = new Promise(
                        (_, reject) =>
                            setTimeout(
                                () => reject(new Error('Timeout')),
                                10000
                            ) // 10 second timeout
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
                    // Continue with default title if URL title extraction fails
                    // Still mark as bookmark if it's a URL
                    isBookmark = true;
                } finally {
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error('Error checking URL or extracting title:', error);
            setLoading(false);
        }

        // Convert hashtags to Tag objects and include bookmark tag if needed
        const hashtagTags = hashtags.map((hashtagName) => {
            // Find existing tag or create a placeholder for new tag
            const existingTag = tags.find(
                (tag) => tag.name.toLowerCase() === hashtagName.toLowerCase()
            );
            return existingTag || { name: hashtagName };
        });

        // Combine hashtag tags with bookmark tag if it's a URL
        const bookmarkTag = isBookmark ? [{ name: 'bookmark' }] : [];
        const tagObjects = [...hashtagTags, ...bookmarkTag];

        // Use cleaned content for note title if no URL title was extracted
        const finalTitle =
            title === content ? cleanedContent || item.content : title;
        const finalContent = cleanedContent || item.content;

        // Find the project to assign (use first project reference if any)
        let projectId = undefined;
        if (projectRefs.length > 0) {
            // Look for an existing project with the first project reference name
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
            project_id: projectId,
        };

        if (item.id !== undefined) {
            openNoteModal(newNote, item.id);
        } else {
            openNoteModal(newNote);
        }
    };

    const handleDelete = () => {
        setShowConfirmDialog(true);
    };

    const confirmDelete = () => {
        if (item.id !== undefined) {
            onDelete(item.id);
        }
        setShowConfirmDialog(false);
    };

    return (
        <div
            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 mt-1"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2 gap-2">
                <div className="flex-1">
                    <button
                        onClick={() => {
                            if (onUpdate && item.id !== undefined) {
                                onUpdate(item.id);
                            }
                        }}
                        className="text-base font-medium text-gray-900 dark:text-gray-300 break-words text-left cursor-pointer w-full"
                    >
                        {cleanedContent || item.content}
                    </button>

                    {/* Tags and Projects display - TaskHeader style */}
                    {(hashtags.length > 0 || projectRefs.length > 0) && (
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {/* Projects display first */}
                            {projectRefs.length > 0 && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <span>
                                        {projectRefs.map(
                                            (projectRef, index) => {
                                                // Find matching project
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
                                                                    matchingProject.nanoid
                                                                        ? `/project/${matchingProject.nanoid}-${matchingProject.name
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

                            {/* Add spacing between project and tags */}
                            {projectRefs.length > 0 && hashtags.length > 0 && (
                                <span className="mx-2">•</span>
                            )}

                            {/* Tags display */}
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

                <div className="flex items-center justify-start space-x-1 shrink-0">
                    {loading && <div className="spinner" />}

                    {/* Edit Button */}
                    <button
                        onClick={() => {
                            if (onUpdate && item.id !== undefined) {
                                onUpdate(item.id);
                            }
                        }}
                        className={`p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('common.edit')}
                    >
                        <PencilIcon className="h-4 w-4" />
                    </button>

                    {/* Convert to Task Button */}
                    <button
                        onClick={handleConvertToTask}
                        className={`p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('inbox.createTask')}
                    >
                        <ClipboardDocumentListIcon className="h-4 w-4" />
                    </button>

                    {/* Convert to Project Button */}
                    <button
                        onClick={handleConvertToProject}
                        className={`p-2 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('inbox.createProject')}
                    >
                        <FolderIcon className="h-4 w-4" />
                    </button>

                    {/* Convert to Note Button */}
                    <button
                        onClick={handleConvertToNote}
                        className={`p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('inbox.createNote', 'Create Note')}
                    >
                        <DocumentTextIcon className="h-4 w-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                        onClick={handleDelete}
                        className={`p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded-full transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        title={t('common.delete', 'Delete')}
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
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
