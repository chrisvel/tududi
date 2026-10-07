import React from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useRotatingMessage } from '../../hooks/useRotatingMessage';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface InboxAiProgressProps {
    // The whole list or a single item; the first message differs.
    scope: 'all' | 'item';
}

// Shown while AI assist works. Reasoning models take a while (a minute or
// more for a full inbox), so the line keeps moving to show it is alive.
const InboxAiProgress: React.FC<InboxAiProgressProps> = ({ scope }) => {
    const { t } = useTranslation();
    const reducedMotion = useReducedMotion();

    const messages = [
        scope === 'all'
            ? t('inbox.ai.progress.readAll', 'Reading your inbox…')
            : t('inbox.ai.progress.readItem', 'Reading this item…'),
        t('inbox.ai.progress.actions', 'Spotting actions and deadlines…'),
        t('inbox.ai.progress.projects', 'Checking your projects for a match…'),
        t('inbox.ai.progress.tags', 'Picking tags you already use…'),
        t('inbox.ai.progress.kinds', 'Telling tasks from notes…'),
        t('inbox.ai.progress.files', 'Looking at attached files…'),
        t('inbox.ai.progress.names', 'Thinking up clear names…'),
        t('inbox.ai.progress.options', 'Weighing a few options…'),
        t('inbox.ai.progress.why', 'Writing down why…'),
        t('inbox.ai.progress.almost', 'Almost there, tidying up…'),
    ];
    const { index, seconds } = useRotatingMessage(true, messages.length);

    return (
        <div
            className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-[12.5px] text-violet-800 dark:bg-violet-500/10 dark:text-violet-200"
            role="status"
            aria-live="polite"
            data-testid="inbox-ai-progress"
        >
            <SparklesIcon
                className={`h-4 w-4 shrink-0 ${reducedMotion ? '' : 'animate-pulse'}`}
            />
            <span
                key={index}
                className={`min-w-0 flex-1 truncate ${reducedMotion ? '' : 'animate-fade-in'}`}
            >
                {messages[index]}
            </span>
            {seconds > 0 && (
                <span className="shrink-0 tabular-nums text-[11px] text-violet-500 dark:text-violet-300/80">
                    {seconds}s
                </span>
            )}
        </div>
    );
};

export default InboxAiProgress;
