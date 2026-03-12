import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '../../../../shared/errors';

const router = Router();

// ── GET /profile/:id ──────────────────────────────────────────
router.get('/profile/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await queryOne<{
        id: string; username: string; avatar_url: string | null;
        bio: string | null; created_at: string;
    }>(
        `SELECT u.id, u.username, u.avatar_url, u.bio, u.created_at,
            (SELECT count(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
            (SELECT count(*) FROM follows WHERE follower_id  = u.id)::int AS following_count,
            (SELECT count(*) FROM games WHERE uploader_id = u.id AND status = 'ready')::int AS game_count
     FROM users u WHERE u.id = $1`,
        [id],
    );
    if (!user) throw new NotFoundError('User');

    res.json({ success: true, data: user });
}));

// ── PUT /profile ──────────────────────────────────────────────
const UpdateProfileSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
    bio: z.string().max(300).optional(),
    avatarUrl: z.string().url().optional(),
    fcmToken: z.string().optional(),
});

router.put('/profile', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const result = UpdateProfileSchema.safeParse(req.body);
    if (!result.success) {
        throw new ValidationError('Validation failed', result.error.flatten().fieldErrors as Record<string, string>);
    }

    const { username, bio, avatarUrl, fcmToken } = result.data;
    const userId = req.user!.userId;

    const updated = await queryOne<{ id: string; username: string; bio: string | null; avatar_url: string | null }>(
        `UPDATE users SET
       username   = COALESCE($1, username),
       bio        = COALESCE($2, bio),
       avatar_url = COALESCE($3, avatar_url),
       fcm_token  = COALESCE($4, fcm_token)
     WHERE id = $5
     RETURNING id, username, bio, avatar_url`,
        [username ?? null, bio ?? null, avatarUrl ?? null, fcmToken ?? null, userId],
    );

    res.json({ success: true, data: updated });
}));

// ── GET /profile/:id/games ─────────────────────────────────────
router.get('/profile/:id/games', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    const cursorClause = cursor ? `AND g.created_at < $3` : '';
    const params: unknown[] = [id, limit];
    if (cursor) params.push(cursor);

    const games = await query(
        `SELECT g.id, g.title, g.genre, g.thumbnail_url, g.status,
            g.play_count, g.like_count, g.created_at
     FROM games g
     WHERE g.uploader_id = $1 AND g.status != 'uploading'
     ${cursorClause}
     ORDER BY g.created_at DESC
     LIMIT $2`,
        params,
    );

    const nextCursor = games.length === limit
        ? (games[games.length - 1] as { created_at: string }).created_at
        : null;

    res.json({ success: true, data: { games, nextCursor, hasMore: !!nextCursor } });
}));

export default router;
