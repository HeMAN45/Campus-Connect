import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { config } from '../config.js';

pg.types.setTypeParser(1114, (str) => new Date(str + 'Z').toISOString());
pg.types.setTypeParser(1184, (str) => new Date(str).toISOString());

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const txStore = new AsyncLocalStorage();
const getClient = () => txStore.getStore() || pool;

function parameterize(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function get(sql, ...params) {
  const { rows } = await getClient().query(parameterize(sql), params);
  return rows[0] || undefined;
}

export async function all(sql, ...params) {
  const { rows } = await getClient().query(parameterize(sql), params);
  return rows;
}

export async function run(sql, ...params) {
  let query = parameterize(sql);
  const isInsert = /^\s*INSERT/i.test(sql);
  if (isInsert && !/RETURNING/i.test(query)) query += ' RETURNING *';
  const result = await getClient().query(query, params);
  return {
    changes: result.rowCount,
    id: isInsert && result.rows[0]?.id != null ? Number(result.rows[0].id) : 0,
  };
}

export const placeholders = (n) => Array(n).fill('?').join(',');

export async function tx(fn) {
  const existing = txStore.getStore();
  if (existing) return fn();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStore.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const nowIso = () => new Date().toISOString();
export const parseJson = (v, fallback = []) => {
  if (Array.isArray(v) || (v && typeof v === 'object')) return v;
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const dir = path.join(config.root, 'db', 'migrations');
  if (!fs.existsSync(dir)) return;
  const { rows } = await pool.query('SELECT version FROM schema_migrations');
  const done = new Set(rows.map((r) => r.version));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const version = Number(file.split('_')[0]);
    if (done.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [version, file]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
