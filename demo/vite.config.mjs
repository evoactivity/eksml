import { defineConfig } from 'vite';
import { extensions, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions,
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
