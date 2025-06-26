/**
 * Service for URL-related operations like extracting titles from web pages
 */
import { handleAuthResponse } from "./authUtils";

export interface UrlTitleResult {
  url: string;
  title: string | null;
  image?: string | null;
  description?: string | null;
  found?: boolean;
  error?: string;
}

/**
 * Extract the title of a web page from its URL
 * @param url The URL to extract the title from
 * @returns Promise resolving to the page title or null if not found
 */
export const extractUrlTitle = async (url: string): Promise<UrlTitleResult> => {
  try {
    const response = await fetch(`/api/url/title?url=${encodeURIComponent(url)}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    await handleAuthResponse(response, 'Failed to extract URL title');
    return await response.json();
  } catch (error) {
    console.error('Error extracting URL title:', error);
    return { url, title: null, error: (error as Error).message };
  }
};

/**
 * Extract a URL and its title from arbitrary text
 * @param text The text that might contain a URL
 * @returns Promise resolving to the URL and title if found
 */
export const extractTitleFromText = async (text: string): Promise<UrlTitleResult | null> => {
  try {
    const response = await fetch('/api/url/extract-from-text', {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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

/**
 * Check if a string is likely a URL
 * @param text The text to check
 * @returns True if the text appears to be a URL
 */
export const isUrl = (text: string): boolean => {
  // Basic URL validation regex
  const urlRegex = /^(https?:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i;
  return urlRegex.test(text.trim());
};