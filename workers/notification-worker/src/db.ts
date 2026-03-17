import { Pool, QueryResult } from 'pg';

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

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result: QueryResult<T> = await pool.query(sql, params);
    return result.rows;
}

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await query<T>(sql, params))[0];
}

/** Get all FCM device tokens for a user */
export async function getDeviceTokens(userId: string): Promise<string[]> {
    const rows = await query<{ token: string }>(
        'SELECT token FROM device_tokens WHERE user_id = $1',
        [userId],
    );
    return rows.map((r) => r.token);
}

export async function checkDbHealth(): Promise<boolean> {
    try { await pool.query('SELECT 1'); return true; } catch { return false; }
}
