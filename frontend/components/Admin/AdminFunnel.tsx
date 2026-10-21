import React from 'react';
import { useTranslation } from 'react-i18next';
import { percentOf } from './AdminTrends';

interface FunnelSteps {
    visitors: number | null;
    signups: number;
    activated: number;
    paid: number | null;
    paid_any: number | null;
}

// The trial funnel as the admin overview reports it: everyone who signed up
// in the last `days` days, and the same span before it to compare.
export interface Funnel {
    days: number;
    hosted: boolean;
    trials: boolean;
    activation_tasks: number;
    current: FunnelSteps;
    previous: FunnelSteps;
}

interface Step {
    key: string;
    label: string;
    hint: string;
    now: number;
    before: number;
}

const rate = (part: number, whole: number): number | null =>
    whole ? (part / whole) * 100 : null;

// "+4 pts vs the 30 days before", coloured only when it moved.
const PointsDelta: React.FC<{
    now: number | null;
    before: number | null;
    days: number;
}> = ({ now, before, days }) => {
    const { t } = useTranslation();
    if (now === null || before === null) return null;
    const diff = Math.round(now - before);
    const tone =
        diff > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : diff < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-gray-500 dark:text-gray-400';
    return (
        <span className={`text-xs ${tone}`}>
            {t(
                'admin.funnel.vsBefore',
                '{{diff}} pts vs the {{days}} days before',
                {
                    diff: diff > 0 ? `+${diff}` : String(diff),
                    days,
                }
            )}
        </span>
    );
};

// Visitors to trial signups to activated users to paying customers. Every
// step counts only people from the step before, so the percentage between
// two steps is how many made it through.
const AdminFunnel: React.FC<{ funnel: Funnel }> = ({ funnel }) => {
    const { t } = useTranslation();
    const { current, previous, days } = funnel;

    const steps: Step[] = [];
    if (current.visitors !== null) {
        steps.push({
            key: 'visitors',
            label: t('admin.funnel.visitors', 'Site visitors'),
            hint: t(
                'admin.funnel.visitorsHint',
                'marketing site and blog, counted per day'
            ),
            now: current.visitors,
            before: previous.visitors ?? 0,
        });
    }
    steps.push({
        key: 'signups',
        label: funnel.trials
            ? t('admin.funnel.trialSignups', 'Trial signups')
            : t('admin.funnel.signups', 'Signups'),
        hint: t(
            'admin.funnel.signupsHint',
            'made their own account, members left out'
        ),
        now: current.signups,
        before: previous.signups,
    });
    steps.push({
        key: 'activated',
        label: t('admin.funnel.activated', 'Activated'),
        hint: t(
            'admin.funnel.activatedHint',
            '{{n}}+ tasks or used the planner',
            { n: funnel.activation_tasks }
        ),
        now: current.activated,
        before: previous.activated,
    });
    if (current.paid !== null) {
        steps.push({
            key: 'paid',
            label: t('admin.funnel.paid', 'Paid'),
            hint: t(
                'admin.funnel.paidHint',
                'activated and has had a subscription'
            ),
            now: current.paid,
            before: previous.paid ?? 0,
        });
    }

    const top = Math.max(1, steps[0].now);
    const last = steps[steps.length - 1];
    const unactivatedPaid =
        current.paid_any !== null && current.paid !== null
            ? current.paid_any - current.paid
            : 0;

    return (
        <section
            className="bg-white dark:bg-gray-900 rounded-lg p-5 mb-8"
            data-testid="admin-funnel"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {funnel.trials
                        ? t(
                              'admin.funnel.title',
                              'Trial funnel, last {{days}} days',
                              {
                                  days,
                              }
                          )
                        : t(
                              'admin.funnel.titleNoTrial',
                              'Signup funnel, last {{days}} days',
                              { days }
                          )}
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('admin.funnel.overall', 'End to end: {{pct}}', {
                        pct: percentOf(last.now, steps[0].now),
                    })}
                </span>
            </div>

            <ol className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {steps.map((step, i) => {
                    const prev = steps[i - 1];
                    return (
                        <li
                            key={step.key}
                            className="rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                            data-testid={`admin-funnel-${step.key}`}
                        >
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {step.label}
                            </p>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                                    {step.now}
                                </span>
                                {prev && (
                                    <span
                                        className="text-sm font-medium text-blue-600 dark:text-blue-400 tabular-nums"
                                        data-testid={`admin-funnel-${step.key}-rate`}
                                    >
                                        {percentOf(step.now, prev.now)}
                                    </span>
                                )}
                            </div>
                            <div className="h-1.5 mt-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-blue-500 dark:bg-blue-400"
                                    style={{
                                        width: `${Math.round((step.now / top) * 100)}%`,
                                    }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                {step.hint}
                            </p>
                            {prev && (
                                <div className="mt-1">
                                    <PointsDelta
                                        now={rate(step.now, prev.now)}
                                        before={rate(step.before, prev.before)}
                                        days={days}
                                    />
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            {(current.paid !== null || unactivatedPaid > 0) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    {current.paid !== null &&
                        t(
                            'admin.funnel.maturity',
                            'Recent signups may still be on their trial, so the paid step trails the others.'
                        )}
                    {unactivatedPaid > 0 &&
                        ` ${t(
                            'admin.funnel.paidWithoutActivating',
                            '{{n}} more paid without activating.',
                            { n: unactivatedPaid }
                        )}`}
                </p>
            )}
        </section>
    );
};

export default AdminFunnel;
