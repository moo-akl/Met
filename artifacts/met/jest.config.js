module.exports = {
  preset: 'jest-expo',
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        root: __dirname,
        babelrcRoots: __dirname,
        babelrc: true,
        configFile: true,
        extends: __dirname + '/babel.config.js',
        caller: {
          name: 'babel-jest',
          supportsStaticESM: false,
        },
      },
    ],
  },
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
