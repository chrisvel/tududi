import React, { useState, useEffect, useMemo } from 'react';
import {
    MagnifyingGlassIcon,
    Squares2X2Icon,
    Bars3Icon,
} from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import ProjectModal from './Project/ProjectModal';
import SortFilter from './Shared/SortFilter';
import FilterDropdown, { FilterOption } from './Shared/FilterDropdown';
import { useStore } from '../store/useStore';
import {
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
} from '../utils/projectsService';
import { fetchAreas } from '../utils/areasService';
import { useTranslation } from 'react-i18next';
import { SortOption } from './Shared/SortFilterButton';

import { Project } from '../entities/Project';
import { useSearchParams } from 'react-router-dom';
import ProjectItem from './Project/ProjectItem';

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
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');

    const [searchParams, setSearchParams] = useSearchParams();
    const activeFilter = searchParams.get('active') || 'all';
    const areaFilter = searchParams.get('area_id') || '';

    // Sort options for the filter button
    const sortOptions: SortOption[] = [
        { value: 'created_at:desc', label: 'Created at' },
        { value: 'name:asc', label: 'Name' },
        { value: 'due_date_at:asc', label: 'Due date' },
        { value: 'updated_at:desc', label: 'Updated at' },
    ];

    // Filter options for dropdowns
    const statusOptions: FilterOption[] = [
        { value: 'all', label: t('projects.filters.all') },
        { value: 'true', label: t('projects.filters.active') },
        { value: 'false', label: t('projects.filters.inactive') },
    ];

    const areaOptions: FilterOption[] = [
        { value: '', label: t('projects.filters.allAreas') },
        ...areas.map((area) => ({
            value: area.id?.toString() || '',
            label: area.name,
        })),
    ];

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
                const projectsData = await fetchProjects();
                setProjects(projectsData);
            } catch (error) {
                console.error('Failed to fetch projects:', error);
                setProjectsError(true);
            }
        };

        loadProjects();
    }, []);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            // Check if the click is on a dropdown or its children
            const dropdownElement = target.closest('.dropdown-container');
            if (!dropdownElement && activeDropdown !== null) {
                setActiveDropdown(null);
            }
        };

        if (activeDropdown !== null) {
            // Use setTimeout to avoid immediate triggering
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeDropdown]);

    // Handle sort change
    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
    };

    const handleSaveProject = async (project: Project) => {
        setProjectsLoading(true);
        try {
            if (project.id) {
                await updateProject(project.id, project);
            } else {
                await createProject(project);
            }
            const projectsData = await fetchProjects();
            setProjects(projectsData);
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

                // Update global state
                const projectsData = await fetchProjects();
                setProjects(projectsData);
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

    const handleActiveFilterChange = (value: string) => {
        const params = new URLSearchParams(searchParams);

        if (value === 'all') {
            params.delete('active');
        } else {
            params.set('active', value);
        }
        setSearchParams(params);
    };

    const handleAreaFilterChange = (value: string) => {
        const params = new URLSearchParams(searchParams);

        if (value === '') {
            params.delete('area_id');
        } else {
            params.set('area_id', value);
        }

        setSearchParams(params);
    };

    // Filter, sort and search projects
    const displayProjects = useMemo(() => {
        let filteredProjects = [...projects];

        // Apply active filter
        if (activeFilter !== 'all') {
            const isActive = activeFilter === 'true';
            filteredProjects = filteredProjects.filter(
                (project) => project.active === isActive
            );
        }

        // Apply area filter
        if (areaFilter) {
            const areaId = parseInt(areaFilter);
            filteredProjects = filteredProjects.filter(
                (project) => project.area_id === areaId
            );
        }

        // Apply search filter
        if (searchQuery.trim()) {
            filteredProjects = filteredProjects.filter(
                (project) =>
                    project.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                    (project.description &&
                        project.description
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()))
            );
        }

        // Apply sorting
        filteredProjects.sort((a, b) => {
            const [field, direction] = orderBy.split(':');
            const isAsc = direction === 'asc';

            let valueA, valueB;

            switch (field) {
                case 'name':
                    valueA = a.name?.toLowerCase() || '';
                    valueB = b.name?.toLowerCase() || '';
                    break;
                case 'due_date_at':
                    valueA = a.due_date_at
                        ? new Date(a.due_date_at).getTime()
                        : 0;
                    valueB = b.due_date_at
                        ? new Date(b.due_date_at).getTime()
                        : 0;
                    break;
                case 'updated_at':
                    valueA = a.updated_at
                        ? new Date(a.updated_at).getTime()
                        : 0;
                    valueB = b.updated_at
                        ? new Date(b.updated_at).getTime()
                        : 0;
                    break;
                case 'created_at':
                default:
                    valueA = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    valueB = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;
                    break;
            }

            if (valueA < valueB) return isAsc ? -1 : 1;
            if (valueA > valueB) return isAsc ? 1 : -1;
            return 0;
        });

        return filteredProjects;
    }, [projects, activeFilter, areaFilter, searchQuery, orderBy]);

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
                            onClick={() =>
                                setIsSearchExpanded(!isSearchExpanded)
                            }
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
                        {/* Status Filter */}
                        <div className="w-full md:w-auto mb-4 md:mb-0">
                            <FilterDropdown
                                options={statusOptions}
                                value={activeFilter}
                                onChange={handleActiveFilterChange}
                                size="desktop"
                                autoWidth={true}
                            />
                        </div>

                        {/* Area Filter */}
                        <div className="w-full md:w-auto mb-4 md:mb-0">
                            <FilterDropdown
                                options={areaOptions}
                                value={areaFilter}
                                onChange={handleAreaFilterChange}
                                size="desktop"
                                autoWidth={true}
                            />
                        </div>

                        {/* Sort Filter Button */}
                        <SortFilter
                            sortOptions={sortOptions}
                            sortValue={orderBy}
                            onSortChange={handleSortChange}
                        />
                    </div>
                </div>

                {/* Collapsible Search Bar */}
                <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isSearchExpanded
                            ? 'max-h-20 opacity-100 mb-4'
                            : 'max-h-0 opacity-0 mb-0'
                    }`}
                >
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
                    {displayProjects.length === 0 ? (
                        <div className="text-gray-700 dark:text-gray-300">
                            {t('projects.noProjectsFound')}
                        </div>
                    ) : (
                        displayProjects.map((project) => (
                            <ProjectItem
                                key={project.id}
                                project={project}
                                viewMode={viewMode}
                                getCompletionPercentage={() =>
                                    getCompletionPercentage(project)
                                }
                                activeDropdown={activeDropdown}
                                setActiveDropdown={setActiveDropdown}
                                handleEditProject={handleEditProject}
                                setProjectToDelete={setProjectToDelete}
                                setIsConfirmDialogOpen={setIsConfirmDialogOpen}
                            />
                        ))
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

                            // Update both local and global state
                            const updatedProjects = projects.filter(
                                (p: Project) => p.id !== projectId
                            );
                            setProjects(updatedProjects);

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
