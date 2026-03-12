import * as Minio from 'minio';
import { MINIO_PATHS } from '../../../shared/constants';
import { Readable } from 'stream';

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_HOST || 'minio',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'gamereel_access',
    secretKey: process.env.MINIO_SECRET_KEY || 'changeme_minio_secret',
});
const BUCKET = process.env.MINIO_BUCKET || 'game-assets';

/** Store a single chunk in MinIO temp storage */
export async function storeChunk(
    sessionId: string,
    chunkIndex: number,
    data: Buffer,
): Promise<void> {
    const key = MINIO_PATHS.tempChunk(sessionId, chunkIndex);
    await minioClient.putObject(BUCKET, key, Readable.from(data), data.length, {
        'Content-Type': 'application/octet-stream',
    });
}

/**
 * Assemble all chunks by downloading each and re-uploading as one stream.
 * Uses putObject with a streaming pass-through — avoids composeObject API differences between MinIO versions.
 */
export async function assembleChunks(
    sessionId: string,
    gameId: string,
    totalChunks: number,
    _filename: string,
): Promise<string> {
    const { PassThrough } = await import('stream');
    const assembledKey = MINIO_PATHS.assembledZip(gameId);
    const passThrough = new PassThrough();

    // Chain chunk streams sequentially into the passthrough
    const uploadPromise = minioClient.putObject(BUCKET, assembledKey, passThrough);

    (async () => {
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = MINIO_PATHS.tempChunk(sessionId, i);
            const chunkStream = await minioClient.getObject(BUCKET, chunkKey);
            await new Promise<void>((resolve, reject) => {
                chunkStream.pipe(passThrough, { end: false });
                chunkStream.on('end', resolve);
                chunkStream.on('error', reject);
            });
        }
        passThrough.end();
    })().catch((err) => passThrough.destroy(err));

    await uploadPromise;
    console.log(`[minio] Assembled ${totalChunks} chunks into ${assembledKey}`);
    return assembledKey;
}

/** Delete all temp chunks for a session */
export async function cleanupChunks(sessionId: string, totalChunks: number): Promise<void> {
    const keys = Array.from({ length: totalChunks }, (_, i) =>
        MINIO_PATHS.tempChunk(sessionId, i),
    );
    // MinIO v8 removeObjects accepts an array of ObjectName strings
    await minioClient.removeObjects(BUCKET, keys);
}

export async function checkMinioHealth(): Promise<boolean> {
    try { await minioClient.bucketExists(BUCKET); return true; } catch { return false; }
}

export { minioClient, BUCKET };
