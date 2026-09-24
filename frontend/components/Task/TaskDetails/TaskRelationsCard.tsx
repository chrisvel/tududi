import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TaskRelation, TaskRelationType } from '../../../entities/Task';
import {
    createTaskRelation,
    deleteTaskRelation,
    fetchTaskRelations,
} from '../../../utils/tasksService';
import { searchUniversal } from '../../../utils/searchService';
import {
    isTaskArchived,
    isTaskCancelled,
    isTaskDone,
} from '../../../constants/taskStatus';
import { useToast } from '../../Shared/ToastContext';

interface TaskRelationsCardProps {
    taskUid: string;
    onRelationsChange?: () => void;
}

interface SearchHit {
    uid: string;
    name: string;
}

const RELATION_TYPES: TaskRelationType[] = [
    'blocks',
    'blocked_by',
    'related_to',
    'duplicates',
    'duplicated_by',
];

const TaskRelationsCard: React.FC<TaskRelationsCardProps> = ({
    taskUid,
    onRelationsChange,
}) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const [relations, setRelations] = useState<TaskRelation[]>([]);
    const [adding, setAdding] = useState(false);
    const [type, setType] = useState<TaskRelationType>('blocked_by');
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<SearchHit[]>([]);

    const typeLabel = (relationType: TaskRelationType): string =>
        ({
            blocks: t('relations.types.blocks', 'Blocks'),
            blocked_by: t('relations.types.blocked_by', 'Blocked by'),
            related_to: t('relations.types.related_to', 'Related to'),
            duplicates: t('relations.types.duplicates', 'Duplicates'),
            duplicated_by: t('relations.types.duplicated_by', 'Duplicated by'),
        })[relationType];

    const load = useCallback(async () => {
        try {
            setRelations(await fetchTaskRelations(taskUid));
        } catch (error) {
            console.error('Error loading task relations:', error);
        }
    }, [taskUid]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!adding || query.trim().length < 2) {
            setHits([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const { results } = await searchUniversal({
                    query: query.trim(),
                    filters: ['Task'],
                    limit: 8,
                    status: 'all',
                });
                if (cancelled) return;
                const linked = new Set(relations.map((r) => r.task.uid));
                setHits(
                    results
                        .filter(
                            (r) =>
                                r.uid && r.uid !== taskUid && !linked.has(r.uid)
                        )
                        .map((r) => ({
                            uid: r.uid as string,
                            name: r.name || r.title || '',
                        }))
                );
            } catch {
                if (!cancelled) setHits([]);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, adding, relations, taskUid]);

    const closeAdd = () => {
        setAdding(false);
        setQuery('');
        setHits([]);
    };

    const handleAdd = async (targetUid: string) => {
        try {
            await createTaskRelation(taskUid, targetUid, type);
            closeAdd();
            await load();
            onRelationsChange?.();
        } catch (error) {
            showErrorToast(
                (error as Error).message ||
                    t('relations.addFailed', 'Failed to add relation.')
            );
        }
    };

    const handleRemove = async (relationUid: string) => {
        try {
            await deleteTaskRelation(taskUid, relationUid);
            await load();
            onRelationsChange?.();
        } catch (error) {
            showErrorToast(
                (error as Error).message ||
                    t('relations.removeFailed', 'Failed to remove relation.')
            );
        }
    };

    const grouped = RELATION_TYPES.map((relationType) => ({
        relationType,
        items: relations.filter((r) => r.type === relationType),
    })).filter((group) => group.items.length > 0);

    return (
        <div data-testid="task-relations-card">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                {t('relations.title', 'Relations')}
                {relations.length > 0 && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        ({relations.length})
                    </span>
                )}
            </h3>

            {grouped.map(({ relationType, items }) => (
                <div key={relationType} className="mb-3">
                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                        {typeLabel(relationType)}
                    </div>
                    <div className="space-y-1">
                        {items.map((relation) => {
                            const resolved =
                                isTaskDone(relation.task.status) ||
                                isTaskArchived(relation.task.status) ||
                                isTaskCancelled(relation.task.status);
                            return (
                                <div
                                    key={relation.uid}
                                    className="group flex items-center justify-between py-2 px-4 rounded-lg shadow-sm bg-white dark:bg-gray-900"
                                >
                                    <Link
                                        to={`/task/${relation.task.uid}`}
                                        className={`text-sm truncate hover:underline ${
                                            resolved
                                                ? 'text-gray-400 dark:text-gray-500 line-through'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {relation.task.name}
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleRemove(relation.uid)
                                        }
                                        className="ml-3 p-1 text-gray-400 hover:text-red-500 focus:outline-none"
                                        aria-label={t(
                                            'relations.remove',
                                            'Remove relation'
                                        )}
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {adding ? (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <select
                            value={type}
                            onChange={(e) =>
                                setType(e.target.value as TaskRelationType)
                            }
                            className="text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-1 px-2"
                            data-testid="task-relation-type"
                        >
                            {RELATION_TYPES.map((relationType) => (
                                <option key={relationType} value={relationType}>
                                    {typeLabel(relationType)}
                                </option>
                            ))}
                        </select>
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') closeAdd();
                            }}
                            placeholder={t(
                                'relations.searchPlaceholder',
                                'Search for a task...'
                            )}
                            className="flex-1 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none"
                            data-testid="task-relation-search"
                        />
                        <button
                            type="button"
                            onClick={closeAdd}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                    </div>
                    {hits.length > 0 && (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                            {hits.map((hit) => (
                                <li key={hit.uid}>
                                    <button
                                        type="button"
                                        onClick={() => void handleAdd(hit.uid)}
                                        className="w-full text-left text-sm py-2 px-1 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        {hit.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    data-testid="task-relation-add"
                >
                    <PlusCircleIcon className="h-5 w-5 mr-2" />
                    {t('relations.add', 'Add relation')}
                </button>
            )}
        </div>
    );
};

export default TaskRelationsCard;
