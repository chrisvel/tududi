import { useEffect, useState } from 'react';
import { getFeatureFlags } from '../utils/featureFlags';
import { fetchBillingStatus } from '../utils/billingService';
import type { BillingStatus } from '../entities/Billing';

// What the free trial leaves out. Each one is answered by subscribing.
export type TrialLockedFeature = 'ai' | 'public_notes' | 'members';

// The sidebar card and every lock box on a page ask at once, so they share
// one request.
let inFlight: Promise<BillingStatus | null> | null = null;

const loadStatus = (): Promise<BillingStatus | null> => {
    if (!inFlight) {
        inFlight = getFeatureFlags()
            .then((flags) => (flags.hosted ? fetchBillingStatus() : null))
            .catch(() => null)
            .finally(() => {
                inFlight = null;
            });
    }
    return inFlight;
};

interface BillingState {
    // Null on a self-hosted instance, or when the status could not load.
    status: BillingStatus | null;
    // False until we know, so a page can hold back a request the trial
    // would refuse.
    settled: boolean;
}

export const useBillingState = (): BillingState => {
    const [state, setState] = useState<BillingState>({
        status: null,
        settled: false,
    });

    useEffect(() => {
        let cancelled = false;
        loadStatus().then((status) => {
            if (!cancelled) setState({ status, settled: true });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
};

export const useBillingStatus = (): BillingStatus | null =>
    useBillingState().status;

export const isTrialLocked = (
    status: BillingStatus | null,
    feature: TrialLockedFeature
): boolean => {
    if (status?.reason !== 'trial') return false;
    if (feature === 'members') return status.limits?.max_members === 0;
    return status.features?.[feature] === false;
};

// True only while the account is on the trial and the trial leaves this
// feature out.
export const useTrialLock = (feature: TrialLockedFeature): boolean =>
    isTrialLocked(useBillingStatus(), feature);

// For AI work a page starts by itself: false until the billing status is
// known, and on a trial without AI, so nothing asks for what would be
// refused.
export const useAiAllowed = (): boolean => {
    const { status, settled } = useBillingState();
    return settled && !isTrialLocked(status, 'ai');
};
