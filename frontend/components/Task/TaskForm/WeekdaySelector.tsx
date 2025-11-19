import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFirstDayOfWeek } from '../../../utils/profileService';

interface WeekdaySelectorProps {
    selectedDays: number[];
    onChange: (days: number[]) => void;
    disabled?: boolean;
}

const WeekdaySelector: React.FC<WeekdaySelectorProps> = ({
    selectedDays = [],
    onChange,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const [firstDayOfWeek, setFirstDayOfWeek] = useState<number | null>(null);

    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                const day = await getFirstDayOfWeek();
                console.log('Loaded first day of week from profile:', day);
                setFirstDayOfWeek(day);
            } catch (error) {
                console.error('Error loading first day of week:', error);
                setFirstDayOfWeek(1); // Default to Monday on error
            }
        };
        loadFirstDayOfWeek();
    }, []);

    // All weekdays with their short names - use useMemo to recalculate when translations change
    const allWeekdays = useMemo(
        () => [
            {
                value: 0,
                short: t('weekdays.sunday', 'Sun'),
                full: t('weekdaysFull.sunday', 'Sunday'),
            },
            {
                value: 1,
                short: t('weekdays.monday', 'Mon'),
                full: t('weekdaysFull.monday', 'Monday'),
            },
            {
                value: 2,
                short: t('weekdays.tuesday', 'Tue'),
                full: t('weekdaysFull.tuesday', 'Tuesday'),
            },
            {
                value: 3,
                short: t('weekdays.wednesday', 'Wed'),
                full: t('weekdaysFull.wednesday', 'Wednesday'),
            },
            {
                value: 4,
                short: t('weekdays.thursday', 'Thu'),
                full: t('weekdaysFull.thursday', 'Thursday'),
            },
            {
                value: 5,
                short: t('weekdays.friday', 'Fri'),
                full: t('weekdaysFull.friday', 'Friday'),
            },
            {
                value: 6,
                short: t('weekdays.saturday', 'Sat'),
                full: t('weekdaysFull.saturday', 'Saturday'),
            },
        ],
        [t]
    );

    // Reorder weekdays based on first day of week - use useMemo to recalculate when firstDayOfWeek changes
    const orderedWeekdays = useMemo(() => {
        if (firstDayOfWeek === null) return allWeekdays; // Return default order while loading
        console.log('Reordering weekdays with firstDayOfWeek:', firstDayOfWeek);
        const ordered = [
            ...allWeekdays.slice(firstDayOfWeek),
            ...allWeekdays.slice(0, firstDayOfWeek),
        ];
        console.log(
            'Ordered weekdays:',
            ordered.map((w) => w.short).join(', ')
        );
        return ordered;
    }, [allWeekdays, firstDayOfWeek]);

    const toggleDay = (day: number) => {
        if (disabled) return;

        const newSelectedDays = selectedDays.includes(day)
            ? selectedDays.filter((d) => d !== day)
            : [...selectedDays, day].sort((a, b) => a - b);

        onChange(newSelectedDays);
    };

    return (
        <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {t('forms.task.labels.repeatOn', 'Repeat on')}
            </label>
            <div className="flex gap-2 flex-wrap">
                {orderedWeekdays.map((weekday) => {
                    const isSelected = selectedDays.includes(weekday.value);
                    return (
                        <button
                            key={weekday.value}
                            type="button"
                            onClick={() => toggleDay(weekday.value)}
                            disabled={disabled}
                            title={weekday.full}
                            className={`
                                w-10 h-10 rounded-full font-medium text-sm
                                transition-all duration-200
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                ${
                                    isSelected
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }
                                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            {weekday.short}
                        </button>
                    );
                })}
            </div>
            {selectedDays.length === 0 && !disabled && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t(
                        'forms.task.selectAtLeastOneDay',
                        'Please select at least one day'
                    )}
                </p>
            )}
        </div>
    );
};

export default WeekdaySelector;
