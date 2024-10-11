import { TagIcon, XMarkIcon } from '@heroicons/react/24/solid';
import React from 'react';

interface Tag {
  id: number;
  name: string;
}

interface TaskTagsProps {
  tags: Tag[];
  onTagRemove?: (tagId: number) => void; // Optional remove callback
  className?: string; // Allows passing custom classes for spacing
}

const TaskTags: React.FC<TaskTagsProps> = ({ tags = [], onTagRemove, className }) => {
  return (
    <div className={`flex space-x-2 ${className}`}>
      {tags.map((tag, index) => (
        <div
          key={tag.id || index}
          className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg"
        >
          <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
          <span className="text-xs text-gray-700 dark:text-gray-300">{tag.name}</span>
          {onTagRemove && (
            <button
              type="button"
              onClick={() => onTagRemove(tag.id)}
              className="ml-2 text-gray-500 hover:text-red-500 focus:outline-none"
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
