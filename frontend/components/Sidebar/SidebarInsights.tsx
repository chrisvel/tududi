import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ChartBarIcon,
    LightBulbIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface SidebarInsightsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const SidebarInsights: React.FC<SidebarInsightsProps> = ({ handleNavClick, location }) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('insightsSidebarCollapsed') !== 'false';
    });

    const toggleCollapsed = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('insightsSidebarCollapsed', String(next));
    };

    const isActive = (path: string) =>
        location.pathname === path
            ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)] text-gray-500 dark:text-[oklch(82%_0.006_95)]'
            : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]';

    const links = [
        {
            path: '/insights/productivity',
            title: t('sidebar.productivityAssistant', 'Productivity Assistant'),
            icon: <LightBulbIcon className="h-4 w-4 flex-shrink-0" />,
        },
        {
            path: '/insights/reports',
            title: t('sidebar.reports', 'Reports'),
            icon: <ChartBarIcon className="h-4 w-4 flex-shrink-0" />,
        },
    ];

    return (
        <ul className="flex flex-col">
            <li className="flex justify-between items-center px-[10px] py-[4px] rounded-md">
                <span className="flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white text-gray-400 dark:text-[oklch(58%_0.006_95)]" onClick={toggleCollapsed}>
                    <ChartBarIcon className="h-[14px] w-[14px]" />
                    {t('sidebar.insights', 'Insights')}
                </span>
                <div className="flex items-center gap-1">
                    <span className="h-3.5 w-3.5" aria-hidden="true" />
                    <button onClick={toggleCollapsed} className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none">
                        <ChevronRightIcon
                            className="h-3 w-3 transition-transform duration-150"
                            style={{ transform: !isCollapsed ? 'rotate(90deg)' : 'none' }}
                        />
                    </button>
                </div>
            </li>
            {!isCollapsed && (
                <li className="p-0 list-none">
                    <div className="flex flex-col gap-0.5 mb-1.5">
                        {links.map((link) => (
                            <div
                                key={link.path}
                                className={`flex items-center gap-[4px] rounded-[8px] px-[10px] py-[4px] text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${isActive(link.path)}`}
                                onClick={() => handleNavClick(link.path, link.title, link.icon)}
                            >
                                {link.icon}
                                {link.title}
                            </div>
                        ))}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default SidebarInsights;
