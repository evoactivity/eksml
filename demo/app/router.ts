import EmbroiderRouter from '@embroider/router';

import config from '#config';

export default class Router extends EmbroiderRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('parse');
  this.route('write');
  this.route('sax');
  this.route('stream');
  this.route('benchmark');
});
