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

// "+4 pts" against the period before, coloured only when it moved.
const PointsDelta: React.FC<{
    now: number | null;
    before: number | null;
}> = ({ now, before }) => {
    const { t } = useTranslation();
    if (now === null || before === null) return null;
    const diff = Math.round(now - before);
    const tone =
        diff > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : diff < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-gray-400 dark:text-gray-500';
    return (
        <span className={`text-xs whitespace-nowrap ${tone}`}>
            {t('admin.funnel.pts', '{{diff}} pts', {
                diff: diff > 0 ? `+${diff}` : String(diff),
            })}
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

    // A visitor count below the signups it should contain means tracking
    // missed people, so no rate is worked out from it.
    const rateOf = (now: number, prev: number) =>
        now > prev ? null : percentOf(now, prev);
    const first = steps.find((s) => s.key !== 'visitors') ?? steps[0];
    const usable =
        steps[0].key === 'visitors' && rateOf(steps[1].now, steps[0].now)
            ? steps[0]
            : first;
    const last = steps[steps.length - 1];
    const unactivatedPaid =
        current.paid_any !== null && current.paid !== null
            ? current.paid_any - current.paid
            : 0;

    return (
        <section
            className="bg-white dark:bg-gray-900 rounded-lg p-5 mb-6"
            data-testid="admin-funnel"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
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
                {last !== usable && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('admin.funnel.overall', 'End to end: {{pct}}', {
                            pct: percentOf(last.now, usable.now),
                        })}
                    </span>
                )}
            </div>

            <ol className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                {steps.map((step, i) => {
                    const prev = steps[i - 1];
                    const stepRate = prev ? rateOf(step.now, prev.now) : null;
                    return (
                        <React.Fragment key={step.key}>
                            {prev && (
                                <li className="flex sm:flex-col items-center justify-center gap-x-2 px-1 text-center">
                                    <span
                                        className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums"
                                        data-testid={`admin-funnel-${step.key}-rate`}
                                        title={
                                            stepRate === null
                                                ? t(
                                                      'admin.funnel.noRate',
                                                      'Fewer counted visitors than signups'
                                                  )
                                                : undefined
                                        }
                                    >
                                        {stepRate ?? '?'}
                                    </span>
                                    {stepRate !== null && (
                                        <PointsDelta
                                            now={rate(step.now, prev.now)}
                                            before={rate(
                                                step.before,
                                                prev.before
                                            )}
                                        />
                                    )}
                                </li>
                            )}
                            <li
                                className="flex-1 rounded-lg px-4 py-3 bg-gray-50 dark:bg-gray-800"
                                data-testid={`admin-funnel-${step.key}`}
                                title={step.hint}
                            >
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {step.label}
                                </p>
                                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                                    {step.now}
                                    <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                                        {t('admin.funnel.before', 'was {{n}}', {
                                            n: step.before,
                                        })}
                                    </span>
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {step.hint}
                                </p>
                            </li>
                        </React.Fragment>
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
