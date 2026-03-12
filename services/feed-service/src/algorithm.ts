import { query } from '../db';
import { FEED_SCORE_WEIGHTS, FEED_PAGE_SIZE } from '../../../shared/constants';

export interface ScoredGame {
    id: string;
    title: string;
    genre: string;
    thumbnail_url: string | null;
    manifest_url: string | null;
    wasm_url: string | null;
    play_count: number;
    like_count: number;
    comment_count: number;
    status: string;
    uploader_id: string;
    uploader_username: string;
    uploader_avatar: string | null;
    created_at: string;
    score?: number;
}

/**
 * Build a personalized feed for a user.
 * Algorithm: followed users → trending → explore
 * Scoring: play_time × 0.4 + genre_match × 0.3 + likes × 0.3
 */
export async function buildFeed(
    userId: string,
    cursor?: string,
    limit = FEED_PAGE_SIZE,
): Promise<ScoredGame[]> {

    // Step 1: Get user's preferred genres (from interaction history)
    const genreRows = await query<{ genre: string; weight: number }>(
        `SELECT g.genre, SUM(i.play_duration_s) AS weight
     FROM user_game_interactions i
     JOIN games g ON g.id = i.game_id
     WHERE i.user_id = $1
     GROUP BY g.genre
     ORDER BY weight DESC
     LIMIT 3`,
        [userId],
    );
    const preferredGenres = new Set(genreRows.map((r) => r.genre));

    // Step 2: Get IDs of users this user follows
    const followRows = await query<{ following_id: string }>(
        'SELECT following_id FROM follows WHERE follower_id = $1',
        [userId],
    );
    const followedIds = followRows.map((r) => r.following_id);

    // Step 3: Fetch candidate games (already seen excluded)
    const seenRows = await query<{ game_id: string }>(
        'SELECT game_id FROM user_game_interactions WHERE user_id = $1',
        [userId],
    );
    const seenIds = seenRows.map((r) => r.game_id);

    const excludedIds = seenIds.length > 0
        ? `AND g.id NOT IN (${seenIds.map((_, i) => `$${i + 2}`).join(',')})`
        : '';
    const cursorClause = cursor ? `AND g.created_at < $${seenIds.length + 2}` : '';
    const params: unknown[] = [limit * 3, ...seenIds];
    if (cursor) params.push(cursor);

    const candidates = await query<ScoredGame>(
        `SELECT g.id, g.title, g.genre, g.thumbnail_url, g.manifest_url, g.wasm_url,
            g.play_count, g.like_count, g.comment_count, g.status, g.created_at,
            u.id AS uploader_id, u.username AS uploader_username, u.avatar_url AS uploader_avatar
     FROM games g JOIN users u ON u.id = g.uploader_id
     WHERE g.status = 'ready' ${excludedIds} ${cursorClause}
     ORDER BY g.created_at DESC
     LIMIT $1`,
        params,
    );

    // Step 4: Score and rank
    const maxLikes = Math.max(...candidates.map((g) => g.like_count), 1);
    const maxPlays = Math.max(...candidates.map((g) => g.play_count), 1);

    const scored = candidates.map((g) => {
        // Normalize metrics to 0–1
        const normalizedPlayTime = Math.min(g.play_count / maxPlays, 1);
        const normalizedLikes = Math.min(g.like_count / maxLikes, 1);
        const genreMatch = preferredGenres.has(g.genre) ? 1 : 0;

        // Followed user boost
        const followedBoost = followedIds.includes(g.uploader_id) ? 0.5 : 0;

        const score =
            normalizedPlayTime * FEED_SCORE_WEIGHTS.PLAY_TIME +
            genreMatch * FEED_SCORE_WEIGHTS.GENRE_MATCH +
            normalizedLikes * FEED_SCORE_WEIGHTS.LIKES +
            followedBoost;

        return { ...g, score };
    });

    // Sort by score descending, take requested limit
    scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return scored.slice(0, limit);
}

/**
 * Explore feed for anonymous/new users — just return trending games.
 */
export async function buildExploreFeed(cursor?: string, limit = FEED_PAGE_SIZE): Promise<ScoredGame[]> {
    const cursorClause = cursor ? 'AND g.created_at < $2' : '';
    const params: unknown[] = [limit];
    if (cursor) params.push(cursor);

    return query<ScoredGame>(
        `SELECT g.id, g.title, g.genre, g.thumbnail_url, g.manifest_url, g.wasm_url,
            g.play_count, g.like_count, g.comment_count, g.status, g.created_at,
            u.id AS uploader_id, u.username AS uploader_username, u.avatar_url AS uploader_avatar
     FROM games g JOIN users u ON u.id = g.uploader_id
     WHERE g.status = 'ready' ${cursorClause}
     ORDER BY (g.play_count * 0.4 + g.like_count * 0.3) DESC, g.created_at DESC
     LIMIT $1`,
        params,
    );
}
