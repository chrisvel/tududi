import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrashIcon,
    MagnifyingGlassIcon,
    StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import ConfirmDialog from './Shared/ConfirmDialog';

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
    const navigate = useNavigate();
    const [views, setViews] = useState<View[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredViewId, setHoveredViewId] = useState<number | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [viewToDelete, setViewToDelete] = useState<View | null>(null);

    useEffect(() => {
        fetchViews();
    }, []);

    const fetchViews = async () => {
        try {
            const response = await fetch('/api/views', {
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
            const response = await fetch(`/api/views/${viewToDelete.uid}`, {
                method: 'DELETE',
                credentials: 'include',
            });
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
            const response = await fetch(`/api/views/${view.uid}`, {
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
                    Loading views...
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Views Header */}
                <div className="flex items-center mb-8">
                    <h2 className="text-2xl font-light">Smart Views</h2>
                </div>

                {/* Search Bar */}
                <div className="mb-4">
                    <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-2">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search views..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Views List */}
                {filteredViews.length === 0 ? (
                    <p className="text-gray-700 dark:text-gray-300">
                        No views found. Create a view by performing a search and
                        clicking &quot;Save as Smart View&quot;.
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
                                                        • Priority:{' '}
                                                        {view.priority}
                                                    </p>
                                                )}
                                                {view.due && (
                                                    <p>• Due: {view.due}</p>
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
                                                aria-label="Toggle pin"
                                                title={
                                                    view.is_pinned
                                                        ? 'Unpin view'
                                                        : 'Pin view'
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
                        title="Delete View"
                        message={`Are you sure you want to delete the view "${viewToDelete.name}"?`}
                        onConfirm={handleDeleteView}
                        onCancel={closeConfirmDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default Views;
