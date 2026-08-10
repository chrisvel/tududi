import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import TelegramIcon from '../Shared/Icons/TelegramIcon';
import { useTranslation } from 'react-i18next';
import { Note } from '../../entities/Note';
import { Area } from '../../entities/Area';
import { useTelegramStatus } from '../../contexts/TelegramStatusContext';
import { getApiPath } from '../../config/paths';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import {
    KeyboardShortcutsConfig,
    ShortcutAction,
    formatShortcutDisplay,
    getDefaultShortcuts,
    getShortcutByAction,
} from '../../utils/keyboardShortcutsService';

interface SidebarFooterProps {
    currentUser: { email: string; avatar_image?: string };
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isDropdownOpen: boolean;
    toggleDropdown: () => void;
    openTaskModal: () => void;
    openProjectModal: () => void;
    openNoteModal: (note: Note | null) => void;
    openAreaModal: (area: Area | null) => void;
    openTagModal: (tag: any | null) => void;
    keyboardShortcuts?: KeyboardShortcutsConfig | null;
}

const SidebarFooter: React.FC<SidebarFooterProps> = ({
    isDarkMode,
    toggleDarkMode,
    setIsSidebarOpen,
    openTaskModal,
    openProjectModal,
    openNoteModal,
    openAreaModal,
    openTagModal,
    keyboardShortcuts,
}) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { status: telegramStatus } = useTelegramStatus();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [version, setVersion] = useState<string>('v0.86');
    const navigate = useNavigate();

    // Get shortcuts config, using defaults if not provided
    const shortcuts = useMemo(() => {
        return keyboardShortcuts?.shortcuts || getDefaultShortcuts();
    }, [keyboardShortcuts]);

    const shortcutsEnabled = keyboardShortcuts?.enabled ?? true;

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

    const handleDropdownSelect = (type: string) => {
        switch (type) {
            case 'Inbox':
                navigate('/inbox');
                if (window.innerWidth < 1024) {
                    setIsSidebarOpen(false);
                }
                break;
            case 'Task':
                openTaskModal();
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

    // Use the keyboard shortcuts hook
    useKeyboardShortcuts(
        shortcuts,
        {
            inbox: () => handleDropdownSelect('Inbox'),
            task: () => handleDropdownSelect('Task'),
            project: () => handleDropdownSelect('Project'),
            note: () => handleDropdownSelect('Note'),
            area: () => handleDropdownSelect('Area'),
            tag: () => handleDropdownSelect('Tag'),
        },
        shortcutsEnabled
    );

    // Helper to get the display string for a shortcut action
    const getShortcutDisplay = (action: ShortcutAction): string => {
        const shortcut = getShortcutByAction(shortcuts, action);
        return shortcut ? formatShortcutDisplay(shortcut) : '';
    };

    const dropdownItems = [
        {
            label: 'Inbox',
            translationKey: 'dropdown.inbox',
            icon: <InboxIcon className="h-5 w-5 mr-2" />,
            action: 'inbox' as ShortcutAction,
        },
        {
            label: 'Task',
            translationKey: 'dropdown.task',
            icon: <CheckIcon className="h-5 w-5 mr-2" />,
            action: 'task' as ShortcutAction,
        },
        {
            label: 'Project',
            translationKey: 'dropdown.project',
            icon: <FolderIcon className="h-5 w-5 mr-2" />,
            action: 'project' as ShortcutAction,
        },
        {
            label: 'Note',
            translationKey: 'dropdown.note',
            icon: <BookOpenIcon className="h-5 w-5 mr-2" />,
            action: 'note' as ShortcutAction,
        },
        {
            label: 'Area',
            translationKey: 'dropdown.area',
            icon: <Squares2X2Icon className="h-5 w-5 mr-2" />,
            action: 'area' as ShortcutAction,
        },
        {
            label: 'Tag',
            translationKey: 'dropdown.tag',
            icon: <TagIcon className="h-5 w-5 mr-2" />,
            action: 'tag' as ShortcutAction,
        },
    ];

    return (
        <div className="flex-shrink-0" ref={dropdownRef}>
            {/* Version */}
            <div className="px-[14px] pt-[10px] flex justify-end">
                <span className="text-[11px] text-gray-400 dark:text-gray-600 font-light italic opacity-60">
                    {version}
                </span>
            </div>

            {/* Toolbar row: + create | dark mode */}
            <div className="border-t border-gray-100 dark:border-white/10 px-[14px] py-[10px] flex items-center justify-between">
                {/* Plus / Create dropdown */}
                <div className="relative">
                    <button
                        onClick={toggleDropdown}
                        className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] focus:outline-none text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-150"
                        aria-label={t('sidebar.createNew')}
                    >
                        <PlusIcon className="h-4 w-4" />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-60 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                            <div className="py-1">
                                {dropdownItems.map(({ label, translationKey, icon, action }) => (
                                    <button
                                        key={label}
                                        onClick={() => handleDropdownSelect(label)}
                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between transition-colors duration-150"
                                    >
                                        <div className="flex items-center">
                                            {icon}
                                            {t(translationKey, label)}
                                        </div>
                                        <span
                                            className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-mono text-gray-500 dark:text-gray-400"
                                            style={{ fontSize: '10px' }}
                                        >
                                            {getShortcutDisplay(action)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right side: telegram + dark mode */}
                <div className="flex items-center gap-1.5">
                    {telegramStatus !== 'none' && (
                        <div
                            className="flex items-center justify-center"
                            title={telegramStatus === 'healthy' ? 'Telegram connected' : 'Telegram connection problem'}
                        >
                            <TelegramIcon
                                className={`h-4 w-4 ${telegramStatus === 'healthy' ? 'text-green-500' : 'text-red-500'}`}
                            />
                        </div>
                    )}
                    <button
                        onClick={toggleDarkMode}
                        className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] focus:outline-none text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-150"
                        aria-label={t('sidebar.toggleDarkMode')}
                    >
                        {isDarkMode ? (
                            <SunIcon className="h-4 w-4 text-yellow-500" />
                        ) : (
                            <MoonIcon className="h-4 w-4" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SidebarFooter;
