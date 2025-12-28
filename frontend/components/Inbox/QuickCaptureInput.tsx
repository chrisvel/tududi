import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    useImperativeHandle,
} from 'react';
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
import {
    ClipboardDocumentListIcon,
    DocumentTextIcon,
    FolderIcon,
    PlusIcon,
    LightBulbIcon,
    LinkIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { isUrl, extractUrlTitle } from '../../utils/urlService';
import { getApiPath } from '../../config/paths';
import InboxSelectedChips from './InboxSelectedChips';
import SuggestionsDropdown from './SuggestionsDropdown';
import InboxCard from './InboxCard';

export interface QuickCaptureInputHandle {
    submit: (forceInbox?: boolean) => Promise<void>;
}

export interface InboxComposerFooterContext {
    text: string;
    cleanedText: string;
    hashtags: string[];
    projectRefs: string[];
    clearText: () => void;
}

interface QuickCaptureInputProps {
    onTaskCreate?: (task: Task) => Promise<void>;
    onNoteCreate?: (note: Note) => Promise<void>;
    projects?: Project[];
    autoFocus?: boolean;
    mode?: 'create' | 'edit';
    initialValue?: string;
    hidePrimaryButton?: boolean;
    onSubmitOverride?: (text: string) => Promise<void>;
    onAfterSubmit?: () => void;
    renderFooterActions?: (
        context: InboxComposerFooterContext
    ) => React.ReactNode;
    openTaskModal?: (task: Task, inboxItemUid?: string) => void;
    openProjectModal?: (project: Project | null, inboxItemUid?: string) => void;
    openNoteModal?: (note: Note | null, inboxItemUid?: string) => void;
    cardClassName?: string;
    multiline?: boolean;
}

interface UrlPreviewState {
    detectedText: string;
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    isLoading: boolean;
    error?: string | null;
}

const urlWithProtocolRegex = /(https?:\/\/[^\s]+)/i;
const urlWithoutProtocolRegex =
    /(?:^|\s)((?:www\.)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(?::[0-9]{1,5})?(?:\/[^\s]*)?)/i;

const normalizeUrl = (value: string) => {
    if (!value) {
        return '';
    }
    if (/^https?:\/\//i.test(value)) {
        return value;
    }
    return `https://${value}`;
};

const extractFirstUrlFromText = (text: string): string | null => {
    if (!text) {
        return null;
    }

    const withProtocolMatch = text.match(urlWithProtocolRegex);
    if (withProtocolMatch && withProtocolMatch[0]) {
        return withProtocolMatch[0];
    }

    const withoutProtocolMatch = text.match(urlWithoutProtocolRegex);
    if (withoutProtocolMatch && withoutProtocolMatch[1]) {
        return withoutProtocolMatch[1];
    }

    return null;
};

const QuickCaptureInput = React.forwardRef<
    QuickCaptureInputHandle,
    QuickCaptureInputProps
>(
    (
        {
            onTaskCreate,
            onNoteCreate,
            projects: propProjects = [],
            autoFocus = false,
            mode = 'create',
            initialValue = '',
            hidePrimaryButton = false,
            onSubmitOverride,
            onAfterSubmit,
            renderFooterActions,
            openTaskModal,
            openProjectModal,
            openNoteModal,
            cardClassName,
            multiline = false,
        },
        ref
    ) => {
        const { t } = useTranslation();
        const [inputText, setInputText] = useState<string>(initialValue);
        const [isSaving, setIsSaving] = useState(false);
        const { showSuccessToast, showErrorToast } = useToast();
        const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
        const { tagsStore } = useStore();
        const { setTags, refreshTags } = tagsStore;
        const tags = tagsStore.getTags();
        const [showTagSuggestions, setShowTagSuggestions] = useState(false);
        const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
        const [showProjectSuggestions, setShowProjectSuggestions] =
            useState(false);
        const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
        const projects = propProjects;
        const [cursorPosition, setCursorPosition] = useState(0);
        const [, setCurrentHashtagQuery] = useState('');
        const [, setCurrentProjectQuery] = useState('');
        const [dropdownPosition, setDropdownPosition] = useState({
            left: 0,
            top: 0,
        });
        const [selectedSuggestionIndex, setSelectedSuggestionIndex] =
            useState(-1);

        const [analysisResult, setAnalysisResult] = useState<{
            parsed_tags: string[];
            parsed_projects: string[];
            cleaned_content: string;
            suggested_type: 'task' | 'note' | null;
            suggested_reason: string | null;
        } | null>(null);
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const analysisTimeoutRef = useRef<NodeJS.Timeout>();
        const analysisRequestIdRef = useRef(0);
        const [urlPreview, setUrlPreview] = useState<UrlPreviewState | null>(
            null
        );
        const [urlPreviewImageError, setUrlPreviewImageError] = useState(false);
        const urlPreviewRequestIdRef = useRef(0);
        const dismissedPreviewUrlRef = useRef<string | null>(null);

        const isEditMode = mode === 'edit';

        useEffect(() => {
            if (isEditMode) {
                setInputText(initialValue || '');
            }
        }, [initialValue, isEditMode]);

        useEffect(() => {
            if (autoFocus && inputRef.current) {
                inputRef.current.focus();
            }
        }, [autoFocus]);

        const clearComposerText = useCallback(() => {
            setInputText('');
            setAnalysisResult(null);
            setUrlPreview(null);
            dismissedPreviewUrlRef.current = null;
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, []);

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

        const fetchUrlPreview = useCallback(
            async (rawUrl: string, detectedText: string) => {
                const normalizedUrl = normalizeUrl(rawUrl);
                urlPreviewRequestIdRef.current += 1;
                const currentRequestId = urlPreviewRequestIdRef.current;

                dismissedPreviewUrlRef.current = null;
                setUrlPreviewImageError(false);
                setUrlPreview({
                    detectedText,
                    url: normalizedUrl,
                    title: null,
                    description: null,
                    image: null,
                    isLoading: true,
                    error: null,
                });

                const result = await extractUrlTitle(normalizedUrl);

                if (currentRequestId !== urlPreviewRequestIdRef.current) {
                    return;
                }

                setUrlPreview((prev) => {
                    if (!prev || prev.url !== normalizedUrl) {
                        return prev;
                    }

                    return {
                        ...prev,
                        title: result.title ?? null,
                        description: result.description ?? null,
                        image: result.image ?? null,
                        isLoading: false,
                        error: result.error ?? null,
                    };
                });
            },
            []
        );

        useEffect(() => {
            const detectedUrl = extractFirstUrlFromText(inputText);

            if (!detectedUrl) {
                if (urlPreview) {
                    setUrlPreview(null);
                }
                dismissedPreviewUrlRef.current = null;
                urlPreviewRequestIdRef.current += 1;
                return;
            }

            const normalized = normalizeUrl(detectedUrl);

            if (dismissedPreviewUrlRef.current === normalized) {
                return;
            }

            if (urlPreview && urlPreview.url === normalized) {
                return;
            }

            fetchUrlPreview(detectedUrl, detectedUrl);
        }, [inputText, fetchUrlPreview, urlPreview]);

        useEffect(() => {
            if (!urlPreview) {
                setUrlPreviewImageError(false);
                return;
            }
            setUrlPreviewImageError(false);
        }, [urlPreview?.url]);

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

        const getCurrentHashtagQuery = (
            text: string,
            position: number
        ): string => {
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

        const getCurrentProjectQuery = (
            text: string,
            position: number
        ): string => {
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

        const escapeRegExp = (value: string) =>
            value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

        const cleanInputSpacing = (text: string) =>
            text
                .replace(/\s{2,}/g, ' ')
                .replace(/\s+\n/g, '\n')
                .replace(/\n\s+/g, '\n')
                .trim();

        const removeTagFromText = (tagToRemove: string) => {
            const escaped = escapeRegExp(tagToRemove);
            const pattern = new RegExp(`(^|\\s)#${escaped}(?=$|\\s)`, 'gi');
            const updated = cleanInputSpacing(
                inputText.replace(pattern, (_, prefix) => prefix ?? '')
            );
            setInputText(updated);
            setAnalysisResult(null);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        };

        const removeProjectFromText = (projectToRemove: string) => {
            const escaped = escapeRegExp(projectToRemove);
            const quotedPattern = new RegExp(
                `(^|\\s)\\+"${escaped}"(?=$|\\s)`,
                'gi'
            );
            const simplePattern = new RegExp(
                `(^|\\s)\\+${escaped}(?=$|\\s)`,
                'gi'
            );
            const updated = cleanInputSpacing(
                inputText
                    .replace(quotedPattern, (_, prefix) => prefix ?? '')
                    .replace(simplePattern, (_, prefix) => prefix ?? '')
            );
            setInputText(updated);
            setAnalysisResult(null);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        };

        const calculateDropdownPosition = (
            input: HTMLInputElement | HTMLTextAreaElement,
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
                    tempToHashtag.style.fontSize =
                        getComputedStyle(input).fontSize;
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
                    tempToProject.style.fontSize =
                        getComputedStyle(input).fontSize;
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

        const handleChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => {
            const newText = e.target.value;
            const newCursorPosition = e.target.selectionStart || 0;

            setInputText(newText);
            setCursorPosition(newCursorPosition);

            const hashtagQuery = getCurrentHashtagQuery(
                newText,
                newCursorPosition
            );
            setCurrentHashtagQuery(hashtagQuery);

            const projectQuery = getCurrentProjectQuery(
                newText,
                newCursorPosition
            );
            setCurrentProjectQuery(projectQuery);

            if (
                (newText.charAt(newCursorPosition - 1) === '#' ||
                    hashtagQuery) &&
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
                (newText.charAt(newCursorPosition - 1) === '+' ||
                    projectQuery) &&
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

        const buildTagObjects = (hashtagNames: string[]) => {
            return hashtagNames.map((hashtagName) => {
                const existingTag = tags.find(
                    (tag) =>
                        tag.name.toLowerCase() === hashtagName.toLowerCase()
                );
                return existingTag || { name: hashtagName };
            });
        };

        const resolveProjectUid = (projectRefsList: string[]) => {
            if (projectRefsList.length === 0) {
                return undefined;
            }
            const projectName = projectRefsList[0];
            const matchingProject = projects.find(
                (project) =>
                    project.name.toLowerCase() === projectName.toLowerCase()
            );
            return matchingProject ? matchingProject.uid : undefined;
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
                    ? `Will be saved as a bookmark note${projectName ? ` for ${projectName}` : ''}.`
                    : `Will be saved as a note${projectName ? ` for ${projectName}` : ''}.`;

                return {
                    type: 'note',
                    message,
                    projectName,
                };
            } else if (type === 'task') {
                return {
                    type: 'task',
                    message: `Will be created as a task${projectName ? ` under ${projectName}` : ''}.`,
                    projectName,
                };
            }

            return { type: null, message: null, projectName: null };
        };

        const analyzeText = useCallback(
            async (text: string, requestId: number) => {
                if (!text.trim()) {
                    if (analysisRequestIdRef.current === requestId) {
                        setAnalysisResult(null);
                        setIsAnalyzing(false);
                    }
                    return;
                }

                try {
                    if (analysisRequestIdRef.current === requestId) {
                        setIsAnalyzing(true);
                    }
                    const response = await fetch(
                        getApiPath('inbox/analyze-text'),
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            credentials: 'include',
                            body: JSON.stringify({ content: text }),
                        }
                    );

                    if (analysisRequestIdRef.current !== requestId) {
                        return;
                    }

                    if (response.ok) {
                        const result = await response.json();
                        setAnalysisResult(result);
                    } else {
                        console.error(
                            'Failed to analyze text:',
                            response.statusText
                        );
                        setAnalysisResult(null);
                    }
                } catch (error) {
                    if (analysisRequestIdRef.current !== requestId) {
                        return;
                    }
                    console.error('Error analyzing text:', error);
                    setAnalysisResult(null);
                } finally {
                    if (analysisRequestIdRef.current === requestId) {
                        setIsAnalyzing(false);
                    }
                }
            },
            []
        );

        useEffect(() => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }

            const requestId = analysisRequestIdRef.current + 1;
            analysisRequestIdRef.current = requestId;

            const textForAnalysis = inputText;

            analysisTimeoutRef.current = setTimeout(() => {
                analyzeText(textForAnalysis, requestId);
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
                        beforeCursor.replace(
                            /#([a-zA-Z0-9_]*)$/,
                            `#${tagName}`
                        ) + afterCursor;
                    setInputText(newText);
                    setShowTagSuggestions(false);
                    setFilteredTags([]);
                    setSelectedSuggestionIndex(-1);

                    setTimeout(() => {
                        if (inputRef.current) {
                            inputRef.current.focus();
                            const newCursorPos = beforeCursor.replace(
                                /#([a-zA-Z0-9_]*)$/,
                                `#${tagName}`
                            ).length;
                            inputRef.current.setSelectionRange(
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
                        if (inputRef.current) {
                            inputRef.current.focus();
                            const newCursorPos = beforeCursor.replace(
                                /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/,
                                `+${formattedProjectName}`
                            ).length;
                            inputRef.current.setSelectionRange(
                                newCursorPos,
                                newCursorPos
                            );
                        }
                    }, 0);
                }
            }
        };

        const createMissingTags = async (text: string): Promise<void> => {
            const hashtagsInText = getAllTags(text);
            const currentTags = tagsStore.getTags();
            const existingTagNames = currentTags.map((tag) =>
                tag.name.toLowerCase()
            );
            const missingTags = hashtagsInText.filter(
                (tagName) => !existingTagNames.includes(tagName.toLowerCase())
            );

            let createdNewTag = false;
            for (const tagName of missingTags) {
                try {
                    const newTag = await createTag({ name: tagName });
                    setTags([...tagsStore.getTags(), newTag]);
                    createdNewTag = true;
                } catch (error) {
                    console.error(`Failed to create tag "${tagName}":`, error);
                }
            }

            if (createdNewTag && typeof refreshTags === 'function') {
                try {
                    await refreshTags();
                } catch (error) {
                    console.error(
                        'Failed to refresh tags after creation:',
                        error
                    );
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
                        status: 'planned',
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
                const trimmedText = inputText.trim();
                if ((!trimmedText && !isEditMode) || isSaving) return;

                setIsSaving(true);

                try {
                    if (onSubmitOverride) {
                        await createMissingTags(trimmedText);
                        await createMissingProjects(trimmedText);
                        await onSubmitOverride(trimmedText);
                        onAfterSubmit?.();
                        setIsSaving(false);
                        return;
                    }

                    if (
                        analysisResult?.suggested_type === 'task' &&
                        !forceInbox &&
                        onTaskCreate
                    ) {
                        await createMissingTags(trimmedText);
                        await createMissingProjects(trimmedText);

                        const cleanedText = getCleanedContent(trimmedText);

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
                            const projectName =
                                analysisResult.parsed_projects[0];
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
                            await onTaskCreate(newTask);
                            showSuccessToast(t('task.createSuccess'));
                            setInputText('');
                            setAnalysisResult(null);
                            if (inputRef.current) {
                                inputRef.current.focus();
                            }
                            return;
                        } catch (error: any) {
                            if (isAuthError(error)) {
                                return;
                            }
                            throw error;
                        }
                    }

                    if (
                        analysisResult?.suggested_type === 'note' &&
                        !forceInbox &&
                        onNoteCreate
                    ) {
                        await createMissingTags(trimmedText);
                        await createMissingProjects(trimmedText);

                        const cleanedText = getCleanedContent(trimmedText);

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
                            isUrl(trimmedText) ||
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
                            const projectName =
                                analysisResult.parsed_projects[0];
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
                            title: cleanedText || trimmedText,
                            content: trimmedText,
                            tags: taskTags,
                            project_id: projectId,
                        };

                        try {
                            await onNoteCreate(newNote);
                            showSuccessToast(
                                t(
                                    'note.createSuccess',
                                    'Note created successfully'
                                )
                            );
                            setInputText('');
                            setAnalysisResult(null);
                            if (inputRef.current) {
                                inputRef.current.focus();
                            }
                            return;
                        } catch (error: any) {
                            console.error(
                                'Error in note creation flow:',
                                error
                            );
                            if (isAuthError(error)) {
                                return;
                            }
                            throw error;
                        }
                    }

                    try {
                        await createMissingTags(trimmedText);
                        await createMissingProjects(trimmedText);
                        await createInboxItemWithStore(trimmedText);
                        showSuccessToast(t('inbox.itemAdded'));
                        setInputText('');
                        setAnalysisResult(null);
                        if (inputRef.current) {
                            inputRef.current.focus();
                        }
                    } catch (error) {
                        console.error('Failed to create inbox item:', error);
                        showErrorToast(t('inbox.addError'));
                    }
                } catch (error) {
                    console.error('Failed to save:', error);
                    showErrorToast(t('inbox.addError'));
                } finally {
                    setIsSaving(false);
                }
            },
            [
                inputText,
                isSaving,
                onTaskCreate,
                onNoteCreate,
                showSuccessToast,
                showErrorToast,
                t,
                tags,
                setTags,
                analysisResult,
                createMissingTags,
                createMissingProjects,
                getCleanedContent,
                projects,
                onSubmitOverride,
                onAfterSubmit,
            ]
        );

        useImperativeHandle(
            ref,
            () => ({
                submit: (forceInbox = false) => handleSubmit(forceInbox),
            }),
            [handleSubmit]
        );

        const composerFooterContext = useMemo<InboxComposerFooterContext>(
            () => ({
                text: inputText,
                cleanedText: getCleanedContent(inputText.trim()),
                hashtags: getAllTags(inputText),
                projectRefs: getAllProjects(inputText),
                clearText: clearComposerText,
                updateText: (value: string) => setInputText(value),
            }),
            [inputText, clearComposerText]
        );

        const defaultFooterActions =
            !renderFooterActions &&
            !isEditMode &&
            (openTaskModal || openProjectModal || openNoteModal) ? (
                <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {openTaskModal && (
                                <button
                                    onClick={() => {
                                        const taskTags = buildTagObjects(
                                            composerFooterContext.hashtags
                                        );
                                        const projectUid = resolveProjectUid(
                                            composerFooterContext.projectRefs
                                        );
                                        const cleaned =
                                            composerFooterContext.cleanedText ||
                                            composerFooterContext.text.trim();
                                        if (!cleaned) {
                                            return;
                                        }
                                        const newTask: Task = {
                                            name: cleaned,
                                            status: 'not_started',
                                            priority: null,
                                            tags: taskTags,
                                            Project: projectUid
                                                ? ({
                                                      uid: projectUid,
                                                  } as Project)
                                                : undefined,
                                            completed_at: null,
                                        };
                                        void openTaskModal(newTask);
                                        composerFooterContext.clearText();
                                    }}
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
                            )}
                            {openNoteModal && (
                                <button
                                    onClick={() => {
                                        const hashtagTags = buildTagObjects(
                                            composerFooterContext.hashtags
                                        );
                                        const bookmarkTag =
                                            composerFooterContext.hashtags.some(
                                                (tag) =>
                                                    tag.toLowerCase() ===
                                                    'bookmark'
                                            )
                                                ? []
                                                : isUrl(
                                                        composerFooterContext.text.trim()
                                                    )
                                                  ? [{ name: 'bookmark' }]
                                                  : [];
                                        const noteTags = [
                                            ...hashtagTags,
                                            ...bookmarkTag,
                                        ];
                                        const projectUid = resolveProjectUid(
                                            composerFooterContext.projectRefs
                                        );
                                        const newNote: Note = {
                                            title:
                                                composerFooterContext.cleanedText ||
                                                composerFooterContext.text.trim(),
                                            content:
                                                composerFooterContext.text.trim(),
                                            tags: noteTags,
                                            project_uid: projectUid,
                                        };
                                        openNoteModal(newNote);
                                        composerFooterContext.clearText();
                                    }}
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
                            )}
                            {openProjectModal && (
                                <button
                                    onClick={() => {
                                        const cleaned =
                                            composerFooterContext.cleanedText ||
                                            composerFooterContext.text.trim();
                                        if (!cleaned) {
                                            return;
                                        }
                                        const newProject: Project = {
                                            name: cleaned,
                                            description: '',
                                            status: 'planned',
                                            tags: buildTagObjects(
                                                composerFooterContext.hashtags
                                            ),
                                        };
                                        openProjectModal(newProject);
                                        composerFooterContext.clearText();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-200 dark:focus:ring-offset-gray-900"
                                >
                                    <span className="flex items-center gap-1">
                                        <span className="sm:hidden text-sm font-semibold leading-none">
                                            +
                                        </span>
                                        <FolderIcon className="h-4 w-4" />
                                        <span className="hidden sm:inline">
                                            {t(
                                                'inbox.createProject',
                                                'Project'
                                            )}
                                        </span>
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null;

        const footerActions =
            renderFooterActions?.(composerFooterContext) ||
            defaultFooterActions;

        const shouldShowPrimaryButton = !hidePrimaryButton && !isEditMode;

        const cardClasses = cardClassName ?? 'mb-6';

        return (
            <InboxCard
                className={`w-full border border-blue-300 dark:border-blue-600 ${cardClasses}`}
            >
                <div className="px-4 py-3">
                    <div
                        className={`flex flex-row gap-3 ${shouldShowPrimaryButton ? 'items-start justify-between' : 'items-start'}`}
                    >
                        <div className="relative flex-1">
                            <div className="flex items-center gap-3">
                                <LightBulbIcon className="h-5 w-5 text-amber-400 dark:text-amber-300" />
                                {multiline ? (
                                    <textarea
                                        ref={(el) => {
                                            inputRef.current = el;
                                        }}
                                        value={inputText}
                                        rows={6}
                                        onChange={handleChange}
                                        onSelect={(e) => {
                                            const pos =
                                                e.currentTarget
                                                    .selectionStart || 0;
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
                                                e.currentTarget
                                                    .selectionStart || 0;
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
                                                e.currentTarget
                                                    .selectionStart || 0;
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
                                        className="w-full text-base font-normal bg-transparent text-gray-900 dark:text-gray-100 border-0 focus:outline-none focus:ring-0 px-0 py-2 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                                        placeholder={t(
                                            'inbox.captureThought',
                                            'Capture a thought...'
                                        )}
                                        onKeyDown={(e) => {
                                            const hasTagSuggestions =
                                                showTagSuggestions &&
                                                filteredTags.length > 0;
                                            const hasProjectSuggestions =
                                                showProjectSuggestions &&
                                                filteredProjects.length > 0;

                                            if (hasTagSuggestions) {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setSelectedSuggestionIndex(
                                                        (prev) =>
                                                            prev <
                                                            filteredTags.length -
                                                                1
                                                                ? prev + 1
                                                                : 0
                                                    );
                                                    return;
                                                } else if (
                                                    e.key === 'ArrowUp'
                                                ) {
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
                                                        selectedSuggestionIndex >=
                                                        0
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
                                                    setShowTagSuggestions(
                                                        false
                                                    );
                                                    setFilteredTags([]);
                                                    setSelectedSuggestionIndex(
                                                        -1
                                                    );
                                                    return;
                                                }
                                            }

                                            if (hasProjectSuggestions) {
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
                                                } else if (
                                                    e.key === 'ArrowUp'
                                                ) {
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
                                                        selectedSuggestionIndex >=
                                                        0
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
                                                    setSelectedSuggestionIndex(
                                                        -1
                                                    );
                                                    return;
                                                }
                                            }

                                            if (
                                                e.key === 'Escape' &&
                                                !hasTagSuggestions &&
                                                !hasProjectSuggestions
                                            ) {
                                                e.preventDefault();
                                                if (isEditMode && !isSaving) {
                                                    handleSubmit();
                                                }
                                                return;
                                            }

                                            if (
                                                e.key === 'Enter' &&
                                                !e.shiftKey &&
                                                !isSaving
                                            ) {
                                                if (
                                                    hasTagSuggestions ||
                                                    hasProjectSuggestions
                                                ) {
                                                    return;
                                                }
                                                e.preventDefault();
                                                handleSubmit();
                                            }
                                        }}
                                    ></textarea>
                                ) : (
                                    <input
                                        ref={(el) => {
                                            inputRef.current = el;
                                        }}
                                        type="text"
                                        data-testid="quick-capture-input"
                                        value={inputText}
                                        onChange={handleChange}
                                        onSelect={(e) => {
                                            const pos =
                                                e.currentTarget
                                                    .selectionStart || 0;
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
                                                e.currentTarget
                                                    .selectionStart || 0;
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
                                                e.currentTarget
                                                    .selectionStart || 0;
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
                                        className="w-full text-base font-normal bg-transparent text-gray-900 dark:text-gray-100 border-0 focus:outline-none focus:ring-0 px-0 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                                        placeholder={t(
                                            'inbox.captureThought',
                                            'Capture a thought...'
                                        )}
                                        onKeyDown={(e) => {
                                            const hasTagSuggestions =
                                                showTagSuggestions &&
                                                filteredTags.length > 0;
                                            const hasProjectSuggestions =
                                                showProjectSuggestions &&
                                                filteredProjects.length > 0;

                                            if (hasTagSuggestions) {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setSelectedSuggestionIndex(
                                                        (prev) =>
                                                            prev <
                                                            filteredTags.length -
                                                                1
                                                                ? prev + 1
                                                                : 0
                                                    );
                                                    return;
                                                } else if (
                                                    e.key === 'ArrowUp'
                                                ) {
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
                                                        selectedSuggestionIndex >=
                                                        0
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
                                                    setShowTagSuggestions(
                                                        false
                                                    );
                                                    setFilteredTags([]);
                                                    setSelectedSuggestionIndex(
                                                        -1
                                                    );
                                                    return;
                                                }
                                            }

                                            if (hasProjectSuggestions) {
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
                                                } else if (
                                                    e.key === 'ArrowUp'
                                                ) {
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
                                                        selectedSuggestionIndex >=
                                                        0
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
                                                    setSelectedSuggestionIndex(
                                                        -1
                                                    );
                                                    return;
                                                }
                                            }

                                            if (
                                                e.key === 'Escape' &&
                                                !hasTagSuggestions &&
                                                !hasProjectSuggestions
                                            ) {
                                                e.preventDefault();
                                                if (isEditMode && !isSaving) {
                                                    handleSubmit();
                                                }
                                                return;
                                            }

                                            if (
                                                e.key === 'Enter' &&
                                                !e.shiftKey &&
                                                !isSaving
                                            ) {
                                                if (
                                                    hasTagSuggestions ||
                                                    hasProjectSuggestions
                                                ) {
                                                    return;
                                                }
                                                e.preventDefault();
                                                handleSubmit();
                                            }
                                        }}
                                    />
                                )}
                            </div>

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
                                onSelect={(tag) => handleTagSelect(tag.name)}
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
                                renderLabel={(project) => <>+{project.name}</>}
                            />

                            {urlPreview && (
                                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-blue-100 dark:bg-blue-800">
                                            {urlPreview.isLoading ? (
                                                <svg
                                                    className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-300"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    />
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    />
                                                </svg>
                                            ) : urlPreview.image &&
                                              !urlPreviewImageError ? (
                                                <img
                                                    src={urlPreview.image}
                                                    alt={
                                                        urlPreview.title ??
                                                        urlPreview.url
                                                    }
                                                    className="h-full w-full object-cover"
                                                    onError={() =>
                                                        setUrlPreviewImageError(
                                                            true
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <LinkIcon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        {urlPreview.title ||
                                                            t(
                                                                'inbox.linkPreview',
                                                                'Link preview'
                                                            )}
                                                    </p>
                                                    {urlPreview.description && (
                                                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 break-words">
                                                            {
                                                                urlPreview.description
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        dismissedPreviewUrlRef.current =
                                                            urlPreview.url;
                                                        setUrlPreview(null);
                                                    }}
                                                    className="rounded-md p-1 text-gray-400 transition hover:bg-white/60 hover:text-gray-600 dark:hover:bg-white/10"
                                                    aria-label={t(
                                                        'common.dismiss',
                                                        'Dismiss'
                                                    )}
                                                >
                                                    <XMarkIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                <span className="text-xs text-gray-500 dark:text-gray-400 break-all">
                                                    {urlPreview.url}
                                                </span>
                                                {!urlPreview.isLoading &&
                                                    !urlPreview.error && (
                                                        <a
                                                            href={
                                                                urlPreview.url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                                                        >
                                                            {t(
                                                                'common.open',
                                                                'Open'
                                                            )}
                                                        </a>
                                                    )}
                                                {urlPreview.error &&
                                                    !urlPreview.isLoading && (
                                                        <>
                                                            <span className="text-xs text-red-500">
                                                                {t(
                                                                    'inbox.linkPreviewError',
                                                                    'Could not fetch link details'
                                                                )}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    fetchUrlPreview(
                                                                        urlPreview.url,
                                                                        urlPreview.detectedText ||
                                                                            urlPreview.url
                                                                    )
                                                                }
                                                                className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                                                            >
                                                                {t(
                                                                    'common.retry',
                                                                    'Retry'
                                                                )}
                                                            </button>
                                                        </>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(() => {
                                const suggestion = getSuggestion();
                                return suggestion.type && suggestion.message ? (
                                    <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start flex-1">
                                                <div className="text-purple-600 dark:text-purple-400 mr-2 mt-0.5">
                                                    <svg
                                                        className="h-3 w-3"
                                                        fill="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path d="M12 2l2.09 6.26L20 10.27l-5.91 2.01L12 18.54l-2.09-6.26L4 10.27l5.91-2.01L12 2z" />
                                                        <path d="M8 1l1.18 3.52L12 5.64l-2.82.96L8 10.12l-1.18-3.52L4 5.64l2.82-.96L8 1z" />
                                                        <path d="M20 14l.79 2.37L23 17.45l-2.21.75L20 20.57l-.79-2.37L17 17.45l2.21-.75L20 14z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">
                                                        {suggestion.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-gray-600 dark:text-gray-400">
                                                            or
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                handleSubmit(
                                                                    true
                                                                );
                                                            }}
                                                            className="text-purple-600 dark:text-purple-400 hover:underline"
                                                        >
                                                            save as inbox item
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            {isAnalyzing && (
                                                <div className="ml-2 h-3 w-3 border-2 border-purple-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                                            )}
                                        </div>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                        {shouldShowPrimaryButton && (
                            <button
                                type="button"
                                onClick={() => handleSubmit(false)}
                                disabled={!inputText.trim() || isSaving}
                                className={`flex-shrink-0 self-start mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors ${
                                    inputText.trim() && !isSaving
                                        ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                                        : 'bg-blue-400 dark:bg-blue-700 cursor-not-allowed'
                                }`}
                            >
                                {isSaving ? (
                                    <>
                                        <svg
                                            className="animate-spin h-3.5 w-3.5"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    <>
                                        <PlusIcon className="h-3.5 w-3.5" />
                                        {t('common.add', 'Add')}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                    {footerActions}
                </div>
            </InboxCard>
        );
    }
);

QuickCaptureInput.displayName = 'QuickCaptureInput';

export default QuickCaptureInput;
