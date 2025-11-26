export interface PresetBanner {
    filename: string;
    url: string;
    creator: string;
}

/**
 * Extracts creator name from banner filename
 * Format: "creator-name-rest-of-filename.jpg"
 * Example: "jon-moore-5fIoyoKlz7A-unsplash.jpg" -> "Jon Moore"
 */
export function extractCreatorFromFilename(filename: string): string {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');

    // Split by hyphen and take the first two parts (first and last name)
    const parts = nameWithoutExt.split('-');

    if (parts.length >= 2) {
        // Capitalize first letter of each word
        const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        return `${firstName} ${lastName}`;
    }

    // Fallback: just capitalize the first part
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

/**
 * Gets the list of preset banner images
 * In a real implementation, this would fetch from the server
 * For now, we'll hardcode the known banners
 */
export function getPresetBanners(): PresetBanner[] {
    const banners = [
        'erwan-hesry-Q34YB7yjAxA-unsplash.jpg',
        'joanna-kosinska-spAkZnUleVw-unsplash.jpg',
        'jon-moore-5fIoyoKlz7A-unsplash.jpg',
        'marita-kavelashvili-ugnrXk1129g-unsplash.jpg',
        'mike-kotsch-9wTWFyInJ4Y-unsplash.jpg',
        'ohmky-uEusW9AW7QU-unsplash.jpg',
        'osman-rana-GXEZuWo5m4I-unsplash.jpg',
        'wil-stewart--m9PKhID7Nk-unsplash.jpg',
    ];

    return banners.map((filename) => ({
        filename,
        url: `/banners/${filename}`,
        creator: extractCreatorFromFilename(filename),
    }));
}

/**
 * Checks if an image URL is a preset banner
 */
export function isPresetBanner(imageUrl: string): boolean {
    if (!imageUrl) return false;
    return imageUrl.startsWith('/banners/');
}

/**
 * Gets creator name from a preset banner URL
 */
export function getCreatorFromBannerUrl(imageUrl: string): string | null {
    if (!isPresetBanner(imageUrl)) return null;

    const filename = imageUrl.split('/').pop();
    if (!filename) return null;

    return extractCreatorFromFilename(filename);
}
