import fs from 'fs';
import path from 'path';

const localesDir = path.resolve(__dirname, '../../../public/locales');

const flatten = (
    obj: Record<string, unknown>,
    prefix = ''
): string[] =>
    Object.entries(obj).flatMap(([key, value]) =>
        value && typeof value === 'object' && !Array.isArray(value)
            ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
            : [`${prefix}${key}`]
    );

describe('locale key coverage', () => {
    const en = JSON.parse(
        fs.readFileSync(path.join(localesDir, 'en/translation.json'), 'utf8')
    );
    const enKeys = flatten(en).sort();

    it('fa has every English key (missing keys fail CI)', () => {
        const faPath = path.join(localesDir, 'fa/translation.json');
        expect(fs.existsSync(faPath)).toBe(true);
        const fa = JSON.parse(fs.readFileSync(faPath, 'utf8'));
        const faKeys = new Set(flatten(fa));
        const missing = enKeys.filter((key) => !faKeys.has(key));
        expect(missing).toEqual([]);
    });

    it('every other locale keeps the English key set (placeholders allowed)', () => {
        const locales = fs
            .readdirSync(localesDir)
            .filter((lng) => lng !== 'en' && lng !== 'fa');
        for (const lng of locales) {
            const file = path.join(localesDir, lng, 'translation.json');
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            const keys = new Set(flatten(data));
            const missing = enKeys.filter((key) => !keys.has(key));
            expect({ lng, missing }).toEqual({ lng, missing: [] });
        }
    });
});
