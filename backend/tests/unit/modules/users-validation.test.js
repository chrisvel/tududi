const { validateAppearance } = require('../../../modules/users/validation');

describe('users validation: appearance', () => {
    it('keeps the accent as it is', () => {
        expect(validateAppearance({ accent: '#0f766e' })).toEqual({
            accent: '#0f766e',
        });
    });

    it('accepts the short and the long forms of a hex colour', () => {
        expect(validateAppearance({ accent: '#abc' }).accent).toBe('#abc');
        expect(validateAppearance({ accent: '#0f766e' }).accent).toBe(
            '#0f766e'
        );
        expect(validateAppearance({ accent: '#0f766eff' }).accent).toBe(
            '#0f766eff'
        );
    });

    it('normalises the accent', () => {
        expect(validateAppearance({ accent: '  #0F766E  ' }).accent).toBe(
            '#0f766e'
        );
    });

    it('clears the accent when it is empty', () => {
        expect(validateAppearance({ accent: null }).accent).toBeNull();
        expect(validateAppearance({ accent: '' }).accent).toBeNull();
    });

    it('rejects anything that is not a colour', () => {
        expect(() => validateAppearance({ accent: 'teal' })).toThrow(
            /Accent colour must be a hex colour/
        );
        expect(() => validateAppearance({ accent: 'rgb(0 0 0)' })).toThrow(
            /Accent colour must be a hex colour/
        );
        expect(() => validateAppearance({ accent: '#12345' })).toThrow(
            /Accent colour must be a hex colour/
        );
        expect(() => validateAppearance({ accent: 42 })).toThrow(
            /Accent colour must be a hex colour/
        );
    });

    it('rejects appearance settings that are not an object', () => {
        expect(() => validateAppearance(null)).toThrow(
            /Appearance settings must be an object/
        );
        expect(() => validateAppearance('dark')).toThrow(
            /Appearance settings must be an object/
        );
        expect(() => validateAppearance(['#0f766e'])).toThrow(
            /Appearance settings must be an object/
        );
    });

    it('leaves the other settings alone', () => {
        expect(
            validateAppearance({
                theme: 'dark',
                contentBackground: 'blue-ink',
            })
        ).toEqual({ theme: 'dark', contentBackground: 'blue-ink' });
    });
});
