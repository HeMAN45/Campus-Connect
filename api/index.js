import { migrate } from '../server/db/index.js';
import { createApp } from '../server/index.js';

let ready = false;
const app = createApp();

export default async function handler(req, res) {
  if (!ready) {
    await migrate();
    ready = true;
  }
  app(req, res);
}
