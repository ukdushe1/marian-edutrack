import { defineConfig } from 'vitest/config';

// Security-rules tests: run inside the Firestore emulator (npm run test:rules)
export default defineConfig({
  test: { environment: 'node', include: ['tests/rules/**/*.test.js'], testTimeout: 20000, hookTimeout: 30000, fileParallelism: false },
});
