import React, { useState } from 'react';
import { formatDisplayDate } from '../../utils/jalali';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
    fetchJournal,
    planningKeys,
    refreshPlanning,
    revertJournal,
    revertJournalGroup,
} from '../../utils/planningService';

export default function JournalPanel({
    onReverted,
}: {
    onReverted?: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const { data, error: loadError } = useSWR(
        planningKeys.journal,
        fetchJournal
    );
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const undo = async (uids: string[]) => {
        setBusy(true);
        setError('');
        try {
            if (uids.length === 1) await revertJournal(uids[0]);
            else await revertJournalGroup(uids);
            setSelected([]);
            await refreshPlanning();
            await onReverted?.();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <section
            className="mt-6 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            aria-label={t('ltdPlanning.journal')}
        >
            <h2 className="font-medium">{t('ltdPlanning.journal')}</h2>
            {(error || loadError) && (
                <p role="alert">{error || loadError.message}</p>
            )}
            {data?.entries.length === 0 && (
                <p className="text-sm text-gray-500">
                    {t('ltdPlanning.noJournal')}
                </p>
            )}
            {data?.entries.map((entry) => (
                <div
                    key={entry.uid}
                    className="flex flex-wrap items-center gap-3 text-sm"
                >
                    {!entry.reverted_at && (
                        <input
                            type="checkbox"
                            aria-label={t('ltdPlanning.selectUndo', {
                                operation:
                                    entry.operation ||
                                    entry.op ||
                                    entry.entity_type,
                            })}
                            checked={selected.includes(entry.uid)}
                            onChange={(e) =>
                                setSelected((current) =>
                                    e.target.checked
                                        ? [...current, entry.uid]
                                        : current.filter(
                                              (uid) => uid !== entry.uid
                                          )
                                )
                            }
                        />
                    )}
                    <bdi className="min-w-0 break-words">
                        {t(
                            `ltdPlanning.operations.${entry.operation || entry.op}`,
                            entry.operation || entry.op || entry.entity_type
                        )}
                    </bdi>
                    <time className="text-gray-500">
                        {formatDisplayDate(new Date(entry.created_at), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        })}
                    </time>
                    {entry.reverted_at ? (
                        <span>{t('ltdPlanning.reverted')}</span>
                    ) : (
                        <button
                            type="button"
                            disabled={busy}
                            className="rounded border px-3 py-1"
                            onClick={() => void undo([entry.uid])}
                        >
                            {t('ltdPlanning.undo')}
                        </button>
                    )}
                </div>
            ))}
            {selected.length > 1 && (
                <button
                    type="button"
                    disabled={busy}
                    className="rounded border px-3 py-1"
                    onClick={() => void undo(selected)}
                >
                    {t('ltdPlanning.undoSelected')}
                </button>
            )}
        </section>
    );
}
