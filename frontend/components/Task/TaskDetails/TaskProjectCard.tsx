import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ProjectDropdown from '../../Shared/ProjectDropdown';
import { Project } from '../../../entities/Project';
import { Task } from '../../../entities/Task';

interface TaskProjectCardProps {
    task: Task;
    projects: Project[];
    onProjectSelect: (project: Project) => Promise<void>;
    onProjectClear: () => Promise<void>;
    onProjectCreate: (name: string) => Promise<void>;
    getProjectLink: (project: Project) => string;
}

const TaskProjectCard: React.FC<TaskProjectCardProps> = ({
    task,
    projects,
    onProjectSelect,
    onProjectClear,
    onProjectCreate,
    getProjectLink,
}) => {
    const { t } = useTranslation();
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                projectDropdownOpen &&
                projectDropdownRef.current &&
                !projectDropdownRef.current.contains(e.target as Node)
            ) {
                setProjectDropdownOpen(false);
                setProjectName('');
            }
        };

        if (projectDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [projectDropdownOpen]);

    const handleProjectSearch = (query: string) => {
        setProjectName(query);
        const filtered = projects.filter((p) =>
            p.name.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredProjects(filtered);
    };

    const handleProjectSelection = async (project: Project) => {
        await onProjectSelect(project);
        setProjectDropdownOpen(false);
        setProjectName('');
    };

    const handleClearProject = async () => {
        await onProjectClear();
        setProjectDropdownOpen(false);
        setProjectName('');
    };

    const handleCreateProjectInline = async (name: string) => {
        setIsCreatingProject(true);
        try {
            await onProjectCreate(name);
            setProjectDropdownOpen(false);
            setProjectName('');
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleShowAllProjects = () => {
        setFilteredProjects(projects);
    };

    return (
        <div ref={projectDropdownRef}>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.project', 'Project')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                {projectDropdownOpen ? (
                    <ProjectDropdown
                        projectName={projectName}
                        onProjectSearch={handleProjectSearch}
                        dropdownOpen={projectDropdownOpen}
                        filteredProjects={filteredProjects}
                        onProjectSelection={handleProjectSelection}
                        onCreateProject={handleCreateProjectInline}
                        isCreatingProject={isCreatingProject}
                        onShowAllProjects={handleShowAllProjects}
                        allProjects={projects}
                        selectedProject={null}
                        onClearProject={handleClearProject}
                    />
                ) : task.Project ? (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm relative overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setProjectDropdownOpen(true)}
                            className="group w-full text-left hover:opacity-90 transition-opacity"
                        >
                            <div
                                className="flex items-center justify-center overflow-hidden relative"
                                style={{ height: '100px' }}
                            >
                                {task.Project.image_url ? (
                                    <img
                                        src={task.Project.image_url}
                                        alt={task.Project.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700"></div>
                                )}
                            </div>
                            <div className="p-3">
                                <div className="flex items-center text-md font-semibold text-gray-900 dark:text-gray-100">
                                    <span className="truncate">
                                        {task.Project.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearProject();
                                        }}
                                        className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-500 dark:text-gray-400 bg-transparent hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={t(
                                            'task.clearProject',
                                            'Remove project'
                                        )}
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                    <Link
                                        to={getProjectLink(task.Project)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 ml-2"
                                        title={t(
                                            'project.viewProject',
                                            'Go to project'
                                        )}
                                    >
                                        <ArrowRightIcon className="h-4 w-4" />
                                        <span className="sr-only">
                                            {t(
                                                'project.viewProject',
                                                'Go to project'
                                            )}
                                        </span>
                                    </Link>
                                </div>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => setProjectDropdownOpen(true)}
                        className="rounded-lg shadow-sm bg-white dark:bg-gray-900 hover:border-gray-400 dark:hover:border-gray-600 p-6 cursor-pointer transition-colors flex items-center justify-center"
                    >
                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                            {t(
                                'task.noProject',
                                'No project - Click to assign'
                            )}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskProjectCard;
