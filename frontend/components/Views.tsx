import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from './Shared/ConfirmDialog';
import NewItemButton from './Shared/NewItemButton';
import BlankSlate from './Shared/BlankSlate';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from '../utils/csrfService';
import ViewRow, { View } from './View/ViewRow';
import { TASK_SHEET_CLASS } from './Task/taskSheet';

const Views: React.FC = () => {
    const { t } = useTranslation();
    const [views, setViews] = useState<View[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
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
            const response = await fetch(
                getApiPath(`views/${viewToDelete.uid}`),
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'x-csrf-token': await getCsrfToken() },
                }
            );
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

    const openUniversalSearch = () =>
        window.dispatchEvent(new Event('openUniversalSearch'));

    const filteredViews = views.filter((view) =>
        view.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filterCount = (view: View) =>
        view.filters.length +
        (view.search_query ? 1 : 0) +
        (view.priority ? 1 : 0) +
        (view.task_status ? 1 : 0) +
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
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 mb-8">
                    <h2 className="text-2xl font-light">{t('views.title')}</h2>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setIsSearchExpanded(!isSearchExpanded)
                            }
                            className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-2 ${
                                isSearchExpanded
                                    ? 'bg-blue-50/70 dark:bg-blue-900/20'
                                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            aria-expanded={isSearchExpanded}
                            title={
                                isSearchExpanded
                                    ? t('common.hideSearch', 'Hide search')
                                    : t('common.search', 'Search views')
                            }
                        >
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                        </button>
                        <NewItemButton
                            label={t('views.new', 'New View')}
                            onClick={openUniversalSearch}
                            testId="new-view-button"
                        />
                    </div>
                </div>

                {/* Collapsible search */}
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

                {/* Views grid */}
                {filteredViews.length === 0 ? (
                    views.length === 0 ? (
                        <BlankSlate
                            title={t('views.noViewsYet', 'No smart views yet.')}
                            hint={t(
                                'views.blankSlateHint',
                                'A smart view is a saved search, like high priority tasks due this week or notes tagged ideas. Search, set your filters and choose Save as Smart View. Pin a view to keep it in the sidebar.'
                            )}
                            actions={[
                                {
                                    label: t(
                                        'views.blankSlateNew',
                                        'Search to create a view'
                                    ),
                                    icon: MagnifyingGlassIcon,
                                    onClick: openUniversalSearch,
                                },
                            ]}
                        />
                    ) : (
                        <BlankSlate
                            title={t('views.noViewsMatch', 'No views found')}
                            hint={t(
                                'views.blankSlateFilteredHint',
                                'Try a different search.'
                            )}
                            actions={[
                                {
                                    label: t(
                                        'views.blankSlateClearSearch',
                                        'Clear search'
                                    ),
                                    icon: XMarkIcon,
                                    onClick: () => setSearchQuery(''),
                                },
                            ]}
                        />
                    )
                ) : (
                    <div
                        className={`task-list-container overflow-visible ${TASK_SHEET_CLASS} task-sheet-rails`}
                    >
                        {filteredViews.map((view) => (
                            <div key={view.uid}>
                                <ViewRow
                                    view={view}
                                    filterCount={filterCount(view)}
                                    onTogglePin={togglePin}
                                    onDelete={openConfirmDialog}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {isConfirmDialogOpen && viewToDelete && (
                    <ConfirmDialog
                        title={t('views.deleteView')}
                        message={t('views.confirmDelete', {
                            viewName: viewToDelete.name,
                        })}
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
