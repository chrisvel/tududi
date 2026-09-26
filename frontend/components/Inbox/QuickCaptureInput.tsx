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
import {
    createInboxItemWithStore,
    deleteInboxItemWithStore,
    analyzeInboxText,
    applyAnalysisToTask,
    InboxAnalysis,
} from '../../utils/inboxService';
import { createNote, deleteNote } from '../../utils/notesService';
import {
    CaptureTarget,
    CapturedItem,
    nonEmptyLines,
    splitCaptureText,
    splitFirstLine,
} from '../../utils/captureText';
import {
    isTouchDevice,
    updateCaptureSettings,
    useCaptureSettings,
} from '../../utils/captureSettings';
import CaptureDestinations from '../Capture/CaptureDestinations';
import {
    fetchWorkspaceAssignablePeople,
    fetchAssignablePeopleForProject,
} from '../../utils/peopleService';
import { Person } from '../../entities/Person';
import { isAuthError, OfflineQueuedError } from '../../utils/authUtils';
import { createTag } from '../../utils/tagsService';
import {
    createProject,
    deleteProject,
    fetchProjects,
} from '../../utils/projectsService';
import { LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { isUrl, extractUrlTitle } from '../../utils/urlService';
import InboxSelectedChips from './InboxSelectedChips';
import SuggestionsDropdown from './SuggestionsDropdown';
export interface QuickCaptureInputHandle {
    submit: (forceInbox?: boolean) => Promise<void>;
    focus: () => void;
}

export interface InboxComposerFooterContext {
    text: string;
    cleanedText: string;
    hashtags: string[];
    projectRefs: string[];
    analysis: InboxAnalysis | null;
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
    // One box for everything: an explicit "Add to Inbox | Task | Note |
    // Project" choice decides what the text becomes, and every target reads
    // dates, #tags, +projects and @people the same way.
    unified?: boolean;
    defaultTarget?: CaptureTarget;
    // Changing this puts the box back on defaultTarget (a new open)
    resetKey?: number;
    compact?: boolean;
    onClose?: () => void;
    onCaptured?: (items: CapturedItem[]) => void;
}

interface CaptureStatus {
    text: string;
    items?: CapturedItem[];
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
// Simplified regex to avoid catastrophic backtracking with nested quantifiers
const urlWithoutProtocolRegex =
    /(?:^|\s)((?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::[0-9]+)?(?:\/[^\s]*)?)/i;

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

// Five suggestions at their row height, plus a little room.
const SUGGESTIONS_HEIGHT = 200;

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
            multiline = true,
            unified = false,
            defaultTarget = 'inbox',
            resetKey,
            compact = false,
            onClose,
            onCaptured,
        },
        ref
    ) => {
        const { t } = useTranslation();
        const [inputText, setInputText] = useState<string>(initialValue);
        const captureSettings = useCaptureSettings();
        const [target, setTarget] = useState<CaptureTarget>(defaultTarget);
        const [status, setStatus] = useState<CaptureStatus | null>(null);
        const enterSaves =
            (isTouchDevice()
                ? captureSettings.enterTouch
                : captureSettings.enterKeyboard) === 'save';
        const [isSaving, setIsSaving] = useState(false);
        const { showSuccessToast, showErrorToast } = useToast();
        const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
        const fieldRef = useRef<HTMLDivElement>(null);
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
        const [dropdownPosition, setDropdownPosition] = useState<{
            left: number;
            top: number;
            bottom?: number;
        }>({
            left: 0,
            top: 0,
        });
        const [selectedSuggestionIndex, setSelectedSuggestionIndex] =
            useState(-1);

        const placeholderData = [
            { key: 'inbox.captureThought', fallback: 'Capture a thought…' },
            { key: 'inbox.rollingMsg1', fallback: "What's on your mind?" },
            { key: 'inbox.rollingMsg2', fallback: 'Anything to let go of?' },
            { key: 'inbox.rollingMsg3', fallback: 'Jot it down…' },
        ] as const;
        const [placeholderIdx, setPlaceholderIdx] = useState(0);
        const [placeholderFading, setPlaceholderFading] = useState(false);

        const [analysisResult, setAnalysisResult] =
            useState<InboxAnalysis | null>(null);
        const [showPersonSuggestions, setShowPersonSuggestions] =
            useState(false);
        const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
        const peopleCacheRef = useRef<Record<string, Person[]>>({});
        const personQueryRequestRef = useRef(0);
        // A date phrase the user chose to keep as plain text
        const [dismissedDateText, setDismissedDateText] = useState<
            string | null
        >(null);
        const [isAnalyzing, setIsAnalyzing] = useState(false);
        const analysisTimeoutRef = useRef<NodeJS.Timeout>();
        const analysisRequestIdRef = useRef(0);
        const [urlPreview, setUrlPreview] = useState<UrlPreviewState | null>(
            null
        );
        const [urlPreviewImageError, setUrlPreviewImageError] = useState(false);
        const urlPreviewRequestIdRef = useRef(0);
        const dismissedPreviewUrlRef = useRef<string | null>(null);
        const lastAnalyzedTextRef = useRef<string>('');

        const isEditMode = mode === 'edit';

        useEffect(() => {
            setTarget(defaultTarget);
        }, [resetKey, defaultTarget]);

        useEffect(() => {
            if (isEditMode) {
                setInputText(initialValue || '');
            }
        }, [initialValue, isEditMode]);

        useEffect(() => {
            if (autoFocus && inputRef.current) {
                inputRef.current.focus();
                // Prefilled text (e.g. handed over by the OS share sheet)
                // should leave the caret ready to keep typing
                const caret = inputRef.current.value.length;
                if (caret > 0) {
                    inputRef.current.setSelectionRange(caret, caret);
                }
            }
        }, [autoFocus]);

        useEffect(() => {
            if (isEditMode || unified) return;
            const id = setInterval(() => {
                setPlaceholderFading(true);
                setTimeout(() => {
                    setPlaceholderIdx((i) => (i + 1) % placeholderData.length);
                    setPlaceholderFading(false);
                }, 300);
            }, 4000);
            return () => clearInterval(id);
        }, [isEditMode, unified]);

        useEffect(() => {
            if (!multiline) return;
            const el = inputRef.current;
            if (!el) return;
            el.style.height = 'auto';
            const maxHeight = 300;
            el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
            (el as HTMLElement).style.overflowY =
                el.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }, [inputText, multiline]);

        // Dates and @people are read on the first line only, so a date
        // mentioned further down a long note never becomes its due date.
        const analysisSource = unified
            ? splitFirstLine(inputText).first
            : inputText;

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
                                return matches;
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

                if (
                    char === '"' &&
                    (i === 0 || text[i - 1] === '+' || text[i - 1] === '@')
                ) {
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

        // @name or @"Full Name" ending at the caret; null when not in one.
        const PERSON_QUERY_PATTERN = /(^|\s)@(?:"([^"]*)|([^\s"@]*))$/u;

        const getCurrentPersonQuery = (
            text: string,
            position: number
        ): string | null => {
            const match = text
                .substring(0, position)
                .match(PERSON_QUERY_PATTERN);
            if (!match) return null;
            return match[2] ?? match[3] ?? '';
        };

        const loadAssignablePeople = async (
            projectUid?: string
        ): Promise<Person[]> => {
            const key = projectUid || '';
            const cached = peopleCacheRef.current[key];
            if (cached) return cached;
            let people: Person[];
            try {
                people = projectUid
                    ? await fetchAssignablePeopleForProject(projectUid)
                    : await fetchWorkspaceAssignablePeople();
            } catch {
                people = projectUid ? await loadAssignablePeople() : [];
            }
            peopleCacheRef.current[key] = people;
            return people;
        };

        const showPeopleFor = async (
            query: string,
            text: string,
            input: HTMLInputElement | HTMLTextAreaElement,
            position: number
        ) => {
            const requestId = ++personQueryRequestRef.current;
            const people = await loadAssignablePeople(
                resolveProjectUid(parseProjectRefs(text))
            );
            if (personQueryRequestRef.current !== requestId) return;

            const wanted = query.toLowerCase();
            const filtered = people
                .filter((person) => person.name.toLowerCase().includes(wanted))
                .slice(0, 5);
            setDropdownPosition(calculateDropdownPosition(input, position));
            setFilteredPeople(filtered);
            setShowPersonSuggestions(true);
            setSelectedSuggestionIndex(-1);
        };

        const handlePersonSelect = (personName: string) => {
            const beforeCursor = inputText.substring(0, cursorPosition);
            const afterCursor = inputText.substring(cursorPosition);
            if (!PERSON_QUERY_PATTERN.test(beforeCursor)) return;

            const formatted = /\s/.test(personName)
                ? `"${personName}"`
                : personName;
            const newBefore = beforeCursor.replace(
                PERSON_QUERY_PATTERN,
                (_, lead) => `${lead}@${formatted} `
            );
            setInputText(newBefore + afterCursor.replace(/^"/, ''));
            closeSuggestions();

            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(
                        newBefore.length,
                        newBefore.length
                    );
                }
            }, 0);
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

        const removePersonFromText = (personName: string) => {
            const escaped = escapeRegExp(personName);
            const pattern = new RegExp(
                `(^|\\s)@(?:"${escaped}"|${escaped})(?=$|[\\s.,;:!?)])`,
                'gi'
            );
            setInputText(
                cleanInputSpacing(
                    inputText.replace(pattern, (_, prefix) => prefix ?? '')
                )
            );
            setAnalysisResult(null);
            inputRef.current?.focus();
        };

        const getCaretViewportCoords = (
            element: HTMLTextAreaElement | HTMLInputElement,
            position: number
        ): { left: number; top: number } => {
            const cs = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();

            const mirror = document.createElement('div');
            Object.assign(mirror.style, {
                position: 'fixed',
                visibility: 'hidden',
                pointerEvents: 'none',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${element.offsetWidth}px`,
                boxSizing: 'border-box',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: cs.fontSize,
                fontFamily: cs.fontFamily,
                fontWeight: cs.fontWeight,
                fontStyle: cs.fontStyle,
                lineHeight: cs.lineHeight,
                letterSpacing: cs.letterSpacing,
                paddingTop: cs.paddingTop,
                paddingRight: cs.paddingRight,
                paddingBottom: cs.paddingBottom,
                paddingLeft: cs.paddingLeft,
                borderTopWidth: cs.borderTopWidth,
                borderRightWidth: cs.borderRightWidth,
                borderBottomWidth: cs.borderBottomWidth,
                borderLeftWidth: cs.borderLeftWidth,
            });

            mirror.appendChild(
                document.createTextNode(element.value.substring(0, position))
            );

            const caret = document.createElement('span');
            caret.textContent = element.value[position] || '|';
            mirror.appendChild(caret);

            document.body.appendChild(mirror);
            const caretRect = caret.getBoundingClientRect();
            document.body.removeChild(mirror);

            return {
                left: caretRect.left,
                top: caretRect.bottom + 4,
            };
        };

        const caretDropdownPosition = (
            input: HTMLInputElement | HTMLTextAreaElement,
            cursorPos: number
        ) => {
            const beforeCursor = inputText.substring(0, cursorPos);
            const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);
            const projectMatch = beforeCursor.match(/\+[a-zA-Z0-9_\s]*$/);
            const personMatch = beforeCursor.match(PERSON_QUERY_PATTERN);

            if (personMatch) {
                const triggerPos = beforeCursor.lastIndexOf('@');
                return getCaretViewportCoords(input, triggerPos);
            }

            if (hashtagMatch) {
                const triggerPos = beforeCursor.lastIndexOf('#');
                return getCaretViewportCoords(input, triggerPos);
            }

            if (projectMatch) {
                const triggerPos = beforeCursor.lastIndexOf('+');
                return getCaretViewportCoords(input, triggerPos);
            }

            return getCaretViewportCoords(input, cursorPos);
        };

        // In the compact box, suggestions open on whichever side of the field
        // has room (below it on wide screens, above it in the phone sheet),
        // lined up with the # + or @ that started them, so they never cover
        // the text being typed.
        const calculateDropdownPosition = (
            input: HTMLInputElement | HTMLTextAreaElement,
            cursorPos: number
        ) => {
            const caret = caretDropdownPosition(input, cursorPos);
            const field = fieldRef.current;
            if (!compact || !field) return caret;
            const rect = field.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow >= SUGGESTIONS_HEIGHT || spaceBelow >= rect.top) {
                return { left: caret.left, top: rect.bottom + 4 };
            }
            return {
                left: caret.left,
                top: 0,
                bottom: window.innerHeight - rect.top + 4,
            };
        };

        const handleChange = (
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => {
            const newText = e.target.value;
            const newCursorPosition = e.target.selectionStart || 0;

            if (status) {
                setStatus(null);
            }
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

            const personQuery = getCurrentPersonQuery(
                newText,
                newCursorPosition
            );
            if (personQuery !== null) {
                setShowTagSuggestions(false);
                setFilteredTags([]);
                setShowProjectSuggestions(false);
                setFilteredProjects([]);
                void showPeopleFor(
                    personQuery,
                    newText,
                    e.target,
                    newCursorPosition
                );
                return;
            }
            personQueryRequestRef.current += 1;
            setShowPersonSuggestions(false);
            setFilteredPeople([]);

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

                const alreadyHasProject = parseProjectRefs(newText).some(
                    (name) => name.toLowerCase() !== projectQuery.toLowerCase()
                );

                if (alreadyHasProject) {
                    setShowProjectSuggestions(false);
                    setFilteredProjects([]);
                } else {
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
                }
            } else {
                setShowTagSuggestions(false);
                setFilteredTags([]);
                setShowProjectSuggestions(false);
                setFilteredProjects([]);
                setSelectedSuggestionIndex(-1);
            }
        };

        const getAllTags = (text: string): string[] => {
            if (analysisResult && lastAnalyzedTextRef.current === text.trim()) {
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
            if (analysisResult && lastAnalyzedTextRef.current === text.trim()) {
                return analysisResult.parsed_projects.slice(0, 1);
            }

            return parseProjectRefs(text);
        };

        const getCleanedContent = (text: string): string => {
            if (analysisResult && lastAnalyzedTextRef.current === text) {
                return analysisResult.cleaned_content;
            }

            return text
                .replace(/#[a-zA-Z0-9_-]+/g, '')
                .replace(/\+(?:"[^"]+"|\S+)/g, '')
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
                    const result = await analyzeInboxText(text, {
                        parseDates: !(
                            dismissedDateText &&
                            text.includes(dismissedDateText)
                        ),
                    });

                    if (analysisRequestIdRef.current !== requestId) {
                        return;
                    }

                    setAnalysisResult(result);
                    lastAnalyzedTextRef.current = text;
                } catch (error) {
                    if (analysisRequestIdRef.current !== requestId) {
                        return;
                    }
                    console.error('Error analyzing text:', error);
                    setAnalysisResult(null);
                    lastAnalyzedTextRef.current = '';
                } finally {
                    if (analysisRequestIdRef.current === requestId) {
                        setIsAnalyzing(false);
                    }
                }
            },
            [dismissedDateText]
        );

        useEffect(() => {
            if (!inputText.trim()) {
                setDismissedDateText(null);
            }
        }, [inputText]);

        useEffect(() => {
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }

            const requestId = analysisRequestIdRef.current + 1;
            analysisRequestIdRef.current = requestId;

            const textForAnalysis = analysisSource;

            analysisTimeoutRef.current = setTimeout(() => {
                analyzeText(textForAnalysis, requestId);
            }, 300);

            return () => {
                if (analysisTimeoutRef.current) {
                    clearTimeout(analysisTimeoutRef.current);
                }
            };
        }, [analysisSource, analyzeText]);

        const handleTagSelect = (tagName: string) => {
            const beforeCursor = inputText.substring(0, cursorPosition);
            const afterCursor = inputText.substring(cursorPosition);
            const hashtagMatch = beforeCursor.match(/#([a-zA-Z0-9_]*)$/);

            if (hashtagMatch) {
                const newText =
                    beforeCursor.replace(/#([a-zA-Z0-9_]*)$/, `#${tagName} `) +
                    afterCursor;
                setInputText(newText);
                setShowTagSuggestions(false);
                setFilteredTags([]);
                setSelectedSuggestionIndex(-1);

                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        const newCursorPos = beforeCursor.replace(
                            /#([a-zA-Z0-9_]*)$/,
                            `#${tagName} `
                        ).length;
                        inputRef.current.setSelectionRange(
                            newCursorPos,
                            newCursorPos
                        );
                    }
                }, 0);
            }
        };

        const handleProjectSelect = (projectName: string) => {
            const beforeCursor = inputText.substring(0, cursorPosition);
            const afterCursor = inputText.substring(cursorPosition);
            const projectMatch = beforeCursor.match(
                /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/
            );

            if (projectMatch) {
                const formattedProjectName = projectName.includes(' ')
                    ? `"${projectName}"`
                    : projectName;

                const newText =
                    beforeCursor.replace(
                        /\+(?:"([^"]*)"|([a-zA-Z0-9_\s]*))$/,
                        `+${formattedProjectName} `
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
                            `+${formattedProjectName} `
                        ).length;
                        inputRef.current.setSelectionRange(
                            newCursorPos,
                            newCursorPos
                        );
                    }
                }, 0);
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

                        let projectUid: string | undefined = undefined;
                        if (analysisResult.parsed_projects.length > 0) {
                            const projectName =
                                analysisResult.parsed_projects[0];
                            const matchingProject = projects.find(
                                (project) =>
                                    project.name.toLowerCase() ===
                                    projectName.toLowerCase()
                            );
                            if (matchingProject) {
                                projectUid = matchingProject.uid;
                            }
                        }

                        const newTask: Task = applyAnalysisToTask(
                            {
                                name: cleanedText,
                                status: 'not_started',
                                priority: 'low',
                                tags: taskTags,
                                project_uid: projectUid,
                                completed_at: null,
                            },
                            analysisResult
                        );

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
                            if (error instanceof OfflineQueuedError) {
                                showSuccessToast(
                                    t(
                                        'inbox.itemQueuedOffline',
                                        "Saved offline. It'll sync automatically once you're back online."
                                    )
                                );
                                setInputText('');
                                setAnalysisResult(null);
                                if (inputRef.current) {
                                    inputRef.current.focus();
                                }
                                return;
                            }
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

                        let noteProjectUid: string | undefined = undefined;
                        if (analysisResult.parsed_projects.length > 0) {
                            const projectName =
                                analysisResult.parsed_projects[0];
                            const matchingProject = projects.find(
                                (project) =>
                                    project.name.toLowerCase() ===
                                    projectName.toLowerCase()
                            );
                            if (matchingProject) {
                                noteProjectUid = matchingProject.uid;
                            }
                        }

                        const newNote: Note = {
                            title: cleanedText || trimmedText,
                            content: trimmedText,
                            tags: taskTags,
                            project_uid: noteProjectUid,
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
                            if (error instanceof OfflineQueuedError) {
                                showSuccessToast(
                                    t(
                                        'inbox.itemQueuedOffline',
                                        "Saved offline. It'll sync automatically once you're back online."
                                    )
                                );
                                setInputText('');
                                setAnalysisResult(null);
                                if (inputRef.current) {
                                    inputRef.current.focus();
                                }
                                return;
                            }
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
                        if (error instanceof OfflineQueuedError) {
                            showSuccessToast(
                                t(
                                    'inbox.itemQueuedOffline',
                                    "Saved offline. It'll sync automatically once you're back online."
                                )
                            );
                            setInputText('');
                            setAnalysisResult(null);
                            if (inputRef.current) {
                                inputRef.current.focus();
                            }
                            return;
                        }
                        console.error('Failed to create inbox item:', error);
                        showErrorToast(t('inbox.addError'));
                    }
                } catch (error) {
                    if (error instanceof OfflineQueuedError) {
                        showSuccessToast(
                            t(
                                'inbox.itemQueuedOffline',
                                "Saved offline. It'll sync automatically once you're back online."
                            )
                        );
                        setInputText('');
                        setAnalysisResult(null);
                        if (inputRef.current) {
                            inputRef.current.focus();
                        }
                        return;
                    }
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

        const short = (text: string, max = 36) =>
            text.length > max ? `${text.slice(0, max)}...` : text;

        const refreshProjectsStore = async () => {
            try {
                const list = await fetchProjects();
                useStore.getState().projectsStore.setProjects(list);
            } catch (error) {
                console.error('Failed to refresh projects:', error);
            }
        };

        const resolveOrCreateProject = async (
            name: string | undefined
        ): Promise<string | undefined> => {
            if (!name) {
                return undefined;
            }
            const existing = projects.find(
                (project) => project.name.toLowerCase() === name.toLowerCase()
            );
            if (existing) {
                return existing.uid;
            }
            const created = await createProject({ name, status: 'planned' });
            await refreshProjectsStore();
            return created.uid;
        };

        const cleanFirstLine = (
            line: string,
            analysis: InboxAnalysis | null
        ): string => {
            const cleaned = (
                analysis?.cleaned_content ??
                line
                    .replace(/#[a-zA-Z0-9_-]+/g, '')
                    .replace(/\+(?:"[^"]+"|\S+)/g, '')
            ).trim();
            return cleaned || line.trim();
        };

        // Create one item of the chosen kind from one raw text. The first
        // line is the title (dates, @people, #tags and +projects are read
        // from it) and the other lines are its notes or body.
        const captureOne = async (
            destination: CaptureTarget,
            itemText: string
        ): Promise<CapturedItem> => {
            const { first, rest } = splitFirstLine(itemText);

            if (destination === 'inbox') {
                await createMissingTags(itemText);
                await createMissingProjects(itemText);
                const item = await createInboxItemWithStore(itemText);
                return { target: destination, uid: item.uid, title: first };
            }

            // Only tasks and projects have dates (and tasks an assignee), so
            // a note keeps its whole title apart from #tags and +project.
            let analysis: InboxAnalysis | null = null;
            if (destination === 'task' || destination === 'project') {
                try {
                    analysis = await analyzeInboxText(first, {
                        parseDates: !(
                            dismissedDateText &&
                            first.includes(dismissedDateText)
                        ),
                    });
                } catch (error) {
                    console.error('Error analyzing text:', error);
                }
            }

            const title = cleanFirstLine(first, analysis);
            const tagNames = Array.from(
                new Map(
                    [
                        ...(analysis?.parsed_tags ?? []),
                        ...parseHashtags(itemText),
                    ].map((name) => [name.toLowerCase(), name])
                ).values()
            );
            await createMissingTags(itemText);
            const tagObjects = buildTagObjects(tagNames);

            if (destination === 'project') {
                const created = await createProject({
                    name: title,
                    description: rest,
                    status: 'planned',
                    tags: tagObjects,
                    due_date_at: analysis?.parsed_due_date ?? undefined,
                });
                await refreshProjectsStore();
                return { target: destination, uid: created.uid, title };
            }

            const projectUid = await resolveOrCreateProject(
                analysis?.parsed_projects?.[0] ?? parseProjectRefs(itemText)[0]
            );

            if (destination === 'task') {
                const task = applyAnalysisToTask(
                    {
                        name: title,
                        note: rest || undefined,
                        status: 'not_started',
                        tags: tagObjects,
                        project_uid: projectUid,
                        completed_at: null,
                    },
                    analysis
                );
                const created = await useStore
                    .getState()
                    .tasksStore.createTask(task);
                return { target: destination, uid: created.uid, title };
            }

            const isUrlContent =
                isUrl(first.trim()) ||
                analysis?.suggested_reason === 'url_detected';
            const hasBookmark = tagNames.some(
                (name) => name.toLowerCase() === 'bookmark'
            );
            const created = await createNote({
                title,
                content: rest || itemText,
                tags:
                    isUrlContent && !hasBookmark
                        ? [...tagObjects, { name: 'bookmark' }]
                        : tagObjects,
                project_uid: projectUid,
            });
            return { target: destination, uid: created.uid, title };
        };

        const describeCaptured = (
            destination: CaptureTarget,
            items: CapturedItem[]
        ): string => {
            const title = short(items[0].title);
            const total = items.length;
            switch (destination) {
                case 'inbox':
                    return total === 1
                        ? t(
                              'capture.savedInbox',
                              'Saved "{{title}}" to Inbox.',
                              { title }
                          )
                        : t(
                              'capture.savedInboxMany',
                              'Saved {{total}} items to Inbox.',
                              { total }
                          );
                case 'task':
                    return total === 1
                        ? t(
                              'capture.createdTask',
                              'Created task "{{title}}".',
                              { title }
                          )
                        : t(
                              'capture.createdTasks',
                              'Created {{total}} tasks.',
                              { total }
                          );
                case 'note':
                    return total === 1
                        ? t(
                              'capture.createdNote',
                              'Created note "{{title}}".',
                              { title }
                          )
                        : t(
                              'capture.createdNotes',
                              'Created {{total}} notes.',
                              { total }
                          );
                default:
                    return total === 1
                        ? t(
                              'capture.createdProject',
                              'Created project "{{title}}".',
                              { title }
                          )
                        : t(
                              'capture.createdProjects',
                              'Created {{total}} projects.',
                              { total }
                          );
            }
        };

        const undoCaptured = async (items: CapturedItem[]) => {
            try {
                for (const item of [...items].reverse()) {
                    if (!item.uid) continue;
                    if (item.target === 'inbox') {
                        await deleteInboxItemWithStore(item.uid);
                    } else if (item.target === 'task') {
                        await useStore
                            .getState()
                            .tasksStore.deleteTask(item.uid);
                    } else if (item.target === 'note') {
                        await deleteNote(item.uid);
                    } else {
                        await deleteProject(item.uid);
                        await refreshProjectsStore();
                    }
                }
                setStatus({
                    text: t('capture.removed', 'Removed. Nothing was saved.'),
                });
            } catch (error) {
                console.error('Failed to undo capture:', error);
                showErrorToast(
                    t(
                        'capture.undoError',
                        'Could not remove it. Find it in its list and delete it there.'
                    )
                );
            }
        };

        const handleUnifiedSubmit = async () => {
            const raw = inputText.trim();
            if (!raw || isSaving) return;

            const texts = splitCaptureText(raw, captureSettings.oneItemPerLine);
            const captured: CapturedItem[] = [];
            const destination = target;

            const finish = (items: CapturedItem[], remaining: string[]) => {
                setInputText(remaining.join('\n'));
                setAnalysisResult(null);
                setUrlPreview(null);
                dismissedPreviewUrlRef.current = null;
                if (items.length > 0) {
                    setStatus({
                        text: describeCaptured(destination, items),
                        items,
                    });
                    onCaptured?.(items);
                }
                inputRef.current?.focus();
            };

            setIsSaving(true);
            setStatus(null);
            try {
                for (const itemText of texts) {
                    captured.push(await captureOne(destination, itemText));
                }
                finish(captured, []);
            } catch (error) {
                if (error instanceof OfflineQueuedError) {
                    finish([], []);
                    setStatus({
                        text: t(
                            'inbox.itemQueuedOffline',
                            "Saved offline. It'll sync automatically once you're back online."
                        ),
                    });
                } else if (!isAuthError(error)) {
                    console.error('Failed to capture:', error);
                    // Keep the lines that were not saved so a retry does not
                    // duplicate the ones that were
                    finish(captured, texts.slice(captured.length));
                    showErrorToast(
                        t(
                            'capture.saveError',
                            'Could not save. Your text is still here.'
                        )
                    );
                }
            } finally {
                setIsSaving(false);
            }
        };

        const insertLineBreak = () => {
            const el = inputRef.current;
            if (!el) return;
            const start = el.selectionStart ?? inputText.length;
            const end = el.selectionEnd ?? start;
            setInputText(
                `${inputText.slice(0, start)}\n${inputText.slice(end)}`
            );
            setStatus(null);
            requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(start + 1, start + 1);
            });
        };

        useImperativeHandle(
            ref,
            () => ({
                submit: (forceInbox = false) =>
                    unified ? handleUnifiedSubmit() : handleSubmit(forceInbox),
                focus: () => {
                    const el = inputRef.current;
                    if (!el) return;
                    el.focus();
                    // A kept draft continues where it left off.
                    const end = el.value.length;
                    el.setSelectionRange(end, end);
                },
            }),
            [handleSubmit, handleUnifiedSubmit, unified]
        );

        const closeSuggestions = () => {
            setShowTagSuggestions(false);
            setFilteredTags([]);
            setShowProjectSuggestions(false);
            setFilteredProjects([]);
            personQueryRequestRef.current += 1;
            setShowPersonSuggestions(false);
            setFilteredPeople([]);
            setSelectedSuggestionIndex(-1);
        };

        // The open suggestion list, if any, as a count and a picker
        const activeSuggestions: {
            count: number;
            select: (index: number) => void;
        } | null =
            showTagSuggestions && filteredTags.length > 0
                ? {
                      count: filteredTags.length,
                      select: (index) =>
                          handleTagSelect(filteredTags[index].name),
                  }
                : showProjectSuggestions && filteredProjects.length > 0
                  ? {
                        count: filteredProjects.length,
                        select: (index) =>
                            handleProjectSelect(filteredProjects[index].name),
                    }
                  : showPersonSuggestions && filteredPeople.length > 0
                    ? {
                          count: filteredPeople.length,
                          select: (index) =>
                              handlePersonSelect(filteredPeople[index].name),
                      }
                    : null;

        const handleCaretEvent = (
            e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => {
            const pos = e.currentTarget.selectionStart || 0;
            setCursorPosition(pos);
            if (
                showTagSuggestions ||
                showProjectSuggestions ||
                showPersonSuggestions
            ) {
                setDropdownPosition(
                    calculateDropdownPosition(e.currentTarget, pos)
                );
            }
        };

        const handleKeyDown = (
            e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => {
            if (activeSuggestions) {
                const { count, select } = activeSuggestions;
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSuggestionIndex((prev) =>
                        prev < count - 1 ? prev + 1 : 0
                    );
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSuggestionIndex((prev) =>
                        prev > 0 ? prev - 1 : count - 1
                    );
                    return;
                }
                if (e.key === 'Tab') {
                    e.preventDefault();
                    select(
                        selectedSuggestionIndex >= 0
                            ? selectedSuggestionIndex
                            : 0
                    );
                    return;
                }
                if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                    e.preventDefault();
                    select(selectedSuggestionIndex);
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeSuggestions();
                    return;
                }
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                if (isEditMode && !isSaving) {
                    handleSubmit();
                } else if (unified) {
                    onClose?.();
                }
                return;
            }

            if (unified && e.key === 'Enter' && !e.nativeEvent.isComposing) {
                if (activeSuggestions) {
                    return;
                }
                if (isSaving) {
                    e.preventDefault();
                    return;
                }
                // Ctrl or Cmd + Enter always saves. Plain Enter saves or
                // starts a new line, as chosen for this kind of device.
                if (e.ctrlKey || e.metaKey || (enterSaves && !e.shiftKey)) {
                    e.preventDefault();
                    void handleUnifiedSubmit();
                }
                return;
            }

            if (e.key === 'Enter' && !e.shiftKey && !isSaving) {
                if (activeSuggestions) {
                    return;
                }
                e.preventDefault();
                handleSubmit();
            }
        };

        const currentAnalysis =
            analysisResult &&
            lastAnalyzedTextRef.current.trim() === analysisSource.trim()
                ? analysisResult
                : null;
        const dateIsDismissed =
            !!dismissedDateText && analysisSource.includes(dismissedDateText);
        const dateChip =
            currentAnalysis?.parsed_due_date && !dateIsDismissed
                ? {
                      date: currentAnalysis.parsed_due_date,
                      phrase: currentAnalysis.parsed_date_text,
                      recurring: !!currentAnalysis.parsed_recurrence,
                  }
                : null;
        const assigneeChip = currentAnalysis?.parsed_assignee
            ? {
                  name: currentAnalysis.parsed_assignee.name,
                  color: Object.values(peopleCacheRef.current)
                      .flat()
                      .find(
                          (person) =>
                              person.uid ===
                              currentAnalysis.parsed_assignee?.uid
                      )?.color,
              }
            : null;

        const composerFooterContext = useMemo<InboxComposerFooterContext>(
            () => ({
                text: inputText,
                cleanedText: getCleanedContent(inputText.trim()),
                hashtags: getAllTags(inputText),
                projectRefs: getAllProjects(inputText),
                analysis:
                    analysisResult &&
                    lastAnalyzedTextRef.current.trim() === inputText.trim()
                        ? analysisResult
                        : null,
                clearText: clearComposerText,
                updateText: (value: string) => setInputText(value),
            }),
            [inputText, clearComposerText, analysisResult]
        );

        const defaultFooterActions =
            !renderFooterActions &&
            !isEditMode &&
            (openTaskModal || openProjectModal || openNoteModal) ? (
                <div className="mt-2 flex items-center gap-3.5 h-5 overflow-hidden">
                    {!inputText.trim() ? (
                        <span className="text-[10px] text-gray-300 dark:text-gray-600">
                            {t('inbox.shiftEnterHint')}
                        </span>
                    ) : (
                        <>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                {t('inbox.saveAs')}
                            </span>
                            {openTaskModal && (
                                <button
                                    type="button"
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
                                        const newTask: Task =
                                            applyAnalysisToTask(
                                                {
                                                    name: cleaned,
                                                    status: 'not_started',
                                                    priority: null,
                                                    tags: taskTags,
                                                    project_uid: projectUid,
                                                    completed_at: null,
                                                },
                                                composerFooterContext.analysis
                                            );
                                        void openTaskModal(newTask);
                                        composerFooterContext.clearText();
                                    }}
                                    className="text-[12px] text-blue-600 dark:text-blue-400 hover:underline transition-colors focus:outline-none"
                                >
                                    {t('inbox.createTask', 'Task')}
                                </button>
                            )}
                            {openNoteModal && (
                                <button
                                    type="button"
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
                                    className="text-[12px] text-purple-600 dark:text-purple-400 hover:underline transition-colors focus:outline-none"
                                >
                                    {t('inbox.createNote', 'Note')}
                                </button>
                            )}
                            {openProjectModal && (
                                <button
                                    type="button"
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
                                    className="text-[12px] text-green-600 dark:text-green-400 hover:underline transition-colors focus:outline-none"
                                >
                                    {t('inbox.createProject', 'Project')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            ) : null;

        const lineTotal = unified ? nonEmptyLines(inputText).length : 0;
        const itemTotal = unified
            ? splitCaptureText(inputText, captureSettings.oneItemPerLine).length
            : 0;
        const touch = isTouchDevice();
        const enterHint = touch
            ? enterSaves
                ? t('capture.hintTouchSave', 'Return saves.')
                : t('capture.hintTouchNewline', 'Return starts a new line.')
            : enterSaves
              ? t(
                    'capture.hintSave',
                    'Enter saves. Shift+Enter starts a new line.'
                )
              : t(
                    'capture.hintNewline',
                    'Enter starts a new line. Ctrl+Enter saves.'
                );

        // What this text will become, in words, for text with several lines
        const multilineNotice = (() => {
            if (lineTotal < 2) return null;
            const words = {
                inbox: {
                    one: t('capture.nounInbox', 'Inbox item'),
                    many: t('capture.nounInboxMany', 'Inbox items'),
                    first: '',
                    rest: '',
                },
                task: {
                    one: t('capture.nounTask', 'task'),
                    many: t('capture.nounTaskMany', 'tasks'),
                    first: t('capture.wordTitle', 'title'),
                    rest: t('capture.wordNotes', 'notes'),
                },
                note: {
                    one: t('capture.nounNote', 'note'),
                    many: t('capture.nounNoteMany', 'notes'),
                    first: t('capture.wordTitle', 'title'),
                    rest: t('capture.wordBody', 'body'),
                },
                project: {
                    one: t('capture.nounProject', 'project'),
                    many: t('capture.nounProjectMany', 'projects'),
                    first: t('capture.wordName', 'name'),
                    rest: t('capture.wordDescription', 'description'),
                },
            }[target];
            if (captureSettings.oneItemPerLine) {
                return {
                    text: t(
                        'capture.multiPerLine',
                        'This will be {{total}} {{name}}, one per line.',
                        { total: itemTotal, name: words.many }
                    ),
                    link: t('capture.makeOne', 'Make 1 {{name}} instead', {
                        name: words.one,
                    }),
                };
            }
            return {
                text:
                    target === 'inbox'
                        ? t(
                              'capture.multiInbox',
                              'This will be 1 Inbox item. All {{lines}} lines are kept as typed.',
                              { lines: lineTotal }
                          )
                        : t(
                              'capture.multiOne',
                              'This will be 1 {{name}}. The first line is the {{first}} and the other {{others}} lines are its {{rest}}.',
                              {
                                  name: words.one,
                                  first: words.first,
                                  others: lineTotal - 1,
                                  rest: words.rest,
                              }
                          ),
                link: t('capture.makeMany', 'Make {{lines}} {{name}} instead', {
                    lines: lineTotal,
                    name: words.many,
                }),
            };
        })();

        const linkButtonClass =
            'underline underline-offset-2 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm';

        const unifiedFooter = unified ? (
            <div className="mt-3 flex flex-col gap-2">
                {multilineNotice && (
                    <div
                        data-testid="capture-multiline"
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-gray-800 dark:text-gray-200"
                    >
                        <span>{multilineNotice.text}</span>
                        <button
                            type="button"
                            data-testid="capture-multiline-toggle"
                            onClick={() =>
                                updateCaptureSettings({
                                    oneItemPerLine:
                                        !captureSettings.oneItemPerLine,
                                })
                            }
                            className={`font-semibold text-blue-600 dark:text-blue-400 ${linkButtonClass}`}
                        >
                            {multilineNotice.link}
                        </button>
                    </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CaptureDestinations value={target} onChange={setTarget} />
                    <button
                        type="button"
                        data-testid="capture-add"
                        onClick={() => void handleUnifiedSubmit()}
                        disabled={!inputText.trim() || isSaving}
                        className="ml-auto rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 dark:disabled:bg-black/30 disabled:text-gray-400 dark:disabled:text-gray-500 text-white text-sm font-semibold px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                        {itemTotal > 1
                            ? t('capture.addN', 'Add {{total}}', {
                                  total: itemTotal,
                              })
                            : t('capture.add', 'Add')}
                    </button>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 min-h-[20px] text-xs text-gray-500 dark:text-gray-400">
                    <span
                        role="status"
                        aria-live="polite"
                        data-testid="capture-status"
                    >
                        {status ? status.text : enterHint}
                        {status?.items && (
                            <button
                                type="button"
                                data-testid="capture-undo"
                                onClick={() =>
                                    void undoCaptured(status.items ?? [])
                                }
                                className={`ml-2 ${linkButtonClass}`}
                            >
                                {t('capture.undo', 'Undo')}
                            </button>
                        )}
                    </span>
                    <span className="flex gap-3">
                        {touch && enterSaves && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={insertLineBreak}
                                className={linkButtonClass}
                            >
                                {t('capture.lineBreak', 'Line break')}
                            </button>
                        )}
                    </span>
                </div>
            </div>
        ) : null;

        const footerActions = unified
            ? unifiedFooter
            : renderFooterActions?.(composerFooterContext) ||
              defaultFooterActions;

        const shouldShowPrimaryButton =
            !hidePrimaryButton && !isEditMode && !unified;

        const selectedMetadata = (variant: 'chips' | 'line') => (
            <InboxSelectedChips
                variant={variant}
                selectedTags={getAllTags(inputText)}
                selectedProjects={getAllProjects(inputText)}
                tags={tags}
                projects={projects}
                onRemoveTag={removeTagFromText}
                onRemoveProject={removeProjectFromText}
                dueDate={dateChip}
                assignee={assigneeChip}
                onDismissDate={() =>
                    setDismissedDateText(
                        currentAnalysis?.parsed_date_text ?? null
                    )
                }
                onRemovePerson={() => {
                    if (currentAnalysis?.parsed_person) {
                        removePersonFromText(currentAnalysis.parsed_person);
                    }
                }}
            />
        );

        const cardClasses = cardClassName ?? 'mb-6';

        return (
            <div
                className={`relative w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden ${cardClasses}`}
            >
                {!isEditMode && !compact && (
                    <svg
                        width="110"
                        height="110"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="absolute right-6 top-5 pointer-events-none opacity-[0.09] dark:opacity-[0.08] text-gray-400 dark:text-[oklch(55%_0.006_95)]"
                        aria-hidden="true"
                    >
                        <path d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M2.25 13.5V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.5M2.25 13.5V9.75A2.25 2.25 0 014.5 7.5h15a2.25 2.25 0 012.25 2.25v3.75" />
                    </svg>
                )}
                <div className={compact ? 'p-5' : 'p-[30px]'}>
                    <div className="flex flex-row gap-3 items-start">
                        <div className="relative flex-1">
                            <div
                                ref={fieldRef}
                                className={`relative ${compact ? 'rounded-xl bg-gray-100 dark:bg-black/30 px-3.5 py-1 focus-within:ring-2 focus-within:ring-blue-500' : ''}`}
                            >
                                {!inputText && !isEditMode && (
                                    <div
                                        className={`absolute z-0 pointer-events-none select-none ${compact ? 'left-3.5 top-2.5 text-[17px]' : 'left-0 top-[5px] text-[18px]'} leading-relaxed font-normal text-gray-400 dark:text-gray-500 transition-opacity duration-300 ${
                                            placeholderFading
                                                ? 'opacity-0'
                                                : 'opacity-100'
                                        }`}
                                        aria-hidden="true"
                                    >
                                        {unified
                                            ? t(
                                                  'capture.placeholder',
                                                  'Type the title'
                                              )
                                            : t(
                                                  placeholderData[
                                                      placeholderIdx
                                                  ].key,
                                                  placeholderData[
                                                      placeholderIdx
                                                  ].fallback
                                              )}
                                    </div>
                                )}
                                <div className="relative z-10 flex items-start">
                                    {multiline ? (
                                        <textarea
                                            ref={(el) => {
                                                inputRef.current = el;
                                            }}
                                            data-testid="quick-capture-input"
                                            value={inputText}
                                            rows={3}
                                            onChange={handleChange}
                                            onSelect={handleCaretEvent}
                                            onKeyUp={handleCaretEvent}
                                            onClick={handleCaretEvent}
                                            className={`w-full ${compact ? 'text-[17px]' : 'text-[18px]'} leading-relaxed font-normal bg-transparent text-gray-900 dark:text-gray-100 border-0 focus:outline-none focus:ring-0 px-0 py-1.5 resize-none overflow-hidden`}
                                            placeholder=""
                                            onKeyDown={handleKeyDown}
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
                                            onSelect={handleCaretEvent}
                                            onKeyUp={handleCaretEvent}
                                            onClick={handleCaretEvent}
                                            className="w-full text-[18px] leading-relaxed font-normal bg-transparent text-gray-900 dark:text-gray-100 border-0 focus:outline-none focus:ring-0 px-0 py-1.5"
                                            placeholder=""
                                            onKeyDown={handleKeyDown}
                                        />
                                    )}
                                </div>
                                {compact && selectedMetadata('line')}
                            </div>

                            {!compact && selectedMetadata('chips')}

                            <SuggestionsDropdown
                                isVisible={
                                    showPersonSuggestions &&
                                    filteredPeople.length > 0
                                }
                                items={filteredPeople}
                                position={dropdownPosition}
                                selectedIndex={selectedSuggestionIndex}
                                onSelect={(person) =>
                                    handlePersonSelect(person.name)
                                }
                                renderLabel={(person) => <>@{person.name}</>}
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

                            {!unified &&
                                (() => {
                                    const suggestion = getSuggestion();
                                    return suggestion.type &&
                                        suggestion.message ? (
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
                                                                save as inbox
                                                                item
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
                                disabled={isSaving}
                                title={t('inbox.addToInbox')}
                                className={`flex-shrink-0 self-start mt-3 text-[13px] font-medium px-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-opacity ${
                                    inputText.trim() && !isSaving
                                        ? 'opacity-100'
                                        : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                ↵
                            </button>
                        )}
                    </div>
                    {footerActions}
                </div>
            </div>
        );
    }
);

QuickCaptureInput.displayName = 'QuickCaptureInput';

export default QuickCaptureInput;
