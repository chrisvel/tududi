export type PlanKey = 'free' | 'pro' | 'unlimited' | string;

export interface PlanLimits {
    max_tasks: number | null;
    max_projects: number | null;
    max_notes: number | null;
    storage_mb: number | null;
    ai_requests_per_day: number | null;
}

export interface PlanFeatures {
    ai: boolean;
    mcp: boolean;
    caldav: boolean;
    backups_import: boolean;
    telegram: boolean;
    attachments: boolean;
}

export interface BillingUsage {
    tasks: number;
    projects: number;
    notes: number;
    storage_bytes: number;
    ai_requests_today: number;
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
    billing_configured: boolean;
    provider: { name: string; display_name: string };
    checkout_available: boolean;
    portal_available: boolean;
    intervals: { month: boolean; year: boolean };
    subscription: {
        status: string;
        interval: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        last_payment_failed_at: string | null;
    } | null;
}

export interface BillingPlan {
    key: PlanKey;
    name: string;
    limits: PlanLimits;
    features: PlanFeatures;
}

export interface BillingCatalog {
    plans: BillingPlan[];
    intervals: { month: boolean; year: boolean };
    trial_days: number;
}
