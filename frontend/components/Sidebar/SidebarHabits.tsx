import React from 'react';
import { Location } from 'react-router-dom';
import { FireIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
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
    openNewHabit,
}) => {
    const { t } = useTranslation();
    const isActiveHabit = (path: string) => {
        return location.pathname.startsWith(path)
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <>
            <ul className="flex flex-col space-y-1">
                <li
                    className={`flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveHabit(
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
                    <span className="flex items-center">
                        <FireIcon className="h-5 w-5 mr-2" />
                        {t('sidebar.habits', 'HABITS')}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openNewHabit();
                        }}
                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label="Add Habit"
                        title="Add Habit"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </li>
            </ul>
        </>
    );
};

export default SidebarHabits;
