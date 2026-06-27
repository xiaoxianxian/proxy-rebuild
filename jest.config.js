/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '**/multi-proxy-manager/tests/**/*.test.js',
    '**/tests/**/*.test.js',
  ],
  collectCoverageFrom: [
    'multi-proxy-manager/**/*.js',
    '!**/node_modules/**',
  ],
};
