import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import {
    FlagIcon,
    ChevronRightIcon,
    PlusIcon,
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
        `group flex justify-between items-center rounded-[8px] pl-[30px] pr-[10px] py-[4px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path) ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]' : ''
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
            <div
                className={`group flex justify-between items-center px-[10px] py-[4px] rounded-md hover:bg-gray-100 dark:hover:bg-white/5 ${
                    location.pathname === '/goals'
                        ? 'bg-gray-100 dark:bg-white/5'
                        : ''
                }`}
            >
                <span
                    className={`flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname === '/goals'
                            ? 'text-black dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() => {
                        setIsExpanded(true);
                        handleNavClick('/goals', t('sidebar.goals', 'Goals'), <FlagIcon className="h-4 w-4 mr-2" />);
                    }}
                >
                    <FlagIcon className="h-[14px] w-[14px]" />
                    {t('sidebar.goals', 'Goals')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNavClick(
                                '/goal/new',
                                t('goals.newGoal', 'New Goal'),
                                <FlagIcon className="h-4 w-4 mr-2" />
                            );
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('goals.addGoal', 'Add Goal')}
                        title={t('goals.addGoal', 'Add Goal')}
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
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
            </div>

            {isExpanded && (
                <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
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
                                <span className="truncate min-w-0">
                                    {goal.title}
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
