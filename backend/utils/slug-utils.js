'use strict';

/**
 * Creates a URL-safe slug from a string
 * @param {string} text - The text to slugify
 * @param {number} maxLength - Maximum length of the slug (default: 50)
 * @returns {string} The slugified text
 */
function createSlug(text, maxLength = 50) {
    if (!text) return '';

    return (
        text
            .toLowerCase()
            .trim()
            // Remove or replace special characters
            .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
            .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
            .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
            .substring(0, maxLength) // Limit length
            .replace(/-$/, '')
    ); // Remove trailing hyphen if created by substring
}

/**
 * Creates a nanoid-slug URL for a given entity
 * @param {string} nanoid - The nanoid of the entity
 * @param {string} name - The name/title of the entity
 * @param {number} maxSlugLength - Maximum length of the slug part (default: 40)
 * @returns {string} The nanoid-slug URL part (e.g., "abc123-clean-the-backyard")
 */
function createNanoidSlug(nanoid, name, maxSlugLength = 40) {
    if (!nanoid) throw new Error('Nanoid is required');

    const slug = createSlug(name, maxSlugLength);
    return slug ? `${nanoid}-${slug}` : nanoid;
}

/**
 * Extracts nanoid from a nanoid-slug URL part
 * @param {string} nanoidSlug - The nanoid-slug (e.g., "abc123-clean-the-backyard")
 * @returns {string} The extracted nanoid
 */
function extractNanoidFromSlug(nanoidSlug) {
    if (!nanoidSlug) return '';

    // Nanoid is always 21 characters by default, extract the first part before the first hyphen
    // But handle cases where the nanoid itself might contain hyphens
    const parts = nanoidSlug.split('-');
    if (parts.length === 1) {
        // No slug, just nanoid
        return parts[0];
    }

    // Look for the nanoid part (21 chars) - it should be the first part
    const firstPart = parts[0];
    if (firstPart.length === 21) {
        return firstPart;
    }

    // Fallback: try to find 21-character alphanumeric string
    const nanoidMatch = nanoidSlug.match(/^([A-Za-z0-9_-]{21})/);
    return nanoidMatch ? nanoidMatch[1] : nanoidSlug.split('-')[0];
}

/**
 * Validates if a string looks like a valid nanoid
 * @param {string} str - String to validate
 * @returns {boolean} True if it looks like a nanoid
 */
function isValidNanoid(str) {
    return /^[A-Za-z0-9_-]{21}$/.test(str);
}

module.exports = {
    createSlug,
    createNanoidSlug,
    extractNanoidFromSlug,
    isValidNanoid,
};
