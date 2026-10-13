import React, { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { FORM } from '../../constants/formClasses';

export interface SelectMenuOption {
    value: string;
    label: string;
    hint?: string;
    disabled?: boolean;
}

interface SelectMenuProps {
    id: string;
    value: string;
    options: SelectMenuOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    testId?: string;
}

// A Tailwind replacement for a native <select>: a button that opens a list
// under it. Arrow keys move through the enabled options, Enter picks one and
// Escape closes the list.
const SelectMenu: React.FC<SelectMenuProps> = ({
    id,
    value,
    options,
    onChange,
    placeholder = '',
    testId,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const rootRef = useRef<HTMLDivElement>(null);

    const selected = options.find((o) => o.value === value) || null;

    useEffect(() => {
        if (!isOpen) return;
        const onMouseDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, [isOpen]);

    const open = () => {
        setActiveIndex(options.findIndex((o) => o.value === value));
        setIsOpen(true);
    };

    const pick = (option: SelectMenuOption) => {
        if (option.disabled) return;
        onChange(option.value);
        setIsOpen(false);
    };

    const step = (direction: 1 | -1) => {
        let next = activeIndex;
        for (let i = 0; i < options.length; i++) {
            next = (next + direction + options.length) % options.length;
            if (!options[next].disabled) break;
        }
        setActiveIndex(next);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) open();
            else step(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter' && isOpen) {
            e.preventDefault();
            if (options[activeIndex]) pick(options[activeIndex]);
        }
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                id={id}
                type="button"
                data-testid={testId}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => (isOpen ? setIsOpen(false) : open())}
                onKeyDown={onKeyDown}
                className={`${FORM.input} w-full flex items-center justify-between gap-2 text-left`}
            >
                <span
                    className={`truncate ${selected ? '' : 'text-gray-400 dark:text-gray-500'}`}
                >
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDownIcon
                    className={`w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <ul
                    role="listbox"
                    aria-labelledby={id}
                    className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg bg-white dark:bg-gray-700 shadow-lg py-1"
                >
                    {options.map((option, index) => {
                        const isSelected = option.value === value;
                        return (
                            <li
                                key={option.value}
                                role="option"
                                aria-selected={isSelected}
                                aria-disabled={option.disabled || undefined}
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick(option)}
                                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
                                    option.disabled
                                        ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                        : `cursor-pointer text-gray-900 dark:text-gray-100 ${
                                              index === activeIndex
                                                  ? 'bg-black/[0.05] dark:bg-white/[0.08]'
                                                  : ''
                                          }`
                                }`}
                            >
                                <span className="truncate">
                                    {option.label}
                                    {option.hint && (
                                        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                            {option.hint}
                                        </span>
                                    )}
                                </span>
                                {isSelected && (
                                    <CheckIcon className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default SelectMenu;
