import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    UserIcon,
    Bars3Icon,
    BoltIcon,
    InboxIcon,
} from '@heroicons/react/24/solid';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import PomodoroTimer from './Shared/PomodoroTimer';

interface NavbarProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    currentUser: {
        email: string;
        avatarUrl?: string;
        is_admin?: boolean;
    };
    setCurrentUser: React.Dispatch<React.SetStateAction<any>>;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    openTaskModal: (type?: 'simplified' | 'full') => void;
}

const Navbar: React.FC<NavbarProps> = ({
    currentUser,
    setCurrentUser,
    isSidebarOpen,
    setIsSidebarOpen,
    openTaskModal,
}) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [pomodoroEnabled, setPomodoroEnabled] = useState(true); // Default to true
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

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

    // Fetch user's pomodoro setting
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/profile', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const profile = await response.json();
                    setPomodoroEnabled(
                        profile.pomodoro_enabled !== undefined
                            ? profile.pomodoro_enabled
                            : true
                    );
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
                // Keep default value (true) if fetch fails
            }
        };

        fetchProfile();

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
        try {
            const response = await fetch('/api/logout', {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                setCurrentUser(null);
                navigate('/login');
            } else {
                console.error('Logout failed:', await response.json());
            }
        } catch (error) {
            console.error('Error during logout:', error);
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-md h-16">
            <div className="h-full flex items-center">
                {/* Sidebar-width area with logo and hamburger */}
                <div
                    className={`${isSidebarOpen ? 'w-full sm:w-72' : 'w-16'} flex items-center ${isSidebarOpen ? 'sm:justify-center' : 'sm:justify-start'} transition-all duration-300 ease-in-out px-4 relative`}
                >
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className={`flex items-center focus:outline-none text-gray-500 dark:text-gray-500 ${isSidebarOpen ? 'sm:absolute sm:left-4' : 'sm:relative'}`}
                        aria-label={
                            isSidebarOpen
                                ? 'Collapse Sidebar'
                                : 'Expand Sidebar'
                        }
                    >
                        <Bars3Icon className="h-6 mt-1 w-6" />
                    </button>

                    <Link
                        to="/"
                        className={`flex items-center no-underline text-gray-900 dark:text-white ml-2 ${isSidebarOpen ? 'sm:ml-0' : 'sm:ml-2'}`}
                    >
                        <span className="text-2xl font-bold">
                            <span className="sm:hidden">t</span>
                            <span className="hidden sm:inline">tududi</span>
                        </span>
                    </Link>
                </div>

                {/* Right section - Actions and user menu */}
                <div className="flex items-center justify-end space-x-4 flex-1 px-4 sm:px-6 lg:px-8">
                    <button
                        onClick={() => openTaskModal('simplified')}
                        className="flex items-center bg-blue-500 hover:bg-blue-600 text-white rounded-full focus:outline-none transition-all duration-200 px-2 py-2 md:px-3 md:py-2"
                        aria-label="Quick Inbox Capture"
                        title="Quick Inbox Capture"
                    >
                        <BoltIcon className="h-4 w-4 text-white" />
                        <InboxIcon className="hidden md:inline-block ml-1.5 h-4 w-4 text-blue-200" />
                    </button>
                    {pomodoroEnabled && <PomodoroTimer />}

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={toggleDropdown}
                            className="flex items-center focus:outline-none"
                            aria-label="User Menu"
                        >
                            {currentUser?.avatarUrl ? (
                                <img
                                    src={currentUser.avatarUrl}
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
                                <Link
                                    to="/profile"
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                >
                                    {t(
                                        'navigation.profileSettings',
                                        'Profile Settings'
                                    )}
                                </Link>
                                {currentUser?.is_admin === true && (
                                    <Link
                                        to="/admin/users"
                                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => setIsDropdownOpen(false)}
                                    >
                                        {t('admin.manageUsers', 'Manage users')}
                                    </Link>
                                )}
                                <Link
                                    to="/about"
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => setIsDropdownOpen(false)}
                                >
                                    {t('navigation.about', 'About')}
                                </Link>
                                <hr className="my-1 border-gray-200 dark:border-gray-600" />
                                <button
                                    onClick={() => {
                                        setIsDropdownOpen(false);
                                        handleLogout();
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {t('navigation.logout', 'Logout')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
