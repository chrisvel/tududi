import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type ClarifyStep =
    | 'actionable'
    | 'notActionable'
    | 'steps'
    | 'twomin'
    | 'deferDelegate';

export type ClarifyOutcome =
    | 'trash'
    | 'someday'
    | 'note'
    | 'project'
    | 'done'
    | 'task'
    | 'waiting';

interface ClarifyOverlayProps {
    itemText: string;
    step: ClarifyStep;
    progress: string;
    canGoBack: boolean;
    isDone: boolean;
    onStepTo: (step: ClarifyStep) => void;
    onFile: (outcome: ClarifyOutcome) => void;
    onBack: () => void;
    onExit: () => void;
}

type Choice =
    | { label: string; labelKey: string; action: 'step'; target: ClarifyStep }
    | { label: string; labelKey: string; action: 'file'; target: ClarifyOutcome };

const STEPS: Record<ClarifyStep, { question: string; questionKey: string; choices: Choice[] }> = {
    actionable: {
        question: 'Is this actionable?',
        questionKey: 'inbox.clarifyQ.actionable',
        choices: [
            { label: 'Yes, actionable', labelKey: 'inbox.clarifyChoice.yesActionable', action: 'step', target: 'steps' },
            { label: 'Not actionable', labelKey: 'inbox.clarifyChoice.notActionable', action: 'step', target: 'notActionable' },
        ],
    },
    notActionable: {
        question: 'What kind of thing is it?',
        questionKey: 'inbox.clarifyQ.notActionable',
        choices: [
            { label: 'Trash', labelKey: 'inbox.clarifyChoice.trash', action: 'file', target: 'trash' },
            { label: 'Someday / Maybe', labelKey: 'inbox.clarifyChoice.someday', action: 'file', target: 'someday' },
            { label: 'Reference note', labelKey: 'inbox.clarifyChoice.referenceNote', action: 'file', target: 'note' },
        ],
    },
    steps: {
        question: 'One step, or several?',
        questionKey: 'inbox.clarifyQ.steps',
        choices: [
            { label: 'One step', labelKey: 'inbox.clarifyChoice.oneStep', action: 'step', target: 'twomin' },
            { label: 'Several steps (project)', labelKey: 'inbox.clarifyChoice.severalSteps', action: 'file', target: 'project' },
        ],
    },
    twomin: {
        question: 'Can you do it in under 2 minutes?',
        questionKey: 'inbox.clarifyQ.twomin',
        choices: [
            { label: 'Yes — do it now', labelKey: 'inbox.clarifyChoice.doItNow', action: 'file', target: 'done' },
            { label: 'No', labelKey: 'inbox.clarifyChoice.no', action: 'step', target: 'deferDelegate' },
        ],
    },
    deferDelegate: {
        question: 'Later yourself, or hand it off?',
        questionKey: 'inbox.clarifyQ.deferDelegate',
        choices: [
            { label: 'Schedule it', labelKey: 'inbox.clarifyChoice.scheduleIt', action: 'file', target: 'task' },
            { label: 'Delegate', labelKey: 'inbox.clarifyChoice.delegate', action: 'file', target: 'waiting' },
        ],
    },
};

const ClarifyOverlay: React.FC<ClarifyOverlayProps> = ({
    itemText,
    step,
    progress,
    canGoBack,
    isDone,
    onStepTo,
    onFile,
    onBack,
    onExit,
}) => {
    const { t } = useTranslation();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onExit();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onExit]);

    if (isDone) {
        return (
            <div className="flex flex-col items-center gap-3 px-6 py-10 mt-2 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('inbox.clarifyDone', 'All clarified. Inbox is calm.')}
                </p>
                <button
                    type="button"
                    onClick={onExit}
                    className="text-[12.5px] text-blue-600 dark:text-blue-400 hover:opacity-75 transition-opacity"
                >
                    {t('inbox.clarifyBackToList', 'Back to list')}
                </button>
            </div>
        );
    }

    const current = STEPS[step];

    return (
        <div className="flex flex-col items-center gap-5 px-6 py-9 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {t('inbox.clarifyProgress', 'Clarify · {{progress}}', { progress })}
            </p>

            <p className="max-w-md text-center text-[18px] font-normal text-gray-800 dark:text-gray-100 leading-relaxed">
                {itemText}
            </p>

            <p className="text-[13.5px] text-gray-500 dark:text-gray-400">
                {t(current.questionKey, current.question)}
            </p>

            <div className="flex flex-wrap gap-2.5 justify-center">
                {current.choices.map((choice) => (
                    <button
                        key={choice.target}
                        type="button"
                        onClick={() => {
                            if (choice.action === 'step') {
                                onStepTo(choice.target as ClarifyStep);
                            } else {
                                onFile(choice.target as ClarifyOutcome);
                            }
                        }}
                        className="px-5 py-2 rounded-full bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-[13.5px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.1] transition-colors"
                    >
                        {t(choice.labelKey, choice.label)}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-4 mt-1">
                {canGoBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        {t('inbox.clarifyBack', '← Back')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onExit}
                    className="text-[12px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    {t('inbox.clarifyExit', 'Exit clarify')}
                </button>
            </div>
        </div>
    );
};

export default ClarifyOverlay;
