import { getUserTimezone } from './dateUtils';

/**
 * Maps IANA timezone identifiers to ISO 3166-1 alpha-2 country codes.
 * Used to derive the correct date format from the user's timezone preference.
 */
const timezoneToCountry: Record<string, string> = {
    // Africa
    'Africa/Abidjan': 'CI',
    'Africa/Accra': 'GH',
    'Africa/Algiers': 'DZ',
    'Africa/Cairo': 'EG',
    'Africa/Casablanca': 'MA',
    'Africa/Johannesburg': 'ZA',
    'Africa/Lagos': 'NG',
    'Africa/Nairobi': 'KE',
    'Africa/Tunis': 'TN',
    // Americas
    'America/Anchorage': 'US',
    'America/Argentina/Buenos_Aires': 'AR',
    'America/Bogota': 'CO',
    'America/Caracas': 'VE',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Edmonton': 'CA',
    'America/Halifax': 'CA',
    'America/Lima': 'PE',
    'America/Los_Angeles': 'US',
    'America/Mexico_City': 'MX',
    'America/New_York': 'US',
    'America/Phoenix': 'US',
    'America/Regina': 'CA',
    'America/Santiago': 'CL',
    'America/Sao_Paulo': 'BR',
    'America/St_Johns': 'CA',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Whitehorse': 'CA',
    'America/Winnipeg': 'CA',
    // Asia
    'Asia/Bangkok': 'TH',
    'Asia/Dhaka': 'BD',
    'Asia/Dubai': 'AE',
    'Asia/Hong_Kong': 'HK',
    'Asia/Jakarta': 'ID',
    'Asia/Jerusalem': 'IL',
    'Asia/Karachi': 'PK',
    'Asia/Kolkata': 'IN',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Manila': 'PH',
    'Asia/Riyadh': 'SA',
    'Asia/Seoul': 'KR',
    'Asia/Shanghai': 'CN',
    'Asia/Singapore': 'SG',
    'Asia/Taipei': 'TW',
    'Asia/Tehran': 'IR',
    'Asia/Tokyo': 'JP',
    // Atlantic
    'Atlantic/Azores': 'PT',
    'Atlantic/Reykjavik': 'IS',
    // Australia
    'Australia/Adelaide': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Darwin': 'AU',
    'Australia/Hobart': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Perth': 'AU',
    'Australia/Sydney': 'AU',
    // Europe
    'Europe/Amsterdam': 'NL',
    'Europe/Athens': 'GR',
    'Europe/Berlin': 'DE',
    'Europe/Brussels': 'BE',
    'Europe/Copenhagen': 'DK',
    'Europe/Dublin': 'IE',
    'Europe/Helsinki': 'FI',
    'Europe/Istanbul': 'TR',
    'Europe/Lisbon': 'PT',
    'Europe/London': 'GB',
    'Europe/Madrid': 'ES',
    'Europe/Moscow': 'RU',
    'Europe/Oslo': 'NO',
    'Europe/Paris': 'FR',
    'Europe/Prague': 'CZ',
    'Europe/Rome': 'IT',
    'Europe/Stockholm': 'SE',
    'Europe/Vienna': 'AT',
    'Europe/Warsaw': 'PL',
    'Europe/Zurich': 'CH',
    // Pacific
    'Pacific/Auckland': 'NZ',
    'Pacific/Fiji': 'FJ',
    'Pacific/Guam': 'GU',
    'Pacific/Honolulu': 'US',
};

/**
 * Gets the ISO 3166-1 country code from an IANA timezone identifier.
 */
export const getCountryFromTimezone = (timezone: string): string | null => {
    return timezoneToCountry[timezone] || null;
};

/**
 * Resolves the best locale to use for date/time formatting.
 * Combines the user's language preference with their timezone-derived region
 * to produce a locale that respects regional date formatting conventions.
 *
 * For example: language "en" + timezone "Europe/Athens" → "en-GR" → DD/MM format
 */
export const resolveUserLocale = (preferredLanguage?: string): string => {
    const timezone = getUserTimezone();
    const country = getCountryFromTimezone(timezone);

    // Build locale candidates in priority order
    const localesToTry: (string | undefined)[] = [];

    // First priority: language + timezone-derived country (e.g., "en-GR")
    if (preferredLanguage && country) {
        const baseLang = preferredLanguage.split('-')[0];
        localesToTry.push(`${baseLang}-${country}`);
    }

    // Fallbacks
    localesToTry.push(
        preferredLanguage,
        typeof navigator !== 'undefined' ? navigator.language : undefined,
        'en-US'
    );

    for (const locale of localesToTry) {
        if (!locale) {
            continue;
        }

        const canonicalLocale = canonicalizeLocale(locale);

        try {
            // Validate locale support; falls through to next candidate if invalid
            new Intl.DateTimeFormat(canonicalLocale);
            return canonicalLocale;
        } catch {
            continue;
        }
    }

    return 'en-US';
};

const canonicalizeLocale = (locale: string): string => {
    if (
        typeof Intl === 'undefined' ||
        typeof Intl.getCanonicalLocales !== 'function'
    ) {
        return locale;
    }

    try {
        const [canonical] = Intl.getCanonicalLocales(locale);
        return canonical || locale;
    } catch {
        return locale;
    }
};

export default resolveUserLocale;
