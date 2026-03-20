import Redis from 'ioredis';
import { FEED_CACHE_TTL } from '../../../../shared/constants';

let redis: Redis | null = null;

export async function connectRedis(): Promise<void> {
    redis = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    redis.on('error', (err) => console.error('[redis] Error:', err.message));
    redis.on('connect', () => console.log('[redis] Connected'));
}

function getRedis(): Redis {
    if (!redis) throw new Error('[redis] Not connected');
    return redis;
}

/** Store a feed (array of game IDs or objects) for a user */
export async function cacheFeed(userId: string, games: object[]): Promise<void> {
    await getRedis().setex(`feed:${userId}`, FEED_CACHE_TTL, JSON.stringify(games));
}

/** Retrieve a cached feed, or null if expired/missing */
export async function getCachedFeed(userId: string): Promise<object[] | null> {
    const raw = await getRedis().get(`feed:${userId}`);
    return raw ? (JSON.parse(raw) as object[]) : null;
}

/** Invalidate a user's cached feed */
export async function invalidateFeed(userId: string): Promise<void> {
    await getRedis().del(`feed:${userId}`);
}

export async function checkRedisHealth(): Promise<boolean> {
    try { await getRedis().ping(); return true; } catch { return false; }
}

export { redis };
