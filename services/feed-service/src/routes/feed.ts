import { Router, Request, Response } from 'express';
import { buildFeed, buildExploreFeed } from '../algorithm';
import { cacheFeed, getCachedFeed } from '../redis';
import { asyncHandler } from '../../../../shared/errors';
import { Request as JwtRequest, Response as _Res, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Optional auth inline for this service
function optionalAuth(req: JwtRequest, _res: _Res, next: NextFunction): void {
    const token = req.headers.authorization?.slice(7);
    if (token) {
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET!) as Express.Request['user'];
        } catch { /* no-op */ }
    }
    next();
}

declare global {
    namespace Express {
        interface Request { user?: { userId: string; username: string; email: string } }
    }
}

// ── GET /feed ─────────────────────────────────────────────────
router.get('/feed', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const userId = req.user?.userId;

    // Anonymous users → explore feed (no cache)
    if (!userId) {
        const games = await buildExploreFeed(cursor, limit);
        const nextCursor = games.length === limit
            ? (games[games.length - 1] as { created_at: string }).created_at
            : null;
        return res.json({ success: true, data: { games, nextCursor, hasMore: !!nextCursor } });
    }

    // Check Redis cache (only for first page — cursor = undefined)
    if (!cursor) {
        const cached = await getCachedFeed(userId);
        if (cached) {
            return res.json({
                success: true,
                data: { games: cached.slice(0, limit), nextCursor: null, hasMore: false, cached: true },
            });
        }
    }

    const games = await buildFeed(userId, cursor, limit);

    // Cache the first page result
    if (!cursor && games.length > 0) {
        await cacheFeed(userId, games);
    }

    const nextCursor = games.length === limit
        ? (games[games.length - 1] as { created_at: string }).created_at
        : null;

    res.json({ success: true, data: { games, nextCursor, hasMore: !!nextCursor } });
}));

export default router;
