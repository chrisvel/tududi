import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RecurrenceType } from '../../entities/Task';
import { getFirstDayOfWeek } from '../../utils/profileService';
import { ArrowPathIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface RecurrenceDisplayProps {
    recurrenceType: RecurrenceType;
    recurrenceInterval?: number;
    recurrenceWeekdays?: number[];
    recurrenceEndDate?: string;
    recurrenceMonthDay?: number;
    recurrenceWeekOfMonth?: number;
    recurrenceWeekday?: number;
    completionBased?: boolean;
    compact?: boolean;
}

const RecurrenceDisplay: React.FC<RecurrenceDisplayProps> = ({
    recurrenceType,
    recurrenceInterval = 1,
    recurrenceWeekdays,
    recurrenceEndDate,
    recurrenceMonthDay,
    // recurrenceWeekOfMonth and recurrenceWeekday kept for future use
    completionBased = false,
    compact = false,
}) => {
    const { t } = useTranslation();
    const [firstDayOfWeek, setFirstDayOfWeek] = useState<number | null>(null);

    useEffect(() => {
        const loadFirstDayOfWeek = async () => {
            try {
                const day = await getFirstDayOfWeek();
                setFirstDayOfWeek(day);
            } catch (error) {
                console.error('Error loading first day of week:', error);
                setFirstDayOfWeek(1); // Default to Monday on error
            }
        };
        loadFirstDayOfWeek();
    }, []);

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

    const orderedWeekdays = useMemo(() => {
        if (firstDayOfWeek === null) return allWeekdays;
        return [
            ...allWeekdays.slice(firstDayOfWeek),
            ...allWeekdays.slice(0, firstDayOfWeek),
        ];
    }, [allWeekdays, firstDayOfWeek]);

    const formatRecurrenceText = () => {
        switch (recurrenceType) {
            case 'daily':
                return recurrenceInterval > 1
                    ? t(
                          'recurrence.everyNDays',
                          `Every ${recurrenceInterval} days`,
                          { count: recurrenceInterval }
                      )
                    : t('recurrence.daily', 'Daily');
            case 'weekly':
                return recurrenceInterval > 1
                    ? t(
                          'recurrence.everyNWeeks',
                          `Every ${recurrenceInterval} weeks`,
                          { count: recurrenceInterval }
                      )
                    : t('recurrence.weekly', 'Weekly');
            case 'monthly':
                return recurrenceInterval > 1
                    ? t(
                          'recurrence.everyNMonths',
                          `Every ${recurrenceInterval} months`,
                          { count: recurrenceInterval }
                      )
                    : t('recurrence.monthly', 'Monthly');
            case 'monthly_weekday':
                return t('recurrence.monthlyWeekday', 'Monthly on weekday');
            case 'monthly_last_day':
                return t('recurrence.monthlyLastDay', 'Monthly on last day');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    const formatEndDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch {
            return dateString;
        }
    };

    if (recurrenceType === 'none' || !recurrenceType) {
        return null;
    }

    console.log('RecurrenceDisplay rendering:', {
        recurrenceType,
        recurrenceWeekdays,
        recurrenceInterval,
    });

    return (
        <div className={`${compact ? 'space-y-2' : 'space-y-3'}`}>
            {/* Main recurrence info */}
            <div className="flex items-center">
                <ArrowPathIcon className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                <span
                    className={`${compact ? 'text-sm' : 'text-base'} font-medium text-gray-900 dark:text-gray-100`}
                >
                    {formatRecurrenceText()}
                </span>
                {completionBased && (
                    <span className="ml-2 text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                        {t('recurrence.completionBased', 'After completion')}
                    </span>
                )}
            </div>

            {/* Weekday display for weekly recurrence */}
            {recurrenceType === 'weekly' &&
                recurrenceWeekdays &&
                recurrenceWeekdays.length > 0 && (
                    <div className="ml-7">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {t('forms.task.labels.repeatOn', 'Repeat on')}:
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {orderedWeekdays.map((weekday) => {
                                const isSelected = recurrenceWeekdays.includes(
                                    weekday.value
                                );
                                return (
                                    <div
                                        key={weekday.value}
                                        className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                                        ${
                                            isSelected
                                                ? 'bg-blue-600 text-white dark:bg-blue-500'
                                                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                                        }
                                    `}
                                        title={weekday.full}
                                    >
                                        {weekday.short}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

            {/* Month day display for monthly recurrence */}
            {recurrenceType === 'monthly' && recurrenceMonthDay && (
                <div className="ml-7 text-sm text-gray-600 dark:text-gray-400">
                    {t('recurrence.onDay', 'On day')} {recurrenceMonthDay}
                </div>
            )}

            {/* End date display */}
            {recurrenceEndDate && (
                <div className="ml-7 flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    <span>
                        {t('recurrence.until', 'Until')}{' '}
                        {formatEndDate(recurrenceEndDate)}
                    </span>
                </div>
            )}
        </div>
    );
};

export default RecurrenceDisplay;
