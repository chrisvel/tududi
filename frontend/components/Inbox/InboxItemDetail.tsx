import React, { useState } from 'react';
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
    onUpdate?: (id: number, content: string) => Promise<void>;
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

    // Helper function to parse hashtags from text (only at start and end)
    const parseHashtags = (text: string): string[] => {
        const trimmedText = text.trim();
        const matches: string[] = [];
        
        // Split text into words
        const words = trimmedText.split(/\s+/);
        if (words.length === 0) return matches;
        
        // Check for hashtags at the beginning (consecutive tags/projects only)
        let startIndex = 0;
        while (startIndex < words.length && (words[startIndex].startsWith('#') || words[startIndex].startsWith('+'))) {
            if (words[startIndex].startsWith('#')) {
                const tagName = words[startIndex].substring(1);
                if (tagName && /^[a-zA-Z0-9_]+$/.test(tagName)) {
                    matches.push(tagName);
                }
            }
            startIndex++;
        }
        
        // Check for hashtags at the end (consecutive tags/projects only)
        let endIndex = words.length - 1;
        while (endIndex >= 0 && (words[endIndex].startsWith('#') || words[endIndex].startsWith('+'))) {
            if (words[endIndex].startsWith('#')) {
                const tagName = words[endIndex].substring(1);
                if (tagName && /^[a-zA-Z0-9_]+$/.test(tagName)) {
                    // Only add if not already added from the beginning
                    if (!matches.includes(tagName)) {
                        matches.push(tagName);
                    }
                }
            }
            endIndex--;
        }
        
        return matches;
    };

    // Helper function to parse project references from text (only at start and end)
    const parseProjectRefs = (text: string): string[] => {
        const trimmedText = text.trim();
        const matches: string[] = [];
        
        // Split text into words/phrases for project references
        const words = trimmedText.split(/\s+/);
        if (words.length === 0) return matches;
        
        // Check for project references at the beginning (consecutive tags/projects only)
        let startIndex = 0;
        while (startIndex < words.length && (words[startIndex].startsWith('+') || words[startIndex].startsWith('#'))) {
            if (words[startIndex].startsWith('+')) {
                const projectName = words[startIndex].substring(1);
                if (projectName && /^[a-zA-Z0-9_\s]+$/.test(projectName)) {
                    matches.push(projectName);
                }
            }
            startIndex++;
        }
        
        // Check for project references at the end (consecutive tags/projects only)
        let endIndex = words.length - 1;
        while (endIndex >= 0 && (words[endIndex].startsWith('+') || words[endIndex].startsWith('#'))) {
            if (words[endIndex].startsWith('+')) {
                const projectName = words[endIndex].substring(1);
                if (projectName && /^[a-zA-Z0-9_\s]+$/.test(projectName)) {
                    // Only add if not already added from the beginning
                    if (!matches.includes(projectName)) {
                        matches.push(projectName);
                    }
                }
            }
            endIndex--;
        }
        
        return matches;
    };

    // Helper function to clean text by removing tags and project references at start/end
    const cleanTextFromTagsAndProjects = (text: string): string => {
        const trimmedText = text.trim();
        const words = trimmedText.split(/\s+/);
        
        if (words.length === 0) return '';
        
        // Find the start and end indices of actual content (non-tags/projects)
        let startIndex = 0;
        let endIndex = words.length - 1;
        
        // Skip tags and projects at the beginning
        while (startIndex < words.length && (words[startIndex].startsWith('#') || words[startIndex].startsWith('+'))) {
            startIndex++;
        }
        
        // Skip tags and projects at the end
        while (endIndex >= 0 && (words[endIndex].startsWith('#') || words[endIndex].startsWith('+'))) {
            endIndex--;
        }
        
        // If all words are tags/projects, return empty string
        if (startIndex > endIndex) {
            return '';
        }
        
        // Return the cleaned content
        return words.slice(startIndex, endIndex + 1).join(' ').trim();
    };

    const hashtags = parseHashtags(item.content);
    const projectRefs = parseProjectRefs(item.content);
    const cleanedContent = cleanTextFromTagsAndProjects(item.content);

    const handleConvertToTask = () => {
        // Convert hashtags to Tag objects
        const taskTags = hashtags.map((hashtagName) => {
            // Find existing tag or create a placeholder for new tag
            const existingTag = tags.find(
                (tag) => tag.name.toLowerCase() === hashtagName.toLowerCase()
            );
            return existingTag || { name: hashtagName };
        });

        // Find the project to assign (use first project reference if any)
        let projectId = undefined;
        if (projectRefs.length > 0) {
            // Look for an existing project with the first project reference name
            const projectName = projectRefs[0];
            const matchingProject = projects.find(
                (project) => project.name.toLowerCase() === projectName.toLowerCase()
            );
            if (matchingProject) {
                projectId = matchingProject.id;
            }
        }

        const newTask: Task = {
            name: cleanedContent || item.content,
            status: 'not_started',
            priority: 'medium',
            tags: taskTags,
            project_id: projectId,
        };

        if (item.id !== undefined) {
            openTaskModal(newTask, item.id);
        } else {
            openTaskModal(newTask);
        }
    };

    const handleConvertToProject = () => {
        // Convert hashtags to Tag objects (ignore any existing project references)
        const projectTags = hashtags.map((hashtagName) => {
            // Find existing tag or create a placeholder for new tag
            const existingTag = tags.find(
                (tag) => tag.name.toLowerCase() === hashtagName.toLowerCase()
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
        const finalTitle = title === content ? (cleanedContent || item.content) : title;
        const finalContent = cleanedContent || item.content;
        
        // Find the project to assign (use first project reference if any)
        let projectId = undefined;
        if (projectRefs.length > 0) {
            // Look for an existing project with the first project reference name
            const projectName = projectRefs[0];
            const matchingProject = projects.find(
                (project) => project.name.toLowerCase() === projectName.toLowerCase()
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
                    <p className="text-base font-medium text-gray-900 dark:text-gray-300 break-words">
                        {cleanedContent || item.content}
                    </p>

                    {/* Tags and Projects display - TaskHeader style */}
                    {(hashtags.length > 0 || projectRefs.length > 0) && (
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {/* Projects display first */}
                            {projectRefs.length > 0 && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <span>{projectRefs.join(', ')}</span>
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
                                    <span>{hashtags.join(', ')}</span>
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
                                onUpdate(item.id, item.content);
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
