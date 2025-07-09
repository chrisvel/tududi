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
    onChange,
}) => {
    const { t } = useTranslation();

    return (
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 mb-4 flex-1 flex flex-col">
            <textarea
                id={`task_note_${taskId}`}
                name="note"
                value={value}
                onChange={onChange}
                className="block w-full border-0 focus:outline-none focus:ring-0 p-3 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none flex-1 min-h-[200px]"
                placeholder={t(
                    'forms.noteContentPlaceholder',
                    'Add task description...'
                )}
            />
        </div>
    );
};

export default TaskContentSection;
