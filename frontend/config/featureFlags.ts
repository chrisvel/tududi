const parseBooleanFlag = (
    value: string | undefined,
    defaultValue: boolean
): boolean => {
    if (value === undefined) return defaultValue;
    const normalized = value.toString().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
};

export const ENABLE_NOTE_COLOR = parseBooleanFlag(
    process.env.ENABLE_NOTE_COLOR,
    true
);

export const ENABLE_INBOX_CLARIFY = parseBooleanFlag(
    process.env.ENABLE_INBOX_CLARIFY,
    false
);

export type FeatureFlags = {
    ENABLE_NOTE_COLOR: boolean;
    ENABLE_INBOX_CLARIFY: boolean;
};

export const featureFlags: FeatureFlags = {
    ENABLE_NOTE_COLOR,
    ENABLE_INBOX_CLARIFY,
};
