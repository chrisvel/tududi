/**
 * Path configuration for the application
 * This allows the app to work when hosted at the root or in a subdirectory
 * (e.g., Home Assistant Ingress)
 */

declare global {
    interface Window {
        __TUDUDI_BASE_PATH__?: string;
    }
}

const envBasePath = process.env.TUDUDI_BASE_PATH || '';

const sanitizeBasePath = (value: string): string => {
    if (!value) {
        return '';
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed === '/') {
        return '';
    }

    const withoutTrailing = trimmed.endsWith('/')
        ? trimmed.slice(0, -1)
        : trimmed;

    return withoutTrailing.startsWith('/')
        ? withoutTrailing
        : `/${withoutTrailing}`;
};

const detectHassioIngressBase = (): string => {
    if (typeof window === 'undefined') {
        return '';
    }

    const match = window.location.pathname.match(
        /^\/api\/hassio_ingress\/[^/]+/
    );
    return match ? match[0] : '';
};

const runtimeBasePath = (() => {
    if (typeof window === 'undefined') {
        return sanitizeBasePath(envBasePath);
    }

    if (typeof window.__TUDUDI_BASE_PATH__ === 'string') {
        return sanitizeBasePath(window.__TUDUDI_BASE_PATH__);
    }

    const hassBase = sanitizeBasePath(detectHassioIngressBase());
    if (hassBase) {
        return hassBase;
    }

    return sanitizeBasePath(envBasePath);
})();

const stripLeadingSlash = (value: string): string =>
    value.startsWith('/') ? value.slice(1) : value;

const withBasePath = (path: string): string => {
    const clean = stripLeadingSlash(path);
    if (!runtimeBasePath) {
        return `/${clean}`;
    }
    return `${runtimeBasePath}/${clean}`;
};

export function getBasePath(): string {
    return runtimeBasePath;
}

/**
 * Get the API endpoint path
 * @param path - The API path (e.g., '/tasks', 'tasks', or '/api/tasks')
 * @returns The full API path
 */
export function getApiPath(path: string): string {
    const cleanPath = stripLeadingSlash(path);

    if (cleanPath.startsWith('api/')) {
        return withBasePath(cleanPath);
    }

    return withBasePath(`api/${cleanPath}`);
}

/**
 * Get the locales path
 * @param path - The locales path (e.g., '/locales/en/translation.json')
 * @returns The full locales path
 */
export function getLocalesPath(path: string): string {
    const cleanPath = stripLeadingSlash(path);

    if (cleanPath.startsWith('locales/')) {
        return withBasePath(cleanPath);
    }

    return withBasePath(`locales/${cleanPath}`);
}

/**
 * Get an asset path
 * @param path - The asset path
 * @returns The full asset path
 */
export function getAssetPath(path: string): string {
    const cleanPath = stripLeadingSlash(path);
    return withBasePath(cleanPath);
}
