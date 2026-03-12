import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { publish, EXCHANGES } from '../rabbitmq';
import { broadcastLike } from '../websocket';
import { getIo } from '../io';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, NotFoundError } from '../../../../shared/errors';
import { ROUTING_KEYS } from '../../../../shared/events';

const router = Router();

// ── POST /like/:gameId ────────────────────────────────────────
router.post('/like/:gameId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const userId = req.user!.userId;

    const game = await queryOne<{ id: string; uploader_id: string; title: string; like_count: number }>(
        "SELECT id, uploader_id, title, like_count FROM games WHERE id = $1 AND status != 'uploading'",
        [gameId],
    );
    if (!game) throw new NotFoundError('Game');

    // Upsert like — idempotent
    await query(
        'INSERT INTO likes (user_id, game_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, gameId],
    );

    // Get updated count (trigger already incremented it)
    const updated = await queryOne<{ like_count: number }>(
        'SELECT like_count FROM games WHERE id = $1', [gameId],
    );
    const likeCount = updated?.like_count ?? game.like_count + 1;

    // Real-time broadcast via Socket.io
    broadcastLike(getIo(), gameId, likeCount, userId);

    // Publish to RabbitMQ for notification-worker + feed invalidation
    await publish(EXCHANGES.SOCIAL_EVENTS, ROUTING_KEYS.SOCIAL_LIKED, {
        gameId,
        likerId: userId,
        gameOwnerId: game.uploader_id,
        likerUsername: req.user!.username,
        gameTitle: game.title,
    });

    res.status(201).json({ success: true, data: { liked: true, likeCount } });
}));

// ── DELETE /unlike/:gameId ────────────────────────────────────
router.delete('/unlike/:gameId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const userId = req.user!.userId;

    await query('DELETE FROM likes WHERE user_id = $1 AND game_id = $2', [userId, gameId]);

    const updated = await queryOne<{ like_count: number }>(
        'SELECT like_count FROM games WHERE id = $1', [gameId],
    );

    broadcastLike(getIo(), gameId, updated?.like_count ?? 0, userId);

    res.json({ success: true, data: { liked: false, likeCount: updated?.like_count ?? 0 } });
}));

// ── GET /likes/:gameId/status ─────────────────────────────────
router.get('/likes/:gameId/status', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const liked = await queryOne(
        'SELECT 1 FROM likes WHERE user_id = $1 AND game_id = $2',
        [req.user!.userId, req.params.gameId],
    );
    res.json({ success: true, data: { liked: !!liked } });
}));

export default router;
