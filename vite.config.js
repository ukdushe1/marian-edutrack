import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase:  ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
          xlsx:      ['xlsx'],
          router:    ['react-router-dom'],
          ui:        ['lucide-react', 'clsx', 'react-hot-toast'],
        },
      },
    },
  },
});
