import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export interface UrlTitleResult {
    url: string;
    title: string | null;
    image?: string | null;
    description?: string | null;
    found?: boolean;
    error?: string;
}

export const extractUrlTitle = async (url: string): Promise<UrlTitleResult> => {
    try {
        const response = await fetch(
            getApiPath(`url/title?url=${encodeURIComponent(url)}`),
            {
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        await handleAuthResponse(response, 'Failed to extract URL title');
        return await response.json();
    } catch (error) {
        console.error('Error extracting URL title:', error);
        return { url, title: null, error: (error as Error).message };
    }
};

export const extractTitleFromText = async (
    text: string
): Promise<UrlTitleResult | null> => {
    try {
        const response = await fetch(getApiPath('url/extract-from-text'), {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        await handleAuthResponse(response, 'Failed to extract title from text');
        const result = await response.json();

        if (result.found === false) {
            return null;
        }

        return result;
    } catch (error) {
        console.error('Error extracting title from text:', error);
        return null;
    }
};

export const isUrl = (text: string): boolean => {
    const trimmed = text.trim();

    if (!trimmed || trimmed.length > 2000 || !trimmed.includes('.')) {
        return false;
    }

    const urlRegex =
        /^(https?:\/\/)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:[0-9]+)?(\/\S*)?$/i;
    return urlRegex.test(trimmed);
};
