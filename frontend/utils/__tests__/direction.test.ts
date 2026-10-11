import {
    isRtlLanguage,
    getDirection,
    applyDocumentDirection,
} from '../direction';

describe('direction utils', () => {
    describe('isRtlLanguage', () => {
        it('treats fa and ar as RTL', () => {
            expect(isRtlLanguage('fa')).toBe(true);
            expect(isRtlLanguage('ar')).toBe(true);
        });

        it('treats regional variants as their base language', () => {
            expect(isRtlLanguage('fa-IR')).toBe(true);
            expect(isRtlLanguage('ar-SA')).toBe(true);
        });

        it('treats LTR languages as LTR', () => {
            expect(isRtlLanguage('en')).toBe(false);
            expect(isRtlLanguage('de')).toBe(false);
            expect(isRtlLanguage('jp')).toBe(false);
        });

        it('handles empty input', () => {
            expect(isRtlLanguage(undefined)).toBe(false);
            expect(isRtlLanguage(null)).toBe(false);
            expect(isRtlLanguage('')).toBe(false);
        });
    });

    describe('getDirection', () => {
        it('returns rtl for fa and ar', () => {
            expect(getDirection('fa')).toBe('rtl');
            expect(getDirection('ar')).toBe('rtl');
        });

        it('returns ltr for en and other LTR languages', () => {
            expect(getDirection('en')).toBe('ltr');
            expect(getDirection('fr')).toBe('ltr');
        });
    });

    describe('applyDocumentDirection', () => {
        afterEach(() => {
            document.documentElement.dir = '';
            document.documentElement.lang = '';
        });

        it('sets dir=rtl and lang for fa', () => {
            applyDocumentDirection('fa');
            expect(document.documentElement.dir).toBe('rtl');
            expect(document.documentElement.lang).toBe('fa');
        });

        it('sets dir=rtl for ar', () => {
            applyDocumentDirection('ar');
            expect(document.documentElement.dir).toBe('rtl');
        });

        it('sets dir=ltr when switching back to en', () => {
            applyDocumentDirection('fa');
            applyDocumentDirection('en');
            expect(document.documentElement.dir).toBe('ltr');
            expect(document.documentElement.lang).toBe('en');
        });
    });
});
