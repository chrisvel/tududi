const { hostedConfigProblems } = require('../../../config/hostedConfig');

const fullEnv = {
    TUDUDI_SESSION_SECRET: 'x'.repeat(64),
    TUDUDI_ALLOWED_ORIGINS: 'https://app.example.com',
    FRONTEND_URL: 'https://app.example.com',
    BACKEND_URL: 'https://app.example.com',
};

const fullConfig = {
    hosted: { enabled: true },
    trustProxy: 1,
    emailConfig: { enabled: true, smtp: { host: 'smtp.example.com' } },
    db: { dialect: 'postgres' },
};

describe('hostedConfigProblems', () => {
    it('reports nothing when hosted mode is off, whatever else is set', () => {
        expect(
            hostedConfigProblems({}, { hosted: { enabled: false } })
        ).toEqual([]);
    });

    it('reports nothing for a fully configured hosted instance', () => {
        expect(hostedConfigProblems(fullEnv, fullConfig)).toEqual([]);
    });

    it('accepts BASE_URL in place of BACKEND_URL', () => {
        const env = { ...fullEnv };
        delete env.BACKEND_URL;
        env.BASE_URL = 'https://app.example.com';
        expect(hostedConfigProblems(env, fullConfig)).toEqual([]);
    });

    it('lists every missing piece of a bare instance', () => {
        const problems = hostedConfigProblems(
            {},
            {
                hosted: { enabled: true },
                trustProxy: false,
                emailConfig: { enabled: false, smtp: {} },
                db: { dialect: 'sqlite' },
            }
        );

        const text = problems.join('\n');
        expect(text).toMatch(/TUDUDI_SESSION_SECRET/);
        expect(text).toMatch(/TUDUDI_TRUST_PROXY/);
        expect(text).toMatch(/TUDUDI_ALLOWED_ORIGINS/);
        expect(text).toMatch(/FRONTEND_URL/);
        expect(text).toMatch(/BACKEND_URL/);
        expect(text).toMatch(/ENABLE_EMAIL/);
        expect(text).toMatch(/PostgreSQL/);
        expect(problems).toHaveLength(7);
    });

    it('treats localhost URLs as unset', () => {
        const problems = hostedConfigProblems(
            { ...fullEnv, FRONTEND_URL: 'http://localhost:8080' },
            fullConfig
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/FRONTEND_URL/);
    });
});
