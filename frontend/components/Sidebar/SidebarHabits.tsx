import React from 'react';
import { Location } from 'react-router-dom';
import { FireIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface SidebarHabitsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openNewHabit: () => void;
}

const SidebarHabits: React.FC<SidebarHabitsProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();
    const isActiveHabit = (path: string) => {
        return location.pathname.startsWith(path)
            ? 'bg-blue-50 dark:bg-[oklch(27%_0.08_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
            : 'text-gray-500 dark:text-[oklch(52%_0.006_95)]';
    };

    return (
        <>
            <ul className="flex flex-col">
                <li
                    className={`group flex items-center rounded-[8px] px-[10px] py-[5px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] hover:text-gray-900 dark:hover:text-white ${isActiveHabit(
                        '/habits'
                    )}`}
                    onClick={() =>
                        handleNavClick(
                            '/habits',
                            'Habits',
                            <FireIcon className="h-5 w-5 mr-2" />
                        )
                    }
                >
                    {t('sidebar.habits', 'Habits')}
                </li>
            </ul>
        </>
    );
};

export default SidebarHabits;
