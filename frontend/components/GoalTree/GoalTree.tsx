import React, { useState } from 'react';
import useSWR from 'swr';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    fetchGoalTree,
    flattenGoals,
    GoalNode,
    planningKeys,
    refreshPlanning,
} from '../../utils/planningService';
import { updateGoal } from '../../utils/goalsService';
import { createGoalUrl } from '../../utils/slugUtils';
import GoalProgressBars from './GoalProgressBars';
import JournalPanel from '../Journal/JournalPanel';

export default function GoalTree({ areaUid }: { areaUid?: string | null }) {
    const { t } = useTranslation();
    const { data, error: loadError } = useSWR(planningKeys.tree, fetchGoalTree);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [parents, setParents] = useState<Record<string, string>>({});
    const all = flattenGoals(data?.goals || []);
    const move = async (uid: string, parentId: string) => {
        setBusy(true);
        setError('');
        try {
            await updateGoal(uid, {
                parent_goal_id: parentId ? Number(parentId) : null,
            });
            await refreshPlanning();
            setParents({});
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const renderNode = (node: GoalNode) => (
        <li
            key={node.uid}
            className="min-w-0 space-y-2"
            data-testid={`goal-node-${node.uid}`}
        >
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const uid = e.dataTransfer.getData('text/ltd-goal');
                    if (uid && uid !== node.uid)
                        void move(uid, String(node.id));
                }}
                className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                        draggable={!busy}
                        onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/ltd-goal', node.uid!);
                        }}
                        data-goal-drag="true"
                        className="cursor-grab select-none rounded border px-2 py-1 text-gray-500"
                        title={t('ltdPlanning.dragGoal')}
                        aria-label={t('ltdPlanning.dragGoal')}
                    >
                        ↕
                    </span>
                    <Link
                        className="min-w-0 break-words font-medium"
                        to={createGoalUrl({
                            uid: node.uid!,
                            title: node.title,
                        })}
                    >
                        <bdi>{node.title}</bdi>
                    </Link>
                    <span className="text-xs text-gray-500">
                        {t(`goals.horizon.${node.horizon}`)}
                    </span>
                </div>
                <GoalProgressBars progress={node.progress} />
                <div className="flex flex-wrap items-center gap-2">
                    <label className="min-w-0 flex-1 text-sm">
                        {t('ltdPlanning.parent')}
                        <select
                            aria-label={t('ltdPlanning.parentFor', {
                                title: node.title,
                            })}
                            className="mt-1 w-full min-w-0 rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
                            value={
                                parents[node.uid!] ??
                                String(node.parent_goal_id ?? '')
                            }
                            onChange={(e) =>
                                setParents((current) => ({
                                    ...current,
                                    [node.uid!]: e.target.value,
                                }))
                            }
                        >
                            <option value="">
                                {t('ltdPlanning.noParent')}
                            </option>
                            {all
                                .filter((goal) => goal.id !== node.id)
                                .map((goal) => (
                                    <option key={goal.uid} value={goal.id}>
                                        {goal.title} (
                                        {t(`goals.horizon.${goal.horizon}`)})
                                    </option>
                                ))}
                        </select>
                    </label>
                    <button
                        type="button"
                        disabled={busy || parents[node.uid!] === undefined}
                        className="rounded border px-3 py-2 text-sm"
                        onClick={() => void move(node.uid!, parents[node.uid!])}
                    >
                        {t('ltdPlanning.move')}
                    </button>
                </div>
            </div>
            {node.children.length > 0 && (
                <ul className="space-y-3 border-s border-gray-200 ps-2 sm:ps-4 dark:border-gray-700">
                    {node.children.map(renderNode)}
                </ul>
            )}
        </li>
    );
    // Include ancestors for filtered descendants so the horizon relationship remains visible.
    const visible = (node: GoalNode): boolean =>
        !areaUid || node.Area?.uid === areaUid || node.children.some(visible);
    return (
        <section
            className="min-w-0 space-y-3"
            aria-label={t('ltdPlanning.tree')}
            data-testid="goal-tree"
        >
            <h2 className="font-medium">{t('ltdPlanning.tree')}</h2>
            <p className="text-sm text-gray-500">{t('ltdPlanning.moveHint')}</p>
            {(error || loadError) && (
                <p
                    role="alert"
                    className="break-words text-amber-700 dark:text-amber-300"
                >
                    {error || loadError.message}
                </p>
            )}
            {!data && !loadError && <p>{t('common.loading', 'Loading...')}</p>}
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    const uid = e.dataTransfer.getData('text/ltd-goal');
                    if (uid) void move(uid, '');
                }}
                className="rounded border border-dashed p-2 text-sm"
            >
                {t('ltdPlanning.rootDrop')}
            </div>
            <ul className="space-y-3">
                {data?.goals.filter(visible).map(renderNode)}
            </ul>
            <JournalPanel />
        </section>
    );
}
