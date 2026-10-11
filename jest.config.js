module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/frontend'],
    testMatch: [
        '<rootDir>/frontend/**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
        '<rootDir>/frontend/**/*.(test|spec).{js,jsx,ts,tsx}',
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    // LTD-PATCH(T-103): exercise real Markdown rendering with its ESM dependencies.
    transformIgnorePatterns: [
        'node_modules/(?!(react-markdown|remark-.*|rehype-.*|unified|bail|is-plain-obj|trough|vfile.*|unist-util-.*|hast-util-.*|mdast-util-.*|micromark.*|decode-named-character-reference|character-entities.*|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|web-namespaces|zwitch|devlop|ccount|escape-string-regexp|trim-lines|longest-streak|markdown-table|lowlight|estree-util-.*|parse-entities|character-reference-invalid|is-alphanumerical|is-alphabetical|is-decimal|is-hexadecimal|stringify-entities|@ungap/structured-clone)/)',
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFilesAfterEnv: ['<rootDir>/frontend/__tests__/setup.ts'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^@/(.*)$': '<rootDir>/frontend/$1',
    },
    collectCoverageFrom: [
        'frontend/**/*.{ts,tsx}',
        '!frontend/**/*.d.ts',
        '!frontend/index.tsx',
        '!frontend/**/__tests__/**',
        '!frontend/**/node_modules/**',
    ],
    coverageDirectory: 'coverage-frontend',
    coverageReporters: ['text', 'lcov', 'html'],
};
