import Redis from 'ioredis';
import { WS_GAME_ROOM_PREFIX, VIEWER_COUNT_KEY_PREFIX } from '../../../shared/constants';

let redis: Redis | null = null;

export async function connectRedis(): Promise<void> {
    redis = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    redis.on('error', (err) => console.error('[redis] Error:', err.message));
    redis.on('connect', () => console.log('[redis] social-service connected'));
}

function r(): Redis {
    if (!redis) throw new Error('[redis] Not connected');
    return redis;
}

/** Increment viewer count when user joins a game room */
export async function incrementViewers(gameId: string): Promise<number> {
    return r().incr(`${VIEWER_COUNT_KEY_PREFIX}${gameId}`);
}

/** Decrement viewer count when user leaves */
export async function decrementViewers(gameId: string): Promise<number> {
    const val = await r().decr(`${VIEWER_COUNT_KEY_PREFIX}${gameId}`);
    if (val < 0) {
        await r().set(`${VIEWER_COUNT_KEY_PREFIX}${gameId}`, 0);
        return 0;
    }
    return val;
}

/** Get current viewer count */
export async function getViewerCount(gameId: string): Promise<number> {
    const val = await r().get(`${VIEWER_COUNT_KEY_PREFIX}${gameId}`);
    return val ? parseInt(val, 10) : 0;
}

/** Cache like count for real-time sync */
export async function cacheLikeCount(gameId: string, count: number): Promise<void> {
    await r().setex(`likes:${gameId}`, 300, String(count));
}

export async function checkRedisHealth(): Promise<boolean> {
    try { await r().ping(); return true; } catch { return false; }
}

export { redis, WS_GAME_ROOM_PREFIX };
