import { config } from '../config.js';
import { pool, migrate } from './index.js';

if (config.isProd) {
  console.error('db:reset refuses to run when NODE_ENV=production.');
  process.exit(1);
}

await pool.query('DROP SCHEMA public CASCADE');
await pool.query('CREATE SCHEMA public');
await migrate();
console.log('Database reset and migrations applied.');
await pool.end();
