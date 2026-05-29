import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function rewriteEsToolkit() {
  return {
    name: 'rewrite-es-toolkit',
    enforce: 'pre',
    transform(code:any, id:any) {
      if (id.includes('node_modules/recharts/') && code.includes('es-toolkit/compat/')) {
        return code.replace(/import\s+(\w+)\s+from\s+['"]es-toolkit\/compat\/(\w+)['"];?/g, "import { $2 as $1 } from 'es-toolkit/compat';");
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), rewriteEsToolkit()],
  build: {
    minify: false,
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
