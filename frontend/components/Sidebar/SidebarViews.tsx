import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import { QueueListIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

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

const SidebarViews: React.FC<SidebarViewsProps> = ({
    handleNavClick,
    location,
}) => {
    const [pinnedViews, setPinnedViews] = useState<View[]>([]);

    useEffect(() => {
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

    const fetchPinnedViews = async () => {
        try {
            const response = await fetch('/api/views/pinned', {
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
                fetchPinnedViews();
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const isActiveView = (path: string) => {
        return location.pathname === path
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300';
    };

    return (
        <>
            <ul className="flex flex-col space-y-1">
                {/* "VIEWS" Title */}
                <li
                    className={`flex justify-between items-center rounded-md px-4 py-2 uppercase text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white mb-4 ${isActiveView(
                        '/views'
                    )}`}
                    onClick={() =>
                        handleNavClick(
                            '/views',
                            'Views',
                            <QueueListIcon className="h-5 w-5 mr-2" />
                        )
                    }
                >
                    <span className="flex items-center">
                        <QueueListIcon className="h-5 w-5 mr-2" />
                        Views
                    </span>
                </li>

                {/* Pinned Views */}
                {pinnedViews.length > 0 && <div className="mt-6"></div>}
                {pinnedViews.map((view) => (
                    <li
                        key={view.uid}
                        className={`flex justify-between items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${isActiveView(
                            `/views/${view.uid}`
                        )}`}
                        onClick={() =>
                            handleNavClick(
                                `/views/${view.uid}`,
                                view.name,
                                <QueueListIcon className="h-5 w-5 mr-2" />
                            )
                        }
                    >
                        <span className="flex items-center truncate">
                            <QueueListIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{view.name}</span>
                        </span>
                        <button
                            onClick={(e) => togglePin(view, e)}
                            className="text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 focus:outline-none flex-shrink-0"
                            aria-label="Unpin view"
                            title="Unpin view"
                        >
                            <StarIconSolid className="h-4 w-4" />
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
};

export default SidebarViews;
