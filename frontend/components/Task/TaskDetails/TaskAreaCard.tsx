import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, RectangleStackIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Area } from '../../../entities/Area';
import { Task } from '../../../entities/Task';

interface TaskAreaCardProps {
    task: Task;
    areas: Area[];
    onAreaSelect: (area: Area) => Promise<void>;
    onAreaClear: () => Promise<void>;
    getAreaLink: (area: Area) => string;
}

const TaskAreaCard: React.FC<TaskAreaCardProps> = ({
    task,
    areas,
    onAreaSelect,
    onAreaClear,
    getAreaLink,
}) => {
    const { t } = useTranslation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const effectiveArea = task.Area || (task.Project as any)?.Area || null;
    const isInherited = !task.Area && !!task.Project?.area_id;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setDropdownOpen(false);
                setSearchQuery('');
            }
        };

        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [dropdownOpen]);

    const filteredAreas = areas.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = async (area: Area) => {
        await onAreaSelect(area);
        setDropdownOpen(false);
        setSearchQuery('');
    };

    const handleClear = async () => {
        await onAreaClear();
        setDropdownOpen(false);
        setSearchQuery('');
    };

    if (task.Project) {
        if (!effectiveArea) return null;
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 p-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        {effectiveArea.color && (
                            <span
                                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: effectiveArea.color }}
                            />
                        )}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {effectiveArea.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                            {t('area.viaProject', 'via project')}
                        </span>
                    </div>
                    {effectiveArea.uid && (
                        <Link
                            to={getAreaLink(effectiveArea)}
                            className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0"
                            title={t('area.viewArea', 'Go to area')}
                        >
                            <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} className="space-y-2">
            {dropdownOpen ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800">
                    <div className="p-3">
                        <input
                            type="text"
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('area.searchAreas', 'Search areas…')}
                            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                            {effectiveArea && (
                                <button
                                    onClick={handleClear}
                                    className="w-full text-left text-sm px-3 py-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                    {t('area.clearArea', 'Remove area')}
                                </button>
                            )}
                            {filteredAreas.length === 0 ? (
                                <div className="text-sm text-gray-400 dark:text-gray-500 px-3 py-2">
                                    {t('area.noAreasFound', 'No areas found')}
                                </div>
                            ) : (
                                filteredAreas.map((area) => (
                                    <button
                                        key={area.id}
                                        onClick={() => handleSelect(area)}
                                        className="w-full text-left text-sm px-3 py-1.5 rounded text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                    >
                                        {area.color && (
                                            <span
                                                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: area.color }}
                                            />
                                        )}
                                        {area.name}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : effectiveArea ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div
                            className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                            onClick={() => !isInherited && setDropdownOpen(true)}
                        >
                            {effectiveArea.color && (
                                <span
                                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: effectiveArea.color }}
                                />
                            )}
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {effectiveArea.name}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {effectiveArea.uid && (
                                <Link
                                    to={getAreaLink(effectiveArea)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                    title={t('area.viewArea', 'Go to area')}
                                >
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            )}
                            <button
                                onClick={handleClear}
                                className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title={t('area.clearArea', 'Remove area')}
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => setDropdownOpen(true)}
                    className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                >
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                        <RectangleStackIcon className="h-12 w-12 mb-3 opacity-50" />
                        <span className="text-sm text-center">
                            {t('task.noArea', 'Assign to an area')}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskAreaCard;
