import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SidePanelSection } from '../../SidePanel/SidePanelParts';
import { formatShortDate, parseDateString } from '../../../utils/dateUtils';
import {
    fetchRecurringHistory,
    RecurringHistory,
} from '../../../utils/tasksService';

interface TaskRecurringHistoryProps {
    taskUid: string;
    // Changes when an occurrence is completed or skipped, to load it again.
    refreshKey?: string;
    className?: string;
}

const formatDay = (day: string): string => {
    const date = parseDateString(day);
    return date ? formatShortDate(date) : day;
};

const TaskRecurringHistory: React.FC<TaskRecurringHistoryProps> = ({
    taskUid,
    refreshKey,
    className,
}) => {
    const { t } = useTranslation();
    const [history, setHistory] = useState<RecurringHistory | null>(null);
    const [failed, setFailed] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        (async () => {
            try {
                const first = await fetchRecurringHistory(taskUid);
                if (!cancelled) setHistory(first);
            } catch {
                if (!cancelled) {
                    setHistory(null);
                    setFailed(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [taskUid, refreshKey]);

    const loadMore = async () => {
        if (!history) return;
        setLoadingMore(true);
        setFailed(false);
        try {
            const next = await fetchRecurringHistory(
                taskUid,
                history.occurrences.length
            );
            setHistory({
                ...next,
                occurrences: [...history.occurrences, ...next.occurrences],
            });
        } catch {
            setFailed(true);
        } finally {
            setLoadingMore(false);
        }
    };

    const title = t('task.recurringHistory', 'History');
    const failedMessage = failed && (
        <p className="text-sm text-red-600 dark:text-red-400">
            {t('task.recurringHistoryFailed', 'Could not load the history.')}
        </p>
    );

    if (!history || history.total === 0) {
        return failed ? (
            <div className={className}>
                <SidePanelSection title={title}>
                    {failedMessage}
                </SidePanelSection>
            </div>
        ) : null;
    }

    return (
        <div className={className}>
            <SidePanelSection title={title}>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                        'task.recurringHistorySummary',
                        '{{completed}} completed, {{skipped}} skipped',
                        {
                            completed: history.completed_count,
                            skipped: history.skipped_count,
                        }
                    )}
                </p>
                <ul className="space-y-2 text-sm">
                    {history.occurrences.map((occurrence) => (
                        <li
                            key={occurrence.id}
                            className="flex flex-wrap justify-between gap-x-4"
                        >
                            <span className="text-gray-700 dark:text-gray-300">
                                {formatDay(occurrence.scheduled_for)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                                {occurrence.skipped
                                    ? t('task.occurrenceSkipped', 'Skipped')
                                    : t(
                                          'task.occurrenceCompletedOn',
                                          'Completed {{date}}',
                                          {
                                              date: formatDay(
                                                  occurrence.completed_date
                                              ),
                                          }
                                      )}
                            </span>
                        </li>
                    ))}
                </ul>
                {failedMessage}
                {history.has_more && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            void loadMore();
                        }}
                        disabled={loadingMore}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                    >
                        {t('task.recurringHistoryMore', 'Show more')}
                    </button>
                )}
            </SidePanelSection>
        </div>
    );
};

export default TaskRecurringHistory;
