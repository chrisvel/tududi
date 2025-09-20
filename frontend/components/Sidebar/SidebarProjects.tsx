import React from 'react';
import { Location } from 'react-router-dom';
import { FolderIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

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
                            'Projects',
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
                        aria-label="Add Project"
                        title="Add Project"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                </li>
            </ul>
        </>
    );
};

export default SidebarProjects;
