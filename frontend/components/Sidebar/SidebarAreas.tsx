import React from 'react';
import { Squares2X2Icon, PlusCircleIcon } from '@heroicons/react/24/outline';
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

const SidebarAreas: React.FC<SidebarAreasProps> = ({
    handleNavClick,
    location,
    openAreaModal,
}) => {
    const { t } = useTranslation();
    const isActiveArea = (path: string) => {
        return location.pathname === path
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <>
            <ul className="flex flex-col space-y-1">
                {/* "AREAS" Title with Add Button */}
                <li
                    className={`flex justify-between items-center px-4 py-2 rounded-md uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveArea(
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
                    <span className="flex items-center">
                        <Squares2X2Icon className="h-5 w-5 mr-2" />
                        {t('sidebar.areas')}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openAreaModal(null);
                        }}
                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('sidebar.addAreaAriaLabel')}
                        title={t('sidebar.addAreaTitle')}
                        data-testid="add-area-button"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </li>
            </ul>
        </>
    );
};

export default SidebarAreas;
