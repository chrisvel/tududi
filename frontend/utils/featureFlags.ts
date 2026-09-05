import { getApiPath } from '../config/paths';

export interface FeatureFlags {
    backups: boolean;
    caldav: boolean;
    mcp: boolean;
    hosted: boolean;
    billing: boolean;
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
                caldav: false,
                mcp: false,
                hosted: false,
                billing: false,
            };
        }

        const data = await response.json();
        const defaultFlags: FeatureFlags = {
            backups: false,
            caldav: false,
            mcp: false,
            hosted: false,
            billing: false,
        };
        cachedFeatureFlags = {
            ...defaultFlags,
            ...data.featureFlags,
        };
        return cachedFeatureFlags;
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        return {
            backups: false,
            caldav: false,
            mcp: false,
            hosted: false,
            billing: false,
        };
    }
};

export const clearFeatureFlagsCache = () => {
    cachedFeatureFlags = null;
};
