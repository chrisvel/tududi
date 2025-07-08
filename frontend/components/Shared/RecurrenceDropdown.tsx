import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDownIcon,
    ArrowPathIcon,
    CalendarDaysIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import { RecurrenceType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';

interface RecurrenceDropdownProps {
    value: RecurrenceType;
    onChange: (value: RecurrenceType) => void;
}

const RecurrenceDropdown: React.FC<RecurrenceDropdownProps> = ({
    value,
    onChange,
}) => {
    const { t } = useTranslation();

    const recurrenceOptions = [
        {
            value: 'none',
            label: t('recurrence.none', 'No repeat'),
            icon: (
                <ClockIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
        {
            value: 'daily',
            label: t('recurrence.daily', 'Daily'),
            icon: (
                <ArrowPathIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
        {
            value: 'weekly',
            label: t('recurrence.weekly', 'Weekly'),
            icon: (
                <CalendarDaysIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
        {
            value: 'monthly',
            label: t('recurrence.monthly', 'Monthly'),
            icon: (
                <CalendarDaysIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
        {
            value: 'monthly_weekday',
            label: t('recurrence.monthlyWeekday', 'Monthly on weekday'),
            icon: (
                <CalendarDaysIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
        {
            value: 'monthly_last_day',
            label: t('recurrence.monthlyLastDay', 'Monthly on last day'),
            icon: (
                <CalendarDaysIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
    ];

    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0,
        width: 0,
        openUpward: false,
    });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = 240;

            const openUpward =
                spaceAbove > spaceBelow && spaceBelow < menuHeight;

            setPosition({
                top: openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                openUpward,
            });
        }
        setIsOpen(!isOpen);
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target as Node)
        ) {
            setIsOpen(false);
        }
    };

    const handleSelect = (recurrence: RecurrenceType) => {
        onChange(recurrence);
        setIsOpen(false);
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const selectedRecurrence = recurrenceOptions.find((r) => r.value === value);

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left w-full"
        >
            <button
                type="button"
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none"
                onClick={handleToggle}
            >
                <span className="flex items-center space-x-2">
                    {selectedRecurrence ? selectedRecurrence.icon : ''}
                    <span>
                        {selectedRecurrence
                            ? selectedRecurrence.label
                            : t(
                                  'forms.task.labels.recurrenceType',
                                  'Select Recurrence'
                              )}
                    </span>
                </span>
                <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                    >
                        {recurrenceOptions.map((recurrence) => (
                            <button
                                key={recurrence.value}
                                onClick={() =>
                                    handleSelect(
                                        recurrence.value as RecurrenceType
                                    )
                                }
                                className="flex items-center justify-between px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full first:rounded-t-md last:rounded-b-md"
                            >
                                <span className="flex items-center space-x-2">
                                    {recurrence.icon}{' '}
                                    <span>{recurrence.label}</span>
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default RecurrenceDropdown;
