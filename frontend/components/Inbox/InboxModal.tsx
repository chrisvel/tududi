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
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { isUrl } from '../../utils/urlService';
import { getApiPath } from '../../config/paths';
import InboxSelectedChips from './InboxSelectedChips';
import SuggestionsDropdown from './SuggestionsDropdown';

interface InboxModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => Promise<void>;
    onSaveNote?: (note: Note) => Promise<void>;
    initialText?: string;
    editMode?: boolean;
    onEdit?: (text: string) => Promise<void>;
    onConvertToTask?: () => Promise<void>;
    onConvertToNote?: () => Promise<void>;
    projects?: Project[];
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
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [saveMode, setSaveMode] = useState<'task' | 'inbox'>('inbox');
    const { tagsStore } = useStore();
    const tags = tagsStore.getTags();
    const { setTags } = tagsStore;
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const projects = propProjects;
    const [cursorPosition, setCursorPosition] = useState(0);
    const [, setCurrentHashtagQuery] = useState('');
    const [, setCurrentProjectQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({
        left: 0,
        top: 0,
    });
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

    const [analysisResult, setAnalysisResult] = useState<{
        parsed_tags: string[];
        parsed_projects: string[];
        cleaned_content: string;
        suggested_type: 'task' | 'note' | null;
        suggested_reason: string | null;
    } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout>();

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

    const getCurrentHashtagQuery = (text: string, position: number): string => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);
        const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);

        if (!hashtagMatch) return '';

        const hashtagStart = beforeCursor.lastIndexOf('#');
        const textBeforeHashtag = text.substring(0, hashtagStart).trim();
        const textAfterCursor = afterCursor.trim();

        if (textAfterCursor === '') {
            return hashtagMatch[1];
        }

        if (textBeforeHashtag === '') {
            return hashtagMatch[1];
        }

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

    const getCurrentProjectQuery = (text: string, position: number): string => {
        const beforeCursor = text.substring(0, position);
        const afterCursor = text.substring(position);
        const projectMatch = beforeCursor.match(
            /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/
        );

        if (!projectMatch) return '';

        const projectQuery = projectMatch[1] || projectMatch[2] || '';

        const projectStart = beforeCursor.lastIndexOf('+');
        const textBeforeProject = text.substring(0, projectStart).trim();
        const textAfterCursor = afterCursor.trim();

        if (textAfterCursor === '') {
            return projectQuery;
        }

        if (textBeforeProject === '') {
            return projectQuery;
        }

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

        const hashtagQuery = getCurrentHashtagQuery(newText, newCursorPosition);
        setCurrentHashtagQuery(hashtagQuery);

        const projectQuery = getCurrentProjectQuery(newText, newCursorPosition);
        setCurrentProjectQuery(projectQuery);

        if (
            (newText.charAt(newCursorPosition - 1) === '#' || hashtagQuery) &&
            hashtagQuery !== ''
        ) {
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
            setSelectedSuggestionIndex(-1);

            const filtered = tags
                .filter((tag) =>
                    tag.name
                        .toLowerCase()
                        .startsWith(hashtagQuery.toLowerCase())
                )
                .slice(0, 5);

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
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setSelectedSuggestionIndex(-1);

            const filtered = projects
                .filter((project) =>
                    project.name
                        .toLowerCase()
                        .includes(projectQuery.toLowerCase())
                )
                .slice(0, 5);

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

    const getAllTags = (text: string): string[] => {
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
                    return [...explicitTags, 'bookmark'];
                }
            }

            return explicitTags;
        }

        const explicitTags = parseHashtags(text);

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

    const getAllProjects = (text: string): string[] => {
        if (analysisResult) {
            return analysisResult.parsed_projects;
        }

        return parseProjectRefs(text);
    };

    const getCleanedContent = (text: string): string => {
        if (analysisResult) {
            return analysisResult.cleaned_content;
        }

        return text
            .replace(/#[a-zA-Z0-9_-]+/g, '')
            .replace(/\+\S+/g, '')
            .trim();
    };

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

    const analyzeText = useCallback(async (text: string) => {
        if (!text.trim()) {
            setAnalysisResult(null);
            return;
        }

        try {
            setIsAnalyzing(true);
            const response = await fetch(getApiPath('inbox/analyze-text'), {
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

            let allowReplacement = false;

            if (textAfterCursor === '' || textBeforeHashtag === '') {
                allowReplacement = true;
            } else {
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

    const handleProjectSelect = (projectName: string) => {
        const beforeCursor = inputText.substring(0, cursorPosition);
        const afterCursor = inputText.substring(cursorPosition);
        const projectMatch = beforeCursor.match(
            /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/
        );

        if (projectMatch) {
            const projectStart = beforeCursor.lastIndexOf('+');
            const textBeforeProject = inputText
                .substring(0, projectStart)
                .trim();
            const textAfterCursor = afterCursor.trim();

            let allowReplacement = false;

            if (textAfterCursor === '' || textBeforeProject === '') {
                allowReplacement = true;
            } else {
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

    const handleSubmit = useCallback(
        async (forceInbox = false) => {
            if (!inputText.trim() || isSaving) return;

            setIsSaving(true);

            try {
                if (analysisResult?.suggested_type === 'task' && !forceInbox) {
                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = getCleanedContent(inputText.trim());

                    const taskTags = analysisResult.parsed_tags.map(
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

                if (analysisResult?.suggested_type === 'note' && !forceInbox) {
                    await createMissingTags(inputText.trim());
                    await createMissingProjects(inputText.trim());

                    const cleanedText = getCleanedContent(inputText.trim());

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

                    const isUrlContent =
                        isUrl(inputText.trim()) ||
                        analysisResult.suggested_reason === 'url_detected';
                    const bookmarkTag = isUrlContent
                        ? [{ name: 'bookmark' }]
                        : [];

                    const hasBookmarkInParsed = hashtagTags.some(
                        (tag) => tag.name.toLowerCase() === 'bookmark'
                    );
                    const finalBookmarkTag = hasBookmarkInParsed
                        ? []
                        : bookmarkTag;

                    const taskTags = [...hashtagTags, ...finalBookmarkTag];

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

                            if (editMode && onConvertToNote) {
                                await onConvertToNote();
                            }

                            setInputText('');
                            handleClose();
                            return;
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
                    await onEdit(inputText.trim());
                    setIsClosing(true);
                    setTimeout(() => {
                        onClose();
                        setIsClosing(false);
                    }, 300);
                    return;
                }

                const effectiveSaveMode = saveMode;

                if (effectiveSaveMode === 'task') {
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
                        if (isAuthError(error)) {
                            return;
                        }
                        throw error;
                    }
                } else {
                    try {
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
                                    placeholder={t('inbox.captureThought')}
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

                                <InboxSelectedChips
                                    selectedTags={getAllTags(inputText)}
                                    selectedProjects={getAllProjects(inputText)}
                                    tags={tags}
                                    projects={projects}
                                    onRemoveTag={removeTagFromText}
                                    onRemoveProject={removeProjectFromText}
                                />

                                <SuggestionsDropdown
                                    isVisible={
                                        showTagSuggestions &&
                                        filteredTags.length > 0
                                    }
                                    items={filteredTags}
                                    position={dropdownPosition}
                                    selectedIndex={selectedSuggestionIndex}
                                    onSelect={(tag) =>
                                        handleTagSelect(tag.name)
                                    }
                                    renderLabel={(tag) => <>#{tag.name}</>}
                                />

                                <SuggestionsDropdown
                                    isVisible={
                                        showProjectSuggestions &&
                                        filteredProjects.length > 0
                                    }
                                    items={filteredProjects}
                                    position={dropdownPosition}
                                    selectedIndex={selectedSuggestionIndex}
                                    onSelect={(project) =>
                                        handleProjectSelect(project.name)
                                    }
                                    renderLabel={(project) => (
                                        <>+{project.name}</>
                                    )}
                                />

                                {(() => {
                                    const suggestion = getSuggestion();
                                    return suggestion.type &&
                                        suggestion.message ? (
                                        <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start flex-1">
                                                    <div className="text-purple-600 dark:text-purple-400 mr-2 mt-0.5">
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
                                                                    );
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
                                onClick={() => handleSubmit(false)}
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
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InboxModal;
