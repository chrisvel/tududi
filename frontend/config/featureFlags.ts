const parseBooleanFlag = (
    value: string | undefined,
    defaultValue: boolean
): boolean => {
    if (value === undefined) return defaultValue;
    const normalized = value.toString().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
};

export const ENABLE_INBOX_CLARIFY = parseBooleanFlag(
    process.env.ENABLE_INBOX_CLARIFY,
    false
);

export type FeatureFlags = {
    ENABLE_INBOX_CLARIFY: boolean;
};

export const featureFlags: FeatureFlags = {
    ENABLE_INBOX_CLARIFY,
};
