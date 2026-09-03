import { getApiPath } from '../config/paths';

interface ServerConfig {
    fileUploadLimitMB: number;
}

let cachedConfig: ServerConfig | null = null;
let pendingRequest: Promise<ServerConfig> | null = null;

export async function getServerConfig(): Promise<ServerConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }

    if (pendingRequest) {
        return pendingRequest;
    }

    pendingRequest = (async () => {
        const response = await fetch(getApiPath('config'), {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error('Failed to fetch server configuration');
        }

        cachedConfig = await response.json();
        return cachedConfig;
    })();

    try {
        return await pendingRequest;
    } finally {
        pendingRequest = null;
    }
}

export function getFileUploadLimitMB(): number {
    return cachedConfig?.fileUploadLimitMB || 10;
}
