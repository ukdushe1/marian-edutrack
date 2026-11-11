import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['tests/rules/**', 'node_modules/**'], // rules tests need the emulator: npm run test:rules
  },
});
