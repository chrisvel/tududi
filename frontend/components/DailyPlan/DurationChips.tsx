import React from 'react';
import { useTranslation } from 'react-i18next';
import { DURATION_OPTIONS, formatDuration } from './planUtils';

interface DurationChipsProps {
    value: number | null | undefined;
    onChange: (minutes: number) => void;
    options?: number[];
    size?: 'sm' | 'md';
}

const DurationChips: React.FC<DurationChipsProps> = ({
    value,
    onChange,
    options = DURATION_OPTIONS,
    size = 'sm',
}) => {
    const { t } = useTranslation();
    const padding = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';

    return (
        <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label={t('dailyPlan.duration', 'How long')}
        >
            {options.map((minutes) => {
                const selected = value === minutes;
                return (
                    <button
                        key={minutes}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(minutes)}
                        className={`${padding} rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            selected
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                    >
                        {formatDuration(minutes)}
                    </button>
                );
            })}
        </div>
    );
};

export default DurationChips;
