// Life-to-Day (T-301): document direction derived from the active language.
// fa and ar render RTL; every other supported language stays LTR.
const RTL_LANGUAGES = ['ar', 'fa'];

// The active UI language, mirrored here so display utilities (jalali.ts) can
// read it without importing the i18next instance (which pulls the real
// i18n.ts module graph into tests that mock react-i18next).
let activeLanguage = 'en';

export const setActiveLanguage = (lng: string): void => {
    activeLanguage = lng || 'en';
};

export const getActiveLanguage = (): string => activeLanguage;

export const isRtlLanguage = (lng?: string | null): boolean => {
    if (!lng) return false;
    const base = lng.toLowerCase().split('-')[0];
    return RTL_LANGUAGES.includes(base);
};

export const getDirection = (lng?: string | null): 'rtl' | 'ltr' =>
    isRtlLanguage(lng) ? 'rtl' : 'ltr';

/**
 * Applies `dir` and `lang` to <html> without a page reload.
 * Safe to call in non-DOM environments (tests, SSR) — it no-ops there.
 */
export const applyDocumentDirection = (lng?: string | null): void => {
    const language = lng || 'en';
    setActiveLanguage(language);
    if (typeof document === 'undefined' || !document.documentElement) return;
    document.documentElement.dir = getDirection(language);
    document.documentElement.lang = language;
};
