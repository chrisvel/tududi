import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    MagnifyingGlassIcon,
    EllipsisVerticalIcon,
    TagIcon,
    FunnelIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from '../utils/csrfService';
import { useStore } from '../store/useStore';

interface View {
    id: number;
    uid: string;
    name: string;
    search_query: string | null;
    filters: string[];
    priority: string | null;
    due: string | null;
    defer: string | null;
    tags: string[];
    extras: string[] | null;
    is_pinned: boolean;
}

const Views: React.FC = () => {
    const { t } = useTranslation();
    const [views, setViews] = useState<View[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [viewToDelete, setViewToDelete] = useState<View | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
    const justOpenedRef = useRef<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const allTags = useStore((state) => state.tagsStore.tags);
    const getTagColor = (name: string): string | undefined =>
        allTags.find((t) => t.name === name)?.color;

    useEffect(() => {
        fetchViews();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (justOpenedRef.current) {
                justOpenedRef.current = false;
                return;
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(null);
            }
        };
        if (dropdownOpen !== null) {
            const id = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            return () => {
                clearTimeout(id);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const fetchViews = async () => {
        try {
            const response = await fetch(getApiPath('views'), { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                const normalized: View[] = data.map((view: View) => ({
                    ...view,
                    tags: view.tags || [],
                    extras: view.extras || [],
                    defer: view.defer || null,
                }));
                setViews(normalized);
            }
        } catch (error) {
            console.error('Error fetching views:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteView = async () => {
        if (!viewToDelete) return;
        try {
            const response = await fetch(getApiPath(`views/${viewToDelete.uid}`), {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'x-csrf-token': await getCsrfToken() },
            });
            if (response.ok) {
                setViews(views.filter((v) => v.uid !== viewToDelete.uid));
                window.dispatchEvent(new CustomEvent('viewUpdated'));
            }
        } catch (error) {
            console.error('Error deleting view:', error);
        } finally {
            setIsConfirmDialogOpen(false);
            setViewToDelete(null);
        }
    };

    const togglePin = async (view: View) => {
        try {
            const response = await fetch(getApiPath(`views/${view.uid}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({ is_pinned: !view.is_pinned }),
            });
            if (response.ok) {
                fetchViews();
                window.dispatchEvent(new CustomEvent('viewUpdated'));
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const openConfirmDialog = (view: View) => {
        setViewToDelete(view);
        setIsConfirmDialogOpen(true);
    };

    const filteredViews = views.filter((view) =>
        view.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filterCount = (view: View) =>
        view.filters.length +
        (view.search_query ? 1 : 0) +
        (view.priority ? 1 : 0) +
        (view.due ? 1 : 0) +
        (view.defer ? 1 : 0) +
        (view.extras?.length ?? 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('views.loading')}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-light">{t('views.title')}</h2>
                    <button
                        type="button"
                        onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                        className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-2 ${
                            isSearchExpanded
                                ? 'bg-blue-50/70 dark:bg-blue-900/20'
                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        aria-expanded={isSearchExpanded}
                        title={isSearchExpanded ? t('common.hideSearch', 'Hide search') : t('common.search', 'Search views')}
                    >
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                    </button>
                </div>

                {/* Collapsible search */}
                <div
                    className={`transition-all duration-300 ease-in-out ${
                        isSearchExpanded ? 'max-h-24 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
                    } overflow-hidden`}
                >
                    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-4 py-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder={t('views.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Views grid */}
                {filteredViews.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">{t('views.noViewsFound')}</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredViews.map((view) => (
                            <Link
                                key={view.uid}
                                to={`/views/${view.uid}`}
                                className={`rounded-xl shadow-sm relative flex flex-col group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 ${
                                    dropdownOpen === view.uid ? 'z-50' : ''
                                }`}
                            >
                                {/* Three-dot dropdown */}
                                <div className="absolute top-2 right-2 z-10" ref={dropdownRef}>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const next = dropdownOpen === view.uid ? null : view.uid;
                                            if (next !== null) justOpenedRef.current = true;
                                            setDropdownOpen(next);
                                        }}
                                        className="focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                    >
                                        <EllipsisVerticalIcon className="h-4 w-4" />
                                    </button>

                                    {dropdownOpen === view.uid && (
                                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-700 shadow-lg rounded-md z-[60]">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    togglePin(view);
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-t-md"
                                            >
                                                {view.is_pinned ? t('views.unpinView') : t('views.pinView')}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openConfirmDialog(view);
                                                    setDropdownOpen(null);
                                                }}
                                                className="block px-4 py-2 text-sm text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left rounded-b-md"
                                            >
                                                {t('areas.delete', 'Delete')}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Body: name + chips */}
                                <div className="px-5 pt-6 pb-4 flex-1 flex items-center justify-center text-center">
                                    <div className="w-full">
                                        {view.is_pinned && (
                                            <StarIconSolid className="h-3 w-3 text-yellow-400 mx-auto mb-1.5" />
                                        )}
                                        <h3 className="text-sm font-semibold tracking-widest uppercase line-clamp-2 text-gray-800 dark:text-gray-100 mb-3">
                                            {view.name}
                                        </h3>

                                        {/* Tag chips */}
                                        {view.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 justify-center mb-2">
                                                {view.tags.map((tag) => {
                                                    const color = getTagColor(tag);
                                                    return (
                                                        <span
                                                            key={tag}
                                                            className={
                                                                color
                                                                    ? 'px-2 py-0.5 rounded text-[10px] font-medium text-white'
                                                                    : 'px-2 py-0.5 bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 rounded text-[10px] font-medium'
                                                            }
                                                            style={color ? { backgroundColor: color } : undefined}
                                                        >
                                                            {tag}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Filter summary */}
                                        {(view.search_query || view.priority || view.due || view.defer || view.filters.length > 0) && (
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-1">
                                                {[
                                                    view.search_query && `"${view.search_query}"`,
                                                    view.priority,
                                                    view.due?.replace(/_/g, ' '),
                                                    view.defer?.replace(/_/g, ' '),
                                                    ...view.filters,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Stats footer */}
                                <div className="rounded-b-xl flex items-stretch divide-x bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-600 divide-gray-200 dark:divide-gray-600">
                                    {[
                                        {
                                            icon: <FunnelIcon className="h-3.5 w-3.5" />,
                                            count: filterCount(view),
                                            label: t('views.filters', 'filters'),
                                        },
                                        {
                                            icon: <TagIcon className="h-3.5 w-3.5" />,
                                            count: view.tags.length,
                                            label: t('tags.title', 'tags'),
                                        },
                                    ].map(({ icon, count, label }) => (
                                        <div key={label} className="flex-1 flex flex-col items-center py-3 gap-1">
                                            <span className="text-base font-semibold leading-none text-gray-700 dark:text-gray-200">
                                                {count}
                                            </span>
                                            <span className="flex items-center gap-1 text-[10px] leading-none text-gray-400 dark:text-gray-500">
                                                {icon}
                                                {label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {isConfirmDialogOpen && viewToDelete && (
                    <ConfirmDialog
                        title={t('views.deleteView')}
                        message={t('views.confirmDelete', { viewName: viewToDelete.name })}
                        onConfirm={handleDeleteView}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setViewToDelete(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default Views;
