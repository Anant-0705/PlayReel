import AdmZip from 'adm-zip';
import { ConsumeMessage } from 'amqplib';
import path from 'path';
import { query } from './db';
import { downloadFile, uploadFile, uploadJson, deleteFile, publicUrl } from './minio';
import { indexGame } from './elasticsearch';
import { publish } from './rabbitmq';
import { detectFormat, isValidWasm } from './formatDetector';
import { scanFiles, extractTextFiles } from './scanner';
import { compressAll } from './compressor';
import { generateWasmWrapper } from './wasmWrapper';
import { captureScreenshot, generatePlaceholderThumbnail } from './thumbnail';
import { GameSubmittedMessage, EXCHANGES, ROUTING_KEYS } from '../../shared/events';
import { MINIO_PATHS } from '../../shared/constants';

export async function processGame(msg: ConsumeMessage): Promise<void> {
    const payload = JSON.parse(msg.content.toString()) as GameSubmittedMessage;
    const { gameId, sessionId, uploaderId, filename, minioKey, format, metadata } = payload;

    console.log(`[processor] Starting: gameId=${gameId} format=${format}`);

    // ── 1. Download assembled file ────────────────────────────────────────
    const rawBuffer = await downloadFile(minioKey);
    console.log(`[processor] Downloaded ${rawBuffer.length} bytes`);

    const filesToUpload = new Map<string, Buffer>(); // key → buffer
    let entryPointPath: string = MINIO_PATHS.gameIndex(gameId);
    let wasmKey: string | null = null;
    type ProcessingFormat = 'zip' | 'wasm' | 'raw-wasm' | 'unity-webgl' | 'godot-html5' | 'html5';
    let detectedFormat: ProcessingFormat = format;

    if (format === 'wasm') {
        // ── 2a. Raw WASM path ─────────────────────────────────────────────
        if (!isValidWasm(rawBuffer)) {
            throw new Error('Invalid WASM magic bytes — file may be corrupt');
        }
        wasmKey = MINIO_PATHS.gameWasm(gameId);
        filesToUpload.set(wasmKey, rawBuffer);

        const wasmPublicUrl = publicUrl(wasmKey);
        const wrapperHtml = generateWasmWrapper(metadata.title, wasmPublicUrl);
        filesToUpload.set(MINIO_PATHS.gameIndex(gameId), Buffer.from(wrapperHtml));
        detectedFormat = 'raw-wasm';

    } else {
        // ── 2b. ZIP path ──────────────────────────────────────────────────
        const zip = new AdmZip(rawBuffer);
        const detection = detectFormat(zip);

        if (detection.format === 'unknown') {
            throw new Error('ZIP has no index.html and no detectable game format');
        }

        detectedFormat = detection.format as ProcessingFormat;
        entryPointPath = `games/${gameId}/${detection.entryPoint}`;

        // Extract all ZIP entries into the files map
        for (const entry of zip.getEntries()) {
            if (entry.isDirectory) continue;
            const destKey = `games/${gameId}/${entry.entryName}`;
            filesToUpload.set(destKey, entry.getData());
            if (entry.entryName.endsWith('.wasm')) {
                wasmKey = destKey;
            }
        }
    }

    // ── 3. Brotli compress .wasm + .js files ─────────────────────────────
    const { files: compressedFiles, savedBytes } = await compressAll(filesToUpload);
    console.log(`[processor] Compressed. Saved ${savedBytes} bytes`);

    // ── 4. Upload all files to MinIO ──────────────────────────────────────
    await Promise.all(
        Array.from(compressedFiles.entries()).map(([key, buf]) => {
            const ext = path.extname(key).toLowerCase();
            const contentType = contentTypeFor(ext);
            const metadata: Record<string, string> = {};
            return uploadFile(key, buf, contentType, metadata);
        }),
    );
    console.log(`[processor] Uploaded ${compressedFiles.size} files`);

    // ── 5. Write manifest.json ────────────────────────────────────────────
    const manifestKey = MINIO_PATHS.gameManifest(gameId);
    const manifest = {
        gameId,
        title: metadata.title,
        description: metadata.description,
        genre: metadata.genre,
        format: detectedFormat,
        indexUrl: publicUrl(entryPointPath),
        wasmUrl: wasmKey ? publicUrl(wasmKey) : null,
        assetCount: compressedFiles.size,
        createdAt: new Date().toISOString(),
    };
    await uploadJson(manifestKey, manifest);

    // ── 6. DB: set status='ready', store URLs ─────────────────────────────
    const manifestUrl = publicUrl(manifestKey);
    const indexUrl = publicUrl(entryPointPath);

    let bannerUrl: string | null = null;
    if (metadata.bannerBase64) {
        try {
            const match = metadata.bannerBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
            if (match) {
                const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                const buf = Buffer.from(match[2], 'base64');
                const bannerKey = `games/${gameId}/banner.${ext}`;
                await uploadFile(bannerKey, buf, `image/${match[1]}`);
                bannerUrl = publicUrl(bannerKey);
                console.log(`[processor] Uploaded custom banner: ${bannerUrl}`);
            }
        } catch (e) { 
            console.error('[processor] Failed to process bannerBase64', e); 
        }
    }

    await query(
        `UPDATE games
         SET status = 'ready',
             manifest_url = $1,
             wasm_url = $2,
             format = $3,
             banner_url = $5,
             updated_at = NOW()
         WHERE id = $4`,
        [manifestUrl, wasmKey ? publicUrl(wasmKey) : null, detectedFormat, gameId, bannerUrl],
    );
    console.log(`[processor] DB updated — game is live: ${gameId}`);

    // ── 7. Publish game.approved → feed-service ───────────────────────────
    await publish(EXCHANGES.GAME_EVENTS, ROUTING_KEYS.GAME_APPROVED, {
        gameId,
        uploaderId,
        title: metadata.title,
        genre: metadata.genre,
        manifestUrl,
    });

    // ── 8. Publish game.published → notification-worker ───────────────────
    await publish(EXCHANGES.GAME_EVENTS, ROUTING_KEYS.GAME_PUBLISHED, {
        gameId,
        uploaderId,
        title: metadata.title,
    });

    console.log(`[processor] Game ${gameId} is LIVE — starting async post-processing`);

    // ── ASYNC: security scan, thumbnail, ES indexing (non-blocking) ───────
    setImmediate(() => runPostProcessing(gameId, uploaderId, metadata, indexUrl, compressedFiles));

    // Clean up temp assembled file (fire-and-forget)
    deleteFile(minioKey).catch((e) => console.warn('[processor] Cleanup failed:', e.message));
}

// ── Post-processing (runs after game is already live) ─────────────────────

async function runPostProcessing(
    gameId: string,
    uploaderId: string,
    metadata: { title: string; description: string; genre: string },
    indexUrl: string,
    files: Map<string, Buffer>,
): Promise<void> {
    await Promise.allSettled([
        runSecurityScan(gameId, uploaderId, metadata, files),
        runThumbnail(gameId, metadata.title, indexUrl),
        runEsIndex(gameId, uploaderId, metadata),
    ]);
}

async function runSecurityScan(
    gameId: string,
    uploaderId: string,
    metadata: { title: string },
    files: Map<string, Buffer>,
): Promise<void> {
    try {
        // Build text file map for scanner
        const textFiles = new Map<string, string>();
        for (const [key, buf] of files) {
            const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
            if (['.js', '.html', '.htm', '.css'].includes(ext)) {
                textFiles.set(key, buf.toString('utf8'));
            }
        }
        const { scanFiles: scanFn } = await import('./scanner');
        const result = scanFn(textFiles);

        if (!result.passed) {
            console.warn(`[scanner] Game ${gameId} FLAGGED:`, result.criticalFlags);
            await query("UPDATE games SET status = 'flagged' WHERE id = $1", [gameId]);
            await publish(EXCHANGES.GAME_EVENTS, ROUTING_KEYS.GAME_FLAGGED, {
                gameId,
                uploaderId,
                reason: result.criticalFlags[0],
                flags: result.criticalFlags,
            });
        } else {
            console.log(`[scanner] Game ${gameId} passed. Warnings: ${result.warningFlags.length}`);
            if (result.warningFlags.length > 0) {
                await query(
                    "UPDATE games SET scan_warnings = $1 WHERE id = $2",
                    [JSON.stringify(result.warningFlags), gameId],
                );
            }
        }
    } catch (err) {
        console.error(`[scanner] Scan failed for ${gameId}:`, err);
    }
}

async function runThumbnail(gameId: string, title: string, indexUrl: string): Promise<void> {
    try {
        const thumbnail = await captureScreenshot(indexUrl);
        const thumbKey = MINIO_PATHS.gameThumbnail(gameId);
        await uploadFile(thumbKey, thumbnail, 'image/jpeg');
        await query(
            "UPDATE games SET thumbnail_url = $1 WHERE id = $2",
            [publicUrl(thumbKey), gameId],
        );
        console.log(`[thumbnail] Saved for game ${gameId}`);
    } catch (err) {
        console.warn(`[thumbnail] Screenshot failed for ${gameId}, using placeholder:`, err);
        try {
            const placeholder = await generatePlaceholderThumbnail(title);
            const thumbKey = MINIO_PATHS.gameThumbnail(gameId);
            await uploadFile(thumbKey, placeholder, 'image/jpeg');
            await query("UPDATE games SET thumbnail_url = $1 WHERE id = $2", [publicUrl(thumbKey), gameId]);
        } catch (e2) {
            console.error('[thumbnail] Placeholder also failed:', e2);
        }
    }
}

async function runEsIndex(
    gameId: string,
    uploaderId: string,
    metadata: { title: string; description: string; genre: string },
): Promise<void> {
    try {
        const [gameRow] = await query<{
            status: string; format: string; play_count: number; like_count: number;
            thumbnail_url: string; manifest_url: string; uploader_username: string;
        }>(
            `SELECT g.status, g.format, g.play_count, g.like_count,
                    g.thumbnail_url, g.manifest_url, u.username AS uploader_username
             FROM games g JOIN users u ON u.id = g.uploader_id
             WHERE g.id = $1`,
            [gameId],
        );

        if (gameRow) {
            await indexGame({
                id: gameId,
                title: metadata.title,
                description: metadata.description,
                genre: metadata.genre,
                format: gameRow.format,
                uploader_id: uploaderId,
                uploader_username: gameRow.uploader_username,
                thumbnail_url: gameRow.thumbnail_url,
                manifest_url: gameRow.manifest_url,
                play_count: gameRow.play_count,
                like_count: gameRow.like_count,
                status: gameRow.status,
                published_at: new Date().toISOString(),
            });
            console.log(`[elasticsearch] Indexed game ${gameId}`);
        }
    } catch (err) {
        console.error(`[elasticsearch] Indexing failed for ${gameId}:`, err);
    }
}

// ── Content-Type lookup ───────────────────────────────────────────────────

function contentTypeFor(ext: string): string {
    const map: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.htm': 'text/html; charset=utf-8',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.data': 'application/octet-stream',
        '.unityweb': 'application/octet-stream',
    };
    return map[ext] ?? 'application/octet-stream';
}
