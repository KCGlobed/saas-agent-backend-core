import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/main.tsx',
      name: 'ChatWidget',
      fileName: (format) => `chat-widget.${format}.js`
    },
    rollupOptions: {
      // In a real widget, you might want to bundle React with it if it's meant to be embedded via a simple <script> tag on vanilla sites.
      // So we do NOT externalize React.
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  }
});
