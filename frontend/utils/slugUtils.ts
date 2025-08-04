/**
 * Creates a URL-safe slug from a string
 * @param text - The text to slugify
 * @param maxLength - Maximum length of the slug (default: 50)
 * @returns The slugified text
 */
export function createSlug(text: string, maxLength: number = 50): string {
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
 * @param nanoid - The nanoid of the entity
 * @param name - The name/title of the entity
 * @param maxSlugLength - Maximum length of the slug part (default: 40)
 * @returns The nanoid-slug URL part (e.g., "abc123-clean-the-backyard")
 */
export function createNanoidSlug(
    nanoid: string,
    name: string,
    maxSlugLength: number = 40
): string {
    if (!nanoid) throw new Error('Nanoid is required');

    const slug = createSlug(name, maxSlugLength);
    return slug ? `${nanoid}-${slug}` : nanoid;
}

/**
 * Extracts nanoid from a nanoid-slug URL part
 * @param nanoidSlug - The nanoid-slug (e.g., "abc123-clean-the-backyard")
 * @returns The extracted nanoid
 */
export function extractNanoidFromSlug(nanoidSlug: string): string {
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
 * @param str - String to validate
 * @returns True if it looks like a nanoid
 */
export function isValidNanoid(str: string): boolean {
    return /^[A-Za-z0-9_-]{21}$/.test(str);
}

/**
 * Creates a project URL using nanoid-slug format
 * @param project - Project object with nanoid and name
 * @returns The project URL path (e.g., "/project/abc123-clean-the-backyard")
 */
export function createProjectUrl(project: {
    nanoid?: string;
    name: string;
}): string {
    if (!project.nanoid) {
        throw new Error('Project nanoid is required');
    }
    const nanoidSlug = createNanoidSlug(project.nanoid, project.name);
    return `/project/${nanoidSlug}`;
}

/**
 * Creates a note URL using nanoid-slug format
 * @param note - Note object with nanoid and title
 * @returns The note URL path (e.g., "/note/abc123-meeting-notes")
 */
export function createNoteUrl(note: {
    nanoid?: string;
    title: string;
}): string {
    if (!note.nanoid) {
        throw new Error('Note nanoid is required');
    }
    const nanoidSlug = createNanoidSlug(note.nanoid, note.title);
    return `/note/${nanoidSlug}`;
}

/**
 * Creates a tag URL using nanoid-slug format
 * @param tag - Tag object with nanoid and name
 * @returns The tag URL path (e.g., "/tag/abc123-work-tag")
 */
export function createTagUrl(tag: { nanoid?: string; name: string }): string {
    if (!tag.nanoid) {
        throw new Error('Tag nanoid is required');
    }
    const nanoidSlug = createNanoidSlug(tag.nanoid, tag.name);
    return `/tag/${nanoidSlug}`;
}
