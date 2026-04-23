import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      input: 'index.html',
      external: ['leaflet', '@supabase/supabase-js'],
    },
  },
});
