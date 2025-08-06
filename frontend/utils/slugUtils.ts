import slugify from 'slugify';

/**
 * Creates a URL-safe slug from a string with proper transliteration
 * @param text - The text to slugify
 * @param maxLength - Maximum length of the slug (default: 50)
 * @returns The slugified text
 */
export function createSlug(text: string, maxLength: number = 50): string {
    if (!text) return '';

    let slug = slugify(text, {
        lower: true,
        strict: true,
        locale: 'en',
        trim: true,
    });

    // If slugify returns empty (unsupported script), fallback to ASCII-only approach
    if (!slug) {
        slug = text
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/[^a-z0-9\s-]/g, '') // Keep only ASCII letters, numbers, spaces, hyphens
            .replace(/[\s_-]+/g, '-') // Replace spaces/underscores/multiple hyphens with single hyphen
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }

    // Trim to maxLength and ensure no trailing hyphens
    return slug.length <= maxLength
        ? slug
        : slug.substring(0, maxLength).replace(/-+$/, '');
}

/**
 * Creates a uid-slug URL for a given entity
 * @param uid - The uid of the entity
 * @param name - The name/title of the entity
 * @param maxSlugLength - Maximum length of the slug part (default: 40)
 * @returns The uid-slug URL part (e.g., "abc123-clean-the-backyard")
 */
export function createUidSlug(
    uid: string,
    name: string,
    maxSlugLength: number = 40
): string {
    if (!uid) throw new Error('UID is required');

    const slug = createSlug(name, maxSlugLength);
    return slug ? `${uid}-${slug}` : uid;
}

/**
 * Extracts uid from a uid-slug URL part
 * @param uidSlug - The uid-slug (e.g., "abc123-clean-the-backyard")
 * @returns The extracted uid
 */
export function extractUidFromSlug(uidSlug: string): string {
    if (!uidSlug) return '';

    // UID is always 15 characters by our custom implementation, extract the first part before the first hyphen
    // But handle cases where the uid itself might contain hyphens
    const parts = uidSlug.split('-');
    if (parts.length === 1) {
        // No slug, just uid
        return parts[0];
    }

    // Look for the uid part (15 chars) - it should be the first part
    const firstPart = parts[0];
    if (firstPart.length === 15) {
        return firstPart;
    }

    // Fallback: try to find 15-character alphanumeric string
    const uidMatch = uidSlug.match(/^([0-9abcdefghijkmnpqrstuvwxyz]{15})/);
    return uidMatch ? uidMatch[1] : uidSlug.split('-')[0];
}

/**
 * Validates if a string looks like a valid uid
 * @param str - String to validate
 * @returns True if it looks like a uid
 */
export function isValidUid(str: string): boolean {
    return /^[0-9abcdefghijkmnpqrstuvwxyz]{15}$/.test(str);
}

/**
 * Creates a project URL using uid-slug format
 * @param project - Project object with uid and name
 * @returns The project URL path (e.g., "/project/abc123-clean-the-backyard")
 */
export function createProjectUrl(project: {
    uid?: string;
    name: string;
}): string {
    if (!project.uid) {
        throw new Error('Project uid is required');
    }
    const uidSlug = createUidSlug(project.uid, project.name);
    return `/project/${uidSlug}`;
}

/**
 * Creates a note URL using uid-slug format
 * @param note - Note object with uid and title
 * @returns The note URL path (e.g., "/note/abc123-meeting-notes")
 */
export function createNoteUrl(note: { uid?: string; title: string }): string {
    if (!note.uid) {
        throw new Error('Note uid is required');
    }
    const uidSlug = createUidSlug(note.uid, note.title);
    return `/note/${uidSlug}`;
}

/**
 * Creates a tag URL using uid-slug format
 * @param tag - Tag object with uid and name
 * @returns The tag URL path (e.g., "/tag/abc123-work-tag")
 */
export function createTagUrl(tag: { uid?: string; name: string }): string {
    if (!tag.uid) {
        throw new Error('Tag uid is required');
    }
    const uidSlug = createUidSlug(tag.uid, tag.name);
    return `/tag/${uidSlug}`;
}
