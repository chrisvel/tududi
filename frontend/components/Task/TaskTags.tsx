import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag } from '../../entities/Tag';
import { TagIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface TaskTagsProps {
    tags: Tag[];
    onTagRemove?: (tagUid: string | undefined) => void;
    className?: string;
}

const TaskTags: React.FC<TaskTagsProps> = ({
    tags = [],
    onTagRemove,
    className,
}) => {
    const navigate = useNavigate();

    const handleTagClick = (tag: Tag) => {
        if (tag.uid) {
            const slug = tag.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            navigate(`/tag/${tag.uid}-${slug}`);
        } else {
            // Fallback to old URL format if uid is not available
            navigate(`/tag/${encodeURIComponent(tag.name)}`);
        }
    };

    // Don't render anything if there are no tags
    if (!tags || tags.length === 0) {
        return null;
    }

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            {tags.map((tag, index) => (
                <div
                    key={tag.uid || tag.id || index}
                    className="flex items-center bg-gray-200 text-gray-800 text-xs font-medium px-2 py-1.5 rounded-md dark:bg-gray-700 dark:text-gray-200 cursor-pointer"
                >
                    <button
                        type="button"
                        onClick={() => handleTagClick(tag)}
                        className="flex items-center"
                    >
                        <TagIcon className="hidden md:block h-4 w-4 text-gray-500 dark:text-gray-300 mr-2" />
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                            {tag.name}
                        </span>
                    </button>
                    {onTagRemove && (
                        <button
                            type="button"
                            onClick={() => onTagRemove(tag.uid)}
                            className="ml-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400 focus:outline-none"
                            aria-label={`Remove tag ${tag.name}`}
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

export default TaskTags;
