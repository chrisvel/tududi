import React, { useState, useEffect } from 'react';
import { InboxItem } from '../../entities/InboxItem';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    PencilIcon,
    DocumentTextIcon,
    FolderIcon,
    ClipboardDocumentListIcon,
    TagIcon,
    ExclamationTriangleIcon,
    CalendarIcon,
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
    const [analysisResult, setAnalysisResult] = useState<{
        parsed_tags: string[];
        parsed_projects: string[];
        parsed_priority: string | null;
        cleaned_content: string;
        suggested_type: 'task' | 'note' | null;
        suggested_reason: string | null;
        suggested_priority?: string;
        suggested_tags?: string[];
        suggested_due_date?: string;
    } | null>(null);

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
                while (groupEnd < words.length && (words[groupEnd].startsWith('#') || words[groupEnd].startsWith('+'))) {
                    groupEnd++;
                }
                
                // Process all hashtags in this group
                for (let j = i; j < groupEnd; j++) {
                    if (words[j].startsWith('#')) {
                        const tagName = words[j].substring(1);
                        if (tagName && /^[a-zA-Z0-9_-]+$/.test(tagName) && !matches.includes(tagName)) {
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
                while (groupEnd < tokens.length && (tokens[groupEnd].startsWith('#') || tokens[groupEnd].startsWith('+'))) {
                    groupEnd++;
                }
                
                // Process all project references in this group
                for (let j = i; j < groupEnd; j++) {
                    if (tokens[j].startsWith('+')) {
                        let projectName = tokens[j].substring(1);
                        
                        // Handle quoted project names
                        if (projectName.startsWith('"') && projectName.endsWith('"')) {
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
            
            if (char === '"' && (i === 0 || text[i-1] === '+')) {
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
                while (i < tokens.length && (tokens[i].startsWith('#') || tokens[i].startsWith('+'))) {
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

    // Helper function to parse priority from text using !high, !medium, !low syntax
    const parsePriority = (text: string): string | null => {
        const trimmedText = text.trim();
        const priorityRegex = /!(?:high|medium|low)\b/gi;
        const matches = trimmedText.match(priorityRegex);
        
        if (matches && matches.length > 0) {
            // Return the last priority found (in case of multiple)
            const lastMatch = matches[matches.length - 1];
            return lastMatch.substring(1).toLowerCase(); // Remove ! and convert to lowercase
        }
        
        return null;
    };

    // Helper function to parse due date from text
    const parseDueDate = (text: string): string | null => {
        const trimmedText = text.trim().toLowerCase();
        const now = new Date();
        
        // Check for "today"
        if (trimmedText.includes('today')) {
            return now.toISOString().split('T')[0];
        }
        
        // Check for "tomorrow"
        if (trimmedText.includes('tomorrow')) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }
        
        // Check for "by [day]" patterns
        const dayMatches = trimmedText.match(/(by|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
        if (dayMatches) {
            const dayName = dayMatches[2];
            const targetDay = getNextWeekday(dayName);
            return targetDay.toISOString().split('T')[0];
        }
        
        return null;
    };

    // Helper function to get next occurrence of a weekday
    const getNextWeekday = (dayName: string): Date => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dayName.toLowerCase());
        
        const now = new Date();
        const currentDay = now.getDay();
        
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) {
            daysToAdd += 7; // Next week
        }
        
        const result = new Date(now);
        result.setDate(result.getDate() + daysToAdd);
        return result;
    };

    // Analyze the inbox item content for intelligent suggestions
    useEffect(() => {
        const analyzeItem = async () => {
            try {
                const response = await fetch('/api/inbox/analyze-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ content: item.content }),
                });

                if (response.ok) {
                    const result = await response.json();
                    setAnalysisResult(result);
                }
            } catch (error) {
                console.error('Error analyzing inbox item:', error);
            }
        };

        analyzeItem();
    }, [item.content]);

    const hashtags = parseHashtags(item.content);
    const projectRefs = parseProjectRefs(item.content);
    const cleanedContent = cleanTextFromTagsAndProjects(item.content);
    const LONG_TEXT_THRESHOLD = 150; // Characters threshold for considering text as "long"
    const isLongText = item.content.trim().length > LONG_TEXT_THRESHOLD;
    



    const handleConvertToTask = async () => {
        try {
            // Get intelligent analysis for the inbox item
            const response = await fetch('/api/inbox/analyze-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ content: item.content }),
            });

            let analysisResult = null;
            if (response.ok) {
                analysisResult = await response.json();
            }

            // Combine explicit tags with suggested tags from analysis
            const allTagNames = [
                ...hashtags,
                ...(analysisResult?.suggested_tags || [])
            ];
            
            // Remove duplicates (case-insensitive)
            const uniqueTagNames = allTagNames.filter((tagName, index, array) => 
                array.findIndex(t => t.toLowerCase() === tagName.toLowerCase()) === index
            );

            // Convert to Tag objects
            const taskTags = uniqueTagNames.map((tagName) => {
                const existingTag = tags.find(
                    (tag) => tag.name.toLowerCase() === tagName.toLowerCase()
                );
                return existingTag || { name: tagName };
            });

            // Find the project to assign (use first project reference if any)
            let projectId = undefined;
            const allProjectRefs = [
                ...projectRefs,
                ...(analysisResult?.parsed_projects || [])
            ];
            
            if (allProjectRefs.length > 0) {
                // Look for an existing project with the first project reference name
                const projectName = allProjectRefs[0];
                const matchingProject = projects.find(
                    (project) => project.name.toLowerCase() === projectName.toLowerCase()
                );
                if (matchingProject) {
                    projectId = matchingProject.id;
                }
            }

            // Get priority from analysis or parsed text or default to medium
            const parsedPriority = parsePriority(item.content);
            const finalPriority = analysisResult?.parsed_priority || analysisResult?.suggested_priority || parsedPriority || 'medium';

            // Get due date from analysis
            const dueDate = analysisResult?.suggested_due_date || parseDueDate(item.content);

            const newTask: Task = {
                name: cleanedContent || item.content,
                status: 'not_started',
                priority: finalPriority as 'low' | 'medium' | 'high',
                tags: taskTags,
                project_id: projectId,
                due_date: dueDate || undefined,
                completed_at: null,
            };

            if (item.id !== undefined) {
                openTaskModal(newTask, item.id);
            } else {
                openTaskModal(newTask);
            }
        } catch (error) {
            console.error('Error analyzing inbox item:', error);
            
            // Fallback to basic conversion if analysis fails
            const taskTags = hashtags.map((hashtagName) => {
                const existingTag = tags.find(
                    (tag) => tag.name.toLowerCase() === hashtagName.toLowerCase()
                );
                return existingTag || { name: hashtagName };
            });

            let projectId = undefined;
            if (projectRefs.length > 0) {
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
                priority: parsePriority(item.content) as 'low' | 'medium' | 'high' || 'medium',
                tags: taskTags,
                project_id: projectId,
                due_date: parseDueDate(item.content) || undefined,
                completed_at: null,
            };

            if (item.id !== undefined) {
                openTaskModal(newTask, item.id);
            } else {
                openTaskModal(newTask);
            }
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

        // Get intelligent analysis for suggested tags
        let analysisResult = null;
        try {
            const response = await fetch('/api/inbox/analyze-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ content: item.content }),
            });

            if (response.ok) {
                analysisResult = await response.json();
            }
        } catch (error) {
            console.error('Error analyzing inbox item for note:', error);
        }

        // Combine explicit tags with suggested tags from analysis
        const allTagNames = [
            ...hashtags,
            ...(analysisResult?.suggested_tags || [])
        ];
        
        // Remove duplicates (case-insensitive)
        const uniqueTagNames = allTagNames.filter((tagName, index, array) => 
            array.findIndex(t => t.toLowerCase() === tagName.toLowerCase()) === index
        );

        // Convert hashtags to Tag objects
        const hashtagTags = uniqueTagNames.map((tagName) => {
            // Find existing tag or create a placeholder for new tag
            const existingTag = tags.find(
                (tag) => tag.name.toLowerCase() === tagName.toLowerCase()
            );
            return existingTag || { name: tagName };
        });

        // Combine hashtag tags with bookmark tag if it's a URL
        const bookmarkTag = isBookmark ? [{ name: 'bookmark' }] : [];
        const tagObjects = [...hashtagTags, ...bookmarkTag];

        // Use cleaned content for note title if no URL title was extracted
        const finalTitle = title === content ? (cleanedContent || item.content) : title;
        const finalContent = cleanedContent || item.content;
        
        // Find the project to assign (use first project reference if any)
        let projectId = undefined;
        const allProjectRefs = [
            ...projectRefs,
            ...(analysisResult?.parsed_projects || [])
        ];
        
        if (allProjectRefs.length > 0) {
            // Look for an existing project with the first project reference name
            const projectName = allProjectRefs[0];
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
                    {/* Display title for long text, otherwise show cleaned content */}
                    {item.title && isLongText ? (
                        <div>
                            <p className="text-base font-medium text-gray-900 dark:text-gray-300 break-words">
                                {item.title}
                            </p>
                            <details className="mt-2">
                                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                                    Show full content
                                </summary>
                                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                    {item.content}
                                </div>
                            </details>
                        </div>
                    ) : (
                        <p className="text-base font-medium text-gray-900 dark:text-gray-300 break-words">
                            {cleanedContent || item.content}
                        </p>
                    )}

                    {/* Enhanced metadata display with intelligent analysis */}
                    {(() => {
                        // Combine explicit and suggested tags
                        const allTags = [
                            ...hashtags,
                            ...(analysisResult?.suggested_tags || [])
                        ];
                        const uniqueTags = [...new Set(allTags)]; // Remove duplicates

                        // Combine explicit and suggested projects
                        const allProjects = [
                            ...projectRefs,
                            ...(analysisResult?.parsed_projects || [])
                        ];
                        const uniqueProjects = [...new Set(allProjects)]; // Remove duplicates

                        // Get priority
                        const priority = analysisResult?.parsed_priority || analysisResult?.suggested_priority || parsePriority(item.content);
                        
                        // Get due date
                        const dueDate = analysisResult?.suggested_due_date || parseDueDate(item.content);

                        const hasAnyMetadata = uniqueTags.length > 0 || uniqueProjects.length > 0 || priority || dueDate;

                        return hasAnyMetadata ? (
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                                {/* Projects display first */}
                                {uniqueProjects.length > 0 && (
                                    <div className="flex items-center">
                                        <FolderIcon className="h-3 w-3 mr-1" />
                                        <span>{uniqueProjects.join(', ')}</span>
                                    </div>
                                )}
                                
                                {/* Add spacing */}
                                {uniqueProjects.length > 0 && (uniqueTags.length > 0 || priority || dueDate) && (
                                    <span className="mx-1">•</span>
                                )}
                                
                                {/* Tags display */}
                                {uniqueTags.length > 0 && (
                                    <div className="flex items-center">
                                        <TagIcon className="h-3 w-3 mr-1" />
                                        <span>{uniqueTags.join(', ')}</span>
                                    </div>
                                )}

                                {/* Add spacing */}
                                {uniqueTags.length > 0 && (priority || dueDate) && (
                                    <span className="mx-1">•</span>
                                )}

                                {/* Priority display */}
                                {priority && (
                                    <div className={`flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        priority === 'high' 
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                            : priority === 'medium'
                                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                    }`}>
                                        <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                        {priority}
                                    </div>
                                )}

                                {/* Add spacing */}
                                {priority && dueDate && (
                                    <span className="mx-1">•</span>
                                )}

                                {/* Due date display */}
                                {dueDate && (
                                    <div className="flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded text-xs font-medium">
                                        <CalendarIcon className="h-3 w-3 mr-1" />
                                        {(() => {
                                            const today = new Date().toISOString().split('T')[0];
                                            const tomorrow = new Date();
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            const tomorrowStr = tomorrow.toISOString().split('T')[0];
                                            
                                            if (dueDate === today) return 'Today';
                                            if (dueDate === tomorrowStr) return 'Tomorrow';
                                            return new Date(dueDate).toLocaleDateString();
                                        })()}
                                    </div>
                                )}
                            </div>
                        ) : null;
                    })()}

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
