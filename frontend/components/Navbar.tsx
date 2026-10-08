import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserIcon, Bars3Icon, BoltIcon } from '@heroicons/react/24/solid';
import {
    EnvelopeIcon,
    Cog6ToothIcon,
    ShieldCheckIcon,
    CircleStackIcon,
    InformationCircleIcon,
    ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import PomodoroTimer from './Shared/PomodoroTimer';
import UniversalSearch from './UniversalSearch/UniversalSearch';
import NotificationsDropdown from './Notifications/NotificationsDropdown';
import { getApiPath, getAssetPath } from '../config/paths';
import { getFeatureFlags, FeatureFlags } from '../utils/featureFlags';
import PlanBadge from './Billing/PlanBadge';
import { setUserTimezone } from '../utils/dateUtils';
import {
    fetchProfile as fetchProfileFromService,
    invalidateProfileCache,
} from '../utils/profileService';
import { notifySwClearCache } from '../utils/swUtils';
import { detachPushForLogout } from '../utils/pushService';
import { resetSessionState } from '../utils/sessionReset';
import { toggleCapture, useCaptureUi } from '../utils/captureUi';

interface NavbarProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    currentUser: {
        email: string;
        avatar_image?: string;
        is_admin?: boolean;
    };
    setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Navbar: React.FC<NavbarProps> = ({
    currentUser,
    setCurrentUser,
    isSidebarOpen,
    setIsSidebarOpen,
    isDarkMode,
}) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [pomodoroEnabled, setPomodoroEnabled] = useState(true); // Default to true
    const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
        hosted: false,
        billing: false,
    });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { open: captureOpen } = useCaptureUi();
    // Search lives at the top of the sidebar, so a page that asks for it
    // (openUniversalSearch) brings the sidebar back if it was closed.
    useEffect(() => {
        const handleOpenSearch = () => setIsSidebarOpen(true);
        window.addEventListener('openUniversalSearch', handleOpenSearch);
        return () =>
            window.removeEventListener('openUniversalSearch', handleOpenSearch);
    }, [setIsSidebarOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fetch user's pomodoro setting and feature flags
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const profile = await fetchProfileFromService();
                setPomodoroEnabled(
                    profile.features?.pomodoro_enabled !== undefined
                        ? profile.features.pomodoro_enabled
                        : true
                );
                if (profile.timezone) {
                    setUserTimezone(profile.timezone);
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            }
        };

        const fetchFlags = async () => {
            const flags = await getFeatureFlags();
            setFeatureFlags(flags);
        };

        loadProfile();
        fetchFlags();

        // Listen for Pomodoro setting changes from ProfileSettings
        const handlePomodoroSettingChange = (event: CustomEvent) => {
            setPomodoroEnabled(event.detail.enabled);
        };

        window.addEventListener(
            'pomodoroSettingChanged',
            handlePomodoroSettingChange as EventListener
        );

        return () => {
            window.removeEventListener(
                'pomodoroSettingChanged',
                handlePomodoroSettingChange as EventListener
            );
        };
    }, []);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleLogout = async () => {
        invalidateProfileCache();
        await detachPushForLogout();
        try {
            const response = await fetch(getApiPath('logout'), {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                notifySwClearCache();
                resetSessionState();
                setCurrentUser(null);
                navigate('/login');
            } else {
                console.error('Logout failed:', await response.json());
            }
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    const iconButton =
        'flex items-center justify-center h-9 w-9 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

    // The top of the sidebar column: logo and account on the first row,
    // search and capture on the second. The page itself has no top bar.
    return (
        <>
            {!isSidebarOpen && (
                <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="fixed top-3 left-3 z-40 flex items-center justify-center h-10 w-10 rounded-lg bg-white/90 dark:bg-gray-900/90 text-gray-500 dark:text-gray-400 shadow-sm hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Expand Sidebar"
                    data-testid="sidebar-open-button"
                >
                    <Bars3Icon className="h-6 w-6" />
                </button>
            )}
            <div
                className={`fixed top-0 left-0 z-40 h-[6.5rem] ${isSidebarOpen ? 'w-full sm:w-sidebar' : 'w-0'} bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-width duration-300 ease-in-out`}
                style={{ overflow: isSidebarOpen ? 'visible' : 'hidden' }}
                data-testid="sidebar-header"
            >
                <div className="h-14 flex items-center gap-1 px-2.5">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(false)}
                        className={iconButton}
                        aria-label="Collapse Sidebar"
                    >
                        <Bars3Icon className="h-6 w-6" />
                    </button>
                    <Link
                        to="/"
                        className="flex items-center no-underline ml-1 min-w-0"
                    >
                        <img
                            src={getAssetPath(
                                isDarkMode
                                    ? 'wide-logo-light.png'
                                    : 'wide-logo-dark.png'
                            )}
                            alt="tududi"
                            className="h-8 w-auto"
                        />
                    </Link>
                    <div className="ml-auto flex items-center gap-2">
                        <NotificationsDropdown isDarkMode={isDarkMode} />
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={toggleDropdown}
                                className="flex items-center focus:outline-none"
                                aria-label={t('navigation.userMenu')}
                            >
                                {currentUser?.avatar_image ? (
                                    <img
                                        src={getApiPath(
                                            currentUser.avatar_image
                                        )}
                                        alt="User Avatar"
                                        className="h-8 w-8 rounded-full object-cover border-2 border-green-500"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full border-2 border-green-500 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                        <UserIcon className="h-6 w-6 text-gray-500 dark:text-gray-300" />
                                    </div>
                                )}
                            </button>
                            {isDropdownOpen && (
                                <div
                                    ref={dropdownRef}
                                    className="absolute right-0 top-full mt-2 min-w-48 w-max bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 border border-gray-200 dark:border-gray-700"
                                >
                                    {currentUser?.email && (
                                        <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 flex items-center">
                                            <EnvelopeIcon className="h-4 w-4 mr-2" />
                                            {currentUser.email}
                                        </div>
                                    )}
                                    {featureFlags.hosted && <PlanBadge />}
                                    {currentUser?.is_admin && (
                                        <Link
                                            to="/admin"
                                            className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() =>
                                                setIsDropdownOpen(false)
                                            }
                                            data-testid="navbar-admin-link"
                                        >
                                            <span className="flex items-center">
                                                <ShieldCheckIcon className="h-4 w-4 mr-2 shrink-0" />
                                                {t('navigation.admin', 'Admin')}
                                            </span>
                                            <span className="ml-3 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                {featureFlags.hosted
                                                    ? t(
                                                          'admin.roles.names.superadmin',
                                                          'Superadmin'
                                                      )
                                                    : t(
                                                          'navigation.adminBadge',
                                                          'Admin'
                                                      )}
                                            </span>
                                        </Link>
                                    )}
                                    <Link
                                        to="/profile"
                                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setIsDropdownOpen(false)}
                                    >
                                        <Cog6ToothIcon className="h-4 w-4 mr-2 shrink-0" />
                                        {t(
                                            'navigation.profileSettings',
                                            'Profile Settings'
                                        )}
                                    </Link>
                                    <Link
                                        to="/backup"
                                        className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setIsDropdownOpen(false)}
                                    >
                                        <CircleStackIcon className="h-4 w-4 mr-2 shrink-0" />
                                        {t(
                                            'navigation.backupRestore',
                                            'Backup & Restore'
                                        )}
                                    </Link>
                                    {!featureFlags.hosted && (
                                        <Link
                                            to="/about"
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                            onClick={() =>
                                                setIsDropdownOpen(false)
                                            }
                                        >
                                            <InformationCircleIcon className="h-4 w-4 mr-2 shrink-0" />
                                            {t('navigation.about', 'About')}
                                        </Link>
                                    )}
                                    <hr className="my-1 border-gray-200 dark:border-gray-600" />
                                    <button
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            handleLogout();
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        <ArrowRightStartOnRectangleIcon className="h-4 w-4 mr-2 shrink-0" />
                                        {t('navigation.logout', 'Logout')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="h-12 flex items-center gap-2 px-2.5 pb-2">
                    <UniversalSearch />
                    {pomodoroEnabled && <PomodoroTimer />}
                    <button
                        type="button"
                        onClick={() => toggleCapture('inbox')}
                        aria-haspopup="dialog"
                        aria-expanded={captureOpen}
                        data-testid="capture-navbar-button"
                        className="flex items-center justify-center h-9 w-9 flex-shrink-0 bg-blue-500 hover:bg-blue-600 text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 transition-colors duration-200"
                        aria-label={t('navigation.quickInboxCapture')}
                        title={t('navigation.quickInboxCapture')}
                    >
                        <BoltIcon className="h-4 w-4 text-white" />
                    </button>
                </div>
            </div>
        </>
    );
};

export default Navbar;
