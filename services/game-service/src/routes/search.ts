import { Router, Request, Response } from 'express';
import { searchGames } from '../elasticsearch';
import { query } from '../db';
import { asyncHandler } from '../../../../shared/errors';

const router = Router();

// ── GET /search?q=&genre=&engine=&sort= ───────────────────────
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const q = (req.query.q as string)?.trim();
    const genre = req.query.genre as string | undefined;
    const format = req.query.engine as string | undefined; // 'engine' param maps to format field
    const sort = (req.query.sort as string) || 'newest';
    const page = Math.max(0, Number(req.query.page) || 0);
    const size = Math.min(Number(req.query.size) || 20, 50);

    if (!q && !genre && !format) {
        // No filters — return newest games from DB (faster than ES)
        const games = await query(
            `SELECT g.id, g.title, g.genre, g.format, g.thumbnail_url,
              g.play_count, g.like_count, g.created_at,
              u.username AS uploader_username
       FROM games g JOIN users u ON u.id = g.uploader_id
       WHERE g.status = 'ready'
       ORDER BY g.created_at DESC
       LIMIT $1 OFFSET $2`,
            [size, page * size],
        );
        res.json({ success: true, data: { games, total: games.length, page, size } });
        return;
    }

    const { hits, total } = await searchGames({
        q,
        genre,
        format,
        sort: sort as 'newest' | 'popular' | 'trending',
        from: page * size,
        size,
    });

    res.json({ success: true, data: { games: hits, total, page, size, hasMore: (page + 1) * size < total } });
}));

export default router;
