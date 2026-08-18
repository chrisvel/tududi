import React, { useState, useEffect } from 'react';
import { Location } from 'react-router-dom';
import {
    TagIcon,
    ChevronRightIcon,
    PlusIcon,
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
        `group flex justify-between items-center rounded-[8px] pl-[30px] pr-[10px] py-[4px] text-[13.5px] cursor-pointer text-gray-500 dark:text-[oklch(82%_0.006_95)] hover:bg-gray-100 dark:hover:bg-[oklch(24%_0.015_250)] ${
            isActive(path) ? 'bg-gray-100 dark:bg-[oklch(24%_0.015_250)]' : ''
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
        <div className="flex flex-col">
            <div
                className={`group flex justify-between items-center px-[10px] py-[4px] rounded-md hover:bg-gray-100 dark:hover:bg-white/5 ${
                    location.pathname === '/tags'
                        ? 'bg-gray-100 dark:bg-white/5'
                        : ''
                }`}
            >
                <span
                    className={`flex items-center gap-[6px] text-[10.5px] tracking-[0.01em] font-semibold uppercase cursor-pointer hover:text-black dark:hover:text-white ${
                        location.pathname === '/tags'
                            ? 'text-black dark:text-white'
                            : 'text-gray-400 dark:text-[oklch(58%_0.006_95)]'
                    }`}
                    onClick={() => {
                        setIsExpanded(true);
                        handleNavClick('/tags', t('sidebar.tags'), <TagIcon className="h-4 w-4 mr-2" />);
                    }}
                >
                    <TagIcon className="h-[14px] w-[14px]" />
                    {t('sidebar.tags')}
                </span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openTagModal(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        aria-label={t('tags.addTag', 'Add Tag')}
                        title={t('tags.addTag', 'Add Tag')}
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                    </button>
                    {tags.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded((v) => !v);
                            }}
                            className="text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white focus:outline-none"
                        >
                            <ChevronRightIcon
                                className="h-3 w-3 transition-transform duration-150"
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                            />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="max-h-[168px] overflow-y-auto overscroll-y-contain flex flex-col gap-0.5 mb-1.5">
                    {tags.map((tag) => (
                        <div
                            key={tag.uid || tag.id}
                            className={itemClass(getTagPath(tag))}
                            onClick={() => navigate(tag)}
                        >
                            <span className="truncate min-w-0">
                                {tag.name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SidebarTags;
