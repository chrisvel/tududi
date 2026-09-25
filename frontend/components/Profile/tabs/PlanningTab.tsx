import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Bars3Icon,
    ChevronDownIcon,
    ChevronUpIcon,
    QueueListIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import { useSortableSensors } from '../../Shared/sortableList';
import {
    RankingBucket,
    RankingGroup,
    fetchPlanRanking,
    savePlanRanking,
} from '../../../utils/dailyPlanService';

interface PlanningTabProps {
    isActive: boolean;
}

interface BucketRowProps {
    bucket: RankingBucket;
    index: number;
    count: number;
    title: string;
    detail: string;
    onMove: (from: number, to: number) => void;
}

const BucketRow: React.FC<BucketRowProps> = ({
    bucket,
    index,
    count,
    title,
    detail,
    onMove,
}) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: bucket });

    const arrow =
        'flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700';

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`flex items-center gap-3 rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/60 ${
                isDragging ? 'relative z-10 shadow-lg' : ''
            }`}
            data-testid={`planning-bucket-${bucket}`}
        >
            <button
                type="button"
                className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 active:cursor-grabbing dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label={t('profile.planning.dragRow', 'Drag {{name}}', {
                    name: title,
                })}
                {...listeners}
                {...attributes}
            >
                <Bars3Icon className="h-4 w-4" />
            </button>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {title}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                    {detail}
                </span>
            </span>
            <span className="flex shrink-0">
                <button
                    type="button"
                    onClick={() => onMove(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t(
                        'profile.planning.moveUp',
                        'Move {{name}} up',
                        {
                            name: title,
                        }
                    )}
                    className={arrow}
                >
                    <ChevronUpIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => onMove(index, index + 1)}
                    disabled={index === count - 1}
                    aria-label={t(
                        'profile.planning.moveDown',
                        'Move {{name}} down',
                        { name: title }
                    )}
                    className={arrow}
                >
                    <ChevronDownIcon className="h-4 w-4" />
                </button>
            </span>
        </li>
    );
};

// Lets the user order the buckets used by backend/modules/daily-plan/
// ranking.js. Keep the texts here in step with that file.
const PlanningTab: React.FC<PlanningTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const sensors = useSortableSensors();
    const [order, setOrder] = useState<RankingBucket[]>([]);
    const [defaultOrder, setDefaultOrder] = useState<RankingBucket[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isActive) return;
        setLoading(true);
        fetchPlanRanking()
            .then((ranking) => {
                setOrder(ranking.order);
                setDefaultOrder(ranking.default_order);
            })
            .catch(() =>
                showErrorToast(
                    t(
                        'profile.planning.loadError',
                        'Could not load the planning order'
                    )
                )
            )
            .finally(() => setLoading(false));
    }, [isActive]);

    if (!isActive) return null;

    const groups: Record<RankingGroup, { title: string; detail: string }> = {
        overdue: {
            title: t('profile.planning.overdue', 'Overdue'),
            detail: t(
                'profile.planning.overdueDetail',
                'Past their due date, including tasks you already started.'
            ),
        },
        due_today: {
            title: t('profile.planning.dueToday', 'Due today'),
            detail: t(
                'profile.planning.dueTodayDetail',
                'Tasks due before the day ends.'
            ),
        },
        in_progress: {
            title: t('profile.planning.inProgress', 'In progress'),
            detail: t(
                'profile.planning.inProgressDetail',
                'Work you started and have not finished.'
            ),
        },
        suggested: {
            title: t('profile.planning.everythingElse', 'Everything else'),
            detail: t(
                'profile.planning.everythingElseDetail',
                'Open tasks you could pick up. Deferred tasks, someday tasks and tasks due more than 3 days out are left out.'
            ),
        },
    };
    const kinds = {
        project: t('profile.planning.inProject', 'in a project'),
        none: t('profile.planning.noProject', 'no project'),
    };
    const describe = (bucket: RankingBucket) => {
        const [group, kind] = bucket.split(':') as [
            RankingGroup,
            'project' | 'none',
        ];
        return {
            title: `${groups[group].title} · ${kinds[kind]}`,
            detail: groups[group].detail,
        };
    };

    const save = (next: RankingBucket[]) => {
        const previous = order;
        setOrder(next);
        savePlanRanking(next).catch(() => {
            setOrder(previous);
            showErrorToast(
                t(
                    'profile.planning.saveError',
                    'Could not save the planning order'
                )
            );
        });
    };

    const move = (from: number, to: number) => {
        if (to < 0 || to >= order.length || from === to) return;
        save(arrayMove(order, from, to));
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        move(
            order.indexOf(active.id as RankingBucket),
            order.indexOf(over.id as RankingBucket)
        );
    };

    const isDefault =
        order.length > 0 &&
        order.every((bucket, index) => bucket === defaultOrder[index]);

    const tieBreakers = [
        t('profile.planning.rulePriority', 'Higher priority first.'),
        t(
            'profile.planning.ruleDue',
            'The earlier due date first, then the older task.'
        ),
    ];

    return (
        <div>
            <h3 className="mb-6 flex items-center text-xl font-semibold text-gray-900 dark:text-white">
                <QueueListIcon className="mr-3 h-6 w-6 text-blue-500" />
                {t('profile.planning.title', 'Planning')}
            </h3>

            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                {t(
                    'profile.planning.description',
                    'How "What could you do today?" orders your tasks when you plan your day. Drag the rows into the order you want; the same tasks always come out in the same order.'
                )}
            </p>

            <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {t('profile.planning.orderTitle', 'Order (drag to change)')}
                </h4>
                {!isDefault && order.length > 0 && (
                    <button
                        type="button"
                        onClick={() => save(defaultOrder)}
                        className="text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        {t('profile.planning.reset', 'Reset to default')}
                    </button>
                )}
            </div>

            {loading && order.length === 0 ? (
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </p>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                >
                    <SortableContext
                        items={order}
                        strategy={verticalListSortingStrategy}
                    >
                        <ol className="mb-6 flex flex-col gap-2">
                            {order.map((bucket, index) => (
                                <BucketRow
                                    key={bucket}
                                    bucket={bucket}
                                    index={index}
                                    count={order.length}
                                    {...describe(bucket)}
                                    onMove={move}
                                />
                            ))}
                        </ol>
                    </SortableContext>
                </DndContext>
            )}

            <h4 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('profile.planning.withinTitle', 'Inside each group')}
            </h4>
            <ol className="mb-6 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                {tieBreakers.map((rule) => (
                    <li key={rule}>{rule}</li>
                ))}
            </ol>

            <Link
                to="/today/plan"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
                {t('profile.planning.open', 'Plan my day')}
            </Link>
        </div>
    );
};

export default PlanningTab;
