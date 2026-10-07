import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    CheckCircleIcon,
    CheckIcon,
    DocumentTextIcon,
    FolderIcon,
    InboxIcon,
    PencilIcon,
    QuestionMarkCircleIcon,
    SparklesIcon,
    TagIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    InboxAiOption,
    InboxAiSuggestion as Suggestion,
} from '../../utils/inboxService';

interface InboxAiSuggestionProps {
    suggestion: Suggestion;
    onAccept: (option: InboxAiOption) => void;
    onDismiss: () => void;
}

type IconType = React.ComponentType<{ className?: string }>;

interface Theme {
    pill: string;
    pillIdle: string;
    preview: string;
    button: string;
}

// One color per kind, used for the pill, the preview and the Yes button,
// so the card reads as "this becomes a task" at a glance.
const KIND_THEME: Record<InboxAiOption['kind'], Theme & { icon: IconType }> = {
    task: {
        icon: CheckCircleIcon,
        pill: 'bg-blue-600 text-white dark:bg-blue-500',
        pillIdle:
            'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-200',
        preview: 'bg-blue-50 dark:bg-blue-500/10',
        button: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-400',
    },
    note: {
        icon: DocumentTextIcon,
        pill: 'bg-purple-600 text-white dark:bg-purple-500',
        pillIdle:
            'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-500/20 dark:text-purple-200',
        preview: 'bg-purple-50 dark:bg-purple-500/10',
        button: 'bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-500 dark:hover:bg-purple-400',
    },
    project: {
        icon: FolderIcon,
        pill: 'bg-green-600 text-white dark:bg-green-500',
        pillIdle:
            'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-200',
        preview: 'bg-green-50 dark:bg-green-500/10',
        button: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-400',
    },
    keep: {
        icon: InboxIcon,
        pill: 'bg-gray-700 text-white dark:bg-gray-500',
        pillIdle:
            'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-white/10 dark:text-gray-200',
        preview: 'bg-gray-100 dark:bg-white/5',
        button: 'bg-gray-700 hover:bg-gray-800 text-white dark:bg-gray-600 dark:hover:bg-gray-500',
    },
};

// A best guess for an unclear item (e.g. only a file) is amber whatever its
// kind, so it never looks as certain as a clear suggestion.
const GUESS_THEME: Theme = {
    pill: 'bg-amber-500 text-white dark:bg-amber-500',
    pillIdle:
        'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200',
    preview: 'bg-amber-50 dark:bg-amber-500/10',
    button: 'bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-500 dark:hover:bg-amber-400',
};

const themeOf = (option: InboxAiOption): Theme =>
    option.confidence === 'guess' ? GUESS_THEME : KIND_THEME[option.kind];

// Each field keeps its color and icon from chip to explanation bubble, so
// the user can match "why" to "what".
const FIELD_THEME = {
    title: {
        icon: PencilIcon,
        chip: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200',
        bubble: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200',
    },
    project: {
        icon: FolderIcon,
        chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
        bubble: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100',
    },
    tags: {
        icon: TagIcon,
        chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
        bubble: 'bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-100',
    },
    due_date: {
        icon: CalendarIcon,
        chip: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
        bubble: 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100',
    },
} as const;

type Field = keyof typeof FIELD_THEME;

const chipBase =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium';

const InboxAiSuggestion: React.FC<InboxAiSuggestionProps> = ({
    suggestion,
    onAccept,
    onDismiss,
}) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(0);
    const option = suggestion.options[selected] || suggestion.options[0];
    if (!option) return null;

    const { kind, why } = option;
    const guess = option.confidence === 'guess';
    const theme = themeOf(option);

    const kindLabel = (k: InboxAiOption['kind']) =>
        ({
            task: t('inbox.createTask', 'Task'),
            note: t('inbox.createNote', 'Note'),
            project: t('inbox.createProject', 'Project'),
            keep: t('inbox.ai.keep', 'Keep'),
        })[k];

    const question = {
        task: t('inbox.ai.askTask', 'Create this task?'),
        note: t('inbox.ai.askNote', 'Create this note?'),
        project: t('inbox.ai.askProject', 'Create this project?'),
        keep: t('inbox.ai.askKeep', 'Keep it in the inbox?'),
    }[kind];

    const fieldLabels: Record<Field, string> = {
        title: t('inbox.ai.field.title', 'Name'),
        project: t('inbox.ai.field.project', 'Project'),
        tags: t('inbox.ai.field.tags', 'Tags'),
        due_date: t('inbox.ai.field.dueDate', 'Due'),
    };

    const fieldBubbles = (Object.keys(FIELD_THEME) as Field[]).filter(
        (field) => why[field]
    );

    const chip = (field: Field, label: string, key?: string) => {
        const FieldIcon = FIELD_THEME[field].icon;
        return (
            <span
                key={key}
                className={`${chipBase} ${FIELD_THEME[field].chip}`}
                title={why[field] || fieldLabels[field]}
            >
                <FieldIcon className="h-3 w-3" />
                {label}
            </span>
        );
    };

    return (
        <div
            className="mt-1 rounded-xl bg-violet-50/70 p-3 dark:bg-violet-500/[0.07]"
            data-testid="inbox-ai-suggestion"
            onClick={(e) => e.stopPropagation()}
        >
            {/* The options, best first */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                <SparklesIcon
                    className="h-4 w-4 text-violet-600 dark:text-violet-300"
                    aria-label={t('inbox.ai.suggests', 'AI suggests')}
                />
                {suggestion.options.map((o, index) => {
                    const OptionIcon = KIND_THEME[o.kind].icon;
                    const active = index === selected;
                    const optionTheme = themeOf(o);
                    return (
                        <button
                            key={`${o.kind}-${index}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setSelected(index)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${active ? optionTheme.pill : optionTheme.pillIdle}`}
                            data-testid="inbox-ai-option"
                        >
                            <OptionIcon className="h-3.5 w-3.5" />
                            {kindLabel(o.kind)}
                            {o.confidence === 'guess' && (
                                <QuestionMarkCircleIcon
                                    className="h-3.5 w-3.5"
                                    aria-label={t(
                                        'inbox.ai.guess',
                                        'Best guess'
                                    )}
                                />
                            )}
                        </button>
                    );
                })}
                {guess && (
                    <span className="ml-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        {t('inbox.ai.guessHint', 'Best guess, item is unclear')}
                    </span>
                )}
            </div>

            {/* What it would create */}
            {kind !== 'keep' && (
                <div className={`mt-2 rounded-lg px-3 py-2 ${theme.preview}`}>
                    <p className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-50">
                        {option.title}
                    </p>
                    {(option.project_name ||
                        option.tags.length > 0 ||
                        option.due_date) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {option.project_name &&
                                chip('project', option.project_name)}
                            {option.tags.map((tag) =>
                                chip('tags', `#${tag}`, tag)
                            )}
                            {option.due_date &&
                                chip('due_date', option.due_date)}
                        </div>
                    )}
                </div>
            )}

            {/* Why, as chat bubbles */}
            {(option.reason || option.analysis || fieldBubbles.length > 0) && (
                <div
                    className="mt-2.5 flex flex-col items-start gap-1.5"
                    data-testid="inbox-ai-why"
                >
                    {(option.reason || option.analysis) && (
                        <div className="max-w-full rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[12.5px] leading-relaxed text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100">
                            {option.reason && (
                                <p className="font-semibold">{option.reason}</p>
                            )}
                            {option.analysis && (
                                <p
                                    className={
                                        option.reason
                                            ? 'mt-0.5 text-gray-600 dark:text-gray-300'
                                            : ''
                                    }
                                >
                                    {option.analysis}
                                </p>
                            )}
                        </div>
                    )}
                    {fieldBubbles.map((field) => {
                        const FieldIcon = FIELD_THEME[field].icon;
                        return (
                            <div
                                key={field}
                                className={`flex max-w-full items-start gap-1.5 rounded-2xl rounded-tl-sm px-3 py-1.5 text-[12px] ${FIELD_THEME[field].bubble}`}
                                title={fieldLabels[field]}
                            >
                                <FieldIcon
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                                    aria-label={fieldLabels[field]}
                                />
                                <span>{why[field]}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* The user's decision */}
            <div className="mt-2.5 flex items-center gap-2">
                <span className="mr-auto text-[12.5px] font-medium text-gray-700 dark:text-gray-200">
                    {question}
                </span>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
                    data-testid="inbox-ai-no"
                >
                    <XMarkIcon className="h-4 w-4" />
                    {kind === 'keep'
                        ? t('inbox.ai.ok', 'OK')
                        : t('inbox.ai.no', 'No')}
                </button>
                {kind !== 'keep' && (
                    <button
                        type="button"
                        onClick={() => onAccept(option)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${theme.button}`}
                        title={t(
                            'inbox.ai.reviewHint',
                            'You can review and change everything before it is saved.'
                        )}
                        data-testid="inbox-ai-yes"
                    >
                        <CheckIcon className="h-4 w-4" />
                        {t('inbox.ai.yes', 'Yes')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default InboxAiSuggestion;
