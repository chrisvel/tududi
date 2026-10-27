export type PlanKey = 'free' | 'pro' | 'unlimited' | string;

export interface PlanLimits {
    max_tasks: number | null;
    max_projects: number | null;
    max_notes: number | null;
    storage_mb: number | null;
    ai_requests_per_month: number | null;
    ai_credits_per_month: number | null;
    max_members?: number | null;
}

export interface PlanFeatures {
    ai: boolean;
    mcp: boolean;
    caldav: boolean;
    backups_import: boolean;
    telegram: boolean;
    attachments: boolean;
    public_notes?: boolean;
    webhooks?: boolean;
}

export interface BillingUsage {
    tasks: number;
    projects: number;
    notes: number;
    storage_bytes: number;
    ai_requests_this_month: number;
    // Recorded, not capped: real token spend, so Cloud pricing can be set
    // from what usage actually costs rather than from a request count.
    ai_tokens_this_month: number;
    ai_credits_used_this_month: number;
}

export interface BillingStatus {
    hosted: boolean;
    plan: PlanKey;
    planName: string;
    status: string;
    reason: string;
    limits: PlanLimits;
    features: PlanFeatures;
    usage?: BillingUsage;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    grace_until?: string | null;
    override?: {
        plan: string;
        expires_at: string | null;
        reason: string | null;
    } | null;
    // Instances that sell access rather than upgrades set this; `active`
    // is false only when nothing (subscription, trial, override, admin)
    // entitles the account to the app.
    subscription_required: boolean;
    active: boolean;
    // The trial ended unpaid: the app opens read-only until this date, then
    // the account is deleted.
    read_only?: boolean;
    read_only_until?: string | null;
    // Set for a member whose seat is paid by the account that added it.
    seat_owner?: { id: number; name: string | null } | null;
    // On a hosted instance: the seats of this account's plan and how many
    // are taken, the owner included.
    seats?: { members: number; used: number; seats: number } | null;
    billing_configured: boolean;
    pricing: { currency: string; monthly: number; annual: number };
    provider: { name: string; display_name: string };
    checkout_available: boolean;
    portal_available: boolean;
    // Whether the app can move the subscription to another plan itself
    // (Paddle); otherwise "Manage subscription" does it.
    plan_change_available?: boolean;
    intervals: { month: boolean; year: boolean };
    // Pro and the Team buckets that can be bought, smallest first.
    plans_available?: PurchasablePlan[];
    subscription: {
        status: string;
        interval: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        last_payment_failed_at: string | null;
    } | null;
}

export interface PurchasablePlan {
    key: PlanKey;
    seats: number;
    intervals: { month: boolean; year: boolean };
}

export interface BillingPlan {
    key: PlanKey;
    name: string;
    seats?: number;
    limits: PlanLimits;
    features: PlanFeatures;
}

export interface BillingCatalog {
    plans: BillingPlan[];
    purchasable?: PurchasablePlan[];
    intervals: { month: boolean; year: boolean };
    trial_days: number;
}
