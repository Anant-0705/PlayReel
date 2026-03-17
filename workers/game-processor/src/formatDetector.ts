import AdmZip from 'adm-zip';

export type GameFormat =
    | 'unity-webgl'
    | 'godot-html5'
    | 'html5'
    | 'raw-wasm'
    | 'unknown';

export interface FormatDetectionResult {
    format: GameFormat;
    entryPoint: string;       // relative path to index.html (or '' for wasm)
    hasWasm: boolean;
    hasJs: boolean;
    fileList: string[];       // all file paths in ZIP
}

/**
 * Detect game format from ZIP contents.
 * Priority: Unity → Godot → HTML5 → unknown
 */
export function detectFormat(zip: AdmZip): FormatDetectionResult {
    const entries = zip.getEntries().map((e) => e.entryName.toLowerCase());
    const fileList = zip.getEntries().map((e) => e.entryName);

    const hasWasm = entries.some((e) => e.endsWith('.wasm'));
    const hasJs = entries.some((e) => e.endsWith('.js'));

    // Unity WebGL: has Build/ folder with .data, .framework.js, .loader.js, .wasm
    const isUnity =
        entries.some((e) => e.includes('build/') && e.endsWith('.loader.js')) &&
        entries.some((e) => e.includes('build/') && e.endsWith('.framework.js'));

    // Godot HTML5: has specific .pck or .side.js patterns
    const isGodot =
        entries.some((e) => e.endsWith('.pck')) ||
        entries.some((e) => e.includes('godot'));

    // Generic HTML5: any index.html
    const indexEntry = fileList.find(
        (e) => e.toLowerCase() === 'index.html' || e.toLowerCase().endsWith('/index.html'),
    );

    if (isUnity) {
        return {
            format: 'unity-webgl',
            entryPoint: indexEntry ?? 'index.html',
            hasWasm,
            hasJs,
            fileList,
        };
    }

    if (isGodot) {
        return {
            format: 'godot-html5',
            entryPoint: indexEntry ?? 'index.html',
            hasWasm,
            hasJs,
            fileList,
        };
    }

    if (indexEntry) {
        return {
            format: 'html5',
            entryPoint: indexEntry,
            hasWasm,
            hasJs,
            fileList,
        };
    }

    return {
        format: 'unknown',
        entryPoint: '',
        hasWasm,
        hasJs,
        fileList,
    };
}

/**
 * Detect format from a raw .wasm Buffer (magic bytes check).
 * Returns true if the buffer starts with the WASM magic bytes \0asm.
 */
export function isValidWasm(buf: Buffer): boolean {
    return buf.length >= 4 &&
        buf[0] === 0x00 &&
        buf[1] === 0x61 &&
        buf[2] === 0x73 &&
        buf[3] === 0x6d;
}
