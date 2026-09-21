import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import {
    RectangleStackIcon,
    UsersIcon,
    CreditCardIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';
import { getFeatureFlags } from '../../utils/featureFlags';

interface SidebarAdminProps {
    handleNavClick: (path: string, title: string) => void;
    location: Location;
    currentUser: { is_admin?: boolean };
}

const SidebarAdmin: React.FC<SidebarAdminProps> = ({
    handleNavClick,
    location,
    currentUser,
}) => {
    const { t } = useTranslation();
    const templatesFeatureEnabled = useStore(
        (state) => state.userSettingsStore.templatesEnabled
    );
    const visibleSections = useStore(
        (state) => state.userSettingsStore.sidebarVisibleSections
    );
    const templatesEnabled =
        templatesFeatureEnabled && visibleSections.templates !== false;
    const accessVisible =
        currentUser?.is_admin === true && visibleSections.access !== false;
    const [hosted, setHosted] = useState(false);

    useEffect(() => {
        if (!currentUser?.is_admin) return;
        getFeatureFlags()
            .then((flags) => setHosted(!!flags.hosted))
            .catch(() => setHosted(false));
    }, [currentUser?.is_admin]);

    if (
        !templatesEnabled &&
        !accessVisible &&
        !(currentUser?.is_admin === true && hosted)
    ) {
        return null;
    }

    const linkClass = (path: string) => {
        const isActive = location.pathname.startsWith(path);
        return `flex items-center rounded-[8px] px-[10px] py-[4px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] hover:text-gray-900 dark:hover:text-white ${
            isActive
                ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)] text-gray-900 dark:text-white'
                : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
        }`;
    };

    return (
        <ul className="flex flex-col gap-1">
            {templatesEnabled && (
                <li
                    className={linkClass('/templates')}
                    onClick={() =>
                        handleNavClick(
                            '/templates',
                            t('navigation.templates', 'Templates')
                        )
                    }
                >
                    <RectangleStackIcon className="h-[14px] w-[14px] mr-[6px] shrink-0" />
                    {t('navigation.templates', 'Templates')}
                </li>
            )}
            {accessVisible && (
                <li
                    className={linkClass('/admin/users')}
                    onClick={() =>
                        handleNavClick(
                            '/admin/users',
                            t('admin.access.title', 'Access')
                        )
                    }
                >
                    <UsersIcon className="h-[14px] w-[14px] mr-[6px] shrink-0" />
                    {t('admin.access.title', 'Access')}
                </li>
            )}
            {currentUser?.is_admin === true && hosted && (
                <li
                    className={linkClass('/admin/billing')}
                    onClick={() =>
                        handleNavClick(
                            '/admin/billing',
                            t('admin.billing.title', 'Billing')
                        )
                    }
                >
                    <CreditCardIcon className="h-[14px] w-[14px] mr-[6px] shrink-0" />
                    {t('admin.billing.title', 'Billing')}
                </li>
            )}
            {currentUser?.is_admin === true && hosted && (
                <li
                    className={linkClass('/admin/ai-usage')}
                    onClick={() =>
                        handleNavClick(
                            '/admin/ai-usage',
                            t('admin.aiUsage.title', 'AI Usage')
                        )
                    }
                >
                    <SparklesIcon className="h-[14px] w-[14px] mr-[6px] shrink-0" />
                    {t('admin.aiUsage.title', 'AI Usage')}
                </li>
            )}
        </ul>
    );
};

export default SidebarAdmin;
