import fs from 'node:fs';
import { config } from '../config.js';

if (config.isProd) {
  console.error('db:reset refuses to run when NODE_ENV=production.');
  process.exit(1);
}

if (config.dbPath !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + suffix, { force: true });
}
fs.rmSync(config.uploadDir, { recursive: true, force: true });

await import('./index.js');
console.log(`Database reset: ${config.dbPath}`);
