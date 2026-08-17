import React, { useState, useEffect } from 'react';
import {
    Squares2X2Icon,
    ChevronRightIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import { Location } from 'react-router-dom';
import { Area } from '../../entities/Area';
import { useTranslation } from 'react-i18next';

interface SidebarAreasProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openAreaModal: (area: Area | null) => void;
    areas: Area[];
}

const getAreaPath = (area: Area) => {
    const slug = area.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `/area/${area.uid}-${slug}`;
};

const SidebarAreas: React.FC<SidebarAreasProps> = ({
    handleNavClick,
    location,
    openAreaModal,
    areas,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (areas.some((area) => getAreaPath(area) === location.pathname)) {
            setIsExpanded(true);
        }
    }, [location.pathname, areas.length]);

    const isActiveArea = (path: string) => {
        return location.pathname === path
            ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]';
    };

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-[8px] px-[10px] py-1 text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            location.pathname === path
                ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
                : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]'
        }`;

    const navigate = (area: Area) =>
        handleNavClick(
            getAreaPath(area),
            area.name,
            <Squares2X2Icon className="h-4 w-4 mr-2" />
        );

    return (
        <ul className="flex flex-col">
            <li
                className={`group flex justify-between items-center px-[10px] py-[5px] rounded-[8px] cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 ${isActiveArea(
                    '/areas'
                )}`}
                onClick={() =>
                    handleNavClick(
                        '/areas',
                        'Areas',
                        <Squares2X2Icon className="h-5 w-5 mr-2" />
                    )
                }
            >
                <span className="flex items-center text-[10.5px] tracking-[0.01em] font-semibold uppercase hover:text-gray-900 dark:hover:text-white">
                    <Squares2X2Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    {t('sidebar.areas')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openAreaModal(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('areas.addArea', 'Add Area')}
                        title={t('areas.addArea', 'Add Area')}
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                    {areas.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        >
                            <ChevronRightIcon
                                className="h-3 w-3 transition-transform duration-150"
                                style={{
                                    transform: isExpanded
                                        ? 'rotate(90deg)'
                                        : 'none',
                                }}
                            />
                        </button>
                    )}
                </div>
            </li>

            {isExpanded && (
                <li className="p-0 list-none">
                    <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
                        {areas.map((area) => (
                            <div
                                key={area.uid}
                                className={itemClass(getAreaPath(area))}
                                onClick={() => navigate(area)}
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                        style={{
                                            backgroundColor:
                                                area.color || '#9ca3af',
                                        }}
                                    />
                                    <span className="truncate">
                                        {area.name}
                                    </span>
                                </span>
                            </div>
                        ))}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default SidebarAreas;
