import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { Area } from '../../entities/Area';
import { useTranslation } from 'react-i18next';

interface AreaDropdownProps {
    value: number | null;
    onChange: (value: number | null) => void;
    areas: Area[];
}

const AreaDropdown: React.FC<AreaDropdownProps> = ({
    value,
    onChange,
    areas,
}) => {
    const { t } = useTranslation();

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
            const menuHeight = Math.min(areas.length * 40 + 50, 200); // Dynamic height based on areas

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

    const handleSelect = (areaId: number | null) => {
        onChange(areaId);
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

    const selectedArea = areas.find((area) => area.id === value);

    return (
        <div
            ref={dropdownRef}
            className="relative inline-block text-left w-full"
        >
            <button
                type="button"
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-900 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={handleToggle}
            >
                <span className="flex items-center space-x-2">
                    <Squares2X2Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span>
                        {selectedArea
                            ? selectedArea.name
                            : t('common.none', 'No Area')}
                    </span>
                </span>
                <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="fixed z-50 bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto"
                        style={{
                            top: `${position.top}px`,
                            left: `${position.left}px`,
                            width: `${position.width}px`,
                        }}
                    >
                        {/* No Area option */}
                        <button
                            onClick={() => handleSelect(null)}
                            className="flex items-center px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full first:rounded-t-md"
                        >
                            <span className="flex items-center space-x-2">
                                <Squares2X2Icon className="w-4 h-4 text-gray-400" />
                                <span>{t('common.none', 'No Area')}</span>
                            </span>
                        </button>

                        {/* Area options */}
                        {areas.map((area) => (
                            <button
                                key={area.uid}
                                onClick={() => handleSelect(area.id)}
                                className="flex items-center px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 w-full last:rounded-b-md"
                            >
                                <span className="flex items-center space-x-2">
                                    <Squares2X2Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    <span>{area.name}</span>
                                </span>
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </div>
    );
};

export default AreaDropdown;
