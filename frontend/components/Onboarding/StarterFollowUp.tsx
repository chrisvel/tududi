import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { getCurrentUser } from '../../utils/userUtils';
import {
    fetchExampleCount,
    removeExamples,
} from '../../utils/onboardingService';
import { openBrainDump } from '../../utils/brainDumpUi';

// What Today shows during the first week after a starter was picked: a line
// saying some tasks are examples, with one click to clear the untouched
// ones, and a card that opens the brain dump for the rest of the week.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface StarterFollowUpProps {
    // Hidden once the day is started; the plan is the focus then.
    started: boolean;
    onExamplesRemoved: () => void;
}

const withinFirstWeek = (): boolean => {
    const user = getCurrentUser();
    if (!user?.onboarding_starter || user.onboarding_starter === 'empty') {
        return false;
    }
    if (!user.onboarded_at) return true;
    const since = Date.now() - new Date(user.onboarded_at).getTime();
    return since < WEEK_MS;
};

const StarterFollowUp: React.FC<StarterFollowUpProps> = ({
    started,
    onExamplesRemoved,
}) => {
    const { t } = useTranslation();
    const [count, setCount] = useState<number>(0);
    const [busy, setBusy] = useState(false);
    const [removed, setRemoved] = useState<number | null>(null);
    const show = withinFirstWeek();

    useEffect(() => {
        if (!show) return;
        let cancelled = false;
        fetchExampleCount()
            .then((n) => {
                if (!cancelled) setCount(n);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [show]);

    if (!show || started) return null;

    const clear = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const n = await removeExamples();
            setRemoved(n);
            setCount(0);
            onExamplesRemoved();
        } catch {
            // The line stays; the person can try again.
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-col gap-3" data-testid="starter-follow-up">
            {count > 0 && (
                <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <span>
                        {t(
                            'onboarding.starter.examplesLine',
                            '{{count}} of your tasks are examples from the starter.',
                            { count }
                        )}
                    </span>
                    <button
                        type="button"
                        onClick={clear}
                        disabled={busy}
                        data-testid="starter-remove-examples"
                        className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                        {t(
                            'onboarding.starter.removeExamples',
                            'Remove examples'
                        )}
                    </button>
                </p>
            )}
            {removed !== null && removed > 0 && (
                <p
                    className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                    role="status"
                >
                    {t(
                        'onboarding.starter.examplesRemoved',
                        'Removed {{count}} examples. Your own tasks are untouched.',
                        { count: removed }
                    )}
                </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 dark:bg-gray-900">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {t(
                            'onboarding.starter.restOfWeekTitle',
                            'Add the rest of your week'
                        )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'onboarding.starter.restOfWeekBody',
                            'One thing per line. Then Plan my day puts times on them.'
                        )}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openBrainDump}
                    data-testid="starter-open-brain-dump"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                    <SparklesIcon className="h-4 w-4" />
                    {t('navigation.brainDump', 'Brain dump')}
                </button>
            </div>
        </div>
    );
};

export default StarterFollowUp;
