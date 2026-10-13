import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    EllipsisVerticalIcon,
    FolderIcon,
    FlagIcon,
    CheckCircleIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from './Shared/ConfirmDialog';
import AreaModal from './Area/AreaModal';
import NewItemButton from './Shared/NewItemButton';
import BlankSlate from './Shared/BlankSlate';
import IconSortDropdown from './Shared/IconSortDropdown';
import { SortOption } from './Shared/SortFilterButton';
import SortableItem from './Shared/SortableItem';
import { useToast } from './Shared/ToastContext';
import {
    mergeVisibleOrder,
    resetSortableCursor,
    sortableCursorHandlers,
    swallowNextClick,
    useSortableSensors,
} from './Shared/sortableList';
import { TASK_SHEET_CLASS } from './Task/taskSheet';
import { useCan } from '../hooks/useCan';
import { useStore } from '../store/useStore';
import {
    fetchAreas,
    createArea,
    updateArea,
    deleteArea,
    reorderAreas,
} from '../utils/areasService';
import { Area } from '../entities/Area';

const areaPath = (area: Area) =>
    area.uid
        ? `/area/${area.uid}-${area.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')}`
        : `/areas`;

const compareCustomOrder = (a: Area, b: Area) => {
    const posA = a.sort_position ?? null;
    const posB = b.sort_position ?? null;
    if (posA === null || posB === null) {
        if (posA !== posB) return posA === null ? -1 : 1;
        return a.name.localeCompare(b.name);
    }
    return posA - posB;
};

const compareAreas = (a: Area, b: Area, orderBy: string): number => {
    const [field, direction] = orderBy.split(':');
    if (field === 'custom') return compareCustomOrder(a, b);
    const sign = direction === 'desc' ? -1 : 1;
    let result: number;
    switch (field) {
        case 'projects':
            result = (a.projects_count ?? 0) - (b.projects_count ?? 0);
            break;
        case 'goals':
            result = (a.goals_count ?? 0) - (b.goals_count ?? 0);
            break;
        case 'tasks':
            result = (a.tasks_count ?? 0) - (b.tasks_count ?? 0);
            break;
        default:
            return sign * a.name.localeCompare(b.name);
    }
    return sign * result || a.name.localeCompare(b.name);
};

const Areas: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();

    // Use global store for consistency
    const { areas, loadAreas } = useStore((state: any) => state.areasStore);

    const canCreateAreas = useCan('create_projects');
    const [isAreaModalOpen, setIsAreaModalOpen] = useState<boolean>(false);
    const [selectedArea, setSelectedArea] = useState<Area | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);
    const [areaToDelete, setAreaToDelete] = useState<Area | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef<boolean>(false);
    const [orderBy, setOrderBy] = useState<string>(() => {
        try {
            return localStorage.getItem('areasSortOrder') || 'name:asc';
        } catch {
            return 'name:asc';
        }
    });
    const sensors = useSortableSensors();

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Force a fresh fetch on every visit so the goal/task/project counts
        // shown on the cards don't go stale after edits made elsewhere in the app.
        loadAreas(true);
    }, [loadAreas]);

    useEffect(() => {
        try {
            localStorage.setItem('areasSortOrder', orderBy);
        } catch {
            // Storage can be unavailable (private mode), sorting still works
        }
    }, [orderBy]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Skip if dropdown was just opened
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }

            const clickedElement = event.target as Node;
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(clickedElement)
            ) {
                setDropdownOpen(null);
            }
        };

        if (dropdownOpen !== null) {
            // Add a small delay to prevent immediate closing
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleSaveArea = async (areaData: Partial<Area>) => {
        try {
            useStore.getState().areasStore.setLoading(true);
            let result: Area;
            if (areaData.uid) {
                result = await updateArea(areaData.uid, {
                    name: areaData.name,
                    description: areaData.description,
                    color: areaData.color,
                });
                // Update the existing area in the list
                const currentAreas = useStore.getState().areasStore.areas;
                useStore
                    .getState()
                    .areasStore.setAreas(
                        currentAreas.map((area: any) =>
                            area.uid === result.uid ? result : area
                        )
                    );
            } else {
                result = await createArea({
                    name: areaData.name,
                    description: areaData.description,
                    color: areaData.color,
                });

                // Add the new area immediately to global state
                const currentAreas = useStore.getState().areasStore.areas;
                const newAreas = [...currentAreas, result];
                useStore.getState().areasStore.setAreas(newAreas);
            }

            // Close modal only on success
            setIsAreaModalOpen(false);
            setSelectedArea(null);
            useStore.getState().areasStore.setError(false);
        } catch (error) {
            console.error('Error saving area:', error);
            useStore.getState().areasStore.setError(true);
        } finally {
            useStore.getState().areasStore.setLoading(false);
        }
    };

    // One click from the blank slate: an area with just a name, no modal.
    const addPresetArea = async (name: string) => {
        const existing = useStore.getState().areasStore.areas;
        if (
            existing.some(
                (area: any) => area.name?.toLowerCase() === name.toLowerCase()
            )
        ) {
            return;
        }
        try {
            const result = await createArea({ name });
            useStore
                .getState()
                .areasStore.setAreas([
                    ...useStore.getState().areasStore.areas,
                    result,
                ]);
            useStore.getState().areasStore.setError(false);
        } catch (error) {
            console.error('Error creating area:', error);
            useStore.getState().areasStore.setError(true);
        }
    };

    const areaPresets = [
        t('areas.presetHome', 'Home'),
        t('areas.presetWork', 'Work'),
        t('areas.presetHealth', 'Health'),
        t('areas.presetFamily', 'Family'),
    ];

    const handleNewArea = () => {
        setSelectedArea(null);
        setIsAreaModalOpen(true);
    };

    const handleEditArea = (area: Area) => {
        setSelectedArea(area);
        setIsAreaModalOpen(true);
    };

    const openConfirmDialog = (area: Area) => {
        setAreaToDelete(area);
        setIsConfirmDialogOpen(true);
    };

    const handleDeleteArea = async () => {
        if (!areaToDelete) return;

        useStore.getState().areasStore.setLoading(true);
        try {
            await deleteArea(areaToDelete.uid!);
            // Remove the area from global state immediately
            const currentAreas = useStore.getState().areasStore.areas;
            useStore
                .getState()
                .areasStore.setAreas(
                    currentAreas.filter(
                        (area: any) => area.uid !== areaToDelete.uid
                    )
                );
            setIsConfirmDialogOpen(false);
            setAreaToDelete(null);
            useStore.getState().areasStore.setError(false);
        } catch (error) {
            console.error('Error deleting area:', error);
            useStore.getState().areasStore.setError(true);
        } finally {
            useStore.getState().areasStore.setLoading(false);
        }
    };

    const closeConfirmDialog = () => {
        setIsConfirmDialogOpen(false);
        setAreaToDelete(null);
    };

    const sortedAreas = [...areas].sort((a: Area, b: Area) =>
        compareAreas(a, b, orderBy)
    );

    const sortOptions: SortOption[] = [
        { value: 'name:asc', label: t('areas.sort.nameAsc', 'Name A to Z') },
        { value: 'name:desc', label: t('areas.sort.nameDesc', 'Name Z to A') },
        {
            value: 'projects:desc',
            label: t('areas.sort.projects', 'Most projects'),
        },
        { value: 'goals:desc', label: t('areas.sort.goals', 'Most goals') },
        { value: 'tasks:desc', label: t('areas.sort.tasks', 'Most tasks') },
        { value: 'custom:asc', label: t('areas.sort.custom', 'Custom order') },
    ];

    const isCustomOrder = orderBy.startsWith('custom:');

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        resetSortableCursor();
        if (!over || active.id === over.id) return;
        swallowNextClick();

        const visibleUids = sortedAreas.map((a: Area) => a.uid as string);
        const from = visibleUids.indexOf(active.id as string);
        const to = visibleUids.indexOf(over.id as string);
        if (from === -1 || to === -1) return;
        const movedVisible = arrayMove(visibleUids, from, to);

        const fullOrder = [...areas]
            .sort((a: Area, b: Area) => compareAreas(a, b, orderBy))
            .map((a: Area) => a.uid as string);
        const newOrder = mergeVisibleOrder(fullOrder, movedVisible);

        const positionByUid = new Map(newOrder.map((uid, i) => [uid, i]));
        const prevAreas = areas;
        useStore
            .getState()
            .areasStore.setAreas(
                areas.map((a: Area) =>
                    a.uid && positionByUid.has(a.uid)
                        ? { ...a, sort_position: positionByUid.get(a.uid) }
                        : a
                )
            );
        // Dragging under another sort starts a custom order from what is
        // on screen.
        const prevOrderBy = orderBy;
        if (!isCustomOrder) setOrderBy('custom:asc');
        try {
            await reorderAreas(newOrder);
        } catch (error) {
            console.error('Error saving area order:', error);
            useStore.getState().areasStore.setAreas(prevAreas);
            setOrderBy(prevOrderBy);
            showErrorToast(
                t('areas.reorderError', 'Failed to save area order')
            );
        }
    };

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full max-w-7xl mx-auto">
                {/* Areas Header */}
                <div className="flex items-center justify-between gap-2 mb-8">
                    <h2 className="text-2xl font-light">{t('areas.title')}</h2>
                    {canCreateAreas && (
                        <NewItemButton
                            label={t('areas.new', 'New Area')}
                            onClick={handleNewArea}
                            testId="new-area-button"
                        />
                    )}
                </div>

                {areas.length === 0 ? (
                    <BlankSlate
                        title={t('areas.noAreasYet', 'No areas yet.')}
                        hint={t(
                            'areas.blankSlateHint',
                            'Areas are the parts of your life you keep up over time, like Work, Health or Home. Put your projects and goals in them to see each part in one place.'
                        )}
                        actions={[
                            ...(canCreateAreas
                                ? [
                                      {
                                          label: t(
                                              'areas.blankSlateNew',
                                              'Create your first area'
                                          ),
                                          icon: PlusIcon,
                                          onClick: handleNewArea,
                                      },
                                  ]
                                : []),
                            {
                                label: t(
                                    'areas.blankSlateProjects',
                                    'Go to projects'
                                ),
                                icon: FolderIcon,
                                to: '/projects',
                            },
                        ]}
                        presetsLabel={
                            canCreateAreas
                                ? t(
                                      'areas.presetsLabel',
                                      'Most people start with'
                                  )
                                : undefined
                        }
                        presets={
                            canCreateAreas
                                ? areaPresets.map((name) => ({
                                      label: name,
                                      onClick: () => addPresetArea(name),
                                      testId: `area-preset-${name.toLowerCase()}`,
                                  }))
                                : []
                        }
                    />
                ) : (
                    <>
                        <div className="flex justify-end mb-4">
                            <IconSortDropdown
                                options={sortOptions}
                                value={orderBy}
                                onChange={setOrderBy}
                                ariaLabel={t('areas.sort.label', 'Sort areas')}
                                title={t('areas.sort.label', 'Sort areas')}
                                dropdownLabel={t(
                                    'areas.sort.label',
                                    'Sort areas'
                                )}
                                align="right"
                            />
                        </div>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            {...sortableCursorHandlers}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={sortedAreas.map(
                                    (a: Area) => a.uid as string
                                )}
                                strategy={verticalListSortingStrategy}
                            >
                                <div
                                    className={`task-list-container overflow-visible ${TASK_SHEET_CLASS} task-sheet-rails`}
                                >
                                    {sortedAreas.map((area: Area) => (
                                        <SortableItem
                                            key={area.uid}
                                            id={area.uid as string}
                                            label={area.name}
                                            roleDescription={t(
                                                'sortable.area',
                                                'sortable area'
                                            )}
                                            testIdPrefix="sortable-area"
                                        >
                                            <div
                                                className={`relative flex items-center gap-4 -ml-1.5 py-2.5 pl-[2.375rem] pr-2 border-l-4 border-gray-300 dark:border-gray-600 group ${
                                                    dropdownOpen === area.uid
                                                        ? 'z-50'
                                                        : ''
                                                }`}
                                                style={{
                                                    borderLeftColor:
                                                        area.color || undefined,
                                                }}
                                            >
                                                <Link
                                                    to={areaPath(area)}
                                                    className="flex-1 min-w-0"
                                                >
                                                    <h3 className="text-[15px] font-normal tracking-tight text-gray-900 dark:text-gray-100 truncate">
                                                        {area.name}
                                                    </h3>
                                                    {area.description && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                            {area.description}
                                                        </p>
                                                    )}
                                                </Link>

                                                <div className="hidden md:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 justify-end">
                                                    <span className="flex items-center gap-1">
                                                        <FolderIcon className="h-3.5 w-3.5" />
                                                        {area.projects_count ??
                                                            0}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <FlagIcon className="h-3.5 w-3.5" />
                                                        {area.goals_count ?? 0}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircleIcon className="h-3.5 w-3.5" />
                                                        {area.tasks_count ?? 0}
                                                    </span>
                                                </div>

                                                {/* Three Dots Dropdown */}
                                                <div
                                                    className="relative flex-shrink-0"
                                                    ref={dropdownRef}
                                                >
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const newDropdownState =
                                                                dropdownOpen ===
                                                                area.uid
                                                                    ? null
                                                                    : area.uid!;
                                                            if (
                                                                newDropdownState !==
                                                                null
                                                            ) {
                                                                justOpenedRef.current = true;
                                                            }
                                                            setDropdownOpen(
                                                                newDropdownState
                                                            );
                                                        }}
                                                        className="focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                        aria-label={t(
                                                            'areas.toggleDropdownMenu'
                                                        )}
                                                        data-testid={`area-dropdown-${area.uid}`}
                                                    >
                                                        <EllipsisVerticalIcon className="h-4 w-4" />
                                                    </button>

                                                    {dropdownOpen ===
                                                        area.uid && (
                                                        <div className="absolute right-0 top-full mt-1 w-28 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                                            <button
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleEditArea(
                                                                        area
                                                                    );
                                                                    setDropdownOpen(
                                                                        null
                                                                    );
                                                                }}
                                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                                                data-testid={`area-edit-${area.uid}`}
                                                            >
                                                                {t(
                                                                    'areas.edit',
                                                                    'Edit'
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    openConfirmDialog(
                                                                        area
                                                                    );
                                                                    setDropdownOpen(
                                                                        null
                                                                    );
                                                                }}
                                                                className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                                                data-testid={`area-delete-${area.uid}`}
                                                            >
                                                                {t(
                                                                    'areas.delete',
                                                                    'Delete'
                                                                )}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </SortableItem>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </>
                )}

                {/* AreaModal */}
                {isAreaModalOpen && (
                    <AreaModal
                        isOpen={isAreaModalOpen}
                        onClose={() => setIsAreaModalOpen(false)}
                        onSave={handleSaveArea}
                        onDelete={async (areaUid: string) => {
                            try {
                                await deleteArea(areaUid);
                                const updatedAreas = await fetchAreas();
                                useStore
                                    .getState()
                                    .areasStore.setAreas(updatedAreas);
                                setIsAreaModalOpen(false);
                                setSelectedArea(null);
                            } catch (error) {
                                console.error(
                                    'Error deleting area from modal:',
                                    error
                                );
                                useStore.getState().areasStore.setError(true);
                            }
                        }}
                        area={selectedArea}
                    />
                )}

                {/* ConfirmDialog */}
                {isConfirmDialogOpen && areaToDelete && (
                    <ConfirmDialog
                        title={t('modals.deleteArea.title')}
                        message={`Are you sure you want to delete the area "${areaToDelete.name}"?`}
                        onConfirm={handleDeleteArea}
                        onCancel={closeConfirmDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default Areas;
