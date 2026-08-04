import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import {
    FlagIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Goal } from '../../entities/Goal';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { createGoalUrl } from '../../utils/slugUtils';

interface SidebarGoalsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
}

const SidebarGoals: React.FC<SidebarGoalsProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    const goals = useStore((state: any) => state.goalsStore.goals);
    const hasLoaded = useStore((state: any) => state.goalsStore.hasLoaded);
    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);

    useEffect(() => {
        if (!hasLoaded) loadGoals();
    }, [hasLoaded, loadGoals]);

    const isActive = (path: string) => location.pathname === path;

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-[8px] px-[10px] py-1 text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path)
                ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
                : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]'
        }`;

    const activeGoals = goals.filter((g: Goal) => g.status === 'active');

    useEffect(() => {
        if (activeGoals.some((g: Goal) => {
            const path = g.uid ? createGoalUrl({ uid: g.uid, title: g.title }) : '/goals';
            return path === location.pathname;
        })) {
            setIsExpanded(true);
        }
    }, [location.pathname, activeGoals.length]);

    return (
        <div className="flex flex-col">
            <div className="flex justify-between items-center px-2.5 py-1 rounded-md mb-px">
                <span
                    className={`text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname === '/goals'
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-[oklch(48%_0.006_95)]'
                    }`}
                    onClick={() =>
                        handleNavClick('/goals', t('sidebar.goals', 'Goals'), <FlagIcon className="h-4 w-4 mr-2" />)
                    }
                >
                    {t('sidebar.goals', 'Goals')}
                </span>
                {activeGoals.length > 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded((v) => !v);
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                    >
                        <ChevronRightIcon
                            className="h-3 w-3 transition-transform duration-150"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                        />
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5">
                    {activeGoals.map((goal: Goal) => {
                        const goalPath = goal.uid ? createGoalUrl({ uid: goal.uid, title: goal.title }) : '/goals';
                        return (
                            <div
                                key={goal.uid ?? goal.id}
                                className={itemClass(goalPath)}
                                onClick={() =>
                                    handleNavClick(goalPath, goal.title, <FlagIcon className="h-4 w-4 mr-2" />)
                                }
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="w-1.5 h-[14px] rounded-full flex-shrink-0"
                                        style={{ backgroundColor: goal.color || '#9ca3af' }}
                                    />
                                    <span className="truncate">{goal.title}</span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SidebarGoals;
