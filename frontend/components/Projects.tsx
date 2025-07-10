import React, { useState, useEffect, useRef } from 'react';
import {
    MagnifyingGlassIcon,
    FolderIcon,
    Squares2X2Icon,
    Bars3Icon,
    ChevronDownIcon,
} from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import ProjectModal from './Project/ProjectModal';
import { useStore } from '../store/useStore';
import {
    fetchGroupedProjects,
    createProject,
    updateProject,
    deleteProject,
} from '../utils/projectsService';
import { fetchAreas } from '../utils/areasService';
import { useTranslation } from 'react-i18next';

import { Project } from '../entities/Project';
import { PriorityType } from '../entities/Task';
import { useSearchParams } from 'react-router-dom';
import ProjectItem from './Project/ProjectItem';

const getPriorityStyles = (priority: PriorityType) => {
    switch (priority) {
        case 'low':
            return { color: 'bg-green-500' };
        case 'medium':
            return { color: 'bg-yellow-500' };
        case 'high':
            return { color: 'bg-red-500' };
        default:
            return { color: 'bg-gray-500' };
    }
};

// Reusable dropdown component
interface DropdownOption {
    value: string;
    label: string;
}

interface DropdownProps {
    label: string;
    value: string;
    options: DropdownOption[];
    onChange: (value: string) => void;
    placeholder?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ label, value, options, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(option => option.value === value);

    return (
        <div className="w-full md:w-auto relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex justify-between w-full px-3 py-2 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
                <span>{selectedOption?.label || placeholder}</span>
                <ChevronDownIcon className={`w-5 h-5 text-gray-500 dark:text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`flex items-center justify-between w-full px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                                option.value === value ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Projects: React.FC = () => {
    const { t } = useTranslation();
    const {
        areas,
        setAreas,
        setError: setAreasError,
    } = useStore((state) => state.areasStore);
    const {
        projects,
        setProjects,
        setLoading: setProjectsLoading,
        setError: setProjectsError,
    } = useStore((state) => state.projectsStore);
    const { isLoading, isError } = useStore((state) => state.projectsStore);

    const [groupedProjects, setGroupedProjects] = useState<
        Record<string, Project[]>
    >({});
    const [isProjectModalOpen, setIsProjectModalOpen] =
        useState<boolean>(false);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(
        null
    );
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeFilter = searchParams.get('active') || 'all';
    const areaFilter = searchParams.get('area_id') || '';

    useEffect(() => {
        const loadAreas = async () => {
            try {
                const areasData = await fetchAreas();
                setAreas(areasData);
            } catch (error) {
                console.error('Failed to fetch areas:', error);
                setAreasError(true);
            }
        };

        loadAreas();
    }, []);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const groupedProjectsData = await fetchGroupedProjects(
                    activeFilter,
                    areaFilter
                );
                setGroupedProjects(groupedProjectsData);
            } catch (error) {
                console.error('Failed to fetch projects:', error);
                setProjectsError(true);
            }
        };

        loadProjects();
    }, [activeFilter, areaFilter]);


    const handleSaveProject = async (project: Project) => {
        setProjectsLoading(true);
        try {
            if (project.id) {
                await updateProject(project.id, project);
            } else {
                await createProject(project);
            }
            const groupedProjectsData = await fetchGroupedProjects(
                activeFilter,
                areaFilter
            );
            setGroupedProjects(groupedProjectsData);
        } catch (error) {
            console.error('Error saving project:', error);
            setProjectsError(true);
        } finally {
            setProjectsLoading(false);
            setIsProjectModalOpen(false);
        }
    };

    const handleEditProject = (project: Project) => {
        setProjectToEdit(project);
        setIsProjectModalOpen(true);
    };

    const handleDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            if (projectToDelete.id !== undefined) {
                setProjectsLoading(true);
                await deleteProject(projectToDelete.id);
                const groupedProjectsData = await fetchGroupedProjects(
                    activeFilter,
                    areaFilter
                );
                setGroupedProjects(groupedProjectsData);
            } else {
                console.error('Cannot delete project: ID is undefined.');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            setProjectsError(true);
        } finally {
            setProjectsLoading(false);
            setIsConfirmDialogOpen(false);
            setProjectToDelete(null);
        }
    };

    const getCompletionPercentage = (project: Project) => {
        // Now the completion percentage comes directly from the backend
        return (project as any).completion_percentage || 0;
    };

    const handleActiveFilterChange = (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        const newActiveFilter = e.target.value;
        const params = new URLSearchParams(searchParams);

        if (newActiveFilter === 'all') {
            params.delete('active');
        } else {
            params.set('active', newActiveFilter);
        }
        setSearchParams(params);
    };

    const handleAreaFilterChange = (
        e: React.ChangeEvent<HTMLSelectElement>
    ) => {
        const newAreaFilter = e.target.value;
        const params = new URLSearchParams(searchParams);

        if (newAreaFilter === '') {
            params.delete('area_id');
        } else {
            params.set('area_id', newAreaFilter);
        }

        setSearchParams(params);
    };

    // Apply search filter to the grouped projects from backend
    const searchFilteredGroupedProjects = Object.keys(groupedProjects).reduce<
        Record<string, Project[]>
    >((acc, areaName) => {
        const projectsInArea = groupedProjects[areaName];

        // Defensive check: ensure projectsInArea is an array
        if (!Array.isArray(projectsInArea)) {
            console.warn(
                `Projects for area "${areaName}" is not an array:`,
                projectsInArea
            );
            return acc;
        }

        const filteredProjects = projectsInArea.filter((project) =>
            project.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filteredProjects.length > 0) {
            acc[areaName] = filteredProjects;
        }
        return acc;
    }, {});

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('projects.loading')}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    {t('projects.error')}
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                <div className="flex items-center mb-8">
                    <FolderIcon className="h-6 w-6 mr-2" />
                    <h2 className="text-2xl font-light">
                        {t('projects.title')}
                    </h2>
                </div>

                {/* View Mode and Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`p-2 rounded-md focus:outline-none ${
                                viewMode === 'cards'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                            aria-label={t('projects.cardViewAriaLabel')}
                        >
                            <Squares2X2Icon className="h-5 w-5" />
                        </button>

                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md focus:outline-none ${
                                viewMode === 'list'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                            aria-label={t('projects.listViewAriaLabel')}
                        >
                            <Bars3Icon className="h-5 w-5" />
                        </button>

                        {/* Search Toggle Button */}
                        <button
                            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                            className={`p-2 rounded-md focus:outline-none transition-colors ${
                                isSearchExpanded
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                            aria-label={t('common.search', 'Search')}
                        >
                            <MagnifyingGlassIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                        {/* Status Dropdown */}
                        <Dropdown
                            label={t('common.status')}
                            value={activeFilter}
                            options={[
                                { value: 'true', label: t('projects.filters.active') },
                                { value: 'false', label: t('projects.filters.inactive') },
                                { value: 'all', label: t('projects.filters.all') }
                            ]}
                            onChange={(value) => handleActiveFilterChange({target: {value}} as any)}
                        />

                        {/* Area Dropdown */}
                        <Dropdown
                            label={t('common.area')}
                            value={areaFilter}
                            options={[
                                { value: '', label: t('projects.filters.allAreas') },
                                ...areas.map(area => ({
                                    value: area.id?.toString() || '',
                                    label: area.name
                                }))
                            ]}
                            onChange={(value) => handleAreaFilterChange({target: {value}} as any)}
                        />
                    </div>
                </div>

                {/* Collapsible Search Bar */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isSearchExpanded ? 'max-h-20 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
                }`}>
                    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-2">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder={t('projects.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Projects Grid/List */}
                <div
                    className={`${
                        viewMode === 'cards'
                            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                            : 'flex flex-col space-y-1'
                    }`}
                >
                    {Object.keys(searchFilteredGroupedProjects).length === 0 ? (
                        <div className="text-gray-700 dark:text-gray-300">
                            {t('projects.noProjectsFound')}
                        </div>
                    ) : (
                        Object.keys(searchFilteredGroupedProjects).map(
                            (areaName) => (
                                <React.Fragment key={areaName}>
                                    <h3
                                        className={`${
                                            viewMode === 'cards'
                                                ? 'col-span-full text-md uppercase font-light text-gray-800 dark:text-gray-200 mb-2 mt-6'
                                                : 'text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 mt-6 border-b border-gray-300 dark:border-gray-600 pb-2'
                                        }`}
                                    >
                                        {areaName}
                                    </h3>
                                    {searchFilteredGroupedProjects[
                                        areaName
                                    ].map((project) => {
                                        const { color } = getPriorityStyles(
                                            project.priority || 'low'
                                        );
                                        return (
                                            <ProjectItem
                                                key={project.id}
                                                project={project}
                                                viewMode={viewMode}
                                                color={color}
                                                getCompletionPercentage={() =>
                                                    getCompletionPercentage(
                                                        project
                                                    )
                                                }
                                                activeDropdown={activeDropdown}
                                                setActiveDropdown={
                                                    setActiveDropdown
                                                }
                                                handleEditProject={
                                                    handleEditProject
                                                }
                                                setProjectToDelete={
                                                    setProjectToDelete
                                                }
                                                setIsConfirmDialogOpen={
                                                    setIsConfirmDialogOpen
                                                }
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            )
                        )
                    )}
                </div>
            </div>

            {isProjectModalOpen && (
                <ProjectModal
                    isOpen={isProjectModalOpen}
                    onClose={() => {
                        setIsProjectModalOpen(false);
                        setProjectToEdit(null);
                    }}
                    onSave={handleSaveProject}
                    onDelete={async (projectId) => {
                        try {
                            await deleteProject(projectId);
                            setProjects(
                                projects.filter(
                                    (p: Project) => p.id !== projectId
                                )
                            );
                            setIsProjectModalOpen(false);
                            setProjectToEdit(null);
                        } catch (error) {
                            console.error('Error deleting project:', error);
                        }
                    }}
                    project={projectToEdit || undefined}
                    areas={areas}
                />
            )}

            {isConfirmDialogOpen && (
                <ConfirmDialog
                    title={t('modals.deleteProject.title')}
                    message={t('modals.deleteProject.message', {
                        projectName: projectToDelete?.name,
                    })}
                    onConfirm={handleDeleteProject}
                    onCancel={() => setIsConfirmDialogOpen(false)}
                />
            )}
        </div>
    );
};

export default Projects;
