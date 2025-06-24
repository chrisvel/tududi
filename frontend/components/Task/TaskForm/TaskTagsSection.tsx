import React from 'react';
import { useTranslation } from 'react-i18next';
import TagInput from '../../Tag/TagInput';

interface TaskTagsSectionProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: Array<{name: string}>;
}

const TaskTagsSection: React.FC<TaskTagsSectionProps> = ({
  tags,
  onTagsChange,
  availableTags
}) => {
  const { t } = useTranslation();

  return (
    <TagInput
      onTagsChange={onTagsChange}
      initialTags={tags}
      availableTags={availableTags}
    />
  );
};

export default TaskTagsSection;