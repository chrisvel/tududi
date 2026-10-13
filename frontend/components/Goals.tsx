import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import ConfirmDialog from './Shared/ConfirmDialog';
import NewItemButton from './Shared/NewItemButton';
import BlankSlate from './Shared/BlankSlate';
import { useCan } from '../hooks/useCan';
import { useStore } from '../store/useStore';
import { deleteGoal, reorderGoals } from '../utils/goalsService';
import { Goal } from '../entities/Goal';
import { Area } from '../entities/Area';
import GoalModal from './Goal/GoalModal';
import GoalRow from './Goal/GoalRow';
import IconSortDropdown from './Shared/IconSortDropdown';
import { TASK_SHEET_CLASS } from './Task/taskSheet';
import SortableItem from './Shared/SortableItem';
import { useToast } from './Shared/ToastContext';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    mergeVisibleOrder,
    resetSortableCursor,
    sortableCursorHandlers,
    swallowNextClick,
    useSortableSensors,
} from './Shared/sortableList';
import { SortOption } from './Shared/SortFilterButton';

const GOAL_STATUS_ORDER: Record<string, number> = {
    active: 0,
    paused: 1,
    achieved: 2,
    dropped: 3,
};

const projectsCountOf = (goal: Goal) =>
    (goal as any).projects_count ?? goal.Projects?.length ?? 0;

const tasksCountOf = (goal: Goal) =>
    (goal as any).tasks_count ?? goal.Tasks?.length ?? 0;

const compareCustomOrder = (a: Goal, b: Goal) => {
    const posA = a.sort_position ?? null;
    const posB = b.sort_position ?? null;
    if (posA === null || posB === null) {
        if (posA !== posB) return posA === null ? -1 : 1;
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdB - createdA;
    }
    return posA - posB;
};

const compareGoals = (a: Goal, b: Goal, orderBy: string): number => {
    const [field, direction] = orderBy.split(':');
    if (field === 'custom') return compareCustomOrder(a, b);
    const sign = direction === 'desc' ? -1 : 1;
    let result: number;
    switch (field) {
        case 'status':
            result = GOAL_STATUS_ORDER[a.status] - GOAL_STATUS_ORDER[b.status];
            break;
        case 'horizon':
            result = a.horizon.localeCompare(b.horizon);
            break;
        case 'area':
            result = (a.Area?.name ?? '').localeCompare(b.Area?.name ?? '');
            break;
        case 'projects':
            result = projectsCountOf(a) - projectsCountOf(b);
            break;
        case 'tasks':
            result = tasksCountOf(a) - tasksCountOf(b);
            break;
        default:
            return sign * a.title.localeCompare(b.title);
    }
    return sign * result || a.title.localeCompare(b.title);
};

const Goals: React.FC = () => {
    const { t } = useTranslation();

    const {
        goals,
        isLoading: loading,
        hasLoaded,
        loadGoals,
    } = useStore((state: any) => state.goalsStore);

    const setGoals = useStore((state: any) => state.goalsStore.setGoals);
    const { showErrorToast } = useToast();
    const sensors = useSortableSensors();

    const areas: Area[] = useStore((state: any) => state.areasStore.areas);
    const areasLoaded = useStore((state: any) => state.areasStore.hasLoaded);
    const loadAreas = useStore((state: any) => state.areasStore.loadAreas);

    const canCreateGoals = useCan('create_projects');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedAreaUid, setSelectedAreaUid] = useState<string | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);
    const [orderBy, setOrderBy] = useState<string>(() => {
        try {
            return localStorage.getItem('goalsSortOrder') || 'title:asc';
        } catch {
            return 'title:asc';
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('goalsSortOrder', orderBy);
        } catch {
            // Storage can be unavailable (private mode), sorting still works
        }
    }, [orderBy]);

    const sortOptions: SortOption[] = [
        { value: 'title:asc', label: t('goals.sort.titleAsc', 'Title A to Z') },
        {
            value: 'title:desc',
            label: t('goals.sort.titleDesc', 'Title Z to A'),
        },
        { value: 'status:asc', label: t('goals.sort.status', 'Status') },
        { value: 'horizon:asc', label: t('goals.sort.horizon', 'Horizon') },
        { value: 'area:asc', label: t('goals.sort.area', 'Area') },
        {
            value: 'projects:desc',
            label: t('goals.sort.projects', 'Most projects'),
        },
        { value: 'tasks:desc', label: t('goals.sort.tasks', 'Most tasks') },
        { value: 'custom:asc', label: t('goals.sort.custom', 'Custom order') },
    ];

    useEffect(() => {
        if (!hasLoaded && !loading) loadGoals();
    }, [hasLoaded, loading, loadGoals]);

    useEffect(() => {
        if (!areasLoaded) loadAreas();
    }, [areasLoaded, loadAreas]);

    const handleDeleteGoal = async () => {
        if (!goalToDelete?.uid) return;
        await deleteGoal(goalToDelete.uid);
        const current = useStore.getState().goalsStore.goals;
        useStore
            .getState()
            .goalsStore.setGoals(
                current.filter((g: Goal) => g.uid !== goalToDelete.uid)
            );
        setIsConfirmDialogOpen(false);
        setGoalToDelete(null);
    };

    const openConfirmDelete = (goal: Goal) => {
        setGoalToDelete(goal);
        setIsConfirmDialogOpen(true);
    };

    // Derive areas that actually have goals
    const areasWithGoals = areas.filter((a) =>
        goals.some(
            (g: Goal) => g.area_id === a.id || (g.Area && g.Area.uid === a.uid)
        )
    );

    const filteredGoals = selectedAreaUid
        ? goals.filter((g: Goal) => g.Area?.uid === selectedAreaUid)
        : goals;

    const sortedGoals = [...filteredGoals].sort((a: Goal, b: Goal) =>
        compareGoals(a, b, orderBy)
    );

    const isCustomOrder = orderBy.startsWith('custom:');

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        resetSortableCursor();
        if (!over || active.id === over.id) return;
        swallowNextClick();

        const visibleUids = sortedGoals.map((g: Goal) => g.uid as string);
        const from = visibleUids.indexOf(active.id as string);
        const to = visibleUids.indexOf(over.id as string);
        if (from === -1 || to === -1) return;
        const movedVisible = arrayMove(visibleUids, from, to);

        const fullOrder = [...goals]
            .sort((a: Goal, b: Goal) => compareGoals(a, b, orderBy))
            .map((g: Goal) => g.uid as string);
        const newOrder = mergeVisibleOrder(fullOrder, movedVisible);

        const positionByUid = new Map(newOrder.map((uid, i) => [uid, i]));
        const prevGoals = goals;
        setGoals(
            goals.map((g: Goal) =>
                g.uid && positionByUid.has(g.uid)
                    ? { ...g, sort_position: positionByUid.get(g.uid) }
                    : g
            )
        );
        // Dragging under another sort starts a custom order from what is
        // on screen.
        const prevOrderBy = orderBy;
        if (!isCustomOrder) setOrderBy('custom:asc');
        try {
            await reorderGoals(newOrder);
        } catch (error) {
            console.error('Error saving goal order:', error);
            setGoals(prevGoals);
            setOrderBy(prevOrderBy);
            showErrorToast(
                t('goals.reorderError', 'Failed to save goal order')
            );
        }
    };

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full max-w-7xl mx-auto">
                <div className="flex items-center justify-between gap-2 mb-6">
                    <h2 className="text-2xl font-light">
                        {t('goals.title', 'Goals')}
                    </h2>
                    {canCreateGoals && (
                        <NewItemButton
                            label={t('goals.newGoal', 'New Goal')}
                            onClick={() => setIsCreateOpen(true)}
                            testId="new-goal-button"
                        />
                    )}
                </div>

                {/* Area filter tabs and sort */}
                {goals.length > 0 && (
                    <div className="flex items-start justify-between gap-2 mb-6">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedAreaUid(null)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                    selectedAreaUid === null
                                        ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                {t('common.all', 'All')}
                            </button>
                            {areasWithGoals.map((area) => (
                                <button
                                    key={area.uid}
                                    onClick={() =>
                                        setSelectedAreaUid(
                                            area.uid === selectedAreaUid
                                                ? null
                                                : area.uid!
                                        )
                                    }
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        selectedAreaUid === area.uid
                                            ? 'text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                    }`}
                                    style={
                                        selectedAreaUid === area.uid &&
                                        area.color
                                            ? { backgroundColor: area.color }
                                            : selectedAreaUid === area.uid
                                              ? { backgroundColor: '#374151' }
                                              : {}
                                    }
                                >
                                    {area.name}
                                </button>
                            ))}
                        </div>
                        <IconSortDropdown
                            options={sortOptions}
                            value={orderBy}
                            onChange={setOrderBy}
                            ariaLabel={t('goals.sort.label', 'Sort goals')}
                            title={t('goals.sort.label', 'Sort goals')}
                            dropdownLabel={t('goals.sort.label', 'Sort goals')}
                            align="right"
                        />
                    </div>
                )}

                {filteredGoals.length === 0 ? (
                    hasLoaded && (
                        <BlankSlate
                            title={t('goals.noGoalsYet', 'No goals yet.')}
                            hint={t(
                                'goals.blankSlateHint',
                                'A goal is an outcome you want to reach this season or this year, like running a half marathon. Link projects to it to see the work that gets you there.'
                            )}
                            actions={
                                canCreateGoals
                                    ? [
                                          {
                                              label: t(
                                                  'goals.blankSlateNew',
                                                  'Create your first goal'
                                              ),
                                              icon: PlusIcon,
                                              onClick: () =>
                                                  setIsCreateOpen(true),
                                          },
                                          {
                                              label: t(
                                                  'goals.blankSlateAreas',
                                                  'Set up areas'
                                              ),
                                              icon: Squares2X2Icon,
                                              to: '/areas',
                                          },
                                      ]
                                    : []
                            }
                        />
                    )
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        {...sortableCursorHandlers}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sortedGoals.map(
                                (g: Goal) => g.uid as string
                            )}
                            strategy={verticalListSortingStrategy}
                        >
                            <div
                                className={`task-list-container overflow-visible ${TASK_SHEET_CLASS} task-sheet-rails`}
                            >
                                {sortedGoals.map((goal: Goal) => (
                                    <SortableItem
                                        key={goal.uid}
                                        id={goal.uid as string}
                                        label={goal.title}
                                        roleDescription={t(
                                            'sortable.goal',
                                            'sortable goal'
                                        )}
                                        testIdPrefix="sortable-goal"
                                    >
                                        <GoalRow
                                            goal={goal}
                                            onDelete={openConfirmDelete}
                                        />
                                    </SortableItem>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            <GoalModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
            />

            {isConfirmDialogOpen && goalToDelete && (
                <ConfirmDialog
                    title={t('modals.deleteGoal.title', 'Delete Goal')}
                    message={t('modals.deleteGoal.message', {
                        title: goalToDelete.title,
                        defaultValue:
                            'Are you sure you want to delete the goal "{{title}}"?',
                    })}
                    onConfirm={handleDeleteGoal}
                    onCancel={() => {
                        setIsConfirmDialogOpen(false);
                        setGoalToDelete(null);
                    }}
                />
            )}
        </div>
    );
};

export default Goals;
