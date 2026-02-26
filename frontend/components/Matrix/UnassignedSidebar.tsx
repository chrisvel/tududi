import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MatrixTask } from '../../entities/Matrix';
import DraggableTask from './DraggableTask';
import { useTranslation } from 'react-i18next';
import { useMatrixStore, SidebarCategory } from '../../store/useMatrixStore';
import { useStore } from '../../store/useStore';
import { browseMatrixTasks, BrowseSource } from '../../utils/matrixService';
import {
    FolderIcon,
    RectangleGroupIcon,
    TagIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface UnassignedSidebarProps {
    /** Tasks already unassigned (from matrix detail) - used as drop zone fallback */
    tasks: MatrixTask[];
    /** Matrix ID for the browse API */
    matrixId: number;
    /** Reload counter — incremented when matrix data changes to re-fetch browse */
    reloadTrigger?: number;
}

const CATEGORIES: { key: SidebarCategory; icon: React.ElementType; labelKey: string; fallback: string }[] = [
    { key: 'project', icon: FolderIcon, labelKey: 'matrix.sidebar.categoryProjects', fallback: 'Projects' },
    { key: 'area', icon: RectangleGroupIcon, labelKey: 'matrix.sidebar.categoryAreas', fallback: 'Areas' },
    { key: 'tag', icon: TagIcon, labelKey: 'matrix.sidebar.categoryTags', fallback: 'Tags' },
];

const UnassignedSidebar: React.FC<UnassignedSidebarProps> = ({ tasks, matrixId, reloadTrigger }) => {
    const { t } = useTranslation();
    const {
        sidebarSearchQuery,
        setSidebarSearchQuery,
        sidebarCategory,
        setSidebarCategory,
        sidebarSourceId,
        setSidebarSourceId,
    } = useMatrixStore();

    // Use specific selectors to avoid re-renders from unrelated store changes
    const projects = useStore((s) => s.projectsStore.projects);
    const areas = useStore((s) => s.areasStore.areas);
    const tags = useStore((s) => s.tagsStore.tags);
    const areasHasLoaded = useStore((s) => s.areasStore.hasLoaded);
    const tagsHasLoaded = useStore((s) => s.tagsStore.hasLoaded);
    const loadAreas = useStore((s) => s.areasStore.loadAreas);
    const loadTags = useStore((s) => s.tagsStore.loadTags);

    // Load areas and tags only if they haven't been loaded yet
    useEffect(() => {
        if (!areasHasLoaded) loadAreas();
        if (!tagsHasLoaded) loadTags();
    }, [areasHasLoaded, tagsHasLoaded, loadAreas, loadTags]);

    // Browse results from the API
    const [browsedTasks, setBrowsedTasks] = useState<MatrixTask[]>([]);
    const [isLoadingBrowse, setIsLoadingBrowse] = useState(false);

    // Fetch tasks when category + sourceId change
    useEffect(() => {
        if (!sidebarCategory || !sidebarSourceId) {
            setBrowsedTasks([]);
            return;
        }

        let cancelled = false;
        setIsLoadingBrowse(true);

        browseMatrixTasks(matrixId, sidebarCategory as BrowseSource, sidebarSourceId)
            .then((result) => {
                if (!cancelled) {
                    setBrowsedTasks(result.data);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setBrowsedTasks([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingBrowse(false);
                }
            });

        return () => { cancelled = true; };
    }, [matrixId, sidebarCategory, sidebarSourceId, reloadTrigger]);

    // Get items for the secondary dropdown based on selected category
    const sourceItems = useMemo(() => {
        switch (sidebarCategory) {
            case 'project':
                return (projects || [])
                    .filter((p) => p.status !== 'done' && p.status !== 'cancelled')
                    .map((p) => ({ id: String(p.id!), name: p.name }));
            case 'area':
                return (areas || [])
                    .filter((a) => a.active !== false)
                    .map((a) => ({ id: String(a.id!), name: a.name }));
            case 'tag':
                return (tags || []).map((tag) => ({ id: tag.uid!, name: tag.name }));
            default:
                return [];
        }
    }, [sidebarCategory, projects, areas, tags]);

    // Filter browsed tasks by search query
    const filteredTasks = useMemo(() => {
        const source = browsedTasks;
        if (!sidebarSearchQuery.trim()) return source;
        const q = sidebarSearchQuery.toLowerCase();
        return source.filter(
            (task) =>
                task.name.toLowerCase().includes(q) ||
                task.tags?.some((tag) => tag.name.toLowerCase().includes(q))
        );
    }, [browsedTasks, sidebarSearchQuery]);

    // Make sidebar a droppable zone for removing tasks from quadrants
    const { isOver, setNodeRef } = useDroppable({
        id: 'unassigned-sidebar',
        data: { quadrantIndex: -1 },
    });

    const handleCategoryClick = useCallback((cat: SidebarCategory) => {
        if (sidebarCategory === cat) {
            // Toggle off
            setSidebarCategory(null);
        } else {
            setSidebarCategory(cat);
        }
    }, [sidebarCategory, setSidebarCategory]);

    const placeholderForCategory = useMemo(() => {
        switch (sidebarCategory) {
            case 'project': return t('matrix.sidebar.selectProject', 'Select project...');
            case 'area': return t('matrix.sidebar.selectArea', 'Select area...');
            case 'tag': return t('matrix.sidebar.selectTag', 'Select tag...');
            default: return '';
        }
    }, [sidebarCategory, t]);

    const hasSelection = sidebarCategory && sidebarSourceId;

    return (
        <div
            ref={setNodeRef}
            className={`w-full lg:w-72 xl:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col transition-colors ${
                isOver ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
            }`}
        >
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                    {t('matrix.sidebar.browseTitle', 'Browse Tasks')}
                </h3>

                {/* Category tabs */}
                <div className="flex gap-1 mb-2.5">
                    {CATEGORIES.map(({ key, icon: Icon, labelKey, fallback }) => (
                        <button
                            key={key}
                            onClick={() => handleCategoryClick(key)}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                sidebarCategory === key
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="truncate">{t(labelKey, fallback)}</span>
                        </button>
                    ))}
                </div>

                {/* Secondary dropdown — select specific item */}
                {sidebarCategory && (
                    <select
                        value={sidebarSourceId ?? ''}
                        onChange={(e) =>
                            setSidebarSourceId(e.target.value || null)
                        }
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 mb-2"
                    >
                        <option value="">{placeholderForCategory}</option>
                        {sourceItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                )}

                {/* Search within results */}
                {hasSelection && (
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={sidebarSearchQuery}
                            onChange={(e) => setSidebarSearchQuery(e.target.value)}
                            placeholder={t('matrix.sidebar.search', 'Search tasks...')}
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                )}
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-1.5 max-h-[250px] lg:max-h-none">
                {!sidebarCategory ? (
                    // No category selected
                    <div className="text-center py-8 px-3">
                        <RectangleGroupIcon className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('matrix.sidebar.selectCategory', 'Select a category above to browse tasks')}
                        </p>
                    </div>
                ) : !sidebarSourceId ? (
                    // Category selected but no specific item
                    <div className="text-center py-8 px-3">
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {placeholderForCategory}
                        </p>
                    </div>
                ) : isLoadingBrowse ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('common.loading', 'Loading...')}
                        </p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                        {browsedTasks.length === 0
                            ? t('matrix.sidebar.empty', 'All tasks have been placed')
                            : t('search.noResults', 'No results found')}
                    </p>
                ) : (
                    <>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                            {filteredTasks.length} {t('matrix.sidebar.taskCount', 'tasks')}
                        </p>
                        {filteredTasks.map((task) => (
                            <DraggableTask key={task.id} task={task} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default UnassignedSidebar;
