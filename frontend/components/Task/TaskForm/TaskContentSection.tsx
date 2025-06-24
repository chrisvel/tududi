import React from 'react';
import { useTranslation } from 'react-i18next';

interface TaskContentSectionProps {
  taskId: number | undefined;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const TaskContentSection: React.FC<TaskContentSectionProps> = ({
  taskId,
  value,
  onChange
}) => {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
        {t('forms.noteContent', 'Content')}
      </label>
      <textarea
        id={`task_note_${taskId}`}
        name="note"
        rows={3}
        value={value}
        onChange={onChange}
        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        placeholder={t('forms.noteContentPlaceholder', 'Add task description...')}
      />
    </div>
  );
};

export default TaskContentSection;