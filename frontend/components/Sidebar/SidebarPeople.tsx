import React from 'react';
import { Location } from 'react-router-dom';
import { UserGroupIcon } from '@heroicons/react/24/outline';

interface SidebarPeopleProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const SidebarPeople: React.FC<SidebarPeopleProps> = ({ handleNavClick, location }) => {
    const isActive = () =>
        location.pathname.startsWith('/people') || location.pathname.startsWith('/person/')
            ? 'bg-blue-50 dark:bg-[oklch(27%_0.08_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
            : 'text-gray-500 dark:text-[oklch(52%_0.006_95)]';

    return (
        <ul className="flex flex-col">
            <li
                className={`flex items-center rounded-[8px] px-[10px] py-[5px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] hover:text-gray-900 dark:hover:text-white ${isActive()}`}
                onClick={() =>
                    handleNavClick(
                        '/people',
                        'People',
                        <UserGroupIcon className="h-5 w-5 mr-2" />
                    )
                }
            >
                People
            </li>
        </ul>
    );
};

export default SidebarPeople;
