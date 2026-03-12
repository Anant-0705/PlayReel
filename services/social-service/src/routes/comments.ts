import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { publish, EXCHANGES } from '../rabbitmq';
import { broadcastComment } from '../websocket';
import { getIo } from '../io';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '../../../../shared/errors';
import { ROUTING_KEYS } from '../../../../shared/events';

const router = Router();

const CommentSchema = z.object({
    content: z.string().min(1).max(1000),
});

// ── GET /comments/:gameId ──────────────────────────────────────
router.get('/comments/:gameId', asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    const cursorClause = cursor ? 'AND c.created_at < $3' : '';
    const params: unknown[] = [gameId, limit];
    if (cursor) params.push(cursor);

    const comments = await query(
        `SELECT c.id, c.content, c.created_at,
            u.id AS user_id, u.username, u.avatar_url
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.game_id = $1 ${cursorClause}
     ORDER BY c.created_at DESC
     LIMIT $2`,
        params,
    );

    const nextCursor = comments.length === limit
        ? (comments[comments.length - 1] as { created_at: string }).created_at
        : null;

    res.json({ success: true, data: { comments, nextCursor, hasMore: !!nextCursor } });
}));

// ── POST /comment ──────────────────────────────────────────────
router.post('/comment', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const result = CommentSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError('Comment content is required');
    const { content } = result.data;
    const { gameId } = req.body as { gameId?: string };
    if (!gameId) throw new ValidationError('gameId is required');

    const game = await queryOne<{ id: string; uploader_id: string; title: string }>(
        "SELECT id, uploader_id, title FROM games WHERE id = $1 AND status = 'ready'",
        [gameId],
    );
    if (!game) throw new NotFoundError('Game');

    const [comment] = await query<{ id: string; content: string; created_at: string }>(
        `INSERT INTO comments (user_id, game_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, content, created_at`,
        [req.user!.userId, gameId, content],
    );

    const fullComment = {
        ...comment,
        userId: req.user!.userId,
        username: req.user!.username,
    };

    // Real-time broadcast
    broadcastComment(getIo(), gameId, fullComment);

    // Publish for notification-worker
    await publish(EXCHANGES.SOCIAL_EVENTS, ROUTING_KEYS.SOCIAL_COMMENTED, {
        gameId,
        commentId: comment.id,
        commenterId: req.user!.userId,
        gameOwnerId: game.uploader_id,
        commenterUsername: req.user!.username,
        gameTitle: game.title,
        contentPreview: content.slice(0, 80),
    });

    res.status(201).json({ success: true, data: fullComment });
}));

export default router;
