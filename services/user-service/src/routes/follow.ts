import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { publish, EXCHANGES } from '../rabbitmq';
import { ROUTING_KEYS } from '../../../../shared/events';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ConflictError, NotFoundError } from '../../../../shared/errors';

const router = Router();

// ── POST /follow/:id ──────────────────────────────────────────
router.post('/follow/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const followerId = req.user!.userId;
    const followingId = req.params.id;

    if (followerId === followingId) {
        throw new ConflictError('Cannot follow yourself');
    }

    // Check target user exists
    const target = await queryOne<{ id: string; username: string }>(
        'SELECT id, username FROM users WHERE id = $1',
        [followingId],
    );
    if (!target) throw new NotFoundError('User');

    // Insert follow (ignore conflict = already following)
    const existing = await queryOne(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId],
    );
    if (existing) {
        return res.json({ success: true, message: 'Already following' });
    }

    await query(
        'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
        [followerId, followingId],
    );

    // Publish event for notification-worker
    await publish(EXCHANGES.USER_EVENTS, ROUTING_KEYS.USER_FOLLOWED, {
        followerId,
        followingId,
        followerUsername: req.user!.username,
    });

    res.status(201).json({ success: true, data: { following: true } });
}));

// ── DELETE /unfollow/:id ──────────────────────────────────────
router.delete('/unfollow/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const followerId = req.user!.userId;
    const followingId = req.params.id;

    await query(
        'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId],
    );

    res.json({ success: true, data: { following: false } });
}));

// ── GET /followers/:id ────────────────────────────────────────
router.get('/followers/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const followers = await query(
        `SELECT u.id, u.username, u.avatar_url
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC LIMIT $2`,
        [id, limit],
    );
    res.json({ success: true, data: followers });
}));

// ── GET /following/:id ────────────────────────────────────────
router.get('/following/:id', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const following = await query(
        `SELECT u.id, u.username, u.avatar_url
     FROM follows f JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC LIMIT $2`,
        [id, limit],
    );
    res.json({ success: true, data: following });
}));

export default router;
