import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`morning-cockpit read-model on http://127.0.0.1:${config.port}`);
});
