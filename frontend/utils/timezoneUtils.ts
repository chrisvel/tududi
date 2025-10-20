import { formatInTimeZone } from 'date-fns-tz';

export interface TimezoneOption {
    value: string;
    label: string;
    offset: string;
    region: string;
}

/**
 * Get all IANA timezone identifiers
 * Uses Intl.supportedValuesOf which is supported in modern browsers
 */
const getAllTimezones = (): string[] => {
    // Use Intl.supportedValuesOf if available (modern browsers)
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
        return (Intl as any).supportedValuesOf('timeZone');
    }

    // Fallback: Return a comprehensive list of major timezones
    // This fallback ensures compatibility with older browsers
    return [
        // Africa
        'Africa/Abidjan',
        'Africa/Accra',
        'Africa/Algiers',
        'Africa/Cairo',
        'Africa/Casablanca',
        'Africa/Johannesburg',
        'Africa/Lagos',
        'Africa/Nairobi',
        'Africa/Tunis',
        // America
        'America/Anchorage',
        'America/Argentina/Buenos_Aires',
        'America/Bogota',
        'America/Caracas',
        'America/Chicago',
        'America/Denver',
        'America/Edmonton',
        'America/Halifax',
        'America/Lima',
        'America/Los_Angeles',
        'America/Mexico_City',
        'America/New_York',
        'America/Phoenix',
        'America/Regina',
        'America/Santiago',
        'America/Sao_Paulo',
        'America/St_Johns',
        'America/Toronto',
        'America/Vancouver',
        'America/Whitehorse',
        'America/Winnipeg',
        // Asia
        'Asia/Bangkok',
        'Asia/Dhaka',
        'Asia/Dubai',
        'Asia/Hong_Kong',
        'Asia/Jakarta',
        'Asia/Jerusalem',
        'Asia/Karachi',
        'Asia/Kolkata',
        'Asia/Kuala_Lumpur',
        'Asia/Manila',
        'Asia/Riyadh',
        'Asia/Seoul',
        'Asia/Shanghai',
        'Asia/Singapore',
        'Asia/Taipei',
        'Asia/Tehran',
        'Asia/Tokyo',
        // Atlantic
        'Atlantic/Azores',
        'Atlantic/Reykjavik',
        // Australia
        'Australia/Adelaide',
        'Australia/Brisbane',
        'Australia/Darwin',
        'Australia/Hobart',
        'Australia/Melbourne',
        'Australia/Perth',
        'Australia/Sydney',
        // Europe
        'Europe/Amsterdam',
        'Europe/Athens',
        'Europe/Berlin',
        'Europe/Brussels',
        'Europe/Copenhagen',
        'Europe/Dublin',
        'Europe/Helsinki',
        'Europe/Istanbul',
        'Europe/Lisbon',
        'Europe/London',
        'Europe/Madrid',
        'Europe/Moscow',
        'Europe/Oslo',
        'Europe/Paris',
        'Europe/Prague',
        'Europe/Rome',
        'Europe/Stockholm',
        'Europe/Vienna',
        'Europe/Warsaw',
        'Europe/Zurich',
        // Pacific
        'Pacific/Auckland',
        'Pacific/Fiji',
        'Pacific/Guam',
        'Pacific/Honolulu',
    ];
};

/**
 * Get current UTC offset for a timezone
 */
const getTimezoneOffset = (tz: string): string => {
    try {
        const now = new Date();
        // Format the date in the target timezone and extract offset
        const formatted = formatInTimeZone(now, tz, 'XXX'); // Returns like "+05:30" or "-08:00"
        return formatted;
    } catch {
        return '+00:00';
    }
};

/**
 * Get all available timezones grouped by region
 * @returns Object with region names as keys and timezone arrays as values
 */
export const getTimezonesByRegion = (): Record<string, TimezoneOption[]> => {
    const timezones = getAllTimezones();
    const grouped: Record<string, TimezoneOption[]> = {};

    timezones.forEach((tz) => {
        // Skip deprecated/alias timezones and special cases
        if (
            tz.includes('Etc/') ||
            tz === 'Factory' ||
            tz.includes('SystemV/')
        ) {
            return;
        }

        const parts = tz.split('/');
        if (parts.length < 2) return;

        const region = parts[0];
        const location = parts.slice(1).join('/').replace(/_/g, ' ');

        // Get current offset for the timezone
        const offset = getTimezoneOffset(tz);

        const option: TimezoneOption = {
            value: tz,
            label: `${location} (UTC${offset})`,
            offset,
            region,
        };

        if (!grouped[region]) {
            grouped[region] = [];
        }

        grouped[region].push(option);
    });

    // Sort timezones within each region by offset, then by name
    Object.keys(grouped).forEach((region) => {
        grouped[region].sort((a, b) => {
            // First sort by offset
            const offsetA = parseOffset(a.offset);
            const offsetB = parseOffset(b.offset);
            if (offsetA !== offsetB) {
                return offsetB - offsetA; // Descending (west to east)
            }
            // Then by label
            return a.label.localeCompare(b.label);
        });
    });

    return grouped;
};

/**
 * Parse offset string (e.g., "+05:30") to minutes
 */
const parseOffset = (offset: string): number => {
    const match = offset.match(/([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;

    const sign = match[1] === '+' ? 1 : -1;
    const hours = parseInt(match[2], 10);
    const minutes = parseInt(match[3], 10);

    return sign * (hours * 60 + minutes);
};

/**
 * Get region display name for grouping
 */
export const getRegionDisplayName = (region: string): string => {
    const regionNames: Record<string, string> = {
        America: 'Americas',
        Europe: 'Europe',
        Asia: 'Asia',
        Africa: 'Africa',
        Australia: 'Australia & Oceania',
        Pacific: 'Pacific Islands',
        Atlantic: 'Atlantic',
        Indian: 'Indian Ocean',
        Arctic: 'Arctic',
        Antarctica: 'Antarctica',
    };

    return regionNames[region] || region;
};
