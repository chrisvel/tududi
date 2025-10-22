import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    InformationCircleIcon,
    BookmarkIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from '@heroicons/react/24/outline';
import FilterBadge from './FilterBadge';
import SearchResults from './SearchResults';
import { useToast } from '../Shared/ToastContext';

interface SearchMenuProps {
    searchQuery: string;
    selectedFilters: string[];
    onFilterToggle: (filter: string) => void;
    onClose: () => void;
}

const filterTypes = [
    {
        value: 'Task',
        labelKey: 'search.entityTypes.task',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    {
        value: 'Project',
        labelKey: 'search.entityTypes.project',
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    {
        value: 'Area',
        labelKey: 'search.entityTypes.area',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    {
        value: 'Note',
        labelKey: 'search.entityTypes.note',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
];

const priorityOptions = [
    { value: 'high', labelKey: 'priority.high' },
    { value: 'medium', labelKey: 'priority.medium' },
    { value: 'low', labelKey: 'priority.low' },
];

const dueOptions = [
    { value: 'today', labelKey: 'dateIndicators.today' },
    { value: 'tomorrow', labelKey: 'dateIndicators.tomorrow' },
    { value: 'next_week', labelKey: 'dateIndicators.nextWeek' },
    { value: 'next_month', labelKey: 'dateIndicators.nextMonth' },
];

const SearchMenu: React.FC<SearchMenuProps> = ({
    searchQuery,
    selectedFilters,
    onFilterToggle,
    onClose,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [selectedPriority, setSelectedPriority] = useState<string | null>(
        null
    );
    const [selectedDue, setSelectedDue] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [availableTags, setAvailableTags] = useState<
        Array<{ id: number; name: string }>
    >([]);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [viewName, setViewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [showCriteria, setShowCriteria] = useState(false);

    // Fetch available tags
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await fetch('/api/tags', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const tags = await response.json();
                    setAvailableTags(tags);
                }
            } catch (error) {
                console.error('Error fetching tags:', error);
            }
        };
        fetchTags();
    }, []);

    const handlePriorityToggle = (priority: string) => {
        setSelectedPriority(selectedPriority === priority ? null : priority);
    };

    const handleDueToggle = (due: string) => {
        setSelectedDue(selectedDue === due ? null : due);
    };

    const handleTagToggle = (tagName: string) => {
        setSelectedTags((prev) =>
            prev.includes(tagName)
                ? prev.filter((t) => t !== tagName)
                : [...prev, tagName]
        );
    };

    const handleSaveView = async () => {
        if (!viewName.trim()) {
            setSaveError(t('search.viewNameRequired'));
            return;
        }

        setIsSaving(true);
        setSaveError('');

        try {
            const response = await fetch('/api/views', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: viewName.trim(),
                    search_query: searchQuery || null,
                    filters: selectedFilters,
                    priority: selectedPriority || null,
                    due: selectedDue || null,
                    tags: selectedTags.length > 0 ? selectedTags : null,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save view');
            }

            const savedView = await response.json();

            // Reset form
            setViewName('');
            setShowSaveForm(false);
            setSaveError('');

            // Show success toast with link to the view
            showSuccessToast(
                <div className="flex items-center gap-2">
                    <span>View saved successfully!</span>
                    <Link
                        to={`/views/${savedView.uid}`}
                        className="underline font-semibold hover:text-green-100"
                        onClick={onClose}
                    >
                        View now
                    </Link>
                </div>
            );

            // Notify sidebar to refresh
            window.dispatchEvent(new CustomEvent('viewUpdated'));
        } catch (err) {
            setSaveError(t('search.failedToSave'));
            showErrorToast('Failed to save view. Please try again.');
            console.error('Error saving view:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelSave = () => {
        setShowSaveForm(false);
        setViewName('');
        setSaveError('');
    };

    const buildSearchDescription = () => {
        const parts: React.ReactNode[] = [];

        // Build entity types part
        if (selectedFilters.length > 0) {
            const entities = selectedFilters.map((f) => (
                <span key={f} style={{ fontWeight: 800, fontStyle: 'normal' }}>
                    {f.toLowerCase()}s
                </span>
            ));
            const entitiesWithSeparators: React.ReactNode[] = [];
            entities.forEach((entity, index) => {
                if (index > 0) {
                    entitiesWithSeparators.push(' ' + t('search.and') + ' ');
                }
                entitiesWithSeparators.push(entity);
            });
            parts.push(...entitiesWithSeparators);
        } else {
            // If no specific entities selected, show "all items"
            parts.push(
                <span
                    key="all"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {t('search.allItems')}
                </span>
            );
        }

        // Add search query
        if (searchQuery.trim()) {
            parts.push(t('search.containingText') + ' ');
            parts.push(
                <span
                    key="query"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    &quot;{searchQuery.trim()}&quot;
                </span>
            );
        }

        // Add priority filter
        if (selectedPriority) {
            parts.push(t('search.withPriority') + ' ');
            parts.push(
                <span
                    key="priority"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {selectedPriority}
                </span>
            );
            parts.push(' ' + t('search.priority'));
        }

        // Add due date filter
        if (selectedDue) {
            const dueOption = dueOptions.find(
                (opt) => opt.value === selectedDue
            );
            const dueLabel = dueOption ? t(dueOption.labelKey) : selectedDue;
            parts.push(t('search.due') + ' ');
            parts.push(
                <span
                    key="due"
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {dueLabel}
                </span>
            );
        }

        // Add tags filter
        if (selectedTags.length > 0) {
            parts.push(t('search.taggedWith') + ' ');
            const tagElements = selectedTags.map((tag) => (
                <span
                    key={`tag-${tag}`}
                    style={{ fontWeight: 800, fontStyle: 'normal' }}
                >
                    {tag}
                </span>
            ));
            const tagsWithSeparators: React.ReactNode[] = [];
            tagElements.forEach((tagEl, index) => {
                if (index > 0) {
                    if (index === tagElements.length - 1) {
                        tagsWithSeparators.push(' ' + t('search.and') + ' ');
                    } else {
                        tagsWithSeparators.push(', ');
                    }
                }
                tagsWithSeparators.push(tagEl);
            });
            parts.push(...tagsWithSeparators);
        }

        if (parts.length === 0) return null;

        // Construct the sentence
        return (
            <>
                {t('search.searchingFor')} {parts}
            </>
        );
    };

    const searchDescription = buildSearchDescription();
    const hasActiveFilters =
        selectedFilters.length > 0 ||
        searchQuery.trim() ||
        selectedPriority ||
        selectedDue ||
        selectedTags.length > 0;

    return (
        <div className="fixed left-1/2 transform -translate-x-1/2 top-32 md:top-20 w-[95vw] md:w-[90vw] max-w-full md:max-w-4xl h-[75vh] md:h-[80vh] max-h-[600px] md:max-h-[700px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col">
            {/* Filter Badges Section */}
            <div className="border-b border-gray-200 dark:border-gray-700 overflow-y-auto max-h-[40vh] md:max-h-none">
                {/* Search Description */}
                {hasActiveFilters && searchDescription && (
                    <>
                        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                            <InformationCircleIcon className="h-6 w-6 text-black/30 dark:text-white/30 flex-shrink-0" />
                            <p
                                className="text-xl text-black/40 dark:text-white/40 flex-1"
                                style={{
                                    fontFamily: "'Lora', Georgia, serif",
                                    fontStyle: 'italic',
                                }}
                            >
                                {searchDescription}
                            </p>
                        </div>
                        <div className="border-t border-gray-300 dark:border-gray-600"></div>
                    </>
                )}

                {/* Toggle Criteria Button */}
                <div className="px-4 py-3">
                    <button
                        onClick={() => setShowCriteria(!showCriteria)}
                        className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        <span>{t('search.criteria')}</span>
                        {showCriteria ? (
                            <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                            <ChevronDownIcon className="h-5 w-5" />
                        )}
                    </button>
                </div>

                {/* Collapsible Criteria Section */}
                {showCriteria && (
                    <div className="px-4 pb-4">
                        {/* Entity Type Badges */}
                        <div className="flex flex-wrap gap-2">
                            {filterTypes.map((filter) => {
                                const isSelected = selectedFilters.includes(
                                    filter.value
                                );
                                return (
                                    <FilterBadge
                                        key={filter.value}
                                        name={t(filter.labelKey)}
                                        color={filter.color}
                                        isSelected={isSelected}
                                        onToggle={() =>
                                            onFilterToggle(filter.value)
                                        }
                                    />
                                );
                            })}
                        </div>

                        {/* Divider */}
                        <div className="my-4 border-t border-gray-300 dark:border-gray-600"></div>

                        {/* Metadata Filters */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                                {t('search.metadataFilters')}
                            </div>

                            {/* Priority Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.priorityFilter')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {priorityOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey)}
                                            isSelected={
                                                selectedPriority ===
                                                option.value
                                            }
                                            onToggle={() =>
                                                handlePriorityToggle(
                                                    option.value
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Due Date Filters */}
                            <div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                    {t('search.dueFilter')}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {dueOptions.map((option) => (
                                        <FilterBadge
                                            key={option.value}
                                            name={t(option.labelKey)}
                                            isSelected={
                                                selectedDue === option.value
                                            }
                                            onToggle={() =>
                                                handleDueToggle(option.value)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Tags Filters */}
                            {availableTags.length > 0 && (
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                                        {t('search.tagsFilter')}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableTags.map((tag) => (
                                            <FilterBadge
                                                key={tag.id}
                                                name={tag.name}
                                                color="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
                                                isSelected={selectedTags.includes(
                                                    tag.name
                                                )}
                                                onToggle={() =>
                                                    handleTagToggle(tag.name)
                                                }
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Save as Smart View Section */}
                        {hasActiveFilters && (
                            <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                                {!showSaveForm ? (
                                    <button
                                        onClick={() => setShowSaveForm(true)}
                                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                    >
                                        <BookmarkIcon className="h-4 w-4" />
                                        <span>
                                            {t('search.saveAsSmartView')}
                                        </span>
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <div>
                                            <label
                                                htmlFor="viewName"
                                                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2"
                                            >
                                                {t('search.viewName')}{' '}
                                                <span className="text-red-500">
                                                    *
                                                </span>
                                            </label>
                                            <input
                                                type="text"
                                                id="viewName"
                                                value={viewName}
                                                onChange={(e) => {
                                                    setViewName(e.target.value);
                                                    setSaveError('');
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleSaveView();
                                                    } else if (
                                                        e.key === 'Escape'
                                                    ) {
                                                        handleCancelSave();
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder={t(
                                                    'search.viewNamePlaceholder'
                                                )}
                                                autoFocus
                                            />
                                            {saveError && (
                                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                                    {saveError}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex gap-2 justify-end">
                                            <button
                                                type="button"
                                                onClick={handleCancelSave}
                                                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                            >
                                                {t('search.cancel')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveView}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-md transition-colors"
                                            >
                                                {isSaving
                                                    ? t('search.saving')
                                                    : t('search.saveView')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Search Results */}
            <SearchResults
                searchQuery={searchQuery}
                selectedFilters={selectedFilters}
                selectedPriority={selectedPriority}
                selectedDue={selectedDue}
                selectedTags={selectedTags}
                onClose={onClose}
            />
        </div>
    );
};

export default SearchMenu;
