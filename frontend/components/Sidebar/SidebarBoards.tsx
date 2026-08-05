import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Squares2X2Icon,
    ViewColumnsIcon,
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
        return localStorage.getItem('boardsSidebarCollapsed') !== 'false';
    });

    if (!eisenhowerEnabled && !kanbanEnabled) return null;

    const toggleCollapsed = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('boardsSidebarCollapsed', String(next));
    };

    const isActive = (path: string) =>
        location.pathname === path
            ? 'bg-blue-50 dark:bg-[oklch(27%_0.08_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
            : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]';

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
        <ul className="flex flex-col">
            <li className="flex justify-between items-center px-2.5 py-1 rounded-md mb-px">
                <span className="text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white text-gray-500 dark:text-[oklch(48%_0.006_95)]" onClick={toggleCollapsed}>
                    {t('sidebar.boards', 'Boards')}
                </span>
                <button onClick={toggleCollapsed} className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none">
                    <ChevronRightIcon
                        className="h-3 w-3 transition-transform duration-150"
                        style={{ transform: !isCollapsed ? 'rotate(90deg)' : 'none' }}
                    />
                </button>
            </li>
            {!isCollapsed &&
                boards.map((board) => (
                    <li
                        key={board.path}
                        className={`flex items-center rounded-[8px] px-[10px] py-1.5 text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${isActive(board.path)}`}
                        onClick={() => handleNavClick(board.path, board.title, board.icon)}
                    >
                        {board.title}
                    </li>
                ))}
        </ul>
    );
};

export default SidebarBoards;
