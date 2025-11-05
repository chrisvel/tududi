import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import MarkdownRenderer from '../../Shared/MarkdownRenderer';

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
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

    return (
        <div className="sm:px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex-1 flex flex-col mb-2">
            {/* Content area with floating buttons */}
            <div className="relative flex-1 flex flex-col">
                {/* Floating toggle buttons */}
                <div className="absolute top-2 right-2 z-10 flex space-x-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('edit')}
                        className={`p-1.5 rounded-md transition-colors ${
                            activeTab === 'edit'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                        title="Edit"
                    >
                        <PencilIcon className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('preview')}
                        className={`p-1.5 rounded-md transition-colors ${
                            activeTab === 'preview'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                        title="Preview"
                    >
                        <EyeIcon className="h-3 w-3" />
                    </button>
                </div>

                {activeTab === 'edit' ? (
                    <textarea
                        id={`task_note_${taskId}`}
                        name="note"
                        value={value}
                        onChange={onChange}
                        className="block w-full sm:border sm:border-gray-300 sm:dark:border-gray-600 sm:rounded-md shadow-sm py-2 sm:py-3 px-3 pr-20 sm:px-3 sm:pr-20 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none flex-1 min-h-0 sm:focus:ring-2 sm:focus:ring-blue-500 transition duration-150 ease-in-out"
                        placeholder={t(
                            'forms.noteContentPlaceholder',
                            'Enter content'
                        )}
                    />
                ) : (
                    <div className="block w-full sm:border sm:border-gray-300 sm:dark:border-gray-600 sm:rounded-md shadow-sm py-2 px-3 pr-20 sm:py-3 sm:px-3 sm:pr-20 text-sm bg-gray-50 dark:bg-gray-800 flex-1 min-h-0 overflow-y-auto">
                        {value ? (
                            <MarkdownRenderer
                                content={value}
                                onContentChange={(newContent) => {
                                    // Create synthetic event
                                    const syntheticEvent = {
                                        target: {
                                            name: 'note',
                                            value: newContent,
                                        },
                                    } as React.ChangeEvent<HTMLTextAreaElement>;
                                    onChange(syntheticEvent);
                                }}
                            />
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 italic">
                                No content to preview. Switch to Edit mode to
                                add content.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskContentSection;
