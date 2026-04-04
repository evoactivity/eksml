import Application from './app.ts';
import config from './config.ts';
import { shouldRehydrate } from 'vite-ember-ssr/client';

if (shouldRehydrate()) {
  const app = Application.create({ ...config.APP, autoboot: false });

  app.visit(window.location.pathname + window.location.search, {
    _renderMode: 'rehydrate',
  });
} else {
  Application.create(config.APP);
}
