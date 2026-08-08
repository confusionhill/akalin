// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://akalin.space',
  base: '',
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['lucide-react', 'react', 'react-dom']
    },
    ssr: {
      noExternal: ['lucide-react']
    }
  },

  adapter: cloudflare()
});