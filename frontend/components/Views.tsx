import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    MagnifyingGlassIcon,
    StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';
import { getApiPath } from '../config/paths';

interface View {
    id: number;
    uid: string;
    name: string;
    search_query: string | null;
    filters: string[];
    priority: string | null;
    due: string | null;
    is_pinned: boolean;
}

const Views: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [views, setViews] = useState<View[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [hoveredViewId, setHoveredViewId] = useState<number | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [viewToDelete, setViewToDelete] = useState<View | null>(null);

    useEffect(() => {
        fetchViews();
    }, []);

    const fetchViews = async () => {
        try {
            const response = await fetch(getApiPath('views'), {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setViews(data);
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
            const response = await fetch(
                getApiPath(`views/${viewToDelete.uid}`),
                {
                    method: 'DELETE',
                    credentials: 'include',
                }
            );
            if (response.ok) {
                setViews(views.filter((v) => v.uid !== viewToDelete.uid));
                // Notify sidebar to refresh
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
                },
                credentials: 'include',
                body: JSON.stringify({
                    is_pinned: !view.is_pinned,
                }),
            });

            if (response.ok) {
                fetchViews();
                // Notify sidebar to refresh
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

    const closeConfirmDialog = () => {
        setIsConfirmDialogOpen(false);
        setViewToDelete(null);
    };

    const filteredViews = views.filter((view) =>
        view.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                {/* Views Header */}
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
                        aria-label={
                            isSearchExpanded
                                ? t(
                                      'common.hideSearch',
                                      'Collapse search panel'
                                  )
                                : t('common.showSearch', 'Show search input')
                        }
                        title={
                            isSearchExpanded
                                ? t('common.hideSearch', 'Hide search')
                                : t('common.search', 'Search views')
                        }
                    >
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                        <span className="sr-only">
                            {isSearchExpanded
                                ? t('common.hideSearch', 'Hide search')
                                : t('common.search', 'Search views')}
                        </span>
                    </button>
                </div>

                {/* Search input section, collapsible */}
                <div
                    className={`transition-all duration-300 ease-in-out ${
                        isSearchExpanded
                            ? 'max-h-24 opacity-100 mb-4'
                            : 'max-h-0 opacity-0 mb-0'
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

                {/* Views List */}
                {filteredViews.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        {t('views.noViewsFound')}
                    </p>
                ) : (
                    <div className="space-y-4">
                        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredViews.map((view) => (
                                <li
                                    key={view.uid}
                                    className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow"
                                    onMouseEnter={() =>
                                        setHoveredViewId(view.id)
                                    }
                                    onMouseLeave={() => setHoveredViewId(null)}
                                    onClick={() =>
                                        navigate(`/views/${view.uid}`)
                                    }
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-grow">
                                            <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                                {view.name}
                                            </h3>
                                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                                                {view.filters.length > 0 && (
                                                    <p>
                                                        •{' '}
                                                        {view.filters.join(
                                                            ', '
                                                        )}
                                                    </p>
                                                )}
                                                {view.search_query && (
                                                    <p>
                                                        • &quot;
                                                        {view.search_query}
                                                        &quot;
                                                    </p>
                                                )}
                                                {view.priority && (
                                                    <p>
                                                        •{' '}
                                                        {t(
                                                            'views.priorityLabel'
                                                        )}{' '}
                                                        {view.priority}
                                                    </p>
                                                )}
                                                {view.due && (
                                                    <p>
                                                        • {t('views.dueLabel')}{' '}
                                                        {view.due}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex space-x-2 ml-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    togglePin(view);
                                                }}
                                                className={`${view.is_pinned ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-600 focus:outline-none transition-opacity ${hoveredViewId === view.id || view.is_pinned ? 'opacity-100' : 'opacity-0'}`}
                                                aria-label={t(
                                                    'common.togglePin',
                                                    'Toggle pin'
                                                )}
                                                title={
                                                    view.is_pinned
                                                        ? t('views.unpinView')
                                                        : t('views.pinView')
                                                }
                                            >
                                                {view.is_pinned ? (
                                                    <StarIconSolid className="h-5 w-5" />
                                                ) : (
                                                    <StarIcon className="h-5 w-5" />
                                                )}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openConfirmDialog(view);
                                                }}
                                                className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${hoveredViewId === view.id ? 'opacity-100' : 'opacity-0'}`}
                                                aria-label={`Delete ${view.name}`}
                                                title={`Delete ${view.name}`}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* ConfirmDialog */}
                {isConfirmDialogOpen && viewToDelete && (
                    <ConfirmDialog
                        title={t('views.deleteView')}
                        message={t('views.confirmDelete', {
                            viewName: viewToDelete.name,
                        })}
                        onConfirm={handleDeleteView}
                        onCancel={closeConfirmDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default Views;
