import * as Minio from 'minio';
import { Readable } from 'stream';

export const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_HOST || 'minio',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'gamereel_access',
    secretKey: process.env.MINIO_SECRET_KEY || 'changeme_minio_secret',
});

export const BUCKET = process.env.MINIO_BUCKET || 'game-assets';

/** Download a MinIO object into a Buffer */
export async function downloadFile(key: string): Promise<Buffer> {
    const stream = await minioClient.getObject(BUCKET, key);
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

/** Upload a Buffer to MinIO */
export async function uploadFile(
    key: string,
    data: Buffer,
    contentType = 'application/octet-stream',
    metadata: Record<string, string> = {},
): Promise<void> {
    await minioClient.putObject(
        BUCKET,
        key,
        Readable.from(data),
        data.length,
        { 'Content-Type': contentType, ...metadata },
    );
}

/** Upload a JSON object as manifest.json */
export async function uploadJson(key: string, obj: unknown): Promise<void> {
    const buf = Buffer.from(JSON.stringify(obj, null, 2));
    await uploadFile(key, buf, 'application/json');
}

/** Delete temp assembled file after processing */
export async function deleteFile(key: string): Promise<void> {
    await minioClient.removeObject(BUCKET, key);
}

/** Generate a public URL (no auth) for the given key */
export function publicUrl(key: string): string {
    const host = process.env.MINIO_PUBLIC_URL || process.env.MINIO_PUBLIC_HOST || 'http://localhost:9000';
    return `${host}/${BUCKET}/${key}`;
}

export async function checkMinioHealth(): Promise<boolean> {
    try { await minioClient.bucketExists(BUCKET); return true; } catch { return false; }
}
