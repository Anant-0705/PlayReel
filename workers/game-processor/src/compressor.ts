import { promisify } from 'util';
import { brotliCompress, constants as zlibConstants } from 'zlib';

const brotliCompressAsync = promisify(brotliCompress);

// DISABLED: Brotli pre-compression causes garbled output over HTTP (browsers only
// decompress Brotli over HTTPS). Re-enable when deploying behind HTTPS/CDN.
const COMPRESSIBLE_EXTENSIONS: string[] = [];

export interface CompressResult {
    originalSize: number;
    compressedSize: number;
    compressed: Buffer;
    skipped: boolean; // true if already compressed or not worth compressing
}

/**
 * Brotli-compress a single file buffer if it's a compressible type.
 * Skips files that are already very small (< 1KB) or already binary-compressed.
 */
export async function compressFile(
    filename: string,
    data: Buffer,
): Promise<CompressResult> {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

    if (!COMPRESSIBLE_EXTENSIONS.includes(ext) || data.length < 1024) {
        return { originalSize: data.length, compressedSize: data.length, compressed: data, skipped: true };
    }

    const compressed = await brotliCompressAsync(data, {
        params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 6, // balance speed vs ratio
        },
    });

    // Only use compressed version if it's actually smaller
    if (compressed.length >= data.length) {
        return { originalSize: data.length, compressedSize: data.length, compressed: data, skipped: true };
    }

    return {
        originalSize: data.length,
        compressedSize: compressed.length,
        compressed,
        skipped: false,
    };
}

/**
 * Compress all compressible files in a map.
 * Returns the same map with buffers replaced by compressed versions.
 */
export async function compressAll(
    files: Map<string, Buffer>,
): Promise<{ files: Map<string, Buffer>; savedBytes: number }> {
    let savedBytes = 0;
    const result = new Map<string, Buffer>();

    await Promise.all(
        Array.from(files.entries()).map(async ([name, buf]) => {
            const { compressed, originalSize, compressedSize, skipped } = await compressFile(name, buf);
            result.set(name, compressed);
            if (!skipped) {
                savedBytes += originalSize - compressedSize;
                console.log(`[compressor] ${name}: ${originalSize} → ${compressedSize} bytes (Brotli)`);
            }
        }),
    );

    return { files: result, savedBytes };
}
