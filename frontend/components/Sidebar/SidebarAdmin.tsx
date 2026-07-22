import React from 'react';
import { Location } from 'react-router-dom';
import { RectangleStackIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';

interface SidebarAdminProps {
    handleNavClick: (path: string, title: string) => void;
    location: Location;
    currentUser: { is_admin?: boolean };
}

const SidebarAdmin: React.FC<SidebarAdminProps> = ({ handleNavClick, location, currentUser }) => {
    const { t } = useTranslation();
    const templatesEnabled = useStore((state) => state.userSettingsStore.templatesEnabled);

    if (!templatesEnabled && !currentUser?.is_admin) return null;

    const linkClass = (path: string) => {
        const isActive = location.pathname.startsWith(path);
        return `flex items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${
            isActive
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300'
        }`;
    };

    return (
        <div>
            <ul className="flex flex-col space-y-1">
                {templatesEnabled && (
                    <li
                        className={linkClass('/templates')}
                        onClick={() => handleNavClick('/templates', t('navigation.templates', 'Templates'))}
                    >
                        <RectangleStackIcon className="h-5 w-5 mr-2 shrink-0" />
                        {t('navigation.templates', 'Templates')}
                    </li>
                )}
                {currentUser?.is_admin === true && (
                    <li
                        className={linkClass('/admin')}
                        onClick={() => handleNavClick('/admin/users', t('admin.userManagement', 'User Management'))}
                    >
                        <UsersIcon className="h-5 w-5 mr-2 shrink-0" />
                        {t('admin.userManagement', 'User Management')}
                    </li>
                )}
            </ul>
        </div>
    );
};

export default SidebarAdmin;
