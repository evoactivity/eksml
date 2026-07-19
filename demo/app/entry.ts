import Application from './app.ts';
import config from './config.ts';
import { bootRehydrated } from 'vite-ember-ssr/client';

bootRehydrated(Application, config);
