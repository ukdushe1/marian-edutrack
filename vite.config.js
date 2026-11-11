import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Maps are generated for debugging but not linked from the shipped files
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Core libraries every page needs; pages and xlsx are split automatically (lazy routes)
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react:    ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
