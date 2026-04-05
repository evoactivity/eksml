import { defineConfig } from 'vite';
import { extensions, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { emberSsg } from 'vite-ember-ssr/vite-plugin';

export default defineConfig({
  base: '/eksml/',
  plugins: [
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
    emberSsg({
      routes: ['index', 'parse', 'write', 'sax', 'stream', 'benchmark'],
      rehydrate: true,
    }),
  ],
  resolve: {
    alias: {
      // xml2js (and sax) import Node built-ins that Vite externalises as
      // empty stubs by default. Point them at real browser polyfills so the
      // benchmark worker can use xml2js at runtime.
      events: 'events',
      timers: 'timers-browserify',
    },
  },
});
