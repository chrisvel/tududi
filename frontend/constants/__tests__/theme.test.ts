import {
    applyThemeAccent,
    DEFAULT_ACCENT,
    isThemeColor,
    readStoredThemeAccent,
    storeThemeAccent,
    THEME_ACCENT_STORAGE_KEY,
    themeAccentHex,
    themeAccentVars,
} from '../theme';

describe('theme accent', () => {
    beforeEach(() => {
        document.documentElement.removeAttribute('style');
        localStorage.clear();
    });

    describe('isThemeColor', () => {
        it('accepts hex colours', () => {
            expect(isThemeColor('#2563eb')).toBe(true);
            expect(isThemeColor('#abc')).toBe(true);
            expect(isThemeColor('#2563ebff')).toBe(true);
        });

        it('rejects anything that is not a hex colour', () => {
            expect(isThemeColor('blue')).toBe(false);
            expect(isThemeColor('rgb(1 2 3)')).toBe(false);
            expect(isThemeColor('#12345')).toBe(false);
            expect(isThemeColor(null)).toBe(false);
            expect(isThemeColor(42)).toBe(false);
        });
    });

    describe('themeAccentVars', () => {
        it('gives every shade of the palette', () => {
            const vars = themeAccentVars('#2563eb');
            expect(Object.keys(vars)).toEqual(
                expect.arrayContaining([
                    '--theme-blue-50',
                    '--theme-blue-500',
                    '--theme-blue-600',
                    '--theme-blue-950',
                ])
            );
        });

        it('reproduces the default palette for the default accent', () => {
            const vars = themeAccentVars(DEFAULT_ACCENT);
            expect(vars['--theme-blue-50']).toBe('239 246 255');
            expect(vars['--theme-blue-500']).toBe('59 130 246');
            expect(vars['--theme-blue-600']).toBe('37 99 235');
            expect(vars['--theme-blue-900']).toBe('30 58 138');
        });

        it('keeps the hue of the accent', () => {
            // A green accent reads as green in every shade.
            const vars = themeAccentVars('#15803d');
            const channels = vars['--theme-blue-500'].split(' ').map(Number);
            const [r, g, b] = channels;
            expect(g).toBeGreaterThan(r);
            expect(g).toBeGreaterThan(b);
        });

        it('keeps the accent itself as the solid shade', () => {
            expect(themeAccentHex('#15803d')).toBe('#15803d');
        });

        it('pales the accent towards the light shades', () => {
            const light = themeAccentHex('#15803d', 50);
            const solid = themeAccentHex('#15803d', 600);
            expect(light).not.toBe(solid);
            expect(light!.length).toBe(7);
        });

        it('has nothing for a colour it cannot read', () => {
            expect(themeAccentVars('not-a-colour')).toEqual({});
            expect(themeAccentVars(null)).toEqual({});
            expect(themeAccentVars(undefined)).toEqual({});
        });
    });

    describe('applyThemeAccent', () => {
        it('sets the variables on the document', () => {
            applyThemeAccent('#15803d');
            expect(
                document.documentElement.style.getPropertyValue(
                    '--theme-blue-600'
                )
            ).toBe('21 128 61');
        });

        it('removes the variables again without an accent', () => {
            applyThemeAccent('#15803d');
            applyThemeAccent(null);
            expect(
                document.documentElement.style.getPropertyValue(
                    '--theme-blue-600'
                )
            ).toBe('');
        });
    });

    describe('storage', () => {
        it('keeps the accent between sessions', () => {
            storeThemeAccent('#15803d');
            expect(localStorage.getItem(THEME_ACCENT_STORAGE_KEY)).toBe(
                '#15803d'
            );
            expect(readStoredThemeAccent()).toBe('#15803d');
        });

        it('forgets the accent when it is cleared', () => {
            storeThemeAccent('#15803d');
            storeThemeAccent(null);
            expect(readStoredThemeAccent()).toBeNull();
        });
    });
});
