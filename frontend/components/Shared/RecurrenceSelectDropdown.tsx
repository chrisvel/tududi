import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface Option {
    value: string | number;
    label: string;
}

interface RecurrenceSelectDropdownProps {
    value: string | number;
    onChange: (value: string | number) => void;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const RecurrenceSelectDropdown: React.FC<RecurrenceSelectDropdownProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select option',
    disabled = false,
    className = '',
}) => {
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
        if (disabled) return;

        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const menuHeight = Math.min(options.length * 40 + 16, 200); // Max height with scroll

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

    const handleSelect = (selectedValue: string | number) => {
        try {
            onChange(selectedValue);
            setIsOpen(false);
        } catch (error) {
            console.error('Error in dropdown selection:', error);
            setIsOpen(false);
        }
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

    const selectedOption = options.find((option) => option.value === value);

    return (
        <div
            ref={dropdownRef}
            className={`relative inline-block text-left w-full ${className}`}
        >
            <button
                type="button"
                className={`inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleToggle();
                }}
                disabled={disabled}
            >
                <span className="truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDownIcon
                    className={`w-5 h-5 text-gray-500 dark:text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto recurrence-dropdown-menu"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelect(option.value);
                                }}
                                className={`flex items-center justify-between px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-gray-600 first:rounded-t-md last:rounded-b-md ${
                                    option.value === value
                                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100'
                                        : 'text-gray-900 dark:text-gray-100'
                                }`}
                            >
                                <span>{option.label}</span>
                                {option.value === value && (
                                    <span className="text-blue-600 dark:text-blue-400">
                                        ✓
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default RecurrenceSelectDropdown;
