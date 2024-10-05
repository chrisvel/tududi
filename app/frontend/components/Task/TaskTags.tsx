import React from 'react';

interface TaskTagsProps {
  tags: { name: string }[] | undefined;
}

const TaskTags: React.FC<TaskTagsProps> = ({ tags }) => {
  return (
    <div className="flex space-x-2">
      {tags?.map((tag, index) => (
        <span key={`${tag.name}-${index}`} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
          {tag.name}
        </span>
      ))}
    </div>
  );
};

export default TaskTags;
