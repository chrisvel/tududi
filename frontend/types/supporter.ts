export type SupporterTier = 'bronze' | 'silver' | 'gold';

export type SupporterStatus = 'active' | 'grace' | 'expired' | 'revoked';

export interface SupporterLicense {
    id: number;
    tier: SupporterTier;
    activated_at: string;
    expires_at: string | null;
    status: SupporterStatus;
    is_valid: boolean;
}

export interface SupporterAnalytics {
    total_supporters: number;
    active_supporters: number;
    by_tier: {
        bronze: number;
        silver: number;
        gold: number;
    };
    total_revenue: number;
}

export interface Supporter {
    id: number;
    user_id: number;
    email: string;
    name?: string;
    surname?: string;
    tier: SupporterTier;
    purchase_amount?: number;
    activated_at: string;
    expires_at: string | null;
    status: SupporterStatus;
    is_valid: boolean;
}

export interface TierConfig {
    color: {
        bg: string;
        text: string;
        border: string;
    };
    label: string;
    displayOrder: number;
    price: number;
    description: string;
    features: string[];
    paymentLink: string;
}

export const TIER_COLORS: Record<SupporterTier, TierConfig> = {
    bronze: {
        color: {
            bg: 'bg-orange-100 dark:bg-orange-900',
            text: 'text-orange-800 dark:text-orange-200',
            border: 'border-orange-600 dark:border-orange-700',
        },
        label: 'Bronze Supporter',
        displayOrder: 1,
        price: 25,
        description: 'Show your support for tududi development',
        features: [
            'Bronze supporter badge on your profile',
            'Support open-source development',
            'Valid for 1 year',
        ],
        paymentLink: 'https://revolut.me/chriss9?currency=EUR&amount=2500',
    },
    silver: {
        color: {
            bg: 'bg-gray-100 dark:bg-gray-700',
            text: 'text-gray-800 dark:text-gray-200',
            border: 'border-gray-400 dark:border-gray-500',
        },
        label: 'Silver Supporter',
        displayOrder: 2,
        price: 50,
        description: 'Generous support for tududi development',
        features: [
            'Silver supporter badge on your profile',
            'Priority support consideration',
            'Support open-source development',
            'Valid for 1 year',
        ],
        paymentLink: 'https://revolut.me/chriss9?currency=EUR&amount=5000',
    },
    gold: {
        color: {
            bg: 'bg-yellow-100 dark:bg-yellow-900',
            text: 'text-yellow-800 dark:text-yellow-200',
            border: 'border-yellow-500 dark:border-yellow-600',
        },
        label: 'Gold Supporter',
        displayOrder: 3,
        price: 100,
        description: 'Outstanding support for tududi development',
        features: [
            'Gold supporter badge on your profile',
            'Priority support consideration',
            'Early access to new features',
            'Support open-source development',
            'Valid for 1 year',
        ],
        paymentLink: 'https://revolut.me/chriss9?currency=EUR&amount=10000',
    },
};
