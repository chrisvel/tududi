import type { TFunction } from 'i18next';
import type { BillingStatus, PurchasablePlan } from '../entities/Billing';

// Team plans are sold in fixed seat buckets (team_3, team_5, …), each its
// own price at the per-seat rate; Pro is one person.

// The Team buckets the server sells (backend/config/plans.js TEAM_SEATS).
export const TEAM_SEATS = [3, 5, 10, 15, 20, 25, 30, 40];

export const isTeamPlan = (key?: string | null): boolean =>
    !!key && key.startsWith('team_');

export const isPaidPlan = (key?: string | null): boolean =>
    key === 'pro' || isTeamPlan(key);

export const planLabel = (
    t: TFunction,
    key: string,
    seats: number,
    fallback?: string
): string =>
    isTeamPlan(key)
        ? t('billing.teamName', {
              defaultValue: 'Team ({{seats}} seats)',
              seats: seats,
          })
        : key === 'pro'
          ? 'Pro'
          : fallback || key;

// The plans this account can buy. Without the list (an older server) only
// Pro is on offer.
export const purchasablePlans = (status: BillingStatus): PurchasablePlan[] =>
    status.plans_available?.length
        ? status.plans_available
        : [{ key: 'pro', seats: 1, intervals: status.intervals }];

// What a plan costs per interval: seats times the per-seat price.
export const planPrice = (
    status: BillingStatus,
    seats: number,
    interval: 'month' | 'year'
): number =>
    seats *
    (interval === 'year' ? status.pricing.annual : status.pricing.monthly);

export const formatMoney = (currency: string | undefined, amount: number) =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 0,
    }).format(amount);
