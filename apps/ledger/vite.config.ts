import { defineConfig, loadEnv } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load all env vars (including non-VITE_ prefixed) for server-side use
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    server: {
      port: 3000,
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths(),
      tanstackStart(),
      viteReact(),
    ],
  };
});
