import React from 'react';
import TagInput from '../../Tag/TagInput';
import { Tag } from '../../../entities/Tag';

interface TaskTagsSectionProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
    availableTags: Tag[];
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
