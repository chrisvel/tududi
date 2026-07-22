import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ChartBarIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface SidebarInsightsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const SidebarInsights: React.FC<SidebarInsightsProps> = ({ handleNavClick, location }) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('insightsSidebarCollapsed') === 'true';
    });

    const toggleCollapsed = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('insightsSidebarCollapsed', String(next));
    };

    const isActive = (path: string) =>
        location.pathname === path
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';

    const links = [
        {
            path: '/insights/reports',
            title: t('sidebar.reports', 'Reports'),
            icon: <ChartBarIcon className="h-4 w-4 flex-shrink-0" />,
        },
    ];

    return (
        <ul className={`flex flex-col space-y-1${!isCollapsed && links.length > 0 ? ' pb-3' : ''}`}>
            <li
                className="group flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white text-gray-700 dark:text-gray-300"
                onClick={toggleCollapsed}
            >
                <span className="flex items-center">
                    <ChartBarIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.insights', 'Insights')}
                </span>
                {isCollapsed ? (
                    <ChevronRightIcon className="h-4 w-4" />
                ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                )}
            </li>
            {!isCollapsed &&
                links.map((link) => (
                    <li
                        key={link.path}
                        className={`flex items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${isActive(link.path)}`}
                        onClick={() => handleNavClick(link.path, link.title, link.icon)}
                    >
                        <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                            {link.icon}
                        </span>
                        {link.title}
                    </li>
                ))}
        </ul>
    );
};

export default SidebarInsights;
