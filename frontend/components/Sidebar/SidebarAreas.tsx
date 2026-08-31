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

    const isAreasPageActive = location.pathname === '/areas';

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-[8px] pl-[30px] pr-[10px] py-[4px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            location.pathname === path
                ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]'
                : ''
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
                className={`group flex justify-between items-center px-[10px] py-[4px] rounded-[8px] cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 ${
                    isAreasPageActive ? 'bg-gray-100 dark:bg-white/5' : ''
                }`}
                onClick={() => {
                    setIsExpanded(true);
                    handleNavClick(
                        '/areas',
                        'Areas',
                        <Squares2X2Icon className="h-5 w-5 mr-2" />
                    );
                }}
            >
                <span
                    className={`flex items-center text-[10.5px] tracking-[0.01em] font-semibold uppercase hover:text-gray-900 dark:hover:text-white ${
                        isAreasPageActive
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                >
                    <Squares2X2Icon className="h-[14px] w-[14px] mr-[6px] shrink-0" />
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
                        <>
                            <span className="text-[10.5px] text-gray-400 dark:text-gray-500 tabular-nums">
                                {areas.length}
                            </span>
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
                        </>
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
                                <span className="truncate min-w-0">
                                    {area.name}
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
