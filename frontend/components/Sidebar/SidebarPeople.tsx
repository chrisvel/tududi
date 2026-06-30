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
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';

    return (
        <ul className="flex flex-col space-y-1">
            <li
                className={`flex items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActive()}`}
                onClick={() =>
                    handleNavClick(
                        '/people',
                        'People',
                        <UserGroupIcon className="h-5 w-5 mr-2" />
                    )
                }
            >
                <UserGroupIcon className="h-5 w-5 mr-2" />
                People
            </li>
        </ul>
    );
};

export default SidebarPeople;
