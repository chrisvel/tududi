module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/frontend'],
  testMatch: [
    '<rootDir>/frontend/**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
    '<rootDir>/frontend/**/*.(test|spec).{js,jsx,ts,tsx}'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/frontend/__tests__/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/frontend/$1'
  },
  collectCoverageFrom: [
    'frontend/**/*.{ts,tsx}',
    '!frontend/**/*.d.ts',
    '!frontend/index.tsx',
    '!frontend/**/__tests__/**',
    '!frontend/**/node_modules/**'
  ],
  coverageDirectory: 'coverage-frontend',
  coverageReporters: ['text', 'lcov', 'html']
};