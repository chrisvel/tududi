import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    XMarkIcon,
    TagIcon,
    FolderIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    FireIcon,
    CalendarDaysIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Task, PriorityType, StatusType } from '../../entities/Task';
import { Project, ProjectState } from '../../entities/Project';
import { Note } from '../../entities/Note';
import { Tag } from '../../entities/Tag';
import { Area } from '../../entities/Area';
import { useToast } from '../Shared/ToastContext';
import { useTranslation } from 'react-i18next';
import { createInboxItemWithStore } from '../../utils/inboxService';
import { isAuthError } from '../../utils/authUtils';
import { createTag } from '../../utils/tagsService';
import { createProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { Link } from 'react-router-dom';
import { isUrl } from '../../utils/urlService';
import PriorityDropdown from '../Shared/PriorityDropdown';

type EntityType = 'inbox' | 'task' | 'project' | 'note' | 'area' | 'tag';

interface EntityBadge {
    type: EntityType;
    label: string;
    color: string;
    icon?: React.ReactNode;
}

interface UniversalInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveTask: (task: Task) => Promise<void>;
    onSaveNote?: (note: Note) => Promise<void>;
    onSaveProject?: (project: Project) => Promise<void>;
    projects?: Project[];
}

const entityBadges: EntityBadge[] = [
    {
        type: 'inbox',
        label: 'Inbox',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    },
    {
        type: 'task',
        label: 'Task',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    {
        type: 'project',
        label: 'Project',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    {
        type: 'note',
        label: 'Note',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
];

const UniversalInputModal: React.FC<UniversalInputModalProps> = ({
    isOpen,
    onClose,
    onSaveTask,
    onSaveNote,
    onSaveProject,
    projects: propProjects = [],
}) => {
    const { t } = useTranslation();
    const [selectedEntityType, setSelectedEntityType] =
        useState<EntityType>('inbox');
    const [inputText, setInputText] = useState<string>('');
    const modalRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { showSuccessToast, showErrorToast } = useToast();
    const nameInputRef = useRef<HTMLInputElement>(null);
    const { tagsStore } = useStore();
    const tags = tagsStore.getTags();
    const { setTags } = tagsStore;
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
    const [selectedPriority, setSelectedPriority] =
        useState<PriorityType | null>(null);
    const [selectedPriorityIndex, setSelectedPriorityIndex] = useState(-1);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDueDate, setSelectedDueDate] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [selectedSlashIndex, setSelectedSlashIndex] = useState(-1);
    const projects = propProjects;
    const [cursorPosition, setCursorPosition] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({
        left: 0,
        top: 0,
    });
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

    // Priority options for dropdown
    const priorityOptions: PriorityType[] = ['low', 'medium', 'high'];

    // Slash command menu options
    type SlashCommand = 'project' | 'tag' | 'priority' | 'duedate';
    interface SlashMenuItem {
        command: SlashCommand;
        label: string;
        icon: React.ReactNode;
        description: string;
    }

    const slashMenuItems: SlashMenuItem[] = [
        {
            command: 'duedate',
            label: 'Due Date',
            icon: <CalendarDaysIcon className="h-4 w-4" />,
            description: 'Set a due date',
        },
        {
            command: 'priority',
            label: 'Priority',
            icon: <FireIcon className="h-4 w-4" />,
            description: 'Set priority level',
        },
        {
            command: 'project',
            label: 'Project',
            icon: <FolderIcon className="h-4 w-4" />,
            description: 'Add to a project',
        },
        {
            command: 'tag',
            label: 'Tag',
            icon: <TagIcon className="h-4 w-4" />,
            description: 'Add a tag',
        },
    ];

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

    // Helper function to parse hashtags from text
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

    // Helper function to parse project references from text
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

    // Helper function to tokenize text handling quoted strings
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

    // Helper function to check if cursor is at ! for priority
    const isAtPriorityModifier = (text: string, position: number): boolean => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);

        // Check if we're right after ! character
        const priorityMatch = beforeCursor.match(/!\s*$/);
        if (!priorityMatch) return false;

        const priorityStart = beforeCursor.lastIndexOf('!');
        const textBeforePriority = text.substring(0, priorityStart).trim();
        const textAfterCursor = afterCursor.trim();

        // Only show at end of input or at end of metadata section
        if (textAfterCursor === '' || textBeforePriority === '') {
            return true;
        }

        const wordsBeforePriority = textBeforePriority
            .split(/\s+/)
            .filter((word) => word.length > 0);
        const allWordsAreMetadata = wordsBeforePriority.every(
            (word) =>
                word.startsWith('#') ||
                word.startsWith('+') ||
                word.startsWith('!') ||
                word.startsWith('&')
        );

        return allWordsAreMetadata;
    };

    // Helper function to check if cursor is at & for due date
    const isAtDueDateModifier = (text: string, position: number): boolean => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);

        // Check if we're right after & character
        const dateMatch = beforeCursor.match(/&\s*$/);
        if (!dateMatch) return false;

        const dateStart = beforeCursor.lastIndexOf('&');
        const textBeforeDate = text.substring(0, dateStart).trim();
        const textAfterCursor = afterCursor.trim();

        // Only show at end of input or at end of metadata section
        if (textAfterCursor === '' || textBeforeDate === '') {
            return true;
        }

        const wordsBeforeDate = textBeforeDate
            .split(/\s+/)
            .filter((word) => word.length > 0);
        const allWordsAreMetadata = wordsBeforeDate.every(
            (word) =>
                word.startsWith('#') ||
                word.startsWith('+') ||
                word.startsWith('!') ||
                word.startsWith('&')
        );

        return allWordsAreMetadata;
    };

    // Helper function to check if cursor is at / for slash menu
    const isAtSlashCommand = (text: string, position: number): boolean => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);

        // Check if we're right after / character
        const slashMatch = beforeCursor.match(/\/\s*$/);
        if (!slashMatch) return false;

        const slashStart = beforeCursor.lastIndexOf('/');
        const textBeforeSlash = text.substring(0, slashStart).trim();
        const textAfterCursor = afterCursor.trim();

        // Only show at beginning of input or after whitespace
        if (textBeforeSlash === '' || textAfterCursor === '') {
            return true;
        }

        return false;
    };

    // Helper function to remove a tag
    const removeTagFromText = (tagToRemove: string) => {
        // Check if it's in selectedTags first
        if (
            selectedTags.some(
                (t) => t.toLowerCase() === tagToRemove.toLowerCase()
            )
        ) {
            setSelectedTags(
                selectedTags.filter(
                    (t) => t.toLowerCase() !== tagToRemove.toLowerCase()
                )
            );
        } else {
            // Remove from input text if it's there
            const words = inputText.trim().split(/\s+/);
            const filteredWords = words.filter(
                (word) => word !== `#${tagToRemove}`
            );
            const newText = filteredWords.join(' ').trim();
            setInputText(newText);
        }

        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    };

    // Helper function to remove a project
    const removeProjectFromText = (projectToRemove: string) => {
        // Check if it's in selectedProjects first
        if (
            selectedProjects.some(
                (p) => p.toLowerCase() === projectToRemove.toLowerCase()
            )
        ) {
            setSelectedProjects(
                selectedProjects.filter(
                    (p) => p.toLowerCase() !== projectToRemove.toLowerCase()
                )
            );
        } else {
            // Remove from input text if it's there
            const tokens = tokenizeText(inputText.trim());
            const filteredTokens = tokens.filter((token) => {
                if (!token.startsWith('+')) return true;

                let projectName = token.substring(1);
                // Remove quotes if present
                if (projectName.startsWith('"') && projectName.endsWith('"')) {
                    projectName = projectName.slice(1, -1);
                }

                return (
                    projectName.toLowerCase() !== projectToRemove.toLowerCase()
                );
            });
            const newText = filteredTokens.join(' ').trim();
            setInputText(newText);
        }

        if (nameInputRef.current) {
            nameInputRef.current.focus();
        }
    };

    // Helper function to calculate dropdown position based on cursor
    const calculateDropdownPosition = (
        input: HTMLInputElement,
        cursorPos: number
    ) => {
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

            let showDropdown = false;

            if (textAfterCursor === '' || textBeforeHashtag === '') {
                showDropdown = true;
            } else {
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

            let showDropdown = false;

            if (textAfterCursor === '' || textBeforeProject === '') {
                showDropdown = true;
            } else {
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

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newText = e.target.value;
        const newCursorPosition = e.target.selectionStart || 0;

        setInputText(newText);
        setCursorPosition(newCursorPosition);

        // Check for slash command (/ character)
        if (
            (newText.charAt(newCursorPosition - 1) === '/' ||
                isAtSlashCommand(newText, newCursorPosition)) &&
            !showSlashMenu
        ) {
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
            setSelectedSuggestionIndex(-1);
            setShowPriorityDropdown(false);
            setShowDatePicker(false);
            setSelectedSlashIndex(-1);

            const position = calculateDropdownPosition(
                e.target,
                newCursorPosition
            );
            setDropdownPosition(position);
            setShowSlashMenu(true);
        } else {
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
            setShowPriorityDropdown(false);
            setShowDatePicker(false);
            setShowSlashMenu(false);
            setSelectedSuggestionIndex(-1);
        }
    };

    // Helper function to get all tags including auto-detected bookmark and selected tags
    const getAllTags = (text: string): string[] => {
        let allTags: string[] = [];

        if (analysisResult) {
            const explicitTags = analysisResult.parsed_tags;

            const isUrlContent =
                isUrl(text.trim()) ||
                analysisResult.suggested_reason === 'url_detected';
            if (isUrlContent) {
                const hasBookmarkTag = explicitTags.some(
                    (tag) => tag.toLowerCase() === 'bookmark'
                );
                if (!hasBookmarkTag) {
                    allTags = [...explicitTags, 'bookmark'];
                } else {
                    allTags = explicitTags;
                }
            } else {
                allTags = explicitTags;
            }
        } else {
            const explicitTags = parseHashtags(text);

            if (isUrl(text.trim())) {
                const hasBookmarkTag = explicitTags.some(
                    (tag) => tag.toLowerCase() === 'bookmark'
                );
                if (!hasBookmarkTag) {
                    allTags = [...explicitTags, 'bookmark'];
                } else {
                    allTags = explicitTags;
                }
            } else {
                allTags = explicitTags;
            }
        }

        // Add selectedTags to the list, avoiding duplicates
        selectedTags.forEach((tag) => {
            if (!allTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
                allTags.push(tag);
            }
        });

        return allTags;
    };

    // Helper function to get all project references including selected projects
    const getAllProjects = (text: string): string[] => {
        let allProjects: string[] = [];

        if (analysisResult) {
            allProjects = analysisResult.parsed_projects;
        } else {
            allProjects = parseProjectRefs(text);
        }

        // Add selectedProjects to the list, avoiding duplicates
        selectedProjects.forEach((project) => {
            if (
                !allProjects.some(
                    (p) => p.toLowerCase() === project.toLowerCase()
                )
            ) {
                allProjects.push(project);
            }
        });

        return allProjects;
    };

    // Helper function to get cleaned content
    const getCleanedContent = (text: string): string => {
        if (analysisResult) {
            return analysisResult.cleaned_content;
        }

        return text
            .replace(/#[a-zA-Z0-9_-]+/g, '')
            .replace(/\+\S+/g, '')
            .trim();
    };

    // Debounced text analysis function
    const analyzeText = useCallback(
        async (text: string) => {
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

                    // Auto-select entity type based on analysis
                    if (
                        result.suggested_type === 'task' &&
                        selectedEntityType === 'inbox'
                    ) {
                        setSelectedEntityType('task');
                    } else if (
                        result.suggested_type === 'note' &&
                        selectedEntityType === 'inbox'
                    ) {
                        setSelectedEntityType('note');
                    }
                } else {
                    console.error(
                        'Failed to analyze text:',
                        response.statusText
                    );
                    setAnalysisResult(null);
                }
            } catch (error) {
                console.error('Error analyzing text:', error);
                setAnalysisResult(null);
            } finally {
                setIsAnalyzing(false);
            }
        },
        [selectedEntityType]
    );

    // Debounced text analysis effect
    useEffect(() => {
        if (analysisTimeoutRef.current) {
            clearTimeout(analysisTimeoutRef.current);
        }

        analysisTimeoutRef.current = setTimeout(() => {
            analyzeText(inputText);
        }, 300);

        return () => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, [inputText, analyzeText]);

    // Handle tag suggestion selection
    const handleTagSelect = (tagName: string) => {
        // Add to selected tags list if not already present
        if (!selectedTags.includes(tagName)) {
            setSelectedTags([...selectedTags, tagName]);
        }

        setShowTagSuggestions(false);
        setFilteredTags([]);
        setSelectedSuggestionIndex(-1);

        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
            }
        }, 0);
    };

    // Handle priority selection
    const handlePrioritySelect = (priority: PriorityType) => {
        setSelectedPriority(priority);
        setShowPriorityDropdown(false);
        setSelectedPriorityIndex(-1);

        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
            }
        }, 0);
    };

    // Handle project suggestion selection
    const handleProjectSelect = (projectName: string) => {
        // Add to selected projects list if not already present
        if (!selectedProjects.includes(projectName)) {
            setSelectedProjects([...selectedProjects, projectName]);
        }

        setShowProjectSuggestions(false);
        setFilteredProjects([]);
        setSelectedSuggestionIndex(-1);

        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
            }
        }, 0);
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
                setTags([...tags, newTag]);
            } catch (error) {
                console.error(`Failed to create tag "${tagName}":`, error);
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
            } catch (error) {
                console.error(
                    `Failed to create project "${projectName}":`,
                    error
                );
            }
        }
    };

    // Helper functions for date formatting
    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Handle due date selection
    const handleDateSelect = (date: Date) => {
        setSelectedDueDate(formatDate(date));
        setShowDatePicker(false);

        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
            }
        }, 0);
    };

    // Handle slash command selection
    const handleSlashCommandSelect = (command: SlashCommand) => {
        const beforeCursor = inputText.substring(0, cursorPosition);
        const slashStart = beforeCursor.lastIndexOf('/');

        // Remove the / character from text
        const newText =
            inputText.substring(0, slashStart) +
            inputText.substring(cursorPosition);
        setInputText(newText.trim());
        setShowSlashMenu(false);
        setSelectedSlashIndex(-1);

        // Calculate dropdown position
        const position = nameInputRef.current
            ? calculateDropdownPosition(nameInputRef.current, slashStart)
            : dropdownPosition;
        setDropdownPosition(position);

        // Handle each command type
        setTimeout(() => {
            if (nameInputRef.current) {
                nameInputRef.current.focus();
                const newCursorPos = slashStart;
                nameInputRef.current.setSelectionRange(
                    newCursorPos,
                    newCursorPos
                );
            }

            // Open the appropriate submenu based on command
            switch (command) {
                case 'project':
                    // Show all projects
                    setFilteredProjects(projects.slice(0, 10));
                    setShowProjectSuggestions(true);
                    setSelectedSuggestionIndex(-1);
                    break;
                case 'tag':
                    // Show all tags
                    setFilteredTags(tags.slice(0, 10));
                    setShowTagSuggestions(true);
                    setSelectedSuggestionIndex(-1);
                    break;
                case 'priority':
                    // Show priority dropdown
                    setShowPriorityDropdown(true);
                    setSelectedPriorityIndex(-1);
                    break;
                case 'duedate':
                    // Show date picker
                    setShowDatePicker(true);
                    if (selectedDueDate) {
                        const selectedDate = new Date(
                            selectedDueDate + 'T00:00:00'
                        );
                        if (!isNaN(selectedDate.getTime())) {
                            setCurrentMonth(
                                new Date(
                                    selectedDate.getFullYear(),
                                    selectedDate.getMonth(),
                                    1
                                )
                            );
                        }
                    } else {
                        setCurrentMonth(
                            new Date(
                                new Date().getFullYear(),
                                new Date().getMonth(),
                                1
                            )
                        );
                    }
                    break;
            }
        }, 0);
    };

    // Reset all form fields
    const resetForm = () => {
        setInputText('');
        setSelectedPriority(null);
        setSelectedDueDate(null);
        setSelectedTags([]);
        setSelectedProjects([]);
    };

    const handleSubmit = useCallback(async () => {
        if (!inputText.trim() || isSaving) return;

        setIsSaving(true);

        try {
            // Handle different entity types
            switch (selectedEntityType) {
                case 'task': {
                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = getCleanedContent(inputText.trim());
                    const taskTags = getAllTags(inputText.trim()).map(
                        (tagName) => {
                            const existingTag = tags.find(
                                (tag) =>
                                    tag.name.toLowerCase() ===
                                    tagName.toLowerCase()
                            );
                            return existingTag || { name: tagName };
                        }
                    );

                    let projectId = undefined;
                    const projectsInText = getAllProjects(inputText.trim());
                    if (projectsInText.length > 0) {
                        const projectName = projectsInText[0];
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
                        priority: selectedPriority || 'low',
                        tags: taskTags,
                        project_id: projectId,
                        due_date: selectedDueDate || null,
                        completed_at: null,
                    };

                    await onSaveTask(newTask);
                    showSuccessToast(t('task.createSuccess'));
                    resetForm();
                    handleClose();
                    break;
                }

                case 'note': {
                    if (!onSaveNote) {
                        showErrorToast('Note creation not supported');
                        return;
                    }

                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = getCleanedContent(inputText.trim());
                    const hashtagTags = getAllTags(inputText.trim()).map(
                        (tagName) => {
                            const existingTag = tags.find(
                                (tag) =>
                                    tag.name.toLowerCase() ===
                                    tagName.toLowerCase()
                            );
                            return existingTag || { name: tagName };
                        }
                    );

                    let projectId = undefined;
                    const projectsInText = getAllProjects(inputText.trim());
                    if (projectsInText.length > 0) {
                        const projectName = projectsInText[0];
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
                        tags: hashtagTags,
                        project_id: projectId,
                    };

                    await onSaveNote(newNote);
                    showSuccessToast(
                        t('note.createSuccess', 'Note created successfully')
                    );
                    resetForm();
                    handleClose();
                    break;
                }

                case 'project': {
                    if (!onSaveProject) {
                        showErrorToast('Project creation not supported');
                        return;
                    }

                    const newProject: Project = {
                        name: inputText.trim(),
                        description: '',
                        state: 'planned',
                        priority: selectedPriority || undefined,
                        due_date_at: selectedDueDate || null,
                    };

                    await onSaveProject(newProject);
                    showSuccessToast('Project created successfully');
                    resetForm();
                    handleClose();
                    break;
                }

                case 'area': {
                    // Area creation not provided as prop, inform user
                    showErrorToast(
                        'Area creation not supported via quick capture'
                    );
                    return;
                }

                case 'tag': {
                    const tagName = inputText.trim().replace(/^#/, '');
                    if (!tagName) {
                        showErrorToast('Tag name cannot be empty');
                        return;
                    }

                    await createTag({ name: tagName });
                    showSuccessToast('Tag created successfully');
                    resetForm();
                    handleClose();
                    break;
                }

                case 'inbox':
                default: {
                    await createInboxItemWithStore(inputText.trim());
                    showSuccessToast(t('inbox.itemAdded'));
                    resetForm();
                    handleClose();
                    break;
                }
            }
        } catch (error: any) {
            console.error('Failed to save:', error);
            if (isAuthError(error)) {
                return;
            }
            showErrorToast(
                t('common.error', 'An error occurred. Please try again.')
            );
        } finally {
            setIsSaving(false);
        }
    }, [
        inputText,
        isSaving,
        selectedEntityType,
        onSaveTask,
        onSaveNote,
        onSaveProject,
        showSuccessToast,
        showErrorToast,
        t,
        tags,
        projects,
        selectedTags,
        selectedProjects,
        selectedPriority,
        selectedDueDate,
    ]);

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            resetForm();
            setSelectedEntityType('inbox');
            setIsClosing(false);
        }, 300);
    }, [onClose]);

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
                } else if (showPriorityDropdown) {
                    setShowPriorityDropdown(false);
                } else if (showDatePicker) {
                    setShowDatePicker(false);
                } else if (showSlashMenu) {
                    setShowSlashMenu(false);
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
    }, [
        isOpen,
        showTagSuggestions,
        showProjectSuggestions,
        showPriorityDropdown,
        showDatePicker,
        showSlashMenu,
        handleClose,
    ]);

    // Note: Escape key handling is done in the input's onKeyDown to only close dropdowns, not the modal

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
                        {/* Entity Type Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {entityBadges.map((badge) => (
                                <button
                                    key={badge.type}
                                    onClick={() =>
                                        setSelectedEntityType(badge.type)
                                    }
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                                        selectedEntityType === badge.type
                                            ? `${badge.color} ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-800`
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {badge.label}
                                </button>
                            ))}
                        </div>

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
                                    className="w-full text-xl font-semibold dark:bg-gray-800 text-black dark:text-white focus:outline-none shadow-sm py-2"
                                    placeholder={
                                        selectedEntityType === 'inbox'
                                            ? 'Quick capture (type / for options)...'
                                            : selectedEntityType === 'task'
                                              ? 'Create task (type / for options)...'
                                              : selectedEntityType === 'project'
                                                ? 'Create project (type / for options)...'
                                                : selectedEntityType === 'note'
                                                  ? 'Create note (type / for options)...'
                                                  : selectedEntityType ===
                                                      'area'
                                                    ? 'Create area...'
                                                    : selectedEntityType ===
                                                        'tag'
                                                      ? 'Create tag...'
                                                      : `Create ${selectedEntityType}...`
                                    }
                                    onKeyDown={(e) => {
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

                                        if (showPriorityDropdown) {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setSelectedPriorityIndex(
                                                    (prev) =>
                                                        prev <
                                                        priorityOptions.length -
                                                            1
                                                            ? prev + 1
                                                            : 0
                                                );
                                                return;
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setSelectedPriorityIndex(
                                                    (prev) =>
                                                        prev > 0
                                                            ? prev - 1
                                                            : priorityOptions.length -
                                                              1
                                                );
                                                return;
                                            } else if (e.key === 'Tab') {
                                                e.preventDefault();
                                                const selectedPrio =
                                                    selectedPriorityIndex >= 0
                                                        ? priorityOptions[
                                                              selectedPriorityIndex
                                                          ]
                                                        : priorityOptions[0];
                                                handlePrioritySelect(
                                                    selectedPrio
                                                );
                                                return;
                                            } else if (
                                                e.key === 'Enter' &&
                                                selectedPriorityIndex >= 0
                                            ) {
                                                e.preventDefault();
                                                handlePrioritySelect(
                                                    priorityOptions[
                                                        selectedPriorityIndex
                                                    ]
                                                );
                                                return;
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                // Remove the ! character
                                                const beforeCursor =
                                                    inputText.substring(
                                                        0,
                                                        cursorPosition
                                                    );
                                                const afterCursor =
                                                    inputText.substring(
                                                        cursorPosition
                                                    );
                                                const priorityStart =
                                                    beforeCursor.lastIndexOf(
                                                        '!'
                                                    );
                                                const newText =
                                                    inputText.substring(
                                                        0,
                                                        priorityStart
                                                    ) +
                                                    inputText.substring(
                                                        cursorPosition
                                                    );
                                                setInputText(newText.trim());
                                                setShowPriorityDropdown(false);
                                                setSelectedPriorityIndex(-1);
                                                setTimeout(() => {
                                                    if (nameInputRef.current) {
                                                        nameInputRef.current.focus();
                                                        const newCursorPos =
                                                            priorityStart;
                                                        nameInputRef.current.setSelectionRange(
                                                            newCursorPos,
                                                            newCursorPos
                                                        );
                                                    }
                                                }, 0);
                                                return;
                                            }
                                        }

                                        if (showDatePicker) {
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                // Remove the & character
                                                const beforeCursor =
                                                    inputText.substring(
                                                        0,
                                                        cursorPosition
                                                    );
                                                const afterCursor =
                                                    inputText.substring(
                                                        cursorPosition
                                                    );
                                                const dateStart =
                                                    beforeCursor.lastIndexOf(
                                                        '&'
                                                    );
                                                const newText =
                                                    inputText.substring(
                                                        0,
                                                        dateStart
                                                    ) +
                                                    inputText.substring(
                                                        cursorPosition
                                                    );
                                                setInputText(newText.trim());
                                                setShowDatePicker(false);
                                                setTimeout(() => {
                                                    if (nameInputRef.current) {
                                                        nameInputRef.current.focus();
                                                        const newCursorPos =
                                                            dateStart;
                                                        nameInputRef.current.setSelectionRange(
                                                            newCursorPos,
                                                            newCursorPos
                                                        );
                                                    }
                                                }, 0);
                                                return;
                                            }
                                        }

                                        if (showSlashMenu) {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
                                                setSelectedSlashIndex((prev) =>
                                                    prev <
                                                    slashMenuItems.length - 1
                                                        ? prev + 1
                                                        : 0
                                                );
                                                return;
                                            } else if (e.key === 'ArrowUp') {
                                                e.preventDefault();
                                                setSelectedSlashIndex((prev) =>
                                                    prev > 0
                                                        ? prev - 1
                                                        : slashMenuItems.length -
                                                          1
                                                );
                                                return;
                                            } else if (e.key === 'Tab') {
                                                e.preventDefault();
                                                const selectedCommand =
                                                    selectedSlashIndex >= 0
                                                        ? slashMenuItems[
                                                              selectedSlashIndex
                                                          ]
                                                        : slashMenuItems[0];
                                                handleSlashCommandSelect(
                                                    selectedCommand.command
                                                );
                                                return;
                                            } else if (
                                                e.key === 'Enter' &&
                                                selectedSlashIndex >= 0
                                            ) {
                                                e.preventDefault();
                                                handleSlashCommandSelect(
                                                    slashMenuItems[
                                                        selectedSlashIndex
                                                    ].command
                                                );
                                                return;
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                // Remove the / character
                                                const beforeCursor =
                                                    inputText.substring(
                                                        0,
                                                        cursorPosition
                                                    );
                                                const afterCursor =
                                                    inputText.substring(
                                                        cursorPosition
                                                    );
                                                const slashStart =
                                                    beforeCursor.lastIndexOf(
                                                        '/'
                                                    );
                                                const newText =
                                                    inputText.substring(
                                                        0,
                                                        slashStart
                                                    ) +
                                                    inputText.substring(
                                                        cursorPosition
                                                    );
                                                setInputText(newText.trim());
                                                setShowSlashMenu(false);
                                                setSelectedSlashIndex(-1);
                                                setTimeout(() => {
                                                    if (nameInputRef.current) {
                                                        nameInputRef.current.focus();
                                                        const newCursorPos =
                                                            slashStart;
                                                        nameInputRef.current.setSelectionRange(
                                                            newCursorPos,
                                                            newCursorPos
                                                        );
                                                    }
                                                }, 0);
                                                return;
                                            }
                                        }

                                        if (
                                            e.key === 'Enter' &&
                                            !e.shiftKey &&
                                            !isSaving
                                        ) {
                                            if (
                                                (showTagSuggestions &&
                                                    filteredTags.length > 0) ||
                                                (showProjectSuggestions &&
                                                    filteredProjects.length > 0)
                                            ) {
                                                return;
                                            }
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                />

                                {/* Tags display */}
                                {getAllTags(inputText).length > 0 && (
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

                                {/* Projects display */}
                                {getAllProjects(inputText).length > 0 && (
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
                                                                {projectName}
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

                                {/* Priority display */}
                                {selectedPriority && (
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                                        {selectedPriority === 'low' && (
                                            <ArrowDownIcon className="h-3 w-3 mr-1" />
                                        )}
                                        {selectedPriority === 'medium' && (
                                            <ArrowUpIcon className="h-3 w-3 mr-1" />
                                        )}
                                        {selectedPriority === 'high' && (
                                            <FireIcon className="h-3 w-3 mr-1" />
                                        )}
                                        <div className="flex flex-wrap gap-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded text-purple-600 dark:text-purple-400">
                                                {selectedPriority
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    selectedPriority.slice(
                                                        1
                                                    )}{' '}
                                                Priority
                                                <button
                                                    onClick={() =>
                                                        setSelectedPriority(
                                                            null
                                                        )
                                                    }
                                                    className="h-3 w-3 text-purple-400 hover:text-red-500 transition-colors"
                                                    title="Remove priority"
                                                >
                                                    <XMarkIcon className="h-3 w-3" />
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Due Date display */}
                                {selectedDueDate && (
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 flex-wrap gap-1">
                                        <CalendarDaysIcon className="h-3 w-3 mr-1" />
                                        <div className="flex flex-wrap gap-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded text-indigo-600 dark:text-indigo-400">
                                                {new Date(
                                                    selectedDueDate +
                                                        'T00:00:00'
                                                ).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                                <button
                                                    onClick={() =>
                                                        setSelectedDueDate(null)
                                                    }
                                                    className="h-3 w-3 text-indigo-400 hover:text-red-500 transition-colors"
                                                    title="Remove due date"
                                                >
                                                    <XMarkIcon className="h-3 w-3" />
                                                </button>
                                            </span>
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

                                {/* Priority Dropdown */}
                                {showPriorityDropdown && (
                                    <div
                                        className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
                                        style={{
                                            left: `${dropdownPosition.left}px`,
                                            top: `${dropdownPosition.top + 4}px`,
                                            minWidth: '150px',
                                        }}
                                    >
                                        {priorityOptions.map(
                                            (priority, index) => (
                                                <button
                                                    key={priority}
                                                    onClick={() =>
                                                        handlePrioritySelect(
                                                            priority
                                                        )
                                                    }
                                                    className={`flex items-center space-x-2 w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-gray-100 first:rounded-t-md last:rounded-b-md ${
                                                        selectedPriorityIndex ===
                                                        index
                                                            ? 'bg-blue-100 dark:bg-blue-800'
                                                            : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                                                    }`}
                                                >
                                                    <span>
                                                        {priority
                                                            .charAt(0)
                                                            .toUpperCase() +
                                                            priority.slice(1)}
                                                    </span>
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}

                                {/* Slash Command Menu */}
                                {showSlashMenu && (
                                    <div
                                        className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50"
                                        style={{
                                            left: `${dropdownPosition.left}px`,
                                            top: `${dropdownPosition.top + 4}px`,
                                            minWidth: '240px',
                                        }}
                                    >
                                        {slashMenuItems.map((item, index) => (
                                            <button
                                                key={item.command}
                                                onClick={() =>
                                                    handleSlashCommandSelect(
                                                        item.command
                                                    )
                                                }
                                                className={`flex items-center space-x-3 w-full text-left px-3 py-2.5 first:rounded-t-md last:rounded-b-md ${
                                                    selectedSlashIndex === index
                                                        ? 'bg-blue-100 dark:bg-blue-800'
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                                                    {item.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {item.label}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {item.description}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Date Picker Calendar */}
                                {showDatePicker &&
                                    (() => {
                                        const months = [
                                            'January',
                                            'February',
                                            'March',
                                            'April',
                                            'May',
                                            'June',
                                            'July',
                                            'August',
                                            'September',
                                            'October',
                                            'November',
                                            'December',
                                        ];
                                        const daysOfWeek = [
                                            'Sun',
                                            'Mon',
                                            'Tue',
                                            'Wed',
                                            'Thu',
                                            'Fri',
                                            'Sat',
                                        ];

                                        const getDaysInMonth = () => {
                                            const year =
                                                currentMonth.getFullYear();
                                            const month =
                                                currentMonth.getMonth();
                                            const firstDay = new Date(
                                                year,
                                                month,
                                                1
                                            );
                                            const lastDay = new Date(
                                                year,
                                                month + 1,
                                                0
                                            );
                                            const daysInMonth =
                                                lastDay.getDate();
                                            const startingDayOfWeek =
                                                firstDay.getDay();

                                            const days = [];
                                            // Add empty cells for days before the first day of the month
                                            for (
                                                let i = 0;
                                                i < startingDayOfWeek;
                                                i++
                                            ) {
                                                days.push(null);
                                            }
                                            // Add days of the month
                                            for (
                                                let day = 1;
                                                day <= daysInMonth;
                                                day++
                                            ) {
                                                days.push(
                                                    new Date(year, month, day)
                                                );
                                            }
                                            return days;
                                        };

                                        const isToday = (date: Date) => {
                                            const today = new Date();
                                            return (
                                                date.toDateString() ===
                                                today.toDateString()
                                            );
                                        };

                                        const isSelected = (date: Date) => {
                                            if (!selectedDueDate) return false;
                                            const selectedDate = new Date(
                                                selectedDueDate + 'T00:00:00'
                                            );
                                            return (
                                                date.toDateString() ===
                                                selectedDate.toDateString()
                                            );
                                        };

                                        return (
                                            <div
                                                className="absolute bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 p-3"
                                                style={{
                                                    left: `${dropdownPosition.left}px`,
                                                    top: `${dropdownPosition.top + 4}px`,
                                                    minWidth: '280px',
                                                }}
                                            >
                                                {/* Calendar Header */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCurrentMonth(
                                                                (prev) =>
                                                                    new Date(
                                                                        prev.getFullYear(),
                                                                        prev.getMonth() -
                                                                            1,
                                                                        1
                                                                    )
                                                            )
                                                        }
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                                    >
                                                        <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {
                                                            months[
                                                                currentMonth.getMonth()
                                                            ]
                                                        }{' '}
                                                        {currentMonth.getFullYear()}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setCurrentMonth(
                                                                (prev) =>
                                                                    new Date(
                                                                        prev.getFullYear(),
                                                                        prev.getMonth() +
                                                                            1,
                                                                        1
                                                                    )
                                                            )
                                                        }
                                                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                                                    >
                                                        <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                                    </button>
                                                </div>

                                                {/* Day Headers */}
                                                <div className="grid grid-cols-7 gap-1 mb-2">
                                                    {daysOfWeek.map((day) => (
                                                        <div
                                                            key={day}
                                                            className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1"
                                                        >
                                                            {day}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Calendar Days */}
                                                <div className="grid grid-cols-7 gap-1 mb-3">
                                                    {getDaysInMonth().map(
                                                        (date, index) => (
                                                            <div
                                                                key={index}
                                                                className="aspect-square"
                                                            >
                                                                {date && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleDateSelect(
                                                                                date
                                                                            )
                                                                        }
                                                                        className={`w-full h-full text-xs rounded transition-colors ${
                                                                            isSelected(
                                                                                date
                                                                            )
                                                                                ? 'bg-blue-600 text-white'
                                                                                : isToday(
                                                                                        date
                                                                                    )
                                                                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                                                                                  : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                                                                        }`}
                                                                    >
                                                                        {date.getDate()}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </div>

                                                {/* Footer with Today button */}
                                                <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleDateSelect(
                                                                new Date()
                                                            )
                                                        }
                                                        className="w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 py-1"
                                                    >
                                                        Today
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()}
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex justify-end mt-4">
                            <button
                                type="button"
                                onClick={() => handleSubmit()}
                                disabled={!inputText.trim() || isSaving}
                                className={`inline-flex justify-center px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none ${
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UniversalInputModal;
