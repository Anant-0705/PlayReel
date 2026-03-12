// ============================================================
// GameReel — Shared Constants
// ============================================================

// ── Upload ───────────────────────────────────────────────────

/** Maximum allowed upload file size: 200 MB */
export const MAX_UPLOAD_SIZE = 200 * 1024 * 1024; // 209_715_200 bytes

/** Chunk size for resumable upload: 5 MB */
export const CHUNK_SIZE = 5 * 1024 * 1024; // 5_242_880 bytes

/** Max uploads per user per day */
export const MAX_UPLOADS_PER_DAY = 10;

/** Max concurrent upload sessions per user */
export const MAX_CONCURRENT_SESSIONS = 5;

/** Accepted file extensions for upload */
export const ACCEPTED_FORMATS = ['.zip', '.wasm'] as const;
export type AcceptedFormat = (typeof ACCEPTED_FORMATS)[number];

/** WASM magic bytes: \0asm */
export const WASM_MAGIC_BYTES = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);

// ── Game Lifecycle States ─────────────────────────────────────

/**
 * 5-state lifecycle per scroll position.
 * Based on distance from the current active card index.
 */
export const GAME_STATES = {
    /** ±3+: no memory allocated, DOM node empty */
    DEAD: 'dead',
    /** ±2: memory allocated, fetch manifest.json only */
    DORMANT: 'dormant',
    /** ±1: load WASM + assets via Web Worker, init engine, pause frame 0 */
    PRELOAD: 'preload',
    /** adj (0, not tapped): fully loaded, paused at frame 0, waiting */
    READY: 'ready',
    /** 0, tapped: running, accepting input, audio on, timer recording */
    ACTIVE: 'active',
} as const;
export type GameState = (typeof GAME_STATES)[keyof typeof GAME_STATES];

/**
 * How many cards away from the active index transitions happen.
 * dead ← ±3 → dormant ← ±2 → preload ← ±1 → ready ← 0 → active
 */
export const LIFECYCLE_WINDOW_SIZE = 3;

// ── Feed ─────────────────────────────────────────────────────

/** Default number of games per feed page */
export const FEED_PAGE_SIZE = 20;

/** Redis feed cache TTL in seconds */
export const FEED_CACHE_TTL = 300; // 5 minutes

/** Feed scoring weights */
export const FEED_SCORE_WEIGHTS = {
    PLAY_TIME: 0.4,
    GENRE_MATCH: 0.3,
    LIKES: 0.3,
} as const;

// ── JWT ──────────────────────────────────────────────────────

export const JWT_ACCESS_EXPIRY = '7d';
export const JWT_REFRESH_EXPIRY = '30d';

// ── MinIO ────────────────────────────────────────────────────

export const MINIO_BUCKET = 'game-assets';

/** Signed URL expiry for game assets: 1 hour */
export const MINIO_SIGNED_URL_EXPIRY = 3600; // seconds

export const MINIO_PATHS = {
    gameIndex: (gameId: string) => `games/${gameId}/index.html`,
    gameWasm: (gameId: string) => `games/${gameId}/game.wasm`,
    gameManifest: (gameId: string) => `games/${gameId}/manifest.json`,
    gameThumbnail: (gameId: string) => `games/${gameId}/thumbnail.jpg`,
    gameAsset: (gameId: string, filename: string) => `games/${gameId}/${filename}`,
    tempChunk: (sessionId: string, chunkIndex: number) =>
        `uploads/temp/${sessionId}/chunk_${String(chunkIndex).padStart(4, '0')}`,
    assembledZip: (gameId: string) => `uploads/ready/${gameId}.zip`,
} as const;

// ── WebSocket ─────────────────────────────────────────────────

/** Socket.io room prefix for per-game rooms */
export const WS_GAME_ROOM_PREFIX = 'game:';

/** Viewer count Redis key prefix */
export const VIEWER_COUNT_KEY_PREFIX = 'viewers:';

// ── Security Scanner ─────────────────────────────────────────

/** Critical patterns → block game + take offline */
export const SECURITY_CRITICAL_PATTERNS = [
    { pattern: /coinhive|cryptonight|minero\.ai/i, description: 'Crypto mining' },
    { pattern: /window\.parent|window\.top/i, description: 'iframe escape attempt' },
    { pattern: /document\.cookie.*fetch|fetch.*document\.cookie/i, description: 'Cookie theft' },
    { pattern: /eval\s*\(\s*atob\s*\(/i, description: 'Obfuscated eval' },
] as const;

/** Blocked file extensions in uploads */
export const BLOCKED_EXTENSIONS = ['.exe', '.sh', '.bat', '.php', '.dll', '.py', '.rb'];

/** Warning patterns → flag for review, game stays live */
export const SECURITY_WARNING_PATTERNS = [
    { pattern: /fetch\s*\(\s*['"`]https?:\/\/(?!gamereel\.app)/i, description: 'External fetch' },
    { pattern: /window\.open\s*\(/i, description: 'Popup attempt' },
    { pattern: /window\.location\s*=/i, description: 'Redirect attempt' },
] as const;

// ── Genre List ────────────────────────────────────────────────

export const GENRES = [
    'action',
    'puzzle',
    'platformer',
    'rpg',
    'shooter',
    'strategy',
    'sports',
    'horror',
    'simulation',
    'other',
] as const;

// ── Rate Limits ───────────────────────────────────────────────

export const RATE_LIMITS = {
    /** General API: requests per window */
    API_WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
    API_MAX_REQUESTS: 100,

    /** Upload endpoint: stricter */
    UPLOAD_WINDOW_MS: 60 * 1000,    // 1 minute
    UPLOAD_MAX_REQUESTS: 30,

    /** Auth endpoints */
    AUTH_WINDOW_MS: 15 * 60 * 1000,
    AUTH_MAX_REQUESTS: 20,
} as const;

// ── HTTP Headers for chunk upload ─────────────────────────────

export const UPLOAD_HEADERS = {
    SESSION_ID: 'x-session-id',
    CHUNK_INDEX: 'x-chunk-index',
    TOTAL_CHUNKS: 'x-total-chunks',
} as const;

// ── Service Names (for health checks / logs) ──────────────────

export const SERVICE_NAMES = {
    USER: 'user-service',
    GAME: 'game-service',
    FEED: 'feed-service',
    SOCIAL: 'social-service',
    UPLOAD: 'upload-service',
    GAME_PROCESSOR: 'game-processor',
    NOTIFICATION: 'notification-worker',
} as const;
