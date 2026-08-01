import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    TagIcon,
    PlusCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Tag } from '../../entities/Tag';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { createTagUrl } from '../../utils/slugUtils';

interface SidebarTagsProps {
    handleNavClick: (path: string, title: string, icon: JSX.Element) => void;
    location: Location;
    isDarkMode: boolean;
    openTagModal: (tag: Tag | null) => void;
    tags: Tag[];
}

const SidebarTags: React.FC<SidebarTagsProps> = ({
    handleNavClick,
    location,
    openTagModal,
}) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);

    const tags = useStore((state) => state.tagsStore.tags);
    const hasLoaded = useStore((state) => state.tagsStore.hasLoaded);
    const loadTags = useStore((state) => state.tagsStore.loadTags);

    useEffect(() => {
        if (!hasLoaded) {
            loadTags();
        }
    }, [hasLoaded, loadTags]);

    const isActive = (path: string) => location.pathname === path;

    const itemClass = (path: string) =>
        `group flex justify-between items-center rounded-md px-4 py-1.5 text-sm cursor-pointer hover:text-black dark:hover:text-white ${
            isActive(path)
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'text-gray-700 dark:text-gray-300'
        }`;

    const getTagPath = (tag: Tag) => {
        try {
            return createTagUrl(tag);
        } catch {
            return '/tags';
        }
    };

    const navigate = (tag: Tag) =>
        handleNavClick(getTagPath(tag), tag.name, <TagIcon className="h-4 w-4 mr-2" />);

    return (
        <div className={`flex flex-col space-y-1${isExpanded ? ' pb-3' : ''}`}>
            <div
                className={`group flex justify-between items-center px-4 py-2 uppercase rounded-md text-xs tracking-wider cursor-pointer hover:text-black dark:hover:text-white ${
                    isActive('/tags')
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        : 'text-gray-700 dark:text-gray-300'
                }`}
                onClick={() =>
                    handleNavClick('/tags', 'Tags', <TagIcon className="h-5 w-5 mr-2" />)
                }
            >
                <span className="flex items-center">
                    <TagIcon className="h-5 w-5 mr-2" />
                    {t('sidebar.tags')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openTagModal(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('sidebar.addTagAriaLabel')}
                        title={t('sidebar.addTagTitle')}
                        data-testid="add-tag-button"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                    </button>
                    {tags.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white focus:outline-none"
                            aria-label={isExpanded ? 'Collapse tags list' : 'Expand tags list'}
                        >
                            {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                            )}
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="max-h-80 overflow-y-auto overscroll-y-contain flex flex-col space-y-1">
                    {tags.map((tag) => (
                        <div
                            key={tag.uid || tag.id}
                            className={itemClass(getTagPath(tag))}
                            onClick={() => navigate(tag)}
                        >
                            <span className="flex items-center truncate">
                                <span className="w-5 mr-2 flex items-center justify-center flex-shrink-0">
                                    <TagIcon
                                        className="h-4 w-4"
                                        style={tag.color ? { color: tag.color } : undefined}
                                    />
                                </span>
                                <span className="truncate">{tag.name}</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SidebarTags;
