import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Person } from '../../entities/Person';

interface PersonDropdownProps {
    personUid: string | null;
    people: Person[];
    onChange: (personUid: string | null) => void;
    placeholder?: string;
}

const PersonAvatar: React.FC<{ person: Person | null; size?: 'sm' | 'md' }> = ({
    person,
    size = 'sm',
}) => {
    const dim = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    return (
        <span
            className={`inline-block ${dim} rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600`}
            style={
                person?.color
                    ? { backgroundColor: person.color, borderColor: person.color }
                    : {}
            }
        />
    );
};

const PersonDropdown: React.FC<PersonDropdownProps> = ({
    personUid,
    people,
    onChange,
    placeholder = 'Unassigned',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const activePeople = people.filter((p) => !p.archived);
    const selectedPerson = people.find((p) => p.uid === personUid) ?? null;

    const handleToggle = () => {
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const menuHeight = Math.min((activePeople.length + 1) * 40 + 8, 240);
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpward = spaceBelow < menuHeight && rect.top > spaceBelow;
            setPosition({
                top: openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8,
                left: rect.left,
                width: rect.width,
            });
        }
        setIsOpen((prev) => !prev);
    };

    const handleSelect = (uid: string | null) => {
        onChange(uid);
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
                    <PersonAvatar person={selectedPerson} />
                    <span className={selectedPerson ? '' : 'text-gray-400 dark:text-gray-500'}>
                        {selectedPerson ? selectedPerson.name : placeholder}
                    </span>
                </span>
                <div className="flex items-center gap-1">
                    {selectedPerson && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    handleSelect(null);
                                }
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                            aria-label="Clear assignment"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </span>
                    )}
                    <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                </div>
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
                            onClick={() => handleSelect(null)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 w-full first:rounded-t-md"
                        >
                            <span className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600" />
                            {placeholder}
                        </button>
                        {activePeople.map((p) => (
                            <button
                                key={p.uid}
                                onClick={() => handleSelect(p.uid ?? null)}
                                className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 w-full last:rounded-b-md ${
                                    p.uid === personUid
                                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                                        : 'text-gray-900 dark:text-gray-100'
                                }`}
                            >
                                <PersonAvatar person={p} size="md" />
                                <span>{p.name}</span>
                                {p.relationship_type && p.relationship_type !== 'other' && (
                                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                                        {p.relationship_type}
                                    </span>
                                )}
                            </button>
                        ))}
                        {activePeople.length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">
                                No people yet
                            </div>
                        )}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default PersonDropdown;
