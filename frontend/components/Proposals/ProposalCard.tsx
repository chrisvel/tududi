// Life-to-Day (T-704): one Proposal with a preview of every change, and
// Apply (all or selected), Reject and Undo. Text from the user or the
// client sits in <bdi> so it keeps its own direction in RTL.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate } from '../../utils/jalali';
import { formatMinute } from '../DailyPlan/planUtils';
import {
    Proposal,
    ProposalOp,
    applyProposal,
    rejectProposal,
    undoProposal,
} from '../../utils/proposalsService';
import { lessonLine } from '../Lessons/effectText';

const day = (value: string) =>
    formatDisplayDate(new Date(`${value}T12:00:00Z`), { dateStyle: 'medium' });

function OpPreview({ op }: { op: ProposalOp }) {
    const { t } = useTranslation();
    if (op.type === 'create_task')
        return (
            <span>
                <bdi>{op.title}</bdi> · {op.est_min} {t('ltdAi.minutes')} ·{' '}
                <bdi>{op.starter_step}</bdi>
            </span>
        );
    if (op.type === 'schedule_block' || op.type === 'move_block') {
        return (
            <span>
                {op.type === 'move_block' && op.from_date && (
                    <span>{day(op.from_date)} → </span>
                )}
                <span className="font-mono" dir="ltr">
                    {formatMinute(op.start_minute)}–
                    {formatMinute(op.start_minute + op.duration_minutes)}
                </span>{' '}
                · <bdi>{op.task_name}</bdi>{' '}
                <span className="text-gray-500">({day(op.date)})</span>
            </span>
        );
    }
    if (op.type === 'create_goal') {
        return (
            <span>
                {t('ltdProposals.ops.createGoal')} <bdi>{op.title}</bdi>{' '}
                <span className="text-gray-500">
                    ({t(`goals.horizon.${op.horizon}`, op.horizon)})
                </span>
                {op.why && <bdi className="block">{op.why}</bdi>}
                {op.parent_title && (
                    <>
                        {' '}
                        {t('ltdProposals.ops.under')}{' '}
                        <bdi>{op.parent_title}</bdi>
                    </>
                )}
            </span>
        );
    }
    // T-1104: a lesson to create or edit, with its if/then and links.
    if (op.type === 'create_lesson' || op.type === 'update_lesson') {
        const ifText =
            op.type === 'create_lesson' ? op.if_text : op.changes.if_text;
        const thenText =
            op.type === 'create_lesson' ? op.then_text : op.changes.then_text;
        return (
            <span>
                {op.type === 'create_lesson'
                    ? t('ltdProposals.ops.createLesson', 'New lesson:')
                    : t('ltdProposals.ops.updateLesson', 'Edit lesson:')}{' '}
                <bdi>
                    {op.type === 'create_lesson' ? op.title : op.lesson_title}
                </bdi>
                {op.type === 'update_lesson' &&
                    op.changes.title &&
                    op.changes.title !== op.lesson_title && (
                        <>
                            {' → '}
                            <bdi>{op.changes.title}</bdi>
                        </>
                    )}
                {op.type === 'update_lesson' && op.changes.status && (
                    <span className="text-gray-500">
                        {' '}
                        (
                        {t(
                            `ltdLessons.status.${op.changes.status}`,
                            op.changes.status
                        )}
                        )
                    </span>
                )}
                {ifText && thenText && (
                    <bdi className="block">
                        {lessonLine(
                            {
                                uid: op.id,
                                title: '',
                                if_text: ifText,
                                then_text: thenText,
                                review_on: null,
                            },
                            t
                        )}
                    </bdi>
                )}
                {op.links && op.links.length > 0 && (
                    <span className="block text-gray-500">
                        {op.links.map((link, index) => (
                            <React.Fragment key={`${link.type}:${link.uid}`}>
                                {index > 0 && ' · '}
                                <bdi>{link.title ?? link.uid}</bdi>
                            </React.Fragment>
                        ))}
                    </span>
                )}
            </span>
        );
    }
    if (op.type !== 'update_task') return null;
    return (
        <span>
            <bdi>{op.task_name}</bdi> · {t('ltdProposals.ops.due')}{' '}
            <del className="text-gray-500">
                {op.before_day
                    ? day(op.before_day)
                    : t('ltdProposals.ops.noDue')}
            </del>{' '}
            → <ins className="no-underline font-medium">{day(op.after)}</ins>
        </span>
    );
}

export default function ProposalCard({
    proposal,
    onChanged,
}: {
    proposal: Proposal;
    onChanged: () => Promise<unknown> | void;
}) {
    const { t } = useTranslation();
    const pending = proposal.status === 'pending';
    const [selected, setSelected] = useState<string[]>(
        proposal.ops.map((op) => op.id)
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const act = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        try {
            await fn();
            await onChanged();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const all = selected.length === proposal.ops.length;
    return (
        <article
            className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            aria-labelledby={`proposal-${proposal.uid}`}
            data-testid={`proposal-${proposal.uid}`}
        >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`proposal-${proposal.uid}`} className="font-medium">
                    <bdi>{proposal.title}</bdi>
                </h2>
                <span className="text-xs text-gray-500">
                    {t(`ltdProposals.status.${proposal.status}`)} ·{' '}
                    {t('ltdProposals.from')}{' '}
                    <bdi>
                        {proposal.client_id ||
                            t(`ltdProposals.origin.${proposal.origin}`)}
                    </bdi>{' '}
                    ·{' '}
                    <time dateTime={proposal.created_at}>
                        {formatDisplayDate(new Date(proposal.created_at), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </time>
                </span>
            </header>
            {proposal.rationale && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    <bdi>{proposal.rationale}</bdi>
                </p>
            )}
            {pending && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('ltdProposals.nothingChanged')}
                </p>
            )}
            <ul
                className="space-y-1 text-sm"
                aria-label={t('ltdProposals.changes')}
            >
                {proposal.ops.map((op) => (
                    <li key={op.id} className="flex items-start gap-2">
                        {pending ? (
                            <input
                                type="checkbox"
                                className="mt-1"
                                aria-label={t('ltdProposals.include')}
                                checked={selected.includes(op.id)}
                                onChange={(e) =>
                                    setSelected((current) =>
                                        e.target.checked
                                            ? [...current, op.id]
                                            : current.filter(
                                                  (id) => id !== op.id
                                              )
                                    )
                                }
                            />
                        ) : (
                            <span aria-hidden="true">
                                {op.result === 'failed'
                                    ? '✕'
                                    : op.result === 'applied' &&
                                        proposal.status !== 'reverted'
                                      ? '✓'
                                      : '·'}
                            </span>
                        )}
                        <span className="min-w-0 break-words">
                            <OpPreview op={op} />
                            {op.error && (
                                <span className="block text-xs text-red-600">
                                    <bdi>{op.error}</bdi>
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
            {error && (
                <p role="alert" className="text-sm text-red-600">
                    <bdi>{error}</bdi>
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                {pending && (
                    <>
                        <button
                            type="button"
                            disabled={busy || !selected.length}
                            className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                            onClick={() =>
                                void act(() =>
                                    applyProposal(
                                        proposal.uid,
                                        all ? undefined : selected
                                    )
                                )
                            }
                        >
                            {all
                                ? t('ltdProposals.applyAll')
                                : t('ltdProposals.applySelected')}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            className="rounded border px-3 py-1 text-sm"
                            onClick={() =>
                                void act(() => rejectProposal(proposal.uid))
                            }
                        >
                            {t('ltdProposals.reject')}
                        </button>
                    </>
                )}
                {(proposal.status === 'applied' ||
                    proposal.status === 'partially_applied') && (
                    <button
                        type="button"
                        disabled={busy}
                        className="rounded border px-3 py-1 text-sm"
                        onClick={() =>
                            void act(() => undoProposal(proposal.uid))
                        }
                    >
                        {t('ltdProposals.undo')}
                    </button>
                )}
            </div>
        </article>
    );
}
