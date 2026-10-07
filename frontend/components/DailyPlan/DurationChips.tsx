import React from 'react';
import { useTranslation } from 'react-i18next';
import { DURATION_OPTIONS, formatDuration } from './planUtils';

interface DurationChipsProps {
    value: number | null | undefined;
    onChange: (minutes: number) => void;
    options?: number[];
    size?: 'sm' | 'md';
    // An AI-suggested length, marked with a small dot.
    suggested?: number | null;
}

const DurationChips: React.FC<DurationChipsProps> = ({
    value,
    onChange,
    options = DURATION_OPTIONS,
    size = 'sm',
    suggested = null,
}) => {
    const { t } = useTranslation();
    // A length that is not one of the presets (an estimate of 45m, say)
    // gets its own chip so the current value is always visible.
    const shown =
        value && !options.includes(value)
            ? [...options, value].sort((a, b) => a - b)
            : options;
    const padding = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

    return (
        <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label={t('dailyPlan.duration', 'How long')}
        >
            {shown.map((minutes) => {
                const selected = value === minutes;
                const isSuggestion = suggested === minutes;
                return (
                    <button
                        key={minutes}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        title={
                            isSuggestion
                                ? t('dailyPlan.ai.estimateGuess', 'AI guess')
                                : undefined
                        }
                        onClick={() => onChange(minutes)}
                        className={`relative ${padding} rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            selected
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                    >
                        {formatDuration(minutes)}
                        {isSuggestion && (
                            <span
                                className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-violet-500"
                                aria-hidden="true"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default DurationChips;
