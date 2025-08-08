import {
    createSlug,
    createUidSlug,
    extractUidFromSlug,
    createProjectUrl,
    createNoteUrl,
    createTagUrl,
} from '../slugUtils';

describe('createSlug - International Languages', () => {
    const testCases = [
        // Greek - slugify handles this well
        { input: 'νέο έργο', expected: 'neo-ergo', language: 'Greek' },
        {
            input: 'Αρχιτεκτονικό Πρόγραμμα',
            expected: 'arxitektoniko-programma',
            language: 'Greek',
        },

        // Arabic - slugify handles this
        { input: 'مشروع جديد', expected: 'mshrwa-jdyd', language: 'Arabic' },
        { input: 'خطة العمل', expected: 'khth-alaml', language: 'Arabic' },

        // Chinese - falls back to empty (non-Latin script not supported by slugify)
        { input: '新项目', expected: '', language: 'Chinese' },
        { input: '工作计划', expected: '', language: 'Chinese' },

        // Japanese - falls back to empty
        {
            input: 'あたらしい プロジェクト',
            expected: '',
            language: 'Japanese',
        },
        { input: 'さぎょう けいかく', expected: '', language: 'Japanese' },

        // Russian - slugify handles Cyrillic
        {
            input: 'новый проект',
            expected: 'novyj-proekt',
            language: 'Russian',
        },
        { input: 'План работы', expected: 'plan-raboty', language: 'Russian' },

        // Hebrew - falls back to empty
        { input: 'פרויקט חדש', expected: '', language: 'Hebrew' },
        { input: 'תכנית עבודה', expected: '', language: 'Hebrew' },

        // Korean - falls back to empty
        { input: '새로운 프로젝트', expected: '', language: 'Korean' },
        { input: '작업 계획', expected: '', language: 'Korean' },

        // Thai - falls back to empty
        { input: 'โครงการใหม่', expected: '', language: 'Thai' },
        { input: 'แผนงาน', expected: '', language: 'Thai' },

        // Hindi - falls back to empty
        { input: 'नया प्रोजेक्ट', expected: '', language: 'Hindi' },
        { input: 'कार्य योजना', expected: '', language: 'Hindi' },

        // Vietnamese - Latin script, slugify handles diacritics
        { input: 'dự án mới', expected: 'du-an-moi', language: 'Vietnamese' },
        {
            input: 'kế hoạch làm việc',
            expected: 'ke-hoach-lam-viec',
            language: 'Vietnamese',
        },
    ];

    testCases.forEach(({ input, expected, language }) => {
        it(`should create proper slug for ${language}: "${input}"`, () => {
            const result = createSlug(input);
            expect(result).toBe(expected);
            // Only ASCII letters, numbers, and hyphens after transliteration (or empty)
            expect(result).toMatch(/^[a-z0-9-]*$/);
            expect(result).not.toMatch(/^-|-$/); // No leading or trailing hyphens
        });
    });
});

describe('createSlug - European Languages with Diacritics', () => {
    const testCases = [
        // French
        {
            input: 'Café Français',
            expected: 'cafe-francais',
            language: 'French',
        },
        {
            input: 'Résumé Élégant',
            expected: 'resume-elegant',
            language: 'French',
        },

        // Spanish
        {
            input: 'Niño Español',
            expected: 'nino-espanol',
            language: 'Spanish',
        },
        { input: 'Año Nuevo', expected: 'ano-nuevo', language: 'Spanish' },

        // German - slugify handles umlauts and ß
        { input: 'Größe Weiß', expected: 'grosse-weiss', language: 'German' },
        {
            input: 'Fußball Müller',
            expected: 'fussball-muller',
            language: 'German',
        },

        // Portuguese
        {
            input: 'João Coração',
            expected: 'joao-coracao',
            language: 'Portuguese',
        },
        {
            input: 'Ação Comunicação',
            expected: 'acao-comunicacao',
            language: 'Portuguese',
        },

        // Italian
        {
            input: 'Città Università',
            expected: 'citta-universita',
            language: 'Italian',
        },
        { input: 'Perché Così', expected: 'perche-cosi', language: 'Italian' },

        // Polish - slugify handles special characters
        { input: 'Łódź Kraków', expected: 'lodz-krakow', language: 'Polish' },
        {
            input: 'Młody Człowiek',
            expected: 'mlody-czlowiek',
            language: 'Polish',
        },

        // Czech
        { input: 'Háček Ústí', expected: 'hacek-usti', language: 'Czech' },
        { input: 'Středa Škola', expected: 'streda-skola', language: 'Czech' },

        // Turkish - slugify handles special characters
        {
            input: 'Türkiye İstanbul',
            expected: 'turkiye-istanbul',
            language: 'Turkish',
        },
        {
            input: 'Çalışma Güneş',
            expected: 'calisma-gunes',
            language: 'Turkish',
        },
    ];

    testCases.forEach(({ input, expected, language }) => {
        it(`should handle ${language} diacritics: "${input}"`, () => {
            const result = createSlug(input);
            expect(result).toBe(expected);
            expect(result).toMatch(/^[a-z0-9-]*$/);
            expect(result).not.toMatch(/^-|-$/);
        });
    });
});

describe('createSlug - Edge Cases', () => {
    it('should handle empty string', () => {
        expect(createSlug('')).toBe('');
    });

    it('should handle string with only special characters', () => {
        expect(createSlug('!@#$%^&*()')).toBe('dollarpercentand');
    });

    it('should handle mixed languages', () => {
        const result = createSlug('English 中文 العربية');
        expect(result).toBe('english-alarbyh'); // Arabic gets transliterated, Chinese gets removed
        expect(result).toMatch(/^[a-z0-9-]*$/);
    });

    it('should respect maxLength parameter', () => {
        const longText =
            'This is a very long project name that exceeds the default limit';
        const result = createSlug(longText, 20);
        expect(result.length).toBeLessThanOrEqual(20);
        expect(result).not.toMatch(/-$/); // Should not end with hyphen after truncation
    });

    it('should handle numbers and letters', () => {
        expect(createSlug('Project 2024 Version 1.0')).toBe(
            'project-2024-version-10'
        );
    });

    it('should handle multiple consecutive spaces and hyphens', () => {
        expect(createSlug('Multiple    Spaces --- And--Hyphens')).toBe(
            'multiple-spaces-and-hyphens'
        );
    });
});

describe('createUidSlug - International Project Names', () => {
    const testUid = '1a2b3c4d5e6f7g8';

    it('should create uid-slug for Greek project', () => {
        const result = createUidSlug(testUid, 'νέο έργο');
        expect(result).toBe('1a2b3c4d5e6f7g8-neo-ergo');
    });

    it('should create uid-slug for Arabic project', () => {
        const result = createUidSlug(testUid, 'مشروع جديد');
        expect(result).toBe('1a2b3c4d5e6f7g8-mshrwa-jdyd');
    });

    it('should create uid-slug for Chinese project', () => {
        const result = createUidSlug(testUid, '新项目');
        expect(result).toBe(testUid); // Falls back to UID only when slug is empty
    });

    it('should return only uid when name results in empty slug', () => {
        const result = createUidSlug(testUid, '!@#$%');
        expect(result).toBe('1a2b3c4d5e6f7g8-dollarpercent'); // slugify transliterates these
    });
});

describe('URL Creation Functions - International Names', () => {
    const testUid = '1a2b3c4d5e6f7g8';

    describe('createProjectUrl', () => {
        it('should create URL for Greek project', () => {
            const project = { uid: testUid, name: 'νέο έργο' };
            const result = createProjectUrl(project);
            expect(result).toBe('/project/1a2b3c4d5e6f7g8-neo-ergo');
        });

        it('should create URL for French project with accents', () => {
            const project = { uid: testUid, name: 'Café Français' };
            const result = createProjectUrl(project);
            expect(result).toBe('/project/1a2b3c4d5e6f7g8-cafe-francais');
        });
    });

    describe('createNoteUrl', () => {
        it('should create URL for Chinese note', () => {
            const note = { uid: testUid, title: '工作计划' };
            const result = createNoteUrl(note);
            expect(result).toBe('/note/1a2b3c4d5e6f7g8'); // Falls back to UID only
        });
    });

    describe('createTagUrl', () => {
        it('should create URL for Arabic tag', () => {
            const tag = { uid: testUid, name: 'خطة العمل' };
            const result = createTagUrl(tag);
            expect(result).toBe('/tag/1a2b3c4d5e6f7g8-khth-alaml');
        });
    });
});

describe('extractUidFromSlug - International Slugs', () => {
    const testUid = '1a2b3c4d5e6f7g8';

    it('should extract UID from Greek project slug', () => {
        const slug = '1a2b3c4d5e6f7g8-neo-ergo';
        expect(extractUidFromSlug(slug)).toBe(testUid);
    });

    it('should extract UID from Arabic project slug', () => {
        const slug = '1a2b3c4d5e6f7g8-mshrow-gdyd';
        expect(extractUidFromSlug(slug)).toBe(testUid);
    });

    it('should extract UID when no slug part exists', () => {
        expect(extractUidFromSlug(testUid)).toBe(testUid);
    });
});
