import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'gamereel',
    user: process.env.DB_USER || 'gamereel',
    password: process.env.DB_PASSWORD || 'changeme_db_password',
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult<T> = await pool.query(sql, params);
    return result.rows;
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await query<T>(sql, params);
    return rows[0];
}

export async function checkDbHealth(): Promise<boolean> {
    try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

export { pool };
