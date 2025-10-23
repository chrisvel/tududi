import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CheckCircleIcon,
    FolderIcon,
    RectangleStackIcon,
    DocumentTextIcon,
    TagIcon,
} from '@heroicons/react/24/outline';
import { searchUniversal } from '../../utils/searchService';

interface SearchResultsProps {
    searchQuery: string;
    selectedFilters: string[];
    selectedPriority: string | null;
    selectedDue: string | null;
    selectedTags: string[];
    onClose: () => void;
}

interface SearchResult {
    type: 'Task' | 'Project' | 'Area' | 'Note' | 'Tag';
    id: number;
    uid?: string;
    name: string;
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({
    searchQuery,
    selectedFilters,
    selectedPriority,
    selectedDue,
    selectedTags,
    onClose,
}) => {
    const { t } = useTranslation();
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchResults = async () => {
            if (
                !searchQuery.trim() &&
                selectedFilters.length === 0 &&
                !selectedPriority &&
                !selectedDue &&
                selectedTags.length === 0
            ) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const data = await searchUniversal({
                    query: searchQuery,
                    filters: selectedFilters,
                    priority: selectedPriority || undefined,
                    due: selectedDue || undefined,
                    tags: selectedTags.length > 0 ? selectedTags : undefined,
                });
                setResults(data);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(fetchResults, 300);
        return () => clearTimeout(debounceTimer);
    }, [
        searchQuery,
        selectedFilters,
        selectedPriority,
        selectedDue,
        selectedTags,
    ]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'Task':
                return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
            case 'Project':
                return <FolderIcon className="h-5 w-5 text-purple-500" />;
            case 'Area':
                return (
                    <RectangleStackIcon className="h-5 w-5 text-green-500" />
                );
            case 'Note':
                return <DocumentTextIcon className="h-5 w-5 text-yellow-500" />;
            case 'Tag':
                return <TagIcon className="h-5 w-5 text-pink-500" />;
            default:
                return null;
        }
    };

    const handleResultClick = (result: SearchResult) => {
        const identifier = result.uid || result.id;

        // Close the dropdown before navigating
        onClose();

        // Also close mobile search bar if on mobile
        if (window.innerWidth < 768) {
            window.dispatchEvent(new CustomEvent('closeMobileSearch'));
        }

        switch (result.type) {
            case 'Task':
                navigate(`/task/${identifier}`);
                break;
            case 'Project':
                navigate(`/projects/${identifier}`);
                break;
            case 'Area':
                navigate(`/areas/${identifier}`);
                break;
            case 'Note':
                navigate(`/notes/${identifier}`);
                break;
            case 'Tag':
                navigate(`/tags/${identifier}`);
                break;
        }
    };

    if (isLoading) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <div className="animate-pulse">Searching...</div>
            </div>
        );
    }

    if (
        !searchQuery.trim() &&
        selectedFilters.length === 0 &&
        !selectedPriority &&
        !selectedDue &&
        selectedTags.length === 0
    ) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">{t('search.startTyping')}</p>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">{t('search.noResults')}</p>
            </div>
        );
    }

    // Group results by type
    const groupedResults = results.reduce(
        (acc, result) => {
            if (!acc[result.type]) {
                acc[result.type] = [];
            }
            acc[result.type].push(result);
            return acc;
        },
        {} as Record<string, SearchResult[]>
    );

    return (
        <div className="flex-1 overflow-y-auto">
            {Object.entries(groupedResults).map(([type, typeResults]) => (
                <div
                    key={type}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs font-semibold text-gray-600 dark:text-gray-400">
                        {type}s
                    </div>
                    <div>
                        {typeResults.map((result) => (
                            <button
                                key={`${result.type}-${result.id}`}
                                onClick={() => handleResultClick(result)}
                                className="w-full px-4 py-3 flex items-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                            >
                                <div className="flex-shrink-0">
                                    {getIcon(result.type)}
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {result.name || result.title}
                                    </p>
                                    {result.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                            {result.description}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SearchResults;
