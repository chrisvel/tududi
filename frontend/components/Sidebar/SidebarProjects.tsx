import React, { useEffect, useState } from 'react';
import { Location } from 'react-router-dom';
import { FolderIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';
import { Project } from '../../entities/Project';
import { createProjectUrl } from '../../utils/slugUtils';

interface SidebarProjectsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openProjectModal: () => void;
}

const SidebarProjects: React.FC<SidebarProjectsProps> = ({
    handleNavClick,
    location,
    openProjectModal,
}) => {
    const { t } = useTranslation();
    const [pinnedProjects, setPinnedProjects] = useState<Project[]>([]);

    const getProjectPath = (project: Project) => {
        if (project.uid) {
            return createProjectUrl(project);
        }

        return project.id ? `/project/${project.id}` : '/projects';
    };

    const fetchPinnedProjects = async () => {
        try {
            const response = await fetch(
                getApiPath('projects?pin_to_sidebar=true'),
                {
                    credentials: 'include',
                }
            );
            if (response.ok) {
                const data = await response.json();
                const projects = Array.isArray(data)
                    ? data
                    : data.projects || [];
                setPinnedProjects(
                    [...projects].sort((a: Project, b: Project) =>
                        a.name.localeCompare(b.name)
                    )
                );
            }
        } catch (error) {
            console.error('Error fetching pinned projects:', error);
        }
    };

    useEffect(() => {
        fetchPinnedProjects();

        const handleProjectUpdate = () => {
            fetchPinnedProjects();
        };

        window.addEventListener('projectUpdated', handleProjectUpdate);
        return () => {
            window.removeEventListener('projectUpdated', handleProjectUpdate);
        };
    }, []);

    const isActiveProject = (path: string) => {
        return location.pathname === path
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <>
            <ul className="flex flex-col space-y-1 mt-4">
                <li
                    className={`flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${isActiveProject(
                        '/projects'
                    )}`}
                    onClick={() =>
                        handleNavClick(
                            '/projects',
                            t('sidebar.projects'),
                            <FolderIcon className="h-5 w-5 mr-2" />
                        )
                    }
                >
                    <span className="flex items-center">
                        <FolderIcon className="h-5 w-5 mr-2" />
                        {t('sidebar.projects')}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openProjectModal();
                        }}
                        className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('sidebar.addProjectAriaLabel')}
                        title={t('sidebar.addProjectTitle')}
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </li>
                {pinnedProjects.map((project, index) => {
                    const path = getProjectPath(project);
                    return (
                        <li
                            key={project.uid || project.id}
                            className={`${index === 0 ? 'mt-2 ' : ''}flex justify-between items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${isActiveProject(
                                path
                            )}`}
                            onClick={() =>
                                handleNavClick(
                                    path,
                                    project.name,
                                    <FolderIcon className="h-5 w-5 mr-2" />
                                )
                            }
                        >
                            <span className="flex items-center truncate">
                                <FolderIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span className="truncate">{project.name}</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </>
    );
};

export default SidebarProjects;
