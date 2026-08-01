import React from 'react';
import { Location } from 'react-router-dom';
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
        return `flex items-center rounded-[8px] px-[10px] py-[5px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] hover:text-gray-900 dark:hover:text-white ${
            isActive
                ? 'text-gray-900 dark:text-[oklch(88%_0.004_95)]'
                : 'text-gray-500 dark:text-[oklch(52%_0.006_95)]'
        }`;
    };

    return (
        <ul className="flex flex-col">
            {templatesEnabled && (
                <li
                    className={linkClass('/templates')}
                    onClick={() => handleNavClick('/templates', t('navigation.templates', 'Templates'))}
                >
                    {t('navigation.templates', 'Templates')}
                </li>
            )}
            {currentUser?.is_admin === true && (
                <li
                    className={linkClass('/admin')}
                    onClick={() => handleNavClick('/admin/users', t('admin.userManagement', 'User Management'))}
                >
                    {t('admin.userManagement', 'User Management')}
                </li>
            )}
        </ul>
    );
};

export default SidebarAdmin;
