import React, { useState, useEffect, useRef } from 'react';
import {
    SunIcon,
    MoonIcon,
    PlusIcon,
    CheckIcon,
    FolderIcon,
    BookOpenIcon,
    Squares2X2Icon,
    TagIcon,
    InboxIcon,
} from '@heroicons/react/24/outline';
import TelegramIcon from '../Icons/TelegramIcon';
import { useTranslation } from 'react-i18next';
import { Note } from '../../entities/Note';
import { Area } from '../../entities/Area';
import { useTelegramStatus } from '../../contexts/TelegramStatusContext';
import { getApiPath } from '../../config/paths';

interface SidebarFooterProps {
    currentUser: { email: string };
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isDropdownOpen: boolean;
    toggleDropdown: () => void;
    openTaskModal: (type?: 'simplified' | 'full') => void;
    openProjectModal: () => void;
    openNoteModal: (note: Note | null) => void;
    openAreaModal: (area: Area | null) => void;
    openTagModal: (tag: any | null) => void;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({
    isDarkMode,
    toggleDarkMode,
    isSidebarOpen,
    openTaskModal,
    openProjectModal,
    openNoteModal,
    openAreaModal,
    openTagModal,
}) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { status: telegramStatus } = useTelegramStatus();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [version, setVersion] = useState<string>('v0.86');

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Fetch version from API
    useEffect(() => {
        fetch(getApiPath('version'))
            .then((response) => response.json())
            .then((data) => {
                if (data.version) {
                    setVersion(data.version);
                }
            })
            .catch((error) => {
                console.error('Error fetching version:', error);
            });
    }, []);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check for Ctrl + Shift key combinations only (not Cmd/Meta key)
            if (event.ctrlKey && event.shiftKey && !event.metaKey) {
                switch (event.key.toLowerCase()) {
                    case 'i':
                        event.preventDefault();
                        handleDropdownSelect('Inbox');
                        break;
                    case 't':
                        event.preventDefault();
                        handleDropdownSelect('Task');
                        break;
                    case 'p':
                        event.preventDefault();
                        handleDropdownSelect('Project');
                        break;
                    case 'n':
                        event.preventDefault();
                        handleDropdownSelect('Note');
                        break;
                    case 'a':
                        event.preventDefault();
                        handleDropdownSelect('Area');
                        break;
                    case 'g':
                        event.preventDefault();
                        handleDropdownSelect('Tag');
                        break;
                    default:
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleDropdownSelect = (type: string) => {
        switch (type) {
            case 'Inbox':
                openTaskModal('simplified');
                break;
            case 'Task':
                openTaskModal('full');
                break;
            case 'Project':
                openProjectModal();
                break;
            case 'Note':
                openNoteModal(null);
                break;
            case 'Area':
                openAreaModal(null);
                break;
            case 'Tag':
                openTagModal(null);
                break;
            default:
                break;
        }
        setIsDropdownOpen(false);
    };

    const dropdownItems = [
        {
            label: 'Inbox',
            translationKey: 'dropdown.inbox',
            icon: <InboxIcon className="h-5 w-5 mr-2" />,
            shortcut: 'Ctrl+Shift+I',
        },
        {
            label: 'Task',
            translationKey: 'dropdown.task',
            icon: <CheckIcon className="h-5 w-5 mr-2" />,
            shortcut: 'Ctrl+Shift+T',
        },
        {
            label: 'Project',
            translationKey: 'dropdown.project',
            icon: <FolderIcon className="h-5 w-5 mr-2" />,
            shortcut: 'Ctrl+Shift+P',
        },
        {
            label: 'Note',
            translationKey: 'dropdown.note',
            icon: <BookOpenIcon className="h-5 w-5 mr-2" />,
            shortcut: 'Ctrl+Shift+N',
        },
        {
            label: 'Area',
            translationKey: 'dropdown.area',
            icon: <Squares2X2Icon className="h-5 w-5 mr-2" />,
            shortcut: 'Ctrl+Shift+A',
        },
        {
            label: 'Tag',
            translationKey: 'dropdown.tag',
            icon: <TagIcon className="h-5 w-5 mr-2" />,
            shortcut: 'Ctrl+Shift+G',
        },
    ];
    return (
        <div className="mt-auto p-3">
            {/* Version Display */}
            {isSidebarOpen && (
                <div className="flex justify-end pb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-600 font-light italic opacity-60">
                        {version}
                    </span>
                </div>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                {isSidebarOpen && (
                    <div
                        className="flex items-center justify-between"
                        ref={dropdownRef}
                    >
                        {/* Plus Icon Button - Left */}
                        <div className="relative">
                            <button
                                onClick={toggleDropdown}
                                className="group flex items-center focus:outline-none text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 ease-out rounded-lg px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md"
                                aria-label="Create New"
                            >
                                <PlusIcon className="h-6 w-6 flex-shrink-0 transition-transform duration-300 ease-out group-hover:rotate-90" />
                                <span className="ml-2 text-sm font-medium whitespace-nowrap opacity-0 max-w-0 overflow-hidden group-hover:opacity-100 group-hover:max-w-[120px] transition-all duration-300 ease-out transform translate-x-[-10px] group-hover:translate-x-0">
                                    {t('dropdown.createNew', 'Create new')}
                                </span>
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                    <div className="py-1">
                                        {dropdownItems.map(
                                            ({
                                                label,
                                                translationKey,
                                                icon,
                                                shortcut,
                                            }) => (
                                                <button
                                                    key={label}
                                                    onClick={() =>
                                                        handleDropdownSelect(
                                                            label
                                                        )
                                                    }
                                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors duration-150"
                                                >
                                                    <div className="flex items-center">
                                                        {icon}
                                                        {t(
                                                            translationKey,
                                                            label
                                                        )}
                                                    </div>
                                                    <span
                                                        className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono text-gray-500 dark:text-gray-400 opacity-60"
                                                        style={{
                                                            fontSize: '10px',
                                                        }}
                                                    >
                                                        ^ + Shift +{' '}
                                                        {shortcut
                                                            .split('+')
                                                            .pop()}
                                                    </span>
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Telegram Status and Dark Mode Toggle - Right */}
                        <div className="flex items-center space-x-2">
                            {/* Telegram Status Indicator */}
                            {telegramStatus !== 'none' && (
                                <div
                                    className="flex items-center justify-center"
                                    title={
                                        telegramStatus === 'healthy'
                                            ? 'Telegram connected and polling'
                                            : 'Telegram connection problem'
                                    }
                                >
                                    <TelegramIcon
                                        className={`h-5 w-5 ${
                                            telegramStatus === 'healthy'
                                                ? 'text-green-500'
                                                : 'text-red-500'
                                        }`}
                                    />
                                </div>
                            )}

                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleDarkMode}
                                className="flex items-center justify-center focus:outline-none text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-2 py-1 transition-colors duration-200"
                                aria-label="Toggle Dark Mode"
                            >
                                {isDarkMode ? (
                                    <SunIcon className="h-6 w-6 text-yellow-500" />
                                ) : (
                                    <MoonIcon className="h-6 w-6 text-gray-500" />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SidebarFooter;
