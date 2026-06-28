module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.test.{ts,tsx}',
  ],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/__tests__/**',
  ],
};
