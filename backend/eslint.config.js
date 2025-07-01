module.exports = [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                global: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
            },
        },
        plugins: {
            prettier: require('eslint-plugin-prettier'),
            jest: require('eslint-plugin-jest'),
        },
        rules: {
            ...require('eslint-plugin-prettier').configs.recommended.rules,
            ...require('eslint-plugin-jest').configs.recommended.rules,
        },
    },
    {
        files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
        languageOptions: {
            globals: {
                ...require('eslint-plugin-jest').environments.globals.globals,
            },
        },
    },
];
