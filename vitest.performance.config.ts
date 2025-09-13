import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/tests/**/*.{performance,benchmark,regression,integration}.test.ts'],
    exclude: ['src/tests/**/*.unit.test.ts'],
    testTimeout: 30000, // Longer timeout for performance tests
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/tests/**',
        'src/**/*.test.ts',
        'src/**/*.d.ts'
      ]
    },
    // Performance-specific settings
    maxConcurrency: 1, // Run performance tests sequentially to avoid interference
    minWorkers: 1,
    maxWorkers: 1,
    fileParallelism: false, // Disable parallel execution for consistent timing
    isolate: true, // Ensure clean environment for each test
    // Custom reporter for performance results
    reporter: ['default', 'json'],
    outputFile: {
      json: './performance-results/results.json'
    }
  },
  // Ensure consistent environment
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.PERFORMANCE_TEST': '"true"'
  }
});