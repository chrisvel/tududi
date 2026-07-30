import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import {
    FlagIcon,
    PlusCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Goal } from '../../entities/Goal';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { createGoalUrl } from '../../utils/slugUtils';

interface SidebarGoalsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    openGoalModal: (goal: Goal | null) => void;
}

const SidebarGoals: React.FC<SidebarGoalsProps> = ({
    handleNavClick,
    location,
    openGoalModal,
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
        `group flex justify-between items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${
            isActive(path)
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300'
        }`;

    const activeGoals = goals.filter((g: Goal) => g.status === 'active');

    return (
        <div className={`flex flex-col space-y-1${isExpanded ? ' pb-3' : ''}`}>
            <div
                className={`group flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${
                    isActive('/goals')
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                }`}
                onClick={() =>
                    handleNavClick('/goals', t('sidebar.goals', 'Goals'), <FlagIcon className="h-5 w-5 mr-2" />)
                }
            >
                <span className="flex items-center">
                    <FlagIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.goals', 'Goals')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openGoalModal(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('sidebar.addGoalAriaLabel', 'Add Goal')}
                        title={t('sidebar.addGoalTitle', 'Add Goal')}
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                    {activeGoals.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                            aria-label={isExpanded ? 'Collapse goals list' : 'Expand goals list'}
                        >
                            {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="max-h-80 overflow-y-auto overscroll-y-contain flex flex-col space-y-1">
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
                                <span className="flex items-center truncate">
                                    <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                                        <FlagIcon className="h-4 w-4 text-blue-500" />
                                    </span>
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
