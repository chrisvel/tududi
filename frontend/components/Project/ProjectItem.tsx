import React from 'react';
import { Link } from 'react-router-dom';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import { useTranslation } from 'react-i18next';

interface ProjectItemProps {
    project: Project;
    viewMode: 'cards' | 'list';
    getCompletionPercentage: () => number;
    activeDropdown: number | null;
    setActiveDropdown: React.Dispatch<React.SetStateAction<number | null>>;
    handleEditProject: (project: Project) => void;
    setProjectToDelete: React.Dispatch<React.SetStateAction<Project | null>>;
    setIsConfirmDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const getProjectInitials = (name: string, maxLetters?: number) => {
    const words = name
        .trim()
        .split(' ')
        .filter((word) => word.length > 0);

    if (words.length === 1) {
        const singleWord = name.toUpperCase();
        return maxLetters ? singleWord.substring(0, maxLetters) : singleWord;
    }

    const initials = words.map((word) => word[0].toUpperCase()).join('');
    return maxLetters ? initials.substring(0, maxLetters) : initials;
};

const ProjectItem: React.FC<ProjectItemProps> = ({
    project,
    viewMode,
    getCompletionPercentage,
    activeDropdown,
    setActiveDropdown,
    handleEditProject,
    setProjectToDelete,
    setIsConfirmDialogOpen,
}) => {
    const { t } = useTranslation();
    return (
        <div
            className={`${
                viewMode === 'cards'
                    ? 'bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-col group'
                    : 'bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md relative flex flex-row items-center p-4 group'
            }`}
            style={{
                minHeight: viewMode === 'cards' ? '250px' : 'auto',
                maxHeight: viewMode === 'cards' ? '250px' : 'auto',
            }}
        >
            {viewMode === 'cards' && (
                <Link
                    to={
                        project.uid
                            ? `/project/${project.uid}-${project.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-|-$/g, '')}`
                            : `/project/${project.id}`
                    }
                >
                    <div
                        className="bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden rounded-t-lg relative cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ height: '140px' }}
                    >
                        {project.image_url ? (
                            <img
                                src={project.image_url}
                                alt={project.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span
                                className="text-2xl font-extrabold text-gray-500 dark:text-gray-400 opacity-20"
                                aria-label={t('projectItem.projectInitials')}
                            >
                                {getProjectInitials(project.name)}
                            </span>
                        )}
                    </div>
                </Link>
            )}

            {viewMode === 'list' && (
                <Link
                    to={
                        project.uid
                            ? `/project/${project.uid}-${project.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/^-|-$/g, '')}`
                            : `/project/${project.id}`
                    }
                    className="w-10 h-10 mr-3 flex-shrink-0"
                >
                    {project.image_url ? (
                        <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-full h-full object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                            <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400 opacity-20">
                                {getProjectInitials(project.name, 2)}
                            </span>
                        </div>
                    )}
                </Link>
            )}

            <div
                className={`flex justify-between ${
                    viewMode === 'cards'
                        ? 'items-start p-4 flex-1'
                        : 'items-center flex-1'
                }`}
            >
                <div className="flex items-center">
                    <Link
                        to={
                            project.uid
                                ? `/project/${project.uid}-${project.name
                                      .toLowerCase()
                                      .replace(/[^a-z0-9]+/g, '-')
                                      .replace(/^-|-$/g, '')}`
                                : `/project/${project.id}`
                        }
                        className={`${
                            viewMode === 'cards'
                                ? 'text-lg font-semibold text-gray-900 dark:text-gray-100 hover:underline line-clamp-2'
                                : 'text-md font-semibold text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-200 transition-colors'
                        }`}
                    >
                        {project.name}
                    </Link>
                </div>
                <div className="relative dropdown-container">
                    {viewMode === 'cards' ? (
                        <>
                            <button
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-400 focus:outline-none"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const projectId = project.id;
                                    if (projectId !== undefined) {
                                        setActiveDropdown(
                                            activeDropdown === projectId
                                                ? null
                                                : projectId
                                        );
                                    }
                                }}
                                aria-label={t('projectItem.toggleDropdownMenu')}
                            >
                                <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>

                            {project.id !== undefined &&
                                activeDropdown === project.id && (
                                    <div className="absolute right-0 mt-2 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-10">
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleEditProject(project);
                                                setActiveDropdown(null);
                                            }}
                                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                        >
                                            {t('projectItem.edit')}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (
                                                    project.id === undefined ||
                                                    project.id === null
                                                ) {
                                                    console.error(
                                                        'Cannot delete project: Invalid ID',
                                                        project
                                                    );
                                                    return;
                                                }
                                                setProjectToDelete(project);
                                                setIsConfirmDialogOpen(true);
                                                setActiveDropdown(null);
                                            }}
                                            className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                        >
                                            {t('projectItem.delete')}
                                        </button>
                                    </div>
                                )}
                        </>
                    ) : (
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEditProject(project);
                                }}
                                className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (
                                        project.id === undefined ||
                                        project.id === null
                                    ) {
                                        console.error(
                                            'Cannot delete project: Invalid ID',
                                            project
                                        );
                                        return;
                                    }
                                    setProjectToDelete(project);
                                    setIsConfirmDialogOpen(true);
                                }}
                                className="text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'cards' && (
                <div className="absolute bottom-4 left-0 right-0 px-4">
                    <div className="flex items-center space-x-2">
                        <div
                            className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
                            title={t('projectItem.completionPercentage', {
                                percentage: getCompletionPercentage(),
                            })}
                        >
                            <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{
                                    width: `${getCompletionPercentage()}%`,
                                }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectItem;
