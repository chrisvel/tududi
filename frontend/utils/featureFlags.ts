import { getApiPath } from '../config/paths';

export interface FeatureFlags {
    backups: boolean;
    calendar: boolean;
}

let cachedFeatureFlags: FeatureFlags | null = null;

export const getFeatureFlags = async (): Promise<FeatureFlags> => {
    if (cachedFeatureFlags) {
        return cachedFeatureFlags;
    }

    try {
        const response = await fetch(getApiPath('feature-flags'), {
            credentials: 'include',
        });

        if (!response.ok) {
            console.error('Failed to fetch feature flags');
            return {
                backups: false,
                calendar: false,
            };
        }

        const data = await response.json();
        cachedFeatureFlags = data.featureFlags;
        return cachedFeatureFlags;
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        return {
            backups: false,
            calendar: false,
        };
    }
};

export const clearFeatureFlagsCache = () => {
    cachedFeatureFlags = null;
};
