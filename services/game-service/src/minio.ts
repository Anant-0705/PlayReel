import * as Minio from 'minio';
import { MINIO_SIGNED_URL_EXPIRY } from '../../../shared/constants';

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_HOST || 'minio',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'gamereel_access',
    secretKey: process.env.MINIO_SECRET_KEY || 'changeme_minio_secret',
});

const BUCKET = process.env.MINIO_BUCKET || 'game-assets';

/**
 * Generate a presigned GET URL for a game asset.
 * Expires in 1 hour by default (MINIO_SIGNED_URL_EXPIRY).
 */
export async function getSignedUrl(objectKey: string, expiry = MINIO_SIGNED_URL_EXPIRY): Promise<string> {
    return minioClient.presignedGetObject(BUCKET, objectKey, expiry);
}

/**
 * For games with public accessible assets, return a direct URL without signing.
 * (Used after MinIO anonymous read is enabled on the games/ prefix)
 */
export function getPublicUrl(objectKey: string): string {
    const publicBase = process.env.MINIO_PUBLIC_URL || 'http://localhost:9000';
    return `${publicBase}/${BUCKET}/${objectKey}`;
}

export async function checkMinioHealth(): Promise<boolean> {
    try {
        await minioClient.bucketExists(BUCKET);
        return true;
    } catch {
        return false;
    }
}

export { minioClient, BUCKET };
