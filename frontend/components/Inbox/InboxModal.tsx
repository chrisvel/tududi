import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../entities/Task';
import { Tag } from '../../entities/Tag';
import { Project } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { createInboxItemWithStore } from '../../utils/inboxService';
import { isAuthError } from '../../utils/authUtils';
import { createTag } from '../../utils/tagsService';
import { createProject } from '../../utils/projectsService';
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
    onSaveNote?: (note: Note) => Promise<void>; // For note creation
    initialText?: string;
    editMode?: boolean;
    onEdit?: (text: string) => Promise<void>;
    onConvertToTask?: () => Promise<void>; // Called when editing item gets converted to task
    onConvertToNote?: () => Promise<void>; // Called when editing item gets converted to note
    projects?: Project[]; // Projects passed as props to avoid duplicate API calls
}

const InboxModal: React.FC<InboxModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onSaveNote,
    initialText = '',
    editMode = false,
    onEdit,
    onConvertToTask,
    onConvertToNote,
    projects: propProjects = [],
}) => {
    const { t } = useTranslation();
    const [inputText, setInputText] = useState<string>(initialText);
    const modalRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { showSuccessToast, showErrorToast } = useToast();
    const nameInputRef = useRef<HTMLTextAreaElement>(null);
    const [saveMode, setSaveMode] = useState<'task' | 'inbox'>('inbox');
    const { tagsStore } = useStore();
    const tags = tagsStore.getTags();
    const { setTags } = tagsStore;
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    // Use projects from props instead of local state
    const projects = propProjects;
    const [cursorPosition, setCursorPosition] = useState(0);
    const [, setCurrentHashtagQuery] = useState('');
    const [, setCurrentProjectQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({
        left: 0,
        top: 0,
    });
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    // const [urlPreview, setUrlPreview] = useState<UrlTitleResult | null>(null);

    // Real-time text analysis state
    const [analysisResult, setAnalysisResult] = useState<{
        parsed_tags: string[];
        parsed_projects: string[];
        cleaned_content: string;
        suggested_type: 'task' | 'note' | null;
        suggested_reason: string | null;
    } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout>();

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
        const wordsBeforeHashtag = textBeforeHashtag
            .split(/\s+/)
            .filter((word) => word.length > 0);
        const allWordsAreTagsOrProjects = wordsBeforeHashtag.every(
            (word) => word.startsWith('#') || word.startsWith('+')
        );

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
        const projectMatch = beforeCursor.match(
            /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/
        );

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
        const wordsBeforeProject = textBeforeProject
            .split(/\s+/)
            .filter((word) => word.length > 0);
        const allWordsAreTagsOrProjects = wordsBeforeProject.every(
            (word) => word.startsWith('#') || word.startsWith('+')
        );

        if (allWordsAreTagsOrProjects) {
            return projectQuery;
        }

        return '';
    };

    // Helper function to remove a tag from the input text
    const removeTagFromText = (tagToRemove: string) => {
        const words = inputText.trim().split(/\s+/);
        const filteredWords = words.filter(
            (word) => word !== `#${tagToRemove}`
        );
        const newText = filteredWords.join(' ').trim();
        setInputText(newText);
        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    };

    // Helper function to remove a project from the input text
    const removeProjectFromText = (projectToRemove: string) => {
        const words = inputText.trim().split(/\s+/);
        const filteredWords = words.filter(
            (word) => word !== `+${projectToRemove}`
        );
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
        input: HTMLElement,
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
            const textBeforeHashtag = inputText
                .substring(0, hashtagStart)
                .trim();
            const textAfterCursor = afterCursor.trim();

            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let showDropdown = false;

            if (textAfterCursor === '' || textBeforeHashtag === '') {
                showDropdown = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeHashtag = textBeforeHashtag
                    .split(/\s+/)
                    .filter((word) => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeHashtag.every(
                    (word) => word.startsWith('#') || word.startsWith('+')
                );
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
                tempToHashtag.style.fontFamily =
                    getComputedStyle(input).fontFamily;
                tempToHashtag.style.fontWeight =
                    getComputedStyle(input).fontWeight;
                tempToHashtag.textContent = inputText.substring(
                    0,
                    hashtagStart
                );

                document.body.appendChild(tempToHashtag);
                const hashtagOffset =
                    tempToHashtag.getBoundingClientRect().width;
                document.body.removeChild(tempToHashtag);

                return {
                    left: hashtagOffset,
                    top: input.offsetHeight,
                };
            }
        }

        if (projectMatch) {
            const projectStart = beforeCursor.lastIndexOf('+');
            const textBeforeProject = inputText
                .substring(0, projectStart)
                .trim();
            const textAfterCursor = afterCursor.trim();

            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let showDropdown = false;

            if (textAfterCursor === '' || textBeforeProject === '') {
                showDropdown = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeProject = textBeforeProject
                    .split(/\s+/)
                    .filter((word) => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeProject.every(
                    (word) => word.startsWith('#') || word.startsWith('+')
                );
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
                tempToProject.style.fontFamily =
                    getComputedStyle(input).fontFamily;
                tempToProject.style.fontWeight =
                    getComputedStyle(input).fontWeight;
                tempToProject.textContent = inputText.substring(
                    0,
                    projectStart
                );

                document.body.appendChild(tempToProject);
                const projectOffset =
                    tempToProject.getBoundingClientRect().width;
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

    // Projects are now passed as props, no need to load them

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

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        if (
            (newText.charAt(newCursorPosition - 1) === '#' || hashtagQuery) &&
            hashtagQuery !== ''
        ) {
            // Hide project suggestions when showing tag suggestions
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
            setSelectedSuggestionIndex(-1);

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
            setSelectedSuggestionIndex(-1);
        } else if (
            (newText.charAt(newCursorPosition - 1) === '+' || projectQuery) &&
            projectQuery !== ''
        ) {
            // Hide tag suggestions when showing project suggestions
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setSelectedSuggestionIndex(-1);

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
            setSelectedSuggestionIndex(-1);
        } else {
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
            setSelectedSuggestionIndex(-1);
        }
    };

    // Helper function to get all tags including auto-detected bookmark
    const getAllTags = (text: string): string[] => {
        // Use analysis result if available, otherwise fall back to local parsing
        if (analysisResult) {
            const explicitTags = analysisResult.parsed_tags;

            // Auto-add bookmark if text contains URL or backend suggests URL note
            const isUrlContent =
                isUrl(text.trim()) ||
                analysisResult.suggested_reason === 'url_detected';
            if (isUrlContent) {
                const hasBookmarkTag = explicitTags.some(
                    (tag) => tag.toLowerCase() === 'bookmark'
                );
                if (!hasBookmarkTag) {
                    return [...explicitTags, 'bookmark'];
                }
            }

            return explicitTags;
        }

        // Fallback to local parsing
        const explicitTags = parseHashtags(text);

        // Auto-add bookmark if text contains URL and bookmark tag isn't already present
        if (isUrl(text.trim())) {
            const hasBookmarkTag = explicitTags.some(
                (tag) => tag.toLowerCase() === 'bookmark'
            );
            if (!hasBookmarkTag) {
                return [...explicitTags, 'bookmark'];
            }
        }

        return explicitTags;
    };

    // Helper function to get all project references
    const getAllProjects = (text: string): string[] => {
        // Use analysis result if available, otherwise fall back to local parsing
        if (analysisResult) {
            return analysisResult.parsed_projects;
        }

        // Fallback to local parsing
        return parseProjectRefs(text);
    };

    // Helper function to get cleaned content
    const getCleanedContent = (text: string): string => {
        // Use analysis result if available, otherwise fall back to local cleaning
        if (analysisResult) {
            return analysisResult.cleaned_content;
        }

        // Fallback to local cleaning (simplified version)
        return text
            .replace(/#[a-zA-Z0-9_-]+/g, '')
            .replace(/\+\S+/g, '')
            .trim();
    };

    // Helper function to get suggestion
    const getSuggestion = (): {
        type: 'note' | 'task' | null;
        message: string | null;
        projectName: string | null;
    } => {
        if (!analysisResult || !analysisResult.suggested_type) {
            return { type: null, message: null, projectName: null };
        }

        const projectName = analysisResult.parsed_projects[0] || null;
        const type = analysisResult.suggested_type;

        if (type === 'note') {
            // Check if this is a URL (bookmark) note
            const isUrlNote =
                analysisResult.suggested_reason === 'url_detected';
            const message = isUrlNote
                ? `This item will be saved as a bookmark note for ${projectName}.`
                : `This item will be saved for later processing as it looks like a note for ${projectName}.`;

            return {
                type: 'note',
                message,
                projectName,
            };
        } else if (type === 'task') {
            return {
                type: 'task',
                message: `This item looks like a task and will be created under project ${projectName}.`,
                projectName,
            };
        }

        return { type: null, message: null, projectName: null };
    };

    // Debounced text analysis function
    const analyzeText = useCallback(async (text: string) => {
        if (!text.trim()) {
            setAnalysisResult(null);
            return;
        }

        try {
            setIsAnalyzing(true);
            const response = await fetch('/api/inbox/analyze-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ content: text }),
            });

            if (response.ok) {
                const result = await response.json();
                setAnalysisResult(result);
            } else {
                console.error('Failed to analyze text:', response.statusText);
                setAnalysisResult(null);
            }
        } catch (error) {
            console.error('Error analyzing text:', error);
            setAnalysisResult(null);
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    // Debounced text analysis effect
    useEffect(() => {
        if (analysisTimeoutRef.current) {
            clearTimeout(analysisTimeoutRef.current);
        }

        analysisTimeoutRef.current = setTimeout(() => {
            analyzeText(inputText);
        }, 300); // 300ms debounce

        return () => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, [inputText, analyzeText]);

    // Handle tag suggestion selection
    const handleTagSelect = (tagName: string) => {
        const beforeCursor = inputText.substring(0, cursorPosition);
        const afterCursor = inputText.substring(cursorPosition);
        const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);

        if (hashtagMatch) {
            const hashtagStart = beforeCursor.lastIndexOf('#');
            const textBeforeHashtag = inputText
                .substring(0, hashtagStart)
                .trim();
            const textAfterCursor = afterCursor.trim();

            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let allowReplacement = false;

            if (textAfterCursor === '' || textBeforeHashtag === '') {
                allowReplacement = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeHashtag = textBeforeHashtag
                    .split(/\s+/)
                    .filter((word) => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeHashtag.every(
                    (word) => word.startsWith('#') || word.startsWith('+')
                );
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
                setSelectedSuggestionIndex(-1);

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
        const projectMatch = beforeCursor.match(
            /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/
        );

        if (projectMatch) {
            const projectStart = beforeCursor.lastIndexOf('+');
            const textBeforeProject = inputText
                .substring(0, projectStart)
                .trim();
            const textAfterCursor = afterCursor.trim();

            // Check if we're at the very end, very beginning, or in a consecutive group at start
            let allowReplacement = false;

            if (textAfterCursor === '' || textBeforeProject === '') {
                allowReplacement = true;
            } else {
                // Check if we're in a consecutive group of tags/projects at the beginning
                const wordsBeforeProject = textBeforeProject
                    .split(/\s+/)
                    .filter((word) => word.length > 0);
                const allWordsAreTagsOrProjects = wordsBeforeProject.every(
                    (word) => word.startsWith('#') || word.startsWith('+')
                );
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
                    beforeCursor.replace(
                        /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/,
                        `+${formattedProjectName}`
                    ) + afterCursor;
                setInputText(newText);
                setShowProjectSuggestions(false);
                setFilteredProjects([]);
                setSelectedSuggestionIndex(-1);

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
        const projectsInText = getAllProjects(text);
        const existingProjectNames = projects.map((project) =>
            project.name.toLowerCase()
        );
        const missingProjects = projectsInText.filter(
            (projectName) =>
                !existingProjectNames.includes(projectName.toLowerCase())
        );

        for (const projectName of missingProjects) {
            try {
                await createProject({
                    name: projectName,
                    state: 'planned',
                });
                // Projects are managed by the parent component through props
                // No need to update local state
            } catch (error) {
                console.error(
                    `Failed to create project "${projectName}":`,
                    error
                );
                // Don't fail the entire operation if project creation fails
            }
        }
    };

    const handleSubmit = useCallback(
        async (forceInbox = false) => {
            if (!inputText.trim() || isSaving) return;

            setIsSaving(true);

            try {
                // Check if suggestions are present first, even in edit mode (unless forced to inbox mode)
                if (analysisResult?.suggested_type === 'task' && !forceInbox) {
                    // Auto-convert to task using the same logic as convert to task action
                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = getCleanedContent(inputText.trim());

                    // Convert parsed tags to Tag objects
                    const taskTags = analysisResult.parsed_tags.map(
                        (tagName) => {
                            // Find existing tag or create a placeholder for new tag
                            const existingTag = tags.find(
                                (tag) =>
                                    tag.name.toLowerCase() ===
                                    tagName.toLowerCase()
                            );
                            return existingTag || { name: tagName };
                        }
                    );

                    // Find the project to assign (use first project reference if any)
                    let projectId = undefined;
                    if (analysisResult.parsed_projects.length > 0) {
                        // Look for an existing project with the first project reference name
                        const projectName = analysisResult.parsed_projects[0];
                        const matchingProject = projects.find(
                            (project) =>
                                project.name.toLowerCase() ===
                                projectName.toLowerCase()
                        );
                        if (matchingProject) {
                            projectId = matchingProject.id;
                        }
                    }

                    const newTask: Task = {
                        name: cleanedText,
                        status: 'not_started',
                        priority: 'low',
                        tags: taskTags,
                        project_id: projectId,
                        completed_at: null,
                    };

                    try {
                        await onSave(newTask);
                        showSuccessToast(t('task.createSuccess'));

                        // If in edit mode, we need to mark the original inbox item as processed
                        if (editMode && onConvertToTask) {
                            await onConvertToTask();
                        }

                        setInputText('');
                        handleClose();
                        return;
                    } catch (error: any) {
                        if (isAuthError(error)) {
                            return;
                        }
                        throw error;
                    }
                }

                // Check if it's a note suggestion (bookmark + project) (unless forced to inbox mode)
                if (analysisResult?.suggested_type === 'note' && !forceInbox) {
                    // Auto-convert to note using similar logic
                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = getCleanedContent(inputText.trim());

                    // Convert parsed tags to Tag objects and include bookmark tag
                    const hashtagTags = analysisResult.parsed_tags.map(
                        (tagName) => {
                            const existingTag = tags.find(
                                (tag) =>
                                    tag.name.toLowerCase() ===
                                    tagName.toLowerCase()
                            );
                            return existingTag || { name: tagName };
                        }
                    );

                    // Add bookmark tag for URLs or when suggested reason is url_detected
                    const isUrlContent =
                        isUrl(inputText.trim()) ||
                        analysisResult.suggested_reason === 'url_detected';
                    const bookmarkTag = isUrlContent
                        ? [{ name: 'bookmark' }]
                        : [];

                    // Make sure we don't duplicate bookmark tag if it's already in parsed tags
                    const hasBookmarkInParsed = hashtagTags.some(
                        (tag) => tag.name.toLowerCase() === 'bookmark'
                    );
                    const finalBookmarkTag = hasBookmarkInParsed
                        ? []
                        : bookmarkTag;

                    const taskTags = [...hashtagTags, ...finalBookmarkTag];

                    // Find the project to assign
                    let projectId = undefined;
                    if (analysisResult.parsed_projects.length > 0) {
                        const projectName = analysisResult.parsed_projects[0];
                        const matchingProject = projects.find(
                            (project) =>
                                project.name.toLowerCase() ===
                                projectName.toLowerCase()
                        );
                        if (matchingProject) {
                            projectId = matchingProject.id;
                        }
                    }

                    const newNote: Note = {
                        title: cleanedText || inputText.trim(),
                        content: inputText.trim(),
                        tags: taskTags,
                        project_id: projectId,
                    };

                    try {
                        if (onSaveNote) {
                            await onSaveNote(newNote);
                            showSuccessToast(
                                t(
                                    'note.createSuccess',
                                    'Note created successfully'
                                )
                            );

                            // If in edit mode, we need to mark the original inbox item as processed
                            if (editMode && onConvertToNote) {
                                await onConvertToNote();
                            }

                            setInputText('');
                            handleClose();
                            return;
                        } else {
                            // If no note creation handler, fall back to inbox mode
                        }
                    } catch (error: any) {
                        console.error('Error in note creation flow:', error);
                        if (isAuthError(error)) {
                            return;
                        }
                        throw error;
                    }
                }

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

                const effectiveSaveMode = saveMode;

                if (effectiveSaveMode === 'task') {
                    // For task mode, create missing tags and projects, then clean the text
                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = cleanTextFromTagsAndProjects(
                        inputText.trim()
                    );
                    const newTask: Task = {
                        name: cleanedText,
                        status: 'not_started',
                        completed_at: null,
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
        },
        [
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
            analysisResult,
            createMissingTags,
            createMissingProjects,
            getCleanedContent,
            projects,
        ]
    );

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
                    setSelectedSuggestionIndex(-1);
                } else if (showProjectSuggestions) {
                    setShowProjectSuggestions(false);
                    setFilteredProjects([]);
                    setSelectedSuggestionIndex(-1);
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
                    setSelectedSuggestionIndex(-1);
                } else if (showProjectSuggestions) {
                    setShowProjectSuggestions(false);
                    setFilteredProjects([]);
                    setSelectedSuggestionIndex(-1);
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

                <div className="flex-1 flex items-start justify-center sm:block sm:flex-none pt-12 sm:pt-0">
                    <div className="w-full p-6 px-8">
                        <div className="flex flex-col sm:flex-row sm:items-center relative">
                            <div className="relative flex-1">
                                <textarea
                                    ref={nameInputRef}
                                    name="text"
                                    value={inputText}
                                    onChange={handleChange}
                                    onSelect={(e) => {
                                        const pos =
                                            e.currentTarget.selectionStart || 0;
                                        setCursorPosition(pos);
                                        // Update dropdown position if showing suggestions
                                        if (
                                            showTagSuggestions ||
                                            showProjectSuggestions
                                        ) {
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
                                        if (
                                            showTagSuggestions ||
                                            showProjectSuggestions
                                        ) {
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
                                        if (
                                            showTagSuggestions ||
                                            showProjectSuggestions
                                        ) {
                                            const position =
                                                calculateDropdownPosition(
                                                    e.currentTarget,
                                                    pos
                                                );
                                            setDropdownPosition(position);
                                        }
                                    }}
                                    required
                                    rows={1}
                                    className="w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white focus:outline-none shadow-sm py-2 resize-none overflow-hidden"
                                    placeholder={t('inbox.captureThought')}
                                    onKeyDown={(e) => {
                                        // Handle dropdown navigation
                                        if (
                                            showTagSuggestions &&
                                            filteredTags.length > 0
                                        ) {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setSelectedSuggestionIndex(
                                                    (prev) =>
                                                        prev <
                                                        filteredTags.length - 1
                                                            ? prev + 1
                                                            : 0
                                                );
                                                return;
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setSelectedSuggestionIndex(
                                                    (prev) =>
                                                        prev > 0
                                                            ? prev - 1
                                                            : filteredTags.length -
                                                              1
                                                );
                                                return;
                                            } else if (e.key === 'Tab') {
                                                e.preventDefault();
                                                const selectedTag =
                                                    selectedSuggestionIndex >= 0
                                                        ? filteredTags[
                                                              selectedSuggestionIndex
                                                          ]
                                                        : filteredTags[0];
                                                handleTagSelect(
                                                    selectedTag.name
                                                );
                                                return;
                                            } else if (
                                                e.key === 'Enter' &&
                                                selectedSuggestionIndex >= 0
                                            ) {
                                                e.preventDefault();
                                                handleTagSelect(
                                                    filteredTags[
                                                        selectedSuggestionIndex
                                                    ].name
                                                );
                                                return;
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setShowTagSuggestions(false);
                                                setFilteredTags([]);
                                                setSelectedSuggestionIndex(-1);
                                                return;
                                            }
                                        }

                                        // Handle project dropdown navigation
                                        if (
                                            showProjectSuggestions &&
                                            filteredProjects.length > 0
                                        ) {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setSelectedSuggestionIndex(
                                                    (prev) =>
                                                        prev <
                                                        filteredProjects.length -
                                                            1
                                                            ? prev + 1
                                                            : 0
                                                );
                                                return;
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setSelectedSuggestionIndex(
                                                    (prev) =>
                                                        prev > 0
                                                            ? prev - 1
                                                            : filteredProjects.length -
                                                              1
                                                );
                                                return;
                                            } else if (e.key === 'Tab') {
                                                e.preventDefault();
                                                const selectedProject =
                                                    selectedSuggestionIndex >= 0
                                                        ? filteredProjects[
                                                              selectedSuggestionIndex
                                                          ]
                                                        : filteredProjects[0];
                                                handleProjectSelect(
                                                    selectedProject.name
                                                );
                                                return;
                                            } else if (
                                                e.key === 'Enter' &&
                                                selectedSuggestionIndex >= 0
                                            ) {
                                                e.preventDefault();
                                                handleProjectSelect(
                                                    filteredProjects[
                                                        selectedSuggestionIndex
                                                    ].name
                                                );
                                                return;
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setShowProjectSuggestions(
                                                    false
                                                );
                                                setFilteredProjects([]);
                                                setSelectedSuggestionIndex(-1);
                                                return;
                                            }
                                        }

                                        // Handle form submission
                                        if (
                                            e.key === 'Enter' &&
                                            !e.shiftKey &&
                                            !isSaving
                                        ) {
                                            // If suggestions are showing and there are filtered options, don't submit
                                            if (
                                                (showTagSuggestions &&
                                                    filteredTags.length > 0) ||
                                                (showProjectSuggestions &&
                                                    filteredProjects.length > 0)
                                            ) {
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
                                                                        {
                                                                            tagName
                                                                        }
                                                                    </Link>
                                                                    <button
                                                                        onClick={() =>
                                                                            removeTagFromText(
                                                                                tagName
                                                                            )
                                                                        }
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
                                                                        onClick={() =>
                                                                            removeTagFromText(
                                                                                tagName
                                                                            )
                                                                        }
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
                                    getAllProjects(inputText).length > 0 && (
                                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                                            <FolderIcon className="h-3 w-3 mr-1" />
                                            <div className="flex flex-wrap gap-1">
                                                {getAllProjects(inputText).map(
                                                    (projectName, index) => {
                                                        const project =
                                                            projects.find(
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
                                                                        {
                                                                            projectName
                                                                        }
                                                                    </Link>
                                                                    <button
                                                                        onClick={() =>
                                                                            removeProjectFromText(
                                                                                projectName
                                                                            )
                                                                        }
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
                                                                    {
                                                                        projectName
                                                                    }
                                                                    <button
                                                                        onClick={() =>
                                                                            removeProjectFromText(
                                                                                projectName
                                                                            )
                                                                        }
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
                                                    key={
                                                        tag.uid ||
                                                        tag.id ||
                                                        index
                                                    }
                                                    onClick={() =>
                                                        handleTagSelect(
                                                            tag.name
                                                        )
                                                    }
                                                    className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md ${
                                                        selectedSuggestionIndex ===
                                                        index
                                                            ? 'bg-blue-100 dark:bg-blue-800'
                                                            : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}
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
                                            {filteredProjects.map(
                                                (project, index) => (
                                                    <button
                                                        key={
                                                            project.id || index
                                                        }
                                                        onClick={() =>
                                                            handleProjectSelect(
                                                                project.name
                                                            )
                                                        }
                                                        className={`w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md ${
                                                            selectedSuggestionIndex ===
                                                            index
                                                                ? 'bg-blue-100 dark:bg-blue-800'
                                                                : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        +{project.name}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}

                                {/* Intelligent Suggestion */}
                                {(() => {
                                    const suggestion = getSuggestion();
                                    return suggestion.type &&
                                        suggestion.message ? (
                                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start flex-1">
                                                    <div className="text-purple-600 dark:text-purple-400 mr-2 mt-0.5">
                                                        {/* AI Stars Icon */}
                                                        <svg
                                                            className="h-4 w-4"
                                                            fill="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path d="M12 2l2.09 6.26L20 10.27l-5.91 2.01L12 18.54l-2.09-6.26L4 10.27l5.91-2.01L12 2z" />
                                                            <path d="M8 1l1.18 3.52L12 5.64l-2.82.96L8 10.12l-1.18-3.52L4 5.64l2.82-.96L8 1z" />
                                                            <path d="M20 14l.79 2.37L23 17.45l-2.21.75L20 20.57l-.79-2.37L17 17.45l2.21-.75L20 14z" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
                                                            {suggestion.message}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="text-gray-600 dark:text-gray-400">
                                                                or
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    setSaveMode(
                                                                        'inbox'
                                                                    );
                                                                    handleSubmit(
                                                                        true
                                                                    ); // Pass true to force inbox mode
                                                                }}
                                                                className="text-purple-600 dark:text-purple-400 hover:underline"
                                                            >
                                                                save as inbox
                                                                item instead
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                {isAnalyzing && (
                                                    <div className="ml-2 h-3 w-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                                )}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSubmit(false)} // Explicitly allow intelligent suggestions
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
