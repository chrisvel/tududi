import { getApiPath } from '../config/paths';

interface ServerConfig {
    fileUploadLimitMB: number;
}

let cachedConfig: ServerConfig | null = null;

export async function getServerConfig(): Promise<ServerConfig> {
    if (cachedConfig) {
        return cachedConfig;
    }

    const response = await fetch(getApiPath('config'), {
        method: 'GET',
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch server configuration');
    }

    cachedConfig = await response.json();
    return cachedConfig;
}

export function getFileUploadLimitMB(): number {
    return cachedConfig?.fileUploadLimitMB || 10;
}
