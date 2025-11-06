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
    false
);

export type FeatureFlags = {
    ENABLE_NOTE_COLOR: boolean;
};

export const featureFlags: FeatureFlags = {
    ENABLE_NOTE_COLOR,
};
