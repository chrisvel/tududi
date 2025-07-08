import React from 'react';
import TagInput from '../../Tag/TagInput';

interface TaskTagsSectionProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
    availableTags: Array<{ name: string }>;
}

const TaskTagsSection: React.FC<TaskTagsSectionProps> = ({
    tags,
    onTagsChange,
    availableTags,
}) => {
    return (
        <TagInput
            onTagsChange={onTagsChange}
            initialTags={tags}
            availableTags={availableTags}
        />
    );
};

export default TaskTagsSection;
