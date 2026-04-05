import { shouldRehydrate } from 'vite-ember-ssr/client';

import Application from './app.ts';
import config from './config.ts';

if (shouldRehydrate()) {
  const app = Application.create({ ...config.APP, autoboot: false });

  const buildUrl = (window.location.pathname + window.location.search).replace(
    config.rootURL,
    '/',
  );

  void app.visit(buildUrl, {
    _renderMode: 'rehydrate',
  });
} else {
  Application.create(config.APP);
}
