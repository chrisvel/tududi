import React, { useState } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Squares2X2Icon,
    ViewColumnsIcon,
    RectangleGroupIcon,
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
            ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)] text-gray-500 dark:text-[oklch(82%_0.006_95)]'
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
            <li className="flex justify-between items-center px-[10px] py-[4px] rounded-md">
                <span className="flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-gray-900 dark:hover:text-white text-gray-400 dark:text-[oklch(58%_0.006_95)]" onClick={toggleCollapsed}>
                    <RectangleGroupIcon className="h-[14px] w-[14px]" />
                    {t('sidebar.boards', 'Boards')}
                </span>
                <div className="flex items-center gap-1">
                    <span className="h-3.5 w-3.5" aria-hidden="true" />
                    <button onClick={toggleCollapsed} className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none">
                        <ChevronRightIcon
                            className="h-3 w-3 transition-transform duration-150"
                            style={{ transform: !isCollapsed ? 'rotate(90deg)' : 'none' }}
                        />
                    </button>
                </div>
            </li>
            {!isCollapsed && (
                <li className="p-0 list-none">
                    <div className="flex flex-col gap-0.5 mb-1.5">
                        {boards.map((board) => (
                            <div
                                key={board.path}
                                className={`flex items-center gap-[4px] rounded-[8px] px-[10px] py-[4px] text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${isActive(board.path)}`}
                                onClick={() => handleNavClick(board.path, board.title, board.icon)}
                            >
                                {board.icon}
                                {board.title}
                            </div>
                        ))}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default SidebarBoards;
