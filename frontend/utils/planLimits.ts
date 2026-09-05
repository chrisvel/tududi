// A 402 from the API means the plan, not the request, said no. The API
// wrappers turn it into a PlanLimitError and broadcast it so the upgrade
// modal can explain it wherever the user happened to be.

export const PLAN_LIMIT_EVENT = 'tududi:plan-limit';

export interface PlanLimitDetail {
    code: 'PLAN_LIMIT_REACHED' | 'FEATURE_NOT_IN_PLAN' | string;
    error: string;
    details?: {
        resource?: string;
        limit?: number;
        current?: number;
        feature?: string;
        plan?: string;
    };
}

export class PlanLimitError extends Error {
    code: string;
    details?: PlanLimitDetail['details'];

    constructor(detail: PlanLimitDetail) {
        super(detail.error || 'Plan limit reached');
        this.name = 'PlanLimitError';
        this.code = detail.code;
        this.details = detail.details;
    }
}

export const broadcastPlanLimit = (detail: PlanLimitDetail): void => {
    window.dispatchEvent(new CustomEvent(PLAN_LIMIT_EVENT, { detail }));
};

// For the few components that call fetch directly instead of a service
// wrapper. Returns true when the response was a plan limit (and handled).
export const handlePlanLimit = async (response: Response): Promise<boolean> => {
    if (response.status !== 402) return false;
    let detail: PlanLimitDetail = { code: 'PLAN_LIMIT_REACHED', error: '' };
    try {
        detail = await response.clone().json();
    } catch {
        // keep the generic detail
    }
    broadcastPlanLimit(detail);
    return true;
};
