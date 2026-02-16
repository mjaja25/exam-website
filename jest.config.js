module.exports = {
    testEnvironment: 'node',
    setupFiles: ['./tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'controllers/**/*.js',
        'middleware/**/*.js',
        'services/**/*.js',
        'utils/**/*.js',
        'validation/**/*.js'
    ],
    coverageDirectory: 'coverage',
    verbose: true,
    // Prevent tests from hanging due to open handles (MongoDB, timers, etc.)
    forceExit: true,
    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true
};
