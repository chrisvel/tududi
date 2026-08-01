import React from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
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
}) => {
    const { t } = useTranslation();
    const isActiveArea = (path: string) => {
        return location.pathname === path
            ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
            : 'text-gray-500 dark:text-[oklch(52%_0.006_95)]';
    };

    return (
        <>
            <ul className="flex flex-col">
                <li
                    className={`group flex items-center px-[10px] py-[5px] rounded-[8px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white ${isActiveArea(
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
                    {t('sidebar.areas')}
                </li>
            </ul>
        </>
    );
};

export default SidebarAreas;
