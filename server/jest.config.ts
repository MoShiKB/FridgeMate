import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    cacheDirectory: '<rootDir>/.jest-cache',
    globalSetup: '<rootDir>/tests/globalSetup.ts',
    globalTeardown: '<rootDir>/tests/globalTeardown.ts',
    setupFilesAfterEnv: ['./tests/setup.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'html'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        'index.ts',
        'passport.ts',
    ],
    testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    maxWorkers: 1,
};

export default config;

