import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, forward /api calls to the Express server so cookies stay on one origin.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:4000' } },
});
