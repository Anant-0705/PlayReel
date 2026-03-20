import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query, queryOne } from '../db';
import { storeChunk, assembleChunks, cleanupChunks } from '../minio';
import { publishGameSubmitted } from '../rabbitmq';
import { requireAuth } from '../middleware/auth';
import {
    asyncHandler,
    ValidationError,
    RateLimitError,
    NotFoundError,
    ForbiddenError,
} from '../../../../shared/errors';
import {
    MAX_UPLOAD_SIZE,
    CHUNK_SIZE,
    MAX_UPLOADS_PER_DAY,
    MAX_CONCURRENT_SESSIONS,
    ACCEPTED_FORMATS,
    UPLOAD_HEADERS,
} from '../../../../shared/constants';

const router = Router();

// Rate limit for upload endpoints: 30 req/min per user
const uploadRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
    message: { success: false, error: 'Upload rate limit exceeded' },
});

// ── Schemas ───────────────────────────────────────────────────
const normalizeGenre = (value: unknown) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'arcade') return 'other';
    return normalized;
};

const InitSchema = z.object({
    filename: z.string().min(1),
    fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE),
    totalChunks: z.number().int().positive().max(Math.ceil(MAX_UPLOAD_SIZE / CHUNK_SIZE)),
    metadata: z.object({
        title: z.string().min(1).max(100),
        description: z.string().max(500).default(''),
        genre: z.preprocess(
            normalizeGenre,
            z.enum(['action', 'puzzle', 'platformer', 'rpg', 'shooter', 'strategy', 'sports', 'horror', 'simulation', 'other']),
        ),
        playstoreUrl: z.string().url().optional(),
    }),
});

// ── POST /upload/init ─────────────────────────────────────────
router.post('/upload/init', requireAuth, uploadRateLimit, asyncHandler(async (req: Request, res: Response) => {
    const parsed = InitSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new ValidationError('Invalid upload parameters', parsed.error.flatten().fieldErrors as Record<string, string>);
    }

    const { filename, fileSize, totalChunks, metadata } = parsed.data;
    const userId = req.user!.userId;

    // Validate file extension
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_FORMATS.includes(ext as typeof ACCEPTED_FORMATS[number])) {
        throw new ValidationError(`Unsupported file format. Accepted: ${ACCEPTED_FORMATS.join(', ')}`);
    }

    // Enforce daily upload quota (10/user/day)
    const [quotaRow] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM upload_sessions
     WHERE uploader_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId],
    );
    if (parseInt(quotaRow?.count ?? '0', 10) >= MAX_UPLOADS_PER_DAY) {
        throw new RateLimitError(`Daily upload limit of ${MAX_UPLOADS_PER_DAY} reached`);
    }

    // Enforce max concurrent active sessions (5)
    const [concurrentRow] = await query<{ count: string }>(
        `SELECT count(*)::text AS count FROM upload_sessions
     WHERE uploader_id = $1 AND status IN ('initiated','uploading')`,
        [userId],
    );
    if (parseInt(concurrentRow?.count ?? '0', 10) >= MAX_CONCURRENT_SESSIONS) {
        throw new RateLimitError(`Max concurrent upload sessions (${MAX_CONCURRENT_SESSIONS}) reached`);
    }

    // Create game record with status 'uploading' — visible in profile immediately
    const gameId = uuidv4();
    await query(
        `INSERT INTO games (id, uploader_id, title, genre, description, status, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5, 'uploading', $6)`,
        [gameId, userId, metadata.title, metadata.genre, metadata.description, fileSize],
    );

    // Create upload session
    const sessionId = uuidv4();
    await query(
        `INSERT INTO upload_sessions
       (id, game_id, uploader_id, filename, total_size, total_chunks, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'initiated', $7)`,
        [sessionId, gameId, userId, filename, fileSize, totalChunks, JSON.stringify(metadata)],
    );

    res.status(201).json({
        success: true,
        data: { sessionId, gameId, chunkSize: CHUNK_SIZE },
    });
}));

// ── PUT /upload/chunk ─────────────────────────────────────────
router.put(
    '/upload/chunk',
    requireAuth,
    uploadRateLimit,
    // Parse raw binary body for chunk data
    (req, _res, next) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => { (req as Request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks); next(); });
        req.on('error', next);
    },
    asyncHandler(async (req: Request & { rawBody?: Buffer }, res: Response) => {
        const sessionId = req.headers[UPLOAD_HEADERS.SESSION_ID] as string;
        const chunkIndex = parseInt(req.headers[UPLOAD_HEADERS.CHUNK_INDEX] as string, 10);
        const totalChunks = parseInt(req.headers[UPLOAD_HEADERS.TOTAL_CHUNKS] as string, 10);
        const userId = req.user!.userId;

        if (!sessionId || isNaN(chunkIndex) || isNaN(totalChunks)) {
            throw new ValidationError('Missing required headers: X-Session-ID, X-Chunk-Index, X-Total-Chunks');
        }
        if (!req.rawBody || req.rawBody.length === 0) {
            throw new ValidationError('Chunk body is empty');
        }
        if (req.rawBody.length > CHUNK_SIZE + 1024) { // +1KB tolerance
            throw new ValidationError(`Chunk exceeds maximum size of ${CHUNK_SIZE} bytes`);
        }

        // Validate session ownership
        const session = await queryOne<{
            id: string; game_id: string; uploader_id: string;
            total_chunks: number; chunks_received: number; status: string;
        }>(
            "SELECT id, game_id, uploader_id, total_chunks, chunks_received, status FROM upload_sessions WHERE id = $1",
            [sessionId],
        );
        if (!session) throw new NotFoundError('Upload session');
        if (session.uploader_id !== userId) throw new ForbiddenError('Not your upload session');
        if (session.status === 'complete' || session.status === 'failed') {
            throw new ValidationError(`Session already ${session.status}`);
        }

        // Store the chunk in MinIO
        await storeChunk(sessionId, chunkIndex, req.rawBody);

        // Increment chunks_received counter
        const [updated] = await query<{ chunks_received: number; total_chunks: number; status: string }>(
            `UPDATE upload_sessions
       SET chunks_received = chunks_received + 1, status = 'uploading'
       WHERE id = $1
       RETURNING chunks_received, total_chunks, status`,
            [sessionId],
        );

        // Check if all chunks received
        if (updated.chunks_received >= updated.total_chunks) {
            await handleAssembly(session.id, session.game_id, userId, session.total_chunks, session);
            res.json({
                success: true,
                data: { chunksReceived: updated.chunks_received, totalChunks: updated.total_chunks, assembled: true },
            });
            return;
        }

        res.json({
            success: true,
            data: { chunksReceived: updated.chunks_received, totalChunks: updated.total_chunks, assembled: false },
        });
    }),
);

// ── GET /upload/progress/:sessionId ───────────────────────────
router.get('/upload/progress/:sessionId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.user!.userId;

    const session = await queryOne<{
        id: string; game_id: string; uploader_id: string;
        chunks_received: number; total_chunks: number; status: string;
    }>(
        'SELECT id, game_id, uploader_id, chunks_received, total_chunks, status FROM upload_sessions WHERE id = $1',
        [sessionId],
    );
    if (!session) throw new NotFoundError('Upload session');
    if (session.uploader_id !== userId) throw new ForbiddenError('Not your upload session');

    // Get game status for the frontend stage machine
    const game = await queryOne<{ status: string }>(
        'SELECT status FROM games WHERE id = $1',
        [session.game_id],
    );

    const percentage = Math.round((session.chunks_received / session.total_chunks) * 100);

    res.json({
        success: true,
        data: {
            sessionId: session.id,
            gameId: session.game_id,
            status: session.status,
            chunksReceived: session.chunks_received,
            totalChunks: session.total_chunks,
            gameStatus: game?.status ?? 'uploading',
            percentage,
        },
    });
}));

// ── Assembly helper ───────────────────────────────────────────
async function handleAssembly(
    sessionId: string,
    gameId: string,
    uploaderId: string,
    totalChunks: number,
    session: { status: string },
): Promise<void> {
    // Mark as assembling
    await query(
        "UPDATE upload_sessions SET status = 'assembling' WHERE id = $1",
        [sessionId],
    );

    // Get metadata from session
    const fullSession = await queryOne<{
        filename: string; metadata: { title: string; description: string; genre: string };
        total_size: number;
    }>(
        'SELECT filename, metadata, total_size FROM upload_sessions WHERE id = $1',
        [sessionId],
    );

    if (!fullSession) return;

    // Assemble in MinIO
    const minioKey = await assembleChunks(sessionId, gameId, totalChunks, fullSession.filename);

    // Mark session as complete
    await query(
        "UPDATE upload_sessions SET status = 'complete' WHERE id = $1",
        [sessionId],
    );

    // Update game status to 'processing'
    await query(
        "UPDATE games SET status = 'processing' WHERE id = $1",
        [gameId],
    );

    // Determine format from filename extension
    const ext = fullSession.filename.slice(fullSession.filename.lastIndexOf('.')).toLowerCase();

    // Publish to game-processor via RabbitMQ
    await publishGameSubmitted({
        gameId,
        sessionId,
        uploaderId,
        filename: fullSession.filename,
        minioKey,
        format: ext === '.wasm' ? 'wasm' : 'zip',
        fileSizeBytes: fullSession.total_size,
        metadata: fullSession.metadata,
    });

    // Cleanup temp chunks (fire and forget — don't block response)
    cleanupChunks(sessionId, totalChunks).catch((err) => {
        console.warn('[upload] Chunk cleanup failed:', err.message);
    });
}

export default router;
