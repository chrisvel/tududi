/**
 * Resolves the best locale to use for date/time formatting.
 * It attempts the active i18n language first, then the browser locale,
 * and falls back to US English if none are valid.
 */
export const resolveUserLocale = (preferredLanguage?: string): string => {
    const localesToTry = [
        preferredLanguage,
        typeof navigator !== 'undefined' ? navigator.language : undefined,
        'en-US',
    ];

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
