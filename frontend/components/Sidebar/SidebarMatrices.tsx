import React from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Squares2X2Icon } from '@heroicons/react/24/solid';

interface SidebarMatricesProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const SidebarMatrices: React.FC<SidebarMatricesProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();

    const isActive =
        location.pathname === '/matrices' ||
        location.pathname.startsWith('/matrices/');

    const title = t('sidebar.matrices', 'Matrices');
    const icon = <Squares2X2Icon className="h-5 w-5" />;

    return (
        <ul className="flex flex-col space-y-1 mt-4">
            <li>
                <button
                    onClick={() => handleNavClick('/matrices', title, icon)}
                    data-testid="sidebar-nav-matrices"
                    className={`w-full text-left px-4 py-1 flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 ${
                        isActive
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300'
                    }`}
                >
                    {icon}
                    <span className="ml-2">{title}</span>
                </button>
            </li>
        </ul>
    );
};

export default SidebarMatrices;
