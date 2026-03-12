import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db';
import { getPublicUrl } from '../minio';
import { optionalAuth } from '../middleware/auth';
import { asyncHandler, NotFoundError } from '../../../../shared/errors';
import { MINIO_PATHS } from '../../../../shared/constants';

const router = Router();

// ── GET /games ────────────────────────────────────────────────
router.get('/games', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const genre = req.query.genre as string | undefined;

    const conditions: string[] = ["g.status = 'ready'"];
    const params: unknown[] = [limit];

    if (genre) { conditions.push(`g.genre = $${params.length + 1}`); params.push(genre); }
    if (cursor) { conditions.push(`g.created_at < $${params.length + 1}`); params.push(cursor); }

    const where = conditions.join(' AND ');

    const games = await query(
        `SELECT g.id, g.title, g.genre, g.description, g.format, g.status,
            g.thumbnail_url, g.manifest_url, g.wasm_url,
            g.play_count, g.like_count, g.comment_count,
            g.file_size_bytes, g.created_at,
            u.id AS uploader_id, u.username AS uploader_username, u.avatar_url AS uploader_avatar
     FROM games g JOIN users u ON u.id = g.uploader_id
     WHERE ${where}
     ORDER BY g.created_at DESC
     LIMIT $1`,
        params,
    );

    const nextCursor = games.length === limit
        ? (games[games.length - 1] as { created_at: string }).created_at
        : null;

    res.json({ success: true, data: { games, nextCursor, hasMore: !!nextCursor } });
}));

// ── GET /games/:id ────────────────────────────────────────────
router.get('/games/:id', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const game = await queryOne(
        `SELECT g.*, u.id AS uploader_id, u.username AS uploader_username, u.avatar_url AS uploader_avatar
     FROM games g JOIN users u ON u.id = g.uploader_id
     WHERE g.id = $1`,
        [id],
    );
    if (!game) throw new NotFoundError('Game');

    // Auto-generate URLs if not stored
    const g = game as Record<string, unknown>;
    if (!g.thumbnail_url && g.id) {
        g.thumbnail_url = getPublicUrl(MINIO_PATHS.gameThumbnail(g.id as string));
    }
    if (!g.manifest_url && g.id) {
        g.manifest_url = getPublicUrl(MINIO_PATHS.gameManifest(g.id as string));
    }

    // Increment play count (fire and forget)
    query('UPDATE games SET play_count = play_count + 1 WHERE id = $1', [id]).catch(() => { });

    res.json({ success: true, data: game });
}));

// ── GET /games/:id/manifest ───────────────────────────────────
router.get('/games/:id/manifest', asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const game = await queryOne<{ status: string }>(
        "SELECT status FROM games WHERE id = $1",
        [id],
    );
    if (!game) throw new NotFoundError('Game');

    // Return the public URL — client fetches it directly from MinIO
    const manifestUrl = getPublicUrl(MINIO_PATHS.gameManifest(id));
    res.json({ success: true, data: { manifestUrl } });
}));

export default router;
