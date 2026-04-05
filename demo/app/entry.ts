import { shouldRehydrate } from 'vite-ember-ssr/client';

import Application from './app.ts';
import config from './config.ts';

if (shouldRehydrate()) {
  const app = Application.create({ ...config.APP, autoboot: false });

  void app.visit(window.location.pathname + window.location.search, {
    _renderMode: 'rehydrate',
  });
} else {
  Application.create(config.APP);
}
