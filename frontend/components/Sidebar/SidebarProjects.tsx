import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    FolderIcon,
    PlusCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    BookmarkIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { updateProject } from '../../utils/projectsService';
import { Project } from '../../entities/Project';

interface SidebarProjectsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openProjectModal: () => void;
}

const ProjectIcon: React.FC<{ project: Project }> = ({ project }) => (
    <FolderIcon
        className="h-4 w-4"
        style={project.color ? { color: project.color } : undefined}
    />
);

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
    const setProjects = useStore((state) => state.projectsStore.setProjects);

    useEffect(() => {
        if (!hasLoaded) {
            loadProjects();
        }
    }, [hasLoaded, loadProjects]);

    const pinnedProjects = projects.filter((p) => p.pin_to_sidebar);
    const unpinnedActiveProjects = projects.filter(
        (p) =>
            !p.pin_to_sidebar &&
            p.status !== 'done' &&
            p.status !== 'cancelled'
    );

    const isActive = (path: string) => location.pathname === path;

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${
            isActive(path)
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300'
        }`;

    const togglePin = async (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!project.uid) return;
        const newValue = !project.pin_to_sidebar;
        setProjects(
            projects.map((p) =>
                p.uid === project.uid ? { ...p, pin_to_sidebar: newValue } : p
            )
        );
        try {
            await updateProject(project.uid, { pin_to_sidebar: newValue });
        } catch {
            setProjects(
                projects.map((p) =>
                    p.uid === project.uid
                        ? { ...p, pin_to_sidebar: !newValue }
                        : p
                )
            );
        }
    };

    const navigate = (project: Project) =>
        handleNavClick(
            getProjectPath(project),
            project.name,
            <FolderIcon className="h-4 w-4 mr-2" />
        );

    return (
        <ul className="flex flex-col space-y-1 mt-4">
            <li
                className={`group flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${
                    isActive('/projects')
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                }`}
                onClick={() =>
                    handleNavClick(
                        '/projects',
                        'Projects',
                        <FolderIcon className="h-5 w-5 mr-2" />
                    )
                }
            >
                <span className="flex items-center">
                    <FolderIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.projects')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openProjectModal();
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('sidebar.addProjectAriaLabel')}
                        title={t('sidebar.addProjectTitle')}
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                    {unpinnedActiveProjects.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                            aria-label={
                                isExpanded
                                    ? 'Collapse projects list'
                                    : 'Expand projects list'
                            }
                        >
                            {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
            </li>

            {pinnedProjects.map((project) => (
                <li
                    key={project.uid}
                    className={itemClass(getProjectPath(project))}
                    onClick={() => navigate(project)}
                >
                    <span className="flex items-center truncate">
                        <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                            <ProjectIcon project={project} />
                        </span>
                        <span className="truncate">{project.name}</span>
                    </span>
                    <button
                        onClick={(e) => togglePin(project, e)}
                        className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none flex-shrink-0"
                        title="Unpin from sidebar"
                    >
                        <BookmarkIconSolid className="h-4 w-4" />
                    </button>
                </li>
            ))}

            {isExpanded &&
                unpinnedActiveProjects.map((project) => (
                    <li
                        key={project.uid}
                        className={itemClass(getProjectPath(project))}
                        onClick={() => navigate(project)}
                    >
                        <span className="flex items-center truncate">
                            <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                                <ProjectIcon project={project} />
                            </span>
                            <span className="truncate">{project.name}</span>
                        </span>
                        <button
                            onClick={(e) => togglePin(project, e)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 focus:outline-none flex-shrink-0 transition-opacity"
                            title="Pin to sidebar"
                        >
                            <BookmarkIcon className="h-4 w-4" />
                        </button>
                    </li>
                ))}
        </ul>
    );
};

export default SidebarProjects;
