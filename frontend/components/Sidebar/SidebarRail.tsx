import React from 'react';
import { Link, Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    BookOpenIcon,
    FireIcon,
    FlagIcon,
    FolderIcon,
    QueueListIcon,
    Squares2X2Icon,
    TagIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import { getAssetPath } from '../../config/paths';
import { useStore } from '../../store/useStore';
import type { SidebarVisibleSections } from '../Profile/types';
import type { SidebarSectionId } from '../../utils/sidebarLayout';
import SidebarNav from './SidebarNav';
import SidebarPanelIcon from './SidebarPanelIcon';

interface SidebarRailProps {
    handleNavClick: (path: string, title: string) => void;
    location: Location;
    isDarkMode: boolean;
    openTaskModal: () => void;
    onExpand: () => void;
}

// Sections that have a page of their own, in the user's sidebar order.
const SECTION_LINKS: Partial<
    Record<
        SidebarSectionId,
        {
            path: string;
            match: RegExp;
            titleKey: string;
            title: string;
            Icon: typeof FolderIcon;
        }
    >
> = {
    projects: {
        path: '/projects',
        match: /^\/projects?(\/|$)/,
        titleKey: 'sidebar.projects',
        title: 'Projects',
        Icon: FolderIcon,
    },
    areas: {
        path: '/areas',
        match: /^\/areas?(\/|$)/,
        titleKey: 'sidebar.areas',
        title: 'Areas',
        Icon: Squares2X2Icon,
    },
    goals: {
        path: '/goals',
        match: /^\/goals?(\/|$)/,
        titleKey: 'sidebar.goals',
        title: 'Goals',
        Icon: FlagIcon,
    },
    notes: {
        path: '/notes',
        match: /^\/notes?(\/|$)/,
        titleKey: 'sidebar.notes',
        title: 'Notes',
        Icon: BookOpenIcon,
    },
    tags: {
        path: '/tags',
        match: /^\/tags?(\/|$)/,
        titleKey: 'sidebar.tags',
        title: 'Tags',
        Icon: TagIcon,
    },
    people: {
        path: '/people',
        match: /^\/(people|person)(\/|$)/,
        titleKey: 'sidebar.people',
        title: 'People',
        Icon: UserGroupIcon,
    },
    habits: {
        path: '/habits',
        match: /^\/habits?(\/|$)/,
        titleKey: 'sidebar.habits',
        title: 'Habits',
        Icon: FireIcon,
    },
    views: {
        path: '/views',
        match: /^\/views(\/|$)/,
        titleKey: 'sidebar.views',
        title: 'Views',
        Icon: QueueListIcon,
    },
};

const SidebarRail: React.FC<SidebarRailProps> = ({
    handleNavClick,
    location,
    isDarkMode,
    openTaskModal,
    onExpand,
}) => {
    const { t } = useTranslation();
    const sectionOrder = useStore(
        (state) => state.userSettingsStore.sidebarSectionOrder
    );
    const visibleSections = useStore(
        (state) => state.userSettingsStore.sidebarVisibleSections
    );
    const habitsEnabled = useStore(
        (state) => state.userSettingsStore.habitsEnabled
    );

    const sections = sectionOrder.filter((id) => {
        if (!SECTION_LINKS[id as SidebarSectionId]) return false;
        if (visibleSections[id as keyof SidebarVisibleSections] === false) {
            return false;
        }
        return id !== 'habits' || habitsEnabled;
    });

    return (
        <div className="flex flex-col items-center h-full pt-4 pb-3">
            <Link
                to="/"
                className="flex items-center justify-center h-10 w-10 mb-1"
                aria-label="tududi"
            >
                <img
                    src={getAssetPath('icon-logo.png')}
                    alt="tududi"
                    className="h-7 w-7 rounded-md"
                />
            </Link>
            <button
                type="button"
                onClick={onExpand}
                className="mb-3 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-300/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Expand Sidebar"
                title="Expand Sidebar"
                data-testid="sidebar-rail-expand"
            >
                <SidebarPanelIcon className="h-5 w-5" />
            </button>

            <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center">
                <SidebarNav
                    compact
                    handleNavClick={handleNavClick}
                    location={location}
                    isDarkMode={isDarkMode}
                    openTaskModal={openTaskModal}
                />

                {sections.length > 0 && (
                    <div className="my-3 h-px w-6 bg-gray-300 dark:bg-gray-700" />
                )}

                <ul className="flex flex-col items-center gap-1">
                    {sections.map((id) => {
                        const section = SECTION_LINKS[id as SidebarSectionId]!;
                        const title = t(section.titleKey, section.title);
                        const active = section.match.test(location.pathname);
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        handleNavClick(section.path, title)
                                    }
                                    title={title}
                                    aria-label={title}
                                    data-testid={`sidebar-rail-${id}`}
                                    className={`flex items-center justify-center h-9 w-9 rounded-[8px] transition-colors duration-150 ${
                                        active
                                            ? 'bg-blue-50 text-blue-600 dark:bg-[oklch(27%_0.02_250)] dark:text-[oklch(68%_0.14_250)]'
                                            : 'text-gray-500 hover:bg-gray-100 dark:text-[oklch(65%_0.006_95)] dark:hover:bg-[oklch(24%_0.015_250)]'
                                    }`}
                                >
                                    <section.Icon className="h-[18px] w-[18px]" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};

export default SidebarRail;
