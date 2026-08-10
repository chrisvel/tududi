import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    QueueListIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getApiPath } from '../../config/paths';
import { getCsrfToken } from '../../utils/csrfService';

interface View {
    id: number;
    uid: string;
    name: string;
    is_pinned: boolean;
}

interface SidebarViewsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
}

interface SortableViewItemProps {
    view: View;
    isActive: boolean;
    onNavigate: () => void;
    onTogglePin: (e: React.MouseEvent) => void;
}

const SortableViewItem: React.FC<SortableViewItemProps> = ({
    view,
    isActive,
    onNavigate,
    onTogglePin,
}) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: view.uid });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleClick = (e: React.MouseEvent) => {
        // Don't navigate if clicking the star button
        if ((e.target as HTMLElement).closest('button')) {
            return;
        }
        onNavigate();
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`group flex justify-between items-center rounded-[8px] px-[10px] py-1 text-[13.5px] cursor-pointer hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
                isActive
                    ? 'bg-gray-100 dark:bg-[oklch(27%_0.02_250)] text-gray-900 dark:text-[oklch(88%_0.004_95)] font-medium'
                    : 'text-gray-500 dark:text-[oklch(82%_0.006_95)]'
            } ${isDragging ? 'opacity-50' : ''}`}
            onClick={handleClick}
            {...listeners}
            {...attributes}
        >
            <span className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-[14px] rounded-full flex-shrink-0 bg-gray-400 dark:bg-gray-500" />
                <span className="truncate">{view.name}</span>
            </span>
            <button
                onClick={onTogglePin}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 focus:outline-none flex-shrink-0"
                aria-label={t('sidebar.unpinView')}
                title={t('sidebar.unpinView')}
            >
                <StarIconSolid className="h-4 w-4" />
            </button>
        </li>
    );
};

const SidebarViews: React.FC<SidebarViewsProps> = ({
    handleNavClick,
    location,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [pinnedViews, setPinnedViews] = useState<View[]>([]);
    const [sidebarSettings, setSidebarSettings] = useState<{
        pinnedViewsOrder: string[];
    }>({ pinnedViewsOrder: [] });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 250, // 250ms press before drag activates
                tolerance: 5, // 5px movement tolerance during delay
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchUserSettings();
        fetchPinnedViews();

        // Listen for view updates
        const handleViewUpdate = () => {
            fetchPinnedViews();
        };

        window.addEventListener('viewUpdated', handleViewUpdate);
        return () => {
            window.removeEventListener('viewUpdated', handleViewUpdate);
        };
    }, []);

    const fetchUserSettings = async () => {
        try {
            const response = await fetch(getApiPath('profile'), {
                credentials: 'include',
            });
            if (response.ok) {
                const profile = await response.json();
                if (profile.sidebar_settings) {
                    // Parse if it's a string (from SQLite JSON storage)
                    const settings =
                        typeof profile.sidebar_settings === 'string'
                            ? JSON.parse(profile.sidebar_settings)
                            : profile.sidebar_settings;
                    setSidebarSettings(settings);
                }
            }
        } catch (error) {
            console.error('Error fetching user settings:', error);
        }
    };

    const fetchPinnedViews = async () => {
        try {
            const response = await fetch(getApiPath('views/pinned'), {
                credentials: 'include',
            });
            if (response.ok) {
                const views = await response.json();
                setPinnedViews(views);
            }
        } catch (error) {
            console.error('Error fetching pinned views:', error);
        }
    };

    const togglePin = async (view: View, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(getApiPath(`views/${view.uid}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    is_pinned: !view.is_pinned,
                }),
            });

            if (response.ok) {
                fetchPinnedViews();
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = orderedViews.findIndex((v) => v.uid === active.id);
            const newIndex = orderedViews.findIndex((v) => v.uid === over.id);

            const newOrder = arrayMove(orderedViews, oldIndex, newIndex);
            const newOrderUids = newOrder.map((v) => v.uid);

            // Optimistically update UI
            setSidebarSettings({ pinnedViewsOrder: newOrderUids });

            // Save to backend
            try {
                await fetch(getApiPath('profile/sidebar-settings'), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': await getCsrfToken(),
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        pinnedViewsOrder: newOrderUids,
                    }),
                });
            } catch (error) {
                console.error('Error saving view order:', error);
                // Revert on error
                fetchUserSettings();
            }
        }
    };

    // Sort views based on saved order
    const orderedViews = React.useMemo(() => {
        if (!sidebarSettings.pinnedViewsOrder.length) {
            return pinnedViews;
        }

        const orderMap = new Map(
            sidebarSettings.pinnedViewsOrder.map((uid, index) => [uid, index])
        );

        return [...pinnedViews].sort((a, b) => {
            const indexA = orderMap.get(a.uid);
            const indexB = orderMap.get(b.uid);

            // If both have saved order, use that
            if (indexA !== undefined && indexB !== undefined) {
                return indexA - indexB;
            }
            // If only one has saved order, it comes first
            if (indexA !== undefined) return -1;
            if (indexB !== undefined) return 1;
            // Otherwise maintain original order
            return 0;
        });
    }, [pinnedViews, sidebarSettings.pinnedViewsOrder]);

    const isActiveView = (path: string) => {
        return location.pathname === path;
    };

    return (
        <ul className="flex flex-col">
            <li className="flex justify-between items-center px-2.5 py-1 rounded-md">
                <span
                    className={`flex items-center gap-1.5 text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        isActiveView('/views')
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() =>
                        handleNavClick(
                            '/views',
                            t('sidebar.views'),
                            <QueueListIcon className="h-5 w-5 mr-2" />
                        )
                    }
                >
                    <QueueListIcon className="h-3.5 w-3.5" />
                    {t('sidebar.views')}
                </span>
                {orderedViews.length > 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded((v) => !v);
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={isExpanded ? 'Collapse views list' : 'Expand views list'}
                    >
                        <ChevronRightIcon
                            className="h-3 w-3 transition-transform duration-150"
                            style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                        />
                    </button>
                )}
            </li>

            {isExpanded && (
                <li className="p-0 list-none">
                    <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={orderedViews.map((v) => v.uid)}
                                strategy={verticalListSortingStrategy}
                            >
                                {orderedViews.map((view) => (
                                    <SortableViewItem
                                        key={view.uid}
                                        view={view}
                                        isActive={isActiveView(
                                            `/views/${view.uid}`
                                        )}
                                        onNavigate={() =>
                                            handleNavClick(
                                                `/views/${view.uid}`,
                                                view.name,
                                                <QueueListIcon className="h-5 w-5 mr-2" />
                                            )
                                        }
                                        onTogglePin={(e) =>
                                            togglePin(view, e)
                                        }
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                </li>
            )}
        </ul>
    );
};

export default SidebarViews;
