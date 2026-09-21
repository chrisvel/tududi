import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    BookOpenIcon,
    CalendarDaysIcon,
    CalendarIcon,
    ChartBarIcon,
    ClockIcon,
    FireIcon,
    FlagIcon,
    FolderIcon,
    InboxIcon,
    ListBulletIcon,
    QueueListIcon,
    RectangleGroupIcon,
    RectangleStackIcon,
    Squares2X2Icon,
    TagIcon,
    UserGroupIcon,
    UserIcon,
    UsersIcon,
} from '@heroicons/react/24/outline';
import {
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PushPinIcon from '../Shared/Icons/PushPinIcon';
import { useStore } from '../../store/useStore';
import type { SidebarVisibleSections } from './types';

export type SidebarOrderGroup = 'links' | 'sections';
type IconType = React.ComponentType<{ className?: string }>;
type ItemKey = keyof SidebarVisibleSections;

interface SidebarLayoutEditorProps {
    visibleSections: SidebarVisibleSections;
    linkOrder: string[];
    sectionOrder: string[];
    isAdmin: boolean;
    onToggleSection: (key: ItemKey) => void;
    onReorder: (group: SidebarOrderGroup, order: string[]) => void;
}

interface Row {
    id: string;
    label: string;
    Icon: IconType;
    note?: string;
}

const GripIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        className={className}
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
    >
        {[4, 8, 12].flatMap((cy) =>
            [5.5, 10.5].map((cx) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} />
            ))
        )}
    </svg>
);

const MiniSwitch: React.FC<{
    checked: boolean;
    label: string;
    onToggle: () => void;
}> = ({ checked, label, onToggle }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={`relative inline-flex h-[18px] w-8 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 ${
            checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
    >
        <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                checked ? 'translate-x-[16px]' : 'translate-x-[2px]'
            }`}
        />
    </button>
);

interface PreviewRowProps {
    row: Row;
    variant: 'link' | 'section';
    checked: boolean;
    switchLabel: string;
    onToggle: () => void;
    dragHandle?: React.ReactNode;
}

const PreviewRow = React.forwardRef<
    HTMLDivElement,
    PreviewRowProps & React.HTMLAttributes<HTMLDivElement>
>(
    (
        { row, variant, checked, switchLabel, onToggle, dragHandle, ...rest },
        ref
    ) => {
        const { Icon } = row;
        const isSection = variant === 'section';
        return (
            <div
                ref={ref}
                data-testid={`sidebar-preview-row-${row.id}`}
                {...rest}
                className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 ${
                    rest.className ?? ''
                }`}
            >
                <span className="flex w-5 flex-shrink-0 justify-center">
                    {dragHandle}
                </span>
                <span
                    className={`flex min-w-0 flex-1 items-center gap-[6px] transition-opacity duration-200 ${
                        checked ? '' : 'opacity-40'
                    } ${
                        isSection
                            ? 'text-[10.5px] font-semibold uppercase tracking-[0.01em] text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                            : 'text-[13.5px] text-gray-700 dark:text-[oklch(75%_0.006_95)]'
                    }`}
                >
                    <Icon
                        className={`flex-shrink-0 ${
                            isSection
                                ? 'h-[14px] w-[14px]'
                                : 'h-[15px] w-[15px] text-gray-400 dark:text-[oklch(55%_0.006_95)]'
                        }`}
                    />
                    <span className="truncate">{row.label}</span>
                </span>
                {row.note && (
                    <span className="flex-shrink-0 rounded-full bg-gray-200/70 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-white/10 dark:text-gray-400">
                        {row.note}
                    </span>
                )}
                <MiniSwitch
                    checked={checked}
                    label={switchLabel}
                    onToggle={onToggle}
                />
            </div>
        );
    }
);
PreviewRow.displayName = 'PreviewRow';

const SortablePreviewRow: React.FC<
    Omit<PreviewRowProps, 'dragHandle'> & { moveLabel: string }
> = ({ moveLabel, ...props }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: props.row.id });

    return (
        <PreviewRow
            {...props}
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(
                    transform
                        ? { ...transform, x: 0, scaleX: 1, scaleY: 1 }
                        : null
                ),
                transition,
            }}
            className={
                isDragging
                    ? 'relative z-10 bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10'
                    : ''
            }
            dragHandle={
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    aria-label={moveLabel}
                    title={moveLabel}
                    className="cursor-grab touch-none rounded p-0.5 text-gray-300 hover:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-400"
                    {...attributes}
                    {...listeners}
                >
                    <GripIcon className="h-4 w-4" />
                </button>
            }
        />
    );
};

interface SortableGroupProps {
    variant: 'link' | 'section';
    rows: Row[];
    order: string[];
    visibleSections: SidebarVisibleSections;
    onToggleSection: (key: ItemKey) => void;
    onReorder: (order: string[]) => void;
}

const SortableGroup: React.FC<SortableGroupProps> = ({
    variant,
    rows,
    order,
    visibleSections,
    onToggleSection,
    onReorder,
}) => {
    const { t } = useTranslation();
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const byId = new Map(rows.map((row) => [row.id, row]));

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = order.indexOf(String(active.id));
        const to = order.indexOf(String(over.id));
        if (from === -1 || to === -1) return;
        onReorder(arrayMove(order, from, to));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={order}
                strategy={verticalListSortingStrategy}
            >
                {order.map((id) => {
                    const row = byId.get(id);
                    if (!row) return null;
                    return (
                        <SortablePreviewRow
                            key={id}
                            row={row}
                            variant={variant}
                            checked={visibleSections[id as ItemKey] !== false}
                            switchLabel={t(
                                'profile.sidebarShowItem',
                                'Show {{name}}',
                                { name: row.label }
                            )}
                            moveLabel={t(
                                'profile.sidebarMoveItem',
                                'Move {{name}}',
                                { name: row.label }
                            )}
                            onToggle={() => onToggleSection(id as ItemKey)}
                        />
                    );
                })}
            </SortableContext>
        </DndContext>
    );
};

const SidebarLayoutEditor: React.FC<SidebarLayoutEditorProps> = ({
    visibleSections,
    linkOrder,
    sectionOrder,
    isAdmin,
    onToggleSection,
    onReorder,
}) => {
    const { t } = useTranslation();
    const calendarEnabled = useStore(
        (state) => state.userSettingsStore.calendarEnabled
    );
    const habitsEnabled = useStore(
        (state) => state.userSettingsStore.habitsEnabled
    );
    const templatesEnabled = useStore(
        (state) => state.userSettingsStore.templatesEnabled
    );
    const eisenhowerEnabled = useStore(
        (state) => state.userSettingsStore.eisenhowerEnabled
    );
    const kanbanEnabled = useStore(
        (state) => state.userSettingsStore.kanbanEnabled
    );
    const hasCollaborators = useStore(
        (state) => state.userSettingsStore.hasCollaborators
    );

    const featureOff = t('profile.sidebarFeatureOff', 'Off in Features');

    const linkRows: Row[] = [
        { id: 'inbox', label: t('sidebar.inbox', 'Inbox'), Icon: InboxIcon },
        {
            id: 'today',
            label: t('sidebar.today', 'Today'),
            Icon: CalendarDaysIcon,
        },
        {
            id: 'upcomingTasks',
            label: t('sidebar.upcoming', 'Upcoming'),
            Icon: ClockIcon,
        },
        {
            id: 'calendar',
            label: t('sidebar.calendar', 'Calendar'),
            Icon: CalendarIcon,
            note: calendarEnabled ? undefined : featureOff,
        },
        {
            id: 'allTasks',
            label: t('sidebar.allTasks', 'All Tasks'),
            Icon: ListBulletIcon,
        },
        {
            id: 'assignedToMe',
            label: t('sidebar.assignedToMe', 'Assigned to me'),
            Icon: UserIcon,
        },
        {
            id: 'everyone',
            label: t('sidebar.everyone', 'Everyone'),
            Icon: UsersIcon,
            note: hasCollaborators
                ? undefined
                : t('profile.sidebarNoCollaborators', 'No collaborators'),
        },
    ];

    const sectionRows: Row[] = [
        {
            id: 'favorites',
            label: t('sidebar.bookmarks', 'Favorites'),
            Icon: PushPinIcon,
        },
        {
            id: 'projects',
            label: t('sidebar.projects', 'Projects'),
            Icon: FolderIcon,
        },
        {
            id: 'areas',
            label: t('sidebar.areas', 'Areas'),
            Icon: Squares2X2Icon,
        },
        { id: 'goals', label: t('sidebar.goals', 'Goals'), Icon: FlagIcon },
        {
            id: 'notes',
            label: t('sidebar.notes', 'Notes'),
            Icon: BookOpenIcon,
        },
        { id: 'tags', label: t('sidebar.tags', 'Tags'), Icon: TagIcon },
        {
            id: 'people',
            label: t('sidebar.people', 'People'),
            Icon: UserGroupIcon,
        },
        {
            id: 'habits',
            label: t('sidebar.habits', 'Habits'),
            Icon: FireIcon,
            note: habitsEnabled ? undefined : featureOff,
        },
        {
            id: 'views',
            label: t('sidebar.views', 'Views'),
            Icon: QueueListIcon,
        },
        {
            id: 'boards',
            label: t('sidebar.boards', 'Boards'),
            Icon: RectangleGroupIcon,
            note: eisenhowerEnabled || kanbanEnabled ? undefined : featureOff,
        },
        {
            id: 'insights',
            label: t('sidebar.insights', 'Insights'),
            Icon: ChartBarIcon,
        },
    ];

    const fixedRows: Row[] = [
        {
            id: 'templates',
            label: t('navigation.templates', 'Templates'),
            Icon: RectangleStackIcon,
            note: templatesEnabled ? undefined : featureOff,
        },
        ...(isAdmin
            ? [
                  {
                      id: 'access',
                      label: t('admin.access.title', 'Access'),
                      Icon: UsersIcon,
                  },
              ]
            : []),
    ];

    return (
        <div
            data-testid="sidebar-preview"
            className="w-full max-w-sm rounded-2xl bg-gray-50 p-3 shadow-sm ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
        >
            <SortableGroup
                variant="link"
                rows={linkRows}
                order={linkOrder}
                visibleSections={visibleSections}
                onToggleSection={onToggleSection}
                onReorder={(order) => onReorder('links', order)}
            />

            <div className="mt-5">
                <SortableGroup
                    variant="section"
                    rows={sectionRows}
                    order={sectionOrder}
                    visibleSections={visibleSections}
                    onToggleSection={onToggleSection}
                    onReorder={(order) => onReorder('sections', order)}
                />
            </div>

            <div className="mt-5">
                {fixedRows.map((row) => (
                    <PreviewRow
                        key={row.id}
                        row={row}
                        variant="section"
                        checked={visibleSections[row.id as ItemKey] !== false}
                        switchLabel={t(
                            'profile.sidebarShowItem',
                            'Show {{name}}',
                            { name: row.label }
                        )}
                        onToggle={() => onToggleSection(row.id as ItemKey)}
                    />
                ))}
            </div>
        </div>
    );
};

export default SidebarLayoutEditor;
