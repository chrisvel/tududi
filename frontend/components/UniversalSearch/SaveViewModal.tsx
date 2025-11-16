import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';

interface SaveViewModalProps {
    searchQuery: string;
    filters: string[];
    priority: string | null;
    due: string | null;
    onClose: () => void;
    onSave: () => void;
}

const SaveViewModal: React.FC<SaveViewModalProps> = ({
    searchQuery,
    filters,
    priority,
    due,
    onClose,
    onSave,
}) => {
    const [viewName, setViewName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!viewName.trim()) {
            setError('View name is required');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(getApiPath('views'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: viewName.trim(),
                    search_query: searchQuery || null,
                    filters: filters,
                    priority: priority || null,
                    due: due || null,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save view');
            }

            onSave();
        } catch (err) {
            setError('Failed to save view. Please try again.');
            console.error('Error saving view:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[60]"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-[70] p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        Save as Smart View
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label
                            htmlFor="viewName"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                        >
                            View Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="viewName"
                            value={viewName}
                            onChange={(e) => {
                                setViewName(e.target.value);
                                setError('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter view name"
                            autoFocus
                        />
                        {error && (
                            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            This view will save:
                        </p>
                        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                            {filters.length > 0 && (
                                <li>• Filters: {filters.join(', ')}</li>
                            )}
                            {searchQuery && (
                                <li>• Search: &quot;{searchQuery}&quot;</li>
                            )}
                            {priority && <li>• Priority: {priority}</li>}
                            {due && <li>• Due: {due}</li>}
                        </ul>
                    </div>

                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
                        >
                            {isLoading ? 'Saving...' : 'Save View'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default SaveViewModal;
