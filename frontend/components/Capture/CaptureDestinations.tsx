import React from 'react';
import { useTranslation } from 'react-i18next';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { CAPTURE_TARGETS, CaptureTarget } from '../../utils/captureText';

interface CaptureDestinationsProps {
    value: CaptureTarget;
    onChange: (target: CaptureTarget) => void;
    // Shows only the chosen target, plus scopeLabel, with no way to switch
    locked?: boolean;
    scopeLabel?: string;
}

const LABELS: Record<CaptureTarget, { key: string; fallback: string }> = {
    inbox: { key: 'capture.inbox', fallback: 'Inbox' },
    task: { key: 'capture.task', fallback: 'Task' },
    note: { key: 'capture.note', fallback: 'Note' },
    project: { key: 'capture.project', fallback: 'Project' },
};

// "Add to  Inbox | Task | Note | Project": what the text becomes is always
// visible next to the button that saves it.
const CaptureDestinations: React.FC<CaptureDestinationsProps> = ({
    value,
    onChange,
    locked = false,
    scopeLabel,
}) => {
    const { t } = useTranslation();

    if (locked) {
        const chips = [
            t(LABELS[value].key, LABELS[value].fallback),
            ...(scopeLabel ? [scopeLabel] : []),
        ];
        return (
            <div
                className="flex items-center gap-2 min-w-0"
                data-testid="capture-destinations-locked"
            >
                <span className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {t('capture.addTo', 'Add to')}
                </span>
                {chips.map((label) => (
                    <span
                        key={label}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[13px] rounded-md bg-blue-100 dark:bg-blue-900/50 text-gray-900 dark:text-white font-semibold"
                    >
                        {label}
                    </span>
                ))}
                <LockClosedIcon
                    className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500"
                    aria-hidden="true"
                />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {t('capture.addTo', 'Add to')}
            </span>
            <div
                role="radiogroup"
                aria-label={t('capture.addTo', 'Add to')}
                className="inline-flex rounded-lg bg-gray-100 dark:bg-black/30 p-0.5 gap-0.5"
            >
                {CAPTURE_TARGETS.map((target) => {
                    const selected = target === value;
                    return (
                        <button
                            key={target}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            data-testid={`capture-target-${target}`}
                            onClick={() => onChange(target)}
                            className={`px-2 sm:px-2.5 py-1 text-[13px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                selected
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-gray-900 dark:text-white font-semibold'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                        >
                            {t(LABELS[target].key, LABELS[target].fallback)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CaptureDestinations;
