import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
    getTagLink?: (tag: any) => string;
}

const TaskTagsCard: React.FC<TaskTagsCardProps> = ({
    task,
    availableTags,
    hasLoadedTags,
    isLoadingTags,
    onUpdate,
    onLoadTags,
    getTagLink,
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
        <div className="space-y-2">
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
                            <div
                                key={tag.uid || tag.id || tag.name}
                                className={`group flex w-full items-center justify-between px-3 py-2.5 bg-white dark:bg-gray-900 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                                    index === 0 ? 'rounded-t-lg' : ''
                                } ${index === task.tags.length - 1 ? 'rounded-b-lg' : ''}`}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit();
                                    }}
                                    className="flex items-center space-x-2 min-w-0 flex-1 text-left"
                                >
                                    <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                        {tag.name}
                                    </span>
                                </button>
                                <Link
                                    to={getTagLink ? getTagLink(tag) : '#'}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0"
                                    title={t('tag.viewTag', 'Go to tag')}
                                >
                                    <ArrowRightIcon className="h-4 w-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        onClick={handleStartEdit}
                        className="p-6 cursor-pointer transition-colors"
                    >
                        <div className="flex flex-col items-center justify-center py-6 text-gray-500 dark:text-gray-400">
                            <TagIcon className="h-10 w-10 mb-3 opacity-50" />
                            <span className="text-sm text-center">
                                {t('task.noTags', 'Add tags')}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskTagsCard;
