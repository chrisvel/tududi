import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, FlagIcon } from '@heroicons/react/24/outline';
import { Goal } from '../../entities/Goal';

interface GoalDropdownProps {
    goalId: number | null;
    isMaintenance: boolean;
    goals: Goal[];
    onChange: (goalId: number | null, isMaintenance: boolean) => void;
}

const GoalDropdown: React.FC<GoalDropdownProps> = ({
    goalId,
    isMaintenance,
    goals,
    onChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, openUpward: false });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const activeGoals = goals.filter((g) => g.status === 'active');
    const inactiveGoals = goals.filter((g) => g.status !== 'active');

    const selectedGoal = goals.find((g) => g.id === goalId);

    const getLabel = () => {
        if (isMaintenance) return 'Maintenance';
        if (selectedGoal) return selectedGoal.title;
        return 'No goal';
    };

    const handleToggle = () => {
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const totalItems = 2 + activeGoals.length + (inactiveGoals.length > 0 ? inactiveGoals.length + 1 : 0);
            const menuHeight = Math.min(totalItems * 40 + 8, 240);
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const openUpward = spaceAbove > spaceBelow && spaceBelow < menuHeight;
            setPosition({
                top: openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                openUpward,
            });
        }
        setIsOpen((prev) => !prev);
    };

    const handleSelect = (id: number | null, maintenance: boolean) => {
        onChange(id, maintenance);
        setIsOpen(false);
    };

    useEffect(() => {
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
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={dropdownRef} className="relative inline-block text-left w-full">
            <button
                type="button"
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={handleToggle}
            >
                <span className="flex items-center space-x-2">
                    <FlagIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span>{getLabel()}</span>
                </span>
                <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                    >
                        <button
                            onClick={() => handleSelect(null, false)}
                            className="flex items-center px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full first:rounded-t-md"
                        >
                            No goal
                        </button>
                        <button
                            onClick={() => handleSelect(null, true)}
                            className="flex items-center px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full"
                        >
                            Maintenance
                        </button>
                        {activeGoals.map((g) => (
                            <button
                                key={g.id}
                                onClick={() => handleSelect(g.id ?? null, false)}
                                className="flex items-center px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full"
                            >
                                {g.title}
                            </button>
                        ))}
                        {inactiveGoals.length > 0 && (
                            <>
                                <div className="px-4 py-1 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-600 mt-1">
                                    Inactive
                                </div>
                                {inactiveGoals.map((g) => (
                                    <button
                                        key={g.id}
                                        onClick={() => handleSelect(g.id ?? null, false)}
                                        className="flex items-center px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 w-full last:rounded-b-md"
                                    >
                                        {g.title} ({g.status})
                                    </button>
                                ))}
                            </>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default GoalDropdown;
