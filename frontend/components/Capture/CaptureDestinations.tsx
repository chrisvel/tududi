import React from 'react';
import { useTranslation } from 'react-i18next';
import { CAPTURE_TARGETS, CaptureTarget } from '../../utils/captureText';

interface CaptureDestinationsProps {
    value: CaptureTarget;
    onChange: (target: CaptureTarget) => void;
    // Destinations that cannot take what is in the box right now, with the
    // reason shown on hover.
    disabled?: CaptureTarget[];
    disabledReason?: string;
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
    disabled = [],
    disabledReason,
}) => {
    const { t } = useTranslation();

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
                    const unavailable = disabled.includes(target);
                    return (
                        <button
                            key={target}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            data-testid={`capture-target-${target}`}
                            disabled={unavailable}
                            title={unavailable ? disabledReason : undefined}
                            onClick={() => onChange(target)}
                            className={`px-2 sm:px-2.5 py-1 text-[13px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed ${
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
