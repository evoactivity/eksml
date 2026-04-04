import PageTitleService from 'ember-page-title/services/page-title';
import Application from 'ember-strict-application-resolver';

export default class App extends Application {
  modules = {
    './services/page-title': PageTitleService,
    ...import.meta.glob('./router.*', { eager: true }),
    ...import.meta.glob('./templates/**/*', { eager: true }),
    ...import.meta.glob('./routes/**/*', { eager: true }),
    ...import.meta.glob('./services/**/*', { eager: true }),
  };
}
