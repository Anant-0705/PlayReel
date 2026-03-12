import { Pool } from 'pg';

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'postgres',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'gamereel',
    user: process.env.POSTGRES_USER || 'gamereel',
    password: process.env.POSTGRES_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => console.error('[db] Pool error:', err.message));

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    const res = await pool.query(text, params);
    return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] ?? null;
}

export async function checkDbHealth(): Promise<boolean> {
    try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

export { pool };
