import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import pluginPrettier from 'eslint-plugin-prettier';

export default [
    {
        files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.tsbuildinfo'],
    },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,
    {
        plugins: {
            prettier: pluginPrettier,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            'react/react-in-jsx-scope': 'off', // Not needed with React 18
            'prettier/prettier': 'error',
        },
        settings: {
            react: {
                version: '18',
            },
        },
    },
];
