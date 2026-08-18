import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    FolderIcon,
    ChevronRightIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Project } from '../../entities/Project';

interface SidebarProjectsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openProjectModal: () => void;
}

const getProjectPath = (project: Project) => {
    const slug = project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `/project/${project.uid}-${slug}`;
};

const SidebarProjects: React.FC<SidebarProjectsProps> = ({
    handleNavClick,
    location,
    openProjectModal,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    const projects = useStore((state) => state.projectsStore.projects);
    const hasLoaded = useStore((state) => state.projectsStore.hasLoaded);
    const loadProjects = useStore((state) => state.projectsStore.loadProjects);

    useEffect(() => {
        if (!hasLoaded) {
            loadProjects();
        }
    }, [hasLoaded, loadProjects]);

    const activeProjects = projects.filter(
        (p) => p.status !== 'done' && p.status !== 'cancelled'
    );

    useEffect(() => {
        if (activeProjects.some((p) => getProjectPath(p) === location.pathname)) {
            setIsExpanded(true);
        }
    }, [location.pathname, activeProjects.length]);

    const isActive = (path: string) => location.pathname === path;

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-[8px] pl-[30px] pr-[10px] py-[4px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path) ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]' : ''
        }`;

    const navigate = (project: Project) =>
        handleNavClick(
            getProjectPath(project),
            project.name,
            <FolderIcon className="h-4 w-4 mr-2" />
        );

    return (
        <ul className="flex flex-col">
            <li
                className={`group flex justify-between items-center px-[10px] py-[4px] rounded-md hover:bg-gray-100 dark:hover:bg-white/5 ${
                    location.pathname === '/projects'
                        ? 'bg-gray-100 dark:bg-white/5'
                        : ''
                }`}
            >
                <span
                    className={`flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname === '/projects'
                            ? 'text-black dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() => {
                        setIsExpanded(true);
                        handleNavClick('/projects', t('sidebar.projects'), <FolderIcon className="h-4 w-4 mr-2" />);
                    }}
                >
                    <FolderIcon className="h-[14px] w-[14px]" />
                    {t('sidebar.projects')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openProjectModal();
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('projects.addProject', 'Add Project')}
                        title={t('projects.addProject', 'Add Project')}
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                    {activeProjects.length > 0 && (
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
            </li>

            {isExpanded && (
                <li className="p-0 list-none">
                    <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
                        {activeProjects.map((project) => (
                            <div
                                key={project.uid}
                                className={itemClass(getProjectPath(project))}
                                onClick={() => navigate(project)}
                            >
                                <span className="truncate min-w-0">
                                    {project.name}
                                </span>
                            </div>
                        ))}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default SidebarProjects;
