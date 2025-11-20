import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import ProjectShareModal from './Project/ProjectShareModal';
import { useToast } from './Shared/ToastContext';

const Projects: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
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

    // Try using a ref to avoid React state conflicts
    const modalStateRef = useRef({
        isOpen: false,
        projectToEdit: null as Project | null,
    });
    const [modalState, setModalState] = useState({
        isOpen: false,
        projectToEdit: null as Project | null,
    });
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(
        null
    );
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [shareModal, setShareModal] = useState<{
        isOpen: boolean;
        project: Project | null;
    }>({ isOpen: false, project: null });
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
        const saved = localStorage.getItem('projectsViewMode');
        return saved === 'list' || saved === 'cards' ? saved : 'cards';
    });
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');

    const [searchParams, setSearchParams] = useSearchParams();
    const stateFilter = searchParams.get('state') || 'all';

    // Get area UID from URL parameters
    const getAreaUidFromParams = () => {
        const areaParam = searchParams.get('area');

        if (areaParam) {
            // Extract area UID from the area parameter (format: uid-name-slug or just uid)
            return areaParam.split('-')[0];
        }

        return '';
    };

    // Sort options for the filter button
    const sortOptions: SortOption[] = [
        { value: 'created_at:desc', label: t('sort.created_at', 'Created At') },
        { value: 'name:asc', label: t('sort.name', 'Name') },
        { value: 'due_date_at:asc', label: t('sort.due_date', 'Due Date') },
        { value: 'updated_at:desc', label: t('common.updated', 'Updated') },
    ];

    // Filter options for dropdowns
    const statusOptions: FilterOption[] = [
        { value: 'all', label: t('projects.filters.all') },
        { value: 'idea', label: t('projects.states.idea', 'Idea') },
        { value: 'planned', label: t('projects.states.planned', 'Planned') },
        {
            value: 'in_progress',
            label: t('projects.states.in_progress', 'In Progress'),
        },
        { value: 'blocked', label: t('projects.states.blocked', 'Blocked') },
        {
            value: 'completed',
            label: t('projects.states.completed', 'Completed'),
        },
    ];

    const areaOptions: FilterOption[] = [
        { value: '', label: t('projects.filters.allAreas') },
        ...areas.map((area) => ({
            value: area.uid,
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

    // Persist viewMode to localStorage
    useEffect(() => {
        localStorage.setItem('projectsViewMode', viewMode);
    }, [viewMode]);

    // Projects are now loaded by Layout component into global store

    // Modal state tracking removed after fixing the issue

    // Handle click outside to close dropdown and escape key
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeDropdown === null) return;

            const target = event.target as Element;

            // Check if clicking inside any dropdown container
            const isInsideDropdown = target.closest('.dropdown-container');

            if (!isInsideDropdown) {
                setActiveDropdown(null);
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && activeDropdown !== null) {
                setActiveDropdown(null);
            }
        };

        if (activeDropdown !== null) {
            document.addEventListener('click', handleClickOutside, true);
            document.addEventListener('keydown', handleEscapeKey);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside, true);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [activeDropdown]);

    // Handle sort change
    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
    };

    const handleSaveProject = async (project: Project) => {
        setProjectsLoading(true);
        try {
            if (project.uid) {
                await updateProject(project.uid, project);
            } else {
                await createProject(project);
            }
            // Fetch all projects without filters to keep global store complete
            const projectsData = await fetchProjects('all', '');
            setProjects(projectsData);
        } catch (error) {
            console.error('Error saving project:', error);
            setProjectsError(true);
        } finally {
            setProjectsLoading(false);
            setModalState({ isOpen: false, projectToEdit: null });
        }
    };

    const handleEditProject = (project: Project) => {
        modalStateRef.current = {
            isOpen: true,
            projectToEdit: project,
        };
        setModalState({
            isOpen: true,
            projectToEdit: project,
        });
    };

    const handleDeleteProject = async () => {
        if (!projectToDelete) return;

        try {
            if (projectToDelete.uid !== undefined) {
                setProjectsLoading(true);
                await deleteProject(projectToDelete.uid);

                // Fetch all projects without filters to keep global store complete
                const projectsData = await fetchProjects('all', '');
                setProjects(projectsData);
            } else {
                console.error('Cannot delete project: UID is undefined.');
            }
        } catch (error: any) {
            console.error('Error deleting project:', error);
            // Show permission denied if 403-like message, else generic
            const msg =
                typeof error?.message === 'string' &&
                /403|Forbidden|permission/i.test(error.message)
                    ? t('errors.permissionDenied', 'Permission denied')
                    : t('projects.deleteError', 'Failed to delete project');
            showErrorToast(msg);
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

    const handleStateFilterChange = (value: string) => {
        const params = new URLSearchParams(searchParams);

        if (value === 'all') {
            params.delete('state');
        } else {
            params.set('state', value);
        }
        setSearchParams(params);
    };

    const handleAreaFilterChange = (value: string) => {
        const params = new URLSearchParams(searchParams);

        params.delete('area');

        if (value !== '') {
            params.set('area', value);
        }

        setSearchParams(params);
    };

    // Update the area filter when areas are loaded (to handle area UID lookups)
    const actualAreaFilter = useMemo(() => {
        return getAreaUidFromParams();
    }, [searchParams, areas]);

    // Filter, sort and search projects
    const displayProjects = useMemo(() => {
        let filteredProjects = [...projects];

        // Apply state filter
        if (stateFilter !== 'all') {
            filteredProjects = filteredProjects.filter(
                (project) => project.state === stateFilter
            );
        }

        // Apply area filter by UID
        if (actualAreaFilter) {
            filteredProjects = filteredProjects.filter((project) => {
                const projectArea = project.area || (project as any).Area;
                return projectArea?.uid === actualAreaFilter;
            });
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
    }, [projects, stateFilter, actualAreaFilter, searchQuery, orderBy]);

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
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
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
                                value={stateFilter}
                                onChange={handleStateFilterChange}
                                size="desktop"
                                autoWidth={true}
                            />
                        </div>

                        {/* Area Filter */}
                        <div className="w-full md:w-auto mb-4 md:mb-0">
                            <FilterDropdown
                                options={areaOptions}
                                value={actualAreaFilter}
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
                                onOpenShare={(p) =>
                                    setShareModal({ isOpen: true, project: p })
                                }
                            />
                        ))
                    )}
                </div>
            </div>

            {modalState.isOpen && (
                <ProjectModal
                    isOpen={modalState.isOpen}
                    onClose={() => {
                        setModalState({ isOpen: false, projectToEdit: null });
                    }}
                    onSave={handleSaveProject}
                    onDelete={async (projectUid) => {
                        try {
                            await deleteProject(projectUid);

                            // Update both local and global state
                            const updatedProjects = projects.filter(
                                (p: Project) => p.uid !== projectUid
                            );
                            setProjects(updatedProjects);

                            setModalState({
                                isOpen: false,
                                projectToEdit: null,
                            });
                        } catch (error) {
                            console.error('Error deleting project:', error);
                        }
                    }}
                    project={modalState.projectToEdit || undefined}
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

            {shareModal.isOpen && shareModal.project && (
                <ProjectShareModal
                    isOpen={shareModal.isOpen}
                    onClose={() =>
                        setShareModal({ isOpen: false, project: null })
                    }
                    project={shareModal.project}
                />
            )}
        </div>
    );
};

export default Projects;
