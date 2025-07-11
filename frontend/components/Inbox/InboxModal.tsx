import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../entities/Task';
import { Tag } from '../../entities/Tag';
import { Project } from '../../entities/Project';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { createInboxItemWithStore } from '../../utils/inboxService';
import { isAuthError } from '../../utils/authUtils';
import { createTag } from '../../utils/tagsService';
import { fetchProjects, createProject } from '../../utils/projectsService';
import { XMarkIcon, TagIcon, FolderIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { Link } from 'react-router-dom';
import { isUrl } from '../../utils/urlService';
// import UrlPreview from "../Shared/UrlPreview";
// import { UrlTitleResult } from "../../utils/urlService";

interface InboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => Promise<void>;
    initialText?: string;
    editMode?: boolean;
    onEdit?: (text: string) => Promise<void>;
}

const InboxModal: React.FC<InboxModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialText = '',
    editMode = false,
    onEdit,
}) => {
    const { t } = useTranslation();
    const [inputText, setInputText] = useState<string>(initialText);
    const modalRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { showSuccessToast, showErrorToast } = useToast();
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [saveMode, setSaveMode] = useState<'task' | 'inbox'>('inbox');
    const {
        tagsStore: { tags, setTags },
    } = useStore();
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [cursorPosition, setCursorPosition] = useState(0);
    const [, setCurrentHashtagQuery] = useState('');
    const [, setCurrentProjectQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({
        left: 0,
        top: 0,
    });
    // const [urlPreview, setUrlPreview] = useState<UrlTitleResult | null>(null);

    // Dispatch global modal events to hide floating + button

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

    // Helper function to get current hashtag query at cursor position (only at start/end)
    const getCurrentHashtagQuery = (text: string, position: number): string => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);
        const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);
        
        if (!hashtagMatch) return '';
        
        // Check if hashtag is at start or end position
        const hashtagStart = beforeCursor.lastIndexOf('#');
        const textBeforeHashtag = text.substring(0, hashtagStart).trim();
        const textAfterCursor = afterCursor.trim();
        
        // Check if we're at the very end (no text after cursor)
        if (textAfterCursor === '') {
            return hashtagMatch[1];
        }
        
        // Check if we're at the very beginning
        if (textBeforeHashtag === '') {
            return hashtagMatch[1];
        }
        
        // Check if we're in a consecutive group of tags/projects at the beginning
        const wordsBeforeHashtag = textBeforeHashtag.split(/\s+/).filter(word => word.length > 0);
        const allWordsAreTagsOrProjects = wordsBeforeHashtag.every(word => 
            word.startsWith('#') || word.startsWith('+'));
        
        if (allWordsAreTagsOrProjects) {
            return hashtagMatch[1];
        }
        
        return '';
    };

    // Helper function to get current project query at cursor position (only at start/end)
    const getCurrentProjectQuery = (text: string, position: number): string => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);
        // Match both quoted and unquoted project references
        const projectMatch = beforeCursor.match(/\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/);
        
        if (!projectMatch) return '';
        
        // Get the project name (from quoted or unquoted match)
        const projectQuery = projectMatch[1] || projectMatch[2] || '';
        
        // Check if project ref is at start or end position
        const projectStart = beforeCursor.lastIndexOf('+');
        const textBeforeProject = text.substring(0, projectStart).trim();
        const textAfterCursor = afterCursor.trim();
        
        // Check if we're at the very end (no text after cursor)
        if (textAfterCursor === '') {
            return projectQuery;
        }
        
        // Check if we're at the very beginning
        if (textBeforeProject === '') {
            return projectQuery;
        }
        
        // Check if we're in a consecutive group of tags/projects at the beginning
        const wordsBeforeProject = textBeforeProject.split(/\s+/).filter(word => word.length > 0);
        const allWordsAreTagsOrProjects = wordsBeforeProject.every(word => 
            word.startsWith('#') || word.startsWith('+'));
        
        if (allWordsAreTagsOrProjects) {
            return projectQuery;
        }
        
        return '';
    };

    // Helper function to remove a tag from the input text
    const removeTagFromText = (tagToRemove: string) => {
        const words = inputText.trim().split(/\s+/);
        const filteredWords = words.filter(word => word !== `#${tagToRemove}`);
        const newText = filteredWords.join(' ').trim();
        setInputText(newText);
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    };

    // Helper function to remove a project from the input text
    const removeProjectFromText = (projectToRemove: string) => {
        const words = inputText.trim().split(/\s+/);
        const filteredWords = words.filter(word => word !== `+${projectToRemove}`);
        const newText = filteredWords.join(' ').trim();
        setInputText(newText);
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    };

    // Helper function to render text with clickable hashtags
    // const renderTextWithHashtags = (text: string) => {
    //     const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
    //     return parts.map((part, index) => {
    //         if (part.startsWith('#')) {
    //             const tagName = part.substring(1);
    //             const tag = tags.find(
    //                 (t) => t.name.toLowerCase() === tagName.toLowerCase()
    //             );
    //             if (tag) {
    //                 return (
    //                     <Link
    //                         key={index}
    //                         to={`/tag/${encodeURIComponent(tag.name)}`}
    //                         className="text-blue-600 dark:text-blue-400 hover:underline"
    //                         onClick={(e) => e.stopPropagation()}
    //                     >
    //                         {part}
    //                     </Link>
    //                 );
    //             }
    //         }
    //         return <span key={index}>{part}</span>;
    //     });
    // };

    // Helper function to calculate dropdown position based on cursor
    const calculateDropdownPosition = (
        input: HTMLInputElement,
        cursorPos: number
    ) => {
        // Create a temporary element to measure text width
        const temp = document.createElement('span');
        temp.style.visibility = 'hidden';
        temp.style.position = 'absolute';
        temp.style.fontSize = getComputedStyle(input).fontSize;
        temp.style.fontFamily = getComputedStyle(input).fontFamily;
        temp.style.fontWeight = getComputedStyle(input).fontWeight;
        temp.textContent = inputText.substring(0, cursorPos);

        document.body.appendChild(temp);
        const textWidth = temp.getBoundingClientRect().width;
        document.body.removeChild(temp);

        // Get the # position for the current hashtag or + for project (only at start/end)
        const beforeCursor = inputText.substring(0, cursorPos);
        const afterCursor = inputText.substring(cursorPos);
        const hashtagMatch = beforeCursor.match(/#[a-zA-Z0-9_]*$/);
        const projectMatch = beforeCursor.match(/\+[a-zA-Z0-9_\s]*$/);

        if (hashtagMatch) {
            const hashtagStart = beforeCursor.lastIndexOf('#');
            const textBeforeHashtag = inputText.substring(0, hashtagStart).trim();
            const textAfterCursor = afterCursor.trim();
            
            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let showDropdown = false;
            
            if (textAfterCursor === '' || textBeforeHashtag === '') {
                showDropdown = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeHashtag = textBeforeHashtag.split(/\s+/).filter(word => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeHashtag.every(word => 
                    word.startsWith('#') || word.startsWith('+'));
                if (allWordsAreTagsOrProjects) {
                    showDropdown = true;
                }
            }
            
            if (showDropdown) {
                // Create temp element for text up to hashtag start
                const tempToHashtag = document.createElement('span');
                tempToHashtag.style.visibility = 'hidden';
                tempToHashtag.style.position = 'absolute';
                tempToHashtag.style.fontSize = getComputedStyle(input).fontSize;
                tempToHashtag.style.fontFamily = getComputedStyle(input).fontFamily;
                tempToHashtag.style.fontWeight = getComputedStyle(input).fontWeight;
                tempToHashtag.textContent = inputText.substring(0, hashtagStart);

                document.body.appendChild(tempToHashtag);
                const hashtagOffset = tempToHashtag.getBoundingClientRect().width;
                document.body.removeChild(tempToHashtag);

                return {
                    left: hashtagOffset,
                    top: input.offsetHeight,
                };
            }
        }

        if (projectMatch) {
            const projectStart = beforeCursor.lastIndexOf('+');
            const textBeforeProject = inputText.substring(0, projectStart).trim();
            const textAfterCursor = afterCursor.trim();
            
            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let showDropdown = false;
            
            if (textAfterCursor === '' || textBeforeProject === '') {
                showDropdown = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeProject = textBeforeProject.split(/\s+/).filter(word => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeProject.every(word => 
                    word.startsWith('#') || word.startsWith('+'));
                if (allWordsAreTagsOrProjects) {
                    showDropdown = true;
                }
            }
            
            if (showDropdown) {
                // Create temp element for text up to project start
                const tempToProject = document.createElement('span');
                tempToProject.style.visibility = 'hidden';
                tempToProject.style.position = 'absolute';
                tempToProject.style.fontSize = getComputedStyle(input).fontSize;
                tempToProject.style.fontFamily = getComputedStyle(input).fontFamily;
                tempToProject.style.fontWeight = getComputedStyle(input).fontWeight;
                tempToProject.textContent = inputText.substring(0, projectStart);

                document.body.appendChild(tempToProject);
                const projectOffset = tempToProject.getBoundingClientRect().width;
                document.body.removeChild(tempToProject);

                return {
                    left: projectOffset,
                    top: input.offsetHeight,
                };
            }
        }

        return { left: textWidth, top: input.offsetHeight };
    };

    useEffect(() => {
        if (isOpen && nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, [isOpen]);

    // Load projects when modal opens
    useEffect(() => {
        if (isOpen) {
            const loadProjects = async () => {
                try {
                    const projectsData = await fetchProjects();
                    setProjects(Array.isArray(projectsData) ? projectsData : []);
                } catch (error) {
                    console.error('Failed to load projects:', error);
                    setProjects([]);
                }
            };
            loadProjects();
        }
    }, [isOpen]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        // Cleanup function to restore scroll when component unmounts
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newText = e.target.value;
        const newCursorPosition = e.target.selectionStart || 0;

        setInputText(newText);
        setCursorPosition(newCursorPosition);

        // Check if user is typing a hashtag
        const hashtagQuery = getCurrentHashtagQuery(newText, newCursorPosition);
        setCurrentHashtagQuery(hashtagQuery);

        // Check if user is typing a project reference
        const projectQuery = getCurrentProjectQuery(newText, newCursorPosition);
        setCurrentProjectQuery(projectQuery);

        // Only show suggestions if hashtag/project is at start or end
        if ((newText.charAt(newCursorPosition - 1) === '#' || hashtagQuery) && hashtagQuery !== '') {
            // Hide project suggestions when showing tag suggestions
            setShowProjectSuggestions(false);
            setFilteredProjects([]);

            // Filter tags based on current query
            const filtered = tags
                .filter((tag) =>
                    tag.name
                        .toLowerCase()
                        .startsWith(hashtagQuery.toLowerCase())
                )
                .slice(0, 5); // Limit to 5 suggestions

            // Calculate dropdown position
            const position = calculateDropdownPosition(
                e.target,
                newCursorPosition
            );
            setDropdownPosition(position);

            setFilteredTags(filtered);
            setShowTagSuggestions(true);
        } else if ((newText.charAt(newCursorPosition - 1) === '+' || projectQuery) && projectQuery !== '') {
            // Hide tag suggestions when showing project suggestions
            setShowTagSuggestions(false);
            setFilteredTags([]);

            // Filter projects based on current query
            const filtered = projects
                .filter((project) =>
                    project.name
                        .toLowerCase()
                        .includes(projectQuery.toLowerCase())
                )
                .slice(0, 5); // Limit to 5 suggestions

            // Calculate dropdown position
            const position = calculateDropdownPosition(
                e.target,
                newCursorPosition
            );
            setDropdownPosition(position);

            setFilteredProjects(filtered);
            setShowProjectSuggestions(true);
        } else {
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
        }
    };

    // Helper function to get all tags including auto-detected bookmark
    const getAllTags = (text: string): string[] => {
        const explicitTags = parseHashtags(text);
        
        // Auto-add bookmark if text contains URL and bookmark tag isn't already present
        if (isUrl(text.trim())) {
            const hasBookmarkTag = explicitTags.some(tag => tag.toLowerCase() === 'bookmark');
            if (!hasBookmarkTag) {
                return [...explicitTags, 'bookmark'];
            }
        }
        
        return explicitTags;
    };

    // Handle tag suggestion selection
    const handleTagSelect = (tagName: string) => {
        const beforeCursor = inputText.substring(0, cursorPosition);
        const afterCursor = inputText.substring(cursorPosition);
        const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);

        if (hashtagMatch) {
            const hashtagStart = beforeCursor.lastIndexOf('#');
            const textBeforeHashtag = inputText.substring(0, hashtagStart).trim();
            const textAfterCursor = afterCursor.trim();
            
            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let allowReplacement = false;
            
            if (textAfterCursor === '' || textBeforeHashtag === '') {
                allowReplacement = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeHashtag = textBeforeHashtag.split(/\s+/).filter(word => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeHashtag.every(word => 
                    word.startsWith('#') || word.startsWith('+'));
                if (allWordsAreTagsOrProjects) {
                    allowReplacement = true;
                }
            }
            
            if (allowReplacement) {
                const newText =
                    beforeCursor.replace(/#([a-zA-Z0-9_]*)$/, `#${tagName}`) +
                    afterCursor;
                setInputText(newText);
                setShowTagSuggestions(false);
                setFilteredTags([]);

                // Focus back on input and set cursor position
                setTimeout(() => {
                    if (nameInputRef.current) {
                        nameInputRef.current.focus();
                        const newCursorPos = beforeCursor.replace(
                            /#([a-zA-Z0-9_]*)$/,
                            `#${tagName}`
                        ).length;
                        nameInputRef.current.setSelectionRange(
                            newCursorPos,
                            newCursorPos
                        );
                    }
                }, 0);
            }
        }
    };

    // Handle project suggestion selection
    const handleProjectSelect = (projectName: string) => {
        const beforeCursor = inputText.substring(0, cursorPosition);
        const afterCursor = inputText.substring(cursorPosition);
        // Match both quoted and unquoted project references
        const projectMatch = beforeCursor.match(/\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/);

        if (projectMatch) {
            const projectStart = beforeCursor.lastIndexOf('+');
            const textBeforeProject = inputText.substring(0, projectStart).trim();
            const textAfterCursor = afterCursor.trim();
            
            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let allowReplacement = false;
            
            if (textAfterCursor === '' || textBeforeProject === '') {
                allowReplacement = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeProject = textBeforeProject.split(/\s+/).filter(word => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeProject.every(word => 
                    word.startsWith('#') || word.startsWith('+'));
                if (allWordsAreTagsOrProjects) {
                    allowReplacement = true;
                }
            }
            
            if (allowReplacement) {
                // Automatically add quotes if project name contains spaces
                const formattedProjectName = projectName.includes(' ') 
                    ? `"${projectName}"` 
                    : projectName;
                
                const newText =
                    beforeCursor.replace(/\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/, `+${formattedProjectName}`) +
                    afterCursor;
                setInputText(newText);
                setShowProjectSuggestions(false);
                setFilteredProjects([]);

                // Focus back on input and set cursor position
                setTimeout(() => {
                    if (nameInputRef.current) {
                        nameInputRef.current.focus();
                        const newCursorPos = beforeCursor.replace(
                            /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/,
                            `+${formattedProjectName}`
                        ).length;
                        nameInputRef.current.setSelectionRange(
                            newCursorPos,
                            newCursorPos
                        );
                    }
                }, 0);
            }
        }
    };

    // Helper function to clean text by removing tags and project references at start/end
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

    // Create missing tags automatically
    const createMissingTags = async (text: string): Promise<void> => {
        const hashtagsInText = getAllTags(text);
        const existingTagNames = tags.map((tag) => tag.name.toLowerCase());
        const missingTags = hashtagsInText.filter(
            (tagName) => !existingTagNames.includes(tagName.toLowerCase())
        );

        for (const tagName of missingTags) {
            try {
                const newTag = await createTag({ name: tagName });
                // Update the global tags store
                setTags([...tags, newTag]);
            } catch (error) {
                console.error(`Failed to create tag "${tagName}":`, error);
                // Don't fail the entire operation if tag creation fails
            }
        }
    };

    // Create missing projects automatically
    const createMissingProjects = async (text: string): Promise<void> => {
        const projectsInText = parseProjectRefs(text);
        const existingProjectNames = projects.map((project) => project.name.toLowerCase());
        const missingProjects = projectsInText.filter(
            (projectName) => !existingProjectNames.includes(projectName.toLowerCase())
        );

        for (const projectName of missingProjects) {
            try {
                const newProject = await createProject({ name: projectName, active: true });
                // Update the local projects state
                setProjects([...projects, newProject]);
            } catch (error) {
                console.error(`Failed to create project "${projectName}":`, error);
                // Don't fail the entire operation if project creation fails
            }
        }
    };

    const handleSubmit = useCallback(async () => {
        if (!inputText.trim() || isSaving) return;

        setIsSaving(true);

        try {
            if (editMode && onEdit) {
                // For edit mode, store the original text with tags/projects
                await onEdit(inputText.trim());
                setIsClosing(true);
                setTimeout(() => {
                    onClose();
                    setIsClosing(false);
                }, 300);
                return; // Exit early to prevent creating duplicates
            }

            if (saveMode === 'task') {
                // For task mode, create missing tags and projects, then clean the text
                await createMissingTags(inputText.trim());
                await createMissingProjects(inputText.trim());
                
                const cleanedText = cleanTextFromTagsAndProjects(inputText.trim());
                const newTask: Task = {
                    name: cleanedText,
                    status: 'not_started',
                };

                try {
                    await onSave(newTask);
                    showSuccessToast(t('task.createSuccess'));
                    setInputText('');
                    handleClose();
                } catch (error: any) {
                    // If it's an auth error, don't show error toast (user will be redirected)
                    if (isAuthError(error)) {
                        return;
                    }
                    throw error;
                }
            } else {
                try {
                    // For inbox mode, store the original text with tags/projects
                    // Tags and projects will be created and assigned when the item is processed later
                    await createInboxItemWithStore(inputText.trim());

                    showSuccessToast(t('inbox.itemAdded'));

                    handleClose();
                } catch (error) {
                    console.error('Failed to create inbox item:', error);
                    showErrorToast(t('inbox.addError'));
                    setIsSaving(false);
                }
            }
        } catch (error) {
            console.error('Failed to save:', error);
            if (editMode) {
                showErrorToast(t('inbox.updateError'));
            } else {
                showErrorToast(
                    saveMode === 'task'
                        ? t('task.createError')
                        : t('inbox.addError')
                );
            }
        } finally {
            setIsSaving(false);
        }
    }, [
        inputText,
        isSaving,
        editMode,
        onEdit,
        saveMode,
        onSave,
        showSuccessToast,
        showErrorToast,
        t,
        onClose,
        tags,
        setTags,
        projects,
        setProjects,
    ]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            if (!editMode) {
                setInputText('');
                setSaveMode('inbox');
            }
            setIsClosing(false);
        }, 300);
    }, [onClose, editMode]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                modalRef.current &&
                !modalRef.current.contains(event.target as Node)
            ) {
                if (showTagSuggestions) {
                    setShowTagSuggestions(false);
                    setFilteredTags([]);
                } else if (showProjectSuggestions) {
                    setShowProjectSuggestions(false);
                    setFilteredProjects([]);
                } else {
                    handleClose();
                }
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, showTagSuggestions, showProjectSuggestions, handleClose]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showTagSuggestions) {
                    setShowTagSuggestions(false);
                    setFilteredTags([]);
                } else if (showProjectSuggestions) {
                    setShowProjectSuggestions(false);
                    setFilteredProjects([]);
                } else {
                    handleClose();
                }
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, showTagSuggestions, showProjectSuggestions, handleClose]);

    if (!isOpen) return null;

    return (
        <div
            className={`fixed top-16 left-0 right-0 bottom-0 sm:top-16 flex items-start sm:items-center justify-center bg-gray-900 bg-opacity-80 z-[45] transition-opacity duration-300 ${
                isClosing ? 'opacity-0' : 'opacity-100'
            }`}
        >
            <div
                ref={modalRef}
                className={`relative bg-white dark:bg-gray-800 border-0 sm:border border-gray-200 dark:border-gray-800 sm:rounded-lg sm:shadow-2xl w-full h-full sm:h-auto sm:max-w-2xl md:max-w-3xl transform transition-transform duration-300 ${
                    isClosing ? 'scale-95' : 'scale-100'
                } flex flex-col`}
            >
                {/* Close button - only visible on mobile */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 p-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full shadow-lg transition-colors duration-200 sm:hidden"
                    aria-label="Close"
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>

                <div className="flex-1 flex items-center justify-center sm:block sm:flex-none">
                    <div className="w-full p-6 px-8">
                        <div className="flex flex-col sm:flex-row sm:items-center relative">
                            <div className="relative flex-1">
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    name="text"
                                    value={inputText}
                                    onChange={handleChange}
                                    onSelect={(e) => {
                                        const pos =
                                            e.currentTarget.selectionStart || 0;
                                        setCursorPosition(pos);
                                        // Update dropdown position if showing suggestions
                                        if (showTagSuggestions || showProjectSuggestions) {
                                            const position =
                                                calculateDropdownPosition(
                                                    e.currentTarget,
                                                    pos
                                                );
                                            setDropdownPosition(position);
                                        }
                                    }}
                                    onKeyUp={(e) => {
                                        const pos =
                                            e.currentTarget.selectionStart || 0;
                                        setCursorPosition(pos);
                                        // Update dropdown position if showing suggestions
                                        if (showTagSuggestions || showProjectSuggestions) {
                                            const position =
                                                calculateDropdownPosition(
                                                    e.currentTarget,
                                                    pos
                                                );
                                            setDropdownPosition(position);
                                        }
                                    }}
                                    onClick={(e) => {
                                        const pos =
                                            e.currentTarget.selectionStart || 0;
                                        setCursorPosition(pos);
                                        // Update dropdown position if showing suggestions
                                        if (showTagSuggestions || showProjectSuggestions) {
                                            const position =
                                                calculateDropdownPosition(
                                                    e.currentTarget,
                                                    pos
                                                );
                                            setDropdownPosition(position);
                                        }
                                    }}
                                    required
                                    className="w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white focus:outline-none shadow-sm py-2"
                                    placeholder={t('inbox.captureThought')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && !isSaving) {
                                            // If suggestions are showing and there are filtered options, let the user navigate
                                            if ((showTagSuggestions && filteredTags.length > 0) || 
                                                (showProjectSuggestions && filteredProjects.length > 0)) {
                                                // Don't submit, let the user select from suggestions
                                                return;
                                            }
                                            
                                            // Otherwise, submit the form
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                />

                                {/* Tags display like TaskItem */}
                                {inputText &&
                                    getAllTags(inputText).length > 0 && (
                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                                            <TagIcon className="h-3 w-3 mr-1" />
                                            <div className="flex flex-wrap gap-1">
                                                {getAllTags(inputText).map(
                                                    (tagName, index) => {
                                                        const tag = tags.find(
                                                            (t) =>
                                                                t.name.toLowerCase() ===
                                                                tagName.toLowerCase()
                                                        );

                                                        if (tag) {
                                                            return (
                                                                <span
                                                                    key={index}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                                                                >
                                                                    <Link
                                                                        to={`/tag/${encodeURIComponent(tag.name)}`}
                                                                        className="hover:underline"
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    >
                                                                        {tagName}
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => removeTagFromText(tagName)}
                                                                        className="h-3 w-3 text-blue-400 hover:text-red-500 transition-colors"
                                                                        title="Remove tag"
                                                                    >
                                                                        <XMarkIcon className="h-3 w-3" />
                                                                    </button>
                                                                </span>
                                                            );
                                                        } else {
                                                            return (
                                                                <span
                                                                    key={index}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded text-orange-500 dark:text-orange-400"
                                                                >
                                                                    {tagName}
                                                                    <button
                                                                        onClick={() => removeTagFromText(tagName)}
                                                                        className="h-3 w-3 text-orange-400 hover:text-red-500 transition-colors"
                                                                        title="Remove tag"
                                                                    >
                                                                        <XMarkIcon className="h-3 w-3" />
                                                                    </button>
                                                                </span>
                                                            );
                                                        }
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Projects display like TaskItem */}
                                {inputText &&
                                    parseProjectRefs(inputText).length > 0 && (
                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                                            <FolderIcon className="h-3 w-3 mr-1" />
                                            <div className="flex flex-wrap gap-1">
                                                {parseProjectRefs(inputText).map(
                                                    (projectName, index) => {
                                                        const project = projects.find(
                                                            (p) =>
                                                                p.name.toLowerCase() ===
                                                                projectName.toLowerCase()
                                                        );

                                                        if (project) {
                                                            return (
                                                                <span
                                                                    key={index}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded text-green-600 dark:text-green-400"
                                                                >
                                                                    <Link
                                                                        to={`/projects?project=${encodeURIComponent(project.name)}`}
                                                                        className="hover:underline"
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    >
                                                                        {projectName}
                                                                    </Link>
                                                                    <button
                                                                        onClick={() => removeProjectFromText(projectName)}
                                                                        className="h-3 w-3 text-green-400 hover:text-red-500 transition-colors"
                                                                        title="Remove project"
                                                                    >
                                                                        <XMarkIcon className="h-3 w-3" />
                                                                    </button>
                                                                </span>
                                                            );
                                                        } else {
                                                            return (
                                                                <span
                                                                    key={index}
                                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded text-orange-500 dark:text-orange-400"
                                                                >
                                                                    {projectName}
                                                                    <button
                                                                        onClick={() => removeProjectFromText(projectName)}
                                                                        className="h-3 w-3 text-orange-400 hover:text-red-500 transition-colors"
                                                                        title="Remove project"
                                                                    >
                                                                        <XMarkIcon className="h-3 w-3" />
                                                                    </button>
                                                                </span>
                                                            );
                                                        }
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Tag Suggestions Dropdown */}
                                {showTagSuggestions &&
                                    filteredTags.length > 0 && (
                                        <div
                                            className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
                                            style={{
                                                left: `${dropdownPosition.left}px`,
                                                top: `${dropdownPosition.top + 4}px`,
                                                minWidth: '120px',
                                                maxWidth: '200px',
                                            }}
                                        >
                                            {filteredTags.map((tag, index) => (
                                                <button
                                                    key={tag.id || index}
                                                    onClick={() =>
                                                        handleTagSelect(
                                                            tag.name
                                                        )
                                                    }
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md"
                                                >
                                                    #{tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                {/* Project Suggestions Dropdown */}
                                {showProjectSuggestions &&
                                    filteredProjects.length > 0 && (
                                        <div
                                            className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
                                            style={{
                                                left: `${dropdownPosition.left}px`,
                                                top: `${dropdownPosition.top + 4}px`,
                                                minWidth: '120px',
                                                maxWidth: '200px',
                                            }}
                                        >
                                            {filteredProjects.map((project, index) => (
                                                <button
                                                    key={project.id || index}
                                                    onClick={() =>
                                                        handleProjectSelect(
                                                            project.name
                                                        )
                                                    }
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md"
                                                >
                                                    +{project.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                            </div>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!inputText.trim() || isSaving}
                                className={`mt-4 sm:mt-0 sm:ml-4 inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none ${
                                    inputText.trim() && !isSaving
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-blue-400 cursor-not-allowed'
                                }`}
                            >
                                {isSaving
                                    ? t('common.saving')
                                    : t('common.save')}
                            </button>
                        </div>
                        {/* URL Preview disabled */}
                        {/* <UrlPreview 
            text={inputText} 
            onPreviewChange={setUrlPreview}
          /> */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InboxModal;
