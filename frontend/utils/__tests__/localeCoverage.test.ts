import fs from 'fs';
import path from 'path';

const localesDir = path.resolve(__dirname, '../../../public/locales');

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
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

    it('every literal key the frontend translates resolves to an English string', () => {
        const frontendDir = path.resolve(__dirname, '../..');
        const sources: string[] = [];
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== '__tests__') walk(full);
                } else if (
                    /\.tsx?$/.test(entry.name) &&
                    !/\.test\.tsx?$/.test(entry.name)
                ) {
                    sources.push(full);
                }
            }
        };
        walk(frontendDir);

        const resolves = (key: string) =>
            ['', '_one', '_other'].some(
                (suffix) =>
                    typeof (key + suffix)
                        .split('.')
                        .reduce<unknown>(
                            (node, part) =>
                                node && typeof node === 'object'
                                    ? (node as Record<string, unknown>)[part]
                                    : undefined,
                            en
                        ) === 'string'
            );
        // t('ns.key' ...) calls and labelKey: 'ns.key' style lookup tables
        const keyPattern =
            /(?:\bt\(\s*|\b\w*Key\??:\s*)['"`]([a-zA-Z]\w*(?:\.\w+)+)['"`]/g;
        const missing = sources.flatMap((file) =>
            [...fs.readFileSync(file, 'utf8').matchAll(keyPattern)]
                .map((match) => match[1])
                .filter((key) => !resolves(key))
                .map((key) => `${path.relative(frontendDir, file)}: ${key}`)
        );
        expect(missing).toEqual([]);
    });
});
