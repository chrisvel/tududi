import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDownIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    FireIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { PriorityType } from '../../entities/Task';
import { useTranslation } from 'react-i18next';

interface PriorityDropdownProps {
    value: PriorityType;
    onChange: (value: PriorityType) => void;
}

const PriorityDropdown: React.FC<PriorityDropdownProps> = ({
    value,
    onChange,
}) => {
    const { t } = useTranslation();

    const priorities = [
        {
            value: null,
            label: t('priority.none', 'None'),
            icon: (
                <XMarkIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            ),
        },
        {
            value: 'low',
            label: t('priority.low', 'Low'),
            icon: (
                <ArrowDownIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            ),
        },
        {
            value: 'medium',
            label: t('priority.medium', 'Medium'),
            icon: (
                <ArrowUpIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ),
        },
        {
            value: 'high',
            label: t('priority.high', 'High'),
            icon: (
                <FireIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
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
            const menuHeight = 120;

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
            !dropdownRef.current.contains(event.target as Node) &&
            menuRef.current &&
            !menuRef.current.contains(event.target as Node)
        ) {
            setIsOpen(false);
        }
    };

    const handleSelect = (priority: PriorityType) => {
        onChange(priority);
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

    // Convert numeric priority to string if needed
    // Don't default to any value - allow null/undefined
    const normalizedValue =
        typeof value === 'number'
            ? (['low', 'medium', 'high'][value] as PriorityType)
            : value;

    const selectedPriority = priorities.find(
        (p) => p.value === (normalizedValue || null)
    );

    return (
        <div
            ref={dropdownRef}
            data-testid="priority-dropdown"
            data-state={isOpen ? 'open' : 'closed'}
            className="relative inline-block text-left w-full"
        >
            <button
                type="button"
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none"
                onClick={handleToggle}
            >
                <span className="flex items-center space-x-2">
                    {selectedPriority ? selectedPriority.icon : ''}
                    <span>
                        {selectedPriority
                            ? selectedPriority.label
                            : t('forms.priority', 'Select Priority')}
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
                        {priorities.map((priority) => (
                            <button
                                key={priority.value}
                                onClick={() =>
                                    handleSelect(priority.value as PriorityType)
                                }
                                className="flex items-center justify-between px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full first:rounded-t-md last:rounded-b-md"
                                data-testid={`priority-option-${priority.value || 'none'}`}
                            >
                                <span className="flex items-center space-x-2">
                                    {priority.icon}{' '}
                                    <span>{priority.label}</span>
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default PriorityDropdown;
