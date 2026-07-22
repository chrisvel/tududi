import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Squares2X2Icon,
    ViewColumnsIcon,
    RectangleGroupIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';

interface SidebarBoardsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const SidebarBoards: React.FC<SidebarBoardsProps> = ({ handleNavClick, location }) => {
    const { t } = useTranslation();
    const eisenhowerEnabled = useStore((state) => state.userSettingsStore.eisenhowerEnabled);
    const kanbanEnabled = useStore((state) => state.userSettingsStore.kanbanEnabled);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('boardsSidebarCollapsed') === 'true';
    });

    if (!eisenhowerEnabled && !kanbanEnabled) return null;

    const toggleCollapsed = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('boardsSidebarCollapsed', String(next));
    };

    const isActive = (path: string) =>
        location.pathname === path
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';

    const boards = [
        eisenhowerEnabled && {
            path: '/boards/eisenhower',
            title: t('sidebar.eisenhower', 'Eisenhower Matrix'),
            icon: <Squares2X2Icon className="h-4 w-4 flex-shrink-0" />,
        },
        kanbanEnabled && {
            path: '/boards/kanban',
            title: t('sidebar.kanban', 'Kanban Board'),
            icon: <ViewColumnsIcon className="h-4 w-4 flex-shrink-0" />,
        },
    ].filter(Boolean) as { path: string; title: string; icon: JSX.Element }[];

    return (
        <ul className={`flex flex-col space-y-1${!isCollapsed && boards.length > 0 ? ' pb-3' : ''}`}>
            <li
                className="group flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white text-gray-700 dark:text-gray-300"
                onClick={toggleCollapsed}
            >
                <span className="flex items-center">
                    <RectangleGroupIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.boards', 'Boards')}
                </span>
                {isCollapsed ? (
                    <ChevronRightIcon className="h-4 w-4" />
                ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                )}
            </li>
            {!isCollapsed &&
                boards.map((board) => (
                    <li
                        key={board.path}
                        className={`flex items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${isActive(board.path)}`}
                        onClick={() => handleNavClick(board.path, board.title, board.icon)}
                    >
                        <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                            {board.icon}
                        </span>
                        {board.title}
                    </li>
                ))}
        </ul>
    );
};

export default SidebarBoards;
