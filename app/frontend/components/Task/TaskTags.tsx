import { TagIcon } from '@heroicons/react/24/solid';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Tag {
  id: number;
  name: string;
}

interface TaskTagsProps {
  tags: Tag[];
  className?: string; 
}

const TaskTags: React.FC<TaskTagsProps> = ({ tags = [], className }) => {
  const navigate = useNavigate();

  const handleTagClick = (tagName: string) => {
    navigate(`/tasks?tag=${tagName}`); 
  };

  return (
    <div className={`flex space-x-2 ${className}`}>
      {tags.map((tag, index) => (
        <button
          key={tag.id || index}
          onClick={() => handleTagClick(tag.name)}
          className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
          <span className="text-xs text-gray-700 dark:text-gray-300">{tag.name}</span>
        </button>
      ))}
    </div>
  );
};

export default TaskTags;
