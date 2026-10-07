import { useEffect, useState } from 'react';
import { getLocalesPath } from '../../config/paths';

const FALLBACK_QUOTE = 'Focus on progress, not perfection.';

const pickQuote = async (language: string): Promise<string | null> => {
    const response = await fetch(getLocalesPath(`${language}/quotes.json`));
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data.quotes) || data.quotes.length === 0) return null;
    return data.quotes[Math.floor(Math.random() * data.quotes.length)];
};

// A random quote from the translated quotes file, falling back to English,
// the same source the classic Today page uses.
export const useDailyQuote = (language: string): string => {
    const [quote, setQuote] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const next =
                    (await pickQuote(language)) ??
                    (await pickQuote('en')) ??
                    FALLBACK_QUOTE;
                if (!cancelled) setQuote(next);
            } catch {
                if (!cancelled) setQuote(FALLBACK_QUOTE);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [language]);

    return quote;
};
