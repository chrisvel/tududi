import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TagIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import TagInput from '../../Tag/TagInput';
import { Task } from '../../../entities/Task';
import { Tag } from '../../../entities/Tag';

interface TaskTagsCardProps {
    task: Task;
    availableTags: Tag[];
    hasLoadedTags: boolean;
    isLoadingTags: boolean;
    onUpdate: (tags: string[]) => Promise<void>;
    onLoadTags: () => void;
}

const TaskTagsCard: React.FC<TaskTagsCardProps> = ({
    task,
    availableTags,
    hasLoadedTags,
    isLoadingTags,
    onUpdate,
    onLoadTags,
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editedTags, setEditedTags] = useState<string[]>(
        task?.tags?.map((tag: any) => tag.name) || []
    );

    useEffect(() => {
        setEditedTags(task?.tags?.map((tag: any) => tag.name) || []);
    }, [task?.tags]);

    const handleStartEdit = () => {
        setEditedTags(task?.tags?.map((tag: any) => tag.name) || []);
        if (!hasLoadedTags && !isLoadingTags) {
            onLoadTags();
        }
        setIsEditing(true);
    };

    const handleSave = async () => {
        const currentTags = task.tags?.map((tag: any) => tag.name) || [];
        if (
            editedTags.length === currentTags.length &&
            editedTags.every((tag, idx) => tag === currentTags[idx])
        ) {
            setIsEditing(false);
            return;
        }

        await onUpdate(editedTags);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedTags(task.tags?.map((tag: any) => tag.name) || []);
        setIsEditing(false);
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {t('task.tags', 'Tags')}
            </h4>
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors space-y-3">
                {isEditing ? (
                    <div className="space-y-3 p-4">
                        <TagInput
                            initialTags={editedTags}
                            onTagsChange={setEditedTags}
                            availableTags={availableTags}
                            onFocus={() => {
                                if (!hasLoadedTags && !isLoadingTags) {
                                    onLoadTags();
                                }
                            }}
                        />
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                            >
                                {t('common.save', 'Save')}
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                        </div>
                    </div>
                ) : task.tags && task.tags.length > 0 ? (
                    <div>
                        {task.tags.map((tag: any, index: number) => (
                            <button
                                key={tag.uid || tag.id || tag.name}
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit();
                                }}
                                className={`group flex w-full items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-900 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                    index === 0 ? 'rounded-t-lg' : ''
                                } ${index === task.tags.length - 1 ? 'rounded-b-lg' : ''}`}
                            >
                                <div className="flex items-center space-x-2 min-w-0">
                                    <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                        {tag.name}
                                    </span>
                                </div>
                                <ArrowRightIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div
                        onClick={handleStartEdit}
                        className="p-4 cursor-pointer transition-colors"
                    >
                        <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                            {t('task.noTags', 'No tags')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskTagsCard;
