import PageTitleService from 'ember-page-title/services/page-title';
import Application from 'ember-strict-application-resolver';

import config from './config.ts';
import Router from './router.ts';

class App extends Application {
  modules = {
    './router': Router,
    './services/page-title': PageTitleService,
    ...import.meta.glob('./{routes,templates}/**/*.{ts,gts}', { eager: true }),
    ...import.meta.glob('./services/**/*', { eager: true }),
  };
}

export function createSsrApp() {
  return App.create({ ...config.APP, autoboot: false });
}
